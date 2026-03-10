/**
 * Table Layout Algorithm
 *
 * Arranges row children into a table grid.
 * - Header row(s) get a fixed height proportion.
 * - Data rows share the remaining space equally.
 * - All rows span the full width of the container.
 *
 * Works in 0-100 relative coordinate space.
 */

import type { IRBounds } from '../../ir/types.js';
import type { LayoutChild, LayoutResult, TableLayoutConfig } from './types.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function layoutTable(
  children: LayoutChild[],
  config: TableLayoutConfig,
): LayoutResult {
  const { bounds, headerRows, gap } = config;

  if (children.length === 0) {
    return { containerBounds: bounds, childBounds: [] };
  }

  const totalGap = gap * Math.max(children.length - 1, 0);
  const usableH = bounds.h - totalGap;

  // Header rows get 15% more height than data rows
  const headerCount = Math.min(headerRows, children.length);
  const dataCount = children.length - headerCount;
  const headerWeight = 1.15;
  const totalWeight = headerCount * headerWeight + dataCount;
  const unitH = usableH / totalWeight;
  const headerH = unitH * headerWeight;
  const dataH = unitH;

  const childBounds: IRBounds[] = [];
  let curY = bounds.y;

  for (let i = 0; i < children.length; i++) {
    const h = i < headerCount ? headerH : dataH;
    childBounds.push({
      x: bounds.x,
      y: curY,
      w: bounds.w,
      h,
    });
    curY += h + gap;
  }

  return { containerBounds: bounds, childBounds };
}
