/**
 * Compiler Pass — Compute Constraints (Bottom-up)
 *
 * Collects minimum/maximum size constraints for each plan node
 * using iterative post-order traversal. Leaf nodes get fixed
 * minimums; container nodes aggregate children's constraints
 * based on their layout intent.
 *
 * Pipeline: SceneLayoutPlan + ScaleContext → ConstraintMap
 */

import type { NodeConstraint, ConstraintMap } from './budget-types.js';
import type { LayoutPlanNode, SceneLayoutPlan } from './plan-layout.js';
import type { ScaleContext } from './scale-system.js';
import { computeGap, computePadding } from './scale-system.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function computeConstraints(
  plan: SceneLayoutPlan,
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

  // Element with children (box/layer with nested elements)
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
    switch (astNode.elementType) {
      case 'node':
      case 'cell':
      case 'rect':
      case 'circle':
      case 'badge':
      case 'icon':
        minW = 4;
        minH = 3;
        break;
      case 'text':
      case 'label':
        minW = 2;
        minH = 1;
        break;
      case 'box':
      case 'layer':
        minW = 4;
        minH = 3;
        break;
      case 'list':
        minW = 3;
        minH = 2;
        break;
      case 'divider':
      case 'line':
        minW = 1;
        minH = 0.5;
        break;
      case 'image':
        minW = 4;
        minH = 3;
        break;
      default:
        minW = 4;
        minH = 3;
    }
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
    case 'flow':
      return computeIntrinsicFallbackConstraint(node);
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
// Tree/flow fallback: use intrinsicSize
// ---------------------------------------------------------------------------

function computeIntrinsicFallbackConstraint(
  node: LayoutPlanNode,
): NodeConstraint {
  const w = node.intrinsicSize.width || 4;
  const h = node.intrinsicSize.height || 3;
  return { minWidth: w, maxWidth: Infinity, minHeight: h, maxHeight: Infinity };
}
