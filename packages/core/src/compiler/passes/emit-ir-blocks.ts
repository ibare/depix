/**
 * Emit IR — Element Dispatch & Inline Block Emission
 *
 * Contains the mutually recursive cluster that cannot be split
 * without introducing circular imports:
 *   emitElement → emitShapeWithChildren → emitChildNode → emitInlineBlock → emitElement
 *
 * The plan-based functions (emitDiagramFromPlan, emitBlockFromPlan) live
 * in emit-ir.ts and call emitElement from here.
 */

import type {
  IRBounds,
  IRContainer,
  IRElement,
  IROrigin,
  IRShape,
  IRShapeType,
} from '../../ir/types.js';
import type { DepixTheme } from '../../theme/types.js';
import type {
  ASTBlock,
  ASTEdge,
  ASTElement,
} from '../ast.js';
import { generateId } from '../../ir/utils.js';
import { planNode } from './plan-layout.js';
import { runLayout, computeLayoutChildren } from './allocate-bounds.js';
import type { LayoutPlanNode, DiagramLayoutPlan } from './plan-layout.js';
import type { ScaleContext } from './scale-system.js';
import { computePadding } from './scale-system.js';
import type { MeasureMap, MeasureResult } from './measure.js';
import { computeConstraints } from './compute-constraints.js';
import { isOriginSourceType } from '../container-meta.js';
import { getElementConfig } from '../element-type-registry.js';
import { buildStyle, routeASTEdge } from './emit-ir-helpers.js';
import { emitChartBlock } from './emit-ir-charts.js';
import {
  emitShapeElement,
  emitTextElement,
  emitListElement,
  emitDividerElement,
  emitImageElement,
  emitRowElement,
} from './emit-ir-elements.js';

// ---------------------------------------------------------------------------
// ASTElement → IRElement dispatcher
// ---------------------------------------------------------------------------

export function emitElement(
  element: ASTElement,
  bounds: IRBounds,
  theme: DepixTheme,
  boundsMap: Map<string, IRBounds>,
  scaleCtx?: ScaleContext,
  measured?: MeasureResult,
  planChildren?: LayoutPlanNode[],
  measureMap?: MeasureMap,
): IRElement {
  const id = element.id ?? generateId();
  boundsMap.set(id, bounds);

  const config = getElementConfig(element.elementType);
  let result: IRElement;
  switch (config.emit) {
    case 'text':
      result = emitTextElement(element, id, bounds, theme, scaleCtx, measured, config.fontScale); break;
    case 'shape': {
      const shape = emitShapeElement(element, id, bounds, config.emitShape ?? 'rect', theme, scaleCtx, measured);
      // Handle nested children via container wrapping
      if (element.children.length > 0) {
        result = emitShapeWithChildren(element, shape, bounds, theme, boundsMap, scaleCtx, planChildren, measureMap);
      } else {
        result = shape;
      }
      break;
    }
    case 'list':
      result = emitListElement(element, id, bounds, theme, scaleCtx, measured); break;
    case 'divider':
      result = emitDividerElement(element, id, bounds); break;
    case 'image':
      result = emitImageElement(element, id, bounds); break;
    case 'row':
      result = emitRowElement(element, id, bounds, theme, scaleCtx, measured); break;
  }

  result.origin = { ...result.origin, dslType: element.elementType };
  return result;
}

// ---------------------------------------------------------------------------
// Shape with nested children → container
// ---------------------------------------------------------------------------

function emitShapeWithChildren(
  element: ASTElement,
  shape: IRShape,
  bounds: IRBounds,
  theme: DepixTheme,
  boundsMap: Map<string, IRBounds>,
  scaleCtx?: ScaleContext,
  planChildren?: LayoutPlanNode[],
  measureMap?: MeasureMap,
): IRElement {
  const children: IRElement[] = [shape];

  const padding = scaleCtx ? computePadding(scaleCtx.baseUnit) : 2;
  const innerBounds: IRBounds = {
    x: bounds.x + padding,
    y: bounds.y + padding,
    w: Math.max(bounds.w - padding * 2, 1),
    h: Math.max(bounds.h - padding * 2, 1),
  };

  // 0.8: reserve 20% vertical space for inter-child gaps; min 2 units per child
  const childH = scaleCtx ? Math.max(innerBounds.h / Math.max(element.children.length, 1) * 0.8, 2) : 4;
  // 1.25: child step = child height + 25% gap between children
  const childStep = scaleCtx ? childH * 1.25 : 5;
  let childY = innerBounds.y;
  let planIdx = 0;
  for (const child of element.children) {
    if (child.kind === 'edge') continue;
    const childPlan = planChildren?.[planIdx++];
    const preallocBounds = childPlan ? boundsMap.get(childPlan.id) : undefined;
    const childBounds = preallocBounds ?? { x: innerBounds.x, y: childY, w: innerBounds.w, h: childH };
    const childMeasured = childPlan && measureMap ? measureMap.get(childPlan.id) : undefined;
    const childEl = emitChildNode(
      child as ASTElement | ASTBlock,
      childBounds,
      theme,
      boundsMap,
      scaleCtx,
      childPlan,
      measureMap,
      childMeasured,
    );
    children.push(childEl);
    // 0.25: 25% of child height as vertical gap between siblings
    childY += (preallocBounds ? preallocBounds.h : childH) + (scaleCtx ? childH * 0.25 : 1);
  }

  return {
    id: shape.id,
    type: 'container',
    bounds,
    style: shape.style,
    children,
  } as IRContainer;
}

