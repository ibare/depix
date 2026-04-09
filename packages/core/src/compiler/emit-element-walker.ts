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
 *   - compound element(stat/quote/bullet)의 sub-bounds는 BoundsMap에서 조회한다.
 *     plan-all-element.ts가 합성한 자식 PlanNode의 ID로 BoundsMap을 lookup.
 */

import type {
  IRBounds,
  IRElement,
  IRLine,
  IRShape,
  IRShapeAsset,
  IRShapeType,
  IRText,
} from '../ir/types.js';
import type { DepixTheme } from '../theme/types.js';
import type { SceneTheme } from '../theme/scene-theme.js';
import type { BoundsMap } from './passes/allocate-bounds.js';
import type { MeasureMap } from './passes/measure.js';
import type { PlanNode } from './layout/plan-types.js';
import { buildIRStyle, extractCornerRadius } from './emit-helpers.js';
import { getElementConfig } from './element-type-registry.js';
import { walkBullet, walkStat, walkQuote } from './emit-compound-walker.js';

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
  boundsMap?: BoundsMap,
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
      return walkBullet(plan, bounds, sceneTheme, baseFontSize, boundsMap);
    case 'stat':
      return walkStat(plan, bounds, sceneTheme, baseFontSize, boundsMap);
    case 'quote':
      return walkQuote(plan, bounds, sceneTheme, baseFontSize, boundsMap);
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
