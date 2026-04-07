/**
 * Edge Geometry Helpers
 *
 * - Arrow length computation (strokeWidth-based sizing)
 * - Second/penultimate point extraction for arrow direction
 *
 * Arrow marker rendering (shape) lives in `./arrow-markers/`.
 */

import type { IREdge, IRStyle, IREdgePathPolyline, IREdgePathBezier } from '@depix/core';
import type { CoordinateTransform } from '../coordinate-transform.js';

// ---------------------------------------------------------------------------
// Arrow length
// ---------------------------------------------------------------------------

// 5.25 = visual multiplier (기존 3.5 대비 50% 상향 — 화살촉 가독성 강화).
// 1.2 / 3.0 = IR 0-100 좌표계 기준 clamp min/max (기존 0.8/2.0에서 1.5배 확대).
//             너무 작으면 시인성 저하, 너무 크면 엣지 압도.
const ARROW_LEN_MULTIPLIER = 5.25;
const ARROW_LEN_MIN_IR = 1.2;
const ARROW_LEN_MAX_IR = 3.0;

/**
 * Arrow length in absolute pixels.
 *
 * strokeWidth × ARROW_LEN_MULTIPLIER, clamped to [MIN, MAX] IR units,
 * then converted via transform. Used by both arrow marker rendering and
 * line endpoint retraction.
 */
export function getArrowLength(style: IRStyle, transform: CoordinateTransform): number {
  const sw = typeof style.strokeWidth === 'number' ? style.strokeWidth : 0.3;
  const irLen = Math.min(
    Math.max(sw * ARROW_LEN_MULTIPLIER, ARROW_LEN_MIN_IR),
    ARROW_LEN_MAX_IR,
  );
  return transform.toAbsoluteSize(irLen);
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
