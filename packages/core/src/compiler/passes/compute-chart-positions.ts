/**
 * compute-chart-positions 패스 — chart/table PlanNode의 시각 좌표를 사전 계산.
 *
 * allocateBounds 이후, emit 이전에 실행된다.
 * walker는 이 Map을 조회만 하며 좌표를 재계산하지 않는다 (S-pipeline MUST 준수).
 */

import type { IRBounds } from '../../ir/types.js';
import type { BoundsMap } from './allocate-bounds.js';
import type { PlanNode } from '../layout/plan-types.js';
import {
  computeChartPositions,
  computeLineChartPositions,
  computePieChartPositions,
  type ChartBarPosition,
  type ChartAxisPositions,
  type ChartPointPosition,
  type ChartLineSegment,
  type PieWedgePosition,
  type ChartDataPoint,
} from '../layout/chart-layout.js';

// ---------------------------------------------------------------------------
// ChartRenderData — chart/table 패스 결과 타입
// ---------------------------------------------------------------------------

export type ChartRenderData =
  | { kind: 'bar'; bars: ChartBarPosition[]; axes: ChartAxisPositions }
  | { kind: 'line'; points: ChartPointPosition[]; lines: ChartLineSegment[]; axes: ChartAxisPositions }
  | { kind: 'pie'; wedges: PieWedgePosition[] }
  | { kind: 'table'; rows: TableRowData[]; bounds: IRBounds };

export interface TableCellData {
  content: string;
  cellBounds: IRBounds;
  isNumeric: boolean;
  isHeader: boolean;
}

export interface TableRowData {
  values: (string | number)[];
  isHeader: boolean;
  rowBounds: IRBounds;
  cells: TableCellData[];
}

export type ChartPositionsMap = Map<string, ChartRenderData>;

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------

/**
 * plans 배열에서 chart/table PlanNode를 모두 순회하여 positions를 계산하고
 * ChartPositionsMap에 저장한다. walker는 이 Map을 조회만 한다.
 */
export function computeAllChartPositions(
  plans: PlanNode[],
  boundsMap: BoundsMap,
): ChartPositionsMap {
  const map: ChartPositionsMap = new Map();
  for (const plan of plans) {
    collectPositions(plan, boundsMap, map);
  }
  return map;
}

// ---------------------------------------------------------------------------
// 내부 구현
// ---------------------------------------------------------------------------

function collectPositions(plan: PlanNode, boundsMap: BoundsMap, map: ChartPositionsMap): void {
  if (plan.blockType === 'chart') {
    const bounds = boundsMap.get(plan.id);
    if (bounds) {
      map.set(plan.id, computeChartRenderData(plan, bounds));
    }
  } else if (plan.blockType === 'table') {
    const bounds = boundsMap.get(plan.id);
    if (bounds) {
      map.set(plan.id, computeTableRenderData(plan, bounds));
    }
  }

  for (const child of plan.children) {
    collectPositions(child, boundsMap, map);
  }
}

function computeChartRenderData(plan: PlanNode, bounds: IRBounds): ChartRenderData {
  const data = extractChartDataFromPlan(plan);
  const chartType = typeof plan.props.type === 'string' ? plan.props.type : 'bar';

  if (data.length === 0) {
    return { kind: 'bar', bars: [], axes: emptyAxes(bounds) };
  }

  if (chartType === 'line') {
    const positions = computeLineChartPositions(bounds, data);
    return { kind: 'line', points: positions.points, lines: positions.lines, axes: positions.axes };
  }
  if (chartType === 'pie') {
    const positions = computePieChartPositions(bounds, data);
    return { kind: 'pie', wedges: positions.wedges };
  }
  // 기본값: bar
  const positions = computeChartPositions(bounds, data);
  return { kind: 'bar', bars: positions.bars, axes: positions.axes };
}

function computeTableRenderData(plan: PlanNode, bounds: IRBounds): ChartRenderData {
  const rowNodes = plan.children.filter(c => c.elementType === 'row');
  const gap = 0; // table 행 간격 (비율 좌표계)
  const rowH = rowNodes.length > 0
    ? (bounds.h - gap * Math.max(rowNodes.length - 1, 0)) / rowNodes.length
    : bounds.h;

  let curY = bounds.y;
  const rows: TableRowData[] = rowNodes.map(c => {
    const values = c.values ?? [];
    const isHeader = c.props.header === 1;
    const colCount = Math.max(values.length, 1);
    const cellW = bounds.w / colCount;
    const rowBounds: IRBounds = { x: bounds.x, y: curY, w: bounds.w, h: rowH };

    const cells: TableCellData[] = values.map((v, ci) => ({
      content: String(v),
      cellBounds: { x: bounds.x + ci * cellW, y: curY, w: cellW, h: rowH },
      isNumeric: typeof v === 'number',
      isHeader,
    }));

    curY += rowH + gap;
    return { values, isHeader, rowBounds, cells };
  });

  return { kind: 'table', rows, bounds };
}

/**
 * chart PlanNode의 children(row PlanNode들)에서 ChartDataPoint 배열을 추출.
 * PlanNode.values 필드에서 데이터를 읽는다 (plan-all-element에서 복사됨).
 */
function extractChartDataFromPlan(plan: PlanNode): ChartDataPoint[] {
  const rowChildren = plan.children.filter(c => c.elementType === 'row');
  const headerRow = rowChildren.find(c => c.props.header === 1);
  const dataRows = rowChildren.filter(c => c.props.header !== 1);

  if (dataRows.length === 0) return [];

  const xCol = typeof plan.props.x === 'string' ? (plan.props.x as string) : undefined;
  const yCol = typeof plan.props.y === 'string' ? (plan.props.y as string) : undefined;
  const columns = headerRow?.values?.map(v => String(v)) ?? [];

  const xIdx = xCol ? columns.indexOf(xCol) : 0;
  const yIdx = yCol
    ? columns.indexOf(yCol)
    : columns.findIndex((_c, i) => i > 0 && dataRows.some(r => typeof r.values?.[i] === 'number'));
  const effectiveYIdx = yIdx >= 0 ? yIdx : 1;

  return dataRows.map(r => ({
    category: String(r.values?.[xIdx] ?? ''),
    value: typeof r.values?.[effectiveYIdx] === 'number' ? (r.values[effectiveYIdx] as number) : 0,
  }));
}

function emptyAxes(bounds: IRBounds): ChartAxisPositions {
  return {
    yAxis: { from: { x: bounds.x, y: bounds.y }, to: { x: bounds.x, y: bounds.y + bounds.h }, bounds },
    xAxis: { from: { x: bounds.x, y: bounds.y + bounds.h }, to: { x: bounds.x + bounds.w, y: bounds.y + bounds.h }, bounds },
    yLabelMax: { bounds: { x: bounds.x, y: bounds.y, w: 5, h: 3 }, content: '0' },
    yLabelZero: { bounds: { x: bounds.x, y: bounds.y + bounds.h - 3, w: 5, h: 3 } },
  };
}
