/**
 * Theme Resolver Functions
 *
 * Resolves semantic tokens (colors, spacing, font sizes, shadows, radii,
 * border widths) to concrete values using a given theme.
 *
 * Resolution order for colors: semantic -> named -> HEX passthrough -> as-is.
 * Resolution order for numeric tokens: token key -> number passthrough.
 *
 * @module @depix/core/theme
 */

import type { IRShadow } from '../ir/types.js';
import type {
  ColorPalette,
  DepixTheme,
  NamedColor,
  SemanticBorderWidth,
  SemanticColor,
  SemanticFontSize,
  SemanticRadius,
  SemanticShadow,
  SemanticSpacing,
} from './types.js';

// ---------------------------------------------------------------------------
// Semantic color set (for fast lookup)
// ---------------------------------------------------------------------------

const SEMANTIC_COLORS: ReadonlySet<string> = new Set<SemanticColor>([
  'primary',
  'secondary',
  'accent',
  'success',
  'warning',
  'danger',
  'info',
  'muted',
]);

const NAMED_COLORS: ReadonlySet<string> = new Set<NamedColor>([
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'gray',
  'white',
  'black',
]);

const SPACING_TOKENS: ReadonlySet<string> = new Set<SemanticSpacing>([
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
]);

const FONT_SIZE_TOKENS: ReadonlySet<string> = new Set<SemanticFontSize>([
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
  '6xl',
  '7xl',
  '8xl',
  '9xl',
  '10xl',
]);

const SHADOW_TOKENS: ReadonlySet<string> = new Set<SemanticShadow>([
  'none',
  'sm',
  'md',
  'lg',
]);

const RADIUS_TOKENS: ReadonlySet<string> = new Set<SemanticRadius>([
  'none',
  'sm',
  'md',
  'lg',
  'full',
]);

const BORDER_WIDTH_TOKENS: ReadonlySet<string> = new Set<SemanticBorderWidth>([
  'thin',
  'medium',
  'thick',
]);

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/**
 * Check if a string is a semantic color name.
 */
export function isSemanticColor(value: string): value is SemanticColor {
  return SEMANTIC_COLORS.has(value);
}

/**
 * Check if a string is a named color.
 */
export function isNamedColor(value: string): value is NamedColor {
  return NAMED_COLORS.has(value);
}

// ---------------------------------------------------------------------------
// Resolvers
// ---------------------------------------------------------------------------

/**
 * Resolve any color value to a concrete HEX string (or passthrough).
 *
 * Resolution order:
 * 1. Semantic color name (e.g. "primary") -> theme.colors[name]
 * 2. Named color (e.g. "red") -> theme.namedColors[name]
 * 3. HEX passthrough (starts with "#") -> as-is
 * 4. Fallback -> return value as-is (e.g. "gradient(...)", "rgba(...)")
 */
export function resolveColor(value: string, theme: DepixTheme): string {
  if (isSemanticColor(value)) {
    return theme.colors[value];
  }
  if (isNamedColor(value)) {
    return theme.namedColors[value];
  }
  // HEX or any other value: pass through as-is
  return value;
}

/**
 * Resolve a spacing token or number to a concrete number.
 *
 * - String matching a spacing token -> theme.spacing[token]
 * - Number -> passthrough
 */
export function resolveSpacing(value: string | number, theme: DepixTheme): number {
  if (typeof value === 'number') {
    return value;
  }
  if (SPACING_TOKENS.has(value)) {
    return theme.spacing[value as SemanticSpacing];
  }
  return Number(value) || 0;
}

/**
 * Resolve a font-size token or number to a concrete number.
 *
 * - String matching a font-size token -> theme.fontSize[token]
 * - Number -> passthrough
 */
export function resolveFontSize(value: string | number, theme: DepixTheme): number {
  if (typeof value === 'number') {
    return value;
  }
  if (FONT_SIZE_TOKENS.has(value)) {
    return theme.fontSize[value as SemanticFontSize];
  }
  return Number(value) || 0;
}

/**
 * Resolve a shadow token to an IRShadow or undefined.
 *
 * - "none" -> undefined
 * - Valid token ("sm", "md", "lg") -> theme.shadow[token]
 * - Unknown -> undefined
 */
export function resolveShadow(value: string, theme: DepixTheme): IRShadow | undefined {
  if (value === 'none') {
    return undefined;
  }
  if (SHADOW_TOKENS.has(value) && value !== 'none') {
    return theme.shadow[value as Exclude<SemanticShadow, 'none'>];
  }
  return undefined;
}

/**
 * Resolve a radius token or number to a concrete number.
 *
 * - "none" -> 0
 * - "full" -> theme.radius.full (typically 50)
 * - Valid token ("sm", "md", "lg") -> theme.radius[token]
 * - Number -> passthrough
 */
export function resolveRadius(value: string | number, theme: DepixTheme): number {
  if (typeof value === 'number') {
    return value;
  }
  if (value === 'none') {
    return 0;
  }
  if (RADIUS_TOKENS.has(value) && value !== 'none') {
    return theme.radius[value as Exclude<SemanticRadius, 'none'>];
  }
  return Number(value) || 0;
}

/**
 * Resolve a border-width token or number to a concrete number.
 *
 * - Valid token ("thin", "medium", "thick") -> theme.borderWidth[token]
 * - Number -> passthrough
 */
export function resolveBorderWidth(value: string | number, theme: DepixTheme): number {
  if (typeof value === 'number') {
    return value;
  }
  if (BORDER_WIDTH_TOKENS.has(value)) {
    return theme.borderWidth[value as SemanticBorderWidth];
  }
  return Number(value) || 0;
}

// ---------------------------------------------------------------------------
// Color palette generation
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.round(Math.max(0, Math.min(255, v)));
  return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('');
}

function mix(c1: RGB, c2: RGB, weight: number): RGB {
  return [
    c1[0] + (c2[0] - c1[0]) * weight,
    c1[1] + (c2[1] - c1[1]) * weight,
    c1[2] + (c2[2] - c1[2]) * weight,
  ];
}

function luminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Generate a color palette from a single HEX base color.
 *
 * Produces a light background, readable foreground, medium border,
 * and keeps the original color as accent.
 */
export function generateColorPalette(hex: string): ColorPalette {
  const rgb = hexToRgb(hex);
  const white: RGB = [255, 255, 255];
  const black: RGB = [30, 30, 30];

  const bg = rgbToHex(...mix(rgb, white, 0.85));
  const border = rgbToHex(...mix(rgb, white, 0.55));
  const lum = luminance(...rgb);
  const fg = lum > 0.6
    ? rgbToHex(...mix(rgb, black, 0.6))
    : hex;

  return { bg, fg, border, accent: hex };
}
