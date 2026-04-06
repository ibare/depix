/**
 * Back-Edge Path
 *
 * 순환 간선(cycle-closing feedback edge) 전용 경로.
 * 메인 플로우를 피해 넓은 호를 그리며 되돌아간다.
 *
 * 형제 노드 bounds가 제공되면 양방향 후보의 충돌을 비교하여
 * 다른 노드를 관통하지 않는 방향을 선택한다.
 */

import type { IRBounds, IREdgePathBezier, IRPoint } from '../../../ir/types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// 0.6 = 일반 bezier(0.3)보다 넓은 호. 8 = 가까운 노드에서도 가시적 호를 보장 (IR 단위)
const OFFSET_RATIO = 0.6;
const MIN_OFFSET = 8;
// 1.0 = 충돌 판정 시 sibling bounds에 추가하는 여유 간격 (IR 단위)
const CLEARANCE_MARGIN = 1.0;

// ---------------------------------------------------------------------------
// Detour direction
// ---------------------------------------------------------------------------

/** 백엣지 우회 방향 결정 결과 */
export interface BackEdgeDetour {
  /** 주 흐름이 수직인지 (true) 수평인지 (false) */
  isVertical: boolean;
  /** 우회 방향: +1 (right/bottom) 또는 -1 (left/top) */
  side: number;
}

/**
 * 백엣지의 우회 방향을 결정한다.
 *
 * 두 노드의 상대 위치로 주 흐름 방향(수직/수평)을 판별하고,
 * siblingBounds가 있으면 양방향 충돌을 비교하여 안전한 방향을 선택한다.
 * 없거나 동점이면 외곽 방향(중앙에서 먼 쪽)을 기본으로 사용한다.
 *
 * routeEdge에서 면 기반 앵커 결정에도 사용된다.
 */
export function computeBackEdgeDetour(
  fromCenter: IRPoint,
  toCenter: IRPoint,
  siblingBounds?: IRBounds[],
): BackEdgeDetour {
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;
  const isVertical = Math.abs(dy) >= Math.abs(dx);

  // 50 = 0-100 상대 좌표계 중앙값; 외곽 방향 우회를 위해 중앙 기준 판별
  const midX = (fromCenter.x + toCenter.x) / 2;
  const midY = (fromCenter.y + toCenter.y) / 2;
  const defaultSide = isVertical
    ? (midX < 50 ? -1 : 1)   // 좌측이면 더 좌측으로, 우측이면 더 우측으로
    : (midY < 50 ? -1 : 1);

  if (!siblingBounds || siblingBounds.length === 0) {
    return { isVertical, side: defaultSide };
  }

  const dist = Math.sqrt(dx * dx + dy * dy);
  const offset = Math.max(dist * OFFSET_RATIO, MIN_OFFSET);
  const side = pickBetterSide(
    fromCenter, toCenter, offset, isVertical, defaultSide, siblingBounds,
  );

  return { isVertical, side };
}

// ---------------------------------------------------------------------------
// Path creation
// ---------------------------------------------------------------------------

/**
 * 백엣지 bezier 경로 생성.
 *
 * siblingBounds가 있으면 양방향(+side, -side) 후보를 비교하여
 * 충돌이 적은 방향을 선택한다. 없으면 외곽 방향(중앙에서 먼 쪽)을 기본으로 사용.
 */
export function createBackEdgePath(
  from: IRPoint,
  to: IRPoint,
  siblingBounds?: IRBounds[],
): IREdgePathBezier {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const offset = Math.max(dist * OFFSET_RATIO, MIN_OFFSET);

  const { isVertical, side } = computeBackEdgeDetour(from, to, siblingBounds);

  const cp1 = isVertical
    ? { x: from.x + side * offset, y: from.y }
    : { x: from.x, y: from.y + side * offset };

  const cp2 = isVertical
    ? { x: to.x + side * offset, y: to.y }
    : { x: to.x, y: to.y + side * offset };

  return {
    type: 'bezier',
    controlPoints: [{ cp1, cp2, end: to }],
  };
}

// ---------------------------------------------------------------------------
// Direction selection helpers
// ---------------------------------------------------------------------------

/**
 * 양방향(+1, -1) 후보의 bezier convex hull bbox를 계산하고
 * sibling bounds와의 교차 수가 적은 방향을 반환한다.
 * 동점이면 defaultSide를 사용.
 */
function pickBetterSide(
  from: IRPoint,
  to: IRPoint,
  offset: number,
  isVertical: boolean,
  defaultSide: number,
  siblings: IRBounds[],
): number {
  const countA = countOverlaps(from, to, offset, +1, isVertical, siblings);
  const countB = countOverlaps(from, to, offset, -1, isVertical, siblings);

  if (countA < countB) return +1;
  if (countB < countA) return -1;
  return defaultSide;
}

/**
 * 주어진 방향(side)으로 생성될 bezier의 convex hull bbox를
 * 계산하고, siblings 중 교차하는 수를 반환한다.
 */
function countOverlaps(
  from: IRPoint,
  to: IRPoint,
  offset: number,
  side: number,
  isVertical: boolean,
  siblings: IRBounds[],
): number {
  // Bezier 4점: from, cp1, cp2, to. Convex hull의 bbox가 곡선을 포함한다.
  const cp1 = isVertical
    ? { x: from.x + side * offset, y: from.y }
    : { x: from.x, y: from.y + side * offset };
  const cp2 = isVertical
    ? { x: to.x + side * offset, y: to.y }
    : { x: to.x, y: to.y + side * offset };

  const bboxMinX = Math.min(from.x, cp1.x, cp2.x, to.x);
  const bboxMaxX = Math.max(from.x, cp1.x, cp2.x, to.x);
  const bboxMinY = Math.min(from.y, cp1.y, cp2.y, to.y);
  const bboxMaxY = Math.max(from.y, cp1.y, cp2.y, to.y);

  let count = 0;
  for (const b of siblings) {
    // margin 추가하여 근접 통과도 방지
    const sx = b.x - CLEARANCE_MARGIN;
    const sy = b.y - CLEARANCE_MARGIN;
    const sw = b.w + CLEARANCE_MARGIN * 2;
    const sh = b.h + CLEARANCE_MARGIN * 2;

    // AABB overlap test
    if (bboxMaxX > sx && bboxMinX < sx + sw &&
        bboxMaxY > sy && bboxMinY < sy + sh) {
      count++;
    }
  }
  return count;
}
