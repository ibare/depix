/**
 * Emit walker — table 블록 처리.
 *
 * 입력: table blockType PlanNode + ChartPositionsMap (사전 계산된 셀 좌표 포함).
 * 출력: IRContainer.
 *
 * S-pipeline MUST 준수:
 *   - ChartPositionsMap은 조회만 한다. 크기 분배·좌표 계산 없음.
 *   - compute-chart-positions.ts가 사전 계산한 rowBounds/cellBounds를 읽어 IR 생성.
 */

import type {
  IRBounds,
  IRContainer,
  IRElement,
  IRShape,
  IRText,
} from '../ir/types.js';
import type { SceneTheme } from '../theme/scene-theme.js';
import type { PlanNode } from './layout/plan-types.js';
import type { ChartPositionsMap } from './passes/compute-chart-positions.js';

// ---------------------------------------------------------------------------
// walkTable — table PlanNode → IRContainer
// ---------------------------------------------------------------------------

export function walkTable(
  plan: PlanNode,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  baseFontSize: number,
  chartPositionsMap?: ChartPositionsMap,
): IRContainer {
  const data = chartPositionsMap?.get(plan.id);
  if (!data || data.kind !== 'table') {
    return emptyContainer(plan.id, bounds);
  }

  const { rows } = data;
  if (rows.length === 0) {
    return emptyContainer(plan.id, bounds);
  }

  const naturalCellFS = baseFontSize * sceneTheme.typography.bodySize * 0.9;
  const children: IRElement[] = [];

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const rowChildren: IRElement[] = [];

    for (let ci = 0; ci < row.cells.length; ci++) {
      const cell = row.cells[ci];

      // 셀 배경
      rowChildren.push({
        id: `${plan.id}-r${ri}-c${ci}-bg`,
        type: 'shape',
        bounds: cell.cellBounds,
        style: {
          fill: cell.isHeader ? sceneTheme.colors.surface : sceneTheme.colors.background,
          stroke: sceneTheme.colors.textMuted,
          strokeWidth: 0.15,
        },
        shape: 'rect',
      } as IRShape);

      // 셀 텍스트
      const textBounds: IRBounds = {
        x: cell.cellBounds.x + 0.5,
        y: cell.cellBounds.y,
        w: cell.cellBounds.w - 1,
        h: cell.cellBounds.h,
      };
      const cellText: IRText = {
        id: `${plan.id}-r${ri}-c${ci}-text`,
        type: 'text',
        bounds: textBounds,
        style: {},
        content: cell.content,
        fontSize: naturalCellFS,
        color: sceneTheme.colors.text,
        align: cell.isNumeric ? 'right' : 'left',
        valign: 'middle',
      };
      if (cell.isHeader) cellText.fontWeight = 'bold';
      rowChildren.push(cellText);
    }

    children.push({
      id: `${plan.id}-row-${ri}`,
      type: 'container',
      bounds: row.rowBounds,
      style: {},
      children: rowChildren,
    } as IRContainer);
  }

  return {
    id: plan.id,
    type: 'container',
    bounds,
    style: {},
    children,
    origin: { sourceType: 'table' },
  };
}

function emptyContainer(id: string, bounds: IRBounds): IRContainer {
  return { id, type: 'container', bounds, style: {}, children: [] };
}
