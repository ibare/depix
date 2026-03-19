/**
 * Compiler Pass — Compute Constraints (Bottom-up)
 *
 * Collects minimum/maximum size constraints for each plan node
 * using iterative post-order traversal. Leaf nodes get fixed
 * minimums; container nodes aggregate children's constraints
 * based on their layout intent.
 *
 * Pipeline: DiagramLayoutPlan + ScaleContext → ConstraintMap
 */

import type { NodeConstraint, ConstraintMap } from './budget-types.js';
import type { LayoutPlanNode, DiagramLayoutPlan } from './plan-layout.js';
import type { ScaleContext } from './scale-system.js';
import { computeGap, computePadding } from './scale-system.js';
import { getElementConfig } from '../element-type-registry.js';
import { computeTreeLevelInfo, computeFlowLayerInfo } from './layout-analysis.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function computeConstraints(
  plan: DiagramLayoutPlan,
  scaleCtx: ScaleContext,
): ConstraintMap {
  const constraints: ConstraintMap = new Map();

  for (const child of plan.children) {
    computeNodeConstraints(child, scaleCtx, constraints);
  }

  return constraints;
}

// ---------------------------------------------------------------------------
// Iterative post-order traversal (2-stack method)
// ---------------------------------------------------------------------------

function computeNodeConstraints(
  root: LayoutPlanNode,
  scaleCtx: ScaleContext,
  constraints: ConstraintMap,
): void {
  // 2-stack iterative post-order: push to stack1, pop to stack2,
  // then process stack2 in reverse (guarantees children before parents)
  const stack1: LayoutPlanNode[] = [root];
  const stack2: LayoutPlanNode[] = [];

  while (stack1.length > 0) {
    const node = stack1.pop()!;
    stack2.push(node);
    for (const child of node.children) {
      stack1.push(child);
    }
  }

  // Process in reverse order (children first, then parents)
  for (let i = stack2.length - 1; i >= 0; i--) {
    const node = stack2[i];
    const constraint = computeSingleConstraint(node, scaleCtx, constraints);
    constraints.set(node.id, constraint);
  }
}

// ---------------------------------------------------------------------------
// Single node constraint computation
// ---------------------------------------------------------------------------

function computeSingleConstraint(
  node: LayoutPlanNode,
  scaleCtx: ScaleContext,
  constraints: ConstraintMap,
): NodeConstraint {
  const astNode = node.astNode;

  // Leaf element (no children or element kind)
  if (astNode.kind === 'element' && node.children.length === 0) {
    return computeLeafConstraint(node);
  }

  // Element with children (e.g. shape with nested elements)
  if (astNode.kind === 'element' && node.children.length > 0) {
    return computeBoxConstraint(node, scaleCtx, constraints);
  }

  // Block node — dispatch by block type
  if (astNode.kind === 'block') {
    return computeBlockConstraint(node, astNode.blockType, scaleCtx, constraints);
  }

  return computeLeafConstraint(node);
}

// ---------------------------------------------------------------------------
// Leaf constraints
// ---------------------------------------------------------------------------

function computeLeafConstraint(node: LayoutPlanNode): NodeConstraint {
  const astNode = node.astNode;
  const hasExplicitW = astNode.kind === 'element' && typeof astNode.props.width === 'number';
  const hasExplicitH = astNode.kind === 'element' && typeof astNode.props.height === 'number';

  let minW: number;
  let minH: number;

  if (astNode.kind === 'element') {
    const config = getElementConfig(astNode.elementType);
    minW = config.constraint.minW;
    minH = config.constraint.minH;
  } else {
    minW = 4;
    minH = 3;
  }

  const explicitW = hasExplicitW ? (astNode.props.width as number) : undefined;
  const explicitH = hasExplicitH ? (astNode.props.height as number) : undefined;

  return {
    minWidth: explicitW ?? minW,
    maxWidth: explicitW ?? Infinity,
    minHeight: explicitH ?? minH,
    maxHeight: explicitH ?? Infinity,
    pinnedWidth: hasExplicitW,
    pinnedHeight: hasExplicitH,
  };
}

