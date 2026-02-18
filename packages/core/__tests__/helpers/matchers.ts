/**
 * Custom vitest matchers for IR testing.
 *
 * Registered via `expect.extend()` in the setup file.
 *
 * @module @depix/core/__tests__/helpers/matchers
 */

import { expect } from 'vitest';
import type { IRBounds, IRElement } from '../../src/ir/types.js';

// ---------------------------------------------------------------------------
// Type augmentation
// ---------------------------------------------------------------------------

interface CustomMatchers<R = unknown> {
  /**
   * Check bounds are close to expected (ignoring floating-point noise).
   *
   * @param expected  - The expected bounds.
   * @param precision - Number of decimal digits to compare (default 1).
   */
  toHaveBoundsCloseTo(expected: IRBounds, precision?: number): R;

  /**
   * Check IR element tree structure matches (ignoring IDs, approximate bounds).
   *
   * Performs a recursive partial match:
   * - `id` fields are ignored
   * - `bounds` are compared approximately (1 decimal)
   * - All other specified fields must match exactly
   * - Unspecified fields in `expected` are ignored
   *
   * @param expected - Partial IR element to match against.
   */
  toMatchIRStructure(expected: Partial<IRElement>): R;
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Assertion<T = unknown> extends CustomMatchers<T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

// ---------------------------------------------------------------------------
// Implementation helpers
// ---------------------------------------------------------------------------

function boundsClose(
  actual: IRBounds,
  expected: IRBounds,
  precision: number,
): { pass: boolean; message: string } {
  const factor = Math.pow(10, precision);
  const round = (n: number) => Math.round(n * factor) / factor;

  const diffs: string[] = [];
  for (const key of ['x', 'y', 'w', 'h'] as const) {
    const a = round(actual[key]);
    const e = round(expected[key]);
    if (a !== e) {
      diffs.push(`${key}: expected ${e}, got ${a}`);
    }
  }

  if (diffs.length === 0) {
    return {
      pass: true,
      message: `expected bounds NOT to be close to ${JSON.stringify(expected)}`,
    };
  }

  return {
    pass: false,
    message: `bounds mismatch (precision=${precision}): ${diffs.join(', ')}`,
  };
}

function structureMatches(
  actual: unknown,
  expected: unknown,
  path: string,
): { pass: boolean; messages: string[] } {
  const messages: string[] = [];

  // If expected is undefined/null, accept anything
  if (expected === undefined || expected === null) {
    return { pass: true, messages };
  }

  // Primitives
  if (typeof expected !== 'object') {
    if (actual !== expected) {
      messages.push(`${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
    return { pass: messages.length === 0, messages };
  }

  // Arrays
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      messages.push(`${path}: expected array, got ${typeof actual}`);
      return { pass: false, messages };
    }
    if (actual.length !== expected.length) {
      messages.push(`${path}: expected array length ${expected.length}, got ${actual.length}`);
      return { pass: false, messages };
    }
    for (let i = 0; i < expected.length; i++) {
      const result = structureMatches(actual[i], expected[i], `${path}[${i}]`);
      messages.push(...result.messages);
    }
    return { pass: messages.length === 0, messages };
  }

  // Objects
  if (typeof actual !== 'object' || actual === null) {
    messages.push(`${path}: expected object, got ${actual === null ? 'null' : typeof actual}`);
    return { pass: false, messages };
  }

  const expectedObj = expected as Record<string, unknown>;
  const actualObj = actual as Record<string, unknown>;

  for (const key of Object.keys(expectedObj)) {
    // Skip 'id' fields -- structure comparison ignores IDs
    if (key === 'id') continue;

    // Special handling for bounds -- approximate comparison
    if (key === 'bounds' && expectedObj[key] && typeof expectedObj[key] === 'object') {
      const { pass: bPass, message: bMsg } = boundsClose(
        actualObj[key] as IRBounds,
        expectedObj[key] as IRBounds,
        1,
      );
      if (!bPass) {
        messages.push(`${path}.bounds: ${bMsg}`);
      }
      continue;
    }

    // Recursively compare children for containers
    if (key === 'children' && Array.isArray(expectedObj[key])) {
      const result = structureMatches(
        actualObj[key],
        expectedObj[key],
        `${path}.children`,
      );
      messages.push(...result.messages);
      continue;
    }

    // General recursive comparison
    const result = structureMatches(actualObj[key], expectedObj[key], `${path}.${key}`);
    messages.push(...result.messages);
  }

  return { pass: messages.length === 0, messages };
}

// ---------------------------------------------------------------------------
// Matcher definitions
// ---------------------------------------------------------------------------

export const irMatchers = {
  toHaveBoundsCloseTo(
    received: { bounds: IRBounds },
    expected: IRBounds,
    precision: number = 1,
  ) {
    const actual = received.bounds ?? received;
    const result = boundsClose(actual as IRBounds, expected, precision);
    return {
      pass: result.pass,
      message: () => result.message,
    };
  },

  toMatchIRStructure(received: unknown, expected: Partial<IRElement>) {
    const result = structureMatches(received, expected, 'root');
    return {
      pass: result.pass,
      message: () =>
        result.pass
          ? 'expected IR structure NOT to match'
          : `IR structure mismatch:\n${result.messages.join('\n')}`,
    };
  },
};

/**
 * Register all custom matchers with vitest's expect.
 *
 * Called from the setup file.
 */
export function registerMatchers(): void {
  expect.extend(irMatchers);
}
