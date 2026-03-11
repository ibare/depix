/**
 * Scene Layout Tests
 *
 * Unit tests for each of the 8 scene layout functions.
 */

import { describe, it, expect } from 'vitest';
import type { IRBounds } from '../../../src/ir/types.js';
import type { SceneLayoutChild, SceneLayoutConfig } from '../../../src/compiler/layout/types.js';
import {
  layoutScene,
  layoutSceneTitle,
  layoutSceneStatement,
  layoutSceneBullets,
  layoutSceneTwoColumn,
  layoutSceneThreeColumn,
  layoutSceneBigNumber,
  layoutSceneQuote,
  layoutSceneImageText,
  layoutSceneIconGrid,
  layoutSceneTimeline,
  layoutSceneCustom,
} from '../../../src/compiler/layout/scene-layout.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CANVAS: IRBounds = { x: 0, y: 0, w: 100, h: 100 };

function defaultConfig(bounds = CANVAS): SceneLayoutConfig {
  return {
    bounds,
    padding: 8,
    headingHeight: 18,
    columnGap: 4,
    itemGap: 2,
  };
}

function child(contentType: SceneLayoutChild['contentType'], id = `c-${contentType}`): SceneLayoutChild {
  return { id, width: 0, height: 0, contentType };
}

function boundsWithin(b: IRBounds, container: IRBounds): boolean {
  return (
    b.x >= container.x - 0.01 &&
    b.y >= container.y - 0.01 &&
    b.x + b.w <= container.x + container.w + 0.01 &&
    b.y + b.h <= container.y + container.h + 0.01
  );
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

describe('layoutScene dispatcher', () => {
  it('dispatches title layout', () => {
    const result = layoutScene('title', [child('heading')], defaultConfig());
    expect(result.childBounds).toHaveLength(1);
  });

  it('dispatches all 11 layout types without error', () => {
    const types = ['title', 'statement', 'bullets', 'two-column', 'three-column', 'big-number', 'quote', 'image-text', 'icon-grid', 'timeline', 'custom'] as const;
    for (const type of types) {
      const result = layoutScene(type, [child('heading')], defaultConfig());
      expect(result.childBounds).toHaveLength(1);
      expect(result.containerBounds).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Title layout
// ---------------------------------------------------------------------------

describe('layoutSceneTitle', () => {
  it('positions heading in vertical center region', () => {
    const result = layoutSceneTitle(
      [child('heading'), child('label')],
      defaultConfig(),
    );
    expect(result.childBounds).toHaveLength(2);
    // Heading should be in upper-middle area
    expect(result.childBounds[0].y).toBeGreaterThan(20);
    expect(result.childBounds[0].y).toBeLessThan(50);
  });

  it('positions labels below heading', () => {
    const result = layoutSceneTitle(
      [child('heading'), child('label', 'l1'), child('label', 'l2')],
      defaultConfig(),
    );
    expect(result.childBounds[1].y).toBeGreaterThan(result.childBounds[0].y);
    expect(result.childBounds[2].y).toBeGreaterThan(result.childBounds[1].y);
  });

  it('all bounds are within canvas', () => {
    const result = layoutSceneTitle(
      [child('heading'), child('label')],
      defaultConfig(),
    );
    for (const b of result.childBounds) {
      expect(boundsWithin(b, CANVAS)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Statement layout
// ---------------------------------------------------------------------------

describe('layoutSceneStatement', () => {
  it('vertically centers heading', () => {
    const result = layoutSceneStatement([child('heading')], defaultConfig());
    const b = result.childBounds[0];
    const centerY = b.y + b.h / 2;
    expect(centerY).toBeGreaterThan(30);
    expect(centerY).toBeLessThan(70);
  });

  it('label follows heading', () => {
    const result = layoutSceneStatement(
      [child('heading'), child('label')],
      defaultConfig(),
    );
    expect(result.childBounds[1].y).toBeGreaterThan(result.childBounds[0].y);
  });
});

// ---------------------------------------------------------------------------
// Bullets layout
// ---------------------------------------------------------------------------

describe('layoutSceneBullets', () => {
  it('heading at top, bullet below', () => {
    const result = layoutSceneBullets(
      [child('heading'), child('bullet')],
      defaultConfig(),
    );
    expect(result.childBounds[0].y).toBeLessThan(result.childBounds[1].y);
  });

  it('bullet area fills remaining space', () => {
    const result = layoutSceneBullets(
      [child('heading'), child('bullet')],
      defaultConfig(),
    );
    const bulletBounds = result.childBounds[1];
    expect(bulletBounds.h).toBeGreaterThan(40);
  });
});

// ---------------------------------------------------------------------------
// Two-column layout
// ---------------------------------------------------------------------------

describe('layoutSceneTwoColumn', () => {
  it('heading at top, two columns side by side', () => {
    const result = layoutSceneTwoColumn(
      [child('heading'), child('column', 'col1'), child('column', 'col2')],
      defaultConfig(),
    );
    expect(result.childBounds).toHaveLength(3);
    // Columns should be side by side
    const col1 = result.childBounds[1];
    const col2 = result.childBounds[2];
    expect(col1.x).toBeLessThan(col2.x);
    expect(col1.y).toBeCloseTo(col2.y, 0);
  });

  it('columns have roughly equal width', () => {
    const result = layoutSceneTwoColumn(
      [child('heading'), child('column', 'c1'), child('column', 'c2')],
      defaultConfig(),
    );
    const c1w = result.childBounds[1].w;
    const c2w = result.childBounds[2].w;
    expect(Math.abs(c1w - c2w)).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// Three-column layout
// ---------------------------------------------------------------------------

describe('layoutSceneThreeColumn', () => {
  it('positions three columns side by side', () => {
    const result = layoutSceneThreeColumn(
      [child('heading'), child('column', 'c1'), child('column', 'c2'), child('column', 'c3')],
      defaultConfig(),
    );
    const c1 = result.childBounds[1];
    const c2 = result.childBounds[2];
    const c3 = result.childBounds[3];
    expect(c1.x).toBeLessThan(c2.x);
    expect(c2.x).toBeLessThan(c3.x);
  });
});

// ---------------------------------------------------------------------------
// Big-number layout
// ---------------------------------------------------------------------------

describe('layoutSceneBigNumber', () => {
  it('heading at top, stats in grid below', () => {
    const result = layoutSceneBigNumber(
      [child('heading'), child('stat', 's1'), child('stat', 's2'), child('stat', 's3')],
      defaultConfig(),
    );
    // Heading above stats
    expect(result.childBounds[0].y).toBeLessThan(result.childBounds[1].y);
    // Stats horizontally distributed
    expect(result.childBounds[1].x).toBeLessThan(result.childBounds[2].x);
    expect(result.childBounds[2].x).toBeLessThan(result.childBounds[3].x);
  });

  it('single stat is centered', () => {
    const result = layoutSceneBigNumber(
      [child('heading'), child('stat')],
      defaultConfig(),
    );
    const stat = result.childBounds[1];
    expect(stat.w).toBeGreaterThan(50);
  });
});

// ---------------------------------------------------------------------------
// Quote layout
// ---------------------------------------------------------------------------

describe('layoutSceneQuote', () => {
  it('vertically centers quote', () => {
    const result = layoutSceneQuote([child('quote')], defaultConfig());
    const b = result.childBounds[0];
    const centerY = b.y + b.h / 2;
    expect(centerY).toBeGreaterThan(30);
    expect(centerY).toBeLessThan(70);
  });

  it('attribution label below quote', () => {
    const result = layoutSceneQuote(
      [child('quote'), child('label')],
      defaultConfig(),
    );
    expect(result.childBounds[1].y).toBeGreaterThan(result.childBounds[0].y);
  });
});

// ---------------------------------------------------------------------------
// Custom layout
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Image-text layout
// ---------------------------------------------------------------------------

describe('layoutSceneImageText', () => {
  it('positions heading at top, image left, text right', () => {
    const result = layoutSceneImageText(
      [child('heading'), child('image'), child('label', 'l1'), child('label', 'l2')],
      defaultConfig(),
    );
    expect(result.childBounds).toHaveLength(4);
    // Heading above image
    expect(result.childBounds[0].y).toBeLessThan(result.childBounds[1].y);
    // Image on left, labels on right
    expect(result.childBounds[1].x).toBeLessThan(result.childBounds[2].x);
  });

  it('image and text areas have roughly equal width', () => {
    const result = layoutSceneImageText(
      [child('heading'), child('image'), child('label')],
      defaultConfig(),
    );
    const imageW = result.childBounds[1].w;
    const textW = result.childBounds[2].w;
    expect(Math.abs(imageW - textW)).toBeLessThan(1);
  });

  it('all bounds within canvas', () => {
    const result = layoutSceneImageText(
      [child('heading'), child('image'), child('label')],
      defaultConfig(),
    );
    for (const b of result.childBounds) {
      expect(boundsWithin(b, CANVAS)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Icon-grid layout
// ---------------------------------------------------------------------------

describe('layoutSceneIconGrid', () => {
  it('positions heading at top, icons in grid below', () => {
    const result = layoutSceneIconGrid(
      [child('heading'), child('icon', 'i1'), child('icon', 'i2'), child('icon', 'i3'), child('icon', 'i4')],
      defaultConfig(),
    );
    expect(result.childBounds).toHaveLength(5);
    // Heading above icons
    expect(result.childBounds[0].y).toBeLessThan(result.childBounds[1].y);
  });

  it('uses 2 columns for ≤4 icons', () => {
    const result = layoutSceneIconGrid(
      [child('heading'), child('icon', 'i1'), child('icon', 'i2'), child('icon', 'i3'), child('icon', 'i4')],
      defaultConfig(),
    );
    // First row: i1, i2; second row: i3, i4
    expect(result.childBounds[1].y).toBeCloseTo(result.childBounds[2].y, 0); // same row
    expect(result.childBounds[1].x).toBeLessThan(result.childBounds[2].x); // side by side
    expect(result.childBounds[3].y).toBeCloseTo(result.childBounds[4].y, 0); // same row
  });

  it('uses 3 columns for >4 icons', () => {
    const icons = Array.from({ length: 6 }, (_, i) => child('icon', `i${i}`));
    const result = layoutSceneIconGrid(
      [child('heading'), ...icons],
      defaultConfig(),
    );
    // First row has 3 icons: i0, i1, i2
    expect(result.childBounds[1].y).toBeCloseTo(result.childBounds[2].y, 0);
    expect(result.childBounds[2].y).toBeCloseTo(result.childBounds[3].y, 0);
    expect(result.childBounds[1].x).toBeLessThan(result.childBounds[2].x);
    expect(result.childBounds[2].x).toBeLessThan(result.childBounds[3].x);
  });
});

// ---------------------------------------------------------------------------
// Timeline layout
// ---------------------------------------------------------------------------

describe('layoutSceneTimeline', () => {
  it('positions heading at top, steps horizontally', () => {
    const result = layoutSceneTimeline(
      [child('heading'), child('step', 's1'), child('step', 's2'), child('step', 's3')],
      defaultConfig(),
    );
    expect(result.childBounds).toHaveLength(4);
    // Heading above steps
    expect(result.childBounds[0].y).toBeLessThan(result.childBounds[1].y);
    // Steps are side by side
    expect(result.childBounds[1].x).toBeLessThan(result.childBounds[2].x);
    expect(result.childBounds[2].x).toBeLessThan(result.childBounds[3].x);
  });

  it('steps are vertically centered in timeline area', () => {
    const result = layoutSceneTimeline(
      [child('heading'), child('step', 's1'), child('step', 's2')],
      defaultConfig(),
    );
    // All steps same y
    expect(result.childBounds[1].y).toBeCloseTo(result.childBounds[2].y, 0);
  });

  it('steps have equal width', () => {
    const result = layoutSceneTimeline(
      [child('heading'), child('step', 's1'), child('step', 's2'), child('step', 's3')],
      defaultConfig(),
    );
    const w1 = result.childBounds[1].w;
    const w2 = result.childBounds[2].w;
    const w3 = result.childBounds[3].w;
    expect(Math.abs(w1 - w2)).toBeLessThan(0.01);
    expect(Math.abs(w2 - w3)).toBeLessThan(0.01);
  });
});

// ---------------------------------------------------------------------------
// Custom layout
// ---------------------------------------------------------------------------

describe('layoutSceneCustom', () => {
  it('evenly distributes children', () => {
    const result = layoutSceneCustom(
      [child('heading'), child('label'), child('label')],
      defaultConfig(),
    );
    expect(result.childBounds).toHaveLength(3);
    expect(result.childBounds[0].y).toBeLessThan(result.childBounds[1].y);
    expect(result.childBounds[1].y).toBeLessThan(result.childBounds[2].y);
  });

  it('handles empty children', () => {
    const result = layoutSceneCustom([], defaultConfig());
    expect(result.childBounds).toHaveLength(0);
  });
});

// ===========================================================================
// V2 Slot-based Layout Tests
// ===========================================================================

import type { SceneLayoutConfigV2, SceneLayoutResult } from '../../../src/compiler/layout/types.js';
import {
  layoutSceneV2,
  layoutV2Full,
  layoutV2Center,
  layoutV2Split,
  layoutV2Rows,
  layoutV2Sidebar,
  layoutV2Header,
  layoutV2HeaderSplit,
  layoutV2HeaderRows,
  layoutV2HeaderSidebar,
  layoutV2Grid,
  layoutV2HeaderGrid,
  layoutV2Focus,
  layoutV2HeaderFocus,
  layoutV2Custom,
} from '../../../src/compiler/layout/scene-layout.js';

const CANVAS_V2: IRBounds = { x: 0, y: 0, w: 100, h: 100 };

function defaultConfigV2(overrides?: Partial<SceneLayoutConfigV2>): SceneLayoutConfigV2 {
  return {
    bounds: CANVAS_V2,
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

function boundsWithinV2(inner: IRBounds, outer: IRBounds): void {
  expect(inner.x).toBeGreaterThanOrEqual(outer.x - 0.01);
  expect(inner.y).toBeGreaterThanOrEqual(outer.y - 0.01);
  expect(inner.x + inner.w).toBeLessThanOrEqual(outer.x + outer.w + 0.01);
  expect(inner.y + inner.h).toBeLessThanOrEqual(outer.y + outer.h + 0.01);
}

describe('V2 Dispatcher', () => {
  it('dispatches all 14 layout types without error', () => {
    const types = [
      'full', 'center', 'split', 'rows', 'sidebar',
      'header', 'header-split', 'header-rows', 'header-sidebar',
      'grid', 'header-grid', 'focus', 'header-focus', 'custom',
    ] as const;
    for (const t of types) {
      const r = layoutSceneV2(t, defaultConfigV2(), 3);
      expect(r.slotBounds.size).toBeGreaterThan(0);
    }
  });
});

describe('V2: full', () => {
  it('has body slot filling content area', () => {
    const r = layoutV2Full(defaultConfigV2());
    expect(r.slotBounds.has('body')).toBe(true);
    boundsWithinV2(getSlot(r, 'body'), CANVAS_V2);
  });
});

describe('V2: center', () => {
  it('has body slot smaller than full', () => {
    const full = layoutV2Full(defaultConfigV2());
    const center = layoutV2Center(defaultConfigV2());
    expect(getSlot(center, 'body').w).toBeLessThan(getSlot(full, 'body').w);
    expect(getSlot(center, 'body').h).toBeLessThan(getSlot(full, 'body').h);
  });
});

describe('V2: split', () => {
  it('has left and right slots side by side', () => {
    const r = layoutV2Split(defaultConfigV2());
    const left = getSlot(r, 'left');
    const right = getSlot(r, 'right');
    expect(left.x).toBeLessThan(right.x);
    expect(left.w + right.w).toBeLessThanOrEqual(CANVAS_V2.w);
  });

  it('respects ratio prop', () => {
    const r = layoutV2Split(defaultConfigV2({ ratio: 70 }));
    const left = getSlot(r, 'left');
    const right = getSlot(r, 'right');
    expect(left.w).toBeGreaterThan(right.w);
  });
});

describe('V2: rows', () => {
  it('has top and bottom slots stacked', () => {
    const r = layoutV2Rows(defaultConfigV2());
    const top = getSlot(r, 'top');
    const bottom = getSlot(r, 'bottom');
    expect(top.y).toBeLessThan(bottom.y);
  });
});

describe('V2: sidebar', () => {
  it('main is wider than side', () => {
    const r = layoutV2Sidebar(defaultConfigV2());
    expect(getSlot(r, 'main').w).toBeGreaterThan(getSlot(r, 'side').w);
  });

  it('direction:left puts side on left', () => {
    const r = layoutV2Sidebar(defaultConfigV2({ direction: 'left' }));
    expect(getSlot(r, 'side').x).toBeLessThan(getSlot(r, 'main').x);
  });
});

describe('V2: header', () => {
  it('header above body', () => {
    const r = layoutV2Header(defaultConfigV2());
    expect(getSlot(r, 'header').y).toBeLessThan(getSlot(r, 'body').y);
  });
});

describe('V2: header-split', () => {
  it('header above, left and right below', () => {
    const r = layoutV2HeaderSplit(defaultConfigV2());
    const h = getSlot(r, 'header');
    const l = getSlot(r, 'left');
    const ri = getSlot(r, 'right');
    expect(h.y + h.h).toBeLessThanOrEqual(l.y + 0.01);
    expect(l.x).toBeLessThan(ri.x);
  });
});

describe('V2: header-rows', () => {
  it('header above, top above bottom', () => {
    const r = layoutV2HeaderRows(defaultConfigV2());
    expect(getSlot(r, 'header').y).toBeLessThan(getSlot(r, 'top').y);
    expect(getSlot(r, 'top').y).toBeLessThan(getSlot(r, 'bottom').y);
  });
});

describe('V2: header-sidebar', () => {
  it('header above, main wider than side', () => {
    const r = layoutV2HeaderSidebar(defaultConfigV2());
    expect(getSlot(r, 'header').y).toBeLessThan(getSlot(r, 'main').y);
    expect(getSlot(r, 'main').w).toBeGreaterThan(getSlot(r, 'side').w);
  });
});

describe('V2: grid', () => {
  it('produces N cells', () => {
    const r = layoutV2Grid(defaultConfigV2(), 4);
    expect(r.slotBounds.get('cell')).toHaveLength(4);
  });

  it('cells are within canvas', () => {
    const r = layoutV2Grid(defaultConfigV2(), 6);
    for (const cell of r.slotBounds.get('cell')!) {
      boundsWithinV2(cell, CANVAS_V2);
    }
  });

  it('handles 0 cells', () => {
    const r = layoutV2Grid(defaultConfigV2(), 0);
    expect(r.slotBounds.get('cell')).toHaveLength(0);
  });
});

describe('V2: header-grid', () => {
  it('has header + N cells', () => {
    const r = layoutV2HeaderGrid(defaultConfigV2(), 3);
    expect(r.slotBounds.has('header')).toBe(true);
    expect(r.slotBounds.get('cell')).toHaveLength(3);
    expect(getSlot(r, 'header').y).toBeLessThan(r.slotBounds.get('cell')![0].y);
  });
});

describe('V2: focus', () => {
  it('focus is larger than cells', () => {
    const r = layoutV2Focus(defaultConfigV2(), 3);
    const focus = getSlot(r, 'focus');
    const cell = r.slotBounds.get('cell')![0];
    expect(focus.h).toBeGreaterThan(cell.h);
  });
});

describe('V2: header-focus', () => {
  it('has header + focus + cells in order', () => {
    const r = layoutV2HeaderFocus(defaultConfigV2(), 2);
    const header = getSlot(r, 'header');
    const focus = getSlot(r, 'focus');
    const cells = r.slotBounds.get('cell')!;
    expect(header.y).toBeLessThan(focus.y);
    expect(focus.y).toBeLessThan(cells[0].y);
    expect(cells).toHaveLength(2);
  });
});

describe('V2: custom', () => {
  it('stacks cells vertically', () => {
    const r = layoutV2Custom(defaultConfigV2(), 3);
    const cells = r.slotBounds.get('cell')!;
    expect(cells).toHaveLength(3);
    expect(cells[0].y).toBeLessThan(cells[1].y);
    expect(cells[1].y).toBeLessThan(cells[2].y);
  });
});
