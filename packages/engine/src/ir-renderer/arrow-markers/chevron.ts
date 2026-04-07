/**
 * Chevron Arrow Marker (filled V band)
 *
 * 레퍼런스: Arrow 1.svg (viewBox 88×15, fill="black" single path, stroke 미사용).
 * 오른쪽 화살촉 path data 정확 측정:
 *   tip 바깥 corner       (87.7071, 7.36401)
 *   상단 arm 바깥 corner  (79.9289, 0.29295)
 *   본체 stroke 두께       2.0    (y ∈ [6.36401, 8.36401])
 *   → 축방향 길이 7.7782, halfW 7.07106 (ratio 0.909)
 *   → V 띠 두께는 본체 stroke 두께와 동일
 *
 * 구현 핵심: 6점 polygon을 fill로 그린다 (stroke 미사용).
 *  외곽 V(arm1_outer, tip, arm2_outer)와 내곽 V(arm1_inner, tip_inner, arm2_inner)를
 *  하나의 closed path로 연결한 V자 띠.
 *
 *  점 순서: tip → arm1_outer ⌒ arm1_inner → tip_inner → arm2_inner ⌒ arm2_outer → Z
 *   ↑ arm 끝 두 구간(⌒)은 SVG A(arc)로 외측 볼록 반원이 되어 '칼로 잘린' 듯한
 *     날카로운 끝을 둥글게 마감한다. tip은 그대로 첨예 유지(둥글게 하면 화살표 의미 손상).
 *   ↑ 시계/반시계 일관 winding으로 자기교차 없이 fill 영역이 V 띠가 된다.
 *
 *  내곽 V geometry (수학적 도출):
 *    - axis(direction) 방향 단위 벡터 d, perpendicular p = ⊥d
 *    - arm 길이 armLen = √(length² + halfW²)
 *    - arm 각도 θ: cosθ = length/armLen, sinθ = halfW/armLen
 *    - 외곽 arm edge를 perpendicular로 thickness만큼 안쪽으로 평행이동:
 *        inner halfW = halfW − thickness/cosθ   (axis-perpendicular base 유지)
 *        inner tip   = outer tip − d·(thickness/sinθ)
 *    - 평행 보장: tanθ = halfW/length 항등식에 의해 inner edge가 outer edge와 정확히 평행
 *
 *  이전 시도(stroke 방식)의 한계 — 모두 fill polygon으로 원천 해소:
 *    1) 단일 polyline + lineJoin:'round' → tip 비대칭 아티팩트
 *    2) 이중 subpath M-L M-L + lineCap:'butt' → 두 arm 방향이 다른 tip에서
 *       butt 컷 평면이 어긋나 V 가운데에 빈 공간 발생
 *    3) 단일 polyline + lineJoin:'miter' → 시각적으로 개선되었으나 strokeWidth가
 *       클 때 화살촉 형상이 비례 변형, lineJoin/lineCap 등 Konva API 미세 동작에
 *       의존하여 디버깅 난도 높음
 *  fill polygon은 line-join/line-cap 자체가 존재하지 않아 tip이 항상 수학적으로 정확.
 */

import Konva from 'konva';
import type { ArrowMarkerRenderer } from './types.js';

// 0.909 = halfWidth / length 비율.
//   레퍼런스 Arrow 1.svg(viewBox 88×15) 오른쪽 화살촉 path data 정확 측정:
//     tip 바깥 corner     (87.7071, 7.36401)
//     상단 arm 바깥 corner (79.9289, 0.29295)
//   축방향(|dx|) = |87.7071 − 79.9289| = 7.7782
//   cross축(|dy|) = |7.36401 − 0.29295| = 7.07106
//   ratio = 7.07106 / 7.7782 ≈ 0.9091 → 상수 0.909
//   총 각도 = 2·atan(0.909) ≈ 85.4°
const CHEVRON_HALF_W_RATIO = 0.909;

