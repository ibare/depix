import { describe, expect, it } from 'vitest';

import { lightTheme } from '../../src/theme/builtin-themes.js';
import {
  isNamedColor,
  isSemanticColor,
  resolveBorderWidth,
  resolveColor,
  resolveFontSize,
  resolveRadius,
  resolveShadow,
  resolveSpacing,
} from '../../src/theme/resolver.js';

// ---------------------------------------------------------------------------
// resolveColor
// ---------------------------------------------------------------------------

describe('resolveColor', () => {
  it.each([
    ['primary', '#3b82f6'],
    ['secondary', '#6b7280'],
    ['accent', '#8b5cf6'],
    ['success', '#10b981'],
    ['warning', '#f59e0b'],
    ['danger', '#ef4444'],
    ['info', '#06b6d4'],
    ['muted', '#9ca3af'],
  ])('resolves semantic "%s" to "%s"', (input, expected) => {
    expect(resolveColor(input, lightTheme)).toBe(expected);
  });

  it.each([
    ['red', '#ef4444'],
    ['orange', '#f97316'],
    ['yellow', '#eab308'],
    ['green', '#22c55e'],
    ['blue', '#3b82f6'],
    ['purple', '#a855f7'],
    ['gray', '#6b7280'],
    ['white', '#ffffff'],
    ['black', '#1f2937'],
  ])('resolves named "%s" to "%s"', (input, expected) => {
    expect(resolveColor(input, lightTheme)).toBe(expected);
  });

  it('passes through HEX colors', () => {
    expect(resolveColor('#ff0000', lightTheme)).toBe('#ff0000');
  });

  it('passes through short HEX colors', () => {
    expect(resolveColor('#f00', lightTheme)).toBe('#f00');
  });

  it('passes through unknown values as-is', () => {
    expect(resolveColor('gradient(...)', lightTheme)).toBe('gradient(...)');
  });

  it('passes through rgba values as-is', () => {
    expect(resolveColor('rgba(255,0,0,0.5)', lightTheme)).toBe('rgba(255,0,0,0.5)');
  });
});

// ---------------------------------------------------------------------------
// resolveSpacing
// ---------------------------------------------------------------------------

describe('resolveSpacing', () => {
  it.each([
    ['xs', 1],
    ['sm', 2],
    ['md', 3],
    ['lg', 5],
    ['xl', 8],
  ] as const)('resolves "%s" to %d', (input, expected) => {
    expect(resolveSpacing(input, lightTheme)).toBe(expected);
  });

  it('passes through numbers', () => {
    expect(resolveSpacing(7, lightTheme)).toBe(7);
  });

  it('passes through zero', () => {
    expect(resolveSpacing(0, lightTheme)).toBe(0);
  });

  it('returns 0 for unknown string tokens', () => {
    expect(resolveSpacing('unknown', lightTheme)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// resolveFontSize
// ---------------------------------------------------------------------------

describe('resolveFontSize', () => {
  it.each([
    ['xs', 0.6],
    ['sm', 0.8],
    ['md', 1.0],
    ['lg', 1.4],
    ['xl', 1.8],
    ['2xl', 2.4],
    ['3xl', 3.2],
  ] as const)('resolves "%s" to %d', (input, expected) => {
    expect(resolveFontSize(input, lightTheme)).toBe(expected);
  });

  it('passes through numbers', () => {
    expect(resolveFontSize(2.5, lightTheme)).toBe(2.5);
  });

  it('returns 0 for unknown string tokens', () => {
    expect(resolveFontSize('unknown', lightTheme)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// resolveShadow
// ---------------------------------------------------------------------------

describe('resolveShadow', () => {
  it('resolves "none" to undefined', () => {
    expect(resolveShadow('none', lightTheme)).toBeUndefined();
  });

  it('resolves "sm" to the sm shadow definition', () => {
    expect(resolveShadow('sm', lightTheme)).toEqual({
      offsetX: 0,
      offsetY: 1,
      blur: 3,
      color: 'rgba(0,0,0,0.1)',
    });
  });

  it('resolves "md" to the md shadow definition', () => {
    expect(resolveShadow('md', lightTheme)).toEqual({
      offsetX: 0,
      offsetY: 2,
      blur: 6,
      color: 'rgba(0,0,0,0.12)',
    });
  });

  it('resolves "lg" to the lg shadow definition', () => {
    expect(resolveShadow('lg', lightTheme)).toEqual({
      offsetX: 0,
      offsetY: 4,
      blur: 12,
      color: 'rgba(0,0,0,0.15)',
    });
  });

  it('returns undefined for unknown values', () => {
    expect(resolveShadow('unknown', lightTheme)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveRadius
// ---------------------------------------------------------------------------

describe('resolveRadius', () => {
  it('resolves "none" to 0', () => {
    expect(resolveRadius('none', lightTheme)).toBe(0);
  });

  it('resolves "sm" to 0.5', () => {
    expect(resolveRadius('sm', lightTheme)).toBe(0.5);
  });

  it('resolves "md" to 1', () => {
    expect(resolveRadius('md', lightTheme)).toBe(1);
  });

  it('resolves "lg" to 2', () => {
    expect(resolveRadius('lg', lightTheme)).toBe(2);
  });

  it('resolves "full" to 50', () => {
    expect(resolveRadius('full', lightTheme)).toBe(50);
  });

  it('passes through numbers', () => {
    expect(resolveRadius(3.5, lightTheme)).toBe(3.5);
  });

  it('returns 0 for unknown string tokens', () => {
    expect(resolveRadius('unknown', lightTheme)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// resolveBorderWidth
// ---------------------------------------------------------------------------

describe('resolveBorderWidth', () => {
  it.each([
    ['thin', 0.3],
    ['medium', 0.6],
    ['thick', 1.0],
  ] as const)('resolves "%s" to %d', (input, expected) => {
    expect(resolveBorderWidth(input, lightTheme)).toBe(expected);
  });

  it('passes through numbers', () => {
    expect(resolveBorderWidth(2, lightTheme)).toBe(2);
  });

  it('returns 0 for unknown string tokens', () => {
    expect(resolveBorderWidth('unknown', lightTheme)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

describe('isSemanticColor', () => {
  it.each([
    'primary', 'secondary', 'accent', 'success', 'warning', 'danger', 'info', 'muted',
  ])('returns true for "%s"', (value) => {
    expect(isSemanticColor(value)).toBe(true);
  });

  it.each(['red', 'blue', '#ff0000', 'unknown'])('returns false for "%s"', (value) => {
    expect(isSemanticColor(value)).toBe(false);
  });
});

describe('isNamedColor', () => {
  it.each([
    'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray', 'white', 'black',
  ])('returns true for "%s"', (value) => {
    expect(isNamedColor(value)).toBe(true);
  });

  it.each(['primary', '#ff0000', 'unknown'])('returns false for "%s"', (value) => {
    expect(isNamedColor(value)).toBe(false);
  });
});
