/**
 * Tests for the Stack Layout Algorithm (layoutStack)
 *
 * Covers:
 *  - Row direction: left-to-right placement
 *  - Column direction: top-to-bottom placement
 *  - Gap: uniform gap between consecutive children
 *  - Cross-axis alignment: start, center, end, stretch
 *  - Wrap: wrapping to the next line when children exceed available bounds
 *  - Edge cases: empty children, single child, equal and mixed sizes
 */

import { describe, it, expect } from 'vitest';
import { layoutStack } from '../../../src/compiler/layout/stack-layout.js';
import type { StackLayoutConfig, LayoutChild } from '../../../src/compiler/layout/types.js';
import {
  assertChildrenWithinParent,
  assertNoOverlap,
  assertOrderedInDirection,
  assertUniformGap,
  assertCrossAlignment,
} from '../../helpers/layout-assertions.js';

// ---------------------------------------------------------------------------
// Shared test data helpers
// ---------------------------------------------------------------------------

/** Shorthand for a StackLayoutConfig with sensible defaults. */
function makeConfig(overrides: Partial<StackLayoutConfig> = {}): StackLayoutConfig {
  return {
    bounds: { x: 0, y: 0, w: 100, h: 100 },
    direction: 'row',
    gap: 0,
    align: 'start',
    wrap: false,
    ...overrides,
  };
}

/** Build a LayoutChild with a given id and size. */
function child(id: string, width: number, height: number): LayoutChild {
  return { id, width, height };
}

// ===========================================================================
// 1. Empty children
// ===========================================================================

describe('layoutStack — empty children', () => {
  it('returns empty childBounds array', () => {
    const result = layoutStack([], makeConfig());
    expect(result.childBounds).toHaveLength(0);
  });

  it('containerBounds mirrors the config bounds exactly', () => {
    const bounds = { x: 10, y: 20, w: 80, h: 60 };
    const result = layoutStack([], makeConfig({ bounds }));
    expect(result.containerBounds).toEqual(bounds);
  });

  it('works for both row and column directions', () => {
    const rowResult = layoutStack([], makeConfig({ direction: 'row' }));
    const colResult = layoutStack([], makeConfig({ direction: 'col' }));
    expect(rowResult.childBounds).toHaveLength(0);
    expect(colResult.childBounds).toHaveLength(0);
  });
});

// ===========================================================================
// 2. Single child
// ===========================================================================

describe('layoutStack — single child', () => {
  it('positions the child at the container origin (row, align=start)', () => {
    const result = layoutStack(
      [child('a', 20, 10)],
      makeConfig({ direction: 'row', align: 'start' }),
    );

    expect(result.childBounds).toHaveLength(1);
    const b = result.childBounds[0]!;
    expect(b.x).toBe(result.containerBounds.x);
    expect(b.y).toBe(result.containerBounds.y);
    expect(b.w).toBe(20); // input size preserved
    expect(b.h).toBe(10); // input size preserved
  });

  it('positions the child at the container origin (col, align=start)', () => {
    const result = layoutStack(
      [child('a', 20, 10)],
      makeConfig({ direction: 'col', align: 'start' }),
    );

    const b = result.childBounds[0]!;
    expect(b.x).toBe(result.containerBounds.x);
    expect(b.y).toBe(result.containerBounds.y);
    expect(b.w).toBe(20); // input size preserved
    expect(b.h).toBe(10); // input size preserved
  });

  it('respects non-zero bounds origin for a single child (row)', () => {
    const result = layoutStack(
      [child('a', 15, 8)],
      makeConfig({ bounds: { x: 5, y: 10, w: 50, h: 50 }, direction: 'row', align: 'start' }),
    );

    const b = result.childBounds[0]!;
    expect(b.x).toBe(5);
    expect(b.y).toBe(10);
  });

  it('respects non-zero bounds origin for a single child (col)', () => {
    const result = layoutStack(
      [child('a', 15, 8)],
      makeConfig({ bounds: { x: 5, y: 10, w: 50, h: 50 }, direction: 'col', align: 'start' }),
    );

    const b = result.childBounds[0]!;
    expect(b.x).toBe(5);
    expect(b.y).toBe(10);
  });

  it('containerBounds matches single child size (row)', () => {
    const result = layoutStack(
      [child('only', 30, 15)],
      makeConfig({ direction: 'row', gap: 5 }),
    );

    // With one child no gap is added; container should be child size capped to bounds
    expect(result.containerBounds.w).toBe(30);
    expect(result.containerBounds.h).toBe(15);
  });

  it('containerBounds matches single child size (col)', () => {
    const result = layoutStack(
      [child('only', 30, 15)],
      makeConfig({ direction: 'col', gap: 5 }),
    );

    expect(result.containerBounds.w).toBe(30);
    expect(result.containerBounds.h).toBe(15);
  });
});

