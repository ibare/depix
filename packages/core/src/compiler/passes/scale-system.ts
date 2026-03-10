/**
 * Scale System — Dynamic size/spacing/font calculation
 *
 * Computes a unified baseUnit from canvas area and element count,
 * then derives gap, fontSize, and padding values dynamically.
 *
 * Design principles:
 * - Existing layout function signatures unchanged
 * - Public compile() API unchanged
 * - IR output format unchanged
 * - DSL explicit values (gap, font-size) always take priority
 */

import type { IRBounds } from '../../ir/types.js';
import type { LayoutPlanNode, DiagramLayoutPlan } from './plan-layout.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GapType = 'innerPadding' | 'childGap' | 'siblingGap' | 'connectorGap' | 'sectionGap';
export type TextRole = 'innerLabel' | 'standaloneText' | 'listItem' | 'edgeLabel';

export interface ScaleContext {
  baseUnit: number;
  elementCount: number;
  canvasArea: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DENSITY_FACTOR = 0.55;

const GAP_RATIO: Record<GapType, number> = {
  innerPadding: 0.06,
  childGap: 0.03,
  siblingGap: 0.10,
  connectorGap: 0.15,
  sectionGap: 0.12,
};

const GAP_CLAMP: Record<GapType, { min: number; max: number }> = {
  innerPadding: { min: 1.0, max: 5.0 },
  childGap: { min: 0.5, max: 3.0 },
  siblingGap: { min: 1.5, max: 6.0 },
  connectorGap: { min: 2.5, max: 8.0 },
  sectionGap: { min: 2.0, max: 7.0 },
};

const TEXT_ROLE_RATIO: Record<TextRole, number> = {
  innerLabel: 0.30,
  standaloneText: 0.25,
  listItem: 0.20,
  edgeLabel: 0.60,
};

const FONT_SIZE_MIN = 0.6;

const FONT_SIZE_MAX_BY_ROLE: Record<TextRole, number> = {
  innerLabel: 4.0,       // ~22px at 1000×560 viewport
  standaloneText: 3.5,   // ~20px
  listItem: 2.5,         // ~14px
  edgeLabel: 2.0,        // ~11px
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a ScaleContext from a scene layout plan and canvas bounds.
 */
export function createScaleContext(
  plan: DiagramLayoutPlan,
  canvasBounds: IRBounds,
): ScaleContext {
  const canvasArea = canvasBounds.w * canvasBounds.h;
  const elementCount = countElements(plan);
  const baseUnit = computeBaseUnit(canvasArea, elementCount);
  return { baseUnit, elementCount, canvasArea };
}

/**
 * Compute the base unit from canvas area and element count.
 *
 * baseUnit = sqrt(canvasArea / elementCount) * densityFactor
 */
export function computeBaseUnit(
  canvasArea: number,
  elementCount: number,
  densityFactor: number = DENSITY_FACTOR,
): number {
  const count = Math.max(elementCount, 1);
  return Math.sqrt(canvasArea / count) * densityFactor;
}

/**
 * Compute a gap value for a given type based on baseUnit.
 *
 * gap = clamp(baseUnit * GAP_RATIO[type], min, max)
 */
export function computeGap(baseUnit: number, gapType: GapType): number {
  const ratio = GAP_RATIO[gapType];
  const { min, max } = GAP_CLAMP[gapType];
  return clamp(baseUnit * ratio, min, max);
}

/**
 * Compute font size based on container short side and text role.
 *
 * fontSize = clamp(containerShortSide * TEXT_ROLE_RATIO[role], min, max)
 */
export function computeFontSize(
  containerShortSide: number,
  textRole: TextRole,
): number {
  const ratio = TEXT_ROLE_RATIO[textRole];
  const max = FONT_SIZE_MAX_BY_ROLE[textRole];
  return clamp(containerShortSide * ratio, FONT_SIZE_MIN, max);
}

/**
 * Compute padding — alias for computeGap(baseUnit, 'innerPadding').
 */
export function computePadding(baseUnit: number): number {
  return computeGap(baseUnit, 'innerPadding');
}

/**
 * Count leaf elements in a plan (non-block nodes without children).
 * Returns at least 1 to avoid division by zero.
 */
export function countElements(plan: DiagramLayoutPlan): number {
  let count = 0;
  for (const child of plan.children) {
    count += countNodeLeaves(child);
  }
  return Math.max(count, 1);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function countNodeLeaves(node: LayoutPlanNode): number {
  if (node.children.length === 0) {
    // List items are visually distinct elements that contribute to density
    if (node.astNode.kind === 'element' && node.astNode.elementType === 'list') {
      return Math.max(node.astNode.items?.length ?? 1, 1);
    }
    return 1;
  }
  let count = 0;
  for (const child of node.children) {
    count += countNodeLeaves(child);
  }
  return count;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
