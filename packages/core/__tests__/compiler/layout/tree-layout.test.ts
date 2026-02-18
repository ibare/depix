/**
 * Tests for the Tree Layout Algorithm (Reingold-Tilford style).
 *
 * The tree layout:
 *  1. Computes subtree spans (cross-axis) bottom-up.
 *  2. Computes node depths (levels) top-down.
 *  3. Assigns positions: parents centered over children, levels along main axis.
 *
 * Input: flat array of TreeNode, root is always index 0.
 */

import { describe, it, expect } from 'vitest';
import { layoutTree } from '../../../src/compiler/layout/tree-layout.js';
import type { TreeLayoutConfig, TreeNode } from '../../../src/compiler/layout/types.js';
import {
  assertChildrenWithinParent,
  assertNoOverlap,
} from '../../helpers/layout-assertions.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function node(id: string, children: number[], width = 10, height = 10): TreeNode {
  return { id, width, height, children };
}

function baseConfig(overrides: Partial<TreeLayoutConfig> = {}): TreeLayoutConfig {
  return {
    bounds: { x: 0, y: 0, w: 100, h: 100 },
    direction: 'down',
    levelGap: 10,
    siblingGap: 5,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Empty nodes array
// ---------------------------------------------------------------------------

describe('layoutTree – empty nodes', () => {
  it('returns container bounds equal to config bounds and no childBounds', () => {
    const config = baseConfig({ bounds: { x: 5, y: 15, w: 90, h: 70 } });
    const result = layoutTree([], config);

    expect(result.containerBounds).toEqual({ x: 5, y: 15, w: 90, h: 70 });
    expect(result.childBounds).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Single root (no children)
// ---------------------------------------------------------------------------

describe('layoutTree – single root, no children', () => {
  it('positions the root within the configured bounds, direction down', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 100 };
    const nodes = [node('root', [], 20, 10)];
    const config = baseConfig({ direction: 'down', bounds });

    const { childBounds } = layoutTree(nodes, config);

    expect(childBounds).toHaveLength(1);
    // The algorithm centers the content cross-axis within bounds,
    // so we assert against the full configured bounds.
    assertChildrenWithinParent(bounds, childBounds);
  });

  it('positions the root within the configured bounds, direction right', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 100 };
    const nodes = [node('root', [], 20, 10)];
    const config = baseConfig({ direction: 'right', bounds });

    const { childBounds } = layoutTree(nodes, config);

    expect(childBounds).toHaveLength(1);
    assertChildrenWithinParent(bounds, childBounds);
  });

  it('root y equals container y for direction down', () => {
    const nodes = [node('root', [], 10, 10)];
    const config = baseConfig({ direction: 'down', bounds: { x: 0, y: 0, w: 100, h: 100 } });

    const { childBounds } = layoutTree(nodes, config);

    expect(childBounds[0]!.y).toBeCloseTo(0, 1);
  });

  it('root x equals container x for direction right', () => {
    const nodes = [node('root', [], 10, 10)];
    const config = baseConfig({ direction: 'right', bounds: { x: 0, y: 0, w: 100, h: 100 } });

    const { childBounds } = layoutTree(nodes, config);

    expect(childBounds[0]!.x).toBeCloseTo(0, 1);
  });
});

// ---------------------------------------------------------------------------
// Simple 2-level tree: root + 2 children
// ---------------------------------------------------------------------------

describe('layoutTree – 2-level tree (root + 2 children)', () => {
  // nodes[0] = root, children: [1, 2]
  // nodes[1] = childA (leaf)
  // nodes[2] = childB (leaf)
  const nodes = [
    node('root', [1, 2], 10, 10),
    node('childA', [], 10, 10),
    node('childB', [], 10, 10),
  ];

  it('direction down: root is above both children', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 100 };
    const config = baseConfig({ direction: 'down', bounds });
    const { childBounds } = layoutTree(nodes, config);

    const [root, childA, childB] = childBounds as [typeof childBounds[0], typeof childBounds[0], typeof childBounds[0]];

    // Root is at a higher y than children (top = 0, grows downward)
    expect(root.y).toBeLessThan(childA.y);
    expect(root.y).toBeLessThan(childB.y);

    // Children are at the same level (same y)
    expect(childA.y).toBeCloseTo(childB.y, 1);

    // Children are horizontally separated (no overlap)
    assertNoOverlap(childBounds);
    // Assert against the configured bounds (tree centers cross-axis within bounds)
    assertChildrenWithinParent(bounds, childBounds);
  });

  it('direction right: root is to the left of both children', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 100 };
    const config = baseConfig({ direction: 'right', bounds });
    const { childBounds } = layoutTree(nodes, config);

    const [root, childA, childB] = childBounds as [typeof childBounds[0], typeof childBounds[0], typeof childBounds[0]];

    expect(root.x).toBeLessThan(childA.x);
    expect(root.x).toBeLessThan(childB.x);

    // Children are at the same level (same x)
    expect(childA.x).toBeCloseTo(childB.x, 1);

    assertNoOverlap(childBounds);
    // Assert against the configured bounds (tree centers cross-axis within bounds)
    assertChildrenWithinParent(bounds, childBounds);
  });

  it('direction down: root is horizontally centered between its children', () => {
    const config = baseConfig({
      direction: 'down',
      bounds: { x: 0, y: 0, w: 100, h: 100 },
      siblingGap: 5,
    });
    const { childBounds } = layoutTree(nodes, config);
    const [root, childA, childB] = childBounds as [typeof childBounds[0], typeof childBounds[0], typeof childBounds[0]];

    // Root center-x should be approximately the midpoint of children centers
    const rootCenterX = root.x + root.w / 2;
    const childACenterX = childA.x + childA.w / 2;
    const childBCenterX = childB.x + childB.w / 2;
    const midpointX = (childACenterX + childBCenterX) / 2;

    expect(rootCenterX).toBeCloseTo(midpointX, 0);
  });

  it('children do not overlap each other', () => {
    const config = baseConfig({ direction: 'down' });
    const { childBounds } = layoutTree(nodes, config);

    assertNoOverlap(childBounds);
  });
});

