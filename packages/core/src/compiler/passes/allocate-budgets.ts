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
      const usableH = innerH - gap * Math.max(n - 1, 0);
      const rawHeights = children.map(c =>
        totalWeight > 0 ? usableH * (c.weight / totalWeight) : usableH / n,
      );
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
      const usableW = innerW - gap * Math.max(n - 1, 0);
      const rawWidths = children.map(c =>
        totalWeight > 0 ? usableW * (c.weight / totalWeight) : usableW / n,
      );
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
        // Fallback: use column layout for budget distribution
        return { direction: 'col', gap, padding: 0 };
      default:
        return { direction: 'col', gap, padding: 0 };
    }
  }

  return { direction: 'col', gap: 0, padding: 0 };
}
