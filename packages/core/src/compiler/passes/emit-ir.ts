/**
 * Compiler Pass — Emit IR
 *
 * Converts a theme-resolved AST into a fully resolved DepixIR document.
 * This pass handles:
 * - Layout computation (dispatching to appropriate layout algorithms)
 * - Edge routing
 * - AST element → IR element conversion
 * - Directive → meta/transition extraction
 *
 * All coordinates in the output are in the 0-100 relative space.
 */

import type {
  DepixIR,
  IRBackground,
  IRBounds,
  IRContainer,
  IREdge as IREdgeType,
  IRElement,
  IRImage,
  IRInnerText,
  IRLine,
  IRMeta,
  IROrigin,
  IRScene,
  IRShadow,
  IRShape,
  IRShapeType,
  IRStyle,
  IRText,
  IRTransition,
} from '../../ir/types.js';
import type { DepixTheme } from '../../theme/types.js';
import type {
  ASTBlock,
  ASTDirective,
  ASTDocument,
  ASTEdge,
  ASTElement,
  ASTNode,
  ASTScene,
} from '../ast.js';
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
import { routeEdge, type RouteEdgeInput } from '../routing/edge-router.js';
import { generateId } from '../../ir/utils.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert a theme-resolved AST into a complete DepixIR document.
 */
