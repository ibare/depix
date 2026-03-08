/**
 * Compiler Pass — Allocate Bounds
 *
 * Top-down space allocation: the parent gives each child a portion of its
 * available space proportional to the child's weight. Block children are
 * laid out using the existing layout algorithms; leaf elements receive
 * the allocated space (filling the parent's allocation).
 *
 * Pipeline: SceneLayoutPlan + canvasBounds → BoundsMap
 */

import type { IRBounds } from '../../ir/types.js';
import type { DepixTheme } from '../../theme/types.js';
import type { ASTEdge } from '../ast.js';
import { layoutStack } from '../layout/stack-layout.js';
import { layoutGrid } from '../layout/grid-layout.js';
import { layoutFlow } from '../layout/flow-layout.js';
import { layoutTree } from '../layout/tree-layout.js';
import { layoutGroup } from '../layout/group-layout.js';
import { layoutLayers } from '../layout/layers-layout.js';
import type {
  LayoutChild,
  LayoutResult,
  TreeNode,
} from '../layout/types.js';
import type { LayoutPlanNode, SceneLayoutPlan } from './plan-layout.js';
import type { MeasureMap } from './measure.js';
import type { ScaleContext } from './scale-system.js';
import { computeGap, computePadding } from './scale-system.js';
import { computeTreeLevelInfo, computeFlowLayerInfo } from './layout-analysis.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type BoundsMap = Map<string, IRBounds>;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Allocate bounds for every node in a scene plan.
 *
 * Returns a BoundsMap keyed by node id containing computed IRBounds.
 * Also stores container bounds under each block's id.
 */
export function allocateScene(
  plan: SceneLayoutPlan,
  canvasBounds: IRBounds,
  _theme: DepixTheme,
  scaleCtx?: ScaleContext,
  measureMap?: MeasureMap,
): BoundsMap {
  const boundsMap: BoundsMap = new Map();

  if (plan.children.length === 0) return boundsMap;

  const gap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'sectionGap') : 3;
  const usableHeight = canvasBounds.h - gap * (plan.children.length - 1);

  // When measureMap is available, enforce minimum heights from measurements.
  // First pass: compute weight-based heights, then clamp to minHeight.
  const rawHeights: number[] = [];
  const minHeights: number[] = [];
  for (const child of plan.children) {
    const fraction = plan.totalWeight > 0 ? child.weight / plan.totalWeight : 1 / plan.children.length;
    rawHeights.push(usableHeight * fraction);
    const m = measureMap?.get(child.id);
    minHeights.push(m ? m.minHeight : 0);
  }

  // Redistribute: clamp each child to its minHeight, then redistribute surplus
  // (overflow compression is handled inside redistributeWithMinimums)
  const finalHeights = redistributeWithMinimums(rawHeights, minHeights, usableHeight);

  let currentY = canvasBounds.y;
  for (let i = 0; i < plan.children.length; i++) {
    const childBounds: IRBounds = {
      x: canvasBounds.x,
      y: currentY,
      w: canvasBounds.w,
      h: finalHeights[i],
    };

    allocateNode(plan.children[i], childBounds, boundsMap, scaleCtx, measureMap);
    currentY += finalHeights[i] + gap;
  }

  return boundsMap;
}

// ---------------------------------------------------------------------------
// Internal: recursive allocation
// ---------------------------------------------------------------------------

function allocateNode(
  plan: LayoutPlanNode,
  availBounds: IRBounds,
  boundsMap: BoundsMap,
  scaleCtx?: ScaleContext,
  measureMap?: MeasureMap,
): void {
  if (plan.astNode.kind === 'block') {
    allocateBlock(plan, availBounds, boundsMap, scaleCtx, measureMap);
  } else {
    allocateLeaf(plan, availBounds, boundsMap, scaleCtx, measureMap);
  }
}

/**
 * Allocate bounds for a leaf element (non-block).
 *
 * Uses the available bounds from the parent allocation.
 * Elements with explicit size props (width/height) honour those values.
 */
