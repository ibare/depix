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
// Chart position result (for emit-ir to consume)
// ---------------------------------------------------------------------------

/** Data point for chart position computation. */
export interface ChartDataPoint {
  category: string;
  value: number;
}

/** Pre-computed bar position with associated label bounds. */
export interface ChartBarPosition {
  barBounds: IRBounds;
  labelBounds: IRBounds;
  category: string;
  value: number;
}

/** Pre-computed axis and scale label positions. */
export interface ChartAxisPositions {
  yAxis: { from: { x: number; y: number }; to: { x: number; y: number }; bounds: IRBounds };
  xAxis: { from: { x: number; y: number }; to: { x: number; y: number }; bounds: IRBounds };
  yLabelMax: { bounds: IRBounds; content: string };
  yLabelZero: { bounds: IRBounds };
}

/** Complete chart position result — all bounds pre-computed. */
export interface ChartPositionResult {
  bars: ChartBarPosition[];
  axes: ChartAxisPositions;
  maxValue: number;
}

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

// ---------------------------------------------------------------------------
// Chart position computation (for emit-ir)
// ---------------------------------------------------------------------------

/**
 * Compute all element positions for a bar chart.
 *
 * This separates layout computation from IR generation:
 * - This function computes positions (layout concern)
 * - emit-ir uses the result to create IR elements (generation concern)
 */
export function computeChartPositions(
  containerBounds: IRBounds,
  data: ChartDataPoint[],
): ChartPositionResult {
  if (data.length === 0) {
    return {
      bars: [],
      axes: emptyAxes(containerBounds),
      maxValue: 0,
    };
  }

  const maxVal = Math.max(...data.map(d => d.value), 1);

  // Chart area with margins for axes
  const axisMarginLeft = containerBounds.w * 0.08;
  const axisMarginBottom = containerBounds.h * 0.15;
  const plotBounds: IRBounds = {
    x: containerBounds.x + axisMarginLeft,
    y: containerBounds.y,
    w: containerBounds.w - axisMarginLeft,
    h: containerBounds.h - axisMarginBottom,
  };

  // Axes
  const axes: ChartAxisPositions = {
    yAxis: {
      from: { x: plotBounds.x, y: plotBounds.y },
      to: { x: plotBounds.x, y: plotBounds.y + plotBounds.h },
      bounds: { x: plotBounds.x, y: plotBounds.y, w: 0, h: plotBounds.h },
    },
    xAxis: {
      from: { x: plotBounds.x, y: plotBounds.y + plotBounds.h },
      to: { x: plotBounds.x + plotBounds.w, y: plotBounds.y + plotBounds.h },
      bounds: { x: plotBounds.x, y: plotBounds.y + plotBounds.h, w: plotBounds.w, h: 0 },
    },
    yLabelMax: {
      bounds: { x: containerBounds.x, y: plotBounds.y, w: axisMarginLeft * 0.9, h: plotBounds.h * 0.1 },
      content: String(maxVal),
    },
    yLabelZero: {
      bounds: { x: containerBounds.x, y: plotBounds.y + plotBounds.h * 0.9, w: axisMarginLeft * 0.9, h: plotBounds.h * 0.1 },
    },
  };

  // Bars and labels
  const barGap = plotBounds.w * 0.05;
  const totalGap = barGap * Math.max(data.length - 1, 0);
  const barW = (plotBounds.w - totalGap) / data.length;

  const bars: ChartBarPosition[] = [];
  let curX = plotBounds.x;

  for (const point of data) {
    const barH = (point.value / maxVal) * plotBounds.h;
    bars.push({
      barBounds: {
        x: curX,
        y: plotBounds.y + plotBounds.h - barH,
        w: barW,
        h: barH,
      },
      labelBounds: {
        x: curX,
        y: plotBounds.y + plotBounds.h + axisMarginBottom * 0.1,
        w: barW,
        h: axisMarginBottom * 0.7,
      },
      category: point.category,
      value: point.value,
    });
    curX += barW + barGap;
  }

  return { bars, axes, maxValue: maxVal };
}

function emptyAxes(bounds: IRBounds): ChartAxisPositions {
  return {
    yAxis: { from: { x: bounds.x, y: bounds.y }, to: { x: bounds.x, y: bounds.y }, bounds: { x: bounds.x, y: bounds.y, w: 0, h: 0 } },
    xAxis: { from: { x: bounds.x, y: bounds.y }, to: { x: bounds.x, y: bounds.y }, bounds: { x: bounds.x, y: bounds.y, w: 0, h: 0 } },
    yLabelMax: { bounds: { x: bounds.x, y: bounds.y, w: 0, h: 0 }, content: '0' },
    yLabelZero: { bounds: { x: bounds.x, y: bounds.y, w: 0, h: 0 } },
  };
}
