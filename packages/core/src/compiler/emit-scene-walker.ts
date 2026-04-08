/**
 * Emit walker — scene 노드 처리.
 *
 * 입력: scene PlanNode (`blockType === 'scene'`).
 * 출력: IRScene (background + 슬롯별 children + layout 메타).
 *
 * 책임:
 *   1. 배경 사각형 emit.
 *   2. 자식 PlanNode 각각을 walkBlock/walkElement로 재귀 변환 후
 *      slot 컨테이너(`origin.sourceType: 'scene-slot'`)로 감싼다.
 *   3. layout 메타(`{ type, ratio, direction }`)를 IRScene에 부착.
 *
 * S-pipeline MUST 준수:
 *   - walker는 BoundsMap을 **조회만** 한다. slot 컨테이너 안에서도
 *     measure/allocate를 호출하지 않는다.
 *   - 배경 색상은 `sceneTheme.colors.background`를 사용한다.
 *   - `adaptBaseFontSize`/`createScaleContext` 호출 금지.
 *

 */

import type {
  IRBounds,
  IRContainer,
  IRElement,
  IRScene,
  IRStyle,
} from '../ir/types.js';
import type { DepixTheme } from '../theme/types.js';
import type { SceneTheme } from '../theme/scene-theme.js';
import type { BoundsMap } from './passes/allocate-bounds.js';
import type { MeasureMap } from './passes/measure.js';
import type { PlanNode } from './layout/plan-types.js';
import type { ChartPositionsMap } from './passes/compute-chart-positions.js';
import { walkBlock } from './emit-block-walker.js';
import { walkElement } from './emit-element-walker.js';

// ---------------------------------------------------------------------------
// walkScene — 진입점
// ---------------------------------------------------------------------------

/**
 * 단일 scene PlanNode → IRScene 변환.
 *
 * 호출 전제:
 *   - `plan.blockType === 'scene'`이어야 한다.
 *   - `boundsMap`은 plan과 모든 자손의 bounds를 이미 갖고 있어야 한다.
 */
export function walkScene(
  plan: PlanNode,
  boundsMap: BoundsMap,
  theme: DepixTheme,
  sceneTheme: SceneTheme,
  measureMap?: MeasureMap,
  index = 0,
  chartPositionsMap?: ChartPositionsMap,
): IRScene {
  const sceneBounds = boundsMap.get(plan.id) ?? { x: 0, y: 0, w: 100, h: 100 };
  const elements: IRElement[] = [];

  // 1) 배경 — scene 전체 영역을 덮는 rect.
  elements.push(emitSceneBackground(plan.id, sceneBounds, sceneTheme));

  // 2) 자식 walk + slot 래핑
  for (const child of plan.children) {
    const childBounds = boundsMap.get(child.id);
    if (!childBounds) continue;

    // element PlanNode가 block-type children을 가지면 walkBlock으로 위임 (e.g. heading flow)
    const hasBlockChildren = child.children.some(c => !c.blockType.startsWith('element-'));
    const inner = (child.blockType.startsWith('element-') && !hasBlockChildren)
      ? walkElement(child, childBounds, theme, sceneTheme, measureMap)
      : walkBlock(child, boundsMap, theme, sceneTheme, measureMap, chartPositionsMap);

    elements.push(wrapInSlotContainer(inner, child, childBounds));
  }

  // 3) 빈 슬롯 placeholder — allocateScene이 BoundsMap에 사전 등록한 키를 조회.
  const filledSlotNames = new Set(plan.children.map(c => c.slot).filter(Boolean));
  const SLOT_NAMES = ['header', 'body', 'left', 'right', 'top', 'bottom', 'main', 'side', 'focus'];
  for (const slotName of SLOT_NAMES) {
    if (filledSlotNames.has(slotName)) continue;
    const placeholderBounds = boundsMap.get(`${plan.id}-placeholder-${slotName}`);
    if (!placeholderBounds) continue;
    elements.push({
      id: `${plan.id}-placeholder-${slotName}`,
      type: 'container',
      bounds: placeholderBounds,
      style: { stroke: sceneTheme.colors.textMuted, strokeWidth: 0.3 },
      children: [],
      origin: { sourceType: 'scene-slot', slotName, placeholder: true },
    } as IRContainer);
  }

  // 4) layout 메타
  const layoutType = plan.layout?.preset ?? 'full';
  const layoutMeta: IRScene['layout'] = { type: layoutType };
  const ratio = plan.props.ratio;
  if (typeof ratio === 'number') layoutMeta.ratio = ratio;
  const direction = plan.props.direction;
  if (typeof direction === 'string') layoutMeta.direction = direction;

  return {
    id: plan.label ?? plan.id ?? `scene-${index}`,
    background: { type: 'solid', color: sceneTheme.colors.background },
    elements,
    layout: layoutMeta,
  };
}

// ---------------------------------------------------------------------------
// Slot 컨테이너 래핑
// ---------------------------------------------------------------------------

/**
 * 자식 IR을 IRContainer로 감싸 slot 메타(`origin.sourceType: 'scene-slot'`, `slotName`)를 부착.
 */
function wrapInSlotContainer(
  inner: IRElement,
  child: PlanNode,
  bounds: IRBounds,
): IRContainer {
  const slotName = child.slot;
  const innerBlockType =
    inner.type === 'container' ? (inner as IRContainer).origin?.sourceType : undefined;

  const slotOrigin: IRContainer['origin'] = {
    sourceType: 'scene-slot',
    ...(slotName ? { slotName } : {}),
    ...(innerBlockType ? { sourceProps: { blockType: innerBlockType } } : {}),
  };

  if (inner.type === 'container') {
    return { ...(inner as IRContainer), origin: slotOrigin };
  }

  return {
    id: `${child.id}-slot`,
    type: 'container',
    bounds,
    style: {},
    children: [inner],
    origin: slotOrigin,
  };
}

// ---------------------------------------------------------------------------
// Scene 배경
// ---------------------------------------------------------------------------

function emitSceneBackground(
  sceneId: string,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
): IRElement {
  const style: IRStyle = { fill: sceneTheme.colors.background };
  return {
    id: `${sceneId}-bg`,
    type: 'shape',
    bounds: { ...bounds },
    style,
    shape: 'rect',
    origin: { sourceType: 'scene-background' },
  };
}
