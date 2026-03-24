/**
 * Scene IR Emission Pass
 *
 * Converts scene AST blocks + pre-computed BoundsMap into IRScene[].
 * This is the emit pass — it only creates IR elements from already-computed bounds.
 *
 * Pipeline: AST (resolved) + ScenePlan → IRScene
 */

import type {
  DepixIR,
  IRBackground,
  IRBounds,
  IRContainer,
  IRElement,
  IRLine,
  IRMeta,
  IROrigin,
  IRPath,
  IRScene,
  IRShape,
  IRStyle,
  IRText,
  IRTransition,
} from '../../ir/types.js';
import type { DepixTheme } from '../../theme/types.js';
import type { SceneTheme } from '../../theme/scene-theme.js';
import type {
  ASTBlock,
  ASTDirective,
  ASTDocument,
  ASTElement,
  ASTNode,
} from '../ast.js';
import { generateId } from '../../ir/utils.js';
import { planScene, type ScenePlan } from './plan-scene.js';
import { emitInlineBlock } from '../passes/emit-ir.js';
import { createScaleContext } from '../passes/scale-system.js';
import { planNode } from '../passes/plan-layout.js';
import { getElementConfig } from '../element-type-registry.js';
import {
  extractChartData,
  computeChartPositions,
  computeLineChartPositions,
  computePieChartPositions,
} from '../layout/chart-layout.js';
import { getChartColor } from '../layout/chart-colors.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compile an AST document into DepixIR using the unified scene pipeline.
 *
 * All top-level blocks are expected to be slotted scene blocks
 * (normalized by `normalizeScenes` in the compiler orchestrator).
 * Each block goes through planScene → emitScene.
 */
export function emitSceneIR(
  ast: ASTDocument,
  theme: DepixTheme,
  sceneTheme: SceneTheme,
): DepixIR {
  const meta = buildSceneMeta(ast.directives, theme, sceneTheme);
  const isAutoHeight = meta.autoHeight === true;
  const scenes: IRScene[] = [];
  const sceneHeights: number[] = [];

  for (let sceneIndex = 0; sceneIndex < ast.scenes.length; sceneIndex++) {
    const sceneBlock = ast.scenes[sceneIndex];
    const h = isAutoHeight ? computeSceneNaturalHeight(sceneBlock, sceneTheme) : 100;
    sceneHeights.push(h);
    const canvasBounds: IRBounds = { x: 0, y: 0, w: 100, h };
    const plan = planScene(sceneBlock, canvasBounds, sceneTheme);
    const irScene = emitScene(sceneBlock, plan, sceneIndex, theme, sceneTheme);
    scenes.push(irScene);
  }

  if (isAutoHeight && sceneHeights.length > 0) {
    // Set aspect ratio and IR height from content so the engine sizes the canvas correctly.
    const maxH = Math.max(...sceneHeights);
    meta.aspectRatio = { width: 100, height: maxH };
    meta.irHeight = maxH;
  }

  const transitions = buildSceneTransitions(ast.directives, scenes);
  return { meta, scenes, transitions };
}

// ---------------------------------------------------------------------------
// Scene emission
// ---------------------------------------------------------------------------

function emitScene(
  sceneBlock: ASTBlock,
  plan: ScenePlan,
  index: number,
  theme: DepixTheme,
  sceneTheme: SceneTheme,
): IRScene {
  const elements: IRElement[] = [];
  // 0.07 = empirical ratio; cap at 100 to normalise autoHeight scenes (0–100 relative coords)
  const sceneBaseFontSize = Math.min(plan.sceneBounds.h, 100) * 0.07;

  // Background rect
  elements.push(emitSceneBackground(plan.sceneBounds, sceneTheme));

  // Emit each content node using pre-computed bounds
  const emittedSlots = new Set<string>();
  let emittedCellCount = 0;
  let childIdx = 0;
  for (const child of sceneBlock.children) {
    if (child.kind === 'edge') continue;

    const childId = plan.childIds[childIdx];
    const bounds = plan.boundsMap.get(childId);
    childIdx++;

    if (!bounds) continue;

    const slotName = 'slot' in child ? (child as { slot?: string }).slot : undefined;
    if (slotName) {
      if (slotName === 'cell') emittedCellCount++;
      else emittedSlots.add(slotName);
    }

    // Adapt baseFontSize per slot — shrink if content exceeds available space
    const slotContentNodes = child.kind === 'block' ? (child as ASTBlock).children.filter(c => c.kind !== 'edge') : [child];
    const baseFontSize = adaptBaseFontSize(bounds.h, slotContentNodes, sceneBaseFontSize, sceneTheme.layout.itemGap, sceneTheme);

    const inner = emitSceneContent(child, childId, bounds, theme, sceneTheme, baseFontSize);
    if (!inner) continue;

    // Wrap all slot content in a named IRContainer so the Layers panel can display
    // the slot name (header, main, left, etc.) instead of generic "Container (N)".
    // When inner is a container (e.g. from emitInlineBlock), preserve its original
    // sourceType (flow, tree, etc.) in sourceProps.blockType for the picker UI.
    const innerBlockType = inner.type === 'container'
      ? (inner as IRContainer).origin?.sourceType
      : undefined;
    const slotOrigin: IRContainer['origin'] = {
      sourceType: 'scene-slot',
      slotName,
      ...(innerBlockType ? { sourceProps: { blockType: innerBlockType } } : {}),
    };
    const el: IRContainer = inner.type === 'container'
      ? { ...(inner as IRContainer), origin: slotOrigin }
      : {
          id: `${childId}-slot`,
          type: 'container',
          bounds,
          style: {},
          children: [inner],
          origin: slotOrigin,
        };
    elements.push(el);
  }

  // Emit placeholder containers for empty slots
  const placeholderStyle: IRStyle = {
    stroke: sceneTheme.colors.textMuted,
    strokeWidth: 0.15,
    dashPattern: [0.5, 0.5],
  };
  for (const [slotName, boundsArr] of plan.slotBounds) {
    if (slotName === 'cell') {
      for (let i = emittedCellCount; i < boundsArr.length; i++) {
        elements.push({
          id: generateId(),
          type: 'container',
          bounds: boundsArr[i],
          style: placeholderStyle,
          children: [],
          origin: { sourceType: 'scene-slot', slotName: 'cell', placeholder: true },
        } as IRContainer);
      }
    } else if (!emittedSlots.has(slotName)) {
      elements.push({
        id: generateId(),
        type: 'container',
        bounds: boundsArr[0],
        style: placeholderStyle,
        children: [],
        origin: { sourceType: 'scene-slot', slotName, placeholder: true },
      } as IRContainer);
    }
  }

  return {
    id: sceneBlock.label ?? sceneBlock.id ?? `scene-${index}`,
    background: { type: 'solid', color: sceneTheme.colors.background },
    elements,
    layout: {
      type: plan.layoutType,
      ...(sceneBlock.props.ratio !== undefined && { ratio: Number(sceneBlock.props.ratio) }),
      ...(typeof sceneBlock.props.direction === 'string' && { direction: sceneBlock.props.direction }),
    },
  };
}

