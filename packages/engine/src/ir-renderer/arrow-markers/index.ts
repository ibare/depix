/**
 * Arrow Marker Registry — Pluggable Dispatcher
 *
 * IR의 arrowStart/arrowEnd(IRArrowType)를 개별 렌더러로 디스패치한다.
 *
 * 새 마커 추가 절차:
 *   1) ArrowMarkerRenderer 시그니처에 맞춰 별도 파일로 함수 작성
 *      (예: ./triangle.ts, ./diamond.ts)
 *   2) 이 파일의 REGISTRY에 IRArrowType 키로 등록
 *   3) 호출부는 변경 불필요 — dispatcher가 자동 디스패치
 *
 * 미등록 타입은 renderChevronMarker로 폴백한다.
 */

import type { IRArrowType, IRStyle } from '@depix/core';
import type { CoordinateTransform } from '../../coordinate-transform.js';
import type { ArrowMarkerContext, ArrowMarkerNode, ArrowMarkerRenderer } from './types.js';
import { renderChevronMarker } from './chevron.js';

// 현재는 모든 비-'none' 타입이 chevron으로 매핑. 향후 triangle/diamond/circle/square
// 등 고유 렌더러가 추가되면 해당 키를 덮어쓴다. 호출부 수정 불필요.
const REGISTRY: Partial<Record<IRArrowType, ArrowMarkerRenderer>> = {
  triangle: renderChevronMarker,
  'open-triangle': renderChevronMarker,
  diamond: renderChevronMarker,
  'filled-diamond': renderChevronMarker,
  'open-diamond': renderChevronMarker,
  circle: renderChevronMarker,
  square: renderChevronMarker,
};

/**
 * Create an arrow marker node at `to`, pointing in the direction `from → to`.
 *
 * 공통 관심사(방향 벡터 정규화, null 체크, zero-length 가드)를 여기서 처리하고,
 * 개별 렌더러는 자신의 모양에만 집중한다 — 중복 코드 방지.
 *
 * @param type    — IRArrowType. 'none'/undefined면 null 반환.
 * @param from    — Direction source (tail side), 절대 픽셀.
 * @param to      — Tip position, 절대 픽셀.
 * @param style   — IR style (stroke color / width).
 * @param length  — 사전 계산된 arrow length (pixels). helpers.getArrowLength 결과.
 * @param transform — IR → pixel 좌표 변환.
 */
export function createArrowMarker(
  type: IRArrowType | undefined,
  from: { x: number; y: number },
  to: { x: number; y: number },
  style: IRStyle,
  length: number,
  transform: CoordinateTransform,
): ArrowMarkerNode | null {
  if (!type || type === 'none') return null;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-10) return null;

  const renderer = REGISTRY[type] ?? renderChevronMarker;
  const ctx: ArrowMarkerContext = {
    tip: to,
    direction: { x: dx / len, y: dy / len },
    length,
    style,
    transform,
  };
  return renderer(ctx);
}

export type { ArrowMarkerContext, ArrowMarkerRenderer } from './types.js';
