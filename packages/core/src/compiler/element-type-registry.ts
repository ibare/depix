/**
 * Element Type Registry — Single source of truth for element type configuration.
 *
 * Replaces 5 scattered switch statements (emit, measure, classify, intrinsicSize, constraint)
 * with a single lookup table. Adding a new element type requires one table entry.
 */

import type { PlanNodeType } from './passes/plan-layout.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MeasureKind = 'text' | 'shape' | 'list' | 'divider' | 'image' | 'row';
export type EmitKind = 'shape' | 'text' | 'list' | 'divider' | 'image' | 'row';
export type ShapeKind = 'rect' | 'circle' | 'pill';

export interface ElementTypeConfig {
  /** Plan-layout classification. */
  classify: PlanNodeType;
  /** Default intrinsic size (0-100 space). Overridden by explicit width/height props. */
  intrinsicSize: { width: number; height: number };
  /** Minimum constraint for leaf elements. */
  constraint: { minW: number; minH: number };
  /** Which measure function to dispatch to. */
  measure: MeasureKind;
  /** Which emit function to dispatch to. */
  emit: EmitKind;
  /** Shape variant for emit:'shape' (default: 'rect'). */
  emitShape?: ShapeKind;
  /** Font size multiplier (default 1.0). Heading uses 1.5. */
  fontScale?: number;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const ELEMENT_TYPE_REGISTRY: Record<string, ElementTypeConfig> = {
  // --- Shapes ---
  node:    { classify: 'element-shape', intrinsicSize: { width: 12, height: 8 }, constraint: { minW: 4, minH: 3 }, measure: 'shape', emit: 'shape', emitShape: 'rect' },
  cell:    { classify: 'element-shape', intrinsicSize: { width: 12, height: 8 }, constraint: { minW: 4, minH: 3 }, measure: 'shape', emit: 'shape', emitShape: 'rect' },
  rect:    { classify: 'element-shape', intrinsicSize: { width: 12, height: 8 }, constraint: { minW: 4, minH: 3 }, measure: 'shape', emit: 'shape', emitShape: 'rect' },
  circle:  { classify: 'element-shape', intrinsicSize: { width: 8, height: 8 },  constraint: { minW: 4, minH: 3 }, measure: 'shape', emit: 'shape', emitShape: 'circle' },
  badge:   { classify: 'element-shape', intrinsicSize: { width: 10, height: 4 }, constraint: { minW: 4, minH: 3 }, measure: 'shape', emit: 'shape', emitShape: 'pill' },
  icon:    { classify: 'element-shape', intrinsicSize: { width: 8, height: 8 },  constraint: { minW: 4, minH: 3 }, measure: 'shape', emit: 'shape', emitShape: 'circle' },

  // --- Text ---
  heading: { classify: 'element-text', intrinsicSize: { width: 20, height: 6 }, constraint: { minW: 2, minH: 1.5 }, measure: 'text', emit: 'text', fontScale: 1.5 },
  text:    { classify: 'element-text', intrinsicSize: { width: 20, height: 4 }, constraint: { minW: 2, minH: 1 },   measure: 'text', emit: 'text' },
  label:   { classify: 'element-text', intrinsicSize: { width: 20, height: 4 }, constraint: { minW: 2, minH: 1 },   measure: 'text', emit: 'text' },
  item:    { classify: 'element-text', intrinsicSize: { width: 20, height: 4 }, constraint: { minW: 2, minH: 1 },   measure: 'text', emit: 'text' },
  stat:    { classify: 'element-text', intrinsicSize: { width: 20, height: 4 }, constraint: { minW: 2, minH: 1 },   measure: 'text', emit: 'text' },
  quote:   { classify: 'element-text', intrinsicSize: { width: 20, height: 4 }, constraint: { minW: 2, minH: 1 },   measure: 'text', emit: 'text' },
  step:    { classify: 'element-text', intrinsicSize: { width: 20, height: 4 }, constraint: { minW: 2, minH: 1 },   measure: 'text', emit: 'text' },

  // --- List ---
  list:    { classify: 'element-list', intrinsicSize: { width: 20, height: 8 }, constraint: { minW: 3, minH: 2 }, measure: 'list', emit: 'list' },
  bullet:  { classify: 'element-list', intrinsicSize: { width: 20, height: 8 }, constraint: { minW: 3, minH: 2 }, measure: 'list', emit: 'list' },

  // --- Other ---
  divider: { classify: 'element-divider', intrinsicSize: { width: 90, height: 1 }, constraint: { minW: 1, minH: 0.5 }, measure: 'divider', emit: 'divider' },
  line:    { classify: 'element-divider', intrinsicSize: { width: 90, height: 1 }, constraint: { minW: 1, minH: 0.5 }, measure: 'divider', emit: 'divider' },
  image:   { classify: 'element-image', intrinsicSize: { width: 20, height: 15 }, constraint: { minW: 4, minH: 3 }, measure: 'image', emit: 'image' },
  row:     { classify: 'element-text', intrinsicSize: { width: 20, height: 4 },  constraint: { minW: 2, minH: 1 },   measure: 'shape', emit: 'row' },
};

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

/** Get element type config. Falls back to `node` config for unknown types. */
export function getElementConfig(elementType: string): ElementTypeConfig {
  return ELEMENT_TYPE_REGISTRY[elementType] ?? ELEMENT_TYPE_REGISTRY.node;
}
