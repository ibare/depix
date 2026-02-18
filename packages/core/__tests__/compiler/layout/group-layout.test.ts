/**
 * Tests for the Group Layout Algorithm.
 *
 * The group layout:
 *  - Stacks children vertically within the padded content area.
 *  - Centers each child horizontally within the content area.
 *  - Computes container height to fit children + padding (capped at bounds.h).
 *  - Uses a fixed inter-child gap of 1 unit.
 */

import { describe, it, expect } from 'vitest';
import { layoutGroup } from '../../../src/compiler/layout/group-layout.js';
import type { GroupLayoutConfig, LayoutChild } from '../../../src/compiler/layout/types.js';
import {
  assertChildrenWithinParent,
  assertNoOverlap,
  assertOrderedInDirection,
} from '../../helpers/layout-assertions.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function child(id: string, width = 20, height = 10): LayoutChild {
  return { id, width, height };
}

function baseConfig(overrides: Partial<GroupLayoutConfig> = {}): GroupLayoutConfig {
  return {
    bounds: { x: 0, y: 0, w: 100, h: 100 },
    padding: 5,
    ...overrides,
  };
}

// The fixed internal gap used by the group layout implementation.
const INTERNAL_GAP = 1;

// ---------------------------------------------------------------------------
// Empty children
// ---------------------------------------------------------------------------

