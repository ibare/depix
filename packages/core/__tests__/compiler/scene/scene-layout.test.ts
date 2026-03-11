/**
 * Scene Layout Tests — Slot-based
 *
 * Unit tests for all 14 scene layout presets.
 */

import { describe, it, expect } from 'vitest';
import type { IRBounds } from '../../../src/ir/types.js';
import type { SceneLayoutConfig, SceneLayoutResult } from '../../../src/compiler/layout/types.js';
import {
  layoutScene,
  layoutFull,
  layoutCenter,
  layoutSplit,
  layoutRows,
  layoutSidebar,
  layoutHeader,
  layoutHeaderSplit,
  layoutHeaderRows,
  layoutHeaderSidebar,
  layoutGrid,
  layoutHeaderGrid,
  layoutFocus,
  layoutHeaderFocus,
  layoutCustom,
} from '../../../src/compiler/layout/scene-layout.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CANVAS: IRBounds = { x: 0, y: 0, w: 100, h: 100 };

function defaultConfig(overrides?: Partial<SceneLayoutConfig>): SceneLayoutConfig {
  return {
    bounds: CANVAS,
    padding: 8,
    headerHeight: 18,
    gap: 4,
    ...overrides,
  };
}

function getSlot(result: SceneLayoutResult, name: string, index = 0): IRBounds {
  const slots = result.slotBounds.get(name);
  if (!slots || index >= slots.length) throw new Error(`Slot '${name}[${index}]' not found`);
  return slots[index];
}