// ---------------------------------------------------------------------------
// Box/layer constraint (element with children — vertical stack)
// ---------------------------------------------------------------------------

function computeBoxConstraint(
  node: LayoutPlanNode,
  scaleCtx: ScaleContext,
  constraints: ConstraintMap,
): NodeConstraint {
  const padding = computePadding(scaleCtx.baseUnit);
  const gap = computeGap(scaleCtx.baseUnit, 'childGap');
  const n = node.children.length;

  let maxChildMinW = 0;
  let sumChildMinH = 0;

  for (let i = 0; i < n; i++) {
    const cc = constraints.get(node.children[i].id);
    if (cc) {
      if (cc.minWidth > maxChildMinW) maxChildMinW = cc.minWidth;
      sumChildMinH += cc.minHeight;
    }
    if (i < n - 1) sumChildMinH += gap;
  }

  return {
    minWidth: maxChildMinW + padding * 2,
    maxWidth: Infinity,
    minHeight: sumChildMinH + padding * 2,
    maxHeight: Infinity,
  };
}

// ---------------------------------------------------------------------------
// Block constraint (dispatch by layout type)
// ---------------------------------------------------------------------------

function computeBlockConstraint(
  node: LayoutPlanNode,
  blockType: string,
  scaleCtx: ScaleContext,
  constraints: ConstraintMap,
): NodeConstraint {
  const n = node.children.length;
  if (n === 0) {
    return { minWidth: 0, maxWidth: Infinity, minHeight: 0, maxHeight: Infinity };
  }

  const props = node.astNode.kind === 'block' ? node.astNode.props : {};
  const defaultGap = computeGap(scaleCtx.baseUnit, 'siblingGap');
  const gap = typeof props.gap === 'number' ? props.gap : defaultGap;

  switch (blockType) {
    case 'stack': {
      const dir = (props.direction as string) ?? 'col';
      return dir === 'row'
        ? computeStackRowConstraint(node, gap, constraints)
        : computeStackColConstraint(node, gap, constraints);
    }
    case 'grid':
      return computeGridConstraint(node, gap, props, constraints);
    case 'layers':
      return computeLayersConstraint(node, gap, constraints);
    case 'group':
      return computeGroupConstraint(node, gap, scaleCtx, props, constraints);
    case 'tree':
      return computeTreeConstraint(node, gap, scaleCtx, constraints);
    case 'flow':
      return computeFlowConstraint(node, gap, scaleCtx, constraints);
    case 'box':
    case 'layer':
      return computeStackColConstraint(node, gap, constraints);
    default:
      return computeStackColConstraint(node, gap, constraints);
  }
}

// ---------------------------------------------------------------------------
// Stack col: minW = max(child.minW), minH = sum(child.minH) + gaps
// ---------------------------------------------------------------------------

function computeStackColConstraint(
  node: LayoutPlanNode,
  gap: number,
  constraints: ConstraintMap,
): NodeConstraint {
  const n = node.children.length;
  let maxMinW = 0;
  let sumMinH = 0;

  for (let i = 0; i < n; i++) {
    const cc = constraints.get(node.children[i].id);
    if (cc) {
      if (cc.minWidth > maxMinW) maxMinW = cc.minWidth;
      sumMinH += cc.minHeight;
    }
    if (i < n - 1) sumMinH += gap;
  }

  return { minWidth: maxMinW, maxWidth: Infinity, minHeight: sumMinH, maxHeight: Infinity };
}

// ---------------------------------------------------------------------------
// Stack row: minW = sum(child.minW) + gaps, minH = max(child.minH)
// ---------------------------------------------------------------------------

