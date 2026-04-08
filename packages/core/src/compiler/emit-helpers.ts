/**
 * Emit walker 공유 헬퍼 — 스타일 변환, inner text 빌더, 엣지 라우팅.
 *
 * 옛 `passes/emit-ir-helpers.ts`의 동일 함수군을 `PlanNode` 중심으로 재이식했다.
 * 차이점:
 *   - 입력이 `ASTElement`/`ASTEdge`가 아니라 `PlanNode`/`PlanEdge`다.
 *   - `buildIRStyle(planNode.style)` 형태로 raw DSL 스타일 Record를 IRStyle로 변환.
 *   - `routePlanEdge`가 PlanEdge + BoundsMap을 받아 IREdge를 만든다.
 *
 * 순환 방지: 이 파일은 walker 5파일 중 어느 것도 import하지 않는다.
 * walker가 이 파일을 import한다 (단방향).
 *

 */

import type {
  IRBounds,
  IREdge,
  IRInnerText,
  IRShapeType,
  IRStyle,
} from '../ir/types.js';
import type { DepixTheme } from '../theme/types.js';
import type { PlanEdge, PlanNode } from './layout/plan-types.js';
import { routeEdge, type RouteEdgeInput } from './routing/edge-router.js';

// ---------------------------------------------------------------------------
// buildIRStyle — DSL raw style → IRStyle
// ---------------------------------------------------------------------------

/**
 * DSL raw 스타일 Record를 IRStyle 5필드로 변환.
 *
 * 변환 규칙 (옛 `buildStyle`과 동일):
 *   - `background` → `fill`
 *   - `border` → `stroke`
 *   - `border-width` / `stroke-width` → `strokeWidth`
 *   - `shadow-offsetX/Y/blur/color` → `shadow`
 *   - `dash` (쉼표 구분 문자열) → `dashPattern` (숫자 배열)
 *
 * IRStyle에 없는 키(`font-size`, `color`, `radius`, `align` 등)는 변환 대상이 아니다.
 * 이들은 emit walker가 PlanNode.style에서 직접 읽는다 (예: `innerText` 빌더).
 */
export function buildIRStyle(planStyle: Record<string, string | number>): IRStyle {
  const style: IRStyle = {};

  if ('background' in planStyle) {
    style.fill = String(planStyle.background);
  }
  if ('border' in planStyle && typeof planStyle.border === 'string') {
    style.stroke = planStyle.border;
  }
  if ('border-width' in planStyle && typeof planStyle['border-width'] === 'number') {
    style.strokeWidth = planStyle['border-width'];
  }
  if ('stroke-width' in planStyle && typeof planStyle['stroke-width'] === 'number') {
    style.strokeWidth = planStyle['stroke-width'];
  }

  if (
    'shadow-offsetX' in planStyle &&
    'shadow-offsetY' in planStyle &&
    'shadow-blur' in planStyle &&
    'shadow-color' in planStyle
  ) {
    style.shadow = {
      offsetX: Number(planStyle['shadow-offsetX']),
      offsetY: Number(planStyle['shadow-offsetY']),
      blur: Number(planStyle['shadow-blur']),
      color: String(planStyle['shadow-color']),
    };
  }

  if ('dash' in planStyle && typeof planStyle.dash === 'string') {
    style.dashPattern = planStyle.dash
      .split(',')
      .map(Number)
      .filter((n) => !Number.isNaN(n));
  }

  return style;
}

// ---------------------------------------------------------------------------
// buildInnerText — shape 내부 텍스트
// ---------------------------------------------------------------------------

/**
 * shape 노드의 내부 라벨을 IRInnerText로 변환.
 *
 * fontSize 결정 우선순위 (S-compiler MUST):
 *   1. PlanNode.style['font-size'] (raw DSL 값)
 *   2. 호출자가 measured fontSize를 명시적으로 전달
 *   3. theme.fontSize.md 폴백
 *
 * walker가 측정 함수를 호출하지 않는다는 S-pipeline MUST를 지키기 위해,
 * measured fontSize는 **반드시 파라미터로 받는다** (이 함수 자체가 측정하지 않음).
 */
export function buildInnerText(
  plan: PlanNode,
  theme: DepixTheme,
  measuredFontSize?: number,
): IRInnerText {
  const styleFontSize = plan.style['font-size'];
  const fontSize =
    measuredFontSize ??
    (typeof styleFontSize === 'number' ? styleFontSize : theme.fontSize.md);
  const color =
    typeof plan.style.color === 'string' ? plan.style.color : theme.foreground;

  const innerText: IRInnerText = {
    content: plan.label ?? '',
    color,
    fontSize,
    align: 'center',
    valign: 'middle',
  };

  if (plan.style['font-weight'] === 'bold') {
    innerText.fontWeight = 'bold';
  }

  return innerText;
}

// ---------------------------------------------------------------------------
// extractCornerRadius
// ---------------------------------------------------------------------------

/**
 * PlanNode.style에서 corner radius를 숫자로 추출. 없으면 undefined.
 */
export function extractCornerRadius(plan: PlanNode): number | undefined {
  const r = plan.style.radius;
  return typeof r === 'number' ? r : undefined;
}

// ---------------------------------------------------------------------------
// routePlanEdge — PlanEdge → IREdge
// ---------------------------------------------------------------------------

/**
 * PlanEdge 하나를 IREdge로 변환. BoundsMap에서 fromId/toId의 bounds를 조회한다.
 *
 * 조회 실패(참조 무결성 오류) 시 `null` 반환 — 호출자(walker)가 건너뛴다.
 * S-pipeline MUST 준수: 이 함수는 bounds를 **조회만** 한다. 재계산 없음.
 */
export function routePlanEdge(
  edge: PlanEdge,
  boundsMap: Map<string, IRBounds>,
  shapeMap?: Map<string, IRShapeType>,
  isBackEdge = false,
): IREdge | null {
  const fromBounds = boundsMap.get(edge.fromId);
  const toBounds = boundsMap.get(edge.toId);

  if (!fromBounds || !toBounds) return null;

  const input: RouteEdgeInput = {
    fromId: edge.fromId,
    toId: edge.toId,
    fromBounds,
    toBounds,
    fromShape: shapeMap?.get(edge.fromId),
    toShape: shapeMap?.get(edge.toId),
    edgeStyle: edge.edgeStyle,
    label: edge.label,
    isBackEdge,
  };

  return routeEdge(input);
}
