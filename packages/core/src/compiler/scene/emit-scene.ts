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
  IRMeta,
  IROrigin,
  IRScene,
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
import { emitIR } from '../passes/emit-ir.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compile a presentation-mode AST document into DepixIR.
 *
 * Each scene block becomes an independent IRScene.
 * Non-scene content is ignored in presentation mode.
 */
export function emitSceneIR(
  ast: ASTDocument,
  theme: DepixTheme,
  sceneTheme: SceneTheme,
): DepixIR {
  const meta = buildSceneMeta(ast.directives, theme, sceneTheme);
  const canvasBounds: IRBounds = { x: 0, y: 0, w: 100, h: 100 };
  const scenes: IRScene[] = [];

  // Each scene block is a presentation scene
  for (let sceneIndex = 0; sceneIndex < ast.scenes.length; sceneIndex++) {
    const sceneBlock = ast.scenes[sceneIndex];
    const plan = planScene(sceneBlock, canvasBounds, sceneTheme);

    if (plan.layoutType === 'custom') {
      const customScene = emitCustomScene(sceneBlock, sceneIndex, theme);
      if (customScene) scenes.push(customScene);
    } else {
      const irScene = emitScene(sceneBlock, plan, sceneIndex, theme, sceneTheme);
      scenes.push(irScene);
    }
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
  const baseFontSize = plan.sceneBounds.h * 0.04;

  // Background rect
  elements.push(emitSceneBackground(plan.sceneBounds, sceneTheme));

  // Emit each content node using pre-computed bounds
  let childIdx = 0;
  for (const child of sceneBlock.children) {
    if (child.kind === 'edge') continue;

    const childId = plan.childIds[childIdx];
    const bounds = plan.boundsMap.get(childId);
    childIdx++;

    if (!bounds) continue;

    const el = emitSceneContent(child, childId, bounds, theme, sceneTheme, baseFontSize);
    if (el) elements.push(el);
  }

  return {
    id: sceneBlock.label ?? sceneBlock.id ?? `scene-${index}`,
    background: { type: 'solid', color: sceneTheme.colors.background },
    elements,
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
    switch (node.elementType) {
      case 'heading': return emitHeading(node, id, bounds, sceneTheme, baseFontSize);
      case 'label':
      case 'text': return emitLabel(node, id, bounds, sceneTheme, baseFontSize);
      case 'bullet': return emitBullet(node, id, bounds, sceneTheme, baseFontSize);
      case 'stat': return emitStat(node, id, bounds, sceneTheme, baseFontSize);
      case 'quote': return emitQuote(node, id, bounds, sceneTheme, baseFontSize);
      case 'image': return emitImage(node, id, bounds, sceneTheme, baseFontSize);
      case 'icon': return emitIcon(node, id, bounds, sceneTheme, baseFontSize);
      case 'step': return emitStep(node, id, bounds, sceneTheme, baseFontSize);
      default: return emitLabel(node, id, bounds, sceneTheme, baseFontSize);
    }
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
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRText {
  const level = typeof el.props.level === 'number' ? el.props.level : 1;
  const sizeMultiplier = level === 1 ? sceneTheme.typography.headingSize : sceneTheme.typography.headingSize * 0.7;
  const fontSize = baseFontSize * sizeMultiplier;

  return {
    id,
    type: 'text',
    bounds,
    style: resolveElementStyle(el),
    content: el.label ?? '',
    fontSize,
    color: sceneTheme.colors.primary,
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

  return {
    id,
    type: 'text',
    bounds,
    style: resolveElementStyle(el),
    content: el.label ?? '',
    fontSize: baseFontSize * sizeMultiplier,
    color: sceneTheme.colors.textMuted,
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
  const itemNodes = el.children.filter(
    (c): c is ASTElement => c.kind === 'element' && c.elementType === 'item',
  );
  const itemCount = itemNodes.length || 1;
  const gap = sceneTheme.layout.itemGap;
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
      fontSize: baseFontSize * sceneTheme.typography.bodySize,
      color: sceneTheme.colors.text,
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
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRContainer {
  const statValue = el.label ?? '';
  const statLabel = typeof el.props.label === 'string' ? el.props.label : '';
  const statColor = typeof el.props.color === 'string'
    ? el.props.color
    : sceneTheme.colors.accent;

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
      fontSize: baseFontSize * sceneTheme.typography.statSize,
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
      fontSize: baseFontSize * sceneTheme.typography.bodySize,
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
      fontSize: baseFontSize * sceneTheme.typography.headingSize * 0.8,
      color: sceneTheme.colors.primary,
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
      fontSize: baseFontSize * sceneTheme.typography.bodySize,
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
  const itemH = contentNodes.length > 0
    ? (bounds.h - gap * (contentNodes.length - 1)) / contentNodes.length
    : bounds.h;

  let curY = bounds.y;
  for (let i = 0; i < contentNodes.length; i++) {
    const child = contentNodes[i];
    const childId = `${id}-child-${i}`;
    const childBounds: IRBounds = { x: bounds.x, y: curY, w: bounds.w, h: Math.max(itemH, 2) };
    const el = emitSceneContent(child, childId, childBounds, theme, sceneTheme, baseFontSize);
    if (el) children.push(el);
    curY += itemH + gap;
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
        content: String(values[ci]),
        fontSize: baseFontSize * sceneTheme.typography.bodySize * 0.9,
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
  _theme: DepixTheme,
  sceneTheme: SceneTheme,
  baseFontSize: number,
): IRContainer {
  const children: IRElement[] = [];
  const rows = block.children.filter(
    (c): c is ASTElement => c.kind === 'element' && c.elementType === 'row',
  );

  // Determine x and y columns from props
  const xCol = typeof block.props.x === 'string' ? block.props.x : undefined;
  const yCol = typeof block.props.y === 'string' ? block.props.y : undefined;

  // Extract header and data rows
  const headerRow = rows.find(r => r.props.header === 1);
  const dataRows = rows.filter(r => r.props.header !== 1);

  if (dataRows.length === 0) {
    return { id, type: 'container', bounds, style: {}, children };
  }

  const columns = headerRow?.values?.map(v => String(v)) ?? [];
  const xIdx = xCol ? columns.indexOf(xCol) : 0;
  const yIdx = yCol ? columns.indexOf(yCol) : columns.findIndex((_c, i) => {
    // First column with numeric data
    return i > 0 && dataRows.some(r => typeof r.values?.[i] === 'number');
  });
  const effectiveYIdx = yIdx >= 0 ? yIdx : 1;

  // Extract values
  const categories = dataRows.map(r => String(r.values?.[xIdx] ?? ''));
  const values = dataRows.map(r => {
    const v = r.values?.[effectiveYIdx];
    return typeof v === 'number' ? v : 0;
  });
  const maxVal = Math.max(...values, 1);

  // Chart area (with margins for axes)
  const axisMarginLeft = bounds.w * 0.08;
  const axisMarginBottom = bounds.h * 0.15;
  const plotBounds: IRBounds = {
    x: bounds.x + axisMarginLeft,
    y: bounds.y,
    w: bounds.w - axisMarginLeft,
    h: bounds.h - axisMarginBottom,
  };

  // Y axis
  children.push({
    id: `${id}-y-axis`,
    type: 'line',
    bounds: { x: plotBounds.x, y: plotBounds.y, w: 0, h: plotBounds.h },
    style: { stroke: sceneTheme.colors.textMuted, strokeWidth: 0.2 },
    from: { x: plotBounds.x, y: plotBounds.y },
    to: { x: plotBounds.x, y: plotBounds.y + plotBounds.h },
  });

  // X axis
  children.push({
    id: `${id}-x-axis`,
    type: 'line',
    bounds: { x: plotBounds.x, y: plotBounds.y + plotBounds.h, w: plotBounds.w, h: 0 },
    style: { stroke: sceneTheme.colors.textMuted, strokeWidth: 0.2 },
    from: { x: plotBounds.x, y: plotBounds.y + plotBounds.h },
    to: { x: plotBounds.x + plotBounds.w, y: plotBounds.y + plotBounds.h },
  });

  // Bars and labels
  const barGap = plotBounds.w * 0.05;
  const totalGap = barGap * Math.max(values.length - 1, 0);
  const barW = (plotBounds.w - totalGap) / values.length;

  let curX = plotBounds.x;
  for (let i = 0; i < values.length; i++) {
    const barH = (values[i] / maxVal) * plotBounds.h;
    const barBounds: IRBounds = {
      x: curX,
      y: plotBounds.y + plotBounds.h - barH,
      w: barW,
      h: barH,
    };

    // Bar
    children.push({
      id: `${id}-bar-${i}`,
      type: 'shape',
      bounds: barBounds,
      style: { fill: sceneTheme.colors.accent },
      shape: 'rect',
    });

    // X label
    children.push({
      id: `${id}-xlabel-${i}`,
      type: 'text',
      bounds: {
        x: curX,
        y: plotBounds.y + plotBounds.h + axisMarginBottom * 0.1,
        w: barW,
        h: axisMarginBottom * 0.7,
      },
      style: {},
      content: categories[i],
      fontSize: baseFontSize * sceneTheme.typography.bodySize * 0.7,
      color: sceneTheme.colors.textMuted,
      align: 'center',
      valign: 'top',
    } as IRText);

    curX += barW + barGap;
  }

  // Y labels (max and 0)
  children.push({
    id: `${id}-ylabel-max`,
    type: 'text',
    bounds: { x: bounds.x, y: plotBounds.y, w: axisMarginLeft * 0.9, h: plotBounds.h * 0.1 },
    style: {},
    content: String(maxVal),
    fontSize: baseFontSize * sceneTheme.typography.bodySize * 0.65,
    color: sceneTheme.colors.textMuted,
    align: 'right',
    valign: 'top',
  } as IRText);

  children.push({
    id: `${id}-ylabel-zero`,
    type: 'text',
    bounds: { x: bounds.x, y: plotBounds.y + plotBounds.h * 0.9, w: axisMarginLeft * 0.9, h: plotBounds.h * 0.1 },
    style: {},
    content: '0',
    fontSize: baseFontSize * sceneTheme.typography.bodySize * 0.65,
    color: sceneTheme.colors.textMuted,
    align: 'right',
    valign: 'bottom',
  } as IRText);

  return { id, type: 'container', bounds, style: {}, children };
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
      bounds: { x: bounds.x + 2, y: bounds.y + bounds.h * 0.4, w: bounds.w - 4, h: bounds.h * 0.2 },
      style: {},
      content: alt,
      fontSize: baseFontSize * sceneTheme.typography.bodySize * 0.8,
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
      fontSize: baseFontSize * sceneTheme.typography.statSize,
      color: sceneTheme.colors.accent,
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
      fontSize: baseFontSize * sceneTheme.typography.bodySize * 1.1,
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
      bounds: { x: bounds.x + bounds.w * 0.05, y: bounds.y + iconH + gap + labelH + gap * 0.5, w: bounds.w * 0.9, h: descH },
      style: {},
      content: iconDesc,
      fontSize: baseFontSize * sceneTheme.typography.bodySize * 0.85,
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
      style: { fill: sceneTheme.colors.accent },
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
      fontSize: baseFontSize * sceneTheme.typography.bodySize * 1.2,
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
        y: bounds.y + markerH + gap * 2,
        w: bounds.w,
        h: descH,
      },
      style: {},
      content: stepDesc,
      fontSize: baseFontSize * sceneTheme.typography.bodySize,
      color: sceneTheme.colors.text,
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
  };
}

// ---------------------------------------------------------------------------
// Custom scene: delegate to existing pipeline
// ---------------------------------------------------------------------------

function emitCustomScene(
  sceneBlock: ASTBlock,
  index: number,
  theme: DepixTheme,
): IRScene | null {
  // Build a mini-document with just this scene's children as a scene
  const miniDoc: ASTDocument = {
    directives: [],
    scenes: [{
      kind: 'block',
      blockType: 'scene',
      label: sceneBlock.id ?? `custom-scene-${index}`,
      props: {},
      children: sceneBlock.children,
      style: {},
      loc: sceneBlock.loc,
    }],
  };

  const ir = emitIR(miniDoc, theme);
  const scene = ir.scenes[0];
  if (scene) {
    scene.id = sceneBlock.label ?? sceneBlock.id ?? `scene-${index}`;
  }
  return scene ?? null;
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
    background: { type: 'solid', color: sceneTheme.colors.background },
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

function resolveElementStyle(el: ASTElement): IRStyle {
  const style: IRStyle = {};
  if ('background' in el.style) style.fill = String(el.style.background);
  if ('border' in el.style && typeof el.style.border === 'string') style.stroke = el.style.border;
  return style;
}