// ===========================================================================
// 3. Row direction: left-to-right placement
// ===========================================================================

describe('layoutStack — row direction', () => {
  const children = [
    child('a', 20, 10),
    child('b', 25, 10),
    child('c', 15, 10),
  ];

  it('places children left-to-right with no gap', () => {
    const result = layoutStack(children, makeConfig({ direction: 'row', gap: 0 }));
    assertOrderedInDirection(result.childBounds, 'right');
  });

  it('first child starts at bounds.x', () => {
    const result = layoutStack(children, makeConfig({ direction: 'row' }));
    expect(result.childBounds[0]!.x).toBe(result.containerBounds.x);
  });

  it('children do not overlap (row)', () => {
    const result = layoutStack(children, makeConfig({ direction: 'row', gap: 0 }));
    assertNoOverlap(result.childBounds);
  });

  it('consecutive x-positions advance by child width + gap', () => {
    const result = layoutStack(children, makeConfig({ direction: 'row', gap: 5 }));
    assertOrderedInDirection(result.childBounds, 'right');
    assertUniformGap(result.childBounds, 'row', 5);
  });

  it('all children share the same y baseline (row, align=start)', () => {
    const result = layoutStack(children, makeConfig({ direction: 'row', align: 'start' }));
    for (const b of result.childBounds) {
      expect(b.y).toBe(result.containerBounds.y);
    }
  });

  it('preserves child widths in row direction', () => {
    const result = layoutStack(children, makeConfig({ direction: 'row' }));
    expect(result.childBounds[0]!.w).toBe(20);
    expect(result.childBounds[1]!.w).toBe(25);
    expect(result.childBounds[2]!.w).toBe(15);
  });

  it('containerBounds width equals total main-axis size capped to bounds.w', () => {
    const result = layoutStack(children, makeConfig({ direction: 'row', gap: 0 }));
    // total = 20 + 25 + 15 = 60; bounds.w = 100 → not capped
    expect(result.containerBounds.w).toBe(60);
  });

  it('containerBounds height equals max cross size', () => {
    const mixedH = [child('a', 20, 10), child('b', 20, 30), child('c', 20, 15)];
    const result = layoutStack(mixedH, makeConfig({ direction: 'row', gap: 0 }));
    expect(result.containerBounds.h).toBe(30);
  });
});

// ===========================================================================
// 4. Column direction: top-to-bottom placement
// ===========================================================================

