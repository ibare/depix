/**
 * Tests for the Layers Layout Algorithm.
 *
 * The layers layout:
 *  - Divides bounds.h into n equal horizontal bands separated by gap.
 *  - layerHeight = (bounds.h - gap * (n - 1)) / n
 *  - Each child gets x=bounds.x, w=bounds.w, y=bounds.y + i*(layerHeight+gap), h=layerHeight.
 *  - Container bounds are returned unchanged (== config bounds).
 */

import { describe, it, expect } from 'vitest';
import { layoutLayers } from '../../../src/compiler/layout/layers-layout.js';
import type { LayersLayoutConfig, LayoutChild } from '../../../src/compiler/layout/types.js';
import {
  assertChildrenWithinParent,
  assertNoOverlap,
  assertOrderedInDirection,
  assertUniformGap,
} from '../../helpers/layout-assertions.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function child(id: string): LayoutChild {
  return { id, width: 10, height: 10 };
}

function baseConfig(overrides: Partial<LayersLayoutConfig> = {}): LayersLayoutConfig {
  return {
    bounds: { x: 0, y: 0, w: 100, h: 100 },
    gap: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Empty children
// ---------------------------------------------------------------------------

describe('layoutLayers – empty children', () => {
  it('returns container bounds equal to config bounds and no childBounds', () => {
    const config = baseConfig({ bounds: { x: 5, y: 10, w: 60, h: 40 } });
    const result = layoutLayers([], config);

    expect(result.containerBounds).toEqual({ x: 5, y: 10, w: 60, h: 40 });
    expect(result.childBounds).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Single layer
// ---------------------------------------------------------------------------

describe('layoutLayers – single layer', () => {
  it('one child spans the full bounds', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 60 };
    const config = baseConfig({ bounds, gap: 5 });
    const children = [child('a')];

    const { containerBounds, childBounds } = layoutLayers(children, config);

    expect(childBounds).toHaveLength(1);

    const b = childBounds[0]!;
    // With n=1: layerHeight = (60 - 5*(1-1)) / 1 = 60
    expect(b.x).toBeCloseTo(bounds.x, 1);
    expect(b.y).toBeCloseTo(bounds.y, 1);
    expect(b.w).toBeCloseTo(bounds.w, 1);
    expect(b.h).toBeCloseTo(60, 1);

    expect(containerBounds).toEqual(bounds);
  });
});

// ---------------------------------------------------------------------------
// Equal-height bands
// ---------------------------------------------------------------------------

describe('layoutLayers – equal-height bands', () => {
  it('3 layers with gap=0: each band is exactly 1/3 of bounds.h', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 90 };
    const config = baseConfig({ bounds, gap: 0 });
    const children = [child('a'), child('b'), child('c')];

    const { childBounds } = layoutLayers(children, config);

    const expectedH = 90 / 3; // 30
    for (const b of childBounds) {
      expect(b.h).toBeCloseTo(expectedH, 1);
    }
  });

  it('3 layers with gap=5: each band height accounts for gaps', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 100 };
    const gap = 5;
    const config = baseConfig({ bounds, gap });
    const children = [child('a'), child('b'), child('c')];

    const { childBounds } = layoutLayers(children, config);

    // layerHeight = (100 - 5*2) / 3 = 90/3 = 30
    const expectedH = (100 - gap * 2) / 3;
    for (const b of childBounds) {
      expect(b.h).toBeCloseTo(expectedH, 1);
    }
  });

  it('all bands have the same height', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 120 };
    const config = baseConfig({ bounds, gap: 6 });
    const children = [child('a'), child('b'), child('c'), child('d')];

    const { childBounds } = layoutLayers(children, config);

    const h0 = childBounds[0]!.h;
    for (const b of childBounds) {
      expect(b.h).toBeCloseTo(h0, 4);
    }
  });
});

// ---------------------------------------------------------------------------
// Gap between layers
// ---------------------------------------------------------------------------

