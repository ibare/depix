/**
 * Coordinate Transform
 *
 * Converts between the IR's 0-100 relative coordinate space and
 * absolute pixel coordinates on the Konva Stage.
 */

import type { IRBounds, IRPoint } from '@depix/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ViewportSize {
  /** Viewport width in pixels. */
  width: number;
  /** Viewport height in pixels. */
  height: number;
}

export interface AspectRatio {
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Transform class
// ---------------------------------------------------------------------------

export class CoordinateTransform {
  private scaleX: number;
  private scaleY: number;
  private offsetX: number;
  private offsetY: number;

  constructor(viewport: ViewportSize, aspectRatio: AspectRatio = { width: 16, height: 9 }) {
    // Compute scale to fit the IR space (0-100) into the viewport
    // while maintaining aspect ratio (letterbox/pillarbox)
    const viewAR = viewport.width / viewport.height;
    const canvasAR = aspectRatio.width / aspectRatio.height;

    let effectiveW: number;
    let effectiveH: number;

    if (viewAR > canvasAR) {
      // Viewport wider than canvas → pillarbox (center horizontally)
      effectiveH = viewport.height;
      effectiveW = effectiveH * canvasAR;
    } else {
      // Viewport taller than canvas → letterbox (center vertically)
      effectiveW = viewport.width;
      effectiveH = effectiveW / canvasAR;
    }

    this.scaleX = effectiveW / 100;
    this.scaleY = effectiveH / 100;
    this.offsetX = (viewport.width - effectiveW) / 2;
    this.offsetY = (viewport.height - effectiveH) / 2;
  }

  /** Convert a relative point (0-100) to absolute pixels. */
  toAbsolutePoint(point: IRPoint): { x: number; y: number } {
    return {
      x: this.offsetX + point.x * this.scaleX,
      y: this.offsetY + point.y * this.scaleY,
    };
  }

  /** Convert relative bounds (0-100) to absolute pixel bounds. */
  toAbsoluteBounds(bounds: IRBounds): { x: number; y: number; width: number; height: number } {
    return {
      x: this.offsetX + bounds.x * this.scaleX,
      y: this.offsetY + bounds.y * this.scaleY,
      width: bounds.w * this.scaleX,
      height: bounds.h * this.scaleY,
    };
  }

  /** Convert a relative size value to absolute pixels. */
  toAbsoluteSize(value: number): number {
    return value * Math.min(this.scaleX, this.scaleY);
  }

  /** Convert absolute pixel coordinates to relative (0-100). */
  toRelativePoint(absX: number, absY: number): IRPoint {
    return {
      x: (absX - this.offsetX) / this.scaleX,
      y: (absY - this.offsetY) / this.scaleY,
    };
  }

  /** Get the scale factors. */
  getScale(): { scaleX: number; scaleY: number } {
    return { scaleX: this.scaleX, scaleY: this.scaleY };
  }
}
