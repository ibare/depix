/**
 * Slide IR Emission Pass
 *
 * Converts slide AST blocks + pre-computed BoundsMap into IRScene[].
 * This is the emit pass — it only creates IR elements from already-computed bounds.
 *
 * Pipeline: AST (resolved) + SlidePlan → IRScene
 */

import type {
  DepixIR,
  IRBackground,
  IRBounds,
  IRContainer,
  IRElement,
  IRMeta,
  IROrigin,
  IRScene,
  IRStyle,
  IRText,
  IRTransition,
} from '../../ir/types.js';
import type { DepixTheme } from '../../theme/types.js';
import type { SlideTheme } from '../../theme/slide-theme.js';
import type {
  ASTBlock,
  ASTDirective,
  ASTDocument,
  ASTElement,
  ASTNode,
} from '../ast.js';
import { generateId } from '../../ir/utils.js';
import { planSlide, type SlidePlan } from './plan-slide.js';
import { emitIR } from '../passes/emit-ir.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compile a presentation-mode AST document into DepixIR.
 *
 * Each `slide` block in each scene becomes an independent IRScene.
 * Non-slide content is ignored in presentation mode.
 */
export function emitSlideIR(
  ast: ASTDocument,
  theme: DepixTheme,
  slideTheme: SlideTheme,
): DepixIR {
  const meta = buildSlideMeta(ast.directives, theme, slideTheme);
  const canvasBounds: IRBounds = { x: 0, y: 0, w: 100, h: 100 };
  const scenes: IRScene[] = [];

  // Collect all slide blocks from all scenes
  let slideIndex = 0;
  for (const scene of ast.scenes) {
    for (const child of scene.children) {
      if (child.kind === 'block' && child.blockType === 'slide') {
        const plan = planSlide(child, canvasBounds, slideTheme);

        if (plan.layoutType === 'custom') {
          // Delegate custom layout to the existing pipeline
          const customScene = emitCustomSlide(child, slideIndex, theme);
          if (customScene) scenes.push(customScene);
        } else {
          const irScene = emitSlideScene(child, plan, slideIndex, theme, slideTheme);
          scenes.push(irScene);
        }
        slideIndex++;
      }
    }
  }

  const transitions = buildSlideTransitions(ast.directives, scenes);
  return { meta, scenes, transitions };
}

// ---------------------------------------------------------------------------
// Scene emission
// ---------------------------------------------------------------------------

function emitSlideScene(
  slideBlock: ASTBlock,
  plan: SlidePlan,
  index: number,
  theme: DepixTheme,
  slideTheme: SlideTheme,
): IRScene {
  const elements: IRElement[] = [];
  const baseFontSize = plan.slideBounds.h * 0.04;

  // Background rect
  elements.push(emitSlideBackground(plan.slideBounds, slideTheme));

  // Emit each content node using pre-computed bounds
  let childIdx = 0;
  for (const child of slideBlock.children) {
    if (child.kind === 'edge') continue;

    const childId = plan.childIds[childIdx];
    const bounds = plan.boundsMap.get(childId);
    childIdx++;

    if (!bounds) continue;

    const el = emitSlideContent(child, childId, bounds, theme, slideTheme, baseFontSize);
    if (el) elements.push(el);
  }

  return {
    id: slideBlock.label ?? slideBlock.id ?? `slide-${index}`,
    background: { type: 'solid', color: slideTheme.colors.background },
    elements,
  };
}

// ---------------------------------------------------------------------------
// Content node → IR element emission
// ---------------------------------------------------------------------------

