/**
 * Emit IR — Element Emitters
 *
 * Leaf-level emitters for individual element types:
 * shape, text, list, divider, image, row.
 *
 * These functions produce IRElement nodes and do NOT recurse
 * back into block-level emission (emitShapeWithChildren handles
 * that case and lives in emit-ir-blocks.ts).
 */

import type {
  IRBounds,
  IRContainer,
  IRElement,
  IRImage,
  IRLine,
  IRShape,
  IRShapeType,
  IRText,
} from '../../ir/types.js';
import type { DepixTheme } from '../../theme/types.js';
import type { ASTElement } from '../ast.js';
import type { ScaleContext } from './scale-system.js';
import { computeFontSize } from './scale-system.js';
import type { MeasureResult } from './measure.js';
import { buildStyle, buildInnerText, extractCornerRadius } from './emit-ir-helpers.js';

// ---------------------------------------------------------------------------
// Shape element (node, rect, circle, badge, icon)
// ---------------------------------------------------------------------------

/**
 * Emit a shape element without handling nested children.
 * When element.children is non-empty, the caller (emitElement in
 * emit-ir-blocks.ts) is responsible for wrapping via emitShapeWithChildren.
 */
export function emitShapeElement(
  element: ASTElement,
  id: string,
  bounds: IRBounds,
  defaultShape: IRShapeType,
  theme: DepixTheme,
  scaleCtx?: ScaleContext,
  measured?: MeasureResult,
): IRShape {
  const shapeType = (element.props.shape as IRShapeType) ?? defaultShape;
  const style = buildStyle(element.style);
  const cornerRadius = extractCornerRadius(element);

  const shape: IRShape = {
    id,
    type: 'shape',
    bounds,
    style,
    shape: shapeType,
  };

  if (cornerRadius !== undefined) {
    shape.cornerRadius = cornerRadius;
  }

  if (element.label) {
    shape.innerText = buildInnerText(element, theme, bounds, scaleCtx, measured);
  }

  return shape;
}

// ---------------------------------------------------------------------------
// Text element (label, text, heading)
// ---------------------------------------------------------------------------

export function emitTextElement(
  element: ASTElement,
  id: string,
  bounds: IRBounds,
  theme: DepixTheme,
  scaleCtx?: ScaleContext,
  measured?: MeasureResult,
  fontScale = 1,
): IRText {
  const style = buildStyle(element.style);
  const baseFontSize = measured
    ? measured.fontSize
    : (typeof element.style['font-size'] === 'number'
      ? element.style['font-size']
      : scaleCtx ? computeFontSize(Math.min(bounds.w, bounds.h), 'standaloneText') : theme.fontSize.md);
  const fontSize = baseFontSize * fontScale;
  const color = typeof element.style.color === 'string'
    ? element.style.color
    : theme.foreground;

  const text: IRText = {
    id,
    type: 'text',
    bounds,
    style,
    content: element.label ?? '',
    fontSize,
    color,
  };

  if (fontScale > 1) text.fontWeight = 'bold';
  if (element.flags.includes('bold')) text.fontWeight = 'bold';
  if (element.flags.includes('italic')) text.fontStyle = 'italic';
  if (element.style.align) text.align = element.style.align as IRText['align'];

  return text;
}

// ---------------------------------------------------------------------------
// List element
// ---------------------------------------------------------------------------