function allocateLeaf(
  plan: LayoutPlanNode,
  availBounds: IRBounds,
  boundsMap: BoundsMap,
  scaleCtx?: ScaleContext,
  measureMap?: MeasureMap,
): void {
  const node = plan.astNode;
  const hasExplicitW = node.kind === 'element' && typeof node.props.width === 'number';
  const hasExplicitH = node.kind === 'element' && typeof node.props.height === 'number';

  // Use measure minimums as lower bounds
  const m = measureMap?.get(plan.id);
  const minW = m ? m.minWidth : 0;
  const minH = m ? m.minHeight : 0;

  const bounds: IRBounds = {
    x: availBounds.x,
    y: availBounds.y,
    w: hasExplicitW ? plan.intrinsicSize.width : Math.max(availBounds.w, minW),
    h: hasExplicitH ? plan.intrinsicSize.height : Math.max(availBounds.h, minH),
  };

  boundsMap.set(plan.id, bounds);

  // Handle children of box/layer/shape-with-children
  if (plan.children.length > 0) {
    const mParent = measureMap?.get(plan.id);
    const padding = mParent ? mParent.padding : (scaleCtx ? computePadding(scaleCtx.baseUnit) : 2);
    const childGap = mParent ? mParent.childGap : (scaleCtx ? computeGap(scaleCtx.baseUnit, 'childGap') : 1);

    // Reserve space for title and subtitle (box/layer elements)
    let headerOffset = 0;
    if (mParent?.titleHeight) {
      headerOffset += mParent.titleHeight + childGap;
    }
    if (mParent?.subtitleHeight) {
      headerOffset += mParent.subtitleHeight + childGap;
    }

    const innerBounds: IRBounds = {
      x: bounds.x + padding,
      y: bounds.y + padding + headerOffset,
      w: Math.max(bounds.w - padding * 2, 1),
      h: Math.max(bounds.h - padding * 2 - headerOffset, 1),
    };
    const childCount = plan.children.length;
    const childUsable = innerBounds.h - childGap * Math.max(childCount - 1, 0);

    // Collect min heights and weight-based heights, then redistribute
    const rawHeights: number[] = [];
    const childMinHeights: number[] = [];
    const totalChildWeight = plan.children.reduce((s, c) => s + c.weight, 0);
    for (const child of plan.children) {
      const fraction = totalChildWeight > 0 ? child.weight / totalChildWeight : 1 / childCount;
      rawHeights.push(childUsable * fraction);
      const cm = measureMap?.get(child.id);
      childMinHeights.push(cm ? cm.minHeight : 0);
    }
    const finalHeights = redistributeWithMinimums(rawHeights, childMinHeights, childUsable);

    let childY = innerBounds.y;
    for (let i = 0; i < plan.children.length; i++) {
      const childBounds: IRBounds = {
        x: innerBounds.x,
        y: childY,
        w: innerBounds.w,
        h: finalHeights[i],
      };
      boundsMap.set(plan.children[i].id, childBounds);
      childY += finalHeights[i] + childGap;
    }
  }
}