function boundsWithin(inner: IRBounds, outer: IRBounds): void {
  expect(inner.x).toBeGreaterThanOrEqual(outer.x - 0.01);
  expect(inner.y).toBeGreaterThanOrEqual(outer.y - 0.01);
  expect(inner.x + inner.w).toBeLessThanOrEqual(outer.x + outer.w + 0.01);
  expect(inner.y + inner.h).toBeLessThanOrEqual(outer.y + outer.h + 0.01);
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

describe('layoutScene dispatcher', () => {
  it('dispatches all 14 layout types without error', () => {
    const types = [
      'full', 'center', 'split', 'rows', 'sidebar',
      'header', 'header-split', 'header-rows', 'header-sidebar',
      'grid', 'header-grid', 'focus', 'header-focus', 'custom',
    ] as const;
    for (const t of types) {
      const r = layoutScene(t, defaultConfig(), 3);
      expect(r.slotBounds.size).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Individual layout tests
// ---------------------------------------------------------------------------

describe('full', () => {
  it('has body slot filling content area', () => {
    const r = layoutFull(defaultConfig());
    expect(r.slotBounds.has('body')).toBe(true);
    boundsWithin(getSlot(r, 'body'), CANVAS);
  });
});

describe('center', () => {
  it('has body slot smaller than full', () => {
    const full = layoutFull(defaultConfig());
    const center = layoutCenter(defaultConfig());
    expect(getSlot(center, 'body').w).toBeLessThan(getSlot(full, 'body').w);
    expect(getSlot(center, 'body').h).toBeLessThan(getSlot(full, 'body').h);
  });
});

describe('split', () => {
  it('has left and right slots side by side', () => {
    const r = layoutSplit(defaultConfig());
    const left = getSlot(r, 'left');
    const right = getSlot(r, 'right');
    expect(left.x).toBeLessThan(right.x);
    expect(left.w + right.w).toBeLessThanOrEqual(CANVAS.w);
  });

  it('respects ratio prop', () => {
    const r = layoutSplit(defaultConfig({ ratio: 70 }));
    const left = getSlot(r, 'left');
    const right = getSlot(r, 'right');
    expect(left.w).toBeGreaterThan(right.w);
  });
});

describe('rows', () => {
  it('has top and bottom slots stacked', () => {
    const r = layoutRows(defaultConfig());
    const top = getSlot(r, 'top');
    const bottom = getSlot(r, 'bottom');
    expect(top.y).toBeLessThan(bottom.y);
  });
});

describe('sidebar', () => {
  it('main is wider than side', () => {
    const r = layoutSidebar(defaultConfig());
    expect(getSlot(r, 'main').w).toBeGreaterThan(getSlot(r, 'side').w);
  });

  it('direction:left puts side on left', () => {
    const r = layoutSidebar(defaultConfig({ direction: 'left' }));
    expect(getSlot(r, 'side').x).toBeLessThan(getSlot(r, 'main').x);
  });
});

describe('header', () => {
  it('header above body', () => {
    const r = layoutHeader(defaultConfig());
    expect(getSlot(r, 'header').y).toBeLessThan(getSlot(r, 'body').y);
  });
});

describe('header-split', () => {
  it('header above, left and right below', () => {
    const r = layoutHeaderSplit(defaultConfig());
    const h = getSlot(r, 'header');
    const l = getSlot(r, 'left');
    const ri = getSlot(r, 'right');
    expect(h.y + h.h).toBeLessThanOrEqual(l.y + 0.01);
    expect(l.x).toBeLessThan(ri.x);
  });
});

describe('header-rows', () => {
  it('header above, top above bottom', () => {
    const r = layoutHeaderRows(defaultConfig());
    expect(getSlot(r, 'header').y).toBeLessThan(getSlot(r, 'top').y);
    expect(getSlot(r, 'top').y).toBeLessThan(getSlot(r, 'bottom').y);
  });
});

describe('header-sidebar', () => {
  it('header above, main wider than side', () => {
    const r = layoutHeaderSidebar(defaultConfig());
    expect(getSlot(r, 'header').y).toBeLessThan(getSlot(r, 'main').y);
    expect(getSlot(r, 'main').w).toBeGreaterThan(getSlot(r, 'side').w);
  });
});

describe('grid', () => {
  it('produces N cells', () => {
    const r = layoutGrid(defaultConfig(), 4);
    expect(r.slotBounds.get('cell')).toHaveLength(4);
  });

  it('cells are within canvas', () => {
    const r = layoutGrid(defaultConfig(), 6);
    for (const cell of r.slotBounds.get('cell')!) {
      boundsWithin(cell, CANVAS);
    }
  });

  it('handles 0 cells', () => {
    const r = layoutGrid(defaultConfig(), 0);
    expect(r.slotBounds.get('cell')).toHaveLength(0);
  });
});

describe('header-grid', () => {
  it('has header + N cells', () => {
    const r = layoutHeaderGrid(defaultConfig(), 3);
    expect(r.slotBounds.has('header')).toBe(true);
    expect(r.slotBounds.get('cell')).toHaveLength(3);
    expect(getSlot(r, 'header').y).toBeLessThan(r.slotBounds.get('cell')![0].y);
  });
});

describe('focus', () => {
  it('focus is larger than cells', () => {
    const r = layoutFocus(defaultConfig(), 3);
    const focus = getSlot(r, 'focus');
    const cell = r.slotBounds.get('cell')![0];
    expect(focus.h).toBeGreaterThan(cell.h);
  });
});

describe('header-focus', () => {
  it('has header + focus + cells in order', () => {
    const r = layoutHeaderFocus(defaultConfig(), 2);
    const header = getSlot(r, 'header');
    const focus = getSlot(r, 'focus');
    const cells = r.slotBounds.get('cell')!;
    expect(header.y).toBeLessThan(focus.y);
    expect(focus.y).toBeLessThan(cells[0].y);
    expect(cells).toHaveLength(2);
  });
});

describe('custom', () => {
  it('stacks cells vertically', () => {
    const r = layoutCustom(defaultConfig(), 3);
    const cells = r.slotBounds.get('cell')!;
    expect(cells).toHaveLength(3);
    expect(cells[0].y).toBeLessThan(cells[1].y);
    expect(cells[1].y).toBeLessThan(cells[2].y);
  });
});
