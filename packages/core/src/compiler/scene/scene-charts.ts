/**
 * Scene Emission — Chart Emitters
 *
 * IR emitters for scene-level chart blocks:
 * bar chart, line chart, pie chart, shared axes rendering.
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
import type { SceneTheme } from '../../theme/scene-theme.js';
import type { ASTBlock } from '../ast.js';
import {
  extractChartData,
  computeChartPositions,
  computeLineChartPositions,
  computePieChartPositions,
} from '../layout/chart-layout.js';
import { getChartColor } from '../layout/chart-colors.js';

// ---------------------------------------------------------------------------
// Main chart dispatcher
// ---------------------------------------------------------------------------

export function emitSceneChart(
  block: ASTBlock,
  id: string,
  bounds: IRBounds,
  theme: DepixTheme,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRContainer {
  const children: IRElement[] = [];
  const data = extractChartData(block);

  if (data.length === 0) {
    return { id, type: 'container', bounds, style: {}, children };
  }

  const chartType = typeof block.props.type === 'string' ? block.props.type : 'bar';
  const fontSize = baseFontSize * sceneTheme.typography.bodySize;

  switch (chartType) {
    case 'line':
      emitSceneLineChart(children, id, bounds, data, theme, sceneTheme, fontSize);
      break;
    case 'pie':
      emitScenePieChart(children, id, bounds, data, theme, sceneTheme, fontSize);
      break;
    default:
      emitSceneBarChart(children, id, bounds, data, theme, sceneTheme, fontSize);
      break;
  }

  return { id, type: 'container', bounds, style: {}, children };
}

// ---------------------------------------------------------------------------
// Axes
// ---------------------------------------------------------------------------

function emitSceneChartAxes(
  children: IRElement[],
  id: string,
  axes: { yAxis: { from: { x: number; y: number }; to: { x: number; y: number }; bounds: IRBounds }; xAxis: { from: { x: number; y: number }; to: { x: number; y: number }; bounds: IRBounds }; yLabelMax: { bounds: IRBounds; content: string }; yLabelZero: { bounds: IRBounds } },
  sceneTheme: SceneTheme,
  fontSize: number,
): void {
  children.push({
    id: `${id}-y-axis`, type: 'line', bounds: axes.yAxis.bounds,
    style: { stroke: sceneTheme.colors.textMuted, strokeWidth: 0.2 },
    from: axes.yAxis.from, to: axes.yAxis.to,
  } as IRLine);
  children.push({
    id: `${id}-x-axis`, type: 'line', bounds: axes.xAxis.bounds,
    style: { stroke: sceneTheme.colors.textMuted, strokeWidth: 0.2 },
    from: axes.xAxis.from, to: axes.xAxis.to,
  } as IRLine);
  children.push({
    id: `${id}-ylabel-max`, type: 'text', bounds: axes.yLabelMax.bounds,
    style: {}, content: axes.yLabelMax.content,
    fontSize: fontSize * 0.65, color: sceneTheme.colors.textMuted, align: 'right', valign: 'top',
  } as IRText);
  children.push({
    id: `${id}-ylabel-zero`, type: 'text', bounds: axes.yLabelZero.bounds,
    style: {}, content: '0',
    fontSize: fontSize * 0.65, color: sceneTheme.colors.textMuted, align: 'right', valign: 'bottom',
  } as IRText);
}

// ---------------------------------------------------------------------------
// Bar chart
// ---------------------------------------------------------------------------

function emitSceneBarChart(
  children: IRElement[],
  id: string,
  bounds: IRBounds,
  data: { category: string; value: number }[],
  theme: DepixTheme,
  sceneTheme: SceneTheme,
  fontSize: number,
): void {
  const positions = computeChartPositions(bounds, data);
  emitSceneChartAxes(children, id, positions.axes, sceneTheme, fontSize);

  for (let i = 0; i < positions.bars.length; i++) {
    const bar = positions.bars[i];
    children.push({
      id: `${id}-bar-${i}`, type: 'shape', bounds: bar.barBounds,
      style: { fill: getChartColor(i, theme) }, shape: 'rect',
    } as IRShape);
    children.push({
      id: `${id}-xlabel-${i}`, type: 'text', bounds: bar.labelBounds,
      style: {}, content: bar.category,
      fontSize: fontSize * 0.7, color: sceneTheme.colors.textMuted, align: 'center', valign: 'top',
    } as IRText);
  }
}

// ---------------------------------------------------------------------------
// Line chart
// ---------------------------------------------------------------------------

function emitSceneLineChart(
  children: IRElement[],
  id: string,
  bounds: IRBounds,
  data: { category: string; value: number }[],
  theme: DepixTheme,
  sceneTheme: SceneTheme,
  fontSize: number,
): void {
  const positions = computeLineChartPositions(bounds, data);
  emitSceneChartAxes(children, id, positions.axes, sceneTheme, fontSize);

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
      style: { stroke: sceneTheme.colors.textMuted, strokeWidth: 0.3 },
      from: seg.from, to: seg.to,
    } as IRLine);
  }

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
      fontSize: fontSize * 0.7, color: sceneTheme.colors.textMuted, align: 'center', valign: 'top',
    } as IRText);
  }
}

// ---------------------------------------------------------------------------
// Pie chart
// ---------------------------------------------------------------------------

function emitScenePieChart(
  children: IRElement[],
  id: string,
  bounds: IRBounds,
  data: { category: string; value: number }[],
  theme: DepixTheme,
  sceneTheme: SceneTheme,
  fontSize: number,
): void {
  const positions = computePieChartPositions(bounds, data);

  for (let i = 0; i < positions.wedges.length; i++) {
    const wedge = positions.wedges[i];
    children.push({
      id: `${id}-wedge-${i}`, type: 'path', bounds,
      style: { fill: getChartColor(i, theme), stroke: sceneTheme.colors.background, strokeWidth: 0.3 },
      d: wedge.pathD, closed: true,
    } as IRPath);
    children.push({
      id: `${id}-label-${i}`, type: 'text', bounds: wedge.labelBounds,
      style: {}, content: `${wedge.category} ${Math.round(wedge.percentage)}%`,
      fontSize: fontSize * 0.6, color: sceneTheme.colors.text, align: 'center', valign: 'middle',
    } as IRText);
  }
}
