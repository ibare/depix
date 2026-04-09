/**
 * Emit walker — compound element 처리 (stat, quote, bullet/list).
 *
 * emit-element-walker.ts에서 분리. compound element는 plan-all-element.ts가
 * 합성한 자식 PlanNode를 가지며, 이 walker는 BoundsMap에서 자식 bounds를
 * 조회하여 IR을 생성한다.
 *
 * S-pipeline MUST 준수:
 *   - BoundsMap을 **조회만** 한다. measure/allocate 호출 없음.
 *   - 폴백 비율(0.65/0.35, 0.75/0.25)은 BoundsMap이 없는 비정상 경로에서만 사용.
 */

import type {
  IRBounds,
  IRContainer,
  IRElement,
  IRText,
} from '../ir/types.js';
import type { SceneTheme } from '../theme/scene-theme.js';
import type { BoundsMap } from './passes/allocate-bounds.js';
import type { PlanNode } from './layout/plan-types.js';
import { buildIRStyle } from './emit-helpers.js';

// ---------------------------------------------------------------------------
// Bullet / List walker
// ---------------------------------------------------------------------------

export function walkBullet(
  plan: PlanNode,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  baseFontSize: number,
  boundsMap?: BoundsMap,
): IRContainer {
  // bracket 구문: plan.children에 합성 자식이 있으면 BoundsMap 조회.
  // block 구문 `bullet { item "A" }`: plan.children에 item PlanNode가 있지만
  // elementType='item'일 수 있음. 모든 자식을 사용.
  const itemsFromProps = plan.items && plan.items.length > 0 ? plan.items : undefined;
  const itemsFromChildren = plan.children.map(c => c.label ?? '');
  const items = itemsFromProps ?? (itemsFromChildren.length > 0 ? itemsFromChildren : []);
  const itemFontSize = baseFontSize * sceneTheme.typography.bodySize;
  const isOrdered = plan.props.ordered === true;
  const color =
    typeof plan.style.color === 'string' ? plan.style.color : sceneTheme.colors.text;

  // BoundsMap에서 자식 bounds를 조회. 없으면 균등 분배 폴백.
  const hasSynthChildren = plan.children.length > 0 && boundsMap;
  const children: IRElement[] = items.map((item, i) => {
    const prefix = isOrdered ? `${i + 1}.` : '\u2022';
    const childPlan = plan.children[i];
    const childBounds = hasSynthChildren && childPlan
      ? boundsMap.get(childPlan.id)
      : undefined;

    // BoundsMap 조회 성공 시 그 bounds를 사용, 아니면 균등 분배 폴백.
    const itemBounds: IRBounds = childBounds ?? {
      x: bounds.x,
      y: bounds.y + i * (bounds.h / Math.max(items.length, 1)),
      w: bounds.w,
      h: bounds.h / Math.max(items.length, 1),
    };
    // 폰트 크기: 자식 bounds 높이에 비례 (itemFontSize가 bounds에 맞게 축소)
    // 0.45: bounds 높이의 45%를 폰트 상한으로 설정 (lineHeight 1.4 + 여백 고려)
    const scaledFontSize = childBounds
      ? Math.min(itemFontSize, childBounds.h * 0.45)
      : itemFontSize;

    return {
      id: `${plan.id}-item-${i}`,
      type: 'text',
      bounds: itemBounds,
      style: {},
      content: `${prefix} ${item}`,
      fontSize: scaledFontSize,
      color,
      align: 'left',
      valign: 'middle',
    } as IRText;
  });

  return {
    id: plan.id,
    type: 'container',
    bounds,
    style: buildIRStyle(plan.style),
    children,
    origin: { dslType: plan.elementType },
  };
}

// ---------------------------------------------------------------------------
// Stat walker (value IRText + optional label IRText → IRContainer)
// ---------------------------------------------------------------------------

