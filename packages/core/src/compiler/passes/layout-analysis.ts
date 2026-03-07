/**
 * Layout Analysis Utilities
 *
 * Shared structure analysis for tree and flow layouts.
 * Used by the budget system and computeLayoutChildren to determine
 * level/layer-based space allocation.
 */

// ---------------------------------------------------------------------------
// Tree Level Analysis
// ---------------------------------------------------------------------------

export interface TreeLevelInfo {
  numLevels: number;
  nodesPerLevel: number[];
  nodeLevel: Map<string, number>;
}

/**
 * Analyse tree structure from node IDs and edges to determine
 * level assignment for each node. Uses BFS from roots.
 */
export function computeTreeLevelInfo(
  nodeIds: string[],
  edges: { fromId: string; toId: string }[],
): TreeLevelInfo {
  if (nodeIds.length === 0) {
    return { numLevels: 0, nodesPerLevel: [], nodeLevel: new Map() };
  }

  const idSet = new Set(nodeIds);
  const childrenOf = new Map<string, string[]>();
  const hasParent = new Set<string>();

  for (const id of nodeIds) {
    childrenOf.set(id, []);
  }

  for (const e of edges) {
    if (idSet.has(e.fromId) && idSet.has(e.toId)) {
      childrenOf.get(e.fromId)!.push(e.toId);
      hasParent.add(e.toId);
    }
  }

  // Find roots (nodes without parents)
  const roots: string[] = [];
  for (const id of nodeIds) {
    if (!hasParent.has(id)) roots.push(id);
  }
  // Fallback: if no roots found, use first node
  if (roots.length === 0) roots.push(nodeIds[0]);

  // BFS level assignment
  const nodeLevel = new Map<string, number>();
  const queue: string[] = [...roots];
  for (const r of roots) nodeLevel.set(r, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const level = nodeLevel.get(current)!;
    for (const child of childrenOf.get(current) ?? []) {
      if (!nodeLevel.has(child)) {
        nodeLevel.set(child, level + 1);
        queue.push(child);
      }
    }
  }

  // Assign unvisited nodes to level 0
  for (const id of nodeIds) {
    if (!nodeLevel.has(id)) nodeLevel.set(id, 0);
  }

  // Compute per-level counts
  let maxLevel = 0;
  for (const level of nodeLevel.values()) {
    if (level > maxLevel) maxLevel = level;
  }
  const numLevels = maxLevel + 1;
  const nodesPerLevel = new Array<number>(numLevels).fill(0);
  for (const level of nodeLevel.values()) {
    nodesPerLevel[level]++;
  }

  return { numLevels, nodesPerLevel, nodeLevel };
}

// ---------------------------------------------------------------------------
// Flow Layer Analysis
// ---------------------------------------------------------------------------

export interface FlowLayerInfo {
  layerCount: number;
  nodesPerLayer: number[];
  nodeLayer: Map<string, number>;
}

/**
 * Analyse flow (DAG) structure using Sugiyama longest-path layer assignment.
 * Replicates the layer assignment logic from flow-layout.ts.
 */
export function computeFlowLayerInfo(
  nodeIds: string[],
  edges: { fromId: string; toId: string }[],
): FlowLayerInfo {
  if (nodeIds.length === 0) {
    return { layerCount: 0, nodesPerLayer: [], nodeLayer: new Map() };
  }

  const n = nodeIds.length;
  const idToIdx = new Map<string, number>();
  nodeIds.forEach((id, i) => idToIdx.set(id, i));

  const adj: number[][] = Array.from({ length: n }, () => []);
  const inDeg: number[] = new Array(n).fill(0);

  for (const e of edges) {
    const from = idToIdx.get(e.fromId);
    const to = idToIdx.get(e.toId);
    if (from !== undefined && to !== undefined) {
      adj[from].push(to);
      inDeg[to]++;
    }
  }

  // Kahn's topological sort
  const order: number[] = [];
  const queue: number[] = [];
  const tempInDeg = [...inDeg];
  for (let i = 0; i < n; i++) {
    if (tempInDeg[i] === 0) queue.push(i);
  }
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const next of adj[node]) {
      tempInDeg[next]--;
      if (tempInDeg[next] === 0) queue.push(next);
    }
  }
  // Add remaining (cycle case)
  if (order.length < n) {
    for (let i = 0; i < n; i++) {
      if (!order.includes(i)) order.push(i);
    }
  }

  // Longest-path layer assignment
  const layers = new Array<number>(n).fill(0);
  for (const node of order) {
    for (const next of adj[node]) {
      layers[next] = Math.max(layers[next], layers[node] + 1);
    }
  }

  // Build result
  let maxLayer = 0;
  for (const l of layers) {
    if (l > maxLayer) maxLayer = l;
  }
  const layerCount = maxLayer + 1;
  const nodesPerLayer = new Array<number>(layerCount).fill(0);
  const nodeLayer = new Map<string, number>();

  for (let i = 0; i < n; i++) {
    nodesPerLayer[layers[i]]++;
    nodeLayer.set(nodeIds[i], layers[i]);
  }

  return { layerCount, nodesPerLayer, nodeLayer };
}
