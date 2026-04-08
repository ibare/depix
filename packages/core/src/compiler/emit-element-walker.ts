/**
 * Emit walker — leaf element 처리 (scene 파이프라인).
 *
 * 입력: leaf PlanNode(`blockType.startsWith('element-')`), 해당 노드의 bounds.
 * 출력: IRElement 하나.
 *
 * S-pipeline MUST 준수:
 *   - bounds를 **조회만** 한다. measure/allocate를 호출하지 않는다.
 *   - dispatch는 `config.sceneEmit` (11채널) 기준.
 *   - baseFontSize: measureMap?.get(plan.id)?.fontSize 우선, 폴백 Math.min(bounds.h,100)*0.07.
 *
 * S-pipeline MUST NOT carveout (PR-6 post-cleanup까지 한시적):
 *   - `walkStat`, `walkQuote`, `walkBullet`은 `bounds.h`에 대한 비율 분배
 *     (예: `valueH = bounds.h * 0.65`)와 item별 y 계산을 수행한다.
 *   - 이는 `planAll`이 stat/quote/bullet/step을 leaf PlanNode로만 펼치고
 *     sub-child PlanNode를 만들지 않기 때문이며, BoundsMap 조회만으로는
 *     내부 레이아웃을 결정할 수 없어서 발생한 한시적 예외다.
 *   - 근본 해소: PR-6에서 `plan-all-element.ts`를 확장하여 compound element를
 *     자식 PlanNode를 갖는 컨테이너성 노드로 펼친다. 그 후 이 walker의
 *     비율 분배 로직은 제거되고 S-pipeline MUST를 예외 없이 만족한다.
 *   - carveout 대상: walkStat / walkQuote / walkBullet 3개 함수만.
 *     그 외 walker 케이스는 MUST를 그대로 준수해야 한다.
 *   - bullet/list: plan.items (string[]) 인라인 분배는 item이 PlanNode ID를
 *     갖지 않아 BoundsMap 진입이 불가능하다는 동일한 사유에서 carveout에 포함된다.
 */

import type {
  IRBounds,
  IRContainer,
  IRElement,
  IRLine,
  IRShape,
  IRShapeAsset,
  IRShapeType,
  IRText,
} from '../ir/types.js';
import type { DepixTheme } from '../theme/types.js';
import type { SceneTheme } from '../theme/scene-theme.js';
import type { MeasureMap } from './passes/measure.js';
import type { PlanNode } from './layout/plan-types.js';
import { buildIRStyle, extractCornerRadius } from './emit-helpers.js';
import { getElementConfig } from './element-type-registry.js';

// ---------------------------------------------------------------------------
// walkElement — 진입점
// ---------------------------------------------------------------------------

/**
 * 단일 leaf PlanNode → IRElement 변환.
 *
 * dispatch는 `config.sceneEmit` (11채널) 기준.
 * `theme`는 하위 호환 시그니처 유지를 위해 남긴다. scene 파이프라인 내부에서는
 * `sceneTheme`가 우선이며, theme는 사용하지 않는다.
 */
export function walkElement(
  plan: PlanNode,
  bounds: IRBounds,
  _theme: DepixTheme,
  sceneTheme: SceneTheme,
  measureMap?: MeasureMap,
): IRElement {
  if (!plan.elementType) {
    return walkSceneShape(plan, bounds, sceneTheme, 'rect');
  }

  const config = getElementConfig(plan.elementType);
  const measuredFontSize = measureMap?.get(plan.id)?.fontSize;
  const baseFontSize = measuredFontSize ?? Math.min(bounds.h, 100) * 0.07;

  switch (config.sceneEmit) {
    case 'heading':
      return walkHeading(plan, bounds, sceneTheme, baseFontSize);
    case 'label':
      return walkLabel(plan, bounds, sceneTheme, baseFontSize);
    case 'bullet':
    case 'list':
      return walkBullet(plan, bounds, sceneTheme, baseFontSize);
    case 'stat':
      return walkStat(plan, bounds, sceneTheme, baseFontSize);
    case 'quote':
      return walkQuote(plan, bounds, sceneTheme, baseFontSize);
    case 'step':
      return walkStep(plan, bounds, sceneTheme, baseFontSize);
    case 'divider':
      return walkDivider(plan, bounds, sceneTheme);
    case 'image':
      return walkImage(plan, bounds);
    case 'shape-asset':
      return walkShapeAsset(plan, bounds);
    case 'shape':
      return walkSceneShape(plan, bounds, sceneTheme, config.emitShape ?? 'rect', baseFontSize);
    default:
      return walkSceneShape(plan, bounds, sceneTheme, 'rect', baseFontSize);
  }
}

// ---------------------------------------------------------------------------
// Heading walker
// ---------------------------------------------------------------------------

