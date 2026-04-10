/**
 * Depix Compiler
 *
 * Orchestrates the full DSL → DepixIR pipeline:
 *   1. Parse (tokenize + parse → AST)
 *   2. Resolve data, flatten hierarchy, resolve theme
 *   3. Plan (AST → PlanNode tree, one per scene)
 *   4. Per-scene: scale → constraints → runBudgetMeasureFixpoint → allocate-bounds
 *      (runBudgetMeasureFixpoint는 budgets↔measure fixed-point 수렴 루프를 캡슐화)
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
import type { BudgetMap, ConstraintMap } from './passes/budget-types.js';
import { measureDiagram } from './passes/measure.js';
import { allocateBounds } from './passes/allocate-bounds.js';
import type { BoundsMap } from './passes/allocate-bounds.js';
import type { MeasureMap } from './passes/measure.js';
import { resolveFonts } from './passes/resolve-fonts.js';
import type { ScaleContext } from './passes/scale-system.js';
import type { PlanNode } from './layout/plan-types.js';
import { emit } from './emit.js';
import { computeAllChartPositions } from './passes/compute-chart-positions.js';
import { buildSceneMeta, buildSceneTransitions } from './scene-meta.js';

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
// Fixed-point helper: budget ↔ measure 수렴 루프
// ---------------------------------------------------------------------------

/**
 * MAX_ITER: 루프 본체 최대 반복 횟수 상한.
 * 기준: 초기 1회 + 피드백 1~2회로 거의 모든 실제 DSL이 수렴한다. 3은 안전 여유.
 * 단위: 반복 횟수 (무차원).
 */
const FIXPOINT_MAX_ITER = 3;

/**
 * EPS: 수렴 판정 임계값. minWidth/minHeight의 최대 절댓값 차가 이 값 미만이면 수렴.
 * 기준: 0–100 상대 좌표계에서 0.5 = 0.5% 이하 변화는 시각적 차이가 없음.
 * 단위: 0–100 상대 좌표.
 */
const FIXPOINT_EPS = 0.5;

/**
 * Fixed-point 수렴 결과.
 * `iterations`는 `measureDiagram` 호출 횟수 (초기 1회 포함).
 * `converged`는 EPS 기준으로 조기 종료했는지 여부. MAX_ITER clamp면 false.
 */
export interface FixpointResult {
  budgets: BudgetMap;
  measure: MeasureMap;
  iterations: number;
  converged: boolean;
}

/**
 * Root-scope budget↔measure fixed-point 수렴 루프.
 *
 * 왜 루프인가: fontSize는 budget shortSide에 의존하고, 자식의 minWidth/minHeight는
 * fontSize에 의존한다. 한 번의 top-down 분배만으로는 자식이 충분한 폰트로 자랄
 * 공간을 확보하지 못할 수 있다. 측정된 minSize를 다음 예산 배분의 바닥값으로
 * 재주입하여 수렴시킨다.
 *
 * 경계 제약 (S-pipeline.md MUST 참조):
 *   - 루트 스코프 1회 호출 — container별 재진입 금지
 *   - 초기 1회 + 루프 본체 ≤ MAX_ITER회 = 총 ≤ MAX_ITER+1회 measure 호출
 *   - EPS 수렴 시 조기 종료
 *   - 루프 본체는 allocateBudgets → measureDiagram 순서만 반복
 */
export function runBudgetMeasureFixpoint(
  plan: PlanNode,
  canvasBounds: IRBounds,
  constraints: ConstraintMap,
  scaleCtx: ScaleContext,
  theme: DepixTheme,
): FixpointResult {
  // 초기 1회 — measure 없이 배분
  let budgets = allocateBudgets(plan, canvasBounds, constraints, scaleCtx);
  let measure = measureDiagram(plan, theme, scaleCtx, budgets);
  let iterations = 1;
  let converged = false;

  for (let iter = 0; iter < FIXPOINT_MAX_ITER; iter++) {
    // measure 피드백으로 budget 재산출
    const nextBudgets = allocateBudgets(plan, canvasBounds, constraints, scaleCtx, measure);
    const nextMeasure = measureDiagram(plan, theme, scaleCtx, nextBudgets);
    iterations++;

    // 수렴 판정 — measure의 minWidth/minHeight 최대 절댓값 차
    let maxDelta = 0;
    for (const [id, m] of nextMeasure) {
      const prev = measure.get(id);
      if (!prev) {
        maxDelta = Infinity;
        break;
      }
      const dw = Math.abs(m.minWidth - prev.minWidth);
      const dh = Math.abs(m.minHeight - prev.minHeight);
      if (dw > maxDelta) maxDelta = dw;
      if (dh > maxDelta) maxDelta = dh;
    }

    budgets = nextBudgets;
    measure = nextMeasure;

    if (maxDelta < FIXPOINT_EPS) {
      converged = true;
      break;
    }
  }

  return { budgets, measure, iterations, converged };
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

  // 4. Plan — AST → PlanNode[] (one root PlanNode per scene)
  const plans = planDocument(resolvedAST, theme);

  // 5. Per-scene allocation pass
  const allBoundsMap: BoundsMap = new Map();
  const allMeasureMap: MeasureMap = new Map();

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    // @page * auto-height는 buildSceneMeta에서 meta.autoHeight=true로 렌더러에 전달한다.
    // 컴파일 단계 canvas는 상수 100으로 고정 — layout은 0–100 상대 좌표계.
    const canvasBounds: IRBounds = { x: 0, y: 0, w: 100, h: 100 };

    const scaleCtx = createScaleContext(plan, canvasBounds);
    const constraints = computeConstraints(plan, scaleCtx);

    // Root-scope fixed-point 수렴 루프 — budget↔fontSize 상호 의존 해소.
    // S-pipeline.md: 단일 헬퍼, MAX_ITER ≤ 5, EPS 수렴, 루트 스코프 한정.
    // budgets는 헬퍼 내부에서만 사용되고 현재 emit 이후 파이프라인에서는 쓰지 않는다.
    const { measure } = runBudgetMeasureFixpoint(
      plan,
      canvasBounds,
      constraints,
      scaleCtx,
      theme,
    );

    const bounds = allocateBounds(plan, canvasBounds, sceneTheme, scaleCtx, measure, constraints);

    // Post-allocation: 최종 bounds 기반으로 fontSize 재산출.
    // measure에서 budget 기반으로 추정했던 fontSize를 실제 도형 크기에 맞게 교정.
    const resolvedMeasure = resolveFonts([plan], bounds, measure);

    for (const [k, v] of bounds) allBoundsMap.set(k, v);
    for (const [k, v] of resolvedMeasure) allMeasureMap.set(k, v);
  }

  // 6. Emit IR — walk PlanNode trees using BoundsMap + MeasureMap
  const chartPositionsMap = computeAllChartPositions(plans, allBoundsMap);
  const meta = buildSceneMeta(resolvedAST.directives, theme, sceneTheme);
  let ir: DepixIR = {
    meta,
    scenes: emit(plans, allBoundsMap, theme, sceneTheme, allMeasureMap, chartPositionsMap),
    transitions: [],
  };
  ir = { ...ir, transitions: buildSceneTransitions(resolvedAST.directives, ir.scenes) };

  // 7. Post-processing: apply @overrides to IR bounds
  if (overrides.size > 0) {
    ir = applyOverridesToIR(ir, overrides);
  }

  return { ir, errors };
}