export function emitIR(ast: ASTDocument, theme: DepixTheme): DepixIR {
  const meta = buildMeta(ast.directives, theme);
  const scenes = ast.scenes.map((scene, i) => emitScene(scene, i, theme));
  const transitions = buildTransitions(ast.directives, scenes);
  return { meta, scenes, transitions };
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

function buildMeta(directives: ASTDirective[], theme: DepixTheme): IRMeta {
  let aspectRatio = { width: 16, height: 9 };
  let drawingStyle: 'default' | 'sketch' = 'default';

  for (const d of directives) {
    if (d.key === 'page') {
      const parts = d.value.split(':');
      if (parts.length === 2) {
        const w = parseInt(parts[0], 10);
        const h = parseInt(parts[1], 10);
        if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
          aspectRatio = { width: w, height: h };
        }
      }
    }
    if (d.key === 'style' && d.value === 'sketch') {
      drawingStyle = 'sketch';
    }
  }

  return {
    aspectRatio,
    background: { type: 'solid', color: theme.background },
    drawingStyle,
  };
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

const VALID_TRANSITION_TYPES: readonly string[] = [
  'fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down',
  'zoom-in', 'zoom-out',
];

function buildTransitions(
  directives: ASTDirective[],
  scenes: IRScene[],
): IRTransition[] {
  if (scenes.length < 2) return [];

  let transitionType: IRTransition['type'] = 'fade';
  for (const d of directives) {
    if (d.key === 'transition' && VALID_TRANSITION_TYPES.includes(d.value)) {
      transitionType = d.value as IRTransition['type'];
    }
  }

  const transitions: IRTransition[] = [];
  for (let i = 0; i < scenes.length - 1; i++) {
    transitions.push({
      from: scenes[i].id,
      to: scenes[i + 1].id,
      type: transitionType,
      duration: 300,
      easing: 'ease-in-out',
    });
  }
  return transitions;
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

function emitScene(
  scene: ASTScene,
  index: number,
  theme: DepixTheme,
): IRScene {
  const elements: IRElement[] = [];
  const pendingEdges: ASTEdge[] = [];
  const boundsMap = new Map<string, IRBounds>();

  // Auto-layout: stack top-level items vertically with margin
  let currentY = 5;

  for (const child of scene.children) {
    switch (child.kind) {
      case 'block': {
        const availBounds: IRBounds = { x: 5, y: currentY, w: 90, h: 80 };
        const container = emitBlock(child, availBounds, theme, boundsMap);
        elements.push(container);
        currentY += container.bounds.h + 3;
        break;
      }
      case 'element': {
        const el = emitStandaloneElement(child, currentY, theme, boundsMap);
        elements.push(el);
        currentY += el.bounds.h + 3;
        break;
      }
      case 'edge':
        pendingEdges.push(child);
        break;
    }
  }

  // Route edges after all element bounds are known
  for (const edge of pendingEdges) {
    const irEdge = routeASTEdge(edge, boundsMap);
    if (irEdge) elements.push(irEdge);
  }

  return {
    id: scene.name ? `scene-${scene.name}` : `scene-${index}`,
    elements,
  };
}

// ---------------------------------------------------------------------------
// Block → IRContainer
// ---------------------------------------------------------------------------

function emitBlock(
  block: ASTBlock,
  availBounds: IRBounds,
  theme: DepixTheme,
  boundsMap: Map<string, IRBounds>,
): IRContainer {
  const childNodes: (ASTElement | ASTBlock)[] = [];
  const childEdges: ASTEdge[] = [];

  for (const child of block.children) {
    if (child.kind === 'edge') {
      childEdges.push(child);
    } else {
      childNodes.push(child);
    }
  }

  // Measure children for layout
  const layoutChildren: LayoutChild[] = childNodes.map((child, i) => {
    const id = getNodeId(child, i);
    const size = measureElement(child, theme);
    return { id, width: size.width, height: size.height };
  });

  // Run the appropriate layout algorithm
  const layoutResult = runLayout(
    block.blockType,
    layoutChildren,
    block.props,
    availBounds,
    childEdges,
  );

  // Convert children to IR elements with computed bounds
  const irChildren: IRElement[] = [];
  for (let i = 0; i < childNodes.length; i++) {
    const child = childNodes[i];
    const childBounds = layoutResult.childBounds[i];
    const irChild = emitChildNode(child, childBounds, theme, boundsMap);
    irChildren.push(irChild);
  }

  // Route internal edges
  for (const edge of childEdges) {
    const irEdge = routeASTEdge(edge, boundsMap);
    if (irEdge) irChildren.push(irEdge);
  }

  const containerId = block.id ?? generateId();
  const containerStyle = buildStyle(block.style);

  const origin: IROrigin | undefined = isLayoutSourceType(block.blockType)
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

function isLayoutSourceType(type: string): boolean {
  return ['flow', 'stack', 'grid', 'tree', 'group', 'layers', 'canvas'].includes(type);
}

// ---------------------------------------------------------------------------
// Child node dispatch
// ---------------------------------------------------------------------------

function emitChildNode(
  node: ASTElement | ASTBlock,
  bounds: IRBounds,
  theme: DepixTheme,
  boundsMap: Map<string, IRBounds>,
): IRElement {
  if (node.kind === 'block') {
    return emitBlock(node, bounds, theme, boundsMap);
  }
  return emitElement(node, bounds, theme, boundsMap);
}

// ---------------------------------------------------------------------------
// Standalone element (top-level, no layout parent)
// ---------------------------------------------------------------------------

function emitStandaloneElement(
  element: ASTElement,
  y: number,
  theme: DepixTheme,
  boundsMap: Map<string, IRBounds>,
): IRElement {
  const size = measureElement(element, theme);
  const bounds: IRBounds = { x: 5, y, w: size.width, h: size.height };
  return emitElement(element, bounds, theme, boundsMap);
}

// ---------------------------------------------------------------------------
// ASTElement → IRElement
// ---------------------------------------------------------------------------

function emitElement(
  element: ASTElement,
  bounds: IRBounds,
  theme: DepixTheme,
  boundsMap: Map<string, IRBounds>,
): IRElement {
  const id = element.id ?? generateId();
  boundsMap.set(id, bounds);

  switch (element.elementType) {
    case 'node':
    case 'cell':
    case 'rect':
      return emitShapeElement(element, id, bounds, 'rect', theme, boundsMap);
    case 'circle':
      return emitShapeElement(element, id, bounds, 'circle', theme, boundsMap);
    case 'badge':
      return emitShapeElement(element, id, bounds, 'pill', theme, boundsMap);
    case 'icon':
      return emitShapeElement(element, id, bounds, 'circle', theme, boundsMap);
    case 'label':
    case 'text':
      return emitTextElement(element, id, bounds, theme);
    case 'box':
    case 'layer':
      return emitBoxElement(element, id, bounds, theme, boundsMap);
    case 'list':
      return emitListElement(element, id, bounds, theme);
    case 'divider':
    case 'line':
      return emitDividerElement(element, id, bounds);
    case 'image':
      return emitImageElement(element, id, bounds);
    default:
      return emitShapeElement(element, id, bounds, 'rect', theme, boundsMap);
  }
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
): IRElement {
  const shapeType = (element.props.shape as IRShapeType) ?? defaultShape;
  const style = buildStyle(element.style);
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
    shape.innerText = buildInnerText(element, theme);
  }

  // Process nested children
  if (element.children.length > 0) {
    // For shapes with children, wrap in a container instead
    return emitShapeWithChildren(element, shape, bounds, theme, boundsMap);
  }

  return shape;
}

function emitShapeWithChildren(
  element: ASTElement,
  shape: IRShape,
  bounds: IRBounds,
  theme: DepixTheme,
  boundsMap: Map<string, IRBounds>,
): IRElement {
  const children: IRElement[] = [shape];

  // Layout children inside the shape bounds with padding
  const padding = 2;
  const innerBounds: IRBounds = {
    x: bounds.x + padding,
    y: bounds.y + padding,
    w: Math.max(bounds.w - padding * 2, 1),
    h: Math.max(bounds.h - padding * 2, 1),
  };

  let childY = innerBounds.y;
  for (const child of element.children) {
    if (child.kind === 'edge') continue;
    const childEl = emitChildNode(
      child as ASTElement | ASTBlock,
      { x: innerBounds.x, y: childY, w: innerBounds.w, h: 4 },
      theme,
      boundsMap,
    );
    children.push(childEl);
    childY += 5;
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
// Text element (label, text)
// ---------------------------------------------------------------------------

function emitTextElement(
  element: ASTElement,
  id: string,
  bounds: IRBounds,
  theme: DepixTheme,
): IRText {
  const style = buildStyle(element.style);
  const fontSize = typeof element.style['font-size'] === 'number'
    ? element.style['font-size']
    : theme.fontSize.md;
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

  if (element.flags.includes('bold')) text.fontWeight = 'bold';
  if (element.flags.includes('italic')) text.fontStyle = 'italic';
  if (element.style.align) text.align = element.style.align as IRText['align'];

  return text;
}

// ---------------------------------------------------------------------------
// Box / layer element (container)
// ---------------------------------------------------------------------------

function emitBoxElement(
  element: ASTElement,
  id: string,
  bounds: IRBounds,
  theme: DepixTheme,
  boundsMap: Map<string, IRBounds>,
): IRContainer {
  const style = buildStyle(element.style);
  const children: IRElement[] = [];

  // Stack children vertically inside the box
  const padding = 2;
  const innerBounds: IRBounds = {
    x: bounds.x + padding,
    y: bounds.y + padding,
    w: Math.max(bounds.w - padding * 2, 1),
    h: Math.max(bounds.h - padding * 2, 1),
  };

  let childY = innerBounds.y;
  for (const child of element.children) {
    if (child.kind === 'edge') continue;
    const size = measureElement(child as ASTElement | ASTBlock, theme);
    const childBounds: IRBounds = {
      x: innerBounds.x,
      y: childY,
      w: innerBounds.w,
      h: size.height,
    };
    children.push(emitChildNode(child as ASTElement | ASTBlock, childBounds, theme, boundsMap));
    childY += size.height + 1;
  }

  return { id, type: 'container', bounds, style, children };
}

// ---------------------------------------------------------------------------
// List element
// ---------------------------------------------------------------------------

function emitListElement(
  element: ASTElement,
  id: string,
  bounds: IRBounds,
  theme: DepixTheme,
): IRContainer {
  const style = buildStyle(element.style);
  const items = element.items ?? [];
  const itemHeight = bounds.h / Math.max(items.length, 1);
  const fontSize = typeof element.style['font-size'] === 'number'
    ? element.style['font-size']
    : theme.fontSize.sm;

  const children: IRElement[] = items.map((item, i) => ({
    id: `${id}-item-${i}`,
    type: 'text' as const,
    bounds: {
      x: bounds.x + 1,
      y: bounds.y + i * itemHeight,
      w: bounds.w - 2,
      h: itemHeight,
    },
    style: {},
    content: `• ${item}`,
    fontSize,
    color: theme.foreground,
  }));

  return { id, type: 'container', bounds, style, children };
}

// ---------------------------------------------------------------------------
// Divider / line element
// ---------------------------------------------------------------------------

function emitDividerElement(
  element: ASTElement,
  id: string,
  bounds: IRBounds,
): IRLine {
  const style = buildStyle(element.style);
  if (!style.stroke) style.stroke = '#e5e7eb';
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
// Edge routing
// ---------------------------------------------------------------------------

function routeASTEdge(
  edge: ASTEdge,
  boundsMap: Map<string, IRBounds>,
): IREdgeType | null {
  const fromBounds = boundsMap.get(edge.fromId);
  const toBounds = boundsMap.get(edge.toId);

  if (!fromBounds || !toBounds) return null;

  const input: RouteEdgeInput = {
    fromId: edge.fromId,
    toId: edge.toId,
    fromBounds,
    toBounds,
    edgeStyle: edge.edgeStyle,
    label: edge.label,
  };

  return routeEdge(input);
}

// ---------------------------------------------------------------------------
// Layout dispatch
// ---------------------------------------------------------------------------

function runLayout(
  blockType: string,
  children: LayoutChild[],
  props: Record<string, string | number>,
  bounds: IRBounds,
  edges: ASTEdge[],
): LayoutResult {
  const gap = typeof props.gap === 'number' ? props.gap : 3;

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
      return layoutFlow(children, {
        bounds,
        direction: (props.direction as 'right' | 'left' | 'down' | 'up') ?? 'right',
        gap: typeof props.gap === 'number' ? props.gap : 5,
        edges: flowEdges,
      });
    }

    case 'tree': {
      const treeNodes = buildTreeNodes(children, edges);
      return layoutTree(treeNodes, {
        bounds,
        direction: (props.direction as 'down' | 'right' | 'up' | 'left') ?? 'down',
        levelGap: typeof props.gap === 'number' ? props.gap : 5,
        siblingGap: typeof props.gap === 'number' ? props.gap : 3,
      });
    }

    case 'group':
      return layoutGroup(children, {
        bounds,
        padding: typeof props.padding === 'number' ? props.padding : 3,
      });

    case 'layers':
      return layoutLayers(children, {
        bounds,
        gap: typeof props.gap === 'number' ? props.gap : 2,
      });

    case 'canvas':
    default:
      // Canvas or unknown: stack children vertically
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
// Tree node conversion
// ---------------------------------------------------------------------------

function buildTreeNodes(
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
    // Swap root to index 0 and remap all child indices
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
// Element measurement
// ---------------------------------------------------------------------------

function measureElement(
  node: ASTElement | ASTBlock,
  theme: DepixTheme,
): { width: number; height: number } {
  if (node.kind === 'block') {
    // Blocks expand to fill available space; use a reasonable default
    return { width: 40, height: 30 };
  }

  // Use explicit size props if provided
  const w = typeof node.props.width === 'number' ? node.props.width : undefined;
  const h = typeof node.props.height === 'number' ? node.props.height : undefined;

  switch (node.elementType) {
    case 'node':
    case 'cell':
    case 'rect':
      return {
        width: w ?? theme.node.minWidth,
        height: h ?? theme.node.minHeight,
      };
    case 'circle':
    case 'icon':
      return {
        width: w ?? theme.node.minHeight,
        height: h ?? theme.node.minHeight,
      };
    case 'badge':
      return { width: w ?? 10, height: h ?? 4 };
    case 'label':
    case 'text':
      return { width: w ?? 20, height: h ?? 4 };
    case 'divider':
    case 'line':
      return { width: w ?? 90, height: h ?? 1 };
    case 'image':
      return { width: w ?? 20, height: h ?? 15 };
    case 'box':
    case 'layer':
      return { width: w ?? 30, height: h ?? 20 };
    case 'list': {
      const itemCount = node.items?.length ?? 0;
      return { width: w ?? 20, height: h ?? Math.max(itemCount * 4, 8) };
    }
    default:
      return { width: w ?? theme.node.minWidth, height: h ?? theme.node.minHeight };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNodeId(node: ASTElement | ASTBlock, index: number): string {
  if (node.kind === 'block') return node.id ?? `block-${index}`;
  return node.id ?? `el-${index}`;
}

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

function buildInnerText(element: ASTElement, theme: DepixTheme): IRInnerText {
  const fontSize = typeof element.style['font-size'] === 'number'
    ? element.style['font-size']
    : theme.fontSize.md;
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