describe('layoutStack — column direction', () => {
  const children = [
    child('a', 10, 20),
    child('b', 10, 25),
    child('c', 10, 15),
  ];

  it('places children top-to-bottom with no gap', () => {
    const result = layoutStack(children, makeConfig({ direction: 'col', gap: 0 }));
    assertOrderedInDirection(result.childBounds, 'down');
  });

  it('first child starts at bounds.y', () => {
    const result = layoutStack(children, makeConfig({ direction: 'col' }));
    expect(result.childBounds[0]!.y).toBe(result.containerBounds.y);
  });

  it('children do not overlap (col)', () => {
    const result = layoutStack(children, makeConfig({ direction: 'col', gap: 0 }));
    assertNoOverlap(result.childBounds);
  });

  it('consecutive y-positions advance by child height + gap', () => {
    const result = layoutStack(children, makeConfig({ direction: 'col', gap: 4 }));
    assertOrderedInDirection(result.childBounds, 'down');
    assertUniformGap(result.childBounds, 'col', 4);
  });

  it('all children share the same x baseline (col, align=start)', () => {
    const result = layoutStack(children, makeConfig({ direction: 'col', align: 'start' }));
    for (const b of result.childBounds) {
      expect(b.x).toBe(result.containerBounds.x);
    }
  });

  it('preserves child heights in column direction', () => {
    const result = layoutStack(children, makeConfig({ direction: 'col' }));
    expect(result.childBounds[0]!.h).toBe(20);
    expect(result.childBounds[1]!.h).toBe(25);
    expect(result.childBounds[2]!.h).toBe(15);
  });

  it('containerBounds height equals total main-axis size capped to bounds.h', () => {
    const result = layoutStack(children, makeConfig({ direction: 'col', gap: 0 }));
    // total = 20 + 25 + 15 = 60; bounds.h = 100 → not capped
    expect(result.containerBounds.h).toBe(60);
  });

  it('containerBounds width equals max cross size', () => {
    const mixedW = [child('a', 10, 20), child('b', 40, 20), child('c', 20, 20)];
    const result = layoutStack(mixedW, makeConfig({ direction: 'col', gap: 0 }));
    expect(result.containerBounds.w).toBe(40);
  });
});

// ===========================================================================
// 5. Gap: uniform gap between children
// ===========================================================================

describe('layoutStack — gap', () => {
  it('produces uniform gap between row children', () => {
    const children = [child('a', 10, 5), child('b', 10, 5), child('c', 10, 5)];
    const result = layoutStack(children, makeConfig({ direction: 'row', gap: 8 }));
    assertUniformGap(result.childBounds, 'row', 8);
  });

  it('produces uniform gap between column children', () => {
    const children = [child('a', 5, 10), child('b', 5, 10), child('c', 5, 10)];
    const result = layoutStack(children, makeConfig({ direction: 'col', gap: 6 }));
    assertUniformGap(result.childBounds, 'col', 6);
  });

  it('gap of zero means children are immediately adjacent (row)', () => {
    const children = [child('a', 10, 5), child('b', 15, 5)];
    const result = layoutStack(children, makeConfig({ direction: 'row', gap: 0 }));
    assertUniformGap(result.childBounds, 'row', 0);
    // Verify adjacency: b starts exactly where a ends
    expect(result.childBounds[1]!.x).toBe(result.childBounds[0]!.x + result.childBounds[0]!.w);
  });

  it('gap of zero means children are immediately adjacent (col)', () => {
    const children = [child('a', 5, 10), child('b', 5, 20)];
    const result = layoutStack(children, makeConfig({ direction: 'col', gap: 0 }));
    assertUniformGap(result.childBounds, 'col', 0);
    expect(result.childBounds[1]!.y).toBe(result.childBounds[0]!.y + result.childBounds[0]!.h);
  });

  it('gap is correctly included in total main-axis size', () => {
    const children = [child('a', 10, 5), child('b', 10, 5)];
    const result = layoutStack(children, makeConfig({ direction: 'row', gap: 5 }));
    // total = 10 + 5 + 10 = 25
    expect(result.containerBounds.w).toBe(25);
  });

  it('gap does NOT appear before the first child or after the last child', () => {
    const children = [child('a', 10, 5), child('b', 10, 5)];
    const result = layoutStack(children, makeConfig({ direction: 'row', gap: 5, bounds: { x: 0, y: 0, w: 100, h: 20 } }));

    // First child must start exactly at bounds.x
    expect(result.childBounds[0]!.x).toBe(0);
    // Last child's right edge = 10 + 5 + 10 = 25; no trailing gap
    expect(result.childBounds[1]!.x + result.childBounds[1]!.w).toBe(25);
  });
});