export function walkStat(
  plan: PlanNode,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  baseFontSize: number,
  boundsMap?: BoundsMap,
): IRContainer {
  const color =
    typeof plan.style.color === 'string' ? plan.style.color : sceneTheme.colors.accent;

  // 합성 자식에서 value/label 텍스트와 bounds를 조회.
  const valueChild = plan.children[0];
  const labelChild = plan.children.length > 1 ? plan.children[1] : undefined;
  const valueLabel = valueChild?.label ?? plan.label ?? '';
  const labelLabel = labelChild?.label;

  // BoundsMap 조회. 없으면 기존 비율 폴백 (0.65/0.35).
  // 0.65/0.35: stat value가 시각적 중심, 약 2:1 비율 (0–100 상대 좌표).
  const valueBounds = (boundsMap && valueChild)
    ? boundsMap.get(valueChild.id) ?? { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h * 0.65 }
    : { x: bounds.x, y: bounds.y, w: bounds.w, h: labelLabel ? bounds.h * 0.65 : bounds.h };

  const valueText: IRText = {
    id: `${plan.id}-value`,
    type: 'text',
    bounds: valueBounds,
    style: buildIRStyle(plan.style),
    content: valueLabel,
    fontSize: baseFontSize * sceneTheme.typography.statSize,
    color,
    fontWeight: 'bold',
    align: 'center',
    valign: 'middle',
    origin: { dslType: plan.elementType },
  };

  const children: IRElement[] = [valueText];

  if (labelChild || typeof plan.props.label === 'string') {
    const lblContent = labelLabel ?? (plan.props.label as string);
    const labelBounds = (boundsMap && labelChild)
      ? boundsMap.get(labelChild.id) ?? { x: bounds.x, y: bounds.y + valueBounds.h, w: bounds.w, h: bounds.h - valueBounds.h }
      : { x: bounds.x, y: bounds.y + valueBounds.h, w: bounds.w, h: bounds.h - valueBounds.h };

    children.push({
      id: `${plan.id}-label`,
      type: 'text',
      bounds: labelBounds,
      style: {},
      content: lblContent,
      fontSize: baseFontSize * sceneTheme.typography.bodySize * 0.9,
      color: sceneTheme.colors.textMuted,
      align: 'center',
      valign: 'top',
      origin: { dslType: plan.elementType },
    } as IRText);
  }

  return {
    id: plan.id,
    type: 'container',
    bounds,
    style: buildIRStyle(plan.style),
    children,
    origin: { dslType: plan.elementType },
  };
}

// ---------------------------------------------------------------------------
// Quote walker (quote IRText + optional attribution IRText → IRContainer)
// ---------------------------------------------------------------------------

export function walkQuote(
  plan: PlanNode,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  baseFontSize: number,
  boundsMap?: BoundsMap,
): IRText | IRContainer {
  const color =
    typeof plan.style.color === 'string' ? plan.style.color : sceneTheme.colors.primary;

  // 합성 자식에서 text/attribution 텍스트와 bounds를 조회.
  const textChild = plan.children[0];
  const attrChild = plan.children.length > 1 ? plan.children[1] : undefined;
  const quoteLabel = textChild?.label ?? plan.label ?? '';
  const attribution = attrChild?.label ?? (
    typeof plan.props.attribution === 'string' ? (plan.props.attribution as string) : undefined
  );

  // BoundsMap 조회. 없으면 기존 비율 폴백 (0.75/0.25).
  // 0.75/0.25: 인용문이 주요 콘텐츠, 약 3:1 비율 (0–100 상대 좌표).
  const quoteBounds = (boundsMap && textChild)
    ? boundsMap.get(textChild.id) ?? { x: bounds.x, y: bounds.y, w: bounds.w, h: attribution ? bounds.h * 0.75 : bounds.h }
    : { x: bounds.x, y: bounds.y, w: bounds.w, h: attribution ? bounds.h * 0.75 : bounds.h };

  const quoteText: IRText = {
    id: attribution ? `${plan.id}-text` : plan.id,
    type: 'text',
    bounds: quoteBounds,
    style: buildIRStyle(plan.style),
    content: `\u201C${quoteLabel}\u201D`,
    fontSize: baseFontSize * sceneTheme.typography.headingSize * 0.8,
    color,
    fontStyle: 'italic',
    align: 'center',
    valign: 'middle',
    origin: { dslType: plan.elementType },
  };

  if (!attribution) return quoteText;

  const attrBounds = (boundsMap && attrChild)
    ? boundsMap.get(attrChild.id) ?? { x: bounds.x, y: bounds.y + quoteBounds.h, w: bounds.w, h: bounds.h - quoteBounds.h }
    : { x: bounds.x, y: bounds.y + quoteBounds.h, w: bounds.w, h: bounds.h - quoteBounds.h };

  const attrText: IRText = {
    id: `${plan.id}-attribution`,
    type: 'text',
    bounds: attrBounds,
    style: {},
    content: `\u2014 ${attribution}`,
    fontSize: baseFontSize * sceneTheme.typography.bodySize * 0.9,
    color: sceneTheme.colors.textMuted,
    align: 'center',
    valign: 'top',
    origin: { dslType: plan.elementType },
  };

  return {
    id: plan.id,
    type: 'container',
    bounds,
    style: buildIRStyle(plan.style),
    children: [quoteText, attrText],
    origin: { dslType: plan.elementType },
  };
}
