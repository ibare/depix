/**
 * Chart Layout Algorithm (Bar Chart)
 *
 * Arranges bar chart elements within available bounds.
 * Each child represents a data bar — children are positioned
 * with equal width and height proportional to their input height value.
 *
 * Works in 0-100 relative coordinate space.
 */

import type { IRBounds } from '../../ir/types.js';
import type { LayoutChild, LayoutResult, ChartLayoutConfig } from './types.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function layoutChart(
  children: LayoutChild[],
  config: ChartLayoutConfig,
): LayoutResult {
  const { bounds, gap } = config;

  if (children.length === 0) {
    return { containerBounds: bounds, childBounds: [] };
  }

  // Reserve space for axis labels
  const axisMarginLeft = bounds.w * 0.08;
  const axisMarginBottom = bounds.h * 0.12;
  const plotBounds: IRBounds = {
    x: bounds.x + axisMarginLeft,
    y: bounds.y,
    w: bounds.w - axisMarginLeft,
    h: bounds.h - axisMarginBottom,
  };

  const totalGap = gap * Math.max(children.length - 1, 0);
  const barW = (plotBounds.w - totalGap) / children.length;

  // Find max height for scaling
  const maxH = Math.max(...children.map(c => c.height), 1);

  const childBounds: IRBounds[] = [];
  let curX = plotBounds.x;

  for (const child of children) {
    const scaledH = (child.height / maxH) * plotBounds.h;
    childBounds.push({
      x: curX,
      y: plotBounds.y + plotBounds.h - scaledH,
      w: barW,
      h: scaledH,
    });
    curX += barW + gap;
  }

  return { containerBounds: bounds, childBounds };
}