// ===========================================================================
// 6. Cross-axis alignment
// ===========================================================================

describe('layoutStack — cross-axis alignment (row)', () => {
  // Use children of different heights to make alignment visible
  const children = [child('a', 20, 10), child('b', 20, 20), child('c', 20, 5)];
  const bounds = { x: 0, y: 0, w: 100, h: 100 };

  it('align=start: all children have y == containerBounds.y', () => {
    const result = layoutStack(children, makeConfig({ direction: 'row', align: 'start', bounds }));
    assertCrossAlignment(result.childBounds, result.containerBounds, 'start', 'row');
  });

  it('align=center: all children are vertically centred within the container', () => {
    const result = layoutStack(children, makeConfig({ direction: 'row', align: 'center', bounds }));
    assertCrossAlignment(result.childBounds, result.containerBounds, 'center', 'row');
  });

  it('align=end: all children bottom-align within the container', () => {
    const result = layoutStack(children, makeConfig({ direction: 'row', align: 'end', bounds }));
    assertCrossAlignment(result.childBounds, result.containerBounds, 'end', 'row');
  });

  it('align=stretch: all children fill the full container height', () => {
    const result = layoutStack(children, makeConfig({ direction: 'row', align: 'stretch', bounds }));
    assertCrossAlignment(result.childBounds, result.containerBounds, 'stretch', 'row');
  });

  it('align=start does not overlap children (row)', () => {
    const result = layoutStack(children, makeConfig({ direction: 'row', align: 'start', bounds }));
    assertNoOverlap(result.childBounds);
  });

  it('align=stretch: stretched height equals container height', () => {
    const result = layoutStack(children, makeConfig({ direction: 'row', align: 'stretch', bounds }));
    const containerH = result.containerBounds.h;
    for (const b of result.childBounds) {
      expect(b.h).toBeCloseTo(containerH, 1);
    }
  });
});

describe('layoutStack — cross-axis alignment (col)', () => {
  // Use children of different widths to make alignment visible
  const children = [child('a', 10, 20), child('b', 30, 20), child('c', 5, 20)];
  const bounds = { x: 0, y: 0, w: 100, h: 100 };

  it('align=start: all children have x == containerBounds.x', () => {
    const result = layoutStack(children, makeConfig({ direction: 'col', align: 'start', bounds }));
    assertCrossAlignment(result.childBounds, result.containerBounds, 'start', 'col');
  });

  it('align=center: all children are horizontally centred within the container', () => {
    const result = layoutStack(children, makeConfig({ direction: 'col', align: 'center', bounds }));
    assertCrossAlignment(result.childBounds, result.containerBounds, 'center', 'col');
  });

  it('align=end: all children right-align within the container', () => {
    const result = layoutStack(children, makeConfig({ direction: 'col', align: 'end', bounds }));
    assertCrossAlignment(result.childBounds, result.containerBounds, 'end', 'col');
  });

  it('align=stretch: all children fill the full container width', () => {
    const result = layoutStack(children, makeConfig({ direction: 'col', align: 'stretch', bounds }));
    assertCrossAlignment(result.childBounds, result.containerBounds, 'stretch', 'col');
  });

  it('align=stretch: stretched width equals container width', () => {
    const result = layoutStack(children, makeConfig({ direction: 'col', align: 'stretch', bounds }));
    const containerW = result.containerBounds.w;
    for (const b of result.childBounds) {
      expect(b.w).toBeCloseTo(containerW, 1);
    }
  });

  it('align=end does not overlap children (col)', () => {
    const result = layoutStack(children, makeConfig({ direction: 'col', align: 'end', bounds }));
    assertNoOverlap(result.childBounds);
  });
});

// ===========================================================================
// 7. Wrapping
// ===========================================================================