// 0.95 = thickness 안전 마진 비율.
//   thickness가 maxThickness(= halfW · cosθ)에 도달하면 inner halfW가 0이 되어
//   inner V가 한 점으로 무너지고, 초과하면 polygon이 자기교차한다.
//   strokeWidth 변동(특히 작은 화살촉에서 상대적으로 큰 두께)에서도 안정적인
//   V 형상을 보장하기 위해 maxThickness의 95%에서 clamp.
const THICKNESS_SAFETY_RATIO = 0.95;

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
  // 외곽 V — 양쪽 arm end points (base center에서 수직 방향으로 halfW만큼 오프셋).
  const arm1OuterX = baseX + px * halfW;
  const arm1OuterY = baseY + py * halfW;
  const arm2OuterX = baseX - px * halfW;
  const arm2OuterY = baseY - py * halfW;

  // Arm 기하 — armLen은 외곽 V의 한쪽 arm 길이.
  const armLen = Math.sqrt(length * length + halfW * halfW);
  const cosTheta = length / armLen; // axis 성분
  const sinTheta = halfW / armLen;  // cross-axis 성분

  // strokeWidth는 엣지 선과 동일한 IR→pixel 변환 (시각 일관성).
  // 이 값이 V 띠의 perpendicular 두께가 된다.
  const rawThickness = typeof style.strokeWidth === 'number'
    ? transform.toAbsoluteSize(style.strokeWidth)
    : 1;

  // Thickness clamp — maxThickness 초과 시 inner V가 무너지므로 안전 마진 적용.
  // halfW·cosθ = maxThickness 도출:
  //   inner halfW = halfW − t/cosθ ≥ 0 ⟺ t ≤ halfW·cosθ
  const maxThickness = halfW * cosTheta;
  const thickness = Math.min(rawThickness, maxThickness * THICKNESS_SAFETY_RATIO);

  // 내곽 V — 외곽 V의 각 arm을 perpendicular로 thickness만큼 안쪽 평행이동.
  // (axis-perpendicular base 유지를 위해 cross-axis 거리는 thickness/cosθ)
  const innerHalfW = halfW - thickness / cosTheta;
  const arm1InnerX = baseX + px * innerHalfW;
  const arm1InnerY = baseY + py * innerHalfW;
  const arm2InnerX = baseX - px * innerHalfW;
  const arm2InnerY = baseY - py * innerHalfW;
  // 내곽 tip — 외곽 tip에서 axis 방향으로 thickness/sinθ 후퇴 (대칭 V 안쪽 정점).
  const tipInnerX = tip.x - direction.x * (thickness / sinTheta);
  const tipInnerY = tip.y - direction.y * (thickness / sinTheta);

  // Arm 끝 호 반지름. arm1_outer와 arm1_inner는 axis-perpendicular base line 상에서
  //   거리 (halfW − innerHalfW) = thickness/cosθ 만큼 떨어져 있고, 이를 정확히 잇는
  //   반원의 반지름은 그 절반.
  const armEndRadius = (halfW - innerHalfW) / 2;

  // 색상 매핑 — 엣지 stroke 색상을 마커 fill로 매핑.
  //  화살촉이 단색 폴리곤이므로 stroke→fill 매핑이 의미상 동등하며,
  //  레퍼런스(Arrow 1.svg fill="black")와도 일치한다.
  const fill = typeof style.stroke === 'string' ? style.stroke : '#000000';

  // 6점 closed polygon + arm 끝 반원 2개:
  //   tip → arm1_outer ⌒ arm1_inner → tip_inner → arm2_inner ⌒ arm2_outer → Z
  // 자기교차 없는 단일 winding으로 V 띠 영역이 정확히 fill 된다.
  // 점 순서를 바꾸면 hour-glass 형태의 자기교차가 발생하여 fill이 깨지므로 변경 금지.
  //
  // SVG A(arc) 명령 7-인자: rx ry x-axis-rotation large-arc-flag sweep-flag x y
  //   - rx, ry = armEndRadius (정원이라 동일)
  //   - x-axis-rotation = 0 (정원이라 무관)
  //   - large-arc-flag = 0 (반원이라 large/small 구분 무의미, 0 사용)
  //   - sweep-flag = 1 (screen y-down 좌표계에서 시계방향) — base 바깥쪽(=-direction
  //                 방향)으로 볼록한 반원이 되도록 한다. 0은 호가 polygon 내부로
  //                 휘어 화살촉이 '갉아먹힌' 모양이 되므로 사용 금지.
  //                 검증: 두 변위 벡터 cross product = 2·armEndRadius > 0 → screen 시계방향.
  //                 direction이 임의로 회전되어도 sweep=1이 항상 외측 볼록을 보장한다.
  const d =
    `M ${tip.x} ${tip.y}` +
    ` L ${arm1OuterX} ${arm1OuterY}` +
    ` A ${armEndRadius} ${armEndRadius} 0 0 1 ${arm1InnerX} ${arm1InnerY}` +
    ` L ${tipInnerX} ${tipInnerY}` +
    ` L ${arm2InnerX} ${arm2InnerY}` +
    ` A ${armEndRadius} ${armEndRadius} 0 0 1 ${arm2OuterX} ${arm2OuterY}` +
    ` Z`;

  return new Konva.Path({
    data: d,
    // fill 전용 polygon. stroke를 켜면 외곽선이 폴리곤을 안티에일리어싱 폭만큼
    // 부풀려 레퍼런스 대비 두꺼워지고, lineJoin 처리도 다시 등장한다.
    fill,
    stroke: undefined,
    strokeWidth: 0,
  });
};
