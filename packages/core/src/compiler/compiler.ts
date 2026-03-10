/**
 * Depix Compiler
 *
 * Orchestrates the full DSL v2 → DepixIR pipeline:
 *   1. Parse (tokenize + parse → AST)
 *   2. Resolve theme (semantic tokens → concrete values)
 *   3. Emit IR (layout + edge routing + element conversion)
 *
 * When @presentation directive is present, switches to scene mode:
 *   1. Parse → 2. Flatten → 3. Resolve theme → 4. Scene layout + emit
 */

import type { DepixIR } from '../ir/types.js';
import type { DepixTheme } from '../theme/types.js';
import type { SceneTheme } from '../theme/scene-theme.js';
import { defaultSceneTheme } from '../theme/scene-theme.js';
import type { ASTDocument, ParseError } from './ast.js';
import { parse } from './parser.js';
import { resolveData } from './data/resolve-data.js';
import { flattenHierarchy } from './passes/flatten-hierarchy.js';
import { resolveTheme } from './passes/resolve-theme.js';
import { emitIR } from './passes/emit-ir.js';
import { emitSceneIR } from './scene/emit-scene.js';
import { lightTheme } from '../theme/builtin-themes.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Options for the compiler.
 */
export interface CompileOptions {
  /** Theme to use for resolving semantic tokens. Defaults to the light theme. */
  theme?: DepixTheme;
  /** Scene theme for presentation mode. Defaults to defaultSceneTheme. */
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
 * Compile a DSL v2 source string into a DepixIR document.
 *
 * This is the main entry point for the Depix compiler. It runs the full
 * pipeline: parse → theme resolution → layout → edge routing → IR emission.
 *
 * When @presentation directive is found, switches to scene compilation mode.
 *
 * @param dsl     - The DSL v2 source string.
 * @param options - Optional compiler configuration.
 * @returns The compiled IR and any parse errors.
 */
export function compile(dsl: string, options?: CompileOptions): CompileResult {
  const theme = options?.theme ?? lightTheme;

  // 1. Parse DSL → AST
  const { ast, errors } = parse(dsl);

  // 2. Resolve @data directives (inject rows into table/chart blocks)
  const dataResolvedAST = resolveData(ast);

  // 3. Flatten hierarchy (nested elements → flat + edges for tree/flow)
  const flatAST = flattenHierarchy(dataResolvedAST);

  // 4. Resolve theme (semantic tokens → concrete values)
  const resolvedAST = resolveTheme(flatAST, theme);

  // 5. Check for presentation mode
  const isPresentation = resolvedAST.directives.some(d => d.key === 'presentation');

  if (isPresentation) {
    // Scene pipeline: scene layout → scene IR emission
    const sceneTheme = options?.sceneTheme ?? defaultSceneTheme;
    const ir = emitSceneIR(resolvedAST, theme, sceneTheme);
    return { ir, errors };
  }

  // 6. Standard pipeline: diagram layout + edge routing + IR emission
  const ir = emitIR(resolvedAST, theme);

  return { ir, errors };
}
