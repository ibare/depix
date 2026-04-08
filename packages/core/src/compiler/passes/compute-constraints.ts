/**
 * Compiler Pass — Compute Constraints (Bottom-up)
 *
 * Collects minimum/maximum size constraints for each plan node
 * using iterative post-order traversal. Leaf nodes get fixed
 * minimums; container nodes aggregate children's constraints
 * based on their layout intent.
 *
 * Pipeline: PlanNode + ScaleContext → ConstraintMap
 */

import type { NodeConstraint, ConstraintMap } from './budget-types.js';
import type { PlanNode } from '../layout/plan-types.js';
import type { ScaleContext } from './scale-system.js';
import { computeGap, computePadding } from './scale-system.js';
import { getElementConfig } from '../element-type-registry.js';
import { computeTreeLevelInfo, computeFlowLayerInfo } from './layout-analysis.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// 0.8: shape 요소 최대 너비 = baseUnit × 0.8. baseUnit = sqrt(canvasArea/n) × 0.55이므로
// 3노드 90×90 캔버스: baseUnit≈28.6, maxW≈22.9 (캔버스의 25.4%). 0–100 상대 좌표.
const SHAPE_MAX_W_FACTOR = 0.8;
// 0.6: shape 요소 최대 높이 = baseUnit × 0.6. maxH≈17.2 (캔버스의 19.1%). 0–100 상대 좌표.
const SHAPE_MAX_H_FACTOR = 0.6;
// 2.5: 텍스트/라벨 요소 최대 너비 = baseUnit × 2.5. 긴 제목도 단일 행 표시 가능. 0–100 상대 좌표.
const TEXT_MAX_W_FACTOR = 2.5;
// 0.5: 텍스트/라벨 요소 최대 높이 = baseUnit × 0.5. 단일 행 텍스트 높이에 해당. 0–100 상대 좌표.
const TEXT_MAX_H_FACTOR = 0.5;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function computeConstraints(
  plan: PlanNode,
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
  root: PlanNode,
  scaleCtx: ScaleContext,
  constraints: ConstraintMap,
): void {
  // 2-stack iterative post-order: push to stack1, pop to stack2,
  // then process stack2 in reverse (guarantees children before parents)
  const stack1: PlanNode[] = [root];
  const stack2: PlanNode[] = [];

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
  node: PlanNode,
  scaleCtx: ScaleContext,
  constraints: ConstraintMap,
): NodeConstraint {
  // Leaf element (no children or element kind)
  if (node.blockType.startsWith('element-') && node.children.length === 0) {
    return computeLeafConstraint(node, scaleCtx);
  }

  // Element with children (e.g. shape with nested elements)
  if (node.blockType.startsWith('element-') && node.children.length > 0) {
    return computeBoxConstraint(node, scaleCtx, constraints);
  }

  // Block node — dispatch by block type
  if (!node.blockType.startsWith('element-')) {
    return computeBlockConstraint(node, node.blockType, scaleCtx, constraints);
  }

  return computeLeafConstraint(node, scaleCtx);
}

// ---------------------------------------------------------------------------
// Leaf constraints
// ---------------------------------------------------------------------------

function computeLeafConstraint(node: PlanNode, scaleCtx: ScaleContext): NodeConstraint {
  const hasExplicitW = node.blockType.startsWith('element-') && typeof node.props.width === 'number';
  const hasExplicitH = node.blockType.startsWith('element-') && typeof node.props.height === 'number';

  let minW: number;
  let minH: number;
  let maxW: number;
  let maxH: number;

  if (node.blockType.startsWith('element-')) {
    const config = getElementConfig(node.props.elementType as string);
    minW = config.constraint.minW;
    minH = config.constraint.minH;

    // Content-aware max based on element measure type and scaleCtx.baseUnit
    switch (config.measure) {
      case 'shape':
        maxW = scaleCtx.baseUnit * SHAPE_MAX_W_FACTOR;
        maxH = scaleCtx.baseUnit * SHAPE_MAX_H_FACTOR;
        break;
      case 'text':
      case 'row':
        maxW = scaleCtx.baseUnit * TEXT_MAX_W_FACTOR;
        maxH = scaleCtx.baseUnit * TEXT_MAX_H_FACTOR;
        break;
      case 'list':
        maxW = scaleCtx.baseUnit * TEXT_MAX_W_FACTOR;
        maxH = scaleCtx.baseUnit * SHAPE_MAX_H_FACTOR;
        break;
      default:
        maxW = Infinity;
        maxH = Infinity;
    }
  } else {
    minW = 4;
    minH = 3;
    maxW = Infinity;
    maxH = Infinity;
  }

  const explicitW = hasExplicitW ? (node.props.width as number) : undefined;
  const explicitH = hasExplicitH ? (node.props.height as number) : undefined;

  return {
    minWidth: explicitW ?? minW,
    maxWidth: explicitW ?? maxW,
    minHeight: explicitH ?? minH,
    maxHeight: explicitH ?? maxH,
    pinnedWidth: hasExplicitW,
    pinnedHeight: hasExplicitH,
  };
}

// ---------------------------------------------------------------------------
// Box/layer constraint (element with children — vertical stack)
// ---------------------------------------------------------------------------

function computeBoxConstraint(
  node: PlanNode,
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
  node: PlanNode,
  blockType: string,
  scaleCtx: ScaleContext,
  constraints: ConstraintMap,
): NodeConstraint {
  const n = node.children.length;
  if (n === 0) {
    return { minWidth: 0, maxWidth: Infinity, minHeight: 0, maxHeight: Infinity };
  }

  const props = node.props;
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
  node: PlanNode,
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
  node: PlanNode,
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
  node: PlanNode,
  gap: number,
  props: Record<string, unknown>,
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
  node: PlanNode,
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
  node: PlanNode,
  gap: number,
  scaleCtx: ScaleContext,
  props: Record<string, unknown>,
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
  node: PlanNode,
  gap: number,
  scaleCtx: ScaleContext,
  constraints: ConstraintMap,
): NodeConstraint {
  const n = node.children.length;
  if (n === 0) return { minWidth: 0, maxWidth: Infinity, minHeight: 0, maxHeight: Infinity };

  const props = node.props;
  const dir = (props.direction as string) ?? 'down';
  const isHorizontal = dir === 'right' || dir === 'left';

  const edges = node.edges ?? [];
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
  node: PlanNode,
  gap: number,
  scaleCtx: ScaleContext,
  constraints: ConstraintMap,
): NodeConstraint {
  const n = node.children.length;
  if (n === 0) return { minWidth: 0, maxWidth: Infinity, minHeight: 0, maxHeight: Infinity };

  const props = node.props;
  const dir = (props.direction as string) ?? 'right';
  const isHorizontal = dir === 'right' || dir === 'left';

  const edges = node.edges ?? [];
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
