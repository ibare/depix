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

// ===========================================================================
// V2 Slot-based Scene Layouts
// ===========================================================================

// ---------------------------------------------------------------------------
// V2 Helpers
// ---------------------------------------------------------------------------

function contentAreaV2(config: SceneLayoutConfigV2): IRBounds {
  const p = config.padding;
  return {
    x: config.bounds.x + p,
    y: config.bounds.y + p,
    w: config.bounds.w - p * 2,
    h: config.bounds.h - p * 2,
  };
}

function slotEntry(name: string, bounds: IRBounds): [string, IRBounds[]] {
  return [name, [bounds]];
}

function slotResult(config: SceneLayoutConfigV2, entries: [string, IRBounds[]][]): SceneLayoutResult {
  return { containerBounds: config.bounds, slotBounds: new Map(entries) };
}

// ---------------------------------------------------------------------------
// V2 Dispatcher
// ---------------------------------------------------------------------------

export function layoutSceneV2(
  layoutType: SceneLayoutType,
  config: SceneLayoutConfigV2,
  cellCount: number,
): SceneLayoutResult {
  switch (layoutType) {
    case 'full':           return layoutV2Full(config);
    case 'center':         return layoutV2Center(config);
    case 'split':          return layoutV2Split(config);
    case 'rows':           return layoutV2Rows(config);
    case 'sidebar':        return layoutV2Sidebar(config);
    case 'header':         return layoutV2Header(config);
    case 'header-split':   return layoutV2HeaderSplit(config);
    case 'header-rows':    return layoutV2HeaderRows(config);
    case 'header-sidebar': return layoutV2HeaderSidebar(config);
    case 'grid':           return layoutV2Grid(config, cellCount);
    case 'header-grid':    return layoutV2HeaderGrid(config, cellCount);
    case 'focus':          return layoutV2Focus(config, cellCount);
    case 'header-focus':   return layoutV2HeaderFocus(config, cellCount);
    default:               return layoutV2Custom(config, cellCount);
  }
}

// ---------------------------------------------------------------------------
// 1. full — single body slot
// ---------------------------------------------------------------------------

export function layoutV2Full(config: SceneLayoutConfigV2): SceneLayoutResult {
  const area = contentAreaV2(config);
  return slotResult(config, [slotEntry('body', area)]);
}

// ---------------------------------------------------------------------------
// 2. center — centered body slot
// ---------------------------------------------------------------------------

export function layoutV2Center(config: SceneLayoutConfigV2): SceneLayoutResult {
  const area = contentAreaV2(config);
  const mx = area.w * 0.1;
  const my = area.h * 0.15;
  return slotResult(config, [
    slotEntry('body', { x: area.x + mx, y: area.y + my, w: area.w - mx * 2, h: area.h - my * 2 }),
  ]);
}

// ---------------------------------------------------------------------------
// 3. split — left + right (50:50 default, ratio prop)
// ---------------------------------------------------------------------------

export function layoutV2Split(config: SceneLayoutConfigV2): SceneLayoutResult {
  const area = contentAreaV2(config);
  const gap = config.gap;
  const ratio = (config.ratio ?? 50) / 100;
  const leftW = (area.w - gap) * ratio;
  const rightW = area.w - gap - leftW;
  return slotResult(config, [
    slotEntry('left',  { x: area.x, y: area.y, w: leftW, h: area.h }),
    slotEntry('right', { x: area.x + leftW + gap, y: area.y, w: rightW, h: area.h }),
  ]);
}

// ---------------------------------------------------------------------------
// 4. rows — top + bottom (50:50 default, ratio prop)
// ---------------------------------------------------------------------------

export function layoutV2Rows(config: SceneLayoutConfigV2): SceneLayoutResult {
  const area = contentAreaV2(config);
  const gap = config.gap;
  const ratio = (config.ratio ?? 50) / 100;
  const topH = (area.h - gap) * ratio;
  const bottomH = area.h - gap - topH;
  return slotResult(config, [
    slotEntry('top',    { x: area.x, y: area.y, w: area.w, h: topH }),
    slotEntry('bottom', { x: area.x, y: area.y + topH + gap, w: area.w, h: bottomH }),
  ]);
}

// ---------------------------------------------------------------------------
// 5. sidebar — main + side (70:30 default, ratio/direction props)
// ---------------------------------------------------------------------------

