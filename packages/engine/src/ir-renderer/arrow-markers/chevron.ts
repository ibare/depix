/**
 * Chevron Arrow Marker (open V-shape)
 *
 * 레퍼런스: Arrow 1.svg (viewBox 88×15, strokeWidth 2).
 * 측정: tip center (1.0, 7.36) → top arm end center (7.36, 1.0),
 *       dx=6.36, dy=6.36 → 각 arm이 edge 방향에서 45° 벌어져 총 90° 각도.
 *
 * 구현 핵심: 두 arm을 Konva.Path 이중 subpath(M-L M-L)로 그려
 *  tip에서 line-join을 거치지 않도록 한다. 각 arm에는 독립적으로 round cap이
 *  적용되어 좌우 대칭이 수학적으로 보장된다.
 *  (단일 polyline + lineJoin:'round'은 예각 tip에서 비대칭 아티팩트 발생 → 금지)
 */

import Konva from 'konva';
import type { ArrowMarkerRenderer } from './types.js';

// 1.0 = halfWidth / length 비율 (tan(45°)).
//       레퍼런스 측정: arrowLen 6.36, halfW 6.36 → 비율 1.0 (총 각도 90°).
const CHEVRON_HALF_W_RATIO = 1.0;

export const renderChevronMarker: ArrowMarkerRenderer = ({
  tip,
  direction,
  length,
  style,
  transform,
}) => {
  if (length <= 0) return null;

  const halfW = length * CHEVRON_HALF_W_RATIO;
  // Perpendicular unit vector — rotate `direction` 90° counterclockwise.
  const px = -direction.y;
  const py = direction.x;
  // Base center: tip에서 -direction 방향으로 length만큼 후퇴한 지점.
  const baseX = tip.x - direction.x * length;
  const baseY = tip.y - direction.y * length;
  // 양쪽 arm end points (base center에서 수직 방향으로 halfW만큼 오프셋).
  const arm1X = baseX + px * halfW;
  const arm1Y = baseY + py * halfW;
  const arm2X = baseX - px * halfW;
  const arm2Y = baseY - py * halfW;

  const stroke = typeof style.stroke === 'string' ? style.stroke : '#000000';
  // strokeWidth는 엣지 선과 동일한 IR→pixel 변환 (시각 일관성).
  const strokeWidth = typeof style.strokeWidth === 'number'
    ? transform.toAbsoluteSize(style.strokeWidth)
    : 1;

  // 이중 subpath: arm1→tip, tip→arm2. 두 선분이 독립적으로 stroke되어
  // tip에서 line-join이 발생하지 않는다.
  const d = `M ${arm1X} ${arm1Y} L ${tip.x} ${tip.y} M ${tip.x} ${tip.y} L ${arm2X} ${arm2Y}`;

  return new Konva.Path({
    data: d,
    stroke,
    strokeWidth,
    lineCap: 'round',
    fill: undefined,
  });
};
