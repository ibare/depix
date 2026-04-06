/**
 * Edge Path Strategies — Dispatcher
 *
 * 경로 타입에 따라 적절한 전략 함수를 호출한다.
 * 새 경로 타입 추가 시: 전략 파일 작성 후 이 디스패처에 case 추가.
 *
 * 지원 타입:
 *   - smooth-step (기본): 직교 세그먼트 + 라운딩
 *   - straight: 직선
 *   - polyline: 직교 중간점 경유
 *   - bezier: 자유 cubic bezier
 */

import type { IREdgePath, IREdgePathPolyline, IRPoint } from '../../../ir/types.js';
import type { PathContext } from './types.js';
import { createSmoothStepPath } from './smooth-step.js';
import { createStraightPath } from './straight.js';
import { createBezierPath } from './bezier.js';

// ---------------------------------------------------------------------------
// Edge path type
// ---------------------------------------------------------------------------

export type EdgePathType = 'smooth-step' | 'straight' | 'polyline' | 'bezier';

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * 경로 타입에 따라 적절한 전략을 호출하여 IREdgePath를 생성한다.
 *
 * isBackEdge가 true이면 pathType에 관계없이 백엣지 전략을 사용한다.
 */
export function createEdgePath(
  pathType: EdgePathType,
  from: IRPoint,
  to: IRPoint,
  ctx: PathContext,
  isBackEdge = false,
): IREdgePath {
  // 백엣지도 smooth-step으로 통일 (직교 엣지와 시각적 일관성).
  // 2.5 = 백엣지는 일반 엣지보다 넓은 우회가 필요하므로 extension을 2.5배 확장
  if (isBackEdge) return createSmoothStepPath(from, to, ctx, { extensionScale: 2.5 });

  switch (pathType) {
    case 'smooth-step':
      return createSmoothStepPath(from, to, ctx);
    case 'straight':
      return createStraightPath();
    case 'polyline':
      return createPolylinePath(from, to);
    case 'bezier':
      return createBezierPath(from, to, ctx);
  }
}

// ---------------------------------------------------------------------------
// Polyline (inline — 너무 짧아 별도 파일 불필요)
// ---------------------------------------------------------------------------

/**
 * 직교(elbow) polyline 경로.
 * 수직 중간선을 경유: from → (midX, from.y) → (midX, to.y) → to
 */
function createPolylinePath(from: IRPoint, to: IRPoint): IREdgePathPolyline {
  const midX = (from.x + to.x) / 2;
  return {
    type: 'polyline',
    points: [
      { x: midX, y: from.y },
      { x: midX, y: to.y },
    ],
  };
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { createSmoothStepPath } from './smooth-step.js';
export { createStraightPath } from './straight.js';
export { createBezierPath } from './bezier.js';
export { createBackEdgePath, computeBackEdgeDetour } from './back-edge.js';
export type { BackEdgeDetour } from './back-edge.js';
export { detectFace, FACE_DIR } from './types.js';
export type { PathContext, Face, CreatePathFn } from './types.js';
