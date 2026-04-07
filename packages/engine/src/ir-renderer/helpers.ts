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

// 3.89 = arrow length / 본체 stroke 두께 비율.
//   레퍼런스 Arrow 1.svg(viewBox 88×15, fill path) 정확 측정:
//     chevron 축방향 길이 = |87.7071 − 79.9289| = 7.7782
//     본체 stroke 두께    = 2.0  (y ∈ [6.36401, 8.36401])
//     ratio = 7.7782 / 2.0 = 3.889 → 상수 3.89
//   (이전 값 5.25는 화살촉을 레퍼런스 대비 31% 과대 표시하던 오류)
// 1.2 / 3.0 = IR 0-100 좌표계 기준 clamp min/max.
//   base strokeWidth 0.3 × 3.89 = 1.167 → MIN 1.2에 가볍게 걸려 최저 시인성 보장.
//   MAX 3.0은 큰 strokeWidth에서 화살촉이 엣지를 압도하지 않도록 제한.
const ARROW_LEN_MULTIPLIER = 3.89;
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
