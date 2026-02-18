/**
 * Group Layout Algorithm
 *
 * Simple bounding-box grouping. Computes a container that wraps
 * all children with optional padding. Children retain their
 * relative positions (stacked vertically with gap).
 *
 * All coordinates are in the 0-100 relative space.
 */

import type { IRBounds } from '../../ir/types.js';
import type { GroupLayoutConfig, LayoutChild, LayoutResult } from './types.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function layoutGroup(
  children: LayoutChild[],
  config: GroupLayoutConfig,
): LayoutResult {
  const { bounds, padding } = config;

  if (children.length === 0) {
    return {
      containerBounds: { ...bounds },
      childBounds: [],
    };
  }

  // Available content area after padding
  const contentX = bounds.x + padding;
  const contentY = bounds.y + padding;
  const contentW = bounds.w - padding * 2;
  const contentH = bounds.h - padding * 2;

  // Stack children vertically within padded area
  const gap = 1; // small default gap
  const totalH = children.reduce((s, c) => s + c.height, 0) + gap * (children.length - 1);

  const childBounds: IRBounds[] = [];
  let yOffset = 0;

  for (const child of children) {
    // Center horizontally within content area
    const x = contentX + (contentW - child.width) / 2;

    childBounds.push({
      x: Math.max(contentX, x),
      y: contentY + yOffset,
      w: Math.min(child.width, contentW),
      h: child.height,
    });

    yOffset += child.height + gap;
  }

  // Container fits tightly around children + padding
  const usedH = Math.min(totalH + padding * 2, bounds.h);

  return {
    containerBounds: {
      x: bounds.x,
      y: bounds.y,
      w: bounds.w,
      h: usedH,
    },
    childBounds,
  };
}
