/**
 * Scene Layout Algorithms — Slot-based
 *
 * Pure geometry functions for 14 scene layout presets.
 * Each function divides the canvas into named slots and returns
 * a SceneLayoutResult with slot bounds.
 * All coordinates are in the 0-100 relative space.
 */

import type { IRBounds } from '../../ir/types.js';
import type { SceneLayoutConfig, SceneLayoutResult } from './types.js';

// ---------------------------------------------------------------------------
// Layout type
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
  | 'custom';

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export function layoutScene(
  layoutType: SceneLayoutType,
  config: SceneLayoutConfig,
  cellCount: number,
): SceneLayoutResult {
  switch (layoutType) {
    case 'full':           return layoutFull(config);
    case 'center':         return layoutCenter(config);
    case 'split':          return layoutSplit(config);
    case 'rows':           return layoutRows(config);
    case 'sidebar':        return layoutSidebar(config);
    case 'header':         return layoutHeader(config);
    case 'header-split':   return layoutHeaderSplit(config);
    case 'header-rows':    return layoutHeaderRows(config);
    case 'header-sidebar': return layoutHeaderSidebar(config);
    case 'grid':           return layoutGrid(config, cellCount);
    case 'header-grid':    return layoutHeaderGrid(config, cellCount);
    case 'focus':          return layoutFocus(config, cellCount);
    case 'header-focus':   return layoutHeaderFocus(config, cellCount);
    default:               return layoutCustom(config, cellCount);
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

function slotEntry(name: string, bounds: IRBounds): [string, IRBounds[]] {
  return [name, [bounds]];
}

function slotResult(config: SceneLayoutConfig, entries: [string, IRBounds[]][]): SceneLayoutResult {
  return { containerBounds: config.bounds, slotBounds: new Map(entries) };
}

// ---------------------------------------------------------------------------
// 1. full — single body slot
// ---------------------------------------------------------------------------

export function layoutFull(config: SceneLayoutConfig): SceneLayoutResult {
  const area = contentArea(config);
  return slotResult(config, [slotEntry('body', area)]);
}

// ---------------------------------------------------------------------------
// 2. center — centered body slot
// ---------------------------------------------------------------------------

export function layoutCenter(config: SceneLayoutConfig): SceneLayoutResult {
  const area = contentArea(config);
  const mx = area.w * 0.1;
  const my = area.h * 0.15;
  return slotResult(config, [
    slotEntry('body', { x: area.x + mx, y: area.y + my, w: area.w - mx * 2, h: area.h - my * 2 }),
  ]);
}

// ---------------------------------------------------------------------------
// 3. split — left + right (50:50 default, ratio prop)
// ---------------------------------------------------------------------------

export function layoutSplit(config: SceneLayoutConfig): SceneLayoutResult {
  const area = contentArea(config);
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

export function layoutRows(config: SceneLayoutConfig): SceneLayoutResult {
  const area = contentArea(config);
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

export function layoutSidebar(config: SceneLayoutConfig): SceneLayoutResult {
  const area = contentArea(config);
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

export function layoutHeader(config: SceneLayoutConfig): SceneLayoutResult {
  const area = contentArea(config);
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

export function layoutHeaderSplit(config: SceneLayoutConfig): SceneLayoutResult {
  const area = contentArea(config);
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

export function layoutHeaderRows(config: SceneLayoutConfig): SceneLayoutResult {
  const area = contentArea(config);
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

export function layoutHeaderSidebar(config: SceneLayoutConfig): SceneLayoutResult {
  const area = contentArea(config);
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

export function layoutGrid(config: SceneLayoutConfig, cellCount: number): SceneLayoutResult {
  const area = contentArea(config);
  const cells = computeGridCells(area, config.gap, cellCount);
  return slotResult(config, [['cell', cells]]);
}

// ---------------------------------------------------------------------------
// 11. header-grid — header + cell × N
// ---------------------------------------------------------------------------

export function layoutHeaderGrid(config: SceneLayoutConfig, cellCount: number): SceneLayoutResult {
  const area = contentArea(config);
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

export function layoutFocus(config: SceneLayoutConfig, cellCount: number): SceneLayoutResult {
  const area = contentArea(config);
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

export function layoutHeaderFocus(config: SceneLayoutConfig, cellCount: number): SceneLayoutResult {
  const area = contentArea(config);
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

export function layoutCustom(config: SceneLayoutConfig, cellCount: number): SceneLayoutResult {
  const area = contentArea(config);
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
