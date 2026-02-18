/**
 * Compiler Pass — Emit IR
 *
 * Converts a theme-resolved AST into a fully resolved DepixIR document.
 * Uses the plan → allocate → emit pipeline:
 *   1. planScene()     — structural analysis (plan-layout.ts)
 *   2. allocateScene() — top-down space allocation (allocate-bounds.ts)
 *   3. emitSceneFromPlan() — AST→IR conversion using allocated bounds
 *
 * All coordinates in the output are in the 0-100 relative space.
 */

import type {
  DepixIR,
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
  ASTScene,
} from '../ast.js';
import { routeEdge, type RouteEdgeInput } from '../routing/edge-router.js';
import { generateId } from '../../ir/utils.js';
import { planScene, planNode } from './plan-layout.js';
import { allocateScene, runLayout, computeLayoutChildren, type BoundsMap } from './allocate-bounds.js';
import type { LayoutPlanNode, SceneLayoutPlan } from './plan-layout.js';
import type { ScaleContext } from './scale-system.js';
import { createScaleContext, computeFontSize, computePadding } from './scale-system.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert a theme-resolved AST into a complete DepixIR document.
 */
export function emitIR(ast: ASTDocument, theme: DepixTheme): DepixIR {
  const meta = buildMeta(ast.directives, theme);
  const canvasBounds: IRBounds = { x: 5, y: 5, w: 90, h: 90 };
  const scenes = ast.scenes.map((scene, i) => {
    const plan = planScene(scene, theme);
    const scaleCtx = createScaleContext(plan, canvasBounds);
    const boundsMap = allocateScene(plan, canvasBounds, theme, scaleCtx);
    return emitSceneFromPlan(scene, plan, boundsMap, i, theme, scaleCtx);
  });
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
// Scene emission from plan
// ---------------------------------------------------------------------------

function emitSceneFromPlan(
  scene: ASTScene,
  plan: SceneLayoutPlan,
  boundsMap: BoundsMap,
  index: number,
  theme: DepixTheme,
  scaleCtx?: ScaleContext,
): IRScene {
  const elements: IRElement[] = [];
  const pendingEdges: ASTEdge[] = [];
  // Use boundsMap directly (mutable for edge routing additions)
  const routingBoundsMap = new Map<string, IRBounds>(boundsMap);

  let planIndex = 0;
  for (const child of scene.children) {
    switch (child.kind) {
      case 'block': {
        const childPlan = plan.children[planIndex++];
        const container = emitBlockFromPlan(child, childPlan, routingBoundsMap, theme, scaleCtx);
        elements.push(container);
        break;
      }
      case 'element': {
        const childPlan = plan.children[planIndex++];
        const bounds = routingBoundsMap.get(childPlan.id);
        if (bounds) {
          const el = emitElement(child, bounds, theme, routingBoundsMap, scaleCtx);
          elements.push(el);
        }
        break;
      }
      case 'edge':
        pendingEdges.push(child);
        break;
    }
  }

  // Route edges after all element bounds are known
  for (const edge of pendingEdges) {
    const irEdge = routeASTEdge(edge, routingBoundsMap);
    if (irEdge) elements.push(irEdge);
  }

  return {
    id: scene.name ? `scene-${scene.name}` : `scene-${index}`,
    elements,
  };
}

// ---------------------------------------------------------------------------
// Block emission from plan
// ---------------------------------------------------------------------------

function emitBlockFromPlan(
  block: ASTBlock,
  plan: LayoutPlanNode,
  boundsMap: Map<string, IRBounds>,
  theme: DepixTheme,
  scaleCtx?: ScaleContext,
): IRContainer {
  const containerBounds = boundsMap.get(plan.id);
  if (!containerBounds) {
    throw new Error(`Missing bounds for block ${plan.id}`);
  }

  const irChildren: IRElement[] = [];
  let childPlanIdx = 0;

  for (const child of block.children) {
    if (child.kind === 'edge') continue;

    const childPlan = plan.children[childPlanIdx++];
    const childBounds = boundsMap.get(childPlan.id);
    if (!childBounds) continue;

    if (child.kind === 'block') {
      irChildren.push(emitBlockFromPlan(child, childPlan, boundsMap, theme, scaleCtx));
    } else {
      irChildren.push(emitElement(child, childBounds, theme, boundsMap, scaleCtx));
    }
  }

  // Route internal edges
  for (const edge of plan.edges) {
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
    bounds: containerBounds,
    style: containerStyle,
    children: irChildren,
  };

  if (origin) container.origin = origin;
  boundsMap.set(containerId, containerBounds);
  return container;
}

function isLayoutSourceType(type: string): boolean {
  return ['flow', 'stack', 'grid', 'tree', 'group', 'layers', 'canvas'].includes(type);
}

// ---------------------------------------------------------------------------
// ASTElement → IRElement
// ---------------------------------------------------------------------------

function emitElement(
  element: ASTElement,
  bounds: IRBounds,
  theme: DepixTheme,
  boundsMap: Map<string, IRBounds>,
  scaleCtx?: ScaleContext,
): IRElement {
  const id = element.id ?? generateId();
  boundsMap.set(id, bounds);

  switch (element.elementType) {
    case 'node':
    case 'cell':
    case 'rect':
      return emitShapeElement(element, id, bounds, 'rect', theme, boundsMap, scaleCtx);
    case 'circle':
      return emitShapeElement(element, id, bounds, 'circle', theme, boundsMap, scaleCtx);
    case 'badge':
      return emitShapeElement(element, id, bounds, 'pill', theme, boundsMap, scaleCtx);
    case 'icon':
      return emitShapeElement(element, id, bounds, 'circle', theme, boundsMap, scaleCtx);
    case 'label':
    case 'text':
      return emitTextElement(element, id, bounds, theme, scaleCtx);
    case 'box':
    case 'layer':
      return emitBoxElement(element, id, bounds, theme, boundsMap, scaleCtx);
    case 'list':
      return emitListElement(element, id, bounds, theme, scaleCtx);
    case 'divider':
    case 'line':
      return emitDividerElement(element, id, bounds);
    case 'image':
      return emitImageElement(element, id, bounds);
    default:
      return emitShapeElement(element, id, bounds, 'rect', theme, boundsMap, scaleCtx);
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
  scaleCtx?: ScaleContext,
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
    shape.innerText = buildInnerText(element, theme, bounds, scaleCtx);
  }

  // Process nested children
  if (element.children.length > 0) {
    return emitShapeWithChildren(element, shape, bounds, theme, boundsMap, scaleCtx);
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
): IRElement {
  const children: IRElement[] = [shape];

  const padding = scaleCtx ? computePadding(scaleCtx.baseUnit) : 2;
  const innerBounds: IRBounds = {
    x: bounds.x + padding,
    y: bounds.y + padding,
    w: Math.max(bounds.w - padding * 2, 1),
    h: Math.max(bounds.h - padding * 2, 1),
  };

  const childH = scaleCtx ? Math.max(innerBounds.h / Math.max(element.children.length, 1) * 0.8, 2) : 4;
  const childStep = scaleCtx ? childH * 1.25 : 5;
  let childY = innerBounds.y;
  for (const child of element.children) {
    if (child.kind === 'edge') continue;
    const childEl = emitChildNode(
      child as ASTElement | ASTBlock,
      { x: innerBounds.x, y: childY, w: innerBounds.w, h: childH },
      theme,
      boundsMap,
      scaleCtx,
    );
    children.push(childEl);
    childY += childStep;
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
): IRElement {
  if (node.kind === 'block') {
    return emitInlineBlock(node, bounds, theme, boundsMap, scaleCtx);
  }
  return emitElement(node, bounds, theme, boundsMap, scaleCtx);
}

/**
 * Emit an inline block (block nested inside a shape/box element).
 * Uses runLayout for positioning children within the given bounds.
 */
function emitInlineBlock(
  block: ASTBlock,
  bounds: IRBounds,
  theme: DepixTheme,
  boundsMap: Map<string, IRBounds>,
  scaleCtx?: ScaleContext,
): IRContainer {
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

  const layoutChildren = computeLayoutChildren(plan, bounds, scaleCtx);

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
      irChildren.push(emitInlineBlock(child, childBounds, theme, boundsMap, scaleCtx));
    } else {
      irChildren.push(emitElement(child, childBounds, theme, boundsMap, scaleCtx));
    }
  }

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

// ---------------------------------------------------------------------------
// Text element (label, text)
// ---------------------------------------------------------------------------

function emitTextElement(
  element: ASTElement,
  id: string,
  bounds: IRBounds,
  theme: DepixTheme,
  scaleCtx?: ScaleContext,
): IRText {
  const style = buildStyle(element.style);
  const shortSide = Math.min(bounds.w, bounds.h);
  const fontSize = typeof element.style['font-size'] === 'number'
    ? element.style['font-size']
    : scaleCtx ? computeFontSize(shortSide, 'standaloneText') : theme.fontSize.md;
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
  scaleCtx?: ScaleContext,
): IRContainer {
  const style = buildStyle(element.style);
  const children: IRElement[] = [];

  const padding = scaleCtx ? computePadding(scaleCtx.baseUnit) : 2;
  const innerBounds: IRBounds = {
    x: bounds.x + padding,
    y: bounds.y + padding,
    w: Math.max(bounds.w - padding * 2, 1),
    h: Math.max(bounds.h - padding * 2, 1),
  };

  let childY = innerBounds.y;
  for (const child of element.children) {
    if (child.kind === 'edge') continue;
    // Use pre-allocated bounds from boundsMap if available
    const childId = child.kind === 'element' ? child.id : undefined;
    const preallocatedBounds = childId ? boundsMap.get(childId) : undefined;
    const childBounds: IRBounds = preallocatedBounds ?? {
      x: innerBounds.x,
      y: childY,
      w: innerBounds.w,
      h: 4,
    };
    children.push(emitChildNode(child as ASTElement | ASTBlock, childBounds, theme, boundsMap, scaleCtx));
    childY += childBounds.h + 1;
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
  scaleCtx?: ScaleContext,
): IRContainer {
  const style = buildStyle(element.style);
  const items = element.items ?? [];
  const itemHeight = bounds.h / Math.max(items.length, 1);
  const shortSide = Math.min(bounds.w, bounds.h);
  const fontSize = typeof element.style['font-size'] === 'number'
    ? element.style['font-size']
    : scaleCtx ? computeFontSize(shortSide, 'listItem') : theme.fontSize.sm;

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
): IRInnerText {
  const shortSide = bounds ? Math.min(bounds.w, bounds.h) : 0;
  const fontSize = typeof element.style['font-size'] === 'number'
    ? element.style['font-size']
    : scaleCtx && bounds ? computeFontSize(shortSide, 'innerLabel') : theme.fontSize.md;
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