describe('layoutGroup – empty children', () => {
  it('returns container bounds equal to config bounds and no childBounds', () => {
    const config = baseConfig({ bounds: { x: 5, y: 10, w: 60, h: 40 } });
    const result = layoutGroup([], config);

    expect(result.containerBounds).toEqual({ x: 5, y: 10, w: 60, h: 40 });
    expect(result.childBounds).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Single child
// ---------------------------------------------------------------------------

describe('layoutGroup – single child', () => {
  it('child is placed within the padded content area', () => {
    const padding = 10;
    const config = baseConfig({
      bounds: { x: 0, y: 0, w: 80, h: 60 },
      padding,
    });
    const children = [child('a', 20, 10)];

    const { containerBounds, childBounds } = layoutGroup(children, config);

    expect(childBounds).toHaveLength(1);
    const b = childBounds[0]!;

    // Child must start at or after the padded left edge
    expect(b.x).toBeGreaterThanOrEqual(padding - 0.01);
    // Child must start at or after the padded top edge
    expect(b.y).toBeGreaterThanOrEqual(padding - 0.01);

    assertChildrenWithinParent(containerBounds, childBounds);
  });

  it('single child is horizontally centered within content area', () => {
    const padding = 5;
    const config = baseConfig({
      bounds: { x: 0, y: 0, w: 100, h: 100 },
      padding,
    });
    const children = [child('a', 20, 10)];

    const { childBounds } = layoutGroup(children, config);
    const b = childBounds[0]!;

    // contentW = 100 - 2*5 = 90; center x = 5 + (90-20)/2 = 5 + 35 = 40
    const contentX = padding;
    const contentW = 100 - padding * 2;
    const expectedX = contentX + (contentW - 20) / 2;

    expect(b.x).toBeCloseTo(expectedX, 1);
  });

  it('single child starts at padded y offset', () => {
    const padding = 8;
    const config = baseConfig({
      bounds: { x: 0, y: 0, w: 100, h: 100 },
      padding,
    });
    const children = [child('a', 20, 10)];

    const { childBounds } = layoutGroup(children, config);

    expect(childBounds[0]!.y).toBeCloseTo(padding, 1);
  });

  it('container height fits child + 2 × padding (up to bounds.h)', () => {
    const padding = 5;
    const childH = 10;
    const config = baseConfig({
      bounds: { x: 0, y: 0, w: 80, h: 200 },
      padding,
    });
    const children = [child('a', 20, childH)];

    const { containerBounds } = layoutGroup(children, config);

    // usedH = min(totalH + 2*padding, bounds.h) = min(10 + 10, 200) = 20
    const expectedH = childH + padding * 2;
    expect(containerBounds.h).toBeCloseTo(expectedH, 1);
  });
});

// ---------------------------------------------------------------------------
// Multiple children stacked vertically
// ---------------------------------------------------------------------------

describe('layoutGroup – multiple children stacked vertically', () => {
  it('children are ordered top-to-bottom', () => {
    const config = baseConfig({ padding: 5 });
    const children = [child('a', 20, 10), child('b', 20, 10), child('c', 20, 10)];

    const { containerBounds, childBounds } = layoutGroup(children, config);

    assertOrderedInDirection(childBounds, 'down');
    assertNoOverlap(childBounds);
    assertChildrenWithinParent(containerBounds, childBounds);
  });

  it('inter-child gap matches the internal gap constant', () => {
    const config = baseConfig({ padding: 5 });
    const children = [child('a', 20, 10), child('b', 20, 15), child('c', 20, 8)];

    const { childBounds } = layoutGroup(children, config);

    for (let i = 1; i < childBounds.length; i++) {
      const prev = childBounds[i - 1]!;
      const curr = childBounds[i]!;
      const actualGap = curr.y - (prev.y + prev.h);
      expect(actualGap).toBeCloseTo(INTERNAL_GAP, 1);
    }
  });

  it('all children are horizontally centered within content area', () => {
    const padding = 10;
    const bounds = { x: 0, y: 0, w: 100, h: 200 };
    const config = baseConfig({ bounds, padding });
    const children = [child('a', 30, 10), child('b', 40, 10), child('c', 20, 10)];

    const { childBounds } = layoutGroup(children, config);

    const contentX = padding;
    const contentW = bounds.w - padding * 2;
    const contentCenterX = contentX + contentW / 2;

    for (const b of childBounds) {
      const childCenterX = b.x + b.w / 2;
      expect(childCenterX).toBeCloseTo(contentCenterX, 1);
    }
  });

  it('container width always equals bounds.w', () => {
    const config = baseConfig({ bounds: { x: 0, y: 0, w: 80, h: 200 }, padding: 5 });
    const children = [child('a', 20, 10), child('b', 20, 10)];

    const { containerBounds } = layoutGroup(children, config);

    expect(containerBounds.w).toBeCloseTo(80, 1);
  });
});

// ---------------------------------------------------------------------------
// Padding effects
// ---------------------------------------------------------------------------

describe('layoutGroup – padding affects content positioning', () => {
  it('larger padding pushes children further inward', () => {
    const smallPad = baseConfig({ bounds: { x: 0, y: 0, w: 100, h: 100 }, padding: 2 });
    const largePad = baseConfig({ bounds: { x: 0, y: 0, w: 100, h: 100 }, padding: 20 });
    const children = [child('a', 20, 10)];

    const { childBounds: small } = layoutGroup(children, smallPad);
    const { childBounds: large } = layoutGroup(children, largePad);

    // With larger padding the child starts further down
    expect(large[0]!.y).toBeGreaterThan(small[0]!.y);
  });

  it('zero padding: child y equals bounds.y', () => {
    const config = baseConfig({ bounds: { x: 0, y: 0, w: 100, h: 100 }, padding: 0 });
    const children = [child('a', 20, 10)];

    const { childBounds } = layoutGroup(children, config);

    expect(childBounds[0]!.y).toBeCloseTo(0, 1);
  });

  it('container height is capped at bounds.h when children overflow', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 30 };
    const config = baseConfig({ bounds, padding: 5 });
    // Three large children that would overflow the 30-unit height
    const children = [child('a', 20, 20), child('b', 20, 20), child('c', 20, 20)];

    const { containerBounds } = layoutGroup(children, config);

    expect(containerBounds.h).toBeLessThanOrEqual(bounds.h + 0.01);
  });
});

// ---------------------------------------------------------------------------
// Container bounds origin
// ---------------------------------------------------------------------------

describe('layoutGroup – container bounds origin', () => {
  it('container x and y match bounds origin', () => {
    const bounds = { x: 15, y: 25, w: 80, h: 60 };
    const config = baseConfig({ bounds, padding: 5 });
    const children = [child('a', 20, 10)];

    const { containerBounds } = layoutGroup(children, config);

    expect(containerBounds.x).toBeCloseTo(15, 1);
    expect(containerBounds.y).toBeCloseTo(25, 1);
  });

  it('child x and y are offset by the bounds origin', () => {
    const bounds = { x: 10, y: 20, w: 80, h: 100 };
    const padding = 5;
    const config = baseConfig({ bounds, padding });
    const children = [child('a', 20, 10)];

    const { childBounds } = layoutGroup(children, config);

    // contentX = bounds.x + padding = 15; child.y = bounds.y + padding = 25
    expect(childBounds[0]!.y).toBeCloseTo(bounds.y + padding, 1);
    expect(childBounds[0]!.x).toBeGreaterThanOrEqual(bounds.x + padding - 0.01);
  });
});