describe('layoutStack — wrap=true (row)', () => {
  // 3 children of width 40 in a 100-wide container → wraps after 2nd (40+4+40=84 ≤ 100, but 84+4+40=128 > 100)
  const makeWrapChildren = () => [
    child('a', 40, 10),
    child('b', 40, 10),
    child('c', 40, 10),
  ];

  it('wraps to a new line when children would exceed bounds.w', () => {
    const result = layoutStack(
      makeWrapChildren(),
      makeConfig({ direction: 'row', gap: 5, wrap: true, bounds: { x: 0, y: 0, w: 90, h: 100 } }),
    );

    // First two fit on the first line (40+5+40=85 ≤ 90), third wraps
    expect(result.childBounds[0]!.y).toBe(result.childBounds[1]!.y); // same line
    expect(result.childBounds[2]!.y).toBeGreaterThan(result.childBounds[0]!.y); // next line
  });

  it('wraps correctly when every child is on its own line', () => {
    const children = [child('a', 60, 10), child('b', 60, 10), child('c', 60, 10)];
    const result = layoutStack(
      children,
      makeConfig({ direction: 'row', gap: 0, wrap: true, bounds: { x: 0, y: 0, w: 50, h: 100 } }),
    );

    // Each child (w=60) > bounds.w (50) but placed on its own line
    // first item always starts on its own line regardless
    const ys = result.childBounds.map((b) => b.y);
    expect(new Set(ys).size).toBe(3); // three distinct y-positions
  });

  it('wrapped children do not overlap', () => {
    const result = layoutStack(
      makeWrapChildren(),
      makeConfig({ direction: 'row', gap: 5, wrap: true, bounds: { x: 0, y: 0, w: 90, h: 100 } }),
    );
    assertNoOverlap(result.childBounds);
  });

  it('within each row, children are ordered left-to-right', () => {
    const children = [child('a', 30, 10), child('b', 30, 10), child('c', 30, 10), child('d', 30, 10)];
    const result = layoutStack(
      children,
      makeConfig({ direction: 'row', gap: 5, wrap: true, bounds: { x: 0, y: 0, w: 70, h: 100 } }),
    );

    // First two should be on the same row, left to right
    expect(result.childBounds[1]!.x).toBeGreaterThan(result.childBounds[0]!.x);
    // Third and fourth wrap; third should be on a new row to the left of the fourth
    expect(result.childBounds[3]!.x).toBeGreaterThan(result.childBounds[2]!.x);
  });

  it('cross-line gap separates wrapped rows', () => {
    const gap = 8;
    const children = [child('a', 40, 10), child('b', 40, 10), child('c', 40, 10)];
    const result = layoutStack(
      children,
      makeConfig({ direction: 'row', gap, wrap: true, bounds: { x: 0, y: 0, w: 90, h: 100 } }),
    );

    // Row 0 ends at y=0+h=10; row 1 should start at 10 + gap = 18
    const row0Bottom = result.childBounds[0]!.y + result.childBounds[0]!.h;
    const row1Top = result.childBounds[2]!.y;
    expect(row1Top - row0Bottom).toBeCloseTo(gap, 1);
  });

  it('childBounds array length equals number of input children', () => {
    const children = makeWrapChildren();
    const result = layoutStack(
      children,
      makeConfig({ direction: 'row', gap: 5, wrap: true, bounds: { x: 0, y: 0, w: 90, h: 100 } }),
    );
    expect(result.childBounds).toHaveLength(children.length);
  });

  it('containerBounds.x and .y equal bounds.x and .y', () => {
    const bounds = { x: 5, y: 10, w: 90, h: 100 };
    const result = layoutStack(
      makeWrapChildren(),
      makeConfig({ direction: 'row', gap: 5, wrap: true, bounds }),
    );
    expect(result.containerBounds.x).toBe(5);
    expect(result.containerBounds.y).toBe(10);
  });
});