function allocateBlock(
  plan: LayoutPlanNode,
  availBounds: IRBounds,
  boundsMap: BoundsMap,
  scaleCtx?: ScaleContext,
  measureMap?: MeasureMap,
): void {
  const block = plan.astNode;
  if (block.kind !== 'block') return;

  const blockType = block.blockType;
  const props = block.props;

  // Build LayoutChild[] with sizes proportional to available bounds
  const layoutChildren = computeLayoutChildren(plan, availBounds, scaleCtx, measureMap);

  // Run the appropriate layout algorithm
  const layoutResult = runLayout(
    blockType,
    layoutChildren,
    props,
    availBounds,
    plan.edges,
    scaleCtx,
  );

  // Store container bounds
  boundsMap.set(plan.id, layoutResult.containerBounds);

  // Recurse into children
  for (let i = 0; i < plan.children.length; i++) {
    const childPlan = plan.children[i];
    const childBounds = layoutResult.childBounds[i];

    if (childPlan.astNode.kind === 'block') {
      allocateNode(childPlan, childBounds, boundsMap, scaleCtx, measureMap);
    } else {
      // Layout result already respects measure minimums via
      // redistributeWithMinimums (with overflow compression).
      const finalBounds = childBounds;
      boundsMap.set(childPlan.id, finalBounds);

      // Handle nested children (box/layer elements with children)
      if (childPlan.children.length > 0) {
        const mParent = measureMap?.get(childPlan.id);
        const padding = mParent ? mParent.padding : (scaleCtx ? computePadding(scaleCtx.baseUnit) : 2);
        const childGap = mParent ? mParent.childGap : (scaleCtx ? computeGap(scaleCtx.baseUnit, 'childGap') : 1);

        // Reserve space for title and subtitle
        let headerOffset = 0;
        if (mParent?.titleHeight) {
          headerOffset += mParent.titleHeight + childGap;
        }
        if (mParent?.subtitleHeight) {
          headerOffset += mParent.subtitleHeight + childGap;
        }

        const innerBounds: IRBounds = {
          x: finalBounds.x + padding,
          y: finalBounds.y + padding + headerOffset,
          w: Math.max(finalBounds.w - padding * 2, 1),
          h: Math.max(finalBounds.h - padding * 2 - headerOffset, 1),
        };
        const gcCount = childPlan.children.length;
        const gcUsable = innerBounds.h - childGap * Math.max(gcCount - 1, 0);

        // Redistribute grandchild heights with measure minimums
        const gcRawHeights: number[] = [];
        const gcMinHeights: number[] = [];
        const gcTotalWeight = childPlan.children.reduce((s, c) => s + c.weight, 0);
        for (const grandchild of childPlan.children) {
          const fraction = gcTotalWeight > 0 ? grandchild.weight / gcTotalWeight : 1 / gcCount;
          gcRawHeights.push(gcUsable * fraction);
          const gm = measureMap?.get(grandchild.id);
          gcMinHeights.push(gm ? gm.minHeight : 0);
        }
        const gcFinalHeights = redistributeWithMinimums(gcRawHeights, gcMinHeights, gcUsable);

        let childY = innerBounds.y;
        for (let j = 0; j < childPlan.children.length; j++) {
          const gcBounds: IRBounds = {
            x: innerBounds.x,
            y: childY,
            w: innerBounds.w,
            h: gcFinalHeights[j],
          };
          boundsMap.set(childPlan.children[j].id, gcBounds);
          childY += gcFinalHeights[j] + childGap;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Block-type-aware child sizing
// ---------------------------------------------------------------------------

/**
 * Compute LayoutChild sizes for a block's children based on the block type
 * and available bounds. This is the core of the top-down space allocation.
 *
 * - stack col: full width, height proportional to weight
 * - stack row: full height, width proportional to weight
 * - grid: uniform cell sizes (bounds ÷ cols/rows)
 * - flow/tree: weight-based area allocation with aspect hint
 * - layers: full width, uniform height
 * - group: stacked vertically with padding, proportional height
 */
export function computeLayoutChildren(
  plan: LayoutPlanNode,
  bounds: IRBounds,
  scaleCtx?: ScaleContext,
  measureMap?: MeasureMap,
): LayoutChild[] {
  const block = plan.astNode;
  if (block.kind !== 'block') return [];

  const props = block.props;
  const n = plan.children.length;
  if (n === 0) return [];

  const totalWeight = plan.children.reduce((s, c) => s + c.weight, 0);
  const defaultGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'siblingGap') : 3;
  const gap = typeof props.gap === 'number' ? props.gap : defaultGap;

  switch (block.blockType) {
    case 'stack': {
      const dir = (props.direction as string) ?? 'col';
      if (dir === 'row') {
        const usable = bounds.w - gap * Math.max(n - 1, 0);
        const rawWidths = plan.children.map(c => {
          const hasExplicitW = c.astNode.kind === 'element' && typeof c.astNode.props.width === 'number';
          return hasExplicitW ? c.intrinsicSize.width : (totalWeight > 0 ? usable * (c.weight / totalWeight) : usable / n);
        });
        const minWidths = plan.children.map(c => {
          const m = measureMap?.get(c.id);
          return m ? m.minWidth : 0;
        });
        const finalWidths = redistributeWithMinimums(rawWidths, minWidths, usable);
        return plan.children.map((c, i) => ({
          id: c.id,
          width: finalWidths[i],
          height: bounds.h,
        }));
      } else {
        const usable = bounds.h - gap * Math.max(n - 1, 0);
        const rawHeights = plan.children.map(c => {
          const hasExplicitH = c.astNode.kind === 'element' && typeof c.astNode.props.height === 'number';
          return hasExplicitH ? c.intrinsicSize.height : (totalWeight > 0 ? usable * (c.weight / totalWeight) : usable / n);
        });
        const minHeights = plan.children.map(c => {
          const m = measureMap?.get(c.id);
          return m ? m.minHeight : 0;
        });
        const finalHeights = redistributeWithMinimums(rawHeights, minHeights, usable);
        return plan.children.map((c, i) => ({
          id: c.id,
          width: bounds.w,
          height: finalHeights[i],
        }));
      }
    }

    case 'grid': {
      const cols = typeof props.cols === 'number' ? props.cols : 2;
      const rows = Math.ceil(n / cols);
      const cellW = (bounds.w - gap * Math.max(cols - 1, 0)) / cols;
      const cellH = (bounds.h - gap * Math.max(rows - 1, 0)) / rows;
      return plan.children.map(c => ({
        id: c.id,
        width: cellW,
        height: cellH,
      }));
    }

    case 'flow': {
      const defaultFlowGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'connectorGap') : 5;
      const flowGap = typeof props.gap === 'number' ? props.gap : defaultFlowGap;
      const dir = (props.direction as string) ?? 'right';
      const isHorizontal = dir === 'right' || dir === 'left';
      const mainAxis = isHorizontal ? bounds.w : bounds.h;
      const crossAxis = isHorizontal ? bounds.h : bounds.w;

      const nodeIds = plan.children.map(c => c.id);
      const layerInfo = computeFlowLayerInfo(nodeIds, plan.edges);
      const layerMainSize = (mainAxis - flowGap * Math.max(layerInfo.layerCount - 1, 0)) / Math.max(layerInfo.layerCount, 1);

      return plan.children.map(c => {
        const layer = layerInfo.nodeLayer.get(c.id) ?? 0;
        const nodesInLayer = layerInfo.nodesPerLayer[layer] ?? 1;
        const nodeCross = (crossAxis - flowGap * Math.max(nodesInLayer - 1, 0)) / Math.max(nodesInLayer, 1);
        const cappedCross = nodesInLayer === 1 ? Math.min(nodeCross, crossAxis * 0.6) : nodeCross;

        if (isHorizontal) {
          return { id: c.id, width: Math.max(layerMainSize, 4), height: Math.max(cappedCross, 3) };
        }
        return { id: c.id, width: Math.max(cappedCross, 4), height: Math.max(layerMainSize, 3) };
      });
    }

    case 'tree': {
      const defaultLevelGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'connectorGap') : 5;
      const levelGap = typeof props.gap === 'number' ? props.gap : defaultLevelGap;
      const siblingGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'siblingGap') : 3;
      const dir = (props.direction as string) ?? 'down';
      const isHorizontal = dir === 'right' || dir === 'left';
      const mainAxis = isHorizontal ? bounds.w : bounds.h;
      const crossAxis = isHorizontal ? bounds.h : bounds.w;

      const nodeIds = plan.children.map(c => c.id);
      const levelInfo = computeTreeLevelInfo(nodeIds, plan.edges);
      const levelHeight = (mainAxis - levelGap * Math.max(levelInfo.numLevels - 1, 0)) / Math.max(levelInfo.numLevels, 1);

      // Uniform width based on widest level — all nodes same cross-axis size
      const maxNodesPerLevel = Math.max(...levelInfo.nodesPerLevel, 1);
      const uniformWidth = (crossAxis - siblingGap * Math.max(maxNodesPerLevel - 1, 0)) / Math.max(maxNodesPerLevel, 1);

      return plan.children.map(c => {
        if (isHorizontal) {
          return { id: c.id, width: Math.max(levelHeight, 4), height: Math.max(uniformWidth, 3) };
        }
        return { id: c.id, width: Math.max(uniformWidth, 4), height: Math.max(levelHeight, 3) };
      });
    }

    case 'layers': {
      const defaultLayerGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'siblingGap') : 2;
      const layerGap = typeof props.gap === 'number' ? props.gap : defaultLayerGap;
      const layerH = (bounds.h - layerGap * Math.max(n - 1, 0)) / n;
      return plan.children.map(c => ({
        id: c.id,
        width: bounds.w,
        height: layerH,
      }));
    }

    case 'group': {
      const defaultPadding = scaleCtx ? computePadding(scaleCtx.baseUnit) : 3;
      const padding = typeof props.padding === 'number' ? props.padding : defaultPadding;
      const innerH = bounds.h - padding * 2;
      const innerW = bounds.w - padding * 2;
      const usable = innerH - gap * Math.max(n - 1, 0);
      return plan.children.map(c => ({
        id: c.id,
        width: innerW,
        height: totalWeight > 0 ? usable * (c.weight / totalWeight) : usable / n,
      }));
    }

    case 'canvas':
    default: {
      // canvas/default: stack col behaviour
      const usable = bounds.h - gap * Math.max(n - 1, 0);
      return plan.children.map(c => ({
        id: c.id,
        width: bounds.w,
        height: totalWeight > 0 ? usable * (c.weight / totalWeight) : usable / n,
      }));
    }
  }
}