function computeStackRowConstraint(
  node: LayoutPlanNode,
  gap: number,
  constraints: ConstraintMap,
): NodeConstraint {
  const n = node.children.length;
  let sumMinW = 0;
  let maxMinH = 0;

  for (let i = 0; i < n; i++) {
    const cc = constraints.get(node.children[i].id);
    if (cc) {
      sumMinW += cc.minWidth;
      if (cc.minHeight > maxMinH) maxMinH = cc.minHeight;
    }
    if (i < n - 1) sumMinW += gap;
  }

  return { minWidth: sumMinW, maxWidth: Infinity, minHeight: maxMinH, maxHeight: Infinity };
}

// ---------------------------------------------------------------------------
// Grid: minW = cols * max(child.minW) + gaps, minH = rows * max(child.minH) + gaps
// ---------------------------------------------------------------------------

function computeGridConstraint(
  node: LayoutPlanNode,
  gap: number,
  props: Record<string, string | number>,
  constraints: ConstraintMap,
): NodeConstraint {
  const cols = typeof props.cols === 'number' ? props.cols : 2;
  const n = node.children.length;
  const rows = Math.ceil(n / cols);

  let maxMinW = 0;
  let maxMinH = 0;

  for (const child of node.children) {
    const cc = constraints.get(child.id);
    if (cc) {
      if (cc.minWidth > maxMinW) maxMinW = cc.minWidth;
      if (cc.minHeight > maxMinH) maxMinH = cc.minHeight;
    }
  }

  return {
    minWidth: cols * maxMinW + gap * Math.max(cols - 1, 0),
    maxWidth: Infinity,
    minHeight: rows * maxMinH + gap * Math.max(rows - 1, 0),
    maxHeight: Infinity,
  };
}

// ---------------------------------------------------------------------------
// Layers: minW = max(child.minW), minH = sum(child.minH) + gaps
// ---------------------------------------------------------------------------

function computeLayersConstraint(
  node: LayoutPlanNode,
  gap: number,
  constraints: ConstraintMap,
): NodeConstraint {
  const n = node.children.length;
  let maxMinW = 0;
  let sumMinH = 0;

  for (let i = 0; i < n; i++) {
    const cc = constraints.get(node.children[i].id);
    if (cc) {
      if (cc.minWidth > maxMinW) maxMinW = cc.minWidth;
      sumMinH += cc.minHeight;
    }
    if (i < n - 1) sumMinH += gap;
  }

  return { minWidth: maxMinW, maxWidth: Infinity, minHeight: sumMinH, maxHeight: Infinity };
}

// ---------------------------------------------------------------------------
// Group: minW = max(child.minW) + padding*2, minH = sum(child.minH) + gaps + padding*2
// ---------------------------------------------------------------------------

function computeGroupConstraint(
  node: LayoutPlanNode,
  gap: number,
  scaleCtx: ScaleContext,
  props: Record<string, string | number>,
  constraints: ConstraintMap,
): NodeConstraint {
  const n = node.children.length;
  const defaultPadding = computePadding(scaleCtx.baseUnit);
  const padding = typeof props.padding === 'number' ? props.padding : defaultPadding;

  let maxMinW = 0;
  let sumMinH = 0;

  for (let i = 0; i < n; i++) {
    const cc = constraints.get(node.children[i].id);
    if (cc) {
      if (cc.minWidth > maxMinW) maxMinW = cc.minWidth;
      sumMinH += cc.minHeight;
    }
    if (i < n - 1) sumMinH += gap;
  }

  return {
    minWidth: maxMinW + padding * 2,
    maxWidth: Infinity,
    minHeight: sumMinH + padding * 2,
    maxHeight: Infinity,
  };
}

// ---------------------------------------------------------------------------
// Tree: level-based constraint
// ---------------------------------------------------------------------------