function walkHeading(
  plan: PlanNode,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRText {
  const level = typeof plan.props.level === 'number' ? (plan.props.level as number) : 1;
  const sizeMultiplier =
    level === 1 ? sceneTheme.typography.headingSize : sceneTheme.typography.headingSize * 0.7;
  const color =
    typeof plan.style.color === 'string' ? plan.style.color : sceneTheme.colors.primary;
  return {
    id: plan.id,
    type: 'text',
    bounds,
    style: buildIRStyle(plan.style),
    content: plan.label ?? '',
    fontSize: baseFontSize * sizeMultiplier,
    color,
    fontWeight: 'bold',
    align: 'center',
    valign: 'middle',
    origin: { dslType: plan.elementType },
  };
}

// ---------------------------------------------------------------------------
// Label walker
// ---------------------------------------------------------------------------

function walkLabel(
  plan: PlanNode,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRText {
  let sizeMultiplier = sceneTheme.typography.bodySize;
  const sizeStr = plan.props.size;
  if (typeof sizeStr === 'string') {
    if (sizeStr === 'sm') sizeMultiplier *= 0.8;
    if (sizeStr === 'lg') sizeMultiplier *= 1.2;
  }
  const color =
    typeof plan.style.color === 'string' ? plan.style.color : sceneTheme.colors.textMuted;
  return {
    id: plan.id,
    type: 'text',
    bounds,
    style: buildIRStyle(plan.style),
    content: plan.label ?? '',
    fontSize: baseFontSize * sizeMultiplier,
    color,
    align: 'center',
    valign: 'middle',
    origin: { dslType: plan.elementType },
  };
}

// ---------------------------------------------------------------------------
// Bullet / List walker (plan.items string[] 인라인 분배)
// ---------------------------------------------------------------------------

function walkBullet(
  plan: PlanNode,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRContainer {
  // bracket 구문 우선, 없으면 { item } block 구문에서 추출
  const itemsFromProps = plan.items && plan.items.length > 0 ? plan.items : undefined;
  const itemsFromChildren = plan.children
    .filter(c => c.elementType === 'item')
    .map(c => c.label ?? '');
  const items = itemsFromProps ?? (itemsFromChildren.length > 0 ? itemsFromChildren : []);
  const itemFontSize = baseFontSize * sceneTheme.typography.bodySize;
  const itemGap = sceneTheme.layout.itemGap;
  const itemH = itemFontSize * 2.0;
  const totalNeeded = items.length * itemH + Math.max(items.length - 1, 0) * itemGap;
  const scale = totalNeeded > bounds.h && totalNeeded > 0 ? bounds.h / totalNeeded : 1;
  const scaledItemH = itemH * scale;
  const scaledGap = itemGap * scale;
  const isOrdered = plan.props.ordered === true;
  const color =
    typeof plan.style.color === 'string' ? plan.style.color : sceneTheme.colors.text;

  const children: IRElement[] = items.map((item, i) => {
    const prefix = isOrdered ? `${i + 1}.` : '\u2022';
    return {
      id: `${plan.id}-item-${i}`,
      type: 'text',
      bounds: {
        x: bounds.x + 2,
        y: bounds.y + i * (scaledItemH + scaledGap),
        w: bounds.w - 4,
        h: Math.max(scaledItemH, 2),
      },
      style: {},
      content: `${prefix} ${item}`,
      fontSize: itemFontSize * scale,
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

function walkStat(
  plan: PlanNode,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRContainer {
  const color =
    typeof plan.style.color === 'string' ? plan.style.color : sceneTheme.colors.accent;
  const labelProp =
    typeof plan.props.label === 'string' ? (plan.props.label as string) : undefined;

  const valueH = labelProp ? bounds.h * 0.65 : bounds.h;
  const valueText: IRText = {
    id: `${plan.id}-value`,
    type: 'text',
    bounds: { x: bounds.x, y: bounds.y, w: bounds.w, h: valueH },
    style: buildIRStyle(plan.style),
    content: plan.label ?? '',
    fontSize: baseFontSize * sceneTheme.typography.statSize,
    color,
    fontWeight: 'bold',
    align: 'center',
    valign: 'middle',
    origin: { dslType: plan.elementType },
  };

  const children: IRElement[] = [valueText];

  if (labelProp) {
    children.push({
      id: `${plan.id}-label`,
      type: 'text',
      bounds: { x: bounds.x, y: bounds.y + valueH, w: bounds.w, h: bounds.h - valueH },
      style: {},
      content: labelProp,
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

function walkQuote(
  plan: PlanNode,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRText | IRContainer {
  const color =
    typeof plan.style.color === 'string' ? plan.style.color : sceneTheme.colors.primary;
  const attribution =
    typeof plan.props.attribution === 'string' ? (plan.props.attribution as string) : undefined;

  const quoteH = attribution ? bounds.h * 0.75 : bounds.h;
  const quoteText: IRText = {
    id: attribution ? `${plan.id}-text` : plan.id,
    type: 'text',
    bounds: { x: bounds.x, y: bounds.y, w: bounds.w, h: quoteH },
    style: buildIRStyle(plan.style),
    content: `\u201C${plan.label ?? ''}\u201D`,
    fontSize: baseFontSize * sceneTheme.typography.headingSize * 0.8,
    color,
    fontStyle: 'italic',
    align: 'center',
    valign: 'middle',
    origin: { dslType: plan.elementType },
  };

  if (!attribution) return quoteText;

  const attrText: IRText = {
    id: `${plan.id}-attribution`,
    type: 'text',
    bounds: { x: bounds.x, y: bounds.y + quoteH, w: bounds.w, h: bounds.h - quoteH },
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

// ---------------------------------------------------------------------------
// Step walker (단일 IRShape + innerText, PR-1 단순화)
// 향후: planAll이 step-marker / step-label / step-desc 자식 PlanNode를 생성하면 승격.
// ---------------------------------------------------------------------------

function walkStep(
  plan: PlanNode,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRShape {
  return {
    id: plan.id,
    type: 'shape',
    bounds,
    style: { fill: sceneTheme.colors.accent },
    shape: 'circle',
    innerText: {
      content: plan.label ?? '',
      color: sceneTheme.colors.background,
      fontSize: baseFontSize,
      fontWeight: 'bold',
      align: 'center',
      valign: 'middle',
    },
    origin: { dslType: plan.elementType },
  };
}

// ---------------------------------------------------------------------------
// Divider walker
// ---------------------------------------------------------------------------

function walkDivider(
  plan: PlanNode,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
): IRLine {
  const style = buildIRStyle(plan.style);
  if (!style.stroke) style.stroke = sceneTheme.colors.textMuted;
  if (style.strokeWidth === undefined) style.strokeWidth = 0.2;
  const y = bounds.y + bounds.h / 2;
  return {
    id: plan.id,
    type: 'line',
    bounds,
    style,
    from: { x: bounds.x, y },
    to: { x: bounds.x + bounds.w, y },
    origin: { dslType: plan.elementType },
  };
}

// ---------------------------------------------------------------------------
// Image walker
// ---------------------------------------------------------------------------

function walkImage(plan: PlanNode, bounds: IRBounds): IRElement {
  // src: plan.props.src 우선, 폴백 plan.label (scene DSL에서 src는 label로도 전달됨).
  const src =
    typeof plan.props.src === 'string' ? (plan.props.src as string) : (plan.label ?? '');
  return {
    id: plan.id,
    type: 'image',
    bounds,
    style: {},
    src,
    origin: { dslType: plan.elementType },
  };
}

// ---------------------------------------------------------------------------
// ShapeAsset walker
// ---------------------------------------------------------------------------

function walkShapeAsset(plan: PlanNode, bounds: IRBounds): IRShapeAsset {
  return {
    id: plan.id,
    type: 'shape-asset',
    bounds,
    style: {},
    shapeId: plan.label ?? '',
    label:
      typeof plan.props.label === 'string' ? (plan.props.label as string) : undefined,
    description:
      typeof plan.props.description === 'string'
        ? (plan.props.description as string)
        : undefined,
    origin: { dslType: plan.elementType },
  };
}

// ---------------------------------------------------------------------------
// Scene shape walker
// ---------------------------------------------------------------------------

function walkSceneShape(
  plan: PlanNode,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  shapeType: IRShapeType,
  baseFontSize?: number,
): IRShape {
  const style = buildIRStyle(plan.style);
  if (!style.fill) style.fill = sceneTheme.colors.background;
  if (!style.stroke) style.stroke = sceneTheme.colors.textMuted;
  const cornerRadius = extractCornerRadius(plan);
  const shape: IRShape = {
    id: plan.id,
    type: 'shape',
    bounds,
    style,
    shape: shapeType,
    origin: { dslType: plan.elementType },
  };
  if (cornerRadius !== undefined) shape.cornerRadius = cornerRadius;
  if (plan.label && baseFontSize !== undefined) {
    const color =
      typeof plan.style.color === 'string' ? plan.style.color : sceneTheme.colors.text;
    shape.innerText = {
      content: plan.label,
      color,
      fontSize: baseFontSize * sceneTheme.typography.bodySize,
      align: 'center',
      valign: 'middle',
    };
    if (plan.style['font-weight'] === 'bold') {
      shape.innerText.fontWeight = 'bold';
    }
  }
  return shape;
}