export function layoutV2Sidebar(config: SceneLayoutConfigV2): SceneLayoutResult {
  const area = contentAreaV2(config);
  const gap = config.gap;
  const mainRatio = (config.ratio ?? 70) / 100;
  const mainW = (area.w - gap) * mainRatio;
  const sideW = area.w - gap - mainW;
  const leftIsMain = config.direction !== 'left';

  const mainBounds: IRBounds = {
    x: leftIsMain ? area.x : area.x + sideW + gap,
    y: area.y, w: mainW, h: area.h,
  };
  const sideBounds: IRBounds = {
    x: leftIsMain ? area.x + mainW + gap : area.x,
    y: area.y, w: sideW, h: area.h,
  };
  return slotResult(config, [slotEntry('main', mainBounds), slotEntry('side', sideBounds)]);
}

// ---------------------------------------------------------------------------
// 6. header — header + body
// ---------------------------------------------------------------------------

export function layoutV2Header(config: SceneLayoutConfigV2): SceneLayoutResult {
  const area = contentAreaV2(config);
  const gap = config.gap;
  const headH = area.h * (config.headerHeight / 100);
  const bodyY = area.y + headH + gap;
  const bodyH = area.y + area.h - bodyY;
  return slotResult(config, [
    slotEntry('header', { x: area.x, y: area.y, w: area.w, h: headH }),
    slotEntry('body',   { x: area.x, y: bodyY, w: area.w, h: bodyH }),
  ]);
}

// ---------------------------------------------------------------------------
// 7. header-split — header + left + right
// ---------------------------------------------------------------------------

export function layoutV2HeaderSplit(config: SceneLayoutConfigV2): SceneLayoutResult {
  const area = contentAreaV2(config);
  const gap = config.gap;
  const headH = area.h * (config.headerHeight / 100);
  const bodyY = area.y + headH + gap;
  const bodyH = area.y + area.h - bodyY;
  const ratio = (config.ratio ?? 50) / 100;
  const leftW = (area.w - gap) * ratio;
  const rightW = area.w - gap - leftW;
  return slotResult(config, [
    slotEntry('header', { x: area.x, y: area.y, w: area.w, h: headH }),
    slotEntry('left',   { x: area.x, y: bodyY, w: leftW, h: bodyH }),
    slotEntry('right',  { x: area.x + leftW + gap, y: bodyY, w: rightW, h: bodyH }),
  ]);
}

// ---------------------------------------------------------------------------
// 8. header-rows — header + top + bottom
// ---------------------------------------------------------------------------

export function layoutV2HeaderRows(config: SceneLayoutConfigV2): SceneLayoutResult {
  const area = contentAreaV2(config);
  const gap = config.gap;
  const headH = area.h * (config.headerHeight / 100);
  const bodyY = area.y + headH + gap;
  const bodyH = area.y + area.h - bodyY;
  const ratio = (config.ratio ?? 50) / 100;
  const topH = (bodyH - gap) * ratio;
  const bottomH = bodyH - gap - topH;
  return slotResult(config, [
    slotEntry('header', { x: area.x, y: area.y, w: area.w, h: headH }),
    slotEntry('top',    { x: area.x, y: bodyY, w: area.w, h: topH }),
    slotEntry('bottom', { x: area.x, y: bodyY + topH + gap, w: area.w, h: bottomH }),
  ]);
}

// ---------------------------------------------------------------------------
// 9. header-sidebar — header + main + side
// ---------------------------------------------------------------------------

export function layoutV2HeaderSidebar(config: SceneLayoutConfigV2): SceneLayoutResult {
  const area = contentAreaV2(config);
  const gap = config.gap;
  const headH = area.h * (config.headerHeight / 100);
  const bodyY = area.y + headH + gap;
  const bodyH = area.y + area.h - bodyY;
  const mainRatio = (config.ratio ?? 70) / 100;
  const mainW = (area.w - gap) * mainRatio;
  const sideW = area.w - gap - mainW;
  const leftIsMain = config.direction !== 'left';

  return slotResult(config, [
    slotEntry('header', { x: area.x, y: area.y, w: area.w, h: headH }),
    slotEntry('main', {
      x: leftIsMain ? area.x : area.x + sideW + gap,
      y: bodyY, w: mainW, h: bodyH,
    }),
    slotEntry('side', {
      x: leftIsMain ? area.x + mainW + gap : area.x,
      y: bodyY, w: sideW, h: bodyH,
    }),
  ]);
}

// ---------------------------------------------------------------------------
// Grid cell computation (shared)
// ---------------------------------------------------------------------------

