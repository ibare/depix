/**
 * DSL fixture loader for tests.
 *
 * Reads `.depix` files from the `dsl/` directory. These fixtures are
 * shared across parser, compiler, and integration tests.
 *
 * @module @depix/core/__tests__/fixtures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Read a DSL fixture file by name.
 *
 * @param name - The filename (e.g. `'flow-basic.depix'`).
 * @returns The file contents as a UTF-8 string.
 */
export function readDSLFixture(name: string): string {
  return readFileSync(join(__dirname, 'dsl', name), 'utf-8');
}

/**
 * Available DSL fixture names.
 *
 * Useful for parameterized tests that iterate over all fixtures.
 */
export const DSL_FIXTURES = [
  'flow-basic.depix',
  'flow-branching.depix',
  'stack-row.depix',
  'grid-basic.depix',
  'tree-basic.depix',
  'photosynthesis.depix',
  'multi-scene.depix',
] as const;

/**
 * Error case fixture names.
 *
 * These fixtures contain intentional errors for testing error handling.
 */
export const DSL_ERROR_FIXTURES = [
  'error-missing-ref.depix',
  'error-unclosed-brace.depix',
] as const;
