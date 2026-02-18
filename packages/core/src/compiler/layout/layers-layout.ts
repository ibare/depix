/**
 * Layers Layout Algorithm
 *
 * Divides the available space into equal horizontal bands (layers).
 * Each layer gets the same height. Used for architecture diagrams,
 * technology stacks, etc.
 *
 * All coordinates are in the 0-100 relative space.
 */

import type { IRBounds } from '../../ir/types.js';
import type { LayersLayoutConfig, LayoutChild, LayoutResult } from './types.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function layoutLayers(
  children: LayoutChild[],
  config: LayersLayoutConfig,
): LayoutResult {
  const { bounds, gap } = config;

  if (children.length === 0) {
    return {
      containerBounds: { ...bounds },
      childBounds: [],
    };
  }

  const n = children.length;
  const totalGap = gap * (n - 1);
  const layerHeight = (bounds.h - totalGap) / n;

  const childBounds: IRBounds[] = children.map((child, i) => ({
    x: bounds.x,
    y: bounds.y + i * (layerHeight + gap),
    w: bounds.w,
    h: layerHeight,
  }));

  return {
    containerBounds: { ...bounds },
    childBounds,
  };
}
