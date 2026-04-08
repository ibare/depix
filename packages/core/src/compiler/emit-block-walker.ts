/**
 * Emit walker — 컨테이너 블록 처리.
 *
 * 입력: non-leaf PlanNode (`blockType`이 element-*가 아닌 것).
 * 출력: IRContainer — children에 자식 IRElement들과 IREdge들을 포함.
 *
 * S-pipeline MUST 준수:
 *   - walker는 BoundsMap을 **조회만** 한다. 레이아웃 알고리즘을 재실행하지 않는다.
 *   - 모든 자식 bounds는 `allocateBounds` 패스에서 이미 BoundsMap에 채워져 있다.
 *
 * emit.ts → walkScene → walkBlock 경로로 호출된다.
 */

import type { IRBounds, IRContainer, IRElement, IRShapeType } from '../ir/types.js';
import type { DepixTheme } from '../theme/types.js';
import type { SceneTheme } from '../theme/scene-theme.js';
import type { BoundsMap } from './passes/allocate-bounds.js';
import type { MeasureMap } from './passes/measure.js';
import type { PlanNode } from './layout/plan-types.js';
import type { ChartPositionsMap } from './passes/compute-chart-positions.js';
import { buildIRStyle, routePlanEdge } from './emit-helpers.js';
import { walkElement } from './emit-element-walker.js';
import { walkChart } from './emit-chart-walker.js';
import { walkTable } from './emit-table-walker.js';

// ---------------------------------------------------------------------------
// walkBlock — 진입점
// ---------------------------------------------------------------------------

/**
 * 단일 컨테이너 PlanNode → IRContainer 변환.
 *
 * 재귀 구조:
 *   1. 자기 bounds를 boundsMap에서 조회.
 *   2. 자식 PlanNode들을 재귀적으로 walk (leaf면 walkElement, 컨테이너면 walkBlock).
 *   3. 엣지가 있으면 PlanEdge → IREdge 라우팅 (boundsMap + shapeMap 조회만).
 *   4. IRContainer로 결합 후 반환.
 */
export function walkBlock(
  plan: PlanNode,
  boundsMap: BoundsMap,
  theme: DepixTheme,
  sceneTheme: SceneTheme,
  measureMap?: MeasureMap,
  chartPositionsMap?: ChartPositionsMap,
): IRContainer {
  // chart/table blockType은 walkChart/walkTable로 위임.
  if (plan.blockType === 'chart') {
    const bounds = boundsMap.get(plan.id) ?? zeroBounds();
    return walkChart(plan, bounds, theme, sceneTheme, chartPositionsMap);
  }
  if (plan.blockType === 'table') {
    const bounds = boundsMap.get(plan.id) ?? zeroBounds();
    const baseFontSize = Math.min(bounds.h, 100) * 0.07;
    return walkTable(plan, bounds, sceneTheme, baseFontSize, chartPositionsMap);
  }

  // element-type PlanNode에 block-type child가 하나만 있으면 해당 block에 forward.
  // 예: heading PlanNode(element-text) + flow child → flow IRContainer를 직접 반환.
  if (
    plan.blockType.startsWith('element-') &&
    plan.children.length === 1 &&
    !plan.children[0].blockType.startsWith('element-')
  ) {
    return walkBlock(plan.children[0], boundsMap, theme, sceneTheme, measureMap, chartPositionsMap);
  }

  const bounds = boundsMap.get(plan.id) ?? zeroBounds();
  const children: IRElement[] = [];
  const shapeMap = new Map<string, IRShapeType>();

  // 1) 자식 walk
  for (const child of plan.children) {
    const childBounds = boundsMap.get(child.id) ?? zeroBounds();
    const childIR = child.blockType.startsWith('element-')
      ? walkElement(child, childBounds, theme, sceneTheme, measureMap)
      : walkBlock(child, boundsMap, theme, sceneTheme, measureMap, chartPositionsMap);
    children.push(childIR);

    // shape dispatch를 위해 shapeMap 채움
    if (childIR.type === 'shape') {
      shapeMap.set(childIR.id, childIR.shape);
    }
  }

  // 2) 엣지 라우팅 (PlanEdge → IREdge, boundsMap/shapeMap 조회만)
  if (plan.edges && plan.edges.length > 0) {
    for (const edge of plan.edges) {
      const irEdge = routePlanEdge(edge, boundsMap, shapeMap);
      if (irEdge) {
        children.push(irEdge);
      }
    }
  }

  // 3) 컨테이너 IR 생성
  const style = buildIRStyle(plan.style);
  // group 블록은 기본 테두리 (옛 emit-ir.ts 관용 유지).
  if (plan.blockType === 'group' && !style.stroke) {
    style.stroke = sceneTheme.colors.textMuted;
    style.strokeWidth = 0.3;
  }

  return {
    id: plan.id,
    type: 'container',
    bounds,
    style,
    children,
    origin: containerOrigin(plan),
  };
}

// ---------------------------------------------------------------------------
// containerOrigin — PlanBlockType → IROrigin.sourceType
// ---------------------------------------------------------------------------

function containerOrigin(plan: PlanNode) {
  const bt = plan.blockType;
  if (
    bt === 'flow' ||
    bt === 'stack' ||
    bt === 'grid' ||
    bt === 'tree' ||
    bt === 'group' ||
    bt === 'layers' ||
    bt === 'scene' ||
    bt === 'table' ||
    bt === 'chart' ||
    bt === 'box'
  ) {
    return {
      sourceType: bt,
      sourceProps: { ...plan.props },
    };
  }
  if (bt === 'layer') {
    return {
      dslType: 'layer',
      sourceProps: { ...plan.props },
    };
  }
  return undefined;
}

function zeroBounds(): IRBounds {
  return { x: 0, y: 0, w: 0, h: 0 };
}