// ---------------------------------------------------------------------------
// Layout dispatch (moved from emit-ir.ts)
// ---------------------------------------------------------------------------

export function runLayout(
  blockType: string,
  children: LayoutChild[],
  props: Record<string, string | number>,
  bounds: IRBounds,
  edges: ASTEdge[],
  scaleCtx?: ScaleContext,
): LayoutResult {
  const defaultGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'siblingGap') : 3;
  const gap = typeof props.gap === 'number' ? props.gap : defaultGap;

  switch (blockType) {
    case 'stack':
      return layoutStack(children, {
        bounds,
        direction: (props.direction as 'row' | 'col') ?? 'col',
        gap,
        align: (props.align as 'start' | 'center' | 'end' | 'stretch') ?? 'stretch',
        wrap: props.wrap === 'true' || props.wrap === 1,
      });

    case 'grid':
      return layoutGrid(children, {
        bounds,
        cols: typeof props.cols === 'number' ? props.cols : 2,
        gap,
      });

    case 'flow': {
      const flowEdges = edges.map(e => ({ fromId: e.fromId, toId: e.toId }));
      const defaultFlowGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'connectorGap') : 5;
      const baseGap = typeof props.gap === 'number' ? props.gap : defaultFlowGap;
      const dir = (props.direction as 'right' | 'left' | 'down' | 'up') ?? 'right';
      const isHz = dir === 'right' || dir === 'left';
      const mainAvail = isHz ? bounds.w : bounds.h;
      // When edges exist, ensure gap is proportional to available space
      const flowGap = flowEdges.length > 0
        ? Math.max(baseGap, mainAvail / (2 * children.length))
        : baseGap;
      return layoutFlow(children, {
        bounds,
        direction: dir,
        gap: flowGap,
        edges: flowEdges,
      });
    }

    case 'tree': {
      const treeNodes = buildTreeNodes(children, edges);
      const defaultLevelGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'connectorGap') : 5;
      const defaultSiblingGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'siblingGap') : 3;
      const baseLevelGap = typeof props.gap === 'number' ? props.gap : defaultLevelGap;
      const treeDir = (props.direction as 'down' | 'right' | 'up' | 'left') ?? 'down';
      const isTreeHz = treeDir === 'right' || treeDir === 'left';
      const treeMainAvail = isTreeHz ? bounds.w : bounds.h;
      // When edges exist, ensure level gap is proportional to available space
      const treeLevelGap = edges.length > 0
        ? Math.max(baseLevelGap, treeMainAvail / (2 * children.length))
        : baseLevelGap;
      return layoutTree(treeNodes, {
        bounds,
        direction: treeDir,
        levelGap: treeLevelGap,
        siblingGap: typeof props.gap === 'number' ? props.gap : defaultSiblingGap,
      });
    }

    case 'group': {
      const defaultGroupPadding = scaleCtx ? computePadding(scaleCtx.baseUnit) : 3;
      return layoutGroup(children, {
        bounds,
        padding: typeof props.padding === 'number' ? props.padding : defaultGroupPadding,
      });
    }

    case 'layers': {
      const defaultLayersGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'siblingGap') : 2;
      return layoutLayers(children, {
        bounds,
        gap: typeof props.gap === 'number' ? props.gap : defaultLayersGap,
      });
    }

    case 'canvas':
    default:
      return layoutStack(children, {
        bounds,
        direction: 'col',
        gap,
        align: 'stretch',
        wrap: false,
      });
  }
}