describe('layoutLayers – gap between layers', () => {
  it('vertical gap between consecutive bands matches config.gap', () => {
    const gap = 8;
    const config = baseConfig({ bounds: { x: 0, y: 0, w: 100, h: 100 }, gap });
    const children = [child('a'), child('b'), child('c')];

    const { childBounds } = layoutLayers(children, config);

    assertUniformGap(childBounds, 'col', gap);
  });

  it('zero gap: no space between bands', () => {
    const config = baseConfig({ bounds: { x: 0, y: 0, w: 100, h: 90 }, gap: 0 });
    const children = [child('a'), child('b'), child('c')];

    const { childBounds } = layoutLayers(children, config);

    assertUniformGap(childBounds, 'col', 0);
  });
});

// ---------------------------------------------------------------------------
// Full-width bands
// ---------------------------------------------------------------------------

describe('layoutLayers – full-width spans', () => {
  it('every band spans the full bounds.w', () => {
    const bounds = { x: 0, y: 0, w: 80, h: 120 };
    const config = baseConfig({ bounds, gap: 5 });
    const children = [child('a'), child('b'), child('c')];

    const { childBounds } = layoutLayers(children, config);

    for (const b of childBounds) {
      expect(b.w).toBeCloseTo(bounds.w, 1);
      expect(b.x).toBeCloseTo(bounds.x, 1);
    }
  });

  it('x origin of all bands equals bounds.x', () => {
    const bounds = { x: 20, y: 10, w: 60, h: 90 };
    const config = baseConfig({ bounds, gap: 3 });
    const children = [child('a'), child('b')];

    const { childBounds } = layoutLayers(children, config);

    for (const b of childBounds) {
      expect(b.x).toBeCloseTo(bounds.x, 1);
    }
  });
});

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

describe('layoutLayers – bands ordered top-to-bottom', () => {
  it('bands are ordered from top to bottom', () => {
    const config = baseConfig({ gap: 5 });
    const children = [child('a'), child('b'), child('c')];

    const { childBounds } = layoutLayers(children, config);

    assertOrderedInDirection(childBounds, 'down');
    assertNoOverlap(childBounds);
  });
});

// ---------------------------------------------------------------------------
// Containment
// ---------------------------------------------------------------------------

describe('layoutLayers – children within container', () => {
  it('all children are within container bounds', () => {
    const config = baseConfig({ bounds: { x: 0, y: 0, w: 100, h: 100 }, gap: 5 });
    const children = [child('a'), child('b'), child('c')];

    const { containerBounds, childBounds } = layoutLayers(children, config);

    assertChildrenWithinParent(containerBounds, childBounds);
  });

  it('container bounds are returned unchanged from config bounds', () => {
    const bounds = { x: 10, y: 20, w: 70, h: 80 };
    const config = baseConfig({ bounds, gap: 4 });
    const children = [child('a'), child('b')];

    const { containerBounds } = layoutLayers(children, config);

    expect(containerBounds).toEqual(bounds);
  });
});

// ---------------------------------------------------------------------------
// Y positioning precision
// ---------------------------------------------------------------------------

describe('layoutLayers – precise y positions', () => {
  it('first band starts exactly at bounds.y', () => {
    const bounds = { x: 0, y: 15, w: 100, h: 90 };
    const config = baseConfig({ bounds, gap: 0 });
    const children = [child('a'), child('b'), child('c')];

    const { childBounds } = layoutLayers(children, config);

    expect(childBounds[0]!.y).toBeCloseTo(bounds.y, 1);
  });

  it('second band starts at bounds.y + layerHeight + gap', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 90 };
    const gap = 5;
    const config = baseConfig({ bounds, gap });
    const children = [child('a'), child('b'), child('c')];

    const { childBounds } = layoutLayers(children, config);

    // layerHeight = (90 - 5*2) / 3 = 80/3
    const layerHeight = (90 - gap * 2) / 3;
    expect(childBounds[1]!.y).toBeCloseTo(bounds.y + layerHeight + gap, 1);
  });

  it('third band starts at bounds.y + 2*(layerHeight + gap)', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 90 };
    const gap = 5;
    const config = baseConfig({ bounds, gap });
    const children = [child('a'), child('b'), child('c')];

    const { childBounds } = layoutLayers(children, config);

    const layerHeight = (90 - gap * 2) / 3;
    expect(childBounds[2]!.y).toBeCloseTo(bounds.y + 2 * (layerHeight + gap), 1);
  });
});
