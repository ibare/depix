/**
 * Scene Emission — Element Emitters
 *
 * Individual IR element emitters for scene content nodes:
 * heading, label, bullet, stat, quote, image, icon, step, divider, shape.
 */

import type {
  IRBounds,
  IRContainer,
  IRElement,
  IRLine,
  IRShape,
  IRText,
} from '../../ir/types.js';
import type { SceneTheme } from '../../theme/scene-theme.js';
import type { ASTElement } from '../ast.js';
import { getElementConfig } from '../element-type-registry.js';
import { resolveElementStyle, resolveTextColor } from './scene-helpers.js';
import {
  LINE_HEIGHT_MULTIPLIER,
  computeFitScale,
  estimateTextWidth,
} from './scene-measure.js';

// ---------------------------------------------------------------------------
// Heading
// ---------------------------------------------------------------------------

export function emitHeading(
  el: ASTElement,
  id: string,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRText {
  const level = typeof el.props.level === 'number' ? el.props.level : 1;
  const sizeMultiplier = level === 1 ? sceneTheme.typography.headingSize : sceneTheme.typography.headingSize * 0.7;
  const naturalFontSize = baseFontSize * sizeMultiplier;
  const text = el.label ?? '';
  const scale = computeFitScale(
    bounds.h, bounds.w,
    naturalFontSize * LINE_HEIGHT_MULTIPLIER,
    estimateTextWidth(text, naturalFontSize),
  );
  const fontSize = naturalFontSize * scale;

  return {
    id,
    type: 'text',
    bounds,
    style: resolveElementStyle(el),
    content: text,
    fontSize,
    color: resolveTextColor(el.style, sceneTheme.colors.primary),
    fontWeight: 'bold',
    align: 'center',
    valign: 'middle',
  };
}

// ---------------------------------------------------------------------------
// Label
// ---------------------------------------------------------------------------

export function emitLabel(
  el: ASTElement,
  id: string,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRText {
  const sizeStr = el.props.size;
  let sizeMultiplier = sceneTheme.typography.bodySize;
  if (sizeStr === 'sm') sizeMultiplier *= 0.8;
  if (sizeStr === 'lg') sizeMultiplier *= 1.2;
  const naturalFontSize = baseFontSize * sizeMultiplier;
  const text = el.label ?? '';
  const scale = computeFitScale(
    bounds.h, bounds.w,
    naturalFontSize * LINE_HEIGHT_MULTIPLIER,
    estimateTextWidth(text, naturalFontSize),
  );

  return {
    id,
    type: 'text',
    bounds,
    style: resolveElementStyle(el),
    content: text,
    fontSize: naturalFontSize * scale,
    color: resolveTextColor(el.style, sceneTheme.colors.textMuted),
    align: 'center',
    valign: 'middle',
  };
}

// ---------------------------------------------------------------------------
// Bullet / List
// ---------------------------------------------------------------------------

export function emitBullet(
  el: ASTElement,
  id: string,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRContainer {
  const children: IRElement[] = [];

  // Collect item labels from both sources:
  // - bullet: children with elementType 'item'
  // - list: items string array
  const itemLabels: string[] = [];
  const itemChildren = el.children.filter(
    (c): c is ASTElement => c.kind === 'element' && c.elementType === 'item',
  );
  if (itemChildren.length > 0) {
    for (const item of itemChildren) itemLabels.push(item.label ?? '');
  } else if (el.items && el.items.length > 0) {
    itemLabels.push(...el.items);
  }

  const gap = sceneTheme.layout.itemGap;
  const isOrdered = el.flags?.includes('ordered') ?? false;
  const naturalItemFontSize = baseFontSize * sceneTheme.typography.bodySize;
  const n = itemLabels.length;
  const longestLabel = itemLabels.reduce((a, b) => a.length > b.length ? a : b, '');
  const samplePrefix = isOrdered ? `${n}.` : '\u2022';
  const naturalH = n * naturalItemFontSize * LINE_HEIGHT_MULTIPLIER + gap * Math.max(n - 1, 0);
  const naturalW = estimateTextWidth(`${samplePrefix} ${longestLabel}`, naturalItemFontSize);
  const scale = computeFitScale(bounds.h, bounds.w - 4, naturalH, naturalW);
  const itemFontSize = naturalItemFontSize * scale;
  const itemContentH = itemFontSize * LINE_HEIGHT_MULTIPLIER;

  let curY = bounds.y;
  for (let i = 0; i < itemLabels.length; i++) {
    const prefix = isOrdered ? `${i + 1}.` : '\u2022';
    const itemBounds: IRBounds = { x: bounds.x + 2, y: curY, w: bounds.w - 4, h: Math.max(itemContentH, 2) };
    children.push({
      id: `${id}-item-${i}`,
      type: 'text',
      bounds: itemBounds,
      style: {},
      content: `${prefix} ${itemLabels[i]}`,
      fontSize: itemFontSize,
      color: resolveTextColor(el.style, sceneTheme.colors.text),
      align: 'left',
      valign: 'middle',
    } as IRText);
    curY += itemContentH + gap;
  }

  return {
    id,
    type: 'container',
    bounds,
    style: {},
    children,
    origin: { sourceType: 'bullet' as const },
  };
}

// ---------------------------------------------------------------------------
// Divider
// ---------------------------------------------------------------------------

export function emitSceneDivider(
  _el: ASTElement,
  id: string,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
): IRLine {
  const midY = bounds.y + bounds.h / 2;
  return {
    id,
    type: 'line',
    bounds,
    style: { stroke: sceneTheme.colors.textMuted, strokeWidth: 0.2 },
    from: { x: bounds.x, y: midY },
    to: { x: bounds.x + bounds.w, y: midY },
  } as IRLine;
}

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

export function emitSceneShape(
  el: ASTElement,
  id: string,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRShape {
  const naturalFontSize = baseFontSize * sceneTheme.typography.bodySize;
  const text = el.label ?? '';
  const scale = text
    ? computeFitScale(bounds.h, bounds.w, naturalFontSize * LINE_HEIGHT_MULTIPLIER, estimateTextWidth(text, naturalFontSize))
    : 1;
  const fontSize = naturalFontSize * scale;
  const shapeStyle = resolveElementStyle(el);
  if (!shapeStyle.fill) shapeStyle.fill = sceneTheme.colors.background;
  if (!shapeStyle.stroke) shapeStyle.stroke = sceneTheme.colors.textMuted;
  const cornerRadius = typeof el.style.radius === 'number' ? el.style.radius : undefined;
  return {
    id,
    type: 'shape',
    bounds,
    style: shapeStyle,
    shape: getElementConfig(el.elementType).emitShape ?? 'rect',
    cornerRadius,
    innerText: el.label ? {
      content: el.label,
      color: resolveTextColor(el.style, sceneTheme.colors.text),
      fontSize,
      align: 'center' as const,
      valign: 'middle' as const,
    } : undefined,
  } as IRShape;
}

// Compound emitters (multi-child containers) live in scene-elements-compound.ts
export { emitStat, emitQuote, emitImage, emitIcon } from './scene-elements-compound.js';

// ---------------------------------------------------------------------------
// Step
// ---------------------------------------------------------------------------

export function emitStep(
  el: ASTElement,
  id: string,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRContainer {
  const stepLabel = el.label ?? '';
  const stepDesc = typeof el.props.label === 'string' ? el.props.label : '';

  const naturalLabelFS = baseFontSize * sceneTheme.typography.bodySize * 1.2;
  const naturalDescFS = baseFontSize * sceneTheme.typography.bodySize;
  const gap = sceneTheme.layout.itemGap;
  const markerNaturalH = naturalLabelFS * LINE_HEIGHT_MULTIPLIER;
  const naturalTotalH = stepDesc
    ? markerNaturalH + naturalDescFS * LINE_HEIGHT_MULTIPLIER + gap * 2
    : markerNaturalH;
  const naturalW = Math.max(markerNaturalH, stepDesc ? estimateTextWidth(stepDesc, naturalDescFS) : 0);
  const scale = computeFitScale(bounds.h, bounds.w, naturalTotalH, naturalW);

  const labelFS = naturalLabelFS * scale;
  const descFS = naturalDescFS * scale;
  const markerH = labelFS * LINE_HEIGHT_MULTIPLIER;
  const descH = descFS * LINE_HEIGHT_MULTIPLIER;

  const children: IRElement[] = [
    {
      id: `${id}-marker`,
      type: 'shape',
      bounds: { x: bounds.x + (bounds.w - markerH) / 2, y: bounds.y + gap, w: markerH, h: markerH },
      style: { fill: sceneTheme.colors.accent },
      shape: 'circle',
    },
    {
      id: `${id}-label`,
      type: 'text',
      bounds: { x: bounds.x + (bounds.w - markerH) / 2, y: bounds.y + gap, w: markerH, h: markerH },
      style: {},
      content: stepLabel,
      fontSize: labelFS,
      color: sceneTheme.colors.background,
      fontWeight: 'bold',
      align: 'center',
      valign: 'middle',
    } as IRText,
  ];

  if (stepDesc) {
    children.push({
      id: `${id}-desc`,
      type: 'text',
      bounds: { x: bounds.x, y: bounds.y + gap + markerH + gap, w: bounds.w, h: descH },
      style: {},
      content: stepDesc,
      fontSize: descFS,
      color: resolveTextColor(el.style, sceneTheme.colors.text),
      align: 'center',
      valign: 'top',
    } as IRText);
  }

  return { id, type: 'container', bounds, style: {}, children };
}
