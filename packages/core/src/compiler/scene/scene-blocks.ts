/**
 * Scene Emission — Block Emitters
 *
 * IR emitters for scene-level block structures:
 * column, box/layer, table.
 *
 * These emitters receive a `contentEmitter` callback to delegate child
 * emission back to the orchestrator, avoiding circular imports.
 */

import type {
  IRBounds,
  IRContainer,
  IRElement,
  IROrigin,
  IRStyle,
  IRText,
} from '../../ir/types.js';
import type { DepixTheme } from '../../theme/types.js';
import type { SceneTheme } from '../../theme/scene-theme.js';
import type { ASTBlock, ASTElement, ASTNode } from '../ast.js';
import { resolveElementStyle, resolveTextColor } from './scene-helpers.js';
import {
  LINE_HEIGHT_MULTIPLIER,
  adaptBaseFontSize,
  adaptBoxPadding,
  computeCompactHeights,
  computeFitScale,
  estimateContentHeight,
  estimateTextWidth,
} from './scene-measure.js';

// ---------------------------------------------------------------------------
// ContentEmitter callback type
// ---------------------------------------------------------------------------

/**
 * Callback type for emitting scene content nodes.
 * Passed by the orchestrator (emit-scene.ts) to break the circular
 * dependency between block emitters and emitSceneContent.
 */
export type ContentEmitter = (
  node: ASTNode,
  id: string,
  bounds: IRBounds,
  theme: DepixTheme,
  sceneTheme: SceneTheme,
  baseFontSize: number,
) => IRElement | null;

// ---------------------------------------------------------------------------
// Column
// ---------------------------------------------------------------------------

export function emitColumn(
  block: ASTBlock,
  id: string,
  bounds: IRBounds,
  theme: DepixTheme,
  sceneTheme: SceneTheme,
  baseFontSize: number,
  contentEmitter: ContentEmitter,
): IRContainer {
  const children: IRElement[] = [];
  const contentNodes = block.children.filter(c => c.kind !== 'edge');
  const gap = sceneTheme.layout.itemGap;
  const adaptedFontSize = adaptBaseFontSize(bounds.h, contentNodes, baseFontSize, gap, sceneTheme);
  const heights = computeCompactHeights(contentNodes, bounds.h, gap, adaptedFontSize, sceneTheme);

  let curY = bounds.y;
  for (let i = 0; i < contentNodes.length; i++) {
    const child = contentNodes[i];
    const childId = `${id}-child-${i}`;
    const h = Math.max(heights[i], 2);
    const childBounds: IRBounds = { x: bounds.x, y: curY, w: bounds.w, h };
    const el = contentEmitter(child, childId, childBounds, theme, sceneTheme, adaptedFontSize);
    if (el) children.push(el);
    curY += h + gap;
  }

  const origin: IROrigin = { sourceType: 'scene', sourceProps: { columnId: id } };

  return {
    id,
    type: 'container',
    bounds,
    style: {},
    children,
    origin,
  };
}

// ---------------------------------------------------------------------------
// Box / Layer
// ---------------------------------------------------------------------------

