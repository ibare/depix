/**
 * Depix Compiler
 *
 * Orchestrates the full DSL → DepixIR pipeline:
 *   1. Parse (tokenize + parse → AST)
 *   2. Resolve data, flatten hierarchy, resolve theme
 *   3. Plan (AST → PlanNode tree, one per scene)
 *   4. Per-scene: scale → constraints → budgets → measure → allocate-bounds
 *   5. Emit IR via unified walker pipeline
 *   6. Apply @overrides
 */

import type { DepixIR, IRBounds } from '../ir/types.js';
import type { DepixTheme } from '../theme/types.js';
import type { SceneTheme } from '../theme/scene-theme.js';
import { defaultSceneTheme } from '../theme/scene-theme.js';
import type { ASTDocument } from './ast.js';
import type { ParseError } from './ast.js';
import { parse } from './parser.js';
import { resolveData } from './data/resolve-data.js';
import { flattenHierarchy } from './passes/flatten-hierarchy.js';
import { resolveTheme } from './passes/resolve-theme.js';
import { lightTheme } from '../theme/builtin-themes.js';
import { extractOverrides, applyOverridesToIR } from './passes/apply-overrides.js';
import { planDocument } from './layout/plan-all.js';
import { createScaleContext } from './passes/scale-system.js';
import { computeConstraints } from './passes/compute-constraints.js';
import { allocateBudgets } from './passes/allocate-budgets.js';
import { measureDiagram } from './passes/measure.js';
import { allocateBounds } from './passes/allocate-bounds.js';
import type { BoundsMap } from './passes/allocate-bounds.js';
import type { MeasureMap } from './passes/measure.js';
import { emit } from './emit.js';
import { computeAllChartPositions } from './passes/compute-chart-positions.js';
import { buildSceneMeta, buildSceneTransitions } from './scene/scene-meta.js';
import { computeSceneNaturalHeight } from './scene/scene-measure.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Options for the compiler.
 */
export interface CompileOptions {
  /** Theme to use for resolving semantic tokens. Defaults to the light theme. */
  theme?: DepixTheme;
  /** Scene theme for scene layout rendering. Defaults to defaultSceneTheme. */
  sceneTheme?: SceneTheme;
}

/**
 * Result of a compilation.
 */
export interface CompileResult {
  /** The fully resolved IR document. */
  ir: DepixIR;
  /** Parse errors (non-fatal; the IR may still be partially valid). */
  errors: ParseError[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compile a DSL source string into a DepixIR document.
 *
 * This is the main entry point for the Depix compiler. It runs the full
 * pipeline: parse → resolve → planDocument → per-scene allocation → emit.
 *
 * All DSL compiles through the unified PlanNode pipeline.
 * Non-scene blocks are implicitly wrapped to a scene by planDocument.
 *
 * @param dsl     - The DSL source string.
 * @param options - Optional compiler configuration.
 * @returns The compiled IR and any parse errors.
 */
export function compile(dsl: string, options?: CompileOptions): CompileResult {
  const theme = options?.theme ?? lightTheme;
  const sceneTheme = options?.sceneTheme ?? defaultSceneTheme;

  // 1. Parse DSL → AST
  const { ast, errors } = parse(dsl);

  // 2. Resolve @data, flatten hierarchy (tree/flow nested → edges), resolve theme
  const resolvedAST = resolveTheme(flattenHierarchy(resolveData(ast)), theme);

  // 3. Extract @overrides (applied after IR emission)
  const overrides = extractOverrides(resolvedAST);

  // 4. @page * → content-driven height per scene
  const isAutoHeight = resolvedAST.directives.some(d => d.key === 'page' && d.value === '*');

  // 5. Plan — AST → PlanNode[] (one root PlanNode per scene)
  const plans = planDocument(resolvedAST, theme);

  // 6. Per-scene allocation pass
  const allBoundsMap: BoundsMap = new Map();
  const allMeasureMap: MeasureMap = new Map();

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    const h = isAutoHeight ? computeSceneNaturalHeight(resolvedAST.scenes[i], sceneTheme) : 100;
    const canvasBounds: IRBounds = { x: 0, y: 0, w: 100, h };

    const scaleCtx = createScaleContext(plan, canvasBounds);
    const constraints = computeConstraints(plan, scaleCtx);
    const budgets = allocateBudgets(plan, canvasBounds, constraints, scaleCtx);
    const measure = measureDiagram(plan, theme, scaleCtx, budgets);
    const bounds = allocateBounds(plan, canvasBounds, sceneTheme, scaleCtx, measure, constraints);

    for (const [k, v] of bounds) allBoundsMap.set(k, v);
    for (const [k, v] of measure) allMeasureMap.set(k, v);
  }

  // 7. Emit IR — walk PlanNode trees using BoundsMap + MeasureMap
  const chartPositionsMap = computeAllChartPositions(plans, allBoundsMap);
  const meta = buildSceneMeta(resolvedAST.directives, theme, sceneTheme);
  let ir: DepixIR = {
    meta,
    scenes: emit(plans, allBoundsMap, theme, sceneTheme, allMeasureMap, chartPositionsMap),
    transitions: [],
  };
  ir = { ...ir, transitions: buildSceneTransitions(resolvedAST.directives, ir.scenes) };

  // 8. Post-processing: apply @overrides to IR bounds
  if (overrides.size > 0) {
    ir = applyOverridesToIR(ir, overrides);
  }

  return { ir, errors };
}
