/**
 * Depix Compiler
 *
 * Orchestrates the full DSL v2 → DepixIR pipeline:
 *   1. Parse (tokenize + parse → AST)
 *   2. Resolve theme (semantic tokens → concrete values)
 *   3. Emit IR (layout + edge routing + element conversion)
 */

import type { DepixIR } from '../ir/types.js';
import type { DepixTheme } from '../theme/types.js';
import type { ASTDocument, ParseError } from './ast.js';
import { parse } from './parser.js';
import { flattenHierarchy } from './passes/flatten-hierarchy.js';
import { resolveTheme } from './passes/resolve-theme.js';
import { emitIR } from './passes/emit-ir.js';
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
 * @param dsl     - The DSL v2 source string.
 * @param options - Optional compiler configuration.
 * @returns The compiled IR and any parse errors.
 */
export function compile(dsl: string, options?: CompileOptions): CompileResult {
  const theme = options?.theme ?? lightTheme;

  // 1. Parse DSL → AST
  const { ast, errors } = parse(dsl);

  // 2. Flatten hierarchy (nested elements → flat + edges for tree/flow)
  const flatAST = flattenHierarchy(ast);

  // 3. Resolve theme (semantic tokens → concrete values)
  const resolvedAST = resolveTheme(flatAST, theme);

  // 4. Emit IR (layout + edge routing + element conversion)
  const ir = emitIR(resolvedAST, theme);

  return { ir, errors };
}
