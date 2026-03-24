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

  // 3. Cross minimization (barycenter heuristic — multi-pass forward+backward sweep)
  // Build reverse adjacency for backward sweeps
  const revAdj: number[][] = children.map(() => []);
  for (let from = 0; from < adj.length; from++) {
    for (const to of adj[from]) revAdj[to].push(from);
  }

  // 4 passes = empirically good trade-off between quality and speed.
  // Dimensionless iteration count (no units).
  const CROSS_MIN_PASSES = 4;
  for (let pass = 0; pass < CROSS_MIN_PASSES; pass++) {
    // Forward sweep: order each layer by barycenter of predecessors
    for (let l = 1; l < layerCount; l++) {
      barycenterSortLayer(layerGroups, l, layerGroups[l - 1], adj, 'forward');
    }
    // Backward sweep: order each layer by barycenter of successors
    for (let l = layerCount - 2; l >= 0; l--) {
      barycenterSortLayer(layerGroups, l, layerGroups[l + 1], revAdj, 'backward');
    }
  }

  // 4. Position assignment
  const isHorizontal = direction === 'right' || direction === 'left';
  const isReversed = direction === 'left' || direction === 'up';

  // Compute sizes
  const mainAvail = isHorizontal ? bounds.w : bounds.h;
  const crossAvail = isHorizontal ? bounds.h : bounds.w;

  const totalLayerGap = gap * (layerCount - 1);

  // Per-layer main sizes: read from pre-allocated children widths/heights.
  // computeLayoutChildren provides role-based sizes; fall back to uniform if zero.
  const rawLayerSizes: number[] = new Array(layerCount).fill(0);
  for (let i = 0; i < children.length; i++) {
    const l = layers[i];
    const childMain = isHorizontal ? children[i].width : children[i].height;
    rawLayerSizes[l] = Math.max(rawLayerSizes[l], childMain);
  }
  const fallbackSize = (mainAvail - totalLayerGap) / layerCount;
  for (let l = 0; l < layerCount; l++) {
    if (rawLayerSizes[l] <= 0) rawLayerSizes[l] = fallbackSize;
  }
  // Scale down proportionally if total exceeds available space
  const rawTotalMain = rawLayerSizes.reduce((s, v) => s + v, 0);
  const mainScale = rawTotalMain > 0 && rawTotalMain + totalLayerGap > mainAvail
    ? (mainAvail - totalLayerGap) / rawTotalMain
    : 1;
  const layerMainSizes = mainScale < 1 ? rawLayerSizes.map(v => v * mainScale) : rawLayerSizes;

  // Sizes in position order (reversed direction maps positions to opposite layers)
  const positionMainSizes = Array.from({ length: layerCount }, (_, l) =>
    layerMainSizes[isReversed ? layerCount - 1 - l : l],
  );
  const positionOffsets: number[] = [0];
  for (let l = 1; l < layerCount; l++) {
    positionOffsets.push(positionOffsets[l - 1] + positionMainSizes[l - 1] + gap);
  }

  const childBounds: IRBounds[] = new Array(children.length);

  for (let l = 0; l < layerCount; l++) {
    const layer = isReversed ? layerCount - 1 - l : l;
    const nodes = layerGroups[layer];
    const mainOffset = positionOffsets[l];
    const nodeMainSize = positionMainSizes[l];

    // Use pre-computed cross sizes from children (set by computeLayoutChildren)
    const nodeCrossSizes = nodes.map(nodeIdx =>
      Math.max(isHorizontal ? children[nodeIdx].height : children[nodeIdx].width, 3),
    );
    const totalNodeGap = gap * (nodes.length - 1);
    const nodesCrossTotal = nodeCrossSizes.reduce((s, v) => s + v, 0) + totalNodeGap;
    const layerCrossStart = (crossAvail - nodesCrossTotal) / 2;
    let crossCursor = Math.max(0, layerCrossStart);

    for (let ni = 0; ni < nodes.length; ni++) {
      const nodeIdx = nodes[ni];
      const nodeCross = nodeCrossSizes[ni];
      if (isHorizontal) {
        childBounds[nodeIdx] = {
          x: bounds.x + mainOffset,
          y: bounds.y + crossCursor,
          w: nodeMainSize,
          h: nodeCross,
        };
      } else {
        childBounds[nodeIdx] = {
          x: bounds.x + crossCursor,
          y: bounds.y + mainOffset,
          w: nodeCross,
          h: nodeMainSize,
        };
      }
      crossCursor += nodeCross + gap;
    }
  }

  // Compute container bounds
  const usedMain = layerMainSizes.reduce((s, v) => s + v, 0) + totalLayerGap;
  const usedW = isHorizontal ? usedMain : bounds.w;
  const usedH = isHorizontal ? bounds.h : usedMain;

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

// ---------------------------------------------------------------------------
// Barycenter sort helper (used by multi-pass cross minimization)
// ---------------------------------------------------------------------------

/**
 * Sort nodes in `layerGroups[layerIdx]` by the average position of their
 * connected nodes in `referenceLayer`.
 *
 * @param direction 'forward' uses adj (predecessors→current),
 *                  'backward' uses revAdj (successors→current).
 */
function barycenterSortLayer(
  layerGroups: number[][],
  layerIdx: number,
  referenceLayer: number[],
  adjacency: number[][],
  direction: 'forward' | 'backward',
): void {
  const layer = layerGroups[layerIdx];
  if (layer.length <= 1) return;

  const refPositions = new Map<number, number>();
  for (let i = 0; i < referenceLayer.length; i++) {
    refPositions.set(referenceLayer[i], i);
  }

  const barycenters = layer.map((nodeIdx) => {
    const connected: number[] = [];
    if (direction === 'forward') {
      // Find predecessors: nodes in referenceLayer that have edges to nodeIdx
      for (const ref of referenceLayer) {
        if (adjacency[ref].includes(nodeIdx)) {
          connected.push(refPositions.get(ref) ?? 0);
        }
      }
    } else {
      // Find successors: nodes in referenceLayer that nodeIdx has edges to
      for (const ref of referenceLayer) {
        if (adjacency[ref].includes(nodeIdx)) {
          connected.push(refPositions.get(ref) ?? 0);
        }
      }
    }
    if (connected.length === 0) return 0;
    return connected.reduce((a, b) => a + b, 0) / connected.length;
  });

  const indexed = layer.map((nodeIdx, i) => ({ nodeIdx, bc: barycenters[i] }));
  indexed.sort((a, b) => a.bc - b.bc);
  layerGroups[layerIdx] = indexed.map((x) => x.nodeIdx);
}
