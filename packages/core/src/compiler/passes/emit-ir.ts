/**
 * Compiler Pass — Emit IR
 *
 * Provides emitInlineBlock() for the scene pipeline to render diagram-like
 * blocks (flow, tree, stack, grid, group, layers, canvas) within scene slots.
 *
 * All coordinates in the output are in the 0-100 relative space.
 */

import type {
  IRBounds,
  IRContainer,
  IREdge as IREdgeType,
  IRElement,
  IRImage,
  IRInnerText,
  IRLine,
  IROrigin,
  IRPath,
  IRShape,
  IRShapeType,
  IRStyle,
  IRText,
} from '../../ir/types.js';
import type { DepixTheme } from '../../theme/types.js';
import type {
  ASTBlock,
  ASTEdge,
  ASTElement,
} from '../ast.js';
import { routeEdge, type RouteEdgeInput } from '../routing/edge-router.js';
import { generateId } from '../../ir/utils.js';
import { planNode } from './plan-layout.js';
import { runLayout, computeLayoutChildren } from './allocate-bounds.js';
import type { LayoutPlanNode, DiagramLayoutPlan } from './plan-layout.js';
import type { ScaleContext } from './scale-system.js';
import { computeFontSize, computePadding } from './scale-system.js';
import type { MeasureMap, MeasureResult } from './measure.js';
import { computeConstraints } from './compute-constraints.js';
import { isOriginSourceType } from '../container-meta.js';
import { getElementConfig } from '../element-type-registry.js';
import {
  computeChartPositions,
  computeLineChartPositions,
  computePieChartPositions,
  extractChartData,
} from '../layout/chart-layout.js';
import { getChartColor } from '../layout/chart-colors.js';

// ---------------------------------------------------------------------------
// ASTElement → IRElement
// ---------------------------------------------------------------------------

function emitElement(
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
    case 'shape':
      result = emitShapeElement(element, id, bounds, config.emitShape ?? 'rect', theme, boundsMap, scaleCtx, measured, planChildren, measureMap); break;
    case 'list':
      result = emitListElement(element, id, bounds, theme, scaleCtx, measured); break;
    case 'divider':
      result = emitDividerElement(element, id, bounds, theme); break;
    case 'image':
      result = emitImageElement(element, id, bounds); break;
    case 'row':
      result = emitRowElement(element, id, bounds, theme, scaleCtx, measured); break;
  }

  result.origin = { ...result.origin, dslType: element.elementType };
  return result;
}

// ---------------------------------------------------------------------------
// Shape element (node, rect, circle, badge, icon)
// ---------------------------------------------------------------------------