// ---------------------------------------------------------------------------
// Child node dispatch (for nested elements within shapes/boxes)
// ---------------------------------------------------------------------------

function emitChildNode(
  node: ASTElement | ASTBlock,
  bounds: IRBounds,
  theme: DepixTheme,
  boundsMap: Map<string, IRBounds>,
  scaleCtx?: ScaleContext,
  planNode?: LayoutPlanNode,
  measureMap?: MeasureMap,
  measured?: MeasureResult,
): IRElement {
  if (node.kind === 'block') {
    return emitInlineBlock(node, bounds, theme, boundsMap, scaleCtx);
  }
  return emitElement(node, bounds, theme, boundsMap, scaleCtx, measured, planNode?.children, measureMap);
}

// ---------------------------------------------------------------------------
// Inline block emission (block nested inside a shape/box element)
// ---------------------------------------------------------------------------

/**
 * Emit an inline block (block nested inside a shape/box element).
 * Uses runLayout for positioning children within the given bounds.
 *
 * @param childBlockRouter - Optional callback for scene-aware block children (e.g. box/layer).
 *   Called before the default emitInlineBlock recursion. Return null to fall through.
 */
export function emitInlineBlock(
  block: ASTBlock,
  bounds: IRBounds,
  theme: DepixTheme,
  boundsMap: Map<string, IRBounds>,
  scaleCtx?: ScaleContext,
  childBlockRouter?: (block: ASTBlock, bounds: IRBounds, boundsMap: Map<string, IRBounds>) => IRElement | null,
): IRContainer {
  // Chart blocks need specialized rendering (bars, axes, labels)
  if (block.blockType === 'chart') {
    return emitChartBlock(block, block.id ?? generateId(), bounds, theme, scaleCtx);
  }

  const plan = planNode(block, theme);
  const childNodes: (ASTElement | ASTBlock)[] = [];
  const childEdges: ASTEdge[] = [];

  for (const child of block.children) {
    if (child.kind === 'edge') {
      childEdges.push(child);
    } else {
      childNodes.push(child);
    }
  }

  // Compute inline constraints for max-clamping (prevents node bloat in scene pipeline)
  let inlineConstraints;
  if (scaleCtx) {
    const fakePlan: DiagramLayoutPlan = { children: plan.children, totalWeight: plan.children.reduce((s, c) => s + c.weight, 0) };
    inlineConstraints = computeConstraints(fakePlan, scaleCtx);
  }
  const layoutChildren = computeLayoutChildren(plan, bounds, scaleCtx, undefined, inlineConstraints);

  const layoutResult = runLayout(
    block.blockType,
    layoutChildren,
    block.props,
    bounds,
    childEdges,
    scaleCtx,
  );

  const irChildren: IRElement[] = [];
  for (let i = 0; i < childNodes.length; i++) {
    const child = childNodes[i];
    const childBounds = layoutResult.childBounds[i];
    if (child.kind === 'block') {
      const routed = childBlockRouter?.(child, childBounds, boundsMap);
      irChildren.push(routed ?? emitInlineBlock(child, childBounds, theme, boundsMap, scaleCtx, childBlockRouter));
    } else {
      irChildren.push(emitElement(child, childBounds, theme, boundsMap, scaleCtx));
    }
  }

  // Build shape map from emitted children for shape-aware edge routing
  const shapeMap = new Map<string, IRShapeType>();
  for (const el of irChildren) {
    if (el.type === 'shape') shapeMap.set(el.id, (el as IRShape).shape);
  }

  // Identify back-edges from layout result for curved feedback routing
  const backEdgeSet = new Set<string>();
  if (layoutResult.backEdgeIndices) {
    for (const [fromIdx, toIdx] of layoutResult.backEdgeIndices) {
      const fromId = layoutChildren[fromIdx]?.id;
      const toId = layoutChildren[toIdx]?.id;
      if (fromId && toId) backEdgeSet.add(`${fromId}->${toId}`);
    }
  }

  for (const edge of childEdges) {
    const isBack = backEdgeSet.has(`${edge.fromId}->${edge.toId}`);
    const irEdge = routeASTEdge(edge, boundsMap, shapeMap, isBack);
    if (irEdge) irChildren.push(irEdge);
  }

  const containerId = block.id ?? generateId();
  const containerStyle = buildStyle(block.style);

  // Group blocks get a default border when no explicit styling is provided
  // (mirrors the same logic in emitBlockFromPlan)
  if (block.blockType === 'group' && !containerStyle.stroke && !containerStyle.fill) {
    containerStyle.stroke = theme.border;
    containerStyle.strokeWidth = 0.3; // 0–100 좌표계 기준; emitBlockFromPlan group/box/layer 기본값과 동일
  }

  const origin: IROrigin | undefined = isOriginSourceType(block.blockType)
    ? { sourceType: block.blockType as IROrigin['sourceType'], sourceProps: { ...block.props } }
    : undefined;

  const container: IRContainer = {
    id: containerId,
    type: 'container',
    bounds: layoutResult.containerBounds,
    style: containerStyle,
    children: irChildren,
  };

  if (origin) container.origin = origin;
  boundsMap.set(containerId, layoutResult.containerBounds);
  return container;
}
