/**
 * Edge Path Strategy — Shared Types
 *
 * 모든 경로 전략이 공유하는 타입 정의.
 */

import type { IRBounds, IREdgePath, IRPoint, IRShapeType } from '../../../ir/types.js';

// ---------------------------------------------------------------------------
// Face direction
// ---------------------------------------------------------------------------

/** 도형의 4면 중 하나. 엣지가 진출/진입하는 면. */
export type Face = 'top' | 'right' | 'bottom' | 'left';

/** 각 면의 바깥 방향 단위 벡터 */
export const FACE_DIR: Record<Face, IRPoint> = {
  top:    { x: 0,  y: -1 },
  right:  { x: 1,  y: 0 },
  bottom: { x: 0,  y: 1 },
  left:   { x: -1, y: 0 },
};

// ---------------------------------------------------------------------------
// Path context
// ---------------------------------------------------------------------------

/** 경로 생성에 필요한 공유 컨텍스트 */
export interface PathContext {
  fromBounds: IRBounds;
  toBounds: IRBounds;
  fromShape?: IRShapeType;
  toShape?: IRShapeType;
  /** 백엣지 회피용: from/to를 제외한 같은 블록 내 형제 노드들의 bounds */
  siblingBounds?: IRBounds[];
}

// ---------------------------------------------------------------------------
// Strategy function signature
// ---------------------------------------------------------------------------

/** 경로 전략 함수 시그니처. 모든 전략이 이 형태를 따른다. */
export type CreatePathFn = (
  from: IRPoint,
  to: IRPoint,
  ctx: PathContext,
) => IREdgePath;

// ---------------------------------------------------------------------------
// Face detection
// ---------------------------------------------------------------------------

/**
 * anchor 위치로부터 도형의 어느 면에 있는지 감지한다.
 *
 * anchor와 bounds center의 상대 위치를 bounds 크기로 정규화하여
 * 가장 가까운 면을 반환한다.
 */
export function detectFace(anchor: IRPoint, bounds: IRBounds): Face {
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  // 0.1: 0 나누기 방지 guard (레이아웃이 과소 축소된 경우 대비)
  const hw = Math.max(bounds.w / 2, 0.1);
  const hh = Math.max(bounds.h / 2, 0.1);

  // [-1, 1] 범위로 정규화
  const nx = (anchor.x - cx) / hw;
  const ny = (anchor.y - cy) / hh;

  if (Math.abs(nx) > Math.abs(ny)) {
    return nx > 0 ? 'right' : 'left';
  }
  return ny > 0 ? 'bottom' : 'top';
}