function emitShapeElement(
  element: ASTElement,
  id: string,
  bounds: IRBounds,
  defaultShape: IRShapeType,
  theme: DepixTheme,
  boundsMap: Map<string, IRBounds>,
  scaleCtx?: ScaleContext,
  measured?: MeasureResult,
  planChildren?: LayoutPlanNode[],
  measureMap?: MeasureMap,
): IRElement {
  const shapeType = (element.props.shape as IRShapeType) ?? defaultShape;
  const style = buildStyle(element.style);
  // Shape 요소 기본 테두리: 명시적 스타일 없을 때 theme border 적용
  if (!style.stroke) style.stroke = theme.border;
  // 0.3: shape 기본 테두리 두께; 0–100 상대 좌표 기준, group/box/layer 기본값과 동일
  if (!style.strokeWidth) style.strokeWidth = 0.3;
  const cornerRadius = extractCornerRadius(element);

  const shape: IRShape = {
    id,
    type: 'shape',
    bounds,
    style,
    shape: shapeType,
  };

  if (cornerRadius !== undefined) {
    shape.cornerRadius = cornerRadius;
  }

  if (element.label) {
    shape.innerText = buildInnerText(element, theme, bounds, scaleCtx, measured);
  }

  // Process nested children
  if (element.children.length > 0) {
    return emitShapeWithChildren(element, shape, bounds, theme, boundsMap, scaleCtx, planChildren, measureMap);
  }

  return shape;
}

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

  // 백엣지를 제외하고 port offset 계산 — 백엣지가 정상 엣지의 앵커를 오염시키지 않도록
  const normalEdges = childEdges.filter(e => !backEdgeSet.has(`${e.fromId}->${e.toId}`));
  const portOffsets = computePortOffsets(normalEdges);

  for (const edge of childEdges) {
    const isBack = backEdgeSet.has(`${edge.fromId}->${edge.toId}`);
    const key = `${edge.fromId}->${edge.toId}`;
    const offsets = portOffsets.get(key);

    // 백엣지: from/to를 제외한 형제 노드 bounds를 수집하여 노드 회피에 사용
    let siblingBounds: IRBounds[] | undefined;
    if (isBack) {
      siblingBounds = [];
      for (const [id, b] of boundsMap) {
        if (id !== edge.fromId && id !== edge.toId) siblingBounds.push(b);
      }
    }

    const irEdge = routeASTEdge(edge, boundsMap, shapeMap, isBack, offsets, siblingBounds);
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

// ---------------------------------------------------------------------------
// Text element (label, text, heading)
// ---------------------------------------------------------------------------

function emitTextElement(
  element: ASTElement,
  id: string,
  bounds: IRBounds,
  theme: DepixTheme,
  scaleCtx?: ScaleContext,
  measured?: MeasureResult,
  fontScale = 1,
): IRText {
  const style = buildStyle(element.style);
  const baseFontSize = measured
    ? measured.fontSize
    : (typeof element.style['font-size'] === 'number'
      ? element.style['font-size']
      : scaleCtx ? computeFontSize(Math.min(bounds.w, bounds.h), 'standaloneText') : theme.fontSize.md);
  const fontSize = baseFontSize * fontScale;
  const color = typeof element.style.color === 'string'
    ? element.style.color
    : theme.foreground;

  const text: IRText = {
    id,
    type: 'text',
    bounds,
    style,
    content: element.label ?? '',
    fontSize,
    color,
  };

  if (fontScale > 1) text.fontWeight = 'bold';
  if (element.flags.includes('bold')) text.fontWeight = 'bold';
  if (element.flags.includes('italic')) text.fontStyle = 'italic';
  if (element.style.align) text.align = element.style.align as IRText['align'];

  return text;
}

// ---------------------------------------------------------------------------
// List element
// ---------------------------------------------------------------------------

function emitListElement(
  element: ASTElement,
  id: string,
  bounds: IRBounds,
  theme: DepixTheme,
  scaleCtx?: ScaleContext,
  measured?: MeasureResult,
): IRContainer {
  const style = buildStyle(element.style);
  const items = element.items ?? [];
  const fontSize = measured
    ? measured.fontSize
    : (typeof element.style['font-size'] === 'number'
      ? element.style['font-size']
      : scaleCtx ? computeFontSize(Math.min(bounds.w, bounds.h), 'listItem') : theme.fontSize.sm);
  // 0.3: gap between list items = 30% of font size (compact spacing)
  const itemGap = measured ? measured.childGap : (fontSize * 0.3);
  // 1.8: each item row height = font size × 1.8 (line-height + vertical padding)
  const itemHeight = fontSize * 1.8;
  // Distribute items using measured height or fallback to even distribution
  const totalNeeded = items.length > 0
    ? items.length * itemHeight + (items.length - 1) * itemGap
    : itemHeight;
  const scale = totalNeeded > bounds.h ? bounds.h / totalNeeded : 1;
  const scaledItemH = itemHeight * scale;
  const scaledGap = itemGap * scale;

  const children: IRElement[] = items.map((item, i) => ({
    id: `${id}-item-${i}`,
    type: 'text' as const,
    bounds: {
      x: bounds.x + 1,
      y: bounds.y + i * (scaledItemH + scaledGap),
      w: bounds.w - 2,
      h: scaledItemH,
    },
    style: {},
    content: `• ${item}`,
    fontSize,
    color: theme.foreground,
  }));

  return { id, type: 'container', bounds, style, children, origin: { sourceType: 'list' } };
}

// ---------------------------------------------------------------------------
// Divider / line element
// ---------------------------------------------------------------------------

function emitDividerElement(
  element: ASTElement,
  id: string,
  bounds: IRBounds,
  theme: DepixTheme,
): IRLine {
  const style = buildStyle(element.style);
  if (!style.stroke) style.stroke = theme.border;
  // 0.2: hairline divider thickness in relative coordinate units
  if (!style.strokeWidth) style.strokeWidth = 0.2;

  return {
    id,
    type: 'line',
    bounds,
    style,
    from: { x: bounds.x, y: bounds.y + bounds.h / 2 },
    to: { x: bounds.x + bounds.w, y: bounds.y + bounds.h / 2 },
  };
}

// ---------------------------------------------------------------------------
// Image element
// ---------------------------------------------------------------------------

function emitImageElement(
  element: ASTElement,
  id: string,
  bounds: IRBounds,
): IRImage {
  const style = buildStyle(element.style);
  const src = typeof element.props.src === 'string' ? element.props.src : '';

  return {
    id,
    type: 'image',
    bounds,
    style,
    src,
  };
}

// ---------------------------------------------------------------------------
// Row element (table row with cells)
// ---------------------------------------------------------------------------

function emitRowElement(
  element: ASTElement,
  id: string,
  bounds: IRBounds,
  theme: DepixTheme,
  scaleCtx?: ScaleContext,
  measured?: MeasureResult,
): IRContainer {
  const values = element.values ?? [];
  const isHeader = element.props.header === 1;
  const colCount = Math.max(values.length, 1);
  const cellW = bounds.w / colCount;
  const fontSize = measured
    ? measured.fontSize
    : (scaleCtx ? computeFontSize(Math.min(bounds.w, bounds.h), 'listItem') : theme.fontSize.sm);

  const children: IRElement[] = [];

  for (let i = 0; i < values.length; i++) {
    const cellBounds: IRBounds = {
      x: bounds.x + i * cellW,
      y: bounds.y,
      w: cellW,
      h: bounds.h,
    };

    // Cell background
    const cellBg: IRShape = {
      id: `${id}-cell-${i}-bg`,
      type: 'shape',
      bounds: cellBounds,
      style: {
        fill: isHeader ? theme.colors.muted : theme.background,
        stroke: theme.border,
        // 0.15: thin table cell border in relative units
        strokeWidth: 0.15,
      },
      shape: 'rect',
    };
    children.push(cellBg);

    // Cell text
    const cellText: IRText = {
      id: `${id}-cell-${i}-text`,
      type: 'text',
      bounds: {
        // 0.5: horizontal padding inside table cells
        x: cellBounds.x + 0.5,
        y: cellBounds.y,
        w: cellBounds.w - 1,
        h: cellBounds.h,
      },
      style: {},
      content: String(values[i]),
      fontSize,
      color: theme.foreground,
      align: typeof values[i] === 'number' ? 'right' : 'left',
      valign: 'middle',
    };
    if (isHeader) cellText.fontWeight = 'bold';
    children.push(cellText);
  }

  return { id, type: 'container', bounds, style: {}, children };
}

// ---------------------------------------------------------------------------
// Chart block (bar / line / pie chart: axes, data elements, labels)
// ---------------------------------------------------------------------------

function emitChartBlock(
  block: ASTBlock,
  id: string,
  bounds: IRBounds,
  theme: DepixTheme,
  scaleCtx?: ScaleContext,
): IRContainer {
  const children: IRElement[] = [];
  const data = extractChartData(block);

  if (data.length === 0) {
    return {
      id, type: 'container', bounds, style: {}, children,
      origin: { sourceType: 'chart', sourceProps: { ...block.props } },
    };
  }

  const chartType = typeof block.props.type === 'string' ? block.props.type : 'bar';

  switch (chartType) {
    case 'line':
      emitLineChart(children, id, bounds, data, theme, scaleCtx);
      break;
    case 'pie':
      emitPieChart(children, id, bounds, data, theme, scaleCtx);
      break;
    default: // 'bar'
      emitBarChart(children, id, bounds, data, theme, scaleCtx);
      break;
  }

  return {
    id,
    type: 'container',
    bounds,
    style: {},
    children,
    origin: { sourceType: 'chart', sourceProps: { ...block.props } },
  };
}

function emitChartAxes(
  children: IRElement[],
  id: string,
  axes: { yAxis: { from: { x: number; y: number }; to: { x: number; y: number }; bounds: IRBounds }; xAxis: { from: { x: number; y: number }; to: { x: number; y: number }; bounds: IRBounds }; yLabelMax: { bounds: IRBounds; content: string }; yLabelZero: { bounds: IRBounds } },
  theme: DepixTheme,
  fontSize: number,
): void {
  children.push({
    id: `${id}-y-axis`, type: 'line', bounds: axes.yAxis.bounds,
    style: { stroke: theme.border, strokeWidth: 0.2 },
    from: axes.yAxis.from, to: axes.yAxis.to,
  } as IRLine);

  children.push({
    id: `${id}-x-axis`, type: 'line', bounds: axes.xAxis.bounds,
    style: { stroke: theme.border, strokeWidth: 0.2 },
    from: axes.xAxis.from, to: axes.xAxis.to,
  } as IRLine);

  children.push({
    id: `${id}-ylabel-max`, type: 'text', bounds: axes.yLabelMax.bounds,
    style: {}, content: axes.yLabelMax.content,
    // 0.7: axis labels use 70% of base font size for visual hierarchy
    fontSize: fontSize * 0.7, color: theme.foreground, align: 'right', valign: 'top',
  } as IRText);

  children.push({
    id: `${id}-ylabel-zero`, type: 'text', bounds: axes.yLabelZero.bounds,
    style: {}, content: '0',
    fontSize: fontSize * 0.7, color: theme.foreground, align: 'right', valign: 'bottom',
  } as IRText);
}

function emitBarChart(
  children: IRElement[],
  id: string,
  bounds: IRBounds,
  data: { category: string; value: number }[],
  theme: DepixTheme,
  scaleCtx?: ScaleContext,
): void {
  const positions = computeChartPositions(bounds, data);
  const fontSize = scaleCtx
    ? computeFontSize(Math.min(bounds.w, bounds.h), 'listItem')
    : theme.fontSize.sm;

  emitChartAxes(children, id, positions.axes, theme, fontSize);

  for (let i = 0; i < positions.bars.length; i++) {
    const bar = positions.bars[i];
    children.push({
      id: `${id}-bar-${i}`, type: 'shape', bounds: bar.barBounds,
      style: { fill: getChartColor(i, theme) }, shape: 'rect',
    } as IRShape);
    children.push({
      id: `${id}-xlabel-${i}`, type: 'text', bounds: bar.labelBounds,
      style: {}, content: bar.category,
      // 0.8: data/category labels use 80% of base font size
      fontSize: fontSize * 0.8, color: theme.foreground, align: 'center', valign: 'top',
    } as IRText);
  }
}

function emitLineChart(
  children: IRElement[],
  id: string,
  bounds: IRBounds,
  data: { category: string; value: number }[],
  theme: DepixTheme,
  scaleCtx?: ScaleContext,
): void {
  const positions = computeLineChartPositions(bounds, data);
  const fontSize = scaleCtx
    ? computeFontSize(Math.min(bounds.w, bounds.h), 'listItem')
    : theme.fontSize.sm;

  emitChartAxes(children, id, positions.axes, theme, fontSize);

  // Line segments
  for (let i = 0; i < positions.lines.length; i++) {
    const seg = positions.lines[i];
    const segBounds: IRBounds = {
      x: Math.min(seg.from.x, seg.to.x),
      y: Math.min(seg.from.y, seg.to.y),
      w: Math.abs(seg.to.x - seg.from.x) || 0.1,
      h: Math.abs(seg.to.y - seg.from.y) || 0.1,
    };
    children.push({
      id: `${id}-line-${i}`, type: 'line', bounds: segBounds,
      style: { stroke: theme.border, strokeWidth: 0.3 },
      from: seg.from, to: seg.to,
    } as IRLine);
  }

  // Points and labels
  for (let i = 0; i < positions.points.length; i++) {
    const pt = positions.points[i];
    const r = pt.radius;
    children.push({
      id: `${id}-point-${i}`, type: 'shape',
      bounds: { x: pt.center.x - r, y: pt.center.y - r, w: r * 2, h: r * 2 },
      style: { fill: getChartColor(i, theme) }, shape: 'circle',
    } as IRShape);
    children.push({
      id: `${id}-xlabel-${i}`, type: 'text', bounds: pt.labelBounds,
      style: {}, content: pt.category,
      // 0.8: data/category labels use 80% of base font size
      fontSize: fontSize * 0.8, color: theme.foreground, align: 'center', valign: 'top',
    } as IRText);
  }
}

function emitPieChart(
  children: IRElement[],
  id: string,
  bounds: IRBounds,
  data: { category: string; value: number }[],
  theme: DepixTheme,
  scaleCtx?: ScaleContext,
): void {
  const positions = computePieChartPositions(bounds, data);
  const fontSize = scaleCtx
    ? computeFontSize(Math.min(bounds.w, bounds.h), 'listItem')
    : theme.fontSize.sm;

  for (let i = 0; i < positions.wedges.length; i++) {
    const wedge = positions.wedges[i];
    children.push({
      id: `${id}-wedge-${i}`, type: 'path', bounds,
      style: { fill: getChartColor(i, theme), stroke: theme.background, strokeWidth: 0.3 },
      d: wedge.pathD, closed: true,
    } as IRPath);
    children.push({
      id: `${id}-label-${i}`, type: 'text', bounds: wedge.labelBounds,
      style: {}, content: `${wedge.category} ${Math.round(wedge.percentage)}%`,
      fontSize: fontSize * 0.7, color: theme.foreground, align: 'center', valign: 'middle',
    } as IRText);
  }
}

// ---------------------------------------------------------------------------
// Edge routing
// ---------------------------------------------------------------------------

function routeASTEdge(
  edge: ASTEdge,
  boundsMap: Map<string, IRBounds>,
  shapeMap?: Map<string, IRShapeType>,
  isBackEdge = false,
  portOffsets?: { fromPortOffset: number; toPortOffset: number },
  siblingBounds?: IRBounds[],
): IREdgeType | null {
  const fromBounds = boundsMap.get(edge.fromId);
  const toBounds = boundsMap.get(edge.toId);

  if (!fromBounds || !toBounds) return null;

  const input: RouteEdgeInput = {
    fromId: edge.fromId,
    toId: edge.toId,
    fromBounds,
    toBounds,
    fromShape: shapeMap?.get(edge.fromId),
    toShape: shapeMap?.get(edge.toId),
    edgeStyle: edge.edgeStyle,
    label: edge.label,
    isBackEdge,
    fromPortOffset: portOffsets?.fromPortOffset,
    toPortOffset: portOffsets?.toPortOffset,
    siblingBounds,
  };

  return routeEdge(input);
}

/**
 * Compute port offsets for edges sharing the same source or target node.
 *
 * When N edges share a node, they are spread evenly across [-1, 1].
 * For a single edge, offset = 0 (centered). For 2: [-0.5, 0.5]. For 3: [-0.67, 0, 0.67].
 *
 * Returns a Map keyed by "fromId->toId" with both from and to offsets.
 */
function computePortOffsets(
  edges: ASTEdge[],
): Map<string, { fromPortOffset: number; toPortOffset: number }> {
  // Group edges by source node and by target node
  const fromGroups = new Map<string, ASTEdge[]>();
  const toGroups = new Map<string, ASTEdge[]>();

  for (const edge of edges) {
    if (!fromGroups.has(edge.fromId)) fromGroups.set(edge.fromId, []);
    fromGroups.get(edge.fromId)!.push(edge);
    if (!toGroups.has(edge.toId)) toGroups.set(edge.toId, []);
    toGroups.get(edge.toId)!.push(edge);
  }

  const result = new Map<string, { fromPortOffset: number; toPortOffset: number }>();

  // Assign from-port offsets: spread edges leaving the same node
  for (const [, group] of fromGroups) {
    const n = group.length;
    for (let i = 0; i < n; i++) {
      const key = `${group[i].fromId}->${group[i].toId}`;
      // Spread evenly: for n edges, offset_i = (2i/(n-1) - 1) when n>1, else 0
      const fromOffset = n > 1 ? (2 * i) / (n - 1) - 1 : 0;
      const existing = result.get(key);
      result.set(key, {
        fromPortOffset: fromOffset,
        toPortOffset: existing?.toPortOffset ?? 0,
      });
    }
  }

  // Assign to-port offsets: spread edges arriving at the same node
  for (const [, group] of toGroups) {
    const n = group.length;
    for (let i = 0; i < n; i++) {
      const key = `${group[i].fromId}->${group[i].toId}`;
      const toOffset = n > 1 ? (2 * i) / (n - 1) - 1 : 0;
      const existing = result.get(key);
      result.set(key, {
        fromPortOffset: existing?.fromPortOffset ?? 0,
        toPortOffset: toOffset,
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildStyle(astStyle: Record<string, string | number>): IRStyle {
  const style: IRStyle = {};

  if ('background' in astStyle) {
    style.fill = String(astStyle.background);
  }
  if ('border' in astStyle && typeof astStyle.border === 'string') {
    style.stroke = astStyle.border;
  }
  if ('border-width' in astStyle && typeof astStyle['border-width'] === 'number') {
    style.strokeWidth = astStyle['border-width'];
  }
  if ('stroke-width' in astStyle && typeof astStyle['stroke-width'] === 'number') {
    style.strokeWidth = astStyle['stroke-width'];
  }

  // Shadow from expanded tokens
  if (
    'shadow-offsetX' in astStyle &&
    'shadow-offsetY' in astStyle &&
    'shadow-blur' in astStyle &&
    'shadow-color' in astStyle
  ) {
    style.shadow = {
      offsetX: Number(astStyle['shadow-offsetX']),
      offsetY: Number(astStyle['shadow-offsetY']),
      blur: Number(astStyle['shadow-blur']),
      color: String(astStyle['shadow-color']),
    };
  }

  // Dash pattern
  if ('dash' in astStyle && typeof astStyle.dash === 'string') {
    style.dashPattern = astStyle.dash.split(',').map(Number).filter(n => !isNaN(n));
  }

  return style;
}

function buildInnerText(
  element: ASTElement,
  theme: DepixTheme,
  bounds?: IRBounds,
  scaleCtx?: ScaleContext,
  measured?: MeasureResult,
): IRInnerText {
  const fontSize = measured
    ? measured.fontSize
    : (typeof element.style['font-size'] === 'number'
      ? element.style['font-size']
      : scaleCtx && bounds ? computeFontSize(Math.min(bounds.w, bounds.h), 'innerLabel') : theme.fontSize.md);
  const color = typeof element.style.color === 'string'
    ? element.style.color
    : theme.foreground;

  const innerText: IRInnerText = {
    content: element.label ?? '',
    color,
    fontSize,
    align: 'center',
    valign: 'middle',
  };

  if (element.flags.includes('bold')) innerText.fontWeight = 'bold';
  if (element.flags.includes('italic')) innerText.fontStyle = 'italic';

  return innerText;
}

function extractCornerRadius(element: ASTElement): number | undefined {
  if ('radius' in element.style) {
    const r = element.style.radius;
    if (typeof r === 'number') return r;
  }
  return undefined;
}