export function emitBoxBlock(
  block: ASTBlock,
  id: string,
  bounds: IRBounds,
  theme: DepixTheme,
  sceneTheme: SceneTheme,
  baseFontSize: number,
  contentEmitter: ContentEmitter,
): IRContainer {
  const children: IRElement[] = [];
  const contentNodes = block.children.filter(c => c.kind !== 'edge');
  const gap = sceneTheme.layout.itemGap;
  // Step 1: reduce padding when content height is tight
  const naturalContentH = contentNodes.reduce(
    (s, n) => s + estimateContentHeight(n, baseFontSize, sceneTheme), 0,
  ) + gap * Math.max(contentNodes.length - 1, 0);
  const padding = adaptBoxPadding(bounds.h, naturalContentH);
  const inner: IRBounds = {
    x: bounds.x + padding,
    y: bounds.y + padding,
    w: Math.max(bounds.w - padding * 2, 1),
    h: Math.max(bounds.h - padding * 2, 1),
  };

  // Zone label for layer blocks -- rendered top-left as a small category marker.
  let zoneLabelH = 0;
  if (block.blockType === 'layer' && block.label) {
    // 0.85 ~ body font * 85% -- conventional ratio for category label text.
    // Smaller than body content to distinguish zone label from main content.
    // Units: dimensionless ratio (font size multiplier).
    const zoneFontSize = baseFontSize * sceneTheme.typography.bodySize * 0.85;
    zoneLabelH = zoneFontSize * LINE_HEIGHT_MULTIPLIER;
    children.push({
      id: `${id}-zone-label`,
      type: 'text',
      bounds: { x: inner.x, y: inner.y, w: inner.w, h: zoneLabelH },
      style: {},
      content: block.label,
      fontSize: zoneFontSize,
      color: resolveTextColor(block.style, sceneTheme.colors.textMuted),
      align: 'left',
      valign: 'middle',
      origin: { sourceType: 'layer-zone-label' },
    } as IRText);
  }

  const innerAfterZone: IRBounds = {
    x: inner.x,
    y: inner.y + (zoneLabelH > 0 ? zoneLabelH + gap : 0),
    w: inner.w,
    h: Math.max(inner.h - (zoneLabelH > 0 ? zoneLabelH + gap : 0), 1),
  };

  const adaptedFontSize = adaptBaseFontSize(innerAfterZone.h, contentNodes, baseFontSize, gap, sceneTheme);
  const heights = computeCompactHeights(contentNodes, innerAfterZone.h, gap, adaptedFontSize, sceneTheme);

  let curY = innerAfterZone.y;
  for (let i = 0; i < contentNodes.length; i++) {
    const child = contentNodes[i];
    const childId = `${id}-child-${i}`;
    const h = Math.max(heights[i], 2);
    const childBounds: IRBounds = { x: innerAfterZone.x, y: curY, w: innerAfterZone.w, h };
    const el = contentEmitter(child, childId, childBounds, theme, sceneTheme, adaptedFontSize);
    if (el) children.push(el);
    curY += h + gap;
  }

  const containerStyle = resolveElementStyle(block);
  if (!containerStyle.stroke && !containerStyle.fill) {
    containerStyle.stroke = sceneTheme.colors.textMuted;
    containerStyle.strokeWidth = 0.3;
  }

  return {
    id,
    type: 'container',
    bounds,
    style: containerStyle,
    children,
    origin: { sourceType: 'box', dslType: block.blockType },
  };
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export function emitSceneTable(
  block: ASTBlock,
  id: string,
  bounds: IRBounds,
  _theme: DepixTheme,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRContainer {
  const children: IRElement[] = [];
  const rows = block.children.filter(
    (c): c is ASTElement => c.kind === 'element' && c.elementType === 'row',
  );

  if (rows.length === 0) {
    return { id, type: 'container', bounds, style: {}, children };
  }

  const gap = sceneTheme.layout.itemGap * 0.3;
  const rowH = (bounds.h - gap * Math.max(rows.length - 1, 0)) / rows.length;

  let curY = bounds.y;
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const isHeader = row.props.header === 1;
    const values = row.values ?? [];
    const colCount = Math.max(values.length, 1);
    const cellW = bounds.w / colCount;
    const rowBounds: IRBounds = { x: bounds.x, y: curY, w: bounds.w, h: rowH };
    const rowChildren: IRElement[] = [];

    for (let ci = 0; ci < values.length; ci++) {
      const cellBounds: IRBounds = {
        x: bounds.x + ci * cellW,
        y: curY,
        w: cellW,
        h: rowH,
      };

      // Cell background
      rowChildren.push({
        id: `${id}-r${ri}-c${ci}-bg`,
        type: 'shape',
        bounds: cellBounds,
        style: {
          fill: isHeader ? sceneTheme.colors.surface : sceneTheme.colors.background,
          stroke: sceneTheme.colors.textMuted,
          strokeWidth: 0.15,
        },
        shape: 'rect',
      });

      // Cell text
      const cellContent = String(values[ci]);
      const naturalCellFS = baseFontSize * sceneTheme.typography.bodySize * 0.9;
      const cellScale = computeFitScale(rowH, cellW - 1, naturalCellFS * LINE_HEIGHT_MULTIPLIER, estimateTextWidth(cellContent, naturalCellFS));
      const cellText: IRText = {
        id: `${id}-r${ri}-c${ci}-text`,
        type: 'text',
        bounds: {
          x: cellBounds.x + 0.5,
          y: cellBounds.y,
          w: cellBounds.w - 1,
          h: cellBounds.h,
        },
        style: {},
        content: cellContent,
        fontSize: naturalCellFS * cellScale,
        color: sceneTheme.colors.text,
        align: typeof values[ci] === 'number' ? 'right' : 'left',
        valign: 'middle',
      };
      if (isHeader) cellText.fontWeight = 'bold';
      rowChildren.push(cellText);
    }

    children.push({
      id: `${id}-row-${ri}`,
      type: 'container',
      bounds: rowBounds,
      style: {},
      children: rowChildren,
    } as IRContainer);

    curY += rowH + gap;
  }

  return { id, type: 'container', bounds, style: {}, children };
}
