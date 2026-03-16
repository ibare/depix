/**
 * Depix Compiler
 *
 * Orchestrates the full DSL → DepixIR pipeline:
 *   1. Parse (tokenize + parse → AST)
 *   2. Resolve data, flatten hierarchy, resolve theme
 *   3. Normalize scenes (all blocks → slotted scene AST)
 *   4. Emit IR via unified scene pipeline (planScene → emitScene)
 *
 * @presentation directive is a no-op and no longer gates compilation mode.
 */

import type { DepixIR } from '../ir/types.js';
import type { DepixTheme } from '../theme/types.js';
import type { SceneTheme } from '../theme/scene-theme.js';
import { defaultSceneTheme } from '../theme/scene-theme.js';
import type { ASTBlock, ASTDocument, ASTNode, ParseError } from './ast.js';
import { parse } from './parser.js';
import { resolveData } from './data/resolve-data.js';
import { flattenHierarchy } from './passes/flatten-hierarchy.js';
import { resolveTheme } from './passes/resolve-theme.js';
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
 * pipeline: parse → resolve → normalizeScenes → emitSceneIR.
 *
 * All DSL compiles through the unified scene pipeline. Non-scene blocks
 * (flow, stack, etc.) are normalized to `scene { layout: full; body: <block> }`
 * at the AST level before emission.
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

  // 6. Normalize scenes — all blocks become slotted scene blocks
  const normalizedAST = normalizeScenes(resolvedAST);

  // 7. Unified scene pipeline — all blocks go through planScene → emitScene
  let ir = emitSceneIR(normalizedAST, theme, sceneTheme);

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
 * Normalize all top-level blocks into slotted scene blocks.
 *
 * Three cases:
 * - Already slotted scene → no change
 * - Non-scene block (flow, stack, etc.) → wrap in scene { layout: full; body: <block> }
 * - Scene without slots → assign children to body slot
 */
function normalizeScenes(ast: ASTDocument): ASTDocument {
  return { ...ast, scenes: ast.scenes.map(normalizeScene) };
}

function normalizeScene(block: ASTBlock): ASTBlock {
  // Case A: already a properly slotted scene → pass through
  if (block.blockType === 'scene' && hasSlottedContent(block)) {
    return block;
  }

  // Case B: non-scene block (flow, stack, grid, tree, group, layers, canvas, table, chart)
  //         → wrap in scene { layout: full; body: <block> }
  if (block.blockType !== 'scene') {
    const wrappedChild: ASTBlock = { ...block, slot: 'body' };
    return {
      kind: 'block',
      blockType: 'scene',
      props: { layout: 'full' },
      children: [wrappedChild],
      label: block.label,
      id: block.id,
      style: {},
      loc: block.loc,
    };
  }

  // Case C: scene block without slot assignments
  const nonEdge = block.children.filter((c) => c.kind !== 'edge');
  const edges = block.children.filter((c) => c.kind === 'edge');

  if (nonEdge.length <= 1 && nonEdge.length > 0) {
    // Single child → assign directly to body slot
    const child = { ...nonEdge[0], slot: 'body' } as ASTNode;
    return {
      ...block,
      props: { ...block.props, layout: block.props.layout ?? 'full' },
      children: [child, ...edges],
    };
  }

  // Multiple children → wrap in group block, assign group to body
  const groupBlock: ASTBlock = {
    kind: 'block',
    blockType: 'group',
    props: {},
    children: [...nonEdge, ...edges],
    style: {},
    slot: 'body',
    loc: block.loc,
  };
  return {
    ...block,
    props: { ...block.props, layout: block.props.layout ?? 'full' },
    children: [groupBlock],
  };
}

function hasSlottedContent(block: ASTBlock): boolean {
  return block.children.some(
    c => (c.kind === 'element' || c.kind === 'block') && c.slot !== undefined,
  );
}
