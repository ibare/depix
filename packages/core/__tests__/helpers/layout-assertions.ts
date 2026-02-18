/**
 * Layout invariant assertion helpers for testing layout algorithms.
 *
 * These functions verify spatial relationships between IR elements using
 * vitest's `expect()` for clear, descriptive error messages.
 *
 * @module @depix/core/__tests__/helpers/layout-assertions
 */

import { expect } from 'vitest';
import type { IRBounds } from '../../src/ir/types.js';

// ---------------------------------------------------------------------------
// Containment
// ---------------------------------------------------------------------------

/**
 * Assert all children bounds are within the parent bounds.
 *
 * For each child, verifies:
 * - child.x >= parent.x - tolerance
 * - child.y >= parent.y - tolerance
 * - child.x + child.w <= parent.x + parent.w + tolerance
 * - child.y + child.h <= parent.y + parent.h + tolerance
 *
 * @param parent    - The parent bounding box.
 * @param children  - The child bounding boxes to check.
 * @param tolerance - Floating-point tolerance (default 0.01).
 */
export function assertChildrenWithinParent(
  parent: IRBounds,
  children: IRBounds[],
  tolerance: number = 0.01,
): void {
  const parentRight = parent.x + parent.w;
  const parentBottom = parent.y + parent.h;

  children.forEach((child, i) => {
    const childRight = child.x + child.w;
    const childBottom = child.y + child.h;

    expect(child.x).toBeGreaterThanOrEqual(
      parent.x - tolerance,
      // Additional context message for debugging
    );
    expect(child.y).toBeGreaterThanOrEqual(
      parent.y - tolerance,
    );
    expect(childRight).toBeLessThanOrEqual(
      parentRight + tolerance,
    );
    expect(childBottom).toBeLessThanOrEqual(
      parentBottom + tolerance,
    );
  });
}

// ---------------------------------------------------------------------------
// Overlap detection
// ---------------------------------------------------------------------------

/**
 * Check whether two bounding boxes overlap (intersect).
 *
 * Returns true if the intersection area is greater than zero
 * (accounting for tolerance).
 */
function boundsOverlap(a: IRBounds, b: IRBounds, tolerance: number): boolean {
  const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return overlapX > tolerance && overlapY > tolerance;
}

/**
 * Assert no two children overlap (checking bounding box intersection).
 *
 * For every pair of children, verifies their bounding boxes do not
 * intersect beyond the given tolerance.
 *
 * @param children  - The bounding boxes to check for overlap.
 * @param tolerance - Overlap tolerance in coordinate units (default 0.01).
 */
