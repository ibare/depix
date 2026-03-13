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
 * Create a filled triangle arrow marker at the `to` endpoint,
 * pointing in the direction from→to.
 *
 * Arrow size is 1.5 units in IR coordinates, converted to absolute pixels.
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

  const arrowSize = transform.toAbsoluteSize(1.5);
  // Unit vector along the edge direction
  const ux = dx / len;
  const uy = dy / len;
  // Perpendicular unit vector (for arrow width)
  const px = -uy;
  const py = ux;

  const tipX = to.x;
  const tipY = to.y;
  const baseX = to.x - ux * arrowSize;
  const baseY = to.y - uy * arrowSize;

  return new Konva.Line({
    points: [
      baseX + px * arrowSize * 0.5,
      baseY + py * arrowSize * 0.5,
      tipX, tipY,
      baseX - px * arrowSize * 0.5,
      baseY - py * arrowSize * 0.5,
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
