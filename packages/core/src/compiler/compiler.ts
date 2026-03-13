/**
 * Depix Compiler
 *
 * Orchestrates the full DSL → DepixIR pipeline:
 *   1. Parse (tokenize + parse → AST)
 *   2. Resolve data, flatten hierarchy, resolve theme
 *   3. Emit IR — all blocks go through the unified scene pipeline:
 *      - scene {} blocks → emitSceneIR (slot-based layout)
 *      - diagram blocks  → emitIR (diagram pipeline), pre-processed and injected
 *
 * @presentation directive is a no-op and no longer gates compilation mode.
 */

import type { DepixIR, IRScene } from '../ir/types.js';
import type { DepixTheme } from '../theme/types.js';
import type { SceneTheme } from '../theme/scene-theme.js';
import { defaultSceneTheme } from '../theme/scene-theme.js';
import type { ASTBlock, ASTDocument, ParseError } from './ast.js';
import { parse } from './parser.js';
import { resolveData } from './data/resolve-data.js';
import { flattenHierarchy } from './passes/flatten-hierarchy.js';
import { resolveTheme } from './passes/resolve-theme.js';
import { emitIR } from './passes/emit-ir.js';
import { emitSceneIR } from './scene/emit-scene.js';
import { lightTheme } from '../theme/builtin-themes.js';
import { extractOverrides, applyOverridesToIR } from './passes/apply-overrides.js';

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
 * pipeline: parse → theme resolution → layout → edge routing → IR emission.
 *
 * All DSL compiles through the unified scene pipeline. Diagram blocks
 * (flow, stack, grid, etc.) are pre-processed via the diagram pipeline
 * and injected into emitSceneIR as pre-resolved IRScene objects.
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

  // 2. Resolve @data directives (inject rows into table/chart blocks)
  const dataResolvedAST = resolveData(ast);

  // 3. Flatten hierarchy (nested elements → flat + edges for tree/flow)
  const flatAST = flattenHierarchy(dataResolvedAST);

  // 4. Resolve theme (semantic tokens → concrete values)
  const resolvedAST = resolveTheme(flatAST, theme);

  // 5. Extract @overrides from AST (applied after IR emission)
  const overrides = extractOverrides(resolvedAST);

  // 6. Pre-process diagram blocks and slot-less scene blocks through the diagram
  //    pipeline. Results are injected into emitSceneIR at the correct indices.
  //
  //    Two cases route through emitIR:
  //    a) Non-scene blockTypes (flow, stack, etc.) — explicit diagram blocks.
  //    b) Scene blocks with NO slotted children — the parser wraps standalone
  //       elements (node, badge, box, etc.) in an implicit blockType:'scene',
  //       but planScene requires slot assignments to allocate bounds; without
  //       them every element is dropped. Route these through emitIR instead.
  const diagramScenes = new Map<number, IRScene>();
  for (let i = 0; i < resolvedAST.scenes.length; i++) {
    const block = resolvedAST.scenes[i];
    if (block.blockType !== 'scene' || !hasSlottedContent(block)) {
      const singleDoc: ASTDocument = { directives: resolvedAST.directives, scenes: [block] };
      const diagramIR = emitIR(singleDoc, theme);
      if (diagramIR.scenes[0]) {
        diagramScenes.set(i, { ...diagramIR.scenes[0], layout: { type: 'full' } });
      }
    }
  }

  // 7. Unified scene pipeline — handles both scene blocks and injected diagram scenes
  let ir = emitSceneIR(resolvedAST, theme, sceneTheme, diagramScenes);

  // 8. Post-processing: apply @overrides to IR bounds
  if (overrides.size > 0) {
    ir = applyOverridesToIR(ir, overrides);
  }

  return { ir, errors };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the scene block has at least one child with a slot assignment.
 * Scene blocks without slotted children are "implicit scenes" (parser-created
 * wrappers around standalone diagram content) and should be routed through
 * the diagram pipeline (emitIR) rather than the slot-based scene pipeline.
 */
function hasSlottedContent(block: ASTBlock): boolean {
  return block.children.some(
    c => (c.kind === 'element' || c.kind === 'block') && c.slot !== undefined,
  );
}