// ---------------------------------------------------------------------------
// 3-level tree: root → children → grandchildren
// ---------------------------------------------------------------------------

describe('layoutTree – 3-level tree', () => {
  // nodes[0] = root,   children: [1, 2]
  // nodes[1] = child1, children: [3, 4]
  // nodes[2] = child2, children: []
  // nodes[3] = gc1,    children: []
  // nodes[4] = gc2,    children: []
  const nodes = [
    node('root', [1, 2], 10, 10),
    node('child1', [3, 4], 10, 10),
    node('child2', [], 10, 10),
    node('gc1', [], 10, 10),
    node('gc2', [], 10, 10),
  ];

  it('direction down: levels are strictly top-to-bottom (root < children < grandchildren)', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 100 };
    const config = baseConfig({ direction: 'down', levelGap: 10, siblingGap: 5, bounds });
    const { childBounds } = layoutTree(nodes, config);

    const [root, child1, child2, gc1, gc2] = childBounds as [
      typeof childBounds[0], typeof childBounds[0], typeof childBounds[0],
      typeof childBounds[0], typeof childBounds[0]
    ];

    // root is at level 0 (smallest y)
    expect(root.y).toBeLessThan(child1.y);
    expect(root.y).toBeLessThan(child2.y);

    // children are at level 1
    expect(child1.y).toBeCloseTo(child2.y, 1);
    expect(child1.y).toBeLessThan(gc1.y);
    expect(child1.y).toBeLessThan(gc2.y);

    // grandchildren are at level 2
    expect(gc1.y).toBeCloseTo(gc2.y, 1);

    assertNoOverlap(childBounds);
    // Assert against the configured bounds (tree centers cross-axis within bounds)
    assertChildrenWithinParent(bounds, childBounds);
  });

  it('direction right: levels are strictly left-to-right', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 100 };
    const config = baseConfig({ direction: 'right', levelGap: 10, siblingGap: 5, bounds });
    const { childBounds } = layoutTree(nodes, config);

    const [root, child1, child2, gc1, gc2] = childBounds as [
      typeof childBounds[0], typeof childBounds[0], typeof childBounds[0],
      typeof childBounds[0], typeof childBounds[0]
    ];

    expect(root.x).toBeLessThan(child1.x);
    expect(root.x).toBeLessThan(child2.x);
    expect(child1.x).toBeCloseTo(child2.x, 1);
    expect(child1.x).toBeLessThan(gc1.x);

    assertNoOverlap(childBounds);
    // Assert against the configured bounds (tree centers cross-axis within bounds)
    assertChildrenWithinParent(bounds, childBounds);
  });

  it('all 5 nodes are positioned', () => {
    const config = baseConfig({ direction: 'down' });
    const { childBounds } = layoutTree(nodes, config);

    expect(childBounds).toHaveLength(5);
    for (const b of childBounds) {
      expect(b.w).toBeGreaterThan(0);
      expect(b.h).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Unbalanced tree
// ---------------------------------------------------------------------------

describe('layoutTree – unbalanced tree', () => {
  // nodes[0] = root,    children: [1, 2]
  // nodes[1] = deepBranch, children: [3]
  // nodes[2] = leaf,    children: []
  // nodes[3] = deepLeaf, children: []
  const nodes = [
    node('root', [1, 2], 10, 10),
    node('deepBranch', [3], 10, 10),
    node('leaf', [], 10, 10),
    node('deepLeaf', [], 10, 10),
  ];

  it('direction down: deepLeaf is deeper than leaf', () => {
    const config = baseConfig({ direction: 'down', levelGap: 10 });
    const { childBounds } = layoutTree(nodes, config);

    const [, , leaf, deepLeaf] = childBounds as [
      typeof childBounds[0], typeof childBounds[0], typeof childBounds[0], typeof childBounds[0]
    ];

    // deepLeaf is at level 2, leaf is at level 1
    expect(deepLeaf.y).toBeGreaterThan(leaf.y);
  });

  it('no nodes overlap', () => {
    const config = baseConfig({ direction: 'down', levelGap: 10, siblingGap: 5 });
    const { childBounds } = layoutTree(nodes, config);

    assertNoOverlap(childBounds);
  });

  it('all nodes remain within the configured bounds', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 100 };
    const config = baseConfig({ direction: 'down', bounds });
    const { childBounds } = layoutTree(nodes, config);

    // Assert against the configured bounds (tree centers cross-axis within bounds)
    assertChildrenWithinParent(bounds, childBounds);
  });
});

// ---------------------------------------------------------------------------
// Container bounds
// ---------------------------------------------------------------------------

describe('layoutTree – container bounds', () => {
  it('container bounds match the configured origin', () => {
    const bounds = { x: 10, y: 20, w: 80, h: 60 };
    const nodes = [node('root', [1], 10, 10), node('child', [], 10, 10)];
    const config = baseConfig({ bounds, direction: 'down' });

    const { containerBounds } = layoutTree(nodes, config);

    expect(containerBounds.x).toBeCloseTo(10, 1);
    expect(containerBounds.y).toBeCloseTo(20, 1);
  });

  it('container w/h do not exceed configured bounds', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 100 };
    const nodes = [
      node('root', [1, 2], 10, 10),
      node('a', [], 10, 10),
      node('b', [], 10, 10),
    ];
    const config = baseConfig({ bounds, direction: 'down' });

    const { containerBounds } = layoutTree(nodes, config);

    expect(containerBounds.w).toBeLessThanOrEqual(bounds.w + 0.01);
    expect(containerBounds.h).toBeLessThanOrEqual(bounds.h + 0.01);
  });
});
