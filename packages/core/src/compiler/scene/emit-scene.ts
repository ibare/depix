/**
 * Scene IR Emission — Orchestrator
 *
 * Converts scene AST blocks + ScenePlan into IRScene[].
 * Delegates to scene-elements, scene-blocks, scene-charts, scene-measure,
 * scene-helpers, and scene-meta for concrete emission.
 */

import type {
  DepixIR,
  IRBounds,
  IRContainer,
  IRElement,
  IRScene,
  IRStyle,
} from '../../ir/types.js';
import type { DepixTheme } from '../../theme/types.js';
import type { SceneTheme } from '../../theme/scene-theme.js';
import type {
  ASTBlock,
  ASTDocument,
  ASTNode,
} from '../ast.js';
import { generateId } from '../../ir/utils.js';
import { planScene, type ScenePlan } from './plan-scene.js';
import { emitInlineBlock } from '../passes/emit-ir.js';
import { createScaleContext } from '../passes/scale-system.js';
import { planNode } from '../passes/plan-layout.js';
import { getElementConfig } from '../element-type-registry.js';
import { computeSceneNaturalHeight, adaptBaseFontSize } from './scene-measure.js';
import { buildSceneMeta, buildSceneTransitions } from './scene-meta.js';
import {
  emitHeading,
  emitLabel,
  emitBullet,
  emitStat,
  emitQuote,
  emitImage,
  emitIcon,
  emitStep,
  emitSceneDivider,
  emitSceneShape,
} from './scene-elements.js';
import { emitColumn, emitBoxBlock, emitSceneTable } from './scene-blocks.js';
import { emitSceneChart } from './scene-charts.js';

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
      return emitColumn(node, id, bounds, theme, sceneTheme, baseFontSize, emitSceneContent);
    }
    if (node.blockType === 'table') {
      return emitSceneTable(node, id, bounds, theme, sceneTheme, baseFontSize);
    }
    if (node.blockType === 'chart') {
      return emitSceneChart(node, id, bounds, theme, sceneTheme, baseFontSize);
    }
    // Box/layer: visual container — render children with scene emitters
    if (node.blockType === 'box' || node.blockType === 'layer') {
      return emitBoxBlock(node, id, bounds, theme, sceneTheme, baseFontSize, emitSceneContent);
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
      const el = emitBoxBlock(b, childId, childBounds, theme, sceneTheme, baseFontSize, emitSceneContent);
      bMap.set(childId, childBounds);
      return el;
    };
    return emitInlineBlock(node, bounds, theme, new Map(), inlineScaleCtx, childBlockRouter);
  }

  return null;
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

