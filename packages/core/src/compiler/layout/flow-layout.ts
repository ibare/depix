/**
 * Flow Layout Algorithm
 *
 * Simplified Sugiyama-style directed graph layout:
 * 1. Topological sort (Kahn's algorithm)
 * 2. Layer assignment (longest-path)
 * 3. Cross minimization (barycenter heuristic)
 * 4. Position assignment (center within layer)
 *
 * All coordinates are in the 0-100 relative space.
 */

import type { IRBounds } from '../../ir/types.js';
import type {
  FlowLayoutConfig,
  LayoutChild,
  LayoutResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function layoutFlow(
  children: LayoutChild[],
  config: FlowLayoutConfig,
): LayoutResult {
  if (children.length === 0) {
    return {
      containerBounds: { ...config.bounds },
      childBounds: [],
    };
  }

  const { bounds, direction, gap, edges } = config;

  // Build adjacency
  const idToIdx = new Map<string, number>();
  children.forEach((c, i) => idToIdx.set(c.id, i));

  const adj: number[][] = children.map(() => []);
  const inDeg: number[] = new Array(children.length).fill(0);

  for (const e of edges) {
    const from = idToIdx.get(e.fromId);
    const to = idToIdx.get(e.toId);
    if (from !== undefined && to !== undefined) {
      adj[from].push(to);
      inDeg[to]++;
    }
  }

  // 1. Topological sort (Kahn's)
  const order = topoSort(adj, inDeg, children.length);

  // 2. Layer assignment (longest path from sources)
  const layers = assignLayers(order, adj, children.length);
  const maxLayer = Math.max(...layers);
  const layerCount = maxLayer + 1;

  // Group nodes by layer
  const layerGroups: number[][] = Array.from({ length: layerCount }, () => []);
  for (let i = 0; i < children.length; i++) {
    layerGroups[layers[i]].push(i);
  }

  // 3. Cross minimization (barycenter heuristic — one sweep)
  for (let l = 1; l < layerCount; l++) {
    const barycenters = layerGroups[l].map((nodeIdx) => {
      const predecessors: number[] = [];
      for (const src of layerGroups[l - 1]) {
        if (adj[src].includes(nodeIdx)) {
          predecessors.push(layerGroups[l - 1].indexOf(src));
        }
      }
      if (predecessors.length === 0) return 0;
      return predecessors.reduce((a, b) => a + b, 0) / predecessors.length;
    });

    // Sort by barycenter
    const indexed = layerGroups[l].map((nodeIdx, i) => ({
      nodeIdx,
      bc: barycenters[i],
    }));
    indexed.sort((a, b) => a.bc - b.bc);
    layerGroups[l] = indexed.map((x) => x.nodeIdx);
  }

  // 4. Position assignment
  const isHorizontal = direction === 'right' || direction === 'left';
  const isReversed = direction === 'left' || direction === 'up';

  // Max nodes per layer (for cross-axis sizing)
  const maxNodesInLayer = Math.max(...layerGroups.map((g) => g.length));

  // Compute sizes
  const mainAvail = isHorizontal ? bounds.w : bounds.h;
  const crossAvail = isHorizontal ? bounds.h : bounds.w;

  const totalLayerGap = gap * (layerCount - 1);
  const layerMainSize = (mainAvail - totalLayerGap) / layerCount;

  const childBounds: IRBounds[] = new Array(children.length);

  for (let l = 0; l < layerCount; l++) {
    const layer = isReversed ? layerCount - 1 - l : l;
    const nodes = layerGroups[layer];
    const mainOffset = l * (layerMainSize + gap);

    // Position nodes within this layer — space-filling cross-axis
    const totalNodeGap = gap * (nodes.length - 1);
    const nodeCrossSize = (crossAvail - totalNodeGap) / Math.max(nodes.length, 1);
    // Cap single-node layers to prevent excessive cross-axis size
    const cappedCross = nodes.length === 1
      ? Math.min(nodeCrossSize, crossAvail * 0.6)
      : nodeCrossSize;

    const nodesCrossTotal = nodes.length * cappedCross + totalNodeGap;
    const layerCrossStart = (crossAvail - nodesCrossTotal) / 2;
    let crossCursor = Math.max(0, layerCrossStart);

    for (const nodeIdx of nodes) {
      if (isHorizontal) {
        childBounds[nodeIdx] = {
          x: bounds.x + mainOffset,
          y: bounds.y + crossCursor,
          w: layerMainSize,
          h: cappedCross,
        };
      } else {
        childBounds[nodeIdx] = {
          x: bounds.x + crossCursor,
          y: bounds.y + mainOffset,
          w: cappedCross,
          h: layerMainSize,
        };
      }
      crossCursor += cappedCross + gap;
    }
  }

  // Compute container bounds
  const usedW = isHorizontal
    ? layerCount * layerMainSize + totalLayerGap
    : bounds.w;
  const usedH = isHorizontal
    ? bounds.h
    : layerCount * layerMainSize + totalLayerGap;

  return {
    containerBounds: {
      x: bounds.x,
      y: bounds.y,
      w: Math.min(usedW, bounds.w),
      h: Math.min(usedH, bounds.h),
    },
    childBounds,
  };
}

// ---------------------------------------------------------------------------
// Topological sort (Kahn's algorithm)
// ---------------------------------------------------------------------------

function topoSort(
  adj: number[][],
  inDegrees: number[],
  n: number,
): number[] {
  const inDeg = [...inDegrees];
  const queue: number[] = [];
  for (let i = 0; i < n; i++) {
    if (inDeg[i] === 0) queue.push(i);
  }

  const order: number[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const next of adj[node]) {
      inDeg[next]--;
      if (inDeg[next] === 0) queue.push(next);
    }
  }

  // If cycle detected, add remaining nodes at the end
  if (order.length < n) {
    for (let i = 0; i < n; i++) {
      if (!order.includes(i)) order.push(i);
    }
  }

  return order;
}

// ---------------------------------------------------------------------------
// Layer assignment (longest path from sources)
// ---------------------------------------------------------------------------

function assignLayers(
  order: number[],
  adj: number[][],
  n: number,
): number[] {
  const layers = new Array(n).fill(0);

  for (const node of order) {
    for (const next of adj[node]) {
      layers[next] = Math.max(layers[next], layers[node] + 1);
    }
  }

  return layers;
}
