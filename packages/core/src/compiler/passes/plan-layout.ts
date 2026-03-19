/**
 * Compiler Pass — Plan Layout
 *
 * Performs structural analysis of the AST to produce a LayoutPlan tree.
 * Each node carries weight and metrics that drive top-down space allocation
 * in the subsequent allocate-bounds pass.
 *
 * Pipeline: AST → planDiagram() → DiagramLayoutPlan
 */

import type { DepixTheme } from '../../theme/types.js';
import type {
  ASTBlock,
  ASTEdge,
  ASTElement,
  ASTNode,
} from '../ast.js';
import { getElementConfig } from '../element-type-registry.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlanNodeType =
  | 'block-flow' | 'block-stack' | 'block-grid' | 'block-tree'
  | 'block-group' | 'block-layers' | 'block-canvas'
  | 'block-table' | 'block-chart'
  | 'block-visual'
  | 'element-shape' | 'element-text'
  | 'element-list' | 'element-divider' | 'element-image';

export interface PlanMetrics {
  descendantCount: number;
  childCount: number;
  maxDepth: number;
  blockChildCount: number;
  leafChildCount: number;
}

export interface LayoutPlanNode {
  id: string;
  astNode: ASTBlock | ASTElement;
  nodeType: PlanNodeType;
  children: LayoutPlanNode[];
  metrics: PlanMetrics;
  weight: number;
  intrinsicSize: { width: number; height: number };
  edges: ASTEdge[];
}

export interface DiagramLayoutPlan {
  children: LayoutPlanNode[];
  totalWeight: number;
}

// ---------------------------------------------------------------------------
// Base weight table
// ---------------------------------------------------------------------------

const BASE_WEIGHT: Record<PlanNodeType, number> = {
  'block-flow': 3.0,
  'block-stack': 2.5,
  'block-grid': 3.0,
  'block-tree': 3.5,
  'block-group': 2.0,
  'block-layers': 3.0,
  'block-canvas': 2.5,
  'block-table': 2.5,
  'block-chart': 3.0,
  'block-visual': 2.0,
  'element-shape': 1.0,
  'element-text': 0.6,
  'element-list': 1.2,
  'element-divider': 0.3,
  'element-image': 1.5,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyse a scene's AST and produce a LayoutPlan tree.
 *
 * Edges at scene level are collected but not represented as plan nodes
 * (they are routed after bounds allocation).
 */
export function planDiagram(scene: ASTBlock, theme: DepixTheme): DiagramLayoutPlan {
  const children: LayoutPlanNode[] = [];

  for (const child of scene.children) {
    if (child.kind === 'edge') continue;
    children.push(planNode(child, theme));
  }

  const totalWeight = children.reduce((sum, c) => sum + c.weight, 0);
  return { children, totalWeight };
}

/**
 * Recursively plan a single AST node (block or element).
 *
 * @param parentId — parent plan node's ID, used as prefix to ensure global uniqueness
 */
export function planNode(
  node: ASTBlock | ASTElement,
  theme: DepixTheme,
  indexHint: number = 0,
  parentId: string = '',
): LayoutPlanNode {
  const nodeType = classifyNode(node);
  const id = getNodeId(node, indexHint, parentId);
  const edges: ASTEdge[] = [];
  const childPlans: LayoutPlanNode[] = [];

  if (node.kind === 'block') {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (child.kind === 'edge') {
        edges.push(child);
      } else {
        childPlans.push(planNode(child, theme, i, id));
      }
    }
  } else if (node.children.length > 0) {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (child.kind === 'edge') {
        edges.push(child);
      } else {
        childPlans.push(planNode(child, theme, i, id));
      }
    }
  }

  const metrics = computeMetrics(childPlans);
  const intrinsicSize = computeIntrinsicSize(node, theme);
  const weight = computeWeight(nodeType, metrics);

  return {
    id,
    astNode: node,
    nodeType,
    children: childPlans,
    metrics,
    weight,
    intrinsicSize,
    edges,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

export function classifyNode(node: ASTBlock | ASTElement): PlanNodeType {
  if (node.kind === 'block') {
    switch (node.blockType) {
      case 'flow': return 'block-flow';
      case 'stack': return 'block-stack';
      case 'grid': return 'block-grid';
      case 'tree': return 'block-tree';
      case 'group': return 'block-group';
      case 'layers': return 'block-layers';
      case 'canvas': return 'block-canvas';
      case 'scene': return 'block-canvas';
      case 'column': return 'block-stack';
      case 'table': return 'block-table';
      case 'chart': return 'block-chart';
      case 'box':
      case 'layer': return 'block-visual';
      default: return 'block-canvas';
    }
  }

  return getElementConfig(node.elementType).classify;
}

export function computeMetrics(children: LayoutPlanNode[]): PlanMetrics {
  let descendantCount = 0;
  let maxDepth = 0;
  let blockChildCount = 0;
  let leafChildCount = 0;

  for (const child of children) {
    descendantCount += 1 + child.metrics.descendantCount;
    const childDepth = 1 + child.metrics.maxDepth;
    if (childDepth > maxDepth) maxDepth = childDepth;
    if (child.nodeType.startsWith('block-')) blockChildCount++;
    if (child.children.length === 0) leafChildCount++;
  }

  return {
    descendantCount,
    childCount: children.length,
    maxDepth,
    blockChildCount,
    leafChildCount,
  };
}

export function computeWeight(nodeType: PlanNodeType, metrics: PlanMetrics): number {
  const base = BASE_WEIGHT[nodeType];
  const contentMul = (1 + Math.sqrt(metrics.descendantCount)) * (1 + metrics.blockChildCount * 0.5);
  const depthMul = 1 + metrics.maxDepth * 0.2;
  return base * contentMul * depthMul;
}

/**
 * Compute intrinsic size for leaf elements, mirroring the old measureElement logic.
 * Blocks return {0,0} since their size is determined by allocation.
 */
export function computeIntrinsicSize(
  node: ASTBlock | ASTElement,
  theme: DepixTheme,
): { width: number; height: number } {
  if (node.kind === 'block') {
    return { width: 0, height: 0 };
  }

  const w = typeof node.props.width === 'number' ? node.props.width : undefined;
  const h = typeof node.props.height === 'number' ? node.props.height : undefined;

  const config = getElementConfig(node.elementType);

  // list: dynamic height based on item count
  if (node.elementType === 'list') {
    const itemCount = node.items?.length ?? 0;
    return { width: w ?? config.intrinsicSize.width, height: h ?? Math.max(itemCount * 4, 8) };
  }

  return { width: w ?? config.intrinsicSize.width, height: h ?? config.intrinsicSize.height };
}

// ---------------------------------------------------------------------------
// ID extraction (mirrors emit-ir getNodeId)
// ---------------------------------------------------------------------------

function getNodeId(node: ASTNode, index: number, parentId: string = ''): string {
  const prefix = parentId ? `${parentId}/` : '';
  if (node.kind === 'block') return node.id ?? `${prefix}block-${index}`;
  if (node.kind === 'element') return node.id ?? `${prefix}el-${index}`;
  return `${prefix}edge-${index}`;
}
