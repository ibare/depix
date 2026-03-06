/**
 * Theme System Type Definitions
 *
 * Defines the complete theme type system for Depix DSL v2.
 * Themes map semantic tokens (e.g. "primary", "md") to concrete values
 * (HEX colors, pixel numbers) so the IR can be fully resolved.
 *
 * @module @depix/core/theme
 */

import type { IRArrowType, IRShadow } from '../ir/types.js';

// ---------------------------------------------------------------------------
// Semantic token types
// ---------------------------------------------------------------------------

/** Semantic color names used in DSL v2. */
export type SemanticColor =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'muted';

/** Named colors (CSS-like, mapped to HEX). */
export type NamedColor =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'gray'
  | 'white'
  | 'black';

/** Semantic spacing tokens. */
export type SemanticSpacing = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** Semantic font size tokens. */
export type SemanticFontSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | '8xl' | '9xl' | '10xl';

/** Semantic shadow tokens. */
export type SemanticShadow = 'none' | 'sm' | 'md' | 'lg';

/** Semantic radius tokens. */
export type SemanticRadius = 'none' | 'sm' | 'md' | 'lg' | 'full';

/** Semantic border width tokens. */
export type SemanticBorderWidth = 'thin' | 'medium' | 'thick';

// ---------------------------------------------------------------------------
// Color palette (generated from a single base color)
// ---------------------------------------------------------------------------

/** A derived color palette generated from a single base HEX color. */
export interface ColorPalette {
  /** Light background color. */
  bg: string;
  /** Foreground/text color (readable on bg). */
  fg: string;
  /** Border color (between bg and accent). */
  border: string;
  /** The original base color. */
  accent: string;
}

// ---------------------------------------------------------------------------
// Theme node/edge defaults
// ---------------------------------------------------------------------------

/** Default styles for auto-generated nodes. */
export interface ThemeNodeDefaults {
  /** Default fill color (HEX). */
  fill: string;
  /** Default stroke color (HEX). */
  stroke: string;
  /** Default stroke width. */
  strokeWidth: number;
  /** Default corner radius. */
  cornerRadius: number;
  /** Default shadow token. */
  shadow: SemanticShadow;
  /** Default padding. */
  padding: number;
  /** Minimum width. */
  minWidth: number;
  /** Minimum height. */
  minHeight: number;
}

/** Default styles for auto-generated edges. */
export interface ThemeEdgeDefaults {
  /** Default stroke color (HEX). */
  stroke: string;
  /** Default stroke width. */
  strokeWidth: number;
  /** Default arrow type at end of edge. */
  arrowEnd: IRArrowType;
}

// ---------------------------------------------------------------------------
// Complete theme definition
// ---------------------------------------------------------------------------

/**
 * Complete theme definition.
 *
 * Maps all semantic tokens to concrete values. Used by the compiler to
 * resolve DSL v2 semantic references into fully concrete IR values.
 */
export interface DepixTheme {
  /** Theme name identifier. */
  name: string;

  /** Semantic color mapping (semantic name -> HEX). */
  colors: Record<SemanticColor, string>;

  /** Named color mapping (CSS-like name -> HEX). */
  namedColors: Record<NamedColor, string>;

  /** Spacing token mapping (token -> relative value in 0-100 space). */
  spacing: Record<SemanticSpacing, number>;

  /** Font size token mapping (token -> canvas-based multiplier). */
  fontSize: Record<SemanticFontSize, number>;

  /** Shadow token mapping (token -> resolved IRShadow). `none` is excluded; it resolves to undefined. */
  shadow: Record<Exclude<SemanticShadow, 'none'>, IRShadow>;

  /** Radius token mapping (token -> number). `none` is excluded; it resolves to 0. */
  radius: Record<Exclude<SemanticRadius, 'none'>, number>;

  /** Border width token mapping (token -> number). */
  borderWidth: Record<SemanticBorderWidth, number>;

  /** Default styles for auto-generated nodes. */
  node: ThemeNodeDefaults;

  /** Default styles for auto-generated edges. */
  edge: ThemeEdgeDefaults;

  /** Default document background color (HEX). */
  background: string;

  /** Default text / foreground color (HEX). */
  foreground: string;

  /** Default border color (HEX). */
  border: string;
}