describe('layoutStack — wrap=true (col)', () => {
  // 3 children of height 40 in a 90-tall container → second wraps to new column
  const makeWrapChildren = () => [
    child('a', 10, 40),
    child('b', 10, 40),
    child('c', 10, 40),
  ];

  it('wraps to a new column when children would exceed bounds.h', () => {
    const result = layoutStack(
      makeWrapChildren(),
      makeConfig({ direction: 'col', gap: 5, wrap: true, bounds: { x: 0, y: 0, w: 100, h: 90 } }),
    );

    // First two fit in column 0 (40+5+40=85 ≤ 90), third wraps to column 1
    expect(result.childBounds[0]!.x).toBe(result.childBounds[1]!.x);
    expect(result.childBounds[2]!.x).toBeGreaterThan(result.childBounds[0]!.x);
  });

  it('wrapped children do not overlap (col)', () => {
    const result = layoutStack(
      makeWrapChildren(),
      makeConfig({ direction: 'col', gap: 5, wrap: true, bounds: { x: 0, y: 0, w: 100, h: 90 } }),
    );
    assertNoOverlap(result.childBounds);
  });

  it('within each column, children are ordered top-to-bottom', () => {
    const children = [child('a', 10, 30), child('b', 10, 30), child('c', 10, 30), child('d', 10, 30)];
    const result = layoutStack(
      children,
      makeConfig({ direction: 'col', gap: 5, wrap: true, bounds: { x: 0, y: 0, w: 100, h: 70 } }),
    );

    // First two on same column top-to-bottom
    expect(result.childBounds[1]!.y).toBeGreaterThan(result.childBounds[0]!.y);
    // Third and fourth on new column
    expect(result.childBounds[3]!.y).toBeGreaterThan(result.childBounds[2]!.y);
  });
});

// ===========================================================================
// 8. Various child sizes
// ===========================================================================

describe('layoutStack — equal-sized children (row)', () => {
  it('equal children are uniformly spaced in row', () => {
    const children = [child('a', 15, 8), child('b', 15, 8), child('c', 15, 8)];
    const result = layoutStack(children, makeConfig({ direction: 'row', gap: 5 }));

    assertOrderedInDirection(result.childBounds, 'right');
    assertUniformGap(result.childBounds, 'row', 5);
    assertNoOverlap(result.childBounds);
  });

  it('containerBounds are tight around equal children (row)', () => {
    const children = [child('a', 10, 10), child('b', 10, 10)];
    const result = layoutStack(children, makeConfig({ direction: 'row', gap: 0 }));

    expect(result.containerBounds.w).toBe(20);
    expect(result.containerBounds.h).toBe(10);
  });
});

describe('layoutStack — equal-sized children (col)', () => {
  it('equal children are uniformly spaced in col', () => {
    const children = [child('a', 8, 15), child('b', 8, 15), child('c', 8, 15)];
    const result = layoutStack(children, makeConfig({ direction: 'col', gap: 4 }));

    assertOrderedInDirection(result.childBounds, 'down');
    assertUniformGap(result.childBounds, 'col', 4);
    assertNoOverlap(result.childBounds);
  });
});

