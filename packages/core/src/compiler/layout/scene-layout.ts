/**
 * Scene Layout Algorithms
 *
 * Pure geometry functions for 8 scene layout types.
 * Each function takes SceneLayoutChild[] + SceneLayoutConfig and returns LayoutResult.
 * All coordinates are in the 0-100 relative space.
 */

import type { IRBounds } from '../../ir/types.js';
import type { LayoutResult, SceneLayoutChild, SceneLayoutConfig, SceneLayoutConfigV2, SceneLayoutResult } from './types.js';

// ---------------------------------------------------------------------------
// Layout type (v1 — deprecated, kept for transition)
// ---------------------------------------------------------------------------

export type SceneLayoutType =
  | 'full'
  | 'center'
  | 'split'
  | 'rows'
  | 'sidebar'
  | 'header'
  | 'header-split'
  | 'header-rows'
  | 'header-sidebar'
  | 'grid'
  | 'header-grid'
  | 'focus'
  | 'header-focus'
  | 'custom'
  // v1 legacy (will be removed after migration)
  | 'title'
  | 'statement'
  | 'bullets'
  | 'two-column'
  | 'three-column'
  | 'big-number'
  | 'quote'
  | 'image-text'
  | 'icon-grid'
  | 'timeline';

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Dispatch to the appropriate scene layout function.
 */