function emitSlideContent(
  node: ASTNode,
  id: string,
  bounds: IRBounds,
  theme: DepixTheme,
  slideTheme: SlideTheme,
  baseFontSize: number,
): IRElement | null {
  if (node.kind === 'element') {
    switch (node.elementType) {
      case 'heading': return emitHeading(node, id, bounds, slideTheme, baseFontSize);
      case 'label':
      case 'text': return emitLabel(node, id, bounds, slideTheme, baseFontSize);
      case 'bullet': return emitBullet(node, id, bounds, slideTheme, baseFontSize);
      case 'stat': return emitStat(node, id, bounds, slideTheme, baseFontSize);
      case 'quote': return emitQuote(node, id, bounds, slideTheme, baseFontSize);
      case 'image': return emitImage(node, id, bounds, slideTheme, baseFontSize);
      case 'icon': return emitIcon(node, id, bounds, slideTheme, baseFontSize);
      case 'step': return emitStep(node, id, bounds, slideTheme, baseFontSize);
      default: return emitLabel(node, id, bounds, slideTheme, baseFontSize);
    }
  }

  if (node.kind === 'block' && node.blockType === 'column') {
    return emitColumn(node, id, bounds, theme, slideTheme, baseFontSize);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Element emitters
// ---------------------------------------------------------------------------

function emitHeading(
  el: ASTElement,
  id: string,
  bounds: IRBounds,
  slideTheme: SlideTheme,
  baseFontSize: number,
): IRText {
  const level = typeof el.props.level === 'number' ? el.props.level : 1;
  const sizeMultiplier = level === 1 ? slideTheme.typography.headingSize : slideTheme.typography.headingSize * 0.7;
  const fontSize = baseFontSize * sizeMultiplier;

  return {
    id,
    type: 'text',
    bounds,
    style: resolveElementStyle(el),
    content: el.label ?? '',
    fontSize,
    color: slideTheme.colors.primary,
    fontWeight: 'bold',
    align: 'center',
    valign: 'middle',
  };
}

function emitLabel(
  el: ASTElement,
  id: string,
  bounds: IRBounds,
  slideTheme: SlideTheme,
  baseFontSize: number,
): IRText {
  const sizeStr = el.props.size;
  let sizeMultiplier = slideTheme.typography.bodySize;
  if (sizeStr === 'sm') sizeMultiplier *= 0.8;
  if (sizeStr === 'lg') sizeMultiplier *= 1.2;

  return {
    id,
    type: 'text',
    bounds,
    style: resolveElementStyle(el),
    content: el.label ?? '',
    fontSize: baseFontSize * sizeMultiplier,
    color: slideTheme.colors.textMuted,
    align: 'center',
    valign: 'middle',
  };
}

function emitBullet(
  el: ASTElement,
  id: string,
  bounds: IRBounds,
  slideTheme: SlideTheme,
  baseFontSize: number,
): IRContainer {
  const children: IRElement[] = [];
  const itemNodes = el.children.filter(
    (c): c is ASTElement => c.kind === 'element' && c.elementType === 'item',
  );
  const itemCount = itemNodes.length || 1;
  const gap = slideTheme.layout.itemGap;
  const itemH = (bounds.h - gap * (itemCount - 1)) / itemCount;

  let curY = bounds.y;
  for (let i = 0; i < itemNodes.length; i++) {
    const item = itemNodes[i];
    const itemBounds: IRBounds = { x: bounds.x + 2, y: curY, w: bounds.w - 4, h: Math.max(itemH, 2) };
    children.push({
      id: `${id}-item-${i}`,
      type: 'text',
      bounds: itemBounds,
      style: {},
      content: `• ${item.label ?? ''}`,
      fontSize: baseFontSize * slideTheme.typography.bodySize,
      color: slideTheme.colors.text,
      align: 'left',
      valign: 'middle',
    } as IRText);
    curY += itemH + gap;
  }

  return {
    id,
    type: 'container',
    bounds,
    style: {},
    children,
  };
}

function emitStat(
  el: ASTElement,
  id: string,
  bounds: IRBounds,
  slideTheme: SlideTheme,
  baseFontSize: number,
): IRContainer {
  const statValue = el.label ?? '';
  const statLabel = typeof el.props.label === 'string' ? el.props.label : '';
  const statColor = typeof el.props.color === 'string'
    ? el.props.color
    : slideTheme.colors.accent;

  const valueH = bounds.h * 0.55;
  const labelH = bounds.h * 0.3;
  const gap = bounds.h * 0.05;

  const children: IRElement[] = [
    {
      id: `${id}-value`,
      type: 'text',
      bounds: { x: bounds.x, y: bounds.y + (bounds.h - valueH - labelH - gap) / 2, w: bounds.w, h: valueH },
      style: {},
      content: statValue,
      fontSize: baseFontSize * slideTheme.typography.statSize,
      color: statColor,
      fontWeight: 'bold',
      align: 'center',
      valign: 'middle',
    } as IRText,
    {
      id: `${id}-label`,
      type: 'text',
      bounds: { x: bounds.x, y: bounds.y + (bounds.h - valueH - labelH - gap) / 2 + valueH + gap, w: bounds.w, h: labelH },
      style: {},
      content: statLabel,
      fontSize: baseFontSize * slideTheme.typography.bodySize,
      color: slideTheme.colors.textMuted,
      align: 'center',
      valign: 'top',
    } as IRText,
  ];

  return {
    id,
    type: 'container',
    bounds,
    style: {},
    children,
  };
}

function emitQuote(
  el: ASTElement,
  id: string,
  bounds: IRBounds,
  slideTheme: SlideTheme,
  baseFontSize: number,
): IRContainer {
  const quoteText = el.label ?? '';
  const attribution = typeof el.props.attribution === 'string' ? el.props.attribution : '';

  const quoteH = bounds.h * 0.65;
  const attrH = bounds.h * 0.2;
  const gap = bounds.h * 0.05;

  const children: IRElement[] = [
    {
      id: `${id}-text`,
      type: 'text',
      bounds: { x: bounds.x, y: bounds.y, w: bounds.w, h: quoteH },
      style: {},
      content: `\u201C${quoteText}\u201D`,
      fontSize: baseFontSize * slideTheme.typography.headingSize * 0.8,
      color: slideTheme.colors.primary,
      fontStyle: 'italic',
      align: 'center',
      valign: 'middle',
    } as IRText,
  ];

  if (attribution) {
    children.push({
      id: `${id}-attr`,
      type: 'text',
      bounds: { x: bounds.x, y: bounds.y + quoteH + gap, w: bounds.w, h: attrH },
      style: {},
      content: `\u2014 ${attribution}`,
      fontSize: baseFontSize * slideTheme.typography.bodySize,
      color: slideTheme.colors.textMuted,
      align: 'center',
      valign: 'top',
    } as IRText);
  }

  return {
    id,
    type: 'container',
    bounds,
    style: {},
    children,
  };
}

function emitColumn(
  block: ASTBlock,
  id: string,
  bounds: IRBounds,
  theme: DepixTheme,
  slideTheme: SlideTheme,
  baseFontSize: number,
): IRContainer {
  const children: IRElement[] = [];
  const contentNodes = block.children.filter(c => c.kind !== 'edge');
  const gap = slideTheme.layout.itemGap;
  const itemH = contentNodes.length > 0
    ? (bounds.h - gap * (contentNodes.length - 1)) / contentNodes.length
    : bounds.h;

  let curY = bounds.y;
  for (let i = 0; i < contentNodes.length; i++) {
    const child = contentNodes[i];
    const childId = `${id}-child-${i}`;
    const childBounds: IRBounds = { x: bounds.x, y: curY, w: bounds.w, h: Math.max(itemH, 2) };
    const el = emitSlideContent(child, childId, childBounds, theme, slideTheme, baseFontSize);
    if (el) children.push(el);
    curY += itemH + gap;
  }

  const origin: IROrigin = { sourceType: 'slide', sourceProps: { columnId: id } };

  return {
    id,
    type: 'container',
    bounds,
    style: {},
    children,
    origin,
  };
}

function emitImage(
  el: ASTElement,
  id: string,
  bounds: IRBounds,
  slideTheme: SlideTheme,
  baseFontSize: number,
): IRContainer {
  const src = el.label ?? '';
  const alt = typeof el.props.alt === 'string' ? el.props.alt : src;

  const children: IRElement[] = [
    {
      id: `${id}-bg`,
      type: 'shape',
      bounds: { ...bounds },
      style: { fill: slideTheme.colors.surface },
      shape: 'rect',
    },
    {
      id: `${id}-label`,
      type: 'text',
      bounds: { x: bounds.x + 2, y: bounds.y + bounds.h * 0.4, w: bounds.w - 4, h: bounds.h * 0.2 },
      style: {},
      content: alt,
      fontSize: baseFontSize * slideTheme.typography.bodySize * 0.8,
      color: slideTheme.colors.textMuted,
      align: 'center',
      valign: 'middle',
    } as IRText,
  ];

  return { id, type: 'container', bounds, style: {}, children };
}

function emitIcon(
  el: ASTElement,
  id: string,
  bounds: IRBounds,
  slideTheme: SlideTheme,
  baseFontSize: number,
): IRContainer {
  const iconSymbol = el.label ?? '';
  const iconLabel = typeof el.props.label === 'string' ? el.props.label : '';
  const iconDesc = typeof el.props.description === 'string' ? el.props.description : '';

  const iconH = bounds.h * 0.4;
  const labelH = bounds.h * 0.2;
  const descH = bounds.h * 0.25;
  const gap = bounds.h * 0.05;

  const children: IRElement[] = [
    {
      id: `${id}-symbol`,
      type: 'text',
      bounds: { x: bounds.x, y: bounds.y + bounds.h * 0.05, w: bounds.w, h: iconH },
      style: {},
      content: iconSymbol,
      fontSize: baseFontSize * slideTheme.typography.statSize,
      color: slideTheme.colors.accent,
      align: 'center',
      valign: 'middle',
    } as IRText,
  ];

  if (iconLabel) {
    children.push({
      id: `${id}-label`,
      type: 'text',
      bounds: { x: bounds.x, y: bounds.y + iconH + gap, w: bounds.w, h: labelH },
      style: {},
      content: iconLabel,
      fontSize: baseFontSize * slideTheme.typography.bodySize * 1.1,
      color: slideTheme.colors.text,
      fontWeight: 'bold',
      align: 'center',
      valign: 'middle',
    } as IRText);
  }

  if (iconDesc) {
    children.push({
      id: `${id}-desc`,
      type: 'text',
      bounds: { x: bounds.x + bounds.w * 0.05, y: bounds.y + iconH + gap + labelH + gap * 0.5, w: bounds.w * 0.9, h: descH },
      style: {},
      content: iconDesc,
      fontSize: baseFontSize * slideTheme.typography.bodySize * 0.85,
      color: slideTheme.colors.textMuted,
      align: 'center',
      valign: 'top',
    } as IRText);
  }

  return { id, type: 'container', bounds, style: {}, children };
}

function emitStep(
  el: ASTElement,
  id: string,
  bounds: IRBounds,
  slideTheme: SlideTheme,
  baseFontSize: number,
): IRContainer {
  const stepLabel = el.label ?? '';
  const stepDesc = typeof el.props.label === 'string' ? el.props.label : '';

  const markerH = bounds.h * 0.35;
  const descH = bounds.h * 0.25;
  const gap = bounds.h * 0.05;

  const children: IRElement[] = [
    {
      id: `${id}-marker`,
      type: 'shape',
      bounds: {
        x: bounds.x + (bounds.w - markerH) / 2,
        y: bounds.y + bounds.h * 0.05,
        w: markerH,
        h: markerH,
      },
      style: { fill: slideTheme.colors.accent },
      shape: 'circle',
    },
    {
      id: `${id}-label`,
      type: 'text',
      bounds: {
        x: bounds.x + (bounds.w - markerH) / 2,
        y: bounds.y + bounds.h * 0.05,
        w: markerH,
        h: markerH,
      },
      style: {},
      content: stepLabel,
      fontSize: baseFontSize * slideTheme.typography.bodySize * 1.2,
      color: slideTheme.colors.background,
      fontWeight: 'bold',
      align: 'center',
      valign: 'middle',
    } as IRText,
  ];

  if (stepDesc) {
    children.push({
      id: `${id}-desc`,
      type: 'text',
      bounds: {
        x: bounds.x,
        y: bounds.y + markerH + gap * 2,
        w: bounds.w,
        h: descH,
      },
      style: {},
      content: stepDesc,
      fontSize: baseFontSize * slideTheme.typography.bodySize,
      color: slideTheme.colors.text,
      align: 'center',
      valign: 'top',
    } as IRText);
  }

  return { id, type: 'container', bounds, style: {}, children };
}

// ---------------------------------------------------------------------------
// Slide background element
// ---------------------------------------------------------------------------

function emitSlideBackground(bounds: IRBounds, slideTheme: SlideTheme): IRElement {
  return {
    id: generateId(),
    type: 'shape',
    bounds: { ...bounds },
    style: { fill: slideTheme.colors.background },
    shape: 'rect',
  };
}

// ---------------------------------------------------------------------------
// Custom slide: delegate to existing pipeline
// ---------------------------------------------------------------------------

function emitCustomSlide(
  slideBlock: ASTBlock,
  index: number,
  theme: DepixTheme,
): IRScene | null {
  // Build a mini-document with just this slide's children as a scene
  const miniDoc: ASTDocument = {
    directives: [],
    scenes: [{
      name: slideBlock.id ?? `custom-slide-${index}`,
      children: slideBlock.children,
      loc: slideBlock.loc,
    }],
  };

  const ir = emitIR(miniDoc, theme);
  const scene = ir.scenes[0];
  if (scene) {
    scene.id = slideBlock.label ?? slideBlock.id ?? `slide-${index}`;
  }
  return scene ?? null;
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

function buildSlideMeta(
  directives: ASTDirective[],
  theme: DepixTheme,
  slideTheme: SlideTheme,
): IRMeta {
  let aspectRatio = { width: 16, height: 9 };

  for (const d of directives) {
    if (d.key === 'ratio') {
      const parts = d.value.split(':');
      if (parts.length === 2) {
        const w = parseInt(parts[0], 10);
        const h = parseInt(parts[1], 10);
        if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
          aspectRatio = { width: w, height: h };
        }
      }
    }
  }

  return {
    aspectRatio,
    background: { type: 'solid', color: slideTheme.colors.background },
    drawingStyle: 'default',
  };
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

const VALID_TRANSITION_TYPES: readonly string[] = [
  'fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down',
  'zoom-in', 'zoom-out',
];

function buildSlideTransitions(
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
// Helpers
// ---------------------------------------------------------------------------

function resolveElementStyle(el: ASTElement): IRStyle {
  const style: IRStyle = {};
  if ('background' in el.style) style.fill = String(el.style.background);
  if ('border' in el.style && typeof el.style.border === 'string') style.stroke = el.style.border;
  return style;
}
