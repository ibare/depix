import { describe, expect, it } from 'vitest';

import { darkTheme, lightTheme } from '../../src/theme/builtin-themes.js';
import type { DepixTheme } from '../../src/theme/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function isValidHex(value: string): boolean {
  return HEX_RE.test(value);
}

const SEMANTIC_COLOR_KEYS = [
  'primary', 'secondary', 'accent', 'success', 'warning', 'danger', 'info', 'muted',
] as const;

const NAMED_COLOR_KEYS = [
  'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray', 'white', 'black',
] as const;

const SPACING_KEYS = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

const FONT_SIZE_KEYS = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'] as const;

const SHADOW_KEYS = ['sm', 'md', 'lg'] as const;

const RADIUS_KEYS = ['sm', 'md', 'lg', 'full'] as const;

const BORDER_WIDTH_KEYS = ['thin', 'medium', 'thick'] as const;

// ---------------------------------------------------------------------------
// Shared structure tests for any theme
// ---------------------------------------------------------------------------

function describeThemeStructure(themeName: string, theme: DepixTheme): void {
  describe(`${themeName} structure`, () => {
    it('has a name', () => {
      expect(typeof theme.name).toBe('string');
      expect(theme.name.length).toBeGreaterThan(0);
    });

    // --- colors ---

    it('has all semantic color keys', () => {
      for (const key of SEMANTIC_COLOR_KEYS) {
        expect(theme.colors).toHaveProperty(key);
      }
    });

    it.each(SEMANTIC_COLOR_KEYS)('semantic color "%s" is a valid HEX', (key) => {
      expect(isValidHex(theme.colors[key])).toBe(true);
    });

    // --- namedColors ---

    it('has all named color keys', () => {
      for (const key of NAMED_COLOR_KEYS) {
        expect(theme.namedColors).toHaveProperty(key);
      }
    });

    it.each(NAMED_COLOR_KEYS)('named color "%s" is a valid HEX', (key) => {
      expect(isValidHex(theme.namedColors[key])).toBe(true);
    });

    // --- spacing ---

    it('has all spacing keys', () => {
      for (const key of SPACING_KEYS) {
        expect(theme.spacing).toHaveProperty(key);
        expect(typeof theme.spacing[key]).toBe('number');
      }
    });

    it('spacing values are positive and ascending', () => {
      const values = SPACING_KEYS.map((k) => theme.spacing[k]);
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]!);
      }
    });

    // --- fontSize ---

    it('has all fontSize keys', () => {
      for (const key of FONT_SIZE_KEYS) {
        expect(theme.fontSize).toHaveProperty(key);
        expect(typeof theme.fontSize[key]).toBe('number');
      }
    });

    it('fontSize values are positive and ascending', () => {
      const values = FONT_SIZE_KEYS.map((k) => theme.fontSize[k]);
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]!);
      }
    });

    // --- shadow ---

    it('has all shadow keys with correct structure', () => {
      for (const key of SHADOW_KEYS) {
        const shadow = theme.shadow[key];
        expect(shadow).toBeDefined();
        expect(typeof shadow.offsetX).toBe('number');
        expect(typeof shadow.offsetY).toBe('number');
        expect(typeof shadow.blur).toBe('number');
        expect(typeof shadow.color).toBe('string');
      }
    });

    // --- radius ---

    it('has all radius keys', () => {
      for (const key of RADIUS_KEYS) {
        expect(theme.radius).toHaveProperty(key);
        expect(typeof theme.radius[key]).toBe('number');
      }
    });

    it('radius.full is 50 (for perfect circle)', () => {
      expect(theme.radius.full).toBe(50);
    });

    // --- borderWidth ---

    it('has all borderWidth keys', () => {
      for (const key of BORDER_WIDTH_KEYS) {
        expect(theme.borderWidth).toHaveProperty(key);
        expect(typeof theme.borderWidth[key]).toBe('number');
      }
    });

    it('borderWidth values are positive and ascending', () => {
      const values = BORDER_WIDTH_KEYS.map((k) => theme.borderWidth[k]);
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]!);
      }
    });

    // --- node defaults ---

    it('has node defaults with correct types', () => {
      expect(typeof theme.node.fill).toBe('string');
      expect(typeof theme.node.stroke).toBe('string');
      expect(typeof theme.node.strokeWidth).toBe('number');
      expect(typeof theme.node.cornerRadius).toBe('number');
      expect(typeof theme.node.shadow).toBe('string');
      expect(typeof theme.node.padding).toBe('number');
      expect(typeof theme.node.minWidth).toBe('number');
      expect(typeof theme.node.minHeight).toBe('number');
    });

    // --- edge defaults ---

    it('has edge defaults with correct types', () => {
      expect(typeof theme.edge.stroke).toBe('string');
      expect(typeof theme.edge.strokeWidth).toBe('number');
      expect(typeof theme.edge.arrowEnd).toBe('string');
    });

    // --- top-level color properties ---

    it('has background as valid HEX', () => {
      expect(isValidHex(theme.background)).toBe(true);
    });

    it('has foreground as valid HEX', () => {
      expect(isValidHex(theme.foreground)).toBe(true);
    });

    it('has border as valid HEX', () => {
      expect(isValidHex(theme.border)).toBe(true);
    });
  });
}

// ---------------------------------------------------------------------------
// Run shared tests for both themes
// ---------------------------------------------------------------------------

describeThemeStructure('lightTheme', lightTheme);
describeThemeStructure('darkTheme', darkTheme);

// ---------------------------------------------------------------------------
// Theme-specific assertions
// ---------------------------------------------------------------------------

describe('lightTheme specific values', () => {
  it('has name "light"', () => {
    expect(lightTheme.name).toBe('light');
  });

  it('has white background', () => {
    expect(lightTheme.background).toBe('#ffffff');
  });

  it('has dark foreground', () => {
    expect(lightTheme.foreground).toBe('#1f2937');
  });

  it('has primary=#3b82f6', () => {
    expect(lightTheme.colors.primary).toBe('#3b82f6');
  });
});

describe('darkTheme specific values', () => {
  it('has name "dark"', () => {
    expect(darkTheme.name).toBe('dark');
  });

  it('has dark background', () => {
    expect(darkTheme.background).toBe('#1a1a2e');
  });

  it('has light foreground', () => {
    expect(darkTheme.foreground).toBe('#e2e8f0');
  });

  it('has dark border', () => {
    expect(darkTheme.border).toBe('#374151');
  });
});