describe('layoutStack — mixed-sized children (row)', () => {
  it('children of different sizes do not overlap', () => {
    const children = [child('a', 30, 5), child('b', 10, 20), child('c', 20, 12)];
    const result = layoutStack(children, makeConfig({ direction: 'row', gap: 3 }));
    assertNoOverlap(result.childBounds);
  });

  it('each child retains its own width (row)', () => {
    const children = [child('a', 30, 5), child('b', 10, 20), child('c', 20, 12)];
    const result = layoutStack(children, makeConfig({ direction: 'row', gap: 0, align: 'start' }));

    expect(result.childBounds[0]!.w).toBe(30);
    expect(result.childBounds[1]!.w).toBe(10);
    expect(result.childBounds[2]!.w).toBe(20);
  });

  it('each child retains its own height when align is not stretch (row)', () => {
    const children = [child('a', 30, 5), child('b', 10, 20), child('c', 20, 12)];
    const result = layoutStack(children, makeConfig({ direction: 'row', gap: 0, align: 'start' }));

    expect(result.childBounds[0]!.h).toBe(5);
    expect(result.childBounds[1]!.h).toBe(20);
    expect(result.childBounds[2]!.h).toBe(12);
  });

  it('container cross size is the max child cross size (row)', () => {
    const children = [child('a', 20, 5), child('b', 20, 40), child('c', 20, 15)];
    const result = layoutStack(children, makeConfig({ direction: 'row', gap: 0 }));
    expect(result.containerBounds.h).toBe(40);
  });

  it('gap between mixed-size children is uniform (row)', () => {
    const children = [child('a', 30, 5), child('b', 10, 20), child('c', 20, 12)];
    const result = layoutStack(children, makeConfig({ direction: 'row', gap: 7 }));
    assertUniformGap(result.childBounds, 'row', 7);
  });
});

describe('layoutStack — mixed-sized children (col)', () => {
  it('children of different sizes do not overlap (col)', () => {
    const children = [child('a', 5, 30), child('b', 20, 10), child('c', 12, 20)];
    const result = layoutStack(children, makeConfig({ direction: 'col', gap: 3 }));
    assertNoOverlap(result.childBounds);
  });

  it('each child retains its own height (col)', () => {
    const children = [child('a', 5, 30), child('b', 20, 10), child('c', 12, 20)];
    const result = layoutStack(children, makeConfig({ direction: 'col', gap: 0, align: 'start' }));

    expect(result.childBounds[0]!.h).toBe(30);
    expect(result.childBounds[1]!.h).toBe(10);
    expect(result.childBounds[2]!.h).toBe(20);
  });

  it('each child retains its own width when align is not stretch (col)', () => {
    const children = [child('a', 5, 30), child('b', 20, 10), child('c', 12, 20)];
    const result = layoutStack(children, makeConfig({ direction: 'col', gap: 0, align: 'start' }));

    expect(result.childBounds[0]!.w).toBe(5);
    expect(result.childBounds[1]!.w).toBe(20);
    expect(result.childBounds[2]!.w).toBe(12);
  });

  it('container cross size is the max child cross size (col)', () => {
    const children = [child('a', 5, 20), child('b', 40, 20), child('c', 15, 20)];
    const result = layoutStack(children, makeConfig({ direction: 'col', gap: 0 }));
    expect(result.containerBounds.w).toBe(40);
  });

  it('gap between mixed-size children is uniform (col)', () => {
    const children = [child('a', 5, 30), child('b', 20, 10), child('c', 12, 20)];
    const result = layoutStack(children, makeConfig({ direction: 'col', gap: 6 }));
    assertUniformGap(result.childBounds, 'col', 6);
  });
});

// ===========================================================================
// 9. Non-zero bounds origin
// ===========================================================================

describe('layoutStack — non-zero bounds origin', () => {
  it('row children are offset by bounds.x and bounds.y', () => {
    const bounds = { x: 20, y: 30, w: 100, h: 50 };
    const children = [child('a', 10, 5), child('b', 10, 5)];
    const result = layoutStack(children, makeConfig({ direction: 'row', gap: 5, bounds }));

    // First child at (20, 30)
    expect(result.childBounds[0]!.x).toBe(20);
    expect(result.childBounds[0]!.y).toBe(30);

    // Second child at (20 + 10 + 5, 30)
    expect(result.childBounds[1]!.x).toBe(35);
    expect(result.childBounds[1]!.y).toBe(30);
  });

  it('col children are offset by bounds.x and bounds.y', () => {
    const bounds = { x: 20, y: 30, w: 50, h: 100 };
    const children = [child('a', 5, 10), child('b', 5, 10)];
    const result = layoutStack(children, makeConfig({ direction: 'col', gap: 5, bounds }));

    expect(result.childBounds[0]!.x).toBe(20);
    expect(result.childBounds[0]!.y).toBe(30);

    expect(result.childBounds[1]!.x).toBe(20);
    expect(result.childBounds[1]!.y).toBe(45); // 30 + 10 + 5
  });

  it('all children remain within container for non-zero origin', () => {
    const bounds = { x: 10, y: 15, w: 80, h: 60 };
    const children = [child('a', 20, 10), child('b', 20, 15), child('c', 20, 8)];
    const result = layoutStack(children, makeConfig({ direction: 'row', gap: 2, bounds }));
    assertChildrenWithinParent(result.containerBounds, result.childBounds);
  });
});

