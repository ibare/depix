/**
 * Emit walker — chart 블록 처리.
 *
 * 입력: chart blockType PlanNode + ChartPositionsMap (사전 계산된 positions).
 * 출력: IRContainer.
 *
 * S-pipeline MUST 준수:
 *   - ChartPositionsMap은 조회만 한다. 좌표 계산 없음.
 *   - computeChartPositions 등 layout 함수를 호출하지 않는다.
 *   - emit.ts → walkScene → walkBlock → walkChart 경로로 호출된다.
 *
 * table 블록은 emit-table-walker.ts가 처리한다.
 */

import type {
  IRBounds,
  IRContainer,
  IRElement,
  IRLine,
  IRPath,
  IRShape,
  IRText,
} from '../ir/types.js';
import type { DepixTheme } from '../theme/types.js';
import type { SceneTheme } from '../theme/scene-theme.js';
import type { PlanNode } from './layout/plan-types.js';
import type { ChartPositionsMap } from './passes/compute-chart-positions.js';
import { getChartColor } from './layout/chart-colors.js';

// ---------------------------------------------------------------------------
// walkChart — chart PlanNode → IRContainer
// ---------------------------------------------------------------------------

export function walkChart(
  plan: PlanNode,
  bounds: IRBounds,
  theme: DepixTheme,
  sceneTheme: SceneTheme,
  chartPositionsMap?: ChartPositionsMap,
): IRContainer {
  const data = chartPositionsMap?.get(plan.id);
  if (!data || (data.kind !== 'bar' && data.kind !== 'line' && data.kind !== 'pie')) {
    return emptyContainer(plan.id, bounds);
  }

  const fontSize = Math.min(bounds.h, 100) * 0.07 * sceneTheme.typography.bodySize;
  const children: IRElement[] = [];

  if (data.kind === 'bar') {
    // 축
    appendAxes(children, plan.id, data.axes, sceneTheme, fontSize);
    // 막대
    for (let i = 0; i < data.bars.length; i++) {
      const bar = data.bars[i];
      children.push({
        id: `${plan.id}-bar-${i}`,
        type: 'shape',
        bounds: bar.barBounds,
        style: { fill: getChartColor(i, theme) },
        shape: 'rect',
      } as IRShape);
      children.push({
        id: `${plan.id}-xlabel-${i}`,
        type: 'text',
        bounds: bar.labelBounds,
        style: {},
        content: bar.category,
        fontSize: fontSize * 0.8,
        color: sceneTheme.colors.textMuted,
        align: 'center',
        valign: 'top',
      } as IRText);
    }
  } else if (data.kind === 'line') {
    // 축
    appendAxes(children, plan.id, data.axes, sceneTheme, fontSize);
    // 선분
    for (let i = 0; i < data.lines.length; i++) {
      const seg = data.lines[i];
      const segBounds: IRBounds = {
        x: Math.min(seg.from.x, seg.to.x),
        y: Math.min(seg.from.y, seg.to.y),
        w: Math.abs(seg.to.x - seg.from.x) || 0.1,
        h: Math.abs(seg.to.y - seg.from.y) || 0.1,
      };
      children.push({
        id: `${plan.id}-line-${i}`,
        type: 'line',
        bounds: segBounds,
        style: { stroke: sceneTheme.colors.textMuted, strokeWidth: 0.3 },
        from: seg.from,
        to: seg.to,
      } as IRLine);
    }
    // 점 + 라벨
    for (let i = 0; i < data.points.length; i++) {
      const pt = data.points[i];
      const r = pt.radius;
      children.push({
        id: `${plan.id}-point-${i}`,
        type: 'shape',
        bounds: { x: pt.center.x - r, y: pt.center.y - r, w: r * 2, h: r * 2 },
        style: { fill: getChartColor(i, theme) },
        shape: 'circle',
      } as IRShape);
      children.push({
        id: `${plan.id}-xlabel-${i}`,
        type: 'text',
        bounds: pt.labelBounds,
        style: {},
        content: pt.category,
        fontSize: fontSize * 0.8,
        color: sceneTheme.colors.textMuted,
        align: 'center',
        valign: 'top',
      } as IRText);
    }
  } else if (data.kind === 'pie') {
    // 파이 웨지 + 라벨
    for (let i = 0; i < data.wedges.length; i++) {
      const wedge = data.wedges[i];
      children.push({
        id: `${plan.id}-wedge-${i}`,
        type: 'path',
        bounds,
        style: {
          fill: getChartColor(i, theme),
          stroke: sceneTheme.colors.background,
          strokeWidth: 0.3,
        },
        d: wedge.pathD,
        closed: true,
      } as IRPath);
      children.push({
        id: `${plan.id}-label-${i}`,
        type: 'text',
        bounds: wedge.labelBounds,
        style: {},
        content: `${wedge.category} ${Math.round(wedge.percentage)}%`,
        fontSize: fontSize * 0.7,
        color: sceneTheme.colors.text,
        align: 'center',
        valign: 'middle',
      } as IRText);
    }
  }

  return {
    id: plan.id,
    type: 'container',
    bounds,
    style: {},
    children,
    origin: { sourceType: 'chart', sourceProps: { ...plan.props } },
  };
}

// ---------------------------------------------------------------------------
// 내부 헬퍼
// ---------------------------------------------------------------------------

function emptyContainer(id: string, bounds: IRBounds): IRContainer {
  return { id, type: 'container', bounds, style: {}, children: [] };
}

function appendAxes(
  children: IRElement[],
  id: string,
  axes: NonNullable<Extract<import('./passes/compute-chart-positions.js').ChartRenderData, { kind: 'bar' }>['axes']>,
  sceneTheme: SceneTheme,
  fontSize: number,
): void {
  children.push({
    id: `${id}-y-axis`,
    type: 'line',
    bounds: axes.yAxis.bounds,
    style: { stroke: sceneTheme.colors.textMuted, strokeWidth: 0.2 },
    from: axes.yAxis.from,
    to: axes.yAxis.to,
  } as IRLine);
  children.push({
    id: `${id}-x-axis`,
    type: 'line',
    bounds: axes.xAxis.bounds,
    style: { stroke: sceneTheme.colors.textMuted, strokeWidth: 0.2 },
    from: axes.xAxis.from,
    to: axes.xAxis.to,
  } as IRLine);
  children.push({
    id: `${id}-ylabel-max`,
    type: 'text',
    bounds: axes.yLabelMax.bounds,
    style: {},
    content: axes.yLabelMax.content,
    fontSize: fontSize * 0.65,
    color: sceneTheme.colors.textMuted,
    align: 'right',
    valign: 'top',
  } as IRText);
  children.push({
    id: `${id}-ylabel-zero`,
    type: 'text',
    bounds: axes.yLabelZero.bounds,
    style: {},
    content: '0',
    fontSize: fontSize * 0.65,
    color: sceneTheme.colors.textMuted,
    align: 'right',
    valign: 'bottom',
  } as IRText);
}
