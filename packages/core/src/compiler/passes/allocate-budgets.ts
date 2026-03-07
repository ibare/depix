/**
 * Compiler Pass — Allocate Budgets (Top-down)
 *
 * Distributes available space from the canvas root down to each plan node
 * using BFS traversal. Each node receives a budget (width, height) that
 * the measure pass uses to determine fontSize and other size-dependent values.
 *
 * Pipeline: SceneLayoutPlan + canvasBounds + ConstraintMap + ScaleContext → BudgetMap
 */

import type { IRBounds } from '../../ir/types.js';
import type { NodeBudget, BudgetMap, ConstraintMap } from './budget-types.js';
import type { LayoutPlanNode, SceneLayoutPlan } from './plan-layout.js';
import type { ScaleContext } from './scale-system.js';
import { computeGap, computePadding } from './scale-system.js';
import { redistributeWithMinimums } from './allocate-bounds.js';
import { computeTreeLevelInfo, computeFlowLayerInfo, computeSubtreeSpans } from './layout-analysis.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function allocateBudgets(
  plan: SceneLayoutPlan,
  canvasBounds: IRBounds,
  constraints: ConstraintMap,
  scaleCtx: ScaleContext,
): BudgetMap {
  const budgetMap: BudgetMap = new Map();

  if (plan.children.length === 0) return budgetMap;

  // Allocate root-level children (scene level — vertical stack)
  const gap = computeGap(scaleCtx.baseUnit, 'sectionGap');
  allocateChildBudgets(
    plan.children,
    plan.totalWeight,
    { width: canvasBounds.w, height: canvasBounds.h },
    'col',
    gap,
    constraints,
    budgetMap,
  );

  // BFS to propagate budgets to descendants
  const queue: LayoutPlanNode[] = [...plan.children];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.children.length === 0) continue;

    const parentBudget = budgetMap.get(node.id);
    if (!parentBudget) continue;

    const blockType = node.astNode.kind === 'block' ? node.astNode.blockType : '';
    if (blockType === 'tree' || blockType === 'flow') {
      allocateTreeFlowBudgets(node, parentBudget, constraints, scaleCtx, budgetMap);
    } else {
      const info = getNodeLayoutInfo(node, scaleCtx);
      allocateChildBudgets(
        node.children,
        node.children.reduce((s, c) => s + c.weight, 0),
        parentBudget,
        info.direction,
        info.gap,
        constraints,
        budgetMap,
        info.padding,
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
  children: LayoutPlanNode[],
  totalWeight: number,
  parentBudget: NodeBudget,
  direction: Direction,
  gap: number,
  constraints: ConstraintMap,
  budgetMap: BudgetMap,
  padding: number = 0,
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
      const minHeights = children.map(c => {
        const cc = constraints.get(c.id);
        return cc ? cc.minHeight : 0;
      });
      const finalHeights = redistributeWithMinimums(rawHeights, minHeights, usableH);

      for (let i = 0; i < n; i++) {
        budgetMap.set(children[i].id, {
          width: innerW,
          height: Math.max(finalHeights[i], 0),
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
      const minWidths = children.map(c => {
        const cc = constraints.get(c.id);
        return cc ? cc.minWidth : 0;
      });
      const finalWidths = redistributeWithMinimums(rawWidths, minWidths, usableW);

      for (let i = 0; i < n; i++) {
        budgetMap.set(children[i].id, {
          width: Math.max(finalWidths[i], 0),
          height: innerH,
        });
      }
      break;
    }

    case 'grid': {
      // Grid: uniform cells — computed from parent
      const props = children[0]?.astNode.kind === 'block' ? {} : {};
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
        budgetMap.set(child.id, { width: innerW, height: Math.max(eachH, 0) });
      }
      break;
    }
  }
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
  node: LayoutPlanNode,
  scaleCtx: ScaleContext,
): NodeLayoutInfo {
  const astNode = node.astNode;

  // Element with children (box/layer) — vertical stack with padding
  if (astNode.kind === 'element') {
    const padding = computePadding(scaleCtx.baseUnit);
    const gap = computeGap(scaleCtx.baseUnit, 'childGap');
    return { direction: 'col', gap, padding };
  }

  // Block node
  if (astNode.kind === 'block') {
    const props = astNode.props;
    const defaultGap = computeGap(scaleCtx.baseUnit, 'siblingGap');
    const gap = typeof props.gap === 'number' ? props.gap : defaultGap;

    switch (astNode.blockType) {
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
  node: LayoutPlanNode,
  parentBudget: NodeBudget,
  _constraints: ConstraintMap,
  scaleCtx: ScaleContext,
  budgetMap: BudgetMap,
): void {
  const astNode = node.astNode;
  if (astNode.kind !== 'block') return;

  const props = astNode.props;
  const dir = (props.direction as string) ?? (astNode.blockType === 'tree' ? 'down' : 'right');
  const isHorizontal = dir === 'right' || dir === 'left';
  const defaultGap = computeGap(scaleCtx.baseUnit, 'connectorGap');
  const gap = typeof props.gap === 'number' ? props.gap : defaultGap;
  const siblingGap = computeGap(scaleCtx.baseUnit, 'siblingGap');

  const nodeIds = node.children.map(c => c.id);
  const edges = node.edges;

  const mainAvail = isHorizontal ? parentBudget.width : parentBudget.height;
  const crossAvail = isHorizontal ? parentBudget.height : parentBudget.width;

  if (astNode.blockType === 'tree') {
    const levelInfo = computeTreeLevelInfo(nodeIds, edges);
    const levelHeight = (mainAvail - gap * Math.max(levelInfo.numLevels - 1, 0)) / Math.max(levelInfo.numLevels, 1);

    // Subtree-span proportional cross-axis allocation
    const spanInfo = computeSubtreeSpans(nodeIds, edges);
    const rootSpan = spanInfo.roots.reduce(
      (max, r) => Math.max(max, spanInfo.nodeSpan.get(r) ?? 1), 1,
    );

    for (const child of node.children) {
      const span = spanInfo.nodeSpan.get(child.id) ?? 1;
      const nodeCross = crossAvail * (span / rootSpan);

      if (isHorizontal) {
        budgetMap.set(child.id, { width: levelHeight, height: nodeCross });
      } else {
        budgetMap.set(child.id, { width: nodeCross, height: levelHeight });
      }
    }
  } else {
    // Flow
    const layerInfo = computeFlowLayerInfo(nodeIds, edges);
    const layerMainSize = (mainAvail - gap * Math.max(layerInfo.layerCount - 1, 0)) / Math.max(layerInfo.layerCount, 1);

    for (const child of node.children) {
      const layer = layerInfo.nodeLayer.get(child.id) ?? 0;
      const nodesInLayer = layerInfo.nodesPerLayer[layer] ?? 1;
      const nodeCross = (crossAvail - gap * Math.max(nodesInLayer - 1, 0)) / Math.max(nodesInLayer, 1);
      // Cap for single-node layers to prevent excessive size
      const cappedCross = nodesInLayer === 1 ? Math.min(nodeCross, crossAvail * 0.6) : nodeCross;

      if (isHorizontal) {
        budgetMap.set(child.id, { width: layerMainSize, height: cappedCross });
      } else {
        budgetMap.set(child.id, { width: cappedCross, height: layerMainSize });
      }
    }
  }
}