// ===========================================================================
// 10. Container bounds are within original bounds (capping behaviour)
// ===========================================================================

describe('layoutStack — container bounds capping', () => {
  it('row container width is capped to bounds.w when children exceed it', () => {
    const children = [child('a', 60, 10), child('b', 60, 10)];
    const result = layoutStack(
      children,
      makeConfig({ direction: 'row', gap: 0, bounds: { x: 0, y: 0, w: 80, h: 50 } }),
    );
    expect(result.containerBounds.w).toBeLessThanOrEqual(80);
  });

  it('col container height is capped to bounds.h when children exceed it', () => {
    const children = [child('a', 10, 60), child('b', 10, 60)];
    const result = layoutStack(
      children,
      makeConfig({ direction: 'col', gap: 0, bounds: { x: 0, y: 0, w: 50, h: 80 } }),
    );
    expect(result.containerBounds.h).toBeLessThanOrEqual(80);
  });

  it('container cross dimension is capped to bounds cross when max child exceeds it (row)', () => {
    // Tall child, small bounds.h
    const children = [child('a', 20, 200)];
    const result = layoutStack(
      children,
      makeConfig({ direction: 'row', gap: 0, bounds: { x: 0, y: 0, w: 100, h: 50 } }),
    );
    expect(result.containerBounds.h).toBeLessThanOrEqual(50);
  });

  it('container cross dimension is capped to bounds cross when max child exceeds it (col)', () => {
    // Wide child, small bounds.w
    const children = [child('a', 200, 20)];
    const result = layoutStack(
      children,
      makeConfig({ direction: 'col', gap: 0, bounds: { x: 0, y: 0, w: 50, h: 100 } }),
    );
    expect(result.containerBounds.w).toBeLessThanOrEqual(50);
  });
});

// ===========================================================================
// 11. Result structure invariants
// ===========================================================================

describe('layoutStack — result structure', () => {
  it('childBounds length equals input children length', () => {
    const children = [child('a', 10, 5), child('b', 15, 5), child('c', 10, 5)];
    const result = layoutStack(children, makeConfig());
    expect(result.childBounds).toHaveLength(children.length);
  });

  it('containerBounds has x, y, w, h properties', () => {
    const result = layoutStack([child('a', 10, 5)], makeConfig());
    expect(result.containerBounds).toHaveProperty('x');
    expect(result.containerBounds).toHaveProperty('y');
    expect(result.containerBounds).toHaveProperty('w');
    expect(result.containerBounds).toHaveProperty('h');
  });

  it('each childBound has x, y, w, h properties', () => {
    const children = [child('a', 10, 5), child('b', 10, 5)];
    const result = layoutStack(children, makeConfig());
    for (const b of result.childBounds) {
      expect(b).toHaveProperty('x');
      expect(b).toHaveProperty('y');
      expect(b).toHaveProperty('w');
      expect(b).toHaveProperty('h');
    }
  });

  it('containerBounds.x equals bounds.x', () => {
    const bounds = { x: 7, y: 3, w: 80, h: 80 };
    const result = layoutStack([child('a', 10, 5)], makeConfig({ bounds }));
    expect(result.containerBounds.x).toBe(7);
    expect(result.containerBounds.y).toBe(3);
  });
});