function computeTreeConstraint(
  node: LayoutPlanNode,
  gap: number,
  scaleCtx: ScaleContext,
  constraints: ConstraintMap,
): NodeConstraint {
  const n = node.children.length;
  if (n === 0) return { minWidth: 0, maxWidth: Infinity, minHeight: 0, maxHeight: Infinity };

  const props = node.astNode.kind === 'block' ? node.astNode.props : {};
  const dir = (props.direction as string) ?? 'down';
  const isHorizontal = dir === 'right' || dir === 'left';

  const edges = node.edges;
  const nodeIds = node.children.map(c => c.id);
  const levelInfo = computeTreeLevelInfo(nodeIds, edges);

  // Find max child minW and minH
  let maxChildMinW = 0;
  let maxChildMinH = 0;
  for (const child of node.children) {
    const cc = constraints.get(child.id);
    if (cc) {
      if (cc.minWidth > maxChildMinW) maxChildMinW = cc.minWidth;
      if (cc.minHeight > maxChildMinH) maxChildMinH = cc.minHeight;
    }
  }

  const levelGap = typeof props.gap === 'number' ? props.gap : computeGap(scaleCtx.baseUnit, 'connectorGap');
  const siblingGap = computeGap(scaleCtx.baseUnit, 'siblingGap');
  const maxNodesPerLevel = Math.max(...levelInfo.nodesPerLevel, 1);

  if (isHorizontal) {
    return {
      minWidth: levelInfo.numLevels * maxChildMinW + (levelInfo.numLevels - 1) * levelGap,
      maxWidth: Infinity,
      minHeight: maxNodesPerLevel * maxChildMinH + (maxNodesPerLevel - 1) * siblingGap,
      maxHeight: Infinity,
    };
  }
  return {
    minWidth: maxNodesPerLevel * maxChildMinW + (maxNodesPerLevel - 1) * siblingGap,
    maxWidth: Infinity,
    minHeight: levelInfo.numLevels * maxChildMinH + (levelInfo.numLevels - 1) * levelGap,
    maxHeight: Infinity,
  };
}

// ---------------------------------------------------------------------------
// Flow: layer-based constraint
// ---------------------------------------------------------------------------

function computeFlowConstraint(
  node: LayoutPlanNode,
  gap: number,
  scaleCtx: ScaleContext,
  constraints: ConstraintMap,
): NodeConstraint {
  const n = node.children.length;
  if (n === 0) return { minWidth: 0, maxWidth: Infinity, minHeight: 0, maxHeight: Infinity };

  const props = node.astNode.kind === 'block' ? node.astNode.props : {};
  const dir = (props.direction as string) ?? 'right';
  const isHorizontal = dir === 'right' || dir === 'left';

  const edges = node.edges;
  const nodeIds = node.children.map(c => c.id);
  const layerInfo = computeFlowLayerInfo(nodeIds, edges);

  let maxChildMinW = 0;
  let maxChildMinH = 0;
  for (const child of node.children) {
    const cc = constraints.get(child.id);
    if (cc) {
      if (cc.minWidth > maxChildMinW) maxChildMinW = cc.minWidth;
      if (cc.minHeight > maxChildMinH) maxChildMinH = cc.minHeight;
    }
  }

  const maxNodesPerLayer = Math.max(...layerInfo.nodesPerLayer, 1);

  if (isHorizontal) {
    return {
      minWidth: layerInfo.layerCount * maxChildMinW + (layerInfo.layerCount - 1) * gap,
      maxWidth: Infinity,
      minHeight: maxNodesPerLayer * maxChildMinH + (maxNodesPerLayer - 1) * gap,
      maxHeight: Infinity,
    };
  }
  return {
    minWidth: maxNodesPerLayer * maxChildMinW + (maxNodesPerLayer - 1) * gap,
    maxWidth: Infinity,
    minHeight: layerInfo.layerCount * maxChildMinH + (layerInfo.layerCount - 1) * gap,
    maxHeight: Infinity,
  };
}