function computeGridCells(area: IRBounds, gap: number, cellCount: number): IRBounds[] {
  if (cellCount <= 0) return [];
  const cols = cellCount <= 3 ? cellCount : Math.ceil(Math.sqrt(cellCount));
  const rows = Math.ceil(cellCount / cols);
  const cellW = (area.w - gap * Math.max(cols - 1, 0)) / cols;
  const cellH = (area.h - gap * Math.max(rows - 1, 0)) / rows;
  const cells: IRBounds[] = [];
  for (let i = 0; i < cellCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    cells.push({
      x: area.x + col * (cellW + gap),
      y: area.y + row * (cellH + gap),
      w: cellW, h: cellH,
    });
  }
  return cells;
}

// ---------------------------------------------------------------------------
// 10. grid — cell × N
// ---------------------------------------------------------------------------

export function layoutV2Grid(config: SceneLayoutConfigV2, cellCount: number): SceneLayoutResult {
  const area = contentAreaV2(config);
  const cells = computeGridCells(area, config.gap, cellCount);
  return slotResult(config, [['cell', cells]]);
}

// ---------------------------------------------------------------------------
// 11. header-grid — header + cell × N
// ---------------------------------------------------------------------------

export function layoutV2HeaderGrid(config: SceneLayoutConfigV2, cellCount: number): SceneLayoutResult {
  const area = contentAreaV2(config);
  const gap = config.gap;
  const headH = area.h * (config.headerHeight / 100);
  const gridY = area.y + headH + gap;
  const gridH = area.y + area.h - gridY;
  const gridArea: IRBounds = { x: area.x, y: gridY, w: area.w, h: gridH };
  const cells = computeGridCells(gridArea, gap, cellCount);
  return slotResult(config, [
    slotEntry('header', { x: area.x, y: area.y, w: area.w, h: headH }),
    ['cell', cells],
  ]);
}

// ---------------------------------------------------------------------------
// 12. focus — focus + cell × N
// ---------------------------------------------------------------------------

export function layoutV2Focus(config: SceneLayoutConfigV2, cellCount: number): SceneLayoutResult {
  const area = contentAreaV2(config);
  const gap = config.gap;
  const focusRatio = 0.65;
  const focusH = (area.h - gap) * focusRatio;
  const cellAreaH = area.h - gap - focusH;
  const cellArea: IRBounds = { x: area.x, y: area.y + focusH + gap, w: area.w, h: cellAreaH };
  const cells = computeGridCells(cellArea, gap, Math.max(cellCount, 0));
  return slotResult(config, [
    slotEntry('focus', { x: area.x, y: area.y, w: area.w, h: focusH }),
    ['cell', cells],
  ]);
}

// ---------------------------------------------------------------------------
// 13. header-focus — header + focus + cell × N
// ---------------------------------------------------------------------------

export function layoutV2HeaderFocus(config: SceneLayoutConfigV2, cellCount: number): SceneLayoutResult {
  const area = contentAreaV2(config);
  const gap = config.gap;
  const headH = area.h * (config.headerHeight / 100);
  const bodyY = area.y + headH + gap;
  const bodyH = area.y + area.h - bodyY;
  const focusRatio = 0.65;
  const focusH = (bodyH - gap) * focusRatio;
  const cellAreaH = bodyH - gap - focusH;
  const cellArea: IRBounds = { x: area.x, y: bodyY + focusH + gap, w: area.w, h: cellAreaH };
  const cells = computeGridCells(cellArea, gap, Math.max(cellCount, 0));
  return slotResult(config, [
    slotEntry('header', { x: area.x, y: area.y, w: area.w, h: headH }),
    slotEntry('focus',  { x: area.x, y: bodyY, w: area.w, h: focusH }),
    ['cell', cells],
  ]);
}

// ---------------------------------------------------------------------------
// 14. custom — vertical stack fallback
// ---------------------------------------------------------------------------

export function layoutV2Custom(config: SceneLayoutConfigV2, cellCount: number): SceneLayoutResult {
  const area = contentAreaV2(config);
  const count = Math.max(cellCount, 1);
  const gap = config.gap;
  const cellH = (area.h - gap * Math.max(count - 1, 0)) / count;
  const cells: IRBounds[] = [];
  let curY = area.y;
  for (let i = 0; i < count; i++) {
    cells.push({ x: area.x, y: curY, w: area.w, h: Math.max(cellH, 2) });
    curY += cellH + gap;
  }
  return slotResult(config, [['cell', cells]]);
}
