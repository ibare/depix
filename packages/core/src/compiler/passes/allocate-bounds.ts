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
import type { ScaleContext } from './scale-system.js';
import { computeGap, computePadding } from './scale-system.js';

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
): BoundsMap {
  const boundsMap: BoundsMap = new Map();

  if (plan.children.length === 0) return boundsMap;

  const gap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'sectionGap') : 3;
  const usableHeight = canvasBounds.h - gap * (plan.children.length - 1);

  let currentY = canvasBounds.y;
  for (const child of plan.children) {
    const fraction = plan.totalWeight > 0 ? child.weight / plan.totalWeight : 1 / plan.children.length;
    const childH = usableHeight * fraction;
    const childBounds: IRBounds = {
      x: canvasBounds.x,
      y: currentY,
      w: canvasBounds.w,
      h: childH,
    };

    allocateNode(child, childBounds, boundsMap, scaleCtx);
    currentY += childH + gap;
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
): void {
  if (plan.astNode.kind === 'block') {
    allocateBlock(plan, availBounds, boundsMap, scaleCtx);
  } else {
    allocateLeaf(plan, availBounds, boundsMap, scaleCtx);
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
): void {
  const node = plan.astNode;
  const hasExplicitW = node.kind === 'element' && typeof node.props.width === 'number';
  const hasExplicitH = node.kind === 'element' && typeof node.props.height === 'number';

  const bounds: IRBounds = {
    x: availBounds.x,
    y: availBounds.y,
    w: hasExplicitW ? plan.intrinsicSize.width : availBounds.w,
    h: hasExplicitH ? plan.intrinsicSize.height : availBounds.h,
  };

  boundsMap.set(plan.id, bounds);

  // Handle children of box/layer/shape-with-children
  if (plan.children.length > 0) {
    const padding = scaleCtx ? computePadding(scaleCtx.baseUnit) : 2;
    const innerBounds: IRBounds = {
      x: bounds.x + padding,
      y: bounds.y + padding,
      w: Math.max(bounds.w - padding * 2, 1),
      h: Math.max(bounds.h - padding * 2, 1),
    };
    const childGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'childGap') : 1;
    const childCount = plan.children.length;
    const childUsable = innerBounds.h - childGap * Math.max(childCount - 1, 0);
    const totalChildWeight = plan.children.reduce((s, c) => s + c.weight, 0);

    let childY = innerBounds.y;
    for (const child of plan.children) {
      const fraction = totalChildWeight > 0 ? child.weight / totalChildWeight : 1 / childCount;
      const childH = childUsable * fraction;
      const childBounds: IRBounds = {
        x: innerBounds.x,
        y: childY,
        w: innerBounds.w,
        h: childH,
      };
      boundsMap.set(child.id, childBounds);
      childY += childH + childGap;
    }
  }
}

function allocateBlock(
  plan: LayoutPlanNode,
  availBounds: IRBounds,
  boundsMap: BoundsMap,
  scaleCtx?: ScaleContext,
): void {
  const block = plan.astNode;
  if (block.kind !== 'block') return;

  const blockType = block.blockType;
  const props = block.props;

  // Build LayoutChild[] with sizes proportional to available bounds
  const layoutChildren = computeLayoutChildren(plan, availBounds, scaleCtx);

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
      allocateNode(childPlan, childBounds, boundsMap, scaleCtx);
    } else {
      // For leaf elements inside a layout, use the bounds from the layout algorithm
      boundsMap.set(childPlan.id, childBounds);

      // Handle nested children (box/layer elements with children)
      if (childPlan.children.length > 0) {
        const padding = scaleCtx ? computePadding(scaleCtx.baseUnit) : 2;
        const innerBounds: IRBounds = {
          x: childBounds.x + padding,
          y: childBounds.y + padding,
          w: Math.max(childBounds.w - padding * 2, 1),
          h: Math.max(childBounds.h - padding * 2, 1),
        };
        const childGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'childGap') : 1;
        const gcCount = childPlan.children.length;
        const gcUsable = innerBounds.h - childGap * Math.max(gcCount - 1, 0);
        const gcTotalWeight = childPlan.children.reduce((s, c) => s + c.weight, 0);

        let childY = innerBounds.y;
        for (const grandchild of childPlan.children) {
          const fraction = gcTotalWeight > 0 ? grandchild.weight / gcTotalWeight : 1 / gcCount;
          const gcH = gcUsable * fraction;
          const gcBounds: IRBounds = {
            x: innerBounds.x,
            y: childY,
            w: innerBounds.w,
            h: gcH,
          };
          boundsMap.set(grandchild.id, gcBounds);
          childY += gcH + childGap;
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
        return plan.children.map(c => {
          const hasExplicitW = c.astNode.kind === 'element' && typeof c.astNode.props.width === 'number';
          return {
            id: c.id,
            width: hasExplicitW ? c.intrinsicSize.width : (totalWeight > 0 ? usable * (c.weight / totalWeight) : usable / n),
            height: bounds.h,
          };
        });
      } else {
        const usable = bounds.h - gap * Math.max(n - 1, 0);
        return plan.children.map(c => {
          const hasExplicitH = c.astNode.kind === 'element' && typeof c.astNode.props.height === 'number';
          return {
            id: c.id,
            width: bounds.w,
            height: hasExplicitH ? c.intrinsicSize.height : (totalWeight > 0 ? usable * (c.weight / totalWeight) : usable / n),
          };
        });
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
      const totalArea = bounds.w * bounds.h;
      return plan.children.map(c => {
        const frac = totalWeight > 0 ? c.weight / totalWeight : 1 / n;
        const area = totalArea * frac;
        const aspect = 1.5;
        const w = Math.min(Math.sqrt(area * aspect), bounds.w - flowGap);
        const h = Math.min(area / Math.max(w, 1), bounds.h - flowGap);
        return { id: c.id, width: Math.max(w, 4), height: Math.max(h, 3) };
      });
    }

    case 'tree': {
      const totalArea = bounds.w * bounds.h;
      return plan.children.map(c => {
        const frac = totalWeight > 0 ? c.weight / totalWeight : 1 / n;
        const area = totalArea * frac;
        const aspect = 1.5;
        const w = Math.min(Math.sqrt(area * aspect), bounds.w * 0.4);
        const h = Math.min(area / Math.max(w, 1), bounds.h * 0.4);
        return { id: c.id, width: Math.max(w, 4), height: Math.max(h, 3) };
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
      return layoutFlow(children, {
        bounds,
        direction: (props.direction as 'right' | 'left' | 'down' | 'up') ?? 'right',
        gap: typeof props.gap === 'number' ? props.gap : defaultFlowGap,
        edges: flowEdges,
      });
    }

    case 'tree': {
      const treeNodes = buildTreeNodes(children, edges);
      const defaultLevelGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'connectorGap') : 5;
      const defaultSiblingGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'siblingGap') : 3;
      return layoutTree(treeNodes, {
        bounds,
        direction: (props.direction as 'down' | 'right' | 'up' | 'left') ?? 'down',
        levelGap: typeof props.gap === 'number' ? props.gap : defaultLevelGap,
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