// ---------------------------------------------------------------------------
// Tree node conversion (moved from emit-ir.ts)
// ---------------------------------------------------------------------------

export function buildTreeNodes(
  children: LayoutChild[],
  edges: ASTEdge[],
): TreeNode[] {
  if (children.length === 0) return [];

  const idToIndex = new Map<string, number>();
  children.forEach((child, i) => idToIndex.set(child.id, i));

  const childrenMap = new Map<number, number[]>();
  children.forEach((_, i) => childrenMap.set(i, []));

  const hasParent = new Set<number>();
  for (const edge of edges) {
    const fromIdx = idToIndex.get(edge.fromId);
    const toIdx = idToIndex.get(edge.toId);
    if (fromIdx !== undefined && toIdx !== undefined) {
      childrenMap.get(fromIdx)!.push(toIdx);
      hasParent.add(toIdx);
    }
  }

  const treeNodes: TreeNode[] = children.map((child, i) => ({
    id: child.id,
    width: child.width,
    height: child.height,
    children: childrenMap.get(i) ?? [],
  }));

  // Ensure root (node without parent) is at index 0
  const rootIndex = treeNodes.findIndex((_, i) => !hasParent.has(i));
  if (rootIndex > 0) {
    const indexMap = new Map<number, number>();
    indexMap.set(0, rootIndex);
    indexMap.set(rootIndex, 0);

    const temp = treeNodes[0];
    treeNodes[0] = treeNodes[rootIndex];
    treeNodes[rootIndex] = temp;

    for (const node of treeNodes) {
      node.children = node.children.map(ci =>
        indexMap.has(ci) ? indexMap.get(ci)! : ci,
      );
    }
  }

  return treeNodes;
}

