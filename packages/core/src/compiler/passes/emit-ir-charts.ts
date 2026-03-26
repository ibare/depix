/**
 * Emit IR — Chart Block Emission
 *
 * Handles bar, line, and pie chart rendering into IR elements.
 * Chart blocks produce containers with axes, data shapes, and labels.
 */

import type {
  IRBounds,
  IRContainer,
  IRElement,
  IRLine,
  IRPath,
  IRShape,
  IRText,
} from '../../ir/types.js';
import type { DepixTheme } from '../../theme/types.js';
import type { ASTBlock } from '../ast.js';
import { generateId } from '../../ir/utils.js';
import type { ScaleContext } from './scale-system.js';
import { computeFontSize } from './scale-system.js';
import {
  computeChartPositions,
  computeLineChartPositions,
  computePieChartPositions,
  extractChartData,
} from '../layout/chart-layout.js';
import { getChartColor } from '../layout/chart-colors.js';

// ---------------------------------------------------------------------------
// Chart block entry point
// ---------------------------------------------------------------------------

export function emitChartBlock(
  block: ASTBlock,
  id: string,
  bounds: IRBounds,
  theme: DepixTheme,
  scaleCtx?: ScaleContext,
): IRContainer {
  const children: IRElement[] = [];
  const data = extractChartData(block);

  if (data.length === 0) {
    return {
      id, type: 'container', bounds, style: {}, children,
      origin: { sourceType: 'chart', sourceProps: { ...block.props } },
    };
  }

  const chartType = typeof block.props.type === 'string' ? block.props.type : 'bar';

  switch (chartType) {
    case 'line':
      emitLineChart(children, id, bounds, data, theme, scaleCtx);
      break;
    case 'pie':
      emitPieChart(children, id, bounds, data, theme, scaleCtx);
      break;
    default: // 'bar'
      emitBarChart(children, id, bounds, data, theme, scaleCtx);
      break;
  }

  return {
    id,
    type: 'container',
    bounds,
    style: {},
    children,
    origin: { sourceType: 'chart', sourceProps: { ...block.props } },
  };
}

// ---------------------------------------------------------------------------
// Chart axes (shared by bar and line charts)
// ---------------------------------------------------------------------------

function emitChartAxes(
  children: IRElement[],
  id: string,
  axes: { yAxis: { from: { x: number; y: number }; to: { x: number; y: number }; bounds: IRBounds }; xAxis: { from: { x: number; y: number }; to: { x: number; y: number }; bounds: IRBounds }; yLabelMax: { bounds: IRBounds; content: string }; yLabelZero: { bounds: IRBounds } },
  theme: DepixTheme,
  fontSize: number,
): void {
  children.push({
    id: `${id}-y-axis`, type: 'line', bounds: axes.yAxis.bounds,
    style: { stroke: theme.border, strokeWidth: 0.2 },
    from: axes.yAxis.from, to: axes.yAxis.to,
  } as IRLine);

  children.push({
    id: `${id}-x-axis`, type: 'line', bounds: axes.xAxis.bounds,
    style: { stroke: theme.border, strokeWidth: 0.2 },
    from: axes.xAxis.from, to: axes.xAxis.to,
  } as IRLine);

  children.push({
    id: `${id}-ylabel-max`, type: 'text', bounds: axes.yLabelMax.bounds,
    style: {}, content: axes.yLabelMax.content,
    // 0.7: axis labels use 70% of base font size for visual hierarchy
    fontSize: fontSize * 0.7, color: theme.foreground, align: 'right', valign: 'top',
  } as IRText);

  children.push({
    id: `${id}-ylabel-zero`, type: 'text', bounds: axes.yLabelZero.bounds,
    style: {}, content: '0',
    fontSize: fontSize * 0.7, color: theme.foreground, align: 'right', valign: 'bottom',
  } as IRText);
}

// ---------------------------------------------------------------------------
// Bar chart
// ---------------------------------------------------------------------------

