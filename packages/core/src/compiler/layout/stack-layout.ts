/**
 * Stack Layout Algorithm
 *
 * Flexbox-style sequential layout. Places children in a row or column
 * with configurable gap, cross-axis alignment, and optional wrapping.
 *
 * All coordinates are in the 0-100 relative space.
 */

import type { IRBounds } from '../../ir/types.js';
import type { LayoutChild, LayoutResult, StackLayoutConfig } from './types.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function layoutStack(
  children: LayoutChild[],
  config: StackLayoutConfig,
): LayoutResult {
  if (children.length === 0) {
    return {
      containerBounds: { ...config.bounds },
      childBounds: [],
    };
  }

  if (config.wrap) {
    return layoutWrapped(children, config);
  }

  return layoutSingle(children, config);
}

// ---------------------------------------------------------------------------
// Single-line layout (no wrap)
// ---------------------------------------------------------------------------

function layoutSingle(
  children: LayoutChild[],
  config: StackLayoutConfig,
): LayoutResult {
  const { bounds, direction, gap, align } = config;
  const isRow = direction === 'row';

  // Total main-axis size of children + gaps
  const totalMain = children.reduce(
    (sum, c) => sum + (isRow ? c.width : c.height),
    0,
  ) + gap * (children.length - 1);

  // Max cross-axis size
  const maxCross = Math.max(
    ...children.map((c) => (isRow ? c.height : c.width)),
  );

  // Container size
  const containerW = isRow ? Math.min(totalMain, bounds.w) : Math.min(maxCross, bounds.w);
  const containerH = isRow ? Math.min(maxCross, bounds.h) : Math.min(totalMain, bounds.h);

  const childBounds: IRBounds[] = [];
  let cursor = 0; // main-axis offset relative to bounds origin

  for (const child of children) {
    const mainSize = isRow ? child.width : child.height;
    const crossSize = isRow ? child.height : child.width;
    const crossAvail = isRow ? containerH : containerW;

    // Cross-axis position
    const crossOffset = computeCrossOffset(crossSize, crossAvail, align);

    if (isRow) {
      childBounds.push({
        x: bounds.x + cursor,
        y: bounds.y + crossOffset,
        w: child.width,
        h: align === 'stretch' ? containerH : child.height,
      });
    } else {
      childBounds.push({
        x: bounds.x + crossOffset,
        y: bounds.y + cursor,
        w: align === 'stretch' ? containerW : child.width,
        h: child.height,
      });
    }

    cursor += mainSize + gap;
  }

  return {
    containerBounds: {
      x: bounds.x,
      y: bounds.y,
      w: containerW,
      h: containerH,
    },
    childBounds,
  };
}

// ---------------------------------------------------------------------------
// Wrapped layout
// ---------------------------------------------------------------------------

function layoutWrapped(
  children: LayoutChild[],
  config: StackLayoutConfig,
): LayoutResult {
  const { bounds, direction, gap, align } = config;
  const isRow = direction === 'row';

  // Group children into lines that fit within bounds
  const lines: { children: LayoutChild[]; indices: number[] }[] = [];
  let currentLine: { children: LayoutChild[]; indices: number[] } = { children: [], indices: [] };
  let lineMain = 0;
  const mainMax = isRow ? bounds.w : bounds.h;

  children.forEach((child, idx) => {
    const mainSize = isRow ? child.width : child.height;
    const needed = currentLine.children.length > 0 ? lineMain + gap + mainSize : mainSize;

    if (needed > mainMax && currentLine.children.length > 0) {
      lines.push(currentLine);
      currentLine = { children: [child], indices: [idx] };
      lineMain = mainSize;
    } else {
      currentLine.children.push(child);
      currentLine.indices.push(idx);
      lineMain = needed;
    }
  });
  if (currentLine.children.length > 0) {
    lines.push(currentLine);
  }

  // Compute line cross sizes
  const lineCrossSizes = lines.map((line) =>
    Math.max(...line.children.map((c) => (isRow ? c.height : c.width))),
  );

  const totalCross = lineCrossSizes.reduce((a, b) => a + b, 0) + gap * (lines.length - 1);
  const containerW = isRow ? bounds.w : Math.min(totalCross, bounds.w);
  const containerH = isRow ? Math.min(totalCross, bounds.h) : bounds.h;

  const childBounds: IRBounds[] = new Array(children.length);
  let crossCursor = 0;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const lineCross = lineCrossSizes[li];
    let mainCursor = 0;

    for (let ci = 0; ci < line.children.length; ci++) {
      const child = line.children[ci];
      const idx = line.indices[ci];
      const mainSize = isRow ? child.width : child.height;
      const crossSize = isRow ? child.height : child.width;
      const crossOffset = computeCrossOffset(crossSize, lineCross, align);

      if (isRow) {
        childBounds[idx] = {
          x: bounds.x + mainCursor,
          y: bounds.y + crossCursor + crossOffset,
          w: child.width,
          h: align === 'stretch' ? lineCross : child.height,
        };
      } else {
        childBounds[idx] = {
          x: bounds.x + crossCursor + crossOffset,
          y: bounds.y + mainCursor,
          w: align === 'stretch' ? lineCross : child.width,
          h: child.height,
        };
      }

      mainCursor += mainSize + gap;
    }

    crossCursor += lineCross + gap;
  }

  return {
    containerBounds: {
      x: bounds.x,
      y: bounds.y,
      w: containerW,
      h: containerH,
    },
    childBounds,
  };
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function computeCrossOffset(
  childCross: number,
  availableCross: number,
  align: 'start' | 'center' | 'end' | 'stretch',
): number {
  switch (align) {
    case 'start':
    case 'stretch':
      return 0;
    case 'center':
      return (availableCross - childCross) / 2;
    case 'end':
      return availableCross - childCross;
  }
}