export function emitListElement(
  element: ASTElement,
  id: string,
  bounds: IRBounds,
  theme: DepixTheme,
  scaleCtx?: ScaleContext,
  measured?: MeasureResult,
): IRContainer {
  const style = buildStyle(element.style);
  const items = element.items ?? [];
  const fontSize = measured
    ? measured.fontSize
    : (typeof element.style['font-size'] === 'number'
      ? element.style['font-size']
      : scaleCtx ? computeFontSize(Math.min(bounds.w, bounds.h), 'listItem') : theme.fontSize.sm);
  // 0.3: gap between list items = 30% of font size (compact spacing)
  const itemGap = measured ? measured.childGap : (fontSize * 0.3);
  // 1.8: each item row height = font size × 1.8 (line-height + vertical padding)
  const itemHeight = fontSize * 1.8;
  // Distribute items using measured height or fallback to even distribution
  const totalNeeded = items.length > 0
    ? items.length * itemHeight + (items.length - 1) * itemGap
    : itemHeight;
  const scale = totalNeeded > bounds.h ? bounds.h / totalNeeded : 1;
  const scaledItemH = itemHeight * scale;
  const scaledGap = itemGap * scale;

  const children: IRElement[] = items.map((item, i) => ({
    id: `${id}-item-${i}`,
    type: 'text' as const,
    bounds: {
      x: bounds.x + 1,
      y: bounds.y + i * (scaledItemH + scaledGap),
      w: bounds.w - 2,
      h: scaledItemH,
    },
    style: {},
    content: `• ${item}`,
    fontSize,
    color: theme.foreground,
  }));

  return { id, type: 'container', bounds, style, children, origin: { sourceType: 'list' } };
}

// ---------------------------------------------------------------------------
// Divider / line element
// ---------------------------------------------------------------------------

export function emitDividerElement(
  element: ASTElement,
  id: string,
  bounds: IRBounds,
): IRLine {
  const style = buildStyle(element.style);
  if (!style.stroke) style.stroke = '#e5e7eb';
  // 0.2: hairline divider thickness in relative coordinate units
  if (!style.strokeWidth) style.strokeWidth = 0.2;

  return {
    id,
    type: 'line',
    bounds,
    style,
    from: { x: bounds.x, y: bounds.y + bounds.h / 2 },
    to: { x: bounds.x + bounds.w, y: bounds.y + bounds.h / 2 },
  };
}

// ---------------------------------------------------------------------------
// Image element
// ---------------------------------------------------------------------------

export function emitImageElement(
  element: ASTElement,
  id: string,
  bounds: IRBounds,
): IRImage {
  const style = buildStyle(element.style);
  const src = typeof element.props.src === 'string' ? element.props.src : '';

  return {
    id,
    type: 'image',
    bounds,
    style,
    src,
  };
}

// ---------------------------------------------------------------------------
// Row element (table row with cells)
// ---------------------------------------------------------------------------

export function emitRowElement(
  element: ASTElement,
  id: string,
  bounds: IRBounds,
  theme: DepixTheme,
  scaleCtx?: ScaleContext,
  measured?: MeasureResult,
): IRContainer {
  const values = element.values ?? [];
  const isHeader = element.props.header === 1;
  const colCount = Math.max(values.length, 1);
  const cellW = bounds.w / colCount;
  const fontSize = measured
    ? measured.fontSize
    : (scaleCtx ? computeFontSize(Math.min(bounds.w, bounds.h), 'listItem') : theme.fontSize.sm);

  const children: IRElement[] = [];

  for (let i = 0; i < values.length; i++) {
    const cellBounds: IRBounds = {
      x: bounds.x + i * cellW,
      y: bounds.y,
      w: cellW,
      h: bounds.h,
    };

    // Cell background
    const cellBg: IRShape = {
      id: `${id}-cell-${i}-bg`,
      type: 'shape',
      bounds: cellBounds,
      style: {
        fill: isHeader ? theme.colors.muted : theme.background,
        stroke: theme.border,
        // 0.15: thin table cell border in relative units
        strokeWidth: 0.15,
      },
      shape: 'rect',
    };
    children.push(cellBg);

    // Cell text
    const cellText: IRText = {
      id: `${id}-cell-${i}-text`,
      type: 'text',
      bounds: {
        // 0.5: horizontal padding inside table cells
        x: cellBounds.x + 0.5,
        y: cellBounds.y,
        w: cellBounds.w - 1,
        h: cellBounds.h,
      },
      style: {},
      content: String(values[i]),
      fontSize,
      color: theme.foreground,
      align: typeof values[i] === 'number' ? 'right' : 'left',
      valign: 'middle',
    };
    if (isHeader) cellText.fontWeight = 'bold';
    children.push(cellText);
  }

  return { id, type: 'container', bounds, style: {}, children };
}
