/**
 * Cubic Bezier Edge Path
 *
 * 자유 곡선 경로. face-perpendicular control point를 사용하여
 * 곡선이 각 도형 면에 수직으로 접근한다.
 */

import type { IREdgePathBezier, IRPoint } from '../../../ir/types.js';
import type { PathContext } from './types.js';

/**
 * Face-perpendicular cubic bezier 경로 생성.
 *
 * fromCenter/toCenter가 있으면 각 anchor의 outward normal 방향으로
 * control point를 배치한다.
 *
 * offset = distance × 0.3 (30% of inter-anchor distance); 단위: 0–100 좌표.
 */
export function createBezierPath(
  from: IRPoint,
  to: IRPoint,
  ctx: PathContext,
): IREdgePathBezier {
  const fromCenter = boundsCenter(ctx.fromBounds);
  const toCenter = boundsCenter(ctx.toBounds);

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // 0.3 = control point offset 비율 — 곡률과 직선성 사이의 균형
  const offset = dist * 0.3;

  let cp1: IRPoint;
  let cp2: IRPoint;

  // face-perpendicular: cp를 각 anchor의 outward normal 방향으로 배치
  const fromDir = normalizeVec(from.x - fromCenter.x, from.y - fromCenter.y);
  const toDir = normalizeVec(to.x - toCenter.x, to.y - toCenter.y);

  cp1 = { x: from.x + fromDir.x * offset, y: from.y + fromDir.y * offset };
  cp2 = { x: to.x + toDir.x * offset, y: to.y + toDir.y * offset };

  return {
    type: 'bezier',
    controlPoints: [{ cp1, cp2, end: to }],
  };
}

function boundsCenter(b: { x: number; y: number; w: number; h: number }): IRPoint {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

function normalizeVec(x: number, y: number): IRPoint {
  const len = Math.sqrt(x * x + y * y);
  if (len < 1e-10) return { x: 1, y: 0 };
  return { x: x / len, y: y / len };
}
