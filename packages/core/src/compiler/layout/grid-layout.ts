/**
 * Grid Layout Algorithm
 *
 * CSS Grid-style layout. Arranges children in rows with a fixed
 * number of columns. Column widths are equal; row heights adapt
 * to the tallest child in each row.
 *
 * All coordinates are in the 0-100 relative space.
 */

import type { IRBounds } from '../../ir/types.js';
import type { GridLayoutConfig, LayoutChild, LayoutResult } from './types.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function layoutGrid(
  children: LayoutChild[],
  config: GridLayoutConfig,
): LayoutResult {
  const { bounds, cols, gap } = config;

  if (children.length === 0 || cols <= 0) {
    return {
      containerBounds: { ...bounds },
      childBounds: [],
    };
  }

  const effectiveCols = Math.min(cols, children.length);
  const rows = Math.ceil(children.length / effectiveCols);

  // Column width: available width minus gaps, divided equally
  const totalGapX = gap * (effectiveCols - 1);
  const colWidth = (bounds.w - totalGapX) / effectiveCols;

  // Compute row heights (max child height in each row)
  const rowHeights: number[] = [];
  for (let r = 0; r < rows; r++) {
    let maxH = 0;
    for (let c = 0; c < effectiveCols; c++) {
      const idx = r * effectiveCols + c;
      if (idx < children.length) {
        maxH = Math.max(maxH, children[idx].height);
      }
    }
    rowHeights.push(maxH);
  }

  const totalGapY = gap * (rows - 1);
  const totalHeight = rowHeights.reduce((a, b) => a + b, 0) + totalGapY;

  // Position each child
  const childBounds: IRBounds[] = [];
  let yOffset = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < effectiveCols; c++) {
      const idx = r * effectiveCols + c;
      if (idx >= children.length) break;

      childBounds.push({
        x: bounds.x + c * (colWidth + gap),
        y: bounds.y + yOffset,
        w: colWidth,
        h: rowHeights[r],
      });
    }
    yOffset += rowHeights[r] + gap;
  }

  return {
    containerBounds: {
      x: bounds.x,
      y: bounds.y,
      w: bounds.w,
      h: Math.min(totalHeight, bounds.h),
    },
    childBounds,
  };
}
