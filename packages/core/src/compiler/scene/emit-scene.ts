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
    const irScene = emitScene(sceneBlock, plan, sceneIndex, theme, sceneTheme);
    scenes.push(irScene);
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
    // Diagram-like blocks (flow, tree, layers, grid, stack, group, canvas):
    // delegate to the diagram pipeline for layout + rendering within scene bounds
    return emitInlineBlock(node, bounds, theme, new Map());
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