export function layoutScene(
  layoutType: SceneLayoutType,
  children: SceneLayoutChild[],
  config: SceneLayoutConfig,
): LayoutResult {
  switch (layoutType) {
    case 'title': return layoutSceneTitle(children, config);
    case 'statement': return layoutSceneStatement(children, config);
    case 'bullets': return layoutSceneBullets(children, config);
    case 'two-column': return layoutSceneTwoColumn(children, config);
    case 'three-column': return layoutSceneThreeColumn(children, config);
    case 'big-number': return layoutSceneBigNumber(children, config);
    case 'quote': return layoutSceneQuote(children, config);
    case 'image-text': return layoutSceneImageText(children, config);
    case 'icon-grid': return layoutSceneIconGrid(children, config);
    case 'timeline': return layoutSceneTimeline(children, config);
    case 'custom': return layoutSceneCustom(children, config);
    // v2 layout types — fall back to custom until v2 pipeline is wired
    default: return layoutSceneCustom(children, config);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function contentArea(config: SceneLayoutConfig): IRBounds {
  const p = config.padding;
  return {
    x: config.bounds.x + p,
    y: config.bounds.y + p,
    w: config.bounds.w - p * 2,
    h: config.bounds.h - p * 2,
  };
}

function findByType(children: SceneLayoutChild[], type: string): number[] {
  return children.reduce<number[]>((acc, c, i) => {
    if (c.contentType === type) acc.push(i);
    return acc;
  }, []);
}

// ---------------------------------------------------------------------------
// 1. Title layout
// ---------------------------------------------------------------------------

/**
 * Title scene: centered heading with optional labels below.
 * Top 30% margin, heading centered, labels below heading, bottom 20% margin.
 */
export function layoutSceneTitle(
  children: SceneLayoutChild[],
  config: SceneLayoutConfig,
): LayoutResult {
  const area = contentArea(config);
  const childBounds: IRBounds[] = new Array(children.length);

  const headingIdx = findByType(children, 'heading');
  const labelIdx = findByType(children, 'label');

  // Heading: vertically centered in top 60%
  const headingY = area.y + area.h * 0.30;
  const headingH = area.h * 0.15;

  for (const i of headingIdx) {
    childBounds[i] = { x: area.x, y: headingY, w: area.w, h: headingH };
  }

  // Labels: below heading
  let labelY = headingY + headingH + area.h * 0.04;
  const labelH = area.h * 0.08;
  for (const i of labelIdx) {
    childBounds[i] = { x: area.x + area.w * 0.15, y: labelY, w: area.w * 0.7, h: labelH };
    labelY += labelH + config.itemGap;
  }

  // Fill any unassigned children (e.g. diagram blocks) with remaining space
  let unassignedCount = 0;
  for (let i = 0; i < children.length; i++) { if (!childBounds[i]) unassignedCount++; }
  const remainingH = Math.max((area.y + area.h) - labelY, 0);
  const perItemH = unassignedCount > 0
    ? Math.max((remainingH - config.itemGap * (unassignedCount - 1)) / unassignedCount, labelH)
    : labelH;
  for (let i = 0; i < children.length; i++) {
    if (!childBounds[i]) {
      childBounds[i] = { x: area.x, y: labelY, w: area.w, h: perItemH };
      labelY += perItemH + config.itemGap;
    }
  }

  return { containerBounds: config.bounds, childBounds };
}

// ---------------------------------------------------------------------------
// 2. Statement layout
// ---------------------------------------------------------------------------

/**
 * Statement scene: vertically centered heading + optional label.
 */
export function layoutSceneStatement(
  children: SceneLayoutChild[],
  config: SceneLayoutConfig,
): LayoutResult {
  const area = contentArea(config);
  const childBounds: IRBounds[] = new Array(children.length);

  const headingIdx = findByType(children, 'heading');
  const labelIdx = findByType(children, 'label');

  const totalContent = headingIdx.length + labelIdx.length;
  const headingH = area.h * 0.18;
  const labelH = area.h * 0.08;
  const gap = area.h * 0.03;
  const totalH = headingH + (labelIdx.length > 0 ? gap + labelH : 0);
  const startY = area.y + (area.h - totalH) / 2;

  let curY = startY;
  for (const i of headingIdx) {
    childBounds[i] = { x: area.x + area.w * 0.1, y: curY, w: area.w * 0.8, h: headingH };
    curY += headingH + gap;
  }
  for (const i of labelIdx) {
    childBounds[i] = { x: area.x + area.w * 0.15, y: curY, w: area.w * 0.7, h: labelH };
    curY += labelH + gap;
  }

  // Fill any unassigned children (e.g. diagram blocks) with remaining space
  let unassignedCount = 0;
  for (let i = 0; i < children.length; i++) { if (!childBounds[i]) unassignedCount++; }
  const remainingH = Math.max((area.y + area.h) - curY, 0);
  const perItemH = unassignedCount > 0
    ? Math.max((remainingH - gap * (unassignedCount - 1)) / unassignedCount, labelH)
    : labelH;
  for (let i = 0; i < children.length; i++) {
    if (!childBounds[i]) {
      childBounds[i] = { x: area.x, y: curY, w: area.w, h: perItemH };
      curY += perItemH + gap;
    }
  }

  return { containerBounds: config.bounds, childBounds };
}

// ---------------------------------------------------------------------------
// 3. Bullets layout
// ---------------------------------------------------------------------------

/**
 * Bullets scene: heading at top, bullet items fill remaining space.
 */
export function layoutSceneBullets(
  children: SceneLayoutChild[],
  config: SceneLayoutConfig,
): LayoutResult {
  const area = contentArea(config);
  const childBounds: IRBounds[] = new Array(children.length);

  const headingIdx = findByType(children, 'heading');
  const bulletIdx = findByType(children, 'bullet');
  const labelIdx = findByType(children, 'label');

  // Heading area
  const headH = area.h * (config.headingHeight / 100);
  let curY = area.y;

  for (const i of headingIdx) {
    childBounds[i] = { x: area.x, y: curY, w: area.w, h: headH };
    curY += headH + config.itemGap;
  }

  // Optional label under heading
  const subLabelH = area.h * 0.06;
  for (const i of labelIdx) {
    childBounds[i] = { x: area.x, y: curY, w: area.w, h: subLabelH };
    curY += subLabelH + config.itemGap;
  }

  // Content area: bullets, tables, charts, and diagrams share remaining space
  const tableIdx = findByType(children, 'table');
  const chartIdx = findByType(children, 'chart');
  const diagramIdx = findByType(children, 'diagram');
  const contentIdx = [...bulletIdx, ...tableIdx, ...chartIdx, ...diagramIdx];
  const contentAreaH = area.y + area.h - curY;
  const contentCount = Math.max(contentIdx.length, 1);
  const contentItemH = (contentAreaH - config.itemGap * Math.max(contentCount - 1, 0)) / contentCount;

  for (const i of contentIdx) {
    childBounds[i] = { x: area.x, y: curY, w: area.w, h: Math.max(contentItemH, 5) };
    curY += contentItemH + config.itemGap;
  }

  for (let i = 0; i < children.length; i++) {
    if (!childBounds[i]) {
      childBounds[i] = { x: area.x, y: curY, w: area.w, h: 5 };
      curY += 5 + config.itemGap;
    }
  }

  return { containerBounds: config.bounds, childBounds };
}

// ---------------------------------------------------------------------------
// 4. Two-column layout
// ---------------------------------------------------------------------------

/**
 * Two-column scene: heading at top, two equal columns below.
 */
export function layoutSceneTwoColumn(
  children: SceneLayoutChild[],
  config: SceneLayoutConfig,
): LayoutResult {
  return layoutSceneColumns(children, config, 2);
}

// ---------------------------------------------------------------------------
// 5. Three-column layout
// ---------------------------------------------------------------------------

/**
 * Three-column scene: heading at top, three equal columns below.
 */
export function layoutSceneThreeColumn(
  children: SceneLayoutChild[],
  config: SceneLayoutConfig,
): LayoutResult {
  return layoutSceneColumns(children, config, 3);
}

// ---------------------------------------------------------------------------
// Column layout shared implementation
// ---------------------------------------------------------------------------

function layoutSceneColumns(
  children: SceneLayoutChild[],
  config: SceneLayoutConfig,
  colCount: number,
): LayoutResult {
  const area = contentArea(config);
  const childBounds: IRBounds[] = new Array(children.length);

  const headingIdx = findByType(children, 'heading');
  const diagramIdx = findByType(children, 'diagram');
  const columnIdx = [...findByType(children, 'column'), ...diagramIdx];

  // Heading area
  const headH = area.h * (config.headingHeight / 100);
  let curY = area.y;

  for (const i of headingIdx) {
    childBounds[i] = { x: area.x, y: curY, w: area.w, h: headH };
    curY += headH + config.columnGap;
  }

  // Column area
  const colAreaH = area.y + area.h - curY;
  const totalGap = config.columnGap * (colCount - 1);
  const colW = (area.w - totalGap) / colCount;

  const actualColumns = columnIdx.length > 0 ? columnIdx : [];
  for (let c = 0; c < Math.min(actualColumns.length, colCount); c++) {
    const i = actualColumns[c];
    childBounds[i] = {
      x: area.x + c * (colW + config.columnGap),
      y: curY,
      w: colW,
      h: colAreaH,
    };
  }

  // Fill unassigned children into remaining column slots
  let nextCol = actualColumns.length;
  for (let i = 0; i < children.length; i++) {
    if (!childBounds[i]) {
      if (nextCol < colCount) {
        childBounds[i] = {
          x: area.x + nextCol * (colW + config.columnGap),
          y: curY,
          w: colW,
          h: colAreaH,
        };
        nextCol++;
      } else {
        childBounds[i] = { x: area.x, y: curY + colAreaH + config.itemGap, w: area.w, h: 5 };
      }
    }
  }

  return { containerBounds: config.bounds, childBounds };
}

// ---------------------------------------------------------------------------
// 6. Big-number layout
// ---------------------------------------------------------------------------

/**
 * Big-number scene: heading at top, stat cards in a grid below.
 */
export function layoutSceneBigNumber(
  children: SceneLayoutChild[],
  config: SceneLayoutConfig,
): LayoutResult {
  const area = contentArea(config);
  const childBounds: IRBounds[] = new Array(children.length);

  const headingIdx = findByType(children, 'heading');
  const diagramIdx = findByType(children, 'diagram');
  const statIdx = [...findByType(children, 'stat'), ...diagramIdx];

  // Heading area
  const headH = area.h * (config.headingHeight / 100);
  let curY = area.y;

  for (const i of headingIdx) {
    childBounds[i] = { x: area.x, y: curY, w: area.w, h: headH };
    curY += headH + config.columnGap;
  }

  // Stat grid: distribute stats horizontally, centered vertically
  const statAreaH = area.y + area.h - curY;
  const statCount = statIdx.length || 1;
  const totalGap = config.columnGap * (statCount - 1);
  const statW = (area.w - totalGap) / statCount;
  const statH = Math.min(statAreaH * 0.7, statW * 0.8);
  const statY = curY + (statAreaH - statH) / 2;

  for (let s = 0; s < statIdx.length; s++) {
    const i = statIdx[s];
    childBounds[i] = {
      x: area.x + s * (statW + config.columnGap),
      y: statY,
      w: statW,
      h: statH,
    };
  }

  for (let i = 0; i < children.length; i++) {
    if (!childBounds[i]) {
      childBounds[i] = { x: area.x, y: curY, w: area.w, h: 5 };
    }
  }

  return { containerBounds: config.bounds, childBounds };
}

// ---------------------------------------------------------------------------
// 7. Quote layout
// ---------------------------------------------------------------------------

/**
 * Quote scene: vertically centered quote text + attribution below.
 */
export function layoutSceneQuote(
  children: SceneLayoutChild[],
  config: SceneLayoutConfig,
): LayoutResult {
  const area = contentArea(config);
  const childBounds: IRBounds[] = new Array(children.length);

  const quoteIdx = findByType(children, 'quote');
  const labelIdx = findByType(children, 'label');

  const quoteH = area.h * 0.25;
  const labelH = area.h * 0.08;
  const gap = area.h * 0.04;
  const totalH = quoteH + (labelIdx.length > 0 ? gap + labelH : 0);
  const startY = area.y + (area.h - totalH) / 2;

  let curY = startY;
  for (const i of quoteIdx) {
    childBounds[i] = { x: area.x + area.w * 0.1, y: curY, w: area.w * 0.8, h: quoteH };
    curY += quoteH + gap;
  }
  for (const i of labelIdx) {
    childBounds[i] = { x: area.x + area.w * 0.2, y: curY, w: area.w * 0.6, h: labelH };
    curY += labelH + gap;
  }

  for (let i = 0; i < children.length; i++) {
    if (!childBounds[i]) {
      childBounds[i] = { x: area.x, y: curY, w: area.w, h: 5 };
      curY += 5 + gap;
    }
  }

  return { containerBounds: config.bounds, childBounds };
}

// ---------------------------------------------------------------------------
// 8. Image-text layout
// ---------------------------------------------------------------------------

/**
 * Image-text scene: heading at top, image on left, text content on right.
 */
export function layoutSceneImageText(
  children: SceneLayoutChild[],
  config: SceneLayoutConfig,
): LayoutResult {
  const area = contentArea(config);
  const childBounds: IRBounds[] = new Array(children.length);

  const headingIdx = findByType(children, 'heading');
  const imageIdx = findByType(children, 'image');
  const labelIdx = findByType(children, 'label');
  const bulletIdx = findByType(children, 'bullet');
  const diagramIdx = findByType(children, 'diagram');

  // Heading area
  const headH = area.h * (config.headingHeight / 100);
  let curY = area.y;

  for (const i of headingIdx) {
    childBounds[i] = { x: area.x, y: curY, w: area.w, h: headH };
    curY += headH + config.itemGap;
  }

  // Split remaining space: left = image, right = text
  const contentH = area.y + area.h - curY;
  const gap = config.columnGap;
  const halfW = (area.w - gap) / 2;

  // Image on left
  for (const i of imageIdx) {
    childBounds[i] = { x: area.x, y: curY, w: halfW, h: contentH };
  }

  // Text content on right
  const textX = area.x + halfW + gap;
  const textItems = [...labelIdx, ...bulletIdx, ...diagramIdx];
  const textItemH = textItems.length > 0
    ? (contentH - config.itemGap * (textItems.length - 1)) / textItems.length
    : contentH;

  let textY = curY;
  for (const i of textItems) {
    childBounds[i] = { x: textX, y: textY, w: halfW, h: Math.max(textItemH, 2) };
    textY += textItemH + config.itemGap;
  }

  // Fill unassigned
  for (let i = 0; i < children.length; i++) {
    if (!childBounds[i]) {
      childBounds[i] = { x: area.x, y: curY + contentH, w: area.w, h: 5 };
    }
  }

  return { containerBounds: config.bounds, childBounds };
}

// ---------------------------------------------------------------------------
// 9. Icon-grid layout
// ---------------------------------------------------------------------------

/**
 * Icon-grid scene: heading at top, icons arranged in a responsive grid below.
 * Uses 2 columns for ≤4 icons, 3 columns otherwise.
 */
export function layoutSceneIconGrid(
  children: SceneLayoutChild[],
  config: SceneLayoutConfig,
): LayoutResult {
  const area = contentArea(config);
  const childBounds: IRBounds[] = new Array(children.length);

  const headingIdx = findByType(children, 'heading');
  const diagramIdx = findByType(children, 'diagram');
  const iconIdx = [...findByType(children, 'icon'), ...diagramIdx];

  // Heading area
  const headH = area.h * (config.headingHeight / 100);
  let curY = area.y;

  for (const i of headingIdx) {
    childBounds[i] = { x: area.x, y: curY, w: area.w, h: headH };
    curY += headH + config.columnGap;
  }

  // Grid layout for icons
  const gridH = area.y + area.h - curY;
  const iconCount = iconIdx.length || 1;
  const cols = iconCount <= 4 ? 2 : 3;
  const rows = Math.ceil(iconCount / cols);
  const cellW = (area.w - config.columnGap * (cols - 1)) / cols;
  const cellH = (gridH - config.itemGap * (rows - 1)) / rows;

  for (let idx = 0; idx < iconIdx.length; idx++) {
    const i = iconIdx[idx];
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    childBounds[i] = {
      x: area.x + col * (cellW + config.columnGap),
      y: curY + row * (cellH + config.itemGap),
      w: cellW,
      h: cellH,
    };
  }

  // Fill unassigned
  for (let i = 0; i < children.length; i++) {
    if (!childBounds[i]) {
      childBounds[i] = { x: area.x, y: curY + gridH, w: area.w, h: 5 };
    }
  }

  return { containerBounds: config.bounds, childBounds };
}

// ---------------------------------------------------------------------------
// 10. Timeline layout
// ---------------------------------------------------------------------------

/**
 * Timeline scene: heading at top, steps distributed horizontally.
 */
export function layoutSceneTimeline(
  children: SceneLayoutChild[],
  config: SceneLayoutConfig,
): LayoutResult {
  const area = contentArea(config);
  const childBounds: IRBounds[] = new Array(children.length);

  const headingIdx = findByType(children, 'heading');
  const diagramIdx = findByType(children, 'diagram');
  const stepIdx = [...findByType(children, 'step'), ...diagramIdx];

  // Heading area
  const headH = area.h * (config.headingHeight / 100);
  let curY = area.y;

  for (const i of headingIdx) {
    childBounds[i] = { x: area.x, y: curY, w: area.w, h: headH };
    curY += headH + config.columnGap;
  }

  // Timeline area: steps distributed horizontally
  const timelineH = area.y + area.h - curY;
  const stepCount = stepIdx.length || 1;
  const totalGap = config.columnGap * (stepCount - 1);
  const stepW = (area.w - totalGap) / stepCount;
  // Center vertically in the timeline area
  const stepH = Math.min(timelineH * 0.7, stepW * 1.2);
  const stepY = curY + (timelineH - stepH) / 2;

  for (let s = 0; s < stepIdx.length; s++) {
    const i = stepIdx[s];
    childBounds[i] = {
      x: area.x + s * (stepW + config.columnGap),
      y: stepY,
      w: stepW,
      h: stepH,
    };
  }

  // Fill unassigned
  for (let i = 0; i < children.length; i++) {
    if (!childBounds[i]) {
      childBounds[i] = { x: area.x, y: curY + timelineH, w: area.w, h: 5 };
    }
  }

  return { containerBounds: config.bounds, childBounds };
}

// ---------------------------------------------------------------------------
// 11. Custom layout (passthrough)
// ---------------------------------------------------------------------------

/**
 * Custom layout: evenly distribute children vertically.
 * Actual layout is delegated to the existing pipeline by the compiler.
 */
export function layoutSceneCustom(
  children: SceneLayoutChild[],
  config: SceneLayoutConfig,
): LayoutResult {
  const area = contentArea(config);
  const childH = children.length > 0
    ? (area.h - config.itemGap * (children.length - 1)) / children.length
    : area.h;
  let curY = area.y;

  const childBounds: IRBounds[] = children.map(() => {
    const b: IRBounds = { x: area.x, y: curY, w: area.w, h: Math.max(childH, 2) };
    curY += childH + config.itemGap;
    return b;
  });

  return { containerBounds: config.bounds, childBounds };
}
