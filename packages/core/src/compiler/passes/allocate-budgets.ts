/**
 * Compiler Pass — Allocate Budgets (Top-down)
 *
 * Distributes available space from the canvas root down to each plan node
 * using BFS traversal. Each node receives a budget (width, height) that
 * the measure pass uses to determine fontSize and other size-dependent values.
 *
 * Pipeline: PlanNode + canvasBounds + ConstraintMap + ScaleContext → BudgetMap
 */

import type { IRBounds } from '../../ir/types.js';
import type { NodeBudget, BudgetMap, ConstraintMap } from './budget-types.js';
import type { PlanNode } from '../layout/plan-types.js';
import type { ScaleContext } from './scale-system.js';
import { computeGap, computePadding, computeFontSize } from './scale-system.js';
import { redistributeWithMinimums, TREE_LEVEL_GAP_SCALE } from './allocate-bounds.js';
import { computeTreeLevelInfo, computeFlowLayerInfo, computeSubtreeSpans } from './layout-analysis.js';
import type { MeasureMap } from './measure.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Top-down budget allocation.
 *
 * When `measure` is provided (fixed-point 2nd iteration onwards), the col/row
 * distribution uses `Math.max(constraint.min, measure.min)` as the floor for
 * each child in `redistributeWithMinimums`. This feeds back a child's measured
 * needs into the budget so fontSize↔space cycles can converge. See
 * `runBudgetMeasureFixpoint` in `compiler.ts` and S-pipeline MUST carveout.
 */
export function allocateBudgets(
  plan: PlanNode,
  canvasBounds: IRBounds,
  constraints: ConstraintMap,
  scaleCtx: ScaleContext,
  measure?: MeasureMap,
): BudgetMap {
  const budgetMap: BudgetMap = new Map();

  if (plan.children.length === 0) return budgetMap;

  // Allocate root-level children (scene level — vertical stack)
  const gap = computeGap(scaleCtx.baseUnit, 'sectionGap');
  allocateChildBudgets(
    plan.children,
    plan.children.reduce((s, c) => s + c.weight, 0),
    { width: canvasBounds.w, height: canvasBounds.h },
    'col',
    gap,
    constraints,
    budgetMap,
    0,
    measure,
  );

  // BFS to propagate budgets to descendants
  const queue: PlanNode[] = [...plan.children];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.children.length === 0) continue;

    const parentBudget = budgetMap.get(node.id);
    if (!parentBudget) continue;

    const blockType = node.blockType;
    if (blockType === 'tree' || blockType === 'flow') {
      allocateTreeFlowBudgets(node, parentBudget, constraints, scaleCtx, budgetMap);
    } else {
      const info = getNodeLayoutInfo(node, scaleCtx);

      // Reserve title/subtitle space for box/layer elements with labels
      const titleRes = estimateTitleReservation(node, parentBudget, info.padding, info.gap);
      const adjustedBudget = titleRes > 0
        ? { width: parentBudget.width, height: Math.max(parentBudget.height - titleRes, 1) }
        : parentBudget;

      allocateChildBudgets(
        node.children,
        node.children.reduce((s, c) => s + c.weight, 0),
        adjustedBudget,
        info.direction,
        info.gap,
        constraints,
        budgetMap,
        info.padding,
        measure,
      );
    }

    for (const child of node.children) {
      queue.push(child);
    }
  }

  return budgetMap;
}

// ---------------------------------------------------------------------------
// Child budget allocation
// ---------------------------------------------------------------------------

type Direction = 'col' | 'row' | 'grid' | 'uniform';

