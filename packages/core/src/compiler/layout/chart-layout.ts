/**
 * Chart Layout Algorithm (Bar / Line / Pie)
 *
 * Arranges chart elements within available bounds.
 * Supports bar, line, and pie chart position computation.
 *
 * Works in 0-100 relative coordinate space.
 */

import type { IRBounds } from '../../ir/types.js';
import type { LayoutChild, LayoutResult, ChartLayoutConfig } from './types.js';
import type { ASTBlock, ASTElement } from '../ast.js';

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
// Line chart position types
// ---------------------------------------------------------------------------

/** Line chart point position. */
export interface ChartPointPosition {
  center: { x: number; y: number };
  radius: number;
  labelBounds: IRBounds;
  category: string;
  value: number;
}

/** Line chart segment connecting two points. */
export interface ChartLineSegment {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

/** Line chart position result. */
export interface LineChartPositionResult {
  points: ChartPointPosition[];
  lines: ChartLineSegment[];
  axes: ChartAxisPositions;
  maxValue: number;
}

// ---------------------------------------------------------------------------
// Pie chart position types
// ---------------------------------------------------------------------------

/** Pie chart wedge position. */
export interface PieWedgePosition {
  pathD: string;
  labelCenter: { x: number; y: number };
  labelBounds: IRBounds;
  category: string;
  value: number;
  percentage: number;
}

/** Pie chart position result. */
export interface PieChartPositionResult {
  wedges: PieWedgePosition[];
  center: { x: number; y: number };
  radius: number;
  totalValue: number;
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

// ---------------------------------------------------------------------------
// Shared: compute axes from container bounds
// ---------------------------------------------------------------------------

function computeAxes(
  containerBounds: IRBounds,
  plotBounds: IRBounds,
  axisMarginLeft: number,
  maxVal: number,
): ChartAxisPositions {
  return {
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
}

function computePlotBounds(containerBounds: IRBounds): { plotBounds: IRBounds; axisMarginLeft: number; axisMarginBottom: number } {
  const axisMarginLeft = containerBounds.w * 0.08;
  const axisMarginBottom = containerBounds.h * 0.15;
  return {
    plotBounds: {
      x: containerBounds.x + axisMarginLeft,
      y: containerBounds.y,
      w: containerBounds.w - axisMarginLeft,
      h: containerBounds.h - axisMarginBottom,
    },
    axisMarginLeft,
    axisMarginBottom,
  };
}

// ---------------------------------------------------------------------------
// Line chart position computation
// ---------------------------------------------------------------------------

/**
 * Compute all element positions for a line chart.
 * Points are evenly distributed along the x-axis with y scaled by value.
 */
export function computeLineChartPositions(
  containerBounds: IRBounds,
  data: ChartDataPoint[],
): LineChartPositionResult {
  if (data.length === 0) {
    return {
      points: [],
      lines: [],
      axes: emptyAxes(containerBounds),
      maxValue: 0,
    };
  }

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const { plotBounds, axisMarginLeft, axisMarginBottom } = computePlotBounds(containerBounds);
  const axes = computeAxes(containerBounds, plotBounds, axisMarginLeft, maxVal);

  const pointRadius = Math.min(plotBounds.w, plotBounds.h) * 0.025;
  const segmentW = data.length > 1
    ? plotBounds.w / (data.length - 1)
    : plotBounds.w;

  const points: ChartPointPosition[] = data.map((d, i) => {
    const cx = data.length > 1
      ? plotBounds.x + i * segmentW
      : plotBounds.x + plotBounds.w / 2;
    const cy = plotBounds.y + plotBounds.h - (d.value / maxVal) * plotBounds.h;
    return {
      center: { x: cx, y: cy },
      radius: pointRadius,
      labelBounds: {
        x: cx - segmentW / 2,
        y: plotBounds.y + plotBounds.h + axisMarginBottom * 0.1,
        w: data.length > 1 ? segmentW : plotBounds.w,
        h: axisMarginBottom * 0.7,
      },
      category: d.category,
      value: d.value,
    };
  });

  const lines: ChartLineSegment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    lines.push({
      from: points[i].center,
      to: points[i + 1].center,
    });
  }

  return { points, lines, axes, maxValue: maxVal };
}

// ---------------------------------------------------------------------------
// Pie chart position computation
// ---------------------------------------------------------------------------

/**
 * Build SVG arc path data for a pie wedge.
 * Coordinates are absolute in the 0-100 space.
 */
function buildWedgePath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const sx = cx + r * Math.cos(startAngle);
  const sy = cy + r * Math.sin(startAngle);
  const ex = cx + r * Math.cos(endAngle);
  const ey = cy + r * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey} Z`;
}

/**
 * Compute all element positions for a pie chart.
 * Wedges are arranged as arcs proportional to each value.
 */
export function computePieChartPositions(
  containerBounds: IRBounds,
  data: ChartDataPoint[],
): PieChartPositionResult {
  const totalValue = data.reduce((sum, d) => sum + d.value, 0);

  if (data.length === 0 || totalValue === 0) {
    return {
      wedges: [],
      center: { x: containerBounds.x + containerBounds.w / 2, y: containerBounds.y + containerBounds.h / 2 },
      radius: 0,
      totalValue: 0,
    };
  }

  const cx = containerBounds.x + containerBounds.w / 2;
  const cy = containerBounds.y + containerBounds.h / 2;
  const radius = Math.min(containerBounds.w, containerBounds.h) * 0.35;
  const labelRadius = radius * 1.3;

  let currentAngle = -Math.PI / 2; // start at 12 o'clock

  const wedges: PieWedgePosition[] = data.map(d => {
    const sweepAngle = (d.value / totalValue) * Math.PI * 2;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sweepAngle;
    const midAngle = startAngle + sweepAngle / 2;

    const pathD = buildWedgePath(cx, cy, radius, startAngle, endAngle);
    const labelCx = cx + labelRadius * Math.cos(midAngle);
    const labelCy = cy + labelRadius * Math.sin(midAngle);
    const percentage = (d.value / totalValue) * 100;
    const labelW = containerBounds.w * 0.2;
    const labelH = containerBounds.h * 0.08;

    currentAngle = endAngle;

    return {
      pathD,
      labelCenter: { x: labelCx, y: labelCy },
      labelBounds: {
        x: labelCx - labelW / 2,
        y: labelCy - labelH / 2,
        w: labelW,
        h: labelH,
      },
      category: d.category,
      value: d.value,
      percentage,
    };
  });

  return { wedges, center: { x: cx, y: cy }, radius, totalValue };
}

// ---------------------------------------------------------------------------
// extractChartData — shared between diagram & scene pipelines
// ---------------------------------------------------------------------------

/**
 * Extract chart data points from an AST block's row children.
 * Pure data reading — no layout computation.
 */
export function extractChartData(block: ASTBlock): ChartDataPoint[] {
  const rows = block.children.filter(
    (c): c is ASTElement => c.kind === 'element' && c.elementType === 'row',
  );

  const headerRow = rows.find(r => r.props.header === 1);
  const dataRows = rows.filter(r => r.props.header !== 1);

  if (dataRows.length === 0) return [];

  const xCol = typeof block.props.x === 'string' ? block.props.x : undefined;
  const yCol = typeof block.props.y === 'string' ? block.props.y : undefined;
  const columns = headerRow?.values?.map(v => String(v)) ?? [];
  const xIdx = xCol ? columns.indexOf(xCol) : 0;
  const yIdx = yCol ? columns.indexOf(yCol) : columns.findIndex((_c, i) => {
    return i > 0 && dataRows.some(r => typeof r.values?.[i] === 'number');
  });
  const effectiveYIdx = yIdx >= 0 ? yIdx : 1;

  return dataRows.map(r => ({
    category: String(r.values?.[xIdx] ?? ''),
    value: typeof r.values?.[effectiveYIdx] === 'number' ? r.values[effectiveYIdx] as number : 0,
  }));
}
