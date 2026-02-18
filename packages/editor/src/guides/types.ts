import type { IRBounds } from '@depix/core';

/** Identifies which part of an element generated a snap point. */
export type SnapPointType = 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom';

/** A snap point extracted from an element's bounds. */
export interface SnapPoint {
  /** The coordinate value (X for vertical snap points, Y for horizontal). */
  value: number;
  /** Which edge/center generated this point. */
  type: SnapPointType;
  /** The element that owns this snap point. */
  elementId: string;
}

/** A visual guide line to render. */
export interface GuideLine {
  /** Whether this is a vertical line (snaps X axis) or horizontal (snaps Y). */
  isVertical: boolean;
  /** Position of the line (X for vertical, Y for horizontal). */
  position: number;
  /** Start of the line extent. */
  start: number;
  /** End of the line extent. */
  end: number;
}

/** Result of a snap calculation. */
export interface SnapResult {
  /** Snapped X offset (applied to the dragging element's X), or undefined if no X snap. */
  snappedX?: number;
  /** Snapped Y offset, or undefined if no Y snap. */
  snappedY?: number;
  /** The delta to apply to achieve the snap (in relative coords). */
  deltaX: number;
  /** The delta to apply to achieve the snap (in relative coords). */
  deltaY: number;
  /** Guide lines to render. */
  guides: GuideLine[];
}

/** Configuration for the snap guide system. */
export interface SnapGuideConfig {
  /** Whether snapping is enabled. */
  enabled: boolean;
  /** Snap threshold in relative coordinates (default: 1.0 ~ 1% of canvas). */
  threshold: number;
  /** Guide line color. */
  guideColor: string;
  /** Guide line stroke width in pixels. */
  guideStrokeWidth: number;
  /** Guide line dash pattern. */
  guideDash: number[];
}

export const DEFAULT_SNAP_CONFIG: SnapGuideConfig = {
  enabled: true,
  threshold: 1.0,
  guideColor: '#ff00ff',
  guideStrokeWidth: 1,
  guideDash: [4, 4],
};
