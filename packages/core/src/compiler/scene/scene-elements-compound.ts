/**
 * Scene Emission — Compound Element Emitters
 *
 * IR emitters for compound scene elements that produce multi-child containers:
 * stat, quote, image, icon, step.
 *
 * Split from scene-elements.ts for file size management.
 */

import type {
  IRBounds,
  IRContainer,
  IRElement,
  IRText,
} from '../../ir/types.js';
import type { SceneTheme } from '../../theme/scene-theme.js';
import type { ASTElement } from '../ast.js';
import { resolveTextColor } from './scene-helpers.js';
import {
  LINE_HEIGHT_MULTIPLIER,
  computeFitScale,
  estimateTextWidth,
} from './scene-measure.js';

// ---------------------------------------------------------------------------
// Stat
// ---------------------------------------------------------------------------

export function emitStat(
  el: ASTElement,
  id: string,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRContainer {
  const statValue = el.label ?? '';
  const statLabel = typeof el.props.label === 'string' ? el.props.label : '';
  const statColor = resolveTextColor(el.style, sceneTheme.colors.accent);

  const naturalValueFS = baseFontSize * sceneTheme.typography.statSize;
  const naturalLabelFS = baseFontSize * sceneTheme.typography.bodySize;
  const gap = sceneTheme.layout.itemGap;
  const naturalTotalH = (naturalValueFS + naturalLabelFS) * LINE_HEIGHT_MULTIPLIER + gap;
  const naturalW = estimateTextWidth(statValue || '0', naturalValueFS);
  const scale = computeFitScale(bounds.h, bounds.w, naturalTotalH, naturalW);

  const valueFontSize = naturalValueFS * scale;
  const labelFontSize = naturalLabelFS * scale;
  const valueH = valueFontSize * LINE_HEIGHT_MULTIPLIER;
  const labelH = labelFontSize * LINE_HEIGHT_MULTIPLIER;
  const startY = bounds.y + (bounds.h - valueH - labelH - gap) / 2;

  const children: IRElement[] = [
    {
      id: `${id}-value`,
      type: 'text',
      bounds: { x: bounds.x, y: startY, w: bounds.w, h: valueH },
      style: {},
      content: statValue,
      fontSize: valueFontSize,
      color: statColor,
      fontWeight: 'bold',
      align: 'center',
      valign: 'middle',
    } as IRText,
    {
      id: `${id}-label`,
      type: 'text',
      bounds: { x: bounds.x, y: startY + valueH + gap, w: bounds.w, h: labelH },
      style: {},
      content: statLabel,
      fontSize: labelFontSize,
      color: sceneTheme.colors.textMuted,
      align: 'center',
      valign: 'top',
    } as IRText,
  ];

  return {
    id,
    type: 'container',
    bounds,
    style: {},
    children,
  };
}

// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------

export function emitQuote(
  el: ASTElement,
  id: string,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRContainer {
  const quoteText = el.label ?? '';
  const attribution = typeof el.props.attribution === 'string' ? el.props.attribution : '';

  const naturalQuoteFS = baseFontSize * sceneTheme.typography.headingSize * 0.8;
  const naturalAttrFS = baseFontSize * sceneTheme.typography.bodySize;
  const gap = sceneTheme.layout.itemGap;
  const naturalTotalH = attribution
    ? (naturalQuoteFS + naturalAttrFS) * LINE_HEIGHT_MULTIPLIER + gap
    : naturalQuoteFS * LINE_HEIGHT_MULTIPLIER;
  const naturalW = estimateTextWidth(quoteText, naturalQuoteFS);
  const scale = computeFitScale(bounds.h, bounds.w, naturalTotalH, naturalW);

  const quoteFontSize = naturalQuoteFS * scale;
  const attrFontSize = naturalAttrFS * scale;
  const quoteH = quoteFontSize * LINE_HEIGHT_MULTIPLIER;
  const attrH = attrFontSize * LINE_HEIGHT_MULTIPLIER;

  const children: IRElement[] = [
    {
      id: `${id}-text`,
      type: 'text',
      bounds: { x: bounds.x, y: bounds.y, w: bounds.w, h: quoteH },
      style: {},
      content: `\u201C${quoteText}\u201D`,
      fontSize: quoteFontSize,
      color: resolveTextColor(el.style, sceneTheme.colors.primary),
      fontStyle: 'italic',
      align: 'center',
      valign: 'middle',
    } as IRText,
  ];

  if (attribution) {
    children.push({
      id: `${id}-attr`,
      type: 'text',
      bounds: { x: bounds.x, y: bounds.y + quoteH + gap, w: bounds.w, h: attrH },
      style: {},
      content: `\u2014 ${attribution}`,
      fontSize: attrFontSize,
      color: sceneTheme.colors.textMuted,
      align: 'center',
      valign: 'top',
    } as IRText);
  }

  return {
    id,
    type: 'container',
    bounds,
    style: {},
    children,
  };
}

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

export function emitImage(
  el: ASTElement,
  id: string,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRContainer {
  const src = el.label ?? '';
  const alt = typeof el.props.alt === 'string' ? el.props.alt : src;
  const labelW = bounds.w - 4;
  const labelH = bounds.h * 0.2;
  const naturalLabelFS = baseFontSize * sceneTheme.typography.bodySize * 0.8;
  const labelScale = computeFitScale(labelH, labelW, naturalLabelFS * LINE_HEIGHT_MULTIPLIER, estimateTextWidth(alt, naturalLabelFS));

  const children: IRElement[] = [
    {
      id: `${id}-bg`,
      type: 'shape',
      bounds: { ...bounds },
      style: { fill: sceneTheme.colors.surface },
      shape: 'rect',
    },
    {
      id: `${id}-label`,
      type: 'text',
      bounds: { x: bounds.x + 2, y: bounds.y + bounds.h * 0.4, w: labelW, h: labelH },
      style: {},
      content: alt,
      fontSize: naturalLabelFS * labelScale,
      color: sceneTheme.colors.textMuted,
      align: 'center',
      valign: 'middle',
    } as IRText,
  ];

  return { id, type: 'container', bounds, style: {}, children };
}

// ---------------------------------------------------------------------------
// Icon
// ---------------------------------------------------------------------------

export function emitIcon(
  el: ASTElement,
  id: string,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRContainer {
  const iconSymbol = el.label ?? '';
  const iconLabel = typeof el.props.label === 'string' ? el.props.label : '';
  const iconDesc = typeof el.props.description === 'string' ? el.props.description : '';

  const naturalSymbolFS = baseFontSize * sceneTheme.typography.statSize;
  const naturalLabelFS = baseFontSize * sceneTheme.typography.bodySize * 1.1;
  const naturalDescFS = baseFontSize * sceneTheme.typography.bodySize * 0.85;
  const gap = sceneTheme.layout.itemGap;
  const partsCount = 1 + (iconLabel ? 1 : 0) + (iconDesc ? 1 : 0);
  const naturalTotalH = (
    naturalSymbolFS * LINE_HEIGHT_MULTIPLIER
    + (iconLabel ? naturalLabelFS * LINE_HEIGHT_MULTIPLIER : 0)
    + (iconDesc ? naturalDescFS * LINE_HEIGHT_MULTIPLIER : 0)
    + gap * Math.max(partsCount - 1, 0)
  );
  const longestText = [iconSymbol, iconLabel, iconDesc].reduce((a, b) => a.length > b.length ? a : b, '');
  const naturalW = estimateTextWidth(longestText, naturalSymbolFS);
  const scale = computeFitScale(bounds.h, bounds.w, naturalTotalH, naturalW);

  const symbolFS = naturalSymbolFS * scale;
  const labelFS = naturalLabelFS * scale;
  const descFS = naturalDescFS * scale;
  const iconH = symbolFS * LINE_HEIGHT_MULTIPLIER;
  const labelH = labelFS * LINE_HEIGHT_MULTIPLIER;
  const descH = descFS * LINE_HEIGHT_MULTIPLIER;

  const children: IRElement[] = [
    {
      id: `${id}-symbol`,
      type: 'text',
      bounds: { x: bounds.x, y: bounds.y + gap, w: bounds.w, h: iconH },
      style: {},
      content: iconSymbol,
      fontSize: symbolFS,
      color: resolveTextColor(el.style, sceneTheme.colors.accent),
      align: 'center',
      valign: 'middle',
    } as IRText,
  ];

  if (iconLabel) {
    children.push({
      id: `${id}-label`,
      type: 'text',
      bounds: { x: bounds.x, y: bounds.y + gap + iconH + gap, w: bounds.w, h: labelH },
      style: {},
      content: iconLabel,
      fontSize: labelFS,
      color: sceneTheme.colors.text,
      fontWeight: 'bold',
      align: 'center',
      valign: 'middle',
    } as IRText);
  }

  if (iconDesc) {
    children.push({
      id: `${id}-desc`,
      type: 'text',
      bounds: { x: bounds.x + bounds.w * 0.05, y: bounds.y + gap + iconH + gap + labelH + gap, w: bounds.w * 0.9, h: descH },
      style: {},
      content: iconDesc,
      fontSize: descFS,
      color: sceneTheme.colors.textMuted,
      align: 'center',
      valign: 'top',
    } as IRText);
  }

  return { id, type: 'container', bounds, style: {}, children };
}