function emitBarChart(
  children: IRElement[],
  id: string,
  bounds: IRBounds,
  data: { category: string; value: number }[],
  theme: DepixTheme,
  scaleCtx?: ScaleContext,
): void {
  const positions = computeChartPositions(bounds, data);
  const fontSize = scaleCtx
    ? computeFontSize(Math.min(bounds.w, bounds.h), 'listItem')
    : theme.fontSize.sm;

  emitChartAxes(children, id, positions.axes, theme, fontSize);

  for (let i = 0; i < positions.bars.length; i++) {
    const bar = positions.bars[i];
    children.push({
      id: `${id}-bar-${i}`, type: 'shape', bounds: bar.barBounds,
      style: { fill: getChartColor(i, theme) }, shape: 'rect',
    } as IRShape);
    children.push({
      id: `${id}-xlabel-${i}`, type: 'text', bounds: bar.labelBounds,
      style: {}, content: bar.category,
      // 0.8: data/category labels use 80% of base font size
      fontSize: fontSize * 0.8, color: theme.foreground, align: 'center', valign: 'top',
    } as IRText);
  }
}

// ---------------------------------------------------------------------------
// Line chart
// ---------------------------------------------------------------------------

function emitLineChart(
  children: IRElement[],
  id: string,
  bounds: IRBounds,
  data: { category: string; value: number }[],
  theme: DepixTheme,
  scaleCtx?: ScaleContext,
): void {
  const positions = computeLineChartPositions(bounds, data);
  const fontSize = scaleCtx
    ? computeFontSize(Math.min(bounds.w, bounds.h), 'listItem')
    : theme.fontSize.sm;

  emitChartAxes(children, id, positions.axes, theme, fontSize);

  // Line segments
  for (let i = 0; i < positions.lines.length; i++) {
    const seg = positions.lines[i];
    const segBounds: IRBounds = {
      x: Math.min(seg.from.x, seg.to.x),
      y: Math.min(seg.from.y, seg.to.y),
      w: Math.abs(seg.to.x - seg.from.x) || 0.1,
      h: Math.abs(seg.to.y - seg.from.y) || 0.1,
    };
    children.push({
      id: `${id}-line-${i}`, type: 'line', bounds: segBounds,
      style: { stroke: theme.border, strokeWidth: 0.3 },
      from: seg.from, to: seg.to,
    } as IRLine);
  }

  // Points and labels
  for (let i = 0; i < positions.points.length; i++) {
    const pt = positions.points[i];
    const r = pt.radius;
    children.push({
      id: `${id}-point-${i}`, type: 'shape',
      bounds: { x: pt.center.x - r, y: pt.center.y - r, w: r * 2, h: r * 2 },
      style: { fill: getChartColor(i, theme) }, shape: 'circle',
    } as IRShape);
    children.push({
      id: `${id}-xlabel-${i}`, type: 'text', bounds: pt.labelBounds,
      style: {}, content: pt.category,
      // 0.8: data/category labels use 80% of base font size
      fontSize: fontSize * 0.8, color: theme.foreground, align: 'center', valign: 'top',
    } as IRText);
  }
}

// ---------------------------------------------------------------------------
// Pie chart
// ---------------------------------------------------------------------------

function emitPieChart(
  children: IRElement[],
  id: string,
  bounds: IRBounds,
  data: { category: string; value: number }[],
  theme: DepixTheme,
  scaleCtx?: ScaleContext,
): void {
  const positions = computePieChartPositions(bounds, data);
  const fontSize = scaleCtx
    ? computeFontSize(Math.min(bounds.w, bounds.h), 'listItem')
    : theme.fontSize.sm;

  for (let i = 0; i < positions.wedges.length; i++) {
    const wedge = positions.wedges[i];
    children.push({
      id: `${id}-wedge-${i}`, type: 'path', bounds,
      style: { fill: getChartColor(i, theme), stroke: theme.background, strokeWidth: 0.3 },
      d: wedge.pathD, closed: true,
    } as IRPath);
    children.push({
      id: `${id}-label-${i}`, type: 'text', bounds: wedge.labelBounds,
      style: {}, content: `${wedge.category} ${Math.round(wedge.percentage)}%`,
      fontSize: fontSize * 0.7, color: theme.foreground, align: 'center', valign: 'middle',
    } as IRText);
  }
}