function allocateChildBudgets(
  children: PlanNode[],
  totalWeight: number,
  parentBudget: NodeBudget,
  direction: Direction,
  gap: number,
  constraints: ConstraintMap,
  budgetMap: BudgetMap,
  padding: number = 0,
  measure?: MeasureMap,
): void {
  const n = children.length;
  if (n === 0) return;

  const innerW = Math.max(parentBudget.width - padding * 2, 1);
  const innerH = Math.max(parentBudget.height - padding * 2, 1);

  switch (direction) {
    case 'col': {
      // Vertical: split height, full width
      // Reserve pinned heights first, distribute remainder to non-pinned
      const usableH = innerH - gap * Math.max(n - 1, 0);
      let pinnedTotal = 0;
      let unpinnedWeight = 0;
      const pinnedH: (number | null)[] = [];

      for (const c of children) {
        const cc = constraints.get(c.id);
        if (cc?.pinnedHeight) {
          pinnedH.push(cc.minHeight);
          pinnedTotal += cc.minHeight;
        } else {
          pinnedH.push(null);
          unpinnedWeight += c.weight;
        }
      }

      const remainder = Math.max(usableH - pinnedTotal, 0);
      const rawHeights = children.map((c, i) => {
        if (pinnedH[i] !== null) return pinnedH[i]!;
        return unpinnedWeight > 0 ? remainder * (c.weight / unpinnedWeight) : remainder / Math.max(n - pinnedH.filter(p => p !== null).length, 1);
      });
      // Fixed-point feedback: 2nd iteration 이후 measure의 minHeight를 바닥값으로 사용.
      // Why: 1st iteration에서 측정된 자식의 실제 텍스트 크기가 다음 예산 배분의 minimum이
      // 되어야 fontSize↔space 순환이 수렴한다. 순수 constraint.minHeight만으로는
      // 초기값에 갇혀 피드백이 전달되지 않는다. (S-pipeline runBudgetMeasureFixpoint 참조)
      const minHeights = children.map(c => {
        const cc = constraints.get(c.id);
        const constraintMin = cc ? cc.minHeight : 0;
        const measureMin = measure?.get(c.id)?.minHeight ?? 0;
        return Math.max(constraintMin, measureMin);
      });
      const finalHeights = redistributeWithMinimums(rawHeights, minHeights, usableH);

      for (let i = 0; i < n; i++) {
        const maxH = constraints.get(children[i].id)?.maxHeight ?? Infinity;
        budgetMap.set(children[i].id, {
          width: innerW,
          height: Math.min(Math.max(finalHeights[i], 0), maxH),
        });
      }
      break;
    }

    case 'row': {
      // Horizontal: split width, full height
      // Reserve pinned widths first, distribute remainder to non-pinned
      const usableW = innerW - gap * Math.max(n - 1, 0);
      let pinnedTotal = 0;
      let unpinnedWeight = 0;
      const pinnedW: (number | null)[] = [];

      for (const c of children) {
        const cc = constraints.get(c.id);
        if (cc?.pinnedWidth) {
          pinnedW.push(cc.minWidth);
          pinnedTotal += cc.minWidth;
        } else {
          pinnedW.push(null);
          unpinnedWeight += c.weight;
        }
      }

      const remainder = Math.max(usableW - pinnedTotal, 0);
      const rawWidths = children.map((c, i) => {
        if (pinnedW[i] !== null) return pinnedW[i]!;
        return unpinnedWeight > 0 ? remainder * (c.weight / unpinnedWeight) : remainder / Math.max(n - pinnedW.filter(p => p !== null).length, 1);
      });
      // Fixed-point feedback: 2nd iteration 이후 measure의 minWidth를 바닥값으로 사용.
      // See minHeights comment above.
      const minWidths = children.map(c => {
        const cc = constraints.get(c.id);
        const constraintMin = cc ? cc.minWidth : 0;
        const measureMin = measure?.get(c.id)?.minWidth ?? 0;
        return Math.max(constraintMin, measureMin);
      });
      const finalWidths = redistributeWithMinimums(rawWidths, minWidths, usableW);

      for (let i = 0; i < n; i++) {
        const maxW = constraints.get(children[i].id)?.maxWidth ?? Infinity;
        budgetMap.set(children[i].id, {
          width: Math.min(Math.max(finalWidths[i], 0), maxW),
          height: innerH,
        });
      }
      break;
    }

    case 'grid': {
      // Grid: uniform cells — computed from parent
      const props = {};
      // Grid cols come from parent block props, but we don't have parent block here.
      // For grid, each child gets (innerW / cols) x (innerH / rows)
      // This is handled by the getNodeLayoutInfo returning 'grid' with pre-computed cell sizes
      // For simplicity, distribute uniformly
      const cellW = innerW / Math.ceil(Math.sqrt(n));
      const cellH = innerH / Math.ceil(n / Math.ceil(Math.sqrt(n)));
      for (const child of children) {
        budgetMap.set(child.id, { width: cellW, height: cellH });
      }
      break;
    }

    case 'uniform': {
      // Uniform: equal height split (layers)
      const usableH = innerH - gap * Math.max(n - 1, 0);
      const eachH = usableH / n;
      for (const child of children) {
        const maxH = constraints.get(child.id)?.maxHeight ?? Infinity;
        budgetMap.set(child.id, { width: innerW, height: Math.min(Math.max(eachH, 0), maxH) });
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Title/subtitle reservation for box elements
// ---------------------------------------------------------------------------

const TEXT_BLOCK_MULTIPLIER = 1.8;

function estimateTitleReservation(
  node: PlanNode,
  parentBudget: NodeBudget,
  padding: number,
  gap: number,
): number {
  if (!node.blockType.startsWith('element-')) return 0;

  const innerShort = Math.min(
    parentBudget.width - padding * 2,
    parentBudget.height - padding * 2,
  );
  if (innerShort <= 0) return 0;

  let reservation = 0;

  // Title
  if (node.label) {
    const titleFontSize = computeFontSize(innerShort, 'innerLabel');
    reservation += titleFontSize * TEXT_BLOCK_MULTIPLIER + gap;
  }

  // Subtitle
  if (typeof node.props.subtitle === 'string') {
    const subtitleFontSize = computeFontSize(innerShort, 'listItem');
    reservation += subtitleFontSize * TEXT_BLOCK_MULTIPLIER + gap;
  }

  return reservation;
}

// ---------------------------------------------------------------------------
// Layout info extraction from node
// ---------------------------------------------------------------------------

interface NodeLayoutInfo {
  direction: Direction;
  gap: number;
  padding: number;
}

function getNodeLayoutInfo(
  node: PlanNode,
  scaleCtx: ScaleContext,
): NodeLayoutInfo {
  // Element with children (box/layer) — vertical stack with padding
  if (node.blockType.startsWith('element-')) {
    const padding = computePadding(scaleCtx.baseUnit);
    const gap = computeGap(scaleCtx.baseUnit, 'childGap');
    return { direction: 'col', gap, padding };
  }

  // Block node
  if (!node.blockType.startsWith('element-')) {
    const props = node.props;
    const defaultGap = computeGap(scaleCtx.baseUnit, 'siblingGap');
    const gap = typeof props.gap === 'number' ? props.gap : defaultGap;

    switch (node.blockType) {
      case 'stack': {
        const dir = (props.direction as string) ?? 'col';
        return { direction: dir === 'row' ? 'row' : 'col', gap, padding: 0 };
      }
      case 'grid':
        return { direction: 'grid', gap, padding: 0 };
      case 'layers': {
        const layerGap = typeof props.gap === 'number' ? props.gap : computeGap(scaleCtx.baseUnit, 'siblingGap');
        return { direction: 'uniform', gap: layerGap, padding: 0 };
      }
      case 'group': {
        const defaultPadding = computePadding(scaleCtx.baseUnit);
        const groupPadding = typeof props.padding === 'number' ? props.padding : defaultPadding;
        return { direction: 'col', gap, padding: groupPadding };
      }
      case 'tree':
      case 'flow':
        // Handled separately by allocateTreeFlowBudgets
        return { direction: 'col', gap, padding: 0 };
      default:
        return { direction: 'col', gap, padding: 0 };
    }
  }

  return { direction: 'col', gap: 0, padding: 0 };
}

// ---------------------------------------------------------------------------
// Tree / Flow — level/layer-based budget allocation
// ---------------------------------------------------------------------------

function allocateTreeFlowBudgets(
  node: PlanNode,
  parentBudget: NodeBudget,
  constraints: ConstraintMap,
  scaleCtx: ScaleContext,
  budgetMap: BudgetMap,
): void {
  if (node.blockType.startsWith('element-')) return;

  const props = node.props;
  const dir = (props.direction as string) ?? (node.blockType === 'tree' ? 'down' : 'right');
  const isHorizontal = dir === 'right' || dir === 'left';
  const defaultGap = computeGap(scaleCtx.baseUnit, 'connectorGap');
  const gap = typeof props.gap === 'number' ? props.gap : defaultGap;
  const siblingGap = computeGap(scaleCtx.baseUnit, 'siblingGap');

  const nodeIds = node.children.map(c => c.id);
  const edges = node.edges ?? [];

  const mainAvail = isHorizontal ? parentBudget.width : parentBudget.height;
  const crossAvail = isHorizontal ? parentBudget.height : parentBudget.width;

  if (node.blockType === 'tree') {
    const levelInfo = computeTreeLevelInfo(nodeIds, edges);
    const numLevels = Math.max(levelInfo.numLevels, 1);

    // Uniform level heights — hierarchy conveyed by position, not size
    const treeLevelGap = gap * TREE_LEVEL_GAP_SCALE;
    const mainUsable = mainAvail - treeLevelGap * Math.max(numLevels - 1, 0);
    const uniformLevelMain = mainUsable / numLevels;

    // Subtree-span proportional cross-axis allocation (unchanged)
    const spanInfo = computeSubtreeSpans(nodeIds, edges);
    const rootSpan = spanInfo.roots.reduce(
      (max, r) => Math.max(max, spanInfo.nodeSpan.get(r) ?? 1), 1,
    );

    for (const child of node.children) {
      const level = levelInfo.nodeLevel.get(child.id) ?? 0;
      const nodeMain = uniformLevelMain;
      const span = spanInfo.nodeSpan.get(child.id) ?? 1;
      const nodeCross = crossAvail * (span / rootSpan);

      const cc = constraints.get(child.id);
      const maxMain = cc ? (isHorizontal ? cc.maxWidth : cc.maxHeight) : Infinity;
      const maxCross = cc ? (isHorizontal ? cc.maxHeight : cc.maxWidth) : Infinity;

      if (isHorizontal) {
        budgetMap.set(child.id, { width: Math.min(nodeMain, maxMain), height: Math.min(nodeCross, maxCross) });
      } else {
        budgetMap.set(child.id, { width: Math.min(nodeCross, maxCross), height: Math.min(nodeMain, maxMain) });
      }
    }
  } else {
    // Flow — 균등 분할로 모든 노드 동일 budget. role-based weight 시스템 제거.
    // allocate-bounds.ts와 일관성 유지하여 budget→bounds 단계 사이 텍스트 폰트 동일성 보장.
    const layerInfo = computeFlowLayerInfo(nodeIds, edges);
    const layerCount = Math.max(layerInfo.layerCount, 1);
    const mainUsable = mainAvail - gap * Math.max(layerCount - 1, 0);
    const layerMainSize = mainUsable / layerCount;

    for (const child of node.children) {
      const layer = layerInfo.nodeLayer.get(child.id) ?? 0;
      const nodesInLayer = layerInfo.nodesPerLayer[layer] ?? 1;
      const nodeCross = (crossAvail - gap * Math.max(nodesInLayer - 1, 0)) / Math.max(nodesInLayer, 1);
      // Cap for single-node layers to prevent excessive size
      const cappedCross = nodesInLayer === 1 ? Math.min(nodeCross, crossAvail * 0.4) : nodeCross;

      const cc = constraints.get(child.id);
      const maxMain = cc ? (isHorizontal ? cc.maxWidth : cc.maxHeight) : Infinity;
      const maxCross = cc ? (isHorizontal ? cc.maxHeight : cc.maxWidth) : Infinity;

      if (isHorizontal) {
        budgetMap.set(child.id, { width: Math.min(layerMainSize, maxMain), height: Math.min(cappedCross, maxCross) });
      } else {
        budgetMap.set(child.id, { width: Math.min(cappedCross, maxCross), height: Math.min(layerMainSize, maxMain) });
      }
    }
  }
}