// ---------------------------------------------------------------------------
// Height/width redistribution with minimum constraints
// ---------------------------------------------------------------------------

/**
 * Redistribute sizes so that each item is at least its minimum.
 *
 * Items below their minimum are clamped up; the excess is taken
 * proportionally from items that have surplus above their minimum.
 * If total minimums exceed available space, each gets its minimum
 * (may overflow — the measure pass should prevent this in practice).
 */
export function redistributeWithMinimums(
  raw: number[],
  mins: number[],
  total: number,
): number[] {
  const n = raw.length;
  if (n === 0) return [];

  // Overflow compression: when total minimums exceed available space,
  // scale down minimums proportionally to fit within the budget.
  const totalMin = mins.reduce((s, v) => s + v, 0);
  const effectiveMins = totalMin > total && totalMin > 0
    ? mins.map(m => m * (total / totalMin))
    : mins;

  const result = raw.slice();

  // Clamp up to minimums
  let deficit = 0;
  for (let i = 0; i < n; i++) {
    if (result[i] < effectiveMins[i]) {
      deficit += effectiveMins[i] - result[i];
      result[i] = effectiveMins[i];
    }
  }

  if (deficit <= 0) return result;

  // Collect surplus from items above their minimum
  let totalSurplus = 0;
  for (let i = 0; i < n; i++) {
    const surplus = result[i] - effectiveMins[i];
    if (surplus > 0) totalSurplus += surplus;
  }

  if (totalSurplus <= 0) return result;

  // Take proportionally from surplus items
  const take = Math.min(deficit, totalSurplus);
  for (let i = 0; i < n; i++) {
    const surplus = result[i] - effectiveMins[i];
    if (surplus > 0) {
      const reduction = take * (surplus / totalSurplus);
      result[i] -= reduction;
    }
  }

  return result;
}