// ---------------------------------------------------------------------------
// Content node → IR element emission
// ---------------------------------------------------------------------------

function emitSceneContent(
  node: ASTNode,
  id: string,
  bounds: IRBounds,
  theme: DepixTheme,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRElement | null {
  if (node.kind === 'element') {
    // Block child → delegate to diagram/table/chart pipeline
    const blockChild = node.children.find((c): c is ASTBlock => c.kind === 'block');
    if (blockChild) {
      if (blockChild.blockType === 'table') {
        return emitSceneTable(blockChild, id, bounds, theme, sceneTheme, baseFontSize);
      }
      if (blockChild.blockType === 'chart') {
        return emitSceneChart(blockChild, id, bounds, theme, sceneTheme, baseFontSize);
      }
      return emitInlineBlock(blockChild, bounds, theme, new Map());
    }
    const config = getElementConfig(node.elementType);
    let elResult: IRElement | null;
    switch (config.sceneEmit) {
      case 'heading': elResult = emitHeading(node, id, bounds, sceneTheme, baseFontSize); break;
      case 'label': elResult = emitLabel(node, id, bounds, sceneTheme, baseFontSize); break;
      case 'bullet': elResult = emitBullet(node, id, bounds, sceneTheme, baseFontSize); break;
      case 'stat': elResult = emitStat(node, id, bounds, sceneTheme, baseFontSize); break;
      case 'quote': elResult = emitQuote(node, id, bounds, sceneTheme, baseFontSize); break;
      case 'image': elResult = emitImage(node, id, bounds, sceneTheme, baseFontSize); break;
      case 'icon': elResult = emitIcon(node, id, bounds, sceneTheme, baseFontSize); break;
      case 'step': elResult = emitStep(node, id, bounds, sceneTheme, baseFontSize); break;
      case 'list': elResult = emitBullet(node, id, bounds, sceneTheme, baseFontSize); break;
      case 'divider': elResult = emitSceneDivider(node, id, bounds, sceneTheme); break;
      case 'shape': elResult = emitSceneShape(node, id, bounds, sceneTheme, baseFontSize); break;
    }
    if (elResult) {
      elResult.origin = { ...elResult.origin, dslType: node.elementType };
    }
    return elResult;
  }

  if (node.kind === 'block') {
    if (node.blockType === 'column') {
      return emitColumn(node, id, bounds, theme, sceneTheme, baseFontSize);
    }
    if (node.blockType === 'table') {
      return emitSceneTable(node, id, bounds, theme, sceneTheme, baseFontSize);
    }
    if (node.blockType === 'chart') {
      return emitSceneChart(node, id, bounds, theme, sceneTheme, baseFontSize);
    }
    // Box/layer: visual container — render children with scene emitters
    if (node.blockType === 'box' || node.blockType === 'layer') {
      return emitBoxBlock(node, id, bounds, theme, sceneTheme, baseFontSize);
    }
    // Diagram-like blocks (flow, tree, layers, grid, stack, group, canvas):
    // delegate to the diagram pipeline for layout + rendering within scene bounds.
    // childBlockRouter intercepts box/layer children so they use the scene pipeline (emitBoxBlock)
    // instead of the diagram pipeline — prevents compact-stacking shrinkage inside col stacks.
    const inlinePlan = { children: [planNode(node, theme)], totalWeight: 1 };
    const inlineScaleCtx = createScaleContext(inlinePlan, bounds);
    const childBlockRouter = (
      b: ASTBlock,
      childBounds: IRBounds,
      bMap: Map<string, IRBounds>,
    ): IRElement | null => {
      if (b.blockType !== 'box' && b.blockType !== 'layer') return null;
      const childId = b.id ?? generateId();
      const el = emitBoxBlock(b, childId, childBounds, theme, sceneTheme, baseFontSize);
      bMap.set(childId, childBounds);
      return el;
    };
    return emitInlineBlock(node, bounds, theme, new Map(), inlineScaleCtx, childBlockRouter);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Content height estimation (for compact vertical stacking)
// ---------------------------------------------------------------------------

const LINE_HEIGHT_MULTIPLIER = 2.0;

// Proportional-font average character width as a fraction of fontSize (em units).
// Derived from typical sans-serif glyph metrics; 0.55 ≈ width/fontSize for Latin text.
// Units: dimensionless ratio (applies equally to 0–100 relative-coordinate fontSize values).
const CHAR_WIDTH_RATIO = 0.55;

// Minimum scale factor applied to baseFontSize when content overflows available space.
// 0.3 ≈ 30% of original — chosen to keep text legible at extreme overflow; below this
// threshold content becomes unreadable regardless of size. Units: dimensionless ratio.
const MIN_FONT_SCALE = 0.3;

/**
 * Estimate the rendered width of a text string at a given fontSize.
 * Uses a conservative average-character-width heuristic (CHAR_WIDTH_RATIO).
 */
function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * CHAR_WIDTH_RATIO;
}

/**
 * Compute a uniform scale factor [MIN_FONT_SCALE, 1.0] so that content of
 * (naturalH × naturalW) fits within (boundsH × boundsW).
 * Both height and width constraints are considered; the tighter one wins.
 */
function computeFitScale(
  boundsH: number,
  boundsW: number,
  naturalH: number,
  naturalW: number,
  minScale: number = MIN_FONT_SCALE,
): number {
  const scaleH = naturalH > 0 ? Math.min(1, boundsH / naturalH) : 1;
  const scaleW = naturalW > 0 ? Math.min(1, boundsW / naturalW) : 1;
  return Math.max(minScale, Math.min(scaleH, scaleW));
}

/**
 * Adaptive padding for box containers (step 1 of overflow adaptation).
 * Returns the default padding when content fits; reduces it toward 0 when
 * content natural height exceeds available space.
 */
function adaptBoxPadding(
  boundsH: number,
  contentNaturalH: number,
  defaultRatio: number = 0.05,
): number {
  const def = boundsH * defaultRatio;
  if (contentNaturalH <= boundsH - 2 * def) return def;
  return Math.max(0, (boundsH - contentNaturalH) / 2);
}

// ---------------------------------------------------------------------------
// Content height estimators — one entry per element type.
// Returns height in 0-100 relative coordinates.
// Blocks always return 0 (flex: use remaining space).
// ---------------------------------------------------------------------------

type ContentHeightEstimator = (node: ASTElement, baseFontSize: number, sceneTheme: SceneTheme) => number;

const defaultContentHeight: ContentHeightEstimator = (_, base, theme) =>
  base * theme.typography.bodySize * LINE_HEIGHT_MULTIPLIER;

const CONTENT_HEIGHT_ESTIMATORS: Record<string, ContentHeightEstimator> = {
  heading: (node, base, theme) => {
    const level = typeof node.props.level === 'number' ? node.props.level : 1;
    const mult = level === 1 ? theme.typography.headingSize : theme.typography.headingSize * 0.7;
    return base * mult * LINE_HEIGHT_MULTIPLIER;
  },
  stat: (_, base, theme) =>
    base * (theme.typography.statSize + theme.typography.bodySize) * LINE_HEIGHT_MULTIPLIER,
  quote: (_, base, theme) =>
    base * theme.typography.bodySize * LINE_HEIGHT_MULTIPLIER * 2,
  bullet: (node, base, theme) => {
    const n = Math.max(node.children.filter(
      (c): c is ASTElement => c.kind === 'element' && c.elementType === 'item',
    ).length, 1);
    return n * base * theme.typography.bodySize * LINE_HEIGHT_MULTIPLIER
      + (n - 1) * theme.layout.itemGap;
  },
  list: (node, base, theme) => {
    const n = Math.max(node.items?.length ?? 1, 1);
    return n * base * theme.typography.bodySize * LINE_HEIGHT_MULTIPLIER
      + (n - 1) * theme.layout.itemGap;
  },
  divider: () => 1,
  line: () => 1,
  image: (_, base) => base * 6,
};

/**
 * Estimate the content height of a scene element based on its type and font size.
 * Used by emitColumn/emitBoxBlock for compact vertical stacking instead of
 * equal-height distribution.
 * Blocks return 0, meaning they are flex items that share remaining space.
 */
function estimateContentHeight(node: ASTNode, baseFontSize: number, sceneTheme: SceneTheme): number {
  if (node.kind === 'block') return 0; // flex — use remaining space
  if (node.kind === 'element') {
    return (CONTENT_HEIGHT_ESTIMATORS[node.elementType] ?? defaultContentHeight)(node, baseFontSize, sceneTheme);
  }
  return defaultContentHeight(node as ASTElement, baseFontSize, sceneTheme);
}

/**
 * Compute compact stacking heights for a list of nodes.
 * Elements get their content height; remaining space is distributed to blocks
 * or left as bottom padding.
 */
function computeCompactHeights(
  nodes: ASTNode[],
  availableH: number,
  gap: number,
  baseFontSize: number,
  sceneTheme: SceneTheme,
): number[] {
  const n = nodes.length;
  if (n === 0) return [];

  const totalGap = gap * Math.max(n - 1, 0);
  const usable = Math.max(availableH - totalGap, 0);

  const contentHeights = nodes.map(node => estimateContentHeight(node, baseFontSize, sceneTheme));
  const fixedTotal = contentHeights.reduce((s, h) => s + (h > 0 ? h : 0), 0);
  const flexCount = contentHeights.filter(h => h === 0).length;
  const remaining = Math.max(usable - fixedTotal, 0);

  return contentHeights.map(h => {
    if (h > 0) return Math.min(h, usable); // content-sized
    return flexCount > 0 ? remaining / flexCount : 0; // flex items share remaining
  });
}

/**
 * Adapt baseFontSize so that all content fits within the available height.
 * If total estimated content height exceeds availableH, shrinks baseFontSize proportionally.
 * Minimum: 30% of original baseFontSize.
 */
function adaptBaseFontSize(
  availableH: number,
  contentNodes: ASTNode[],
  baseFontSize: number,
  gap: number,
  sceneTheme: SceneTheme,
): number {
  if (contentNodes.length === 0 || availableH <= 0) return baseFontSize;

  const totalGap = gap * Math.max(contentNodes.length - 1, 0);
  const totalContentH = contentNodes.reduce(
    (sum, node) => sum + estimateContentHeight(node, baseFontSize, sceneTheme), 0,
  ) + totalGap;

  if (totalContentH > availableH && totalContentH > 0) {
    const usable = Math.max(availableH - totalGap, 0);
    const totalEstimates = totalContentH - totalGap;
    const scale = totalEstimates > 0 ? usable / totalEstimates : 1;
    return Math.max(baseFontSize * scale, baseFontSize * 0.3);
  }

  return baseFontSize;
}

/**
 * Recursively estimate the natural height of a block node (box, layer, etc.)
 * for use in auto-height calculations. Block children are not flex items here —
 * their content drives the scene height.
 */
function estimateBlockNaturalHeight(
  block: ASTBlock,
  baseFontSize: number,
  sceneTheme: SceneTheme,
): number {
  const gap = sceneTheme.layout.itemGap;
  // Use scenePadding as a proxy for box inner padding (0–100 relative coords)
  const padding = sceneTheme.layout.scenePadding;
  const children = block.children.filter(c => c.kind !== 'edge');
  if (children.length === 0) return padding * 2;
  const childH = children.reduce((s, n) => {
    if (n.kind === 'block') return s + estimateBlockNaturalHeight(n as ASTBlock, baseFontSize, sceneTheme);
    return s + estimateContentHeight(n, baseFontSize, sceneTheme);
  }, 0) + gap * Math.max(children.length - 1, 0);
  return childH + padding * 2;
}

/**
 * Estimate the total height a scene requires for its content.
 * Used in @page * (auto-height) mode to derive the canvas h before planning.
 */
function computeSceneNaturalHeight(
  sceneBlock: ASTBlock,
  sceneTheme: SceneTheme,
): number {
  // 7 = 100 (canvas width) * 0.07; width-anchored baseline (0–100 relative coords)
  const baseFontSize = 7;
  const padding = sceneTheme.layout.scenePadding;
  const gap = sceneTheme.layout.itemGap;
  const nodes = sceneBlock.children.filter(c => c.kind !== 'edge');
  if (nodes.length === 0) return 100;
  const totalH = nodes.reduce((s, n) => {
    if (n.kind === 'block') return s + estimateBlockNaturalHeight(n as ASTBlock, baseFontSize, sceneTheme);
    return s + estimateContentHeight(n, baseFontSize, sceneTheme);
  }, 0) + gap * Math.max(nodes.length - 1, 0);
  // 100 = full canvas height (0–100 relative coords); minimum scene height
  return Math.max(totalH + padding * 2, 100);
}

// ---------------------------------------------------------------------------
// Element emitters
// ---------------------------------------------------------------------------

function emitHeading(
  el: ASTElement,
  id: string,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRText {
  const level = typeof el.props.level === 'number' ? el.props.level : 1;
  const sizeMultiplier = level === 1 ? sceneTheme.typography.headingSize : sceneTheme.typography.headingSize * 0.7;
  const naturalFontSize = baseFontSize * sizeMultiplier;
  const text = el.label ?? '';
  const scale = computeFitScale(
    bounds.h, bounds.w,
    naturalFontSize * LINE_HEIGHT_MULTIPLIER,
    estimateTextWidth(text, naturalFontSize),
  );
  const fontSize = naturalFontSize * scale;

  return {
    id,
    type: 'text',
    bounds,
    style: resolveElementStyle(el),
    content: text,
    fontSize,
    color: resolveTextColor(el.style, sceneTheme.colors.primary),
    fontWeight: 'bold',
    align: 'center',
    valign: 'middle',
  };
}

function emitLabel(
  el: ASTElement,
  id: string,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRText {
  const sizeStr = el.props.size;
  let sizeMultiplier = sceneTheme.typography.bodySize;
  if (sizeStr === 'sm') sizeMultiplier *= 0.8;
  if (sizeStr === 'lg') sizeMultiplier *= 1.2;
  const naturalFontSize = baseFontSize * sizeMultiplier;
  const text = el.label ?? '';
  const scale = computeFitScale(
    bounds.h, bounds.w,
    naturalFontSize * LINE_HEIGHT_MULTIPLIER,
    estimateTextWidth(text, naturalFontSize),
  );

  return {
    id,
    type: 'text',
    bounds,
    style: resolveElementStyle(el),
    content: text,
    fontSize: naturalFontSize * scale,
    color: resolveTextColor(el.style, sceneTheme.colors.textMuted),
    align: 'center',
    valign: 'middle',
  };
}

function emitBullet(
  el: ASTElement,
  id: string,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRContainer {
  const children: IRElement[] = [];

  // Collect item labels from both sources:
  // - bullet: children with elementType 'item'
  // - list: items string array
  const itemLabels: string[] = [];
  const itemChildren = el.children.filter(
    (c): c is ASTElement => c.kind === 'element' && c.elementType === 'item',
  );
  if (itemChildren.length > 0) {
    for (const item of itemChildren) itemLabels.push(item.label ?? '');
  } else if (el.items && el.items.length > 0) {
    itemLabels.push(...el.items);
  }

  const gap = sceneTheme.layout.itemGap;
  const isOrdered = el.flags?.includes('ordered') ?? false;
  const naturalItemFontSize = baseFontSize * sceneTheme.typography.bodySize;
  const n = itemLabels.length;
  const longestLabel = itemLabels.reduce((a, b) => a.length > b.length ? a : b, '');
  const samplePrefix = isOrdered ? `${n}.` : '•';
  const naturalH = n * naturalItemFontSize * LINE_HEIGHT_MULTIPLIER + gap * Math.max(n - 1, 0);
  const naturalW = estimateTextWidth(`${samplePrefix} ${longestLabel}`, naturalItemFontSize);
  const scale = computeFitScale(bounds.h, bounds.w - 4, naturalH, naturalW);
  const itemFontSize = naturalItemFontSize * scale;
  const itemContentH = itemFontSize * LINE_HEIGHT_MULTIPLIER;

  let curY = bounds.y;
  for (let i = 0; i < itemLabels.length; i++) {
    const prefix = isOrdered ? `${i + 1}.` : '•';
    const itemBounds: IRBounds = { x: bounds.x + 2, y: curY, w: bounds.w - 4, h: Math.max(itemContentH, 2) };
    children.push({
      id: `${id}-item-${i}`,
      type: 'text',
      bounds: itemBounds,
      style: {},
      content: `${prefix} ${itemLabels[i]}`,
      fontSize: itemFontSize,
      color: resolveTextColor(el.style, sceneTheme.colors.text),
      align: 'left',
      valign: 'middle',
    } as IRText);
    curY += itemContentH + gap;
  }

  return {
    id,
    type: 'container',
    bounds,
    style: {},
    children,
    origin: { sourceType: 'bullet' as const },
  };
}

function emitStat(
  el: ASTElement,
  id: string,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRContainer {
  const statValue = el.label ?? '';
  const statLabel = typeof el.props.label === 'string' ? el.props.label : '';
  const statColor = resolveTextColor(el.style, sceneTheme.colors.accent);

  const naturalValueFS = baseFontSize * sceneTheme.typography.statSize;
  const naturalLabelFS = baseFontSize * sceneTheme.typography.bodySize;
  const gap = sceneTheme.layout.itemGap;
  const naturalTotalH = (naturalValueFS + naturalLabelFS) * LINE_HEIGHT_MULTIPLIER + gap;
  const naturalW = estimateTextWidth(statValue || '0', naturalValueFS);
  const scale = computeFitScale(bounds.h, bounds.w, naturalTotalH, naturalW);

  const valueFontSize = naturalValueFS * scale;
  const labelFontSize = naturalLabelFS * scale;
  const valueH = valueFontSize * LINE_HEIGHT_MULTIPLIER;
  const labelH = labelFontSize * LINE_HEIGHT_MULTIPLIER;
  const startY = bounds.y + (bounds.h - valueH - labelH - gap) / 2;

  const children: IRElement[] = [
    {
      id: `${id}-value`,
      type: 'text',
      bounds: { x: bounds.x, y: startY, w: bounds.w, h: valueH },
      style: {},
      content: statValue,
      fontSize: valueFontSize,
      color: statColor,
      fontWeight: 'bold',
      align: 'center',
      valign: 'middle',
    } as IRText,
    {
      id: `${id}-label`,
      type: 'text',
      bounds: { x: bounds.x, y: startY + valueH + gap, w: bounds.w, h: labelH },
      style: {},
      content: statLabel,
      fontSize: labelFontSize,
      color: sceneTheme.colors.textMuted,
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
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRContainer {
  const quoteText = el.label ?? '';
  const attribution = typeof el.props.attribution === 'string' ? el.props.attribution : '';

  const naturalQuoteFS = baseFontSize * sceneTheme.typography.headingSize * 0.8;
  const naturalAttrFS = baseFontSize * sceneTheme.typography.bodySize;
  const gap = sceneTheme.layout.itemGap;
  const naturalTotalH = attribution
    ? (naturalQuoteFS + naturalAttrFS) * LINE_HEIGHT_MULTIPLIER + gap
    : naturalQuoteFS * LINE_HEIGHT_MULTIPLIER;
  const naturalW = estimateTextWidth(quoteText, naturalQuoteFS);
  const scale = computeFitScale(bounds.h, bounds.w, naturalTotalH, naturalW);

  const quoteFontSize = naturalQuoteFS * scale;
  const attrFontSize = naturalAttrFS * scale;
  const quoteH = quoteFontSize * LINE_HEIGHT_MULTIPLIER;
  const attrH = attrFontSize * LINE_HEIGHT_MULTIPLIER;

  const children: IRElement[] = [
    {
      id: `${id}-text`,
      type: 'text',
      bounds: { x: bounds.x, y: bounds.y, w: bounds.w, h: quoteH },
      style: {},
      content: `\u201C${quoteText}\u201D`,
      fontSize: quoteFontSize,
      color: resolveTextColor(el.style, sceneTheme.colors.primary),
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
      fontSize: attrFontSize,
      color: sceneTheme.colors.textMuted,
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

function emitSceneDivider(
  _el: ASTElement,
  id: string,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
): IRLine {
  const midY = bounds.y + bounds.h / 2;
  return {
    id,
    type: 'line',
    bounds,
    style: { stroke: sceneTheme.colors.textMuted, strokeWidth: 0.2 },
    from: { x: bounds.x, y: midY },
    to: { x: bounds.x + bounds.w, y: midY },
  } as IRLine;
}

function emitSceneShape(
  el: ASTElement,
  id: string,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRShape {
  const naturalFontSize = baseFontSize * sceneTheme.typography.bodySize;
  const text = el.label ?? '';
  const scale = text
    ? computeFitScale(bounds.h, bounds.w, naturalFontSize * LINE_HEIGHT_MULTIPLIER, estimateTextWidth(text, naturalFontSize))
    : 1;
  const fontSize = naturalFontSize * scale;
  const shapeStyle = resolveElementStyle(el);
  if (!shapeStyle.fill) shapeStyle.fill = sceneTheme.colors.background;
  if (!shapeStyle.stroke) shapeStyle.stroke = sceneTheme.colors.textMuted;
  const cornerRadius = typeof el.style.radius === 'number' ? el.style.radius : undefined;
  return {
    id,
    type: 'shape',
    bounds,
    style: shapeStyle,
    shape: getElementConfig(el.elementType).emitShape ?? 'rect',
    cornerRadius,
    innerText: el.label ? {
      content: el.label,
      color: resolveTextColor(el.style, sceneTheme.colors.text),
      fontSize,
      align: 'center' as const,
      valign: 'middle' as const,
    } : undefined,
  } as IRShape;
}

function emitColumn(
  block: ASTBlock,
  id: string,
  bounds: IRBounds,
  theme: DepixTheme,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRContainer {
  const children: IRElement[] = [];
  const contentNodes = block.children.filter(c => c.kind !== 'edge');
  const gap = sceneTheme.layout.itemGap;
  const adaptedFontSize = adaptBaseFontSize(bounds.h, contentNodes, baseFontSize, gap, sceneTheme);
  const heights = computeCompactHeights(contentNodes, bounds.h, gap, adaptedFontSize, sceneTheme);

  let curY = bounds.y;
  for (let i = 0; i < contentNodes.length; i++) {
    const child = contentNodes[i];
    const childId = `${id}-child-${i}`;
    const h = Math.max(heights[i], 2);
    const childBounds: IRBounds = { x: bounds.x, y: curY, w: bounds.w, h };
    const el = emitSceneContent(child, childId, childBounds, theme, sceneTheme, adaptedFontSize);
    if (el) children.push(el);
    curY += h + gap;
  }

  const origin: IROrigin = { sourceType: 'scene', sourceProps: { columnId: id } };

  return {
    id,
    type: 'container',
    bounds,
    style: {},
    children,
    origin,
  };
}

function emitBoxBlock(
  block: ASTBlock,
  id: string,
  bounds: IRBounds,
  theme: DepixTheme,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRContainer {
  const children: IRElement[] = [];
  const contentNodes = block.children.filter(c => c.kind !== 'edge');
  const gap = sceneTheme.layout.itemGap;
  // Step 1: reduce padding when content height is tight
  const naturalContentH = contentNodes.reduce(
    (s, n) => s + estimateContentHeight(n, baseFontSize, sceneTheme), 0,
  ) + gap * Math.max(contentNodes.length - 1, 0);
  const padding = adaptBoxPadding(bounds.h, naturalContentH);
  const inner: IRBounds = {
    x: bounds.x + padding,
    y: bounds.y + padding,
    w: Math.max(bounds.w - padding * 2, 1),
    h: Math.max(bounds.h - padding * 2, 1),
  };

  // Zone label for layer blocks — rendered top-left as a small category marker.
  let zoneLabelH = 0;
  if (block.blockType === 'layer' && block.label) {
    // 0.85 ≈ body font * 85% — conventional ratio for category label text.
    // Smaller than body content to distinguish zone label from main content.
    // Units: dimensionless ratio (font size multiplier).
    const zoneFontSize = baseFontSize * sceneTheme.typography.bodySize * 0.85;
    zoneLabelH = zoneFontSize * LINE_HEIGHT_MULTIPLIER;
    children.push({
      id: `${id}-zone-label`,
      type: 'text',
      bounds: { x: inner.x, y: inner.y, w: inner.w, h: zoneLabelH },
      style: {},
      content: block.label,
      fontSize: zoneFontSize,
      color: resolveTextColor(block.style, sceneTheme.colors.textMuted),
      align: 'left',
      valign: 'middle',
      origin: { sourceType: 'layer-zone-label' },
    } as IRText);
  }

  const innerAfterZone: IRBounds = {
    x: inner.x,
    y: inner.y + (zoneLabelH > 0 ? zoneLabelH + gap : 0),
    w: inner.w,
    h: Math.max(inner.h - (zoneLabelH > 0 ? zoneLabelH + gap : 0), 1),
  };

  const adaptedFontSize = adaptBaseFontSize(innerAfterZone.h, contentNodes, baseFontSize, gap, sceneTheme);
  const heights = computeCompactHeights(contentNodes, innerAfterZone.h, gap, adaptedFontSize, sceneTheme);

  let curY = innerAfterZone.y;
  for (let i = 0; i < contentNodes.length; i++) {
    const child = contentNodes[i];
    const childId = `${id}-child-${i}`;
    const h = Math.max(heights[i], 2);
    const childBounds: IRBounds = { x: innerAfterZone.x, y: curY, w: innerAfterZone.w, h };
    const el = emitSceneContent(child, childId, childBounds, theme, sceneTheme, adaptedFontSize);
    if (el) children.push(el);
    curY += h + gap;
  }

  const containerStyle = resolveElementStyle(block);
  if (!containerStyle.stroke && !containerStyle.fill) {
    containerStyle.stroke = sceneTheme.colors.textMuted;
    containerStyle.strokeWidth = 0.3;
  }

  return {
    id,
    type: 'container',
    bounds,
    style: containerStyle,
    children,
    origin: { sourceType: 'box', dslType: block.blockType },
  };
}

function emitSceneTable(
  block: ASTBlock,
  id: string,
  bounds: IRBounds,
  _theme: DepixTheme,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRContainer {
  const children: IRElement[] = [];
  const rows = block.children.filter(
    (c): c is ASTElement => c.kind === 'element' && c.elementType === 'row',
  );

  if (rows.length === 0) {
    return { id, type: 'container', bounds, style: {}, children };
  }

  const gap = sceneTheme.layout.itemGap * 0.3;
  const rowH = (bounds.h - gap * Math.max(rows.length - 1, 0)) / rows.length;

  let curY = bounds.y;
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const isHeader = row.props.header === 1;
    const values = row.values ?? [];
    const colCount = Math.max(values.length, 1);
    const cellW = bounds.w / colCount;
    const rowBounds: IRBounds = { x: bounds.x, y: curY, w: bounds.w, h: rowH };
    const rowChildren: IRElement[] = [];

    for (let ci = 0; ci < values.length; ci++) {
      const cellBounds: IRBounds = {
        x: bounds.x + ci * cellW,
        y: curY,
        w: cellW,
        h: rowH,
      };

      // Cell background
      rowChildren.push({
        id: `${id}-r${ri}-c${ci}-bg`,
        type: 'shape',
        bounds: cellBounds,
        style: {
          fill: isHeader ? sceneTheme.colors.surface : sceneTheme.colors.background,
          stroke: sceneTheme.colors.textMuted,
          strokeWidth: 0.15,
        },
        shape: 'rect',
      });

      // Cell text
      const cellContent = String(values[ci]);
      const naturalCellFS = baseFontSize * sceneTheme.typography.bodySize * 0.9;
      const cellScale = computeFitScale(rowH, cellW - 1, naturalCellFS * LINE_HEIGHT_MULTIPLIER, estimateTextWidth(cellContent, naturalCellFS));
      const cellText: IRText = {
        id: `${id}-r${ri}-c${ci}-text`,
        type: 'text',
        bounds: {
          x: cellBounds.x + 0.5,
          y: cellBounds.y,
          w: cellBounds.w - 1,
          h: cellBounds.h,
        },
        style: {},
        content: cellContent,
        fontSize: naturalCellFS * cellScale,
        color: sceneTheme.colors.text,
        align: typeof values[ci] === 'number' ? 'right' : 'left',
        valign: 'middle',
      };
      if (isHeader) cellText.fontWeight = 'bold';
      rowChildren.push(cellText);
    }

    children.push({
      id: `${id}-row-${ri}`,
      type: 'container',
      bounds: rowBounds,
      style: {},
      children: rowChildren,
    } as IRContainer);

    curY += rowH + gap;
  }

  return { id, type: 'container', bounds, style: {}, children };
}

function emitSceneChart(
  block: ASTBlock,
  id: string,
  bounds: IRBounds,
  theme: DepixTheme,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRContainer {
  const children: IRElement[] = [];
  const data = extractChartData(block);

  if (data.length === 0) {
    return { id, type: 'container', bounds, style: {}, children };
  }

  const chartType = typeof block.props.type === 'string' ? block.props.type : 'bar';
  const fontSize = baseFontSize * sceneTheme.typography.bodySize;

  switch (chartType) {
    case 'line':
      emitSceneLineChart(children, id, bounds, data, theme, sceneTheme, fontSize);
      break;
    case 'pie':
      emitScenePieChart(children, id, bounds, data, theme, sceneTheme, fontSize);
      break;
    default:
      emitSceneBarChart(children, id, bounds, data, theme, sceneTheme, fontSize);
      break;
  }

  return { id, type: 'container', bounds, style: {}, children };
}

function emitSceneChartAxes(
  children: IRElement[],
  id: string,
  axes: { yAxis: { from: { x: number; y: number }; to: { x: number; y: number }; bounds: IRBounds }; xAxis: { from: { x: number; y: number }; to: { x: number; y: number }; bounds: IRBounds }; yLabelMax: { bounds: IRBounds; content: string }; yLabelZero: { bounds: IRBounds } },
  sceneTheme: SceneTheme,
  fontSize: number,
): void {
  children.push({
    id: `${id}-y-axis`, type: 'line', bounds: axes.yAxis.bounds,
    style: { stroke: sceneTheme.colors.textMuted, strokeWidth: 0.2 },
    from: axes.yAxis.from, to: axes.yAxis.to,
  } as IRLine);
  children.push({
    id: `${id}-x-axis`, type: 'line', bounds: axes.xAxis.bounds,
    style: { stroke: sceneTheme.colors.textMuted, strokeWidth: 0.2 },
    from: axes.xAxis.from, to: axes.xAxis.to,
  } as IRLine);
  children.push({
    id: `${id}-ylabel-max`, type: 'text', bounds: axes.yLabelMax.bounds,
    style: {}, content: axes.yLabelMax.content,
    fontSize: fontSize * 0.65, color: sceneTheme.colors.textMuted, align: 'right', valign: 'top',
  } as IRText);
  children.push({
    id: `${id}-ylabel-zero`, type: 'text', bounds: axes.yLabelZero.bounds,
    style: {}, content: '0',
    fontSize: fontSize * 0.65, color: sceneTheme.colors.textMuted, align: 'right', valign: 'bottom',
  } as IRText);
}

function emitSceneBarChart(
  children: IRElement[],
  id: string,
  bounds: IRBounds,
  data: { category: string; value: number }[],
  theme: DepixTheme,
  sceneTheme: SceneTheme,
  fontSize: number,
): void {
  const positions = computeChartPositions(bounds, data);
  emitSceneChartAxes(children, id, positions.axes, sceneTheme, fontSize);

  for (let i = 0; i < positions.bars.length; i++) {
    const bar = positions.bars[i];
    children.push({
      id: `${id}-bar-${i}`, type: 'shape', bounds: bar.barBounds,
      style: { fill: getChartColor(i, theme) }, shape: 'rect',
    } as IRShape);
    children.push({
      id: `${id}-xlabel-${i}`, type: 'text', bounds: bar.labelBounds,
      style: {}, content: bar.category,
      fontSize: fontSize * 0.7, color: sceneTheme.colors.textMuted, align: 'center', valign: 'top',
    } as IRText);
  }
}

function emitSceneLineChart(
  children: IRElement[],
  id: string,
  bounds: IRBounds,
  data: { category: string; value: number }[],
  theme: DepixTheme,
  sceneTheme: SceneTheme,
  fontSize: number,
): void {
  const positions = computeLineChartPositions(bounds, data);
  emitSceneChartAxes(children, id, positions.axes, sceneTheme, fontSize);

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
      style: { stroke: sceneTheme.colors.textMuted, strokeWidth: 0.3 },
      from: seg.from, to: seg.to,
    } as IRLine);
  }

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
      fontSize: fontSize * 0.7, color: sceneTheme.colors.textMuted, align: 'center', valign: 'top',
    } as IRText);
  }
}

function emitScenePieChart(
  children: IRElement[],
  id: string,
  bounds: IRBounds,
  data: { category: string; value: number }[],
  theme: DepixTheme,
  sceneTheme: SceneTheme,
  fontSize: number,
): void {
  const positions = computePieChartPositions(bounds, data);

  for (let i = 0; i < positions.wedges.length; i++) {
    const wedge = positions.wedges[i];
    children.push({
      id: `${id}-wedge-${i}`, type: 'path', bounds,
      style: { fill: getChartColor(i, theme), stroke: sceneTheme.colors.background, strokeWidth: 0.3 },
      d: wedge.pathD, closed: true,
    } as IRPath);
    children.push({
      id: `${id}-label-${i}`, type: 'text', bounds: wedge.labelBounds,
      style: {}, content: `${wedge.category} ${Math.round(wedge.percentage)}%`,
      fontSize: fontSize * 0.6, color: sceneTheme.colors.text, align: 'center', valign: 'middle',
    } as IRText);
  }
}

function emitImage(
  el: ASTElement,
  id: string,
  bounds: IRBounds,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRContainer {
  const src = el.label ?? '';
  const alt = typeof el.props.alt === 'string' ? el.props.alt : src;
  const labelW = bounds.w - 4;
  const labelH = bounds.h * 0.2;
  const naturalLabelFS = baseFontSize * sceneTheme.typography.bodySize * 0.8;
  const labelScale = computeFitScale(labelH, labelW, naturalLabelFS * LINE_HEIGHT_MULTIPLIER, estimateTextWidth(alt, naturalLabelFS));

  const children: IRElement[] = [
    {
      id: `${id}-bg`,
      type: 'shape',
      bounds: { ...bounds },
      style: { fill: sceneTheme.colors.surface },
      shape: 'rect',
    },
    {
      id: `${id}-label`,
      type: 'text',
      bounds: { x: bounds.x + 2, y: bounds.y + bounds.h * 0.4, w: labelW, h: labelH },
      style: {},
      content: alt,
      fontSize: naturalLabelFS * labelScale,
      color: sceneTheme.colors.textMuted,
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
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRContainer {
  const iconSymbol = el.label ?? '';
  const iconLabel = typeof el.props.label === 'string' ? el.props.label : '';
  const iconDesc = typeof el.props.description === 'string' ? el.props.description : '';

  const naturalSymbolFS = baseFontSize * sceneTheme.typography.statSize;
  const naturalLabelFS = baseFontSize * sceneTheme.typography.bodySize * 1.1;
  const naturalDescFS = baseFontSize * sceneTheme.typography.bodySize * 0.85;
  const gap = sceneTheme.layout.itemGap;
  const partsCount = 1 + (iconLabel ? 1 : 0) + (iconDesc ? 1 : 0);
  const naturalTotalH = (
    naturalSymbolFS * LINE_HEIGHT_MULTIPLIER
    + (iconLabel ? naturalLabelFS * LINE_HEIGHT_MULTIPLIER : 0)
    + (iconDesc ? naturalDescFS * LINE_HEIGHT_MULTIPLIER : 0)
    + gap * Math.max(partsCount - 1, 0)
  );
  const longestText = [iconSymbol, iconLabel, iconDesc].reduce((a, b) => a.length > b.length ? a : b, '');
  const naturalW = estimateTextWidth(longestText, naturalSymbolFS);
  const scale = computeFitScale(bounds.h, bounds.w, naturalTotalH, naturalW);

  const symbolFS = naturalSymbolFS * scale;
  const labelFS = naturalLabelFS * scale;
  const descFS = naturalDescFS * scale;
  const iconH = symbolFS * LINE_HEIGHT_MULTIPLIER;
  const labelH = labelFS * LINE_HEIGHT_MULTIPLIER;
  const descH = descFS * LINE_HEIGHT_MULTIPLIER;

  const children: IRElement[] = [
    {
      id: `${id}-symbol`,
      type: 'text',
      bounds: { x: bounds.x, y: bounds.y + gap, w: bounds.w, h: iconH },
      style: {},
      content: iconSymbol,
      fontSize: symbolFS,
      color: resolveTextColor(el.style, sceneTheme.colors.accent),
      align: 'center',
      valign: 'middle',
    } as IRText,
  ];

  if (iconLabel) {
    children.push({
      id: `${id}-label`,
      type: 'text',
      bounds: { x: bounds.x, y: bounds.y + gap + iconH + gap, w: bounds.w, h: labelH },
      style: {},
      content: iconLabel,
      fontSize: labelFS,
      color: sceneTheme.colors.text,
      fontWeight: 'bold',
      align: 'center',
      valign: 'middle',
    } as IRText);
  }

  if (iconDesc) {
    children.push({
      id: `${id}-desc`,
      type: 'text',
      bounds: { x: bounds.x + bounds.w * 0.05, y: bounds.y + gap + iconH + gap + labelH + gap, w: bounds.w * 0.9, h: descH },
      style: {},
      content: iconDesc,
      fontSize: descFS,
      color: sceneTheme.colors.textMuted,
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
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRContainer {
  const stepLabel = el.label ?? '';
  const stepDesc = typeof el.props.label === 'string' ? el.props.label : '';

  const naturalLabelFS = baseFontSize * sceneTheme.typography.bodySize * 1.2;
  const naturalDescFS = baseFontSize * sceneTheme.typography.bodySize;
  const gap = sceneTheme.layout.itemGap;
  // Marker circle size is derived from label font height
  const naturalMarkerH = naturalLabelFS * LINE_HEIGHT_MULTIPLIER;
  const naturalTotalH = stepDesc
    ? naturalMarkerH + naturalDescFS * LINE_HEIGHT_MULTIPLIER + gap * 2
    : naturalMarkerH;
  const naturalW = Math.max(naturalMarkerH, stepDesc ? estimateTextWidth(stepDesc, naturalDescFS) : 0);
  const scale = computeFitScale(bounds.h, bounds.w, naturalTotalH, naturalW);

  const labelFS = naturalLabelFS * scale;
  const descFS = naturalDescFS * scale;
  const markerH = labelFS * LINE_HEIGHT_MULTIPLIER;
  const descH = descFS * LINE_HEIGHT_MULTIPLIER;

  const children: IRElement[] = [
    {
      id: `${id}-marker`,
      type: 'shape',
      bounds: {
        x: bounds.x + (bounds.w - markerH) / 2,
        y: bounds.y + gap,
        w: markerH,
        h: markerH,
      },
      style: { fill: sceneTheme.colors.accent },
      shape: 'circle',
    },
    {
      id: `${id}-label`,
      type: 'text',
      bounds: {
        x: bounds.x + (bounds.w - markerH) / 2,
        y: bounds.y + gap,
        w: markerH,
        h: markerH,
      },
      style: {},
      content: stepLabel,
      fontSize: labelFS,
      color: sceneTheme.colors.background,
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
        y: bounds.y + gap + markerH + gap,
        w: bounds.w,
        h: descH,
      },
      style: {},
      content: stepDesc,
      fontSize: descFS,
      color: resolveTextColor(el.style, sceneTheme.colors.text),
      align: 'center',
      valign: 'top',
    } as IRText);
  }

  return { id, type: 'container', bounds, style: {}, children };
}

// ---------------------------------------------------------------------------
// Scene background element
// ---------------------------------------------------------------------------

function emitSceneBackground(bounds: IRBounds, sceneTheme: SceneTheme): IRElement {
  return {
    id: generateId(),
    type: 'shape',
    bounds: { ...bounds },
    style: { fill: sceneTheme.colors.background },
    shape: 'rect',
    origin: { sourceType: 'scene-background' },
  };
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

function buildSceneMeta(
  directives: ASTDirective[],
  theme: DepixTheme,
  sceneTheme: SceneTheme,
): IRMeta {
  let aspectRatio = { width: 16, height: 9 };
  let drawingStyle: 'default' | 'sketch' = 'default';

  let autoHeight = false;

  for (const d of directives) {
    // @ratio and @page are both valid aspect ratio directives
    if (d.key === 'ratio' || d.key === 'page') {
      if (d.value === '*') {
        // @page * — content-driven height; scene h computed per scene
        autoHeight = true;
        continue;
      }
      const parts = d.value.split(':');
      if (parts.length === 2) {
        const w = parseInt(parts[0], 10);
        const h = parseInt(parts[1], 10);
        if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
          aspectRatio = { width: w, height: h };
        }
      }
    }
    if (d.key === 'style' && (d.value === 'default' || d.value === 'sketch')) {
      drawingStyle = d.value;
    }
  }

  return {
    aspectRatio,
    background: { type: 'solid', color: theme.background ?? sceneTheme.colors.background },
    drawingStyle,
    ...(autoHeight && { autoHeight: true }),
  };
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

const VALID_TRANSITION_TYPES: readonly string[] = [
  'fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down',
  'zoom-in', 'zoom-out',
];

function buildSceneTransitions(
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

function resolveElementStyle(el: ASTElement | ASTBlock): IRStyle {
  const style: IRStyle = {};
  if ('background' in el.style) style.fill = String(el.style.background);
  if ('border' in el.style && typeof el.style.border === 'string') style.stroke = el.style.border;
  if ('border-width' in el.style && typeof el.style['border-width'] === 'number') style.strokeWidth = el.style['border-width'];
  return style;
}

function resolveTextColor(style: Record<string, string | number>, fallback: string): string {
  return typeof style.color === 'string' ? style.color : fallback;
}
