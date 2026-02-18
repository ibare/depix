/**
 * Tests for the Flow Layout Algorithm (Sugiyama-style directed graph layout).
 *
 * The flow layout:
 *  1. Topologically sorts nodes via Kahn's algorithm.
 *  2. Assigns each node to a layer (longest-path from sources).
 *  3. Minimises crossings with a barycenter sweep.
 *  4. Assigns positions: layers along the main axis, nodes centered cross-axis.
 */

import { describe, it, expect } from 'vitest';
import { layoutFlow } from '../../../src/compiler/layout/flow-layout.js';
import type { FlowLayoutConfig, LayoutChild, FlowEdge } from '../../../src/compiler/layout/types.js';
import {
  assertChildrenWithinParent,
  assertNoOverlap,
  assertOrderedInDirection,
} from '../../helpers/layout-assertions.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function child(id: string, width = 10, height = 10): LayoutChild {
  return { id, width, height };
}

function edge(fromId: string, toId: string): FlowEdge {
  return { fromId, toId };
}

function baseConfig(
  overrides: Partial<FlowLayoutConfig> = {},
): FlowLayoutConfig {
  return {
    bounds: { x: 0, y: 0, w: 100, h: 100 },
    direction: 'right',
    gap: 5,
    edges: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Empty children
// ---------------------------------------------------------------------------

describe('layoutFlow – empty children', () => {
  it('returns container bounds equal to config bounds and no childBounds', () => {
    const config = baseConfig({ bounds: { x: 10, y: 20, w: 80, h: 60 } });
    const result = layoutFlow([], config);

    expect(result.containerBounds).toEqual({ x: 10, y: 20, w: 80, h: 60 });
    expect(result.childBounds).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// No edges – all nodes end up in the same layer (layer 0)
// ---------------------------------------------------------------------------

describe('layoutFlow – no edges', () => {
  it('places all nodes in layer 0, stacked cross-axis, direction right', () => {
    const children = [child('a'), child('b'), child('c')];
    const config = baseConfig({ direction: 'right', gap: 5, edges: [] });

    const { containerBounds, childBounds } = layoutFlow(children, config);

    // All nodes should be in layer 0 – same x position (main axis = x for direction 'right')
    const xs = childBounds.map((b) => b.x);
    expect(xs[0]).toBeCloseTo(xs[1]!, 1);
    expect(xs[0]).toBeCloseTo(xs[2]!, 1);

    // They should be stacked vertically (cross-axis = y), so ordered top-to-bottom
    assertOrderedInDirection(childBounds, 'down');

    assertChildrenWithinParent(containerBounds, childBounds);
    assertNoOverlap(childBounds);
  });

  it('places all nodes in layer 0, direction down', () => {
    const children = [child('a'), child('b'), child('c')];
    const config = baseConfig({ direction: 'down', gap: 5, edges: [] });

    const { containerBounds, childBounds } = layoutFlow(children, config);

    // All nodes in same layer 0 – same y position (main axis = y for direction 'down')
    const ys = childBounds.map((b) => b.y);
    expect(ys[0]).toBeCloseTo(ys[1]!, 1);
    expect(ys[0]).toBeCloseTo(ys[2]!, 1);

    // Stacked horizontally (cross-axis = x)
    assertOrderedInDirection(childBounds, 'right');

    assertChildrenWithinParent(containerBounds, childBounds);
    assertNoOverlap(childBounds);
  });
});

// ---------------------------------------------------------------------------
// Linear chain A → B → C
// ---------------------------------------------------------------------------

describe('layoutFlow – linear chain A → B → C', () => {
  it('direction right: A is leftmost, B middle, C rightmost', () => {
    const children = [child('a'), child('b'), child('c')];
    const edges = [edge('a', 'b'), edge('b', 'c')];
    const config = baseConfig({ direction: 'right', gap: 5, edges });

    const { containerBounds, childBounds } = layoutFlow(children, config);
    const [a, b, c] = childBounds as [typeof childBounds[0], typeof childBounds[0], typeof childBounds[0]];

    // Three distinct layers: a.x < b.x < c.x
    expect(a.x).toBeLessThan(b.x);
    expect(b.x).toBeLessThan(c.x);

    assertChildrenWithinParent(containerBounds, childBounds);
    assertNoOverlap(childBounds);
  });

  it('direction down: A is topmost, B middle, C bottommost', () => {
    const children = [child('a'), child('b'), child('c')];
    const edges = [edge('a', 'b'), edge('b', 'c')];
    const config = baseConfig({ direction: 'down', gap: 5, edges });

    const { containerBounds, childBounds } = layoutFlow(children, config);
    const [a, b, c] = childBounds as [typeof childBounds[0], typeof childBounds[0], typeof childBounds[0]];

    // Three distinct layers: a.y < b.y < c.y
    expect(a.y).toBeLessThan(b.y);
    expect(b.y).toBeLessThan(c.y);

    assertChildrenWithinParent(containerBounds, childBounds);
    assertNoOverlap(childBounds);
  });

  it('layers are separated by at least the configured gap', () => {
    const children = [child('a'), child('b'), child('c')];
    const edges = [edge('a', 'b'), edge('b', 'c')];
    const gap = 8;
    const config = baseConfig({ direction: 'right', gap, edges });

    const { childBounds } = layoutFlow(children, config);
    const [a, b, c] = childBounds as [typeof childBounds[0], typeof childBounds[0], typeof childBounds[0]];

    // gap between a's right edge and b's left edge
    expect(b.x - (a.x + a.w)).toBeGreaterThanOrEqual(gap - 0.5);
    expect(c.x - (b.x + b.w)).toBeGreaterThanOrEqual(gap - 0.5);
  });
});

// ---------------------------------------------------------------------------
// Multiple sources (nodes with no incoming edges)
// ---------------------------------------------------------------------------

describe('layoutFlow – multiple sources', () => {
  it('both sources land in layer 0 (same x for direction right)', () => {
    // Graph: A → C, B → C  (A and B are sources, C is sink)
    const children = [child('a'), child('b'), child('c')];
    const edges = [edge('a', 'c'), edge('b', 'c')];
    const config = baseConfig({ direction: 'right', gap: 5, edges });

    const { containerBounds, childBounds } = layoutFlow(children, config);
    const [a, b, c] = childBounds as [typeof childBounds[0], typeof childBounds[0], typeof childBounds[0]];

    // A and B are in the same layer, so same x
    expect(a.x).toBeCloseTo(b.x, 1);
    // C is in the next layer, so further right
    expect(c.x).toBeGreaterThan(a.x);

    assertChildrenWithinParent(containerBounds, childBounds);
    assertNoOverlap(childBounds);
  });
});

// ---------------------------------------------------------------------------
// Diamond pattern A → B, A → C, B → D, C → D
// ---------------------------------------------------------------------------

describe('layoutFlow – diamond pattern', () => {
  it('direction right: A < B=C < D (layer ordering)', () => {
    const children = [child('a'), child('b'), child('c'), child('d')];
    const edges = [
      edge('a', 'b'),
      edge('a', 'c'),
      edge('b', 'd'),
      edge('c', 'd'),
    ];
    const config = baseConfig({ direction: 'right', gap: 5, edges });

    const { containerBounds, childBounds } = layoutFlow(children, config);
    const [a, b, c, d] = childBounds as [typeof childBounds[0], typeof childBounds[0], typeof childBounds[0], typeof childBounds[0]];

    // Layer 0: A, Layer 1: B & C, Layer 2: D
    expect(a.x).toBeLessThan(b.x);
    expect(a.x).toBeLessThan(c.x);
    expect(b.x).toBeCloseTo(c.x, 1); // B and C are in the same layer
    expect(d.x).toBeGreaterThan(b.x);
    expect(d.x).toBeGreaterThan(c.x);

    assertChildrenWithinParent(containerBounds, childBounds);
    assertNoOverlap(childBounds);
  });

  it('direction down: A topmost, B and C middle, D bottommost', () => {
    const children = [child('a'), child('b'), child('c'), child('d')];
    const edges = [
      edge('a', 'b'),
      edge('a', 'c'),
      edge('b', 'd'),
      edge('c', 'd'),
    ];
    const config = baseConfig({ direction: 'down', gap: 5, edges });

    const { containerBounds, childBounds } = layoutFlow(children, config);
    const [a, b, c, d] = childBounds as [typeof childBounds[0], typeof childBounds[0], typeof childBounds[0], typeof childBounds[0]];

    expect(a.y).toBeLessThan(b.y);
    expect(a.y).toBeLessThan(c.y);
    expect(b.y).toBeCloseTo(c.y, 1);
    expect(d.y).toBeGreaterThan(b.y);
    expect(d.y).toBeGreaterThan(c.y);

    assertChildrenWithinParent(containerBounds, childBounds);
    assertNoOverlap(childBounds);
  });

  it('B and C do not overlap each other within their shared layer', () => {
    const children = [child('a'), child('b'), child('c'), child('d')];
    const edges = [
      edge('a', 'b'),
      edge('a', 'c'),
      edge('b', 'd'),
      edge('c', 'd'),
    ];
    const config = baseConfig({ direction: 'right', gap: 5, edges });

    const { childBounds } = layoutFlow(children, config);

    assertNoOverlap(childBounds);
  });
});

// ---------------------------------------------------------------------------
// Container bounds
// ---------------------------------------------------------------------------

describe('layoutFlow – container bounds', () => {
  it('container bounds respect the configured bounds origin', () => {
    const bounds = { x: 20, y: 30, w: 100, h: 80 };
    const children = [child('a'), child('b')];
    const config = baseConfig({ bounds, direction: 'right', gap: 5, edges: [edge('a', 'b')] });

    const { containerBounds } = layoutFlow(children, config);

    expect(containerBounds.x).toBeCloseTo(20, 1);
    expect(containerBounds.y).toBeCloseTo(30, 1);
  });

  it('container w/h do not exceed the configured bounds', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 100 };
    const children = [child('a', 20, 20), child('b', 20, 20), child('c', 20, 20)];
    const edges = [edge('a', 'b'), edge('b', 'c')];
    const config = baseConfig({ bounds, direction: 'right', gap: 5, edges });

    const { containerBounds } = layoutFlow(children, config);

    expect(containerBounds.w).toBeLessThanOrEqual(bounds.w + 0.01);
    expect(containerBounds.h).toBeLessThanOrEqual(bounds.h + 0.01);
  });
});
