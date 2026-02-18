/**
 * Handle type definitions for the editor selection handles.
 *
 * These types describe how handles behave for different IR element types.
 * No rendering dependency -- pure data definitions.
 *
 * @module @depix/editor/handles/types
 */

// ---------------------------------------------------------------------------
// Handle type
// ---------------------------------------------------------------------------

/**
 * Which kind of handle interaction an element supports.
 *
 * - `bounding-box` -- standard resize/rotate handles around the element
 * - `endpoint`     -- line endpoints (from/to)
 * - `connector`    -- edge connection points
 * - `none`         -- no handles (e.g. nothing selected)
 */
export type HandleType = 'bounding-box' | 'endpoint' | 'connector' | 'none';

// ---------------------------------------------------------------------------
// Anchor positions
// ---------------------------------------------------------------------------

/**
 * Corner/edge anchor positions for bounding-box handles.
 *
 * Arranged in reading order (top-left to bottom-right).
 */
export type AnchorName =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

// ---------------------------------------------------------------------------
// Handle definition
// ---------------------------------------------------------------------------

/**
 * Complete description of how handles behave for an element.
 *
 * This is a pure data structure with no rendering logic. The React
 * integration layer reads this definition to configure Konva.Transformer.
 */
export interface HandleDefinition {
  /** Primary handle type. */
  handleType: HandleType;
  /** Whether to keep aspect ratio during resize. */
  keepRatio: boolean;
  /** Whether rotation is enabled. */
  rotateEnabled: boolean;
  /** Which anchors are enabled (for bounding-box). */
  enabledAnchors: AnchorName[];
  /** Minimum size constraint. */
  minSize?: { width: number; height: number };
}

// ---------------------------------------------------------------------------
// Anchor constants
// ---------------------------------------------------------------------------

/** All 8 standard anchors (corners + edge midpoints). */
export const ALL_ANCHORS: AnchorName[] = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

/** 4 corner anchors only (used for keep-ratio shapes). */
export const CORNER_ANCHORS: AnchorName[] = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
];
