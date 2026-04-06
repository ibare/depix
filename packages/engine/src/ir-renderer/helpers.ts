/**
 * Edge & Arrow Helpers
 *
 * Geometric utilities for edge rendering:
 * - Arrow marker creation (filled triangle at line endpoint)
 * - Penultimate/second point extraction for arrow direction
 */

import Konva from 'konva';
import type { IREdge, IRStyle, IREdgePathPolyline, IREdgePathBezier } from '@depix/core';
import type { CoordinateTransform } from '../coordinate-transform.js';

// ---------------------------------------------------------------------------
// Arrow marker
// ---------------------------------------------------------------------------

/**
 * Arrow length in absolute pixels.
 *
 * strokeWidth × 3.5, clamped to [0.8, 2.0] IR units, then converted to pixels.
 * Used by both arrow marker rendering and line endpoint retraction.
 */
export function getArrowLength(style: IRStyle, transform: CoordinateTransform): number {
  // 3.5 = visual multiplier; 0.8–2.0 = IR-coord min/max for readability
  const sw = typeof style.strokeWidth === 'number' ? style.strokeWidth : 0.3;
  return transform.toAbsoluteSize(Math.min(Math.max(sw * 3.5, 0.8), 2.0));
}

/**
 * Create a filled triangle arrow marker at the `to` endpoint,
 * pointing in the direction from→to.
 *
 * Arrow half-width = length × 0.35 (narrower than equilateral for a sharper look).
 *
 * Returns null if from === to (zero-length segment).
 */
export function createArrowMarker(
  from: { x: number; y: number },
  to: { x: number; y: number },
  style: IRStyle,
  transform: CoordinateTransform,
): Konva.Line | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return null;

  const arrowLen = getArrowLength(style, transform);
  // 0.35 = half-width ratio — narrower triangle for a sleek arrow head
  const arrowHalfW = arrowLen * 0.35;

  // Unit vector along the edge direction
  const ux = dx / len;
  const uy = dy / len;
  // Perpendicular unit vector (for arrow width)
  const px = -uy;
  const py = ux;

  const tipX = to.x;
  const tipY = to.y;
  const baseX = to.x - ux * arrowLen;
  const baseY = to.y - uy * arrowLen;

  return new Konva.Line({
    points: [
      baseX + px * arrowHalfW,
      baseY + py * arrowHalfW,
      tipX, tipY,
      baseX - px * arrowHalfW,
      baseY - py * arrowHalfW,
    ],
    closed: true,
    fill: typeof style.stroke === 'string' ? style.stroke : '#000000',
  });
}

// ---------------------------------------------------------------------------
// Edge direction helpers
// ---------------------------------------------------------------------------

/**
 * Returns the second-to-last point of an edge path (for arrowEnd direction).
 * Falls back to absFrom if the path has no intermediate points.
 */
export function getEdgePenultimatePoint(
  edge: IREdge,
  absFrom: { x: number; y: number },
  transform: CoordinateTransform,
): { x: number; y: number } {
  if (edge.path.type === 'polyline') {
    const poly = edge.path as IREdgePathPolyline;
    if (poly.points.length > 0) {
      return transform.toAbsolutePoint(poly.points[poly.points.length - 1]);
    }
  }
  if (edge.path.type === 'bezier') {
    const bezier = edge.path as IREdgePathBezier;
    if (bezier.controlPoints.length > 0) {
      const last = bezier.controlPoints[bezier.controlPoints.length - 1];
      return transform.toAbsolutePoint(last.cp2);
    }
  }
  return absFrom;
}

/**
 * Returns the second point of an edge path (for arrowStart direction).
 * Falls back to absTo if the path has no intermediate points.
 */
export function getEdgeSecondPoint(
  edge: IREdge,
  absTo: { x: number; y: number },
  transform: CoordinateTransform,
): { x: number; y: number } {
  if (edge.path.type === 'polyline') {
    const poly = edge.path as IREdgePathPolyline;
    if (poly.points.length > 0) {
      return transform.toAbsolutePoint(poly.points[0]);
    }
  }
  if (edge.path.type === 'bezier') {
    const bezier = edge.path as IREdgePathBezier;
    if (bezier.controlPoints.length > 0) {
      return transform.toAbsolutePoint(bezier.controlPoints[0].cp1);
    }
  }
  return absTo;
}