export function assertNoOverlap(
  children: IRBounds[],
  tolerance: number = 0.01,
): void {
  for (let i = 0; i < children.length; i++) {
    for (let j = i + 1; j < children.length; j++) {
      const overlap = boundsOverlap(children[i]!, children[j]!, tolerance);
      expect(overlap, `children[${i}] and children[${j}] should not overlap`).toBe(false);
    }
  }
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

/**
 * Assert children are ordered in a specific direction.
 *
 * - `right`: each child starts at or after the previous child ends (x-axis).
 * - `down`: each child starts at or after the previous child ends (y-axis).
 *
 * @param children  - The bounding boxes to check (in expected order).
 * @param direction - The expected ordering direction.
 */
export function assertOrderedInDirection(
  children: IRBounds[],
  direction: 'right' | 'down',
): void {
  for (let i = 1; i < children.length; i++) {
    const prev = children[i - 1]!;
    const curr = children[i]!;

    if (direction === 'right') {
      expect(
        curr.x,
        `children[${i}].x should be >= children[${i - 1}].x + children[${i - 1}].w (left-to-right order)`,
      ).toBeGreaterThanOrEqual(prev.x + prev.w - 0.01);
    } else {
      expect(
        curr.y,
        `children[${i}].y should be >= children[${i - 1}].y + children[${i - 1}].h (top-to-bottom order)`,
      ).toBeGreaterThanOrEqual(prev.y + prev.h - 0.01);
    }
  }
}

// ---------------------------------------------------------------------------
// Uniform gap
// ---------------------------------------------------------------------------

/**
 * Assert the gap between consecutive children is uniform (within tolerance).
 *
 * For `row`: measures horizontal gap between child[i].x+w and child[i+1].x
 * For `col`: measures vertical gap between child[i].y+h and child[i+1].y
 *
 * @param children    - The bounding boxes in layout order.
 * @param direction   - The stacking direction (`row` = horizontal, `col` = vertical).
 * @param expectedGap - The expected gap size.
 * @param tolerance   - Allowed deviation from expectedGap (default 0.5).
 */
export function assertUniformGap(
  children: IRBounds[],
  direction: 'row' | 'col',
  expectedGap: number,
  tolerance: number = 0.5,
): void {
  for (let i = 1; i < children.length; i++) {
    const prev = children[i - 1]!;
    const curr = children[i]!;

    const gap =
      direction === 'row'
        ? curr.x - (prev.x + prev.w)
        : curr.y - (prev.y + prev.h);

    expect(gap).toBeGreaterThanOrEqual(expectedGap - tolerance);
    expect(gap).toBeLessThanOrEqual(expectedGap + tolerance);
  }
}

// ---------------------------------------------------------------------------
// Cross-axis alignment
// ---------------------------------------------------------------------------

/**
 * Assert cross-axis alignment of children within a parent.
 *
 * For a `row` layout (main axis = x):
 * - `start`:   all children have the same y as parent.y
 * - `center`:  all children are vertically centered within the parent
 * - `end`:     all children have y+h == parent.y + parent.h
 * - `stretch`: all children have y == parent.y and h == parent.h
 *
 * For a `col` layout (main axis = y):
 * - `start`:   all children have the same x as parent.x
 * - `center`:  all children are horizontally centered within the parent
 * - `end`:     all children have x+w == parent.x + parent.w
 * - `stretch`: all children have x == parent.x and w == parent.w
 *
 * @param children    - The child bounding boxes.
 * @param parentBounds - The parent bounding box.
 * @param align       - The cross-axis alignment to verify.
 * @param direction   - The main-axis direction (`row` or `col`).
 */
export function assertCrossAlignment(
  children: IRBounds[],
  parentBounds: IRBounds,
  align: 'start' | 'center' | 'end' | 'stretch',
  direction: 'row' | 'col',
): void {
  const tolerance = 0.5;

  children.forEach((child, i) => {
    if (direction === 'row') {
      // Cross axis is Y
      switch (align) {
        case 'start':
          expect(child.y).toBeCloseTo(parentBounds.y, 0);
          break;
        case 'center': {
          const parentCenter = parentBounds.y + parentBounds.h / 2;
          const childCenter = child.y + child.h / 2;
          expect(childCenter).toBeCloseTo(parentCenter, 0);
          break;
        }
        case 'end': {
          const childBottom = child.y + child.h;
          const parentBottom = parentBounds.y + parentBounds.h;
          expect(childBottom).toBeCloseTo(parentBottom, 0);
          break;
        }
        case 'stretch':
          expect(child.y).toBeCloseTo(parentBounds.y, 0);
          expect(child.h).toBeCloseTo(parentBounds.h, 0);
          break;
      }
    } else {
      // Cross axis is X
      switch (align) {
        case 'start':
          expect(child.x).toBeCloseTo(parentBounds.x, 0);
          break;
        case 'center': {
          const parentCenter = parentBounds.x + parentBounds.w / 2;
          const childCenter = child.x + child.w / 2;
          expect(childCenter).toBeCloseTo(parentCenter, 0);
          break;
        }
        case 'end': {
          const childRight = child.x + child.w;
          const parentRight = parentBounds.x + parentBounds.w;
          expect(childRight).toBeCloseTo(parentRight, 0);
          break;
        }
        case 'stretch':
          expect(child.x).toBeCloseTo(parentBounds.x, 0);
          expect(child.w).toBeCloseTo(parentBounds.w, 0);
          break;
      }
    }
  });
}
