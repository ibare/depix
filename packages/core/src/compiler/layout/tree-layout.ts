/**
 * Tree Layout Algorithm
 *
 * Simplified Reingold-Tilford style hierarchical tree layout.
 * Positions parent nodes centered above (or beside) their children.
 *
 * Input: A flat array of TreeNode objects where each node references
 * children by index. The root is always index 0.
 *
 * All coordinates are in the 0-100 relative space.
 */

import type { IRBounds } from '../../ir/types.js';
import type { LayoutResult, TreeLayoutConfig, TreeNode } from './types.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function layoutTree(
  nodes: TreeNode[],
  config: TreeLayoutConfig,
): LayoutResult {
  if (nodes.length === 0) {
    return {
      containerBounds: { ...config.bounds },
      childBounds: [],
    };
  }

  const { bounds, direction, levelGap, siblingGap } = config;
  const isHorizontal = direction === 'right' || direction === 'left';
  const isReversed = direction === 'up' || direction === 'left';

  // Phase 1: Compute subtree widths (cross-axis span for each subtree)
  const subtreeSpan = new Array<number>(nodes.length).fill(0);
  computeSubtreeSpan(0, nodes, subtreeSpan, siblingGap, isHorizontal);

  // Phase 2: Compute level depths (main-axis)
  const levels = new Array<number>(nodes.length).fill(0);
  computeLevels(0, nodes, levels, 0);
  const maxLevel = Math.max(...levels);

  // Compute main-axis size per level
  const levelMainSizes: number[] = new Array(maxLevel + 1).fill(0);
  for (let i = 0; i < nodes.length; i++) {
    const mainSize = isHorizontal ? nodes[i].width : nodes[i].height;
    levelMainSizes[levels[i]] = Math.max(levelMainSizes[levels[i]], mainSize);
  }

  // Phase 3: Assign positions
  const positions = new Array<{ main: number; cross: number }>(nodes.length);
  const totalCrossSpan = subtreeSpan[0];

  // Scale to fit within bounds
  const totalMainGaps = levelGap * maxLevel;
  const totalMainContent = levelMainSizes.reduce((a, b) => a + b, 0);
  const totalMainNeeded = totalMainContent + totalMainGaps;

  const mainAvail = isHorizontal ? bounds.w : bounds.h;
  const crossAvail = isHorizontal ? bounds.h : bounds.w;

  // Scale-down only: preserve computed sizes (golden ratio), leave extra as whitespace
  const mainScale = totalMainNeeded > mainAvail ? mainAvail / totalMainNeeded : 1;
  const crossScale = totalCrossSpan > crossAvail ? crossAvail / totalCrossSpan : 1;

  // Assign positions recursively
  assignPositions(
    0, nodes, levels, subtreeSpan, levelMainSizes,
    positions, 0, 0, levelGap, siblingGap, isHorizontal,
    mainScale, crossScale,
  );

  // Center the tree within available space when it doesn't fill the full main axis
  // (e.g. when max constraints cap node sizes, leaving surplus whitespace)
  const mainCenterOffset = Math.max(0, (mainAvail - totalMainNeeded * mainScale) / 2);

  // Build child bounds
  const childBounds: IRBounds[] = nodes.map((node, i) => {
    let mainPos = positions[i].main + mainCenterOffset;
    let crossPos = positions[i].cross;

    // Flip for reversed directions
    if (isReversed) {
      const totalMain = (totalMainNeeded * mainScale);
      mainPos = totalMain + mainCenterOffset - positions[i].main - (isHorizontal ? node.width : node.height) * mainScale;
    }

    // Center within available bounds
    const crossOffset = (crossAvail - totalCrossSpan * crossScale) / 2;

    if (isHorizontal) {
      return {
        x: bounds.x + mainPos,
        y: bounds.y + crossPos + Math.max(0, crossOffset),
        w: node.width * mainScale,
        h: node.height * crossScale,
      };
    } else {
      return {
        x: bounds.x + crossPos + Math.max(0, crossOffset),
        y: bounds.y + mainPos,
        w: node.width * crossScale,
        h: node.height * mainScale,
      };
    }
  });

  // Container bounds
  const usedMain = totalMainNeeded * mainScale;
  const usedCross = totalCrossSpan * crossScale;

  return {
    containerBounds: {
      x: bounds.x,
      y: bounds.y,
      w: isHorizontal ? Math.min(usedMain, bounds.w) : Math.min(usedCross, bounds.w),
      h: isHorizontal ? Math.min(usedCross, bounds.h) : Math.min(usedMain, bounds.h),
    },
    childBounds,
  };
}

// ---------------------------------------------------------------------------
// Phase 1: Compute subtree spans (cross-axis)
// ---------------------------------------------------------------------------

function computeSubtreeSpan(
  nodeIdx: number,
  nodes: TreeNode[],
  spans: number[],
  siblingGap: number,
  isHorizontal: boolean,
): void {
  const node = nodes[nodeIdx];

  if (node.children.length === 0) {
    spans[nodeIdx] = isHorizontal ? node.height : node.width;
    return;
  }

  let total = 0;
  for (let i = 0; i < node.children.length; i++) {
    const childIdx = node.children[i];
    computeSubtreeSpan(childIdx, nodes, spans, siblingGap, isHorizontal);
    total += spans[childIdx];
    if (i > 0) total += siblingGap;
  }

  const selfCross = isHorizontal ? node.height : node.width;
  spans[nodeIdx] = Math.max(total, selfCross);
}

// ---------------------------------------------------------------------------
// Phase 2: Compute levels (depth)
// ---------------------------------------------------------------------------

function computeLevels(
  nodeIdx: number,
  nodes: TreeNode[],
  levels: number[],
  depth: number,
): void {
  levels[nodeIdx] = depth;
  for (const childIdx of nodes[nodeIdx].children) {
    computeLevels(childIdx, nodes, levels, depth + 1);
  }
}

// ---------------------------------------------------------------------------
// Phase 3: Assign positions
// ---------------------------------------------------------------------------

function assignPositions(
  nodeIdx: number,
  nodes: TreeNode[],
  levels: number[],
  spans: number[],
  levelMainSizes: number[],
  positions: { main: number; cross: number }[],
  mainOffset: number,
  crossOffset: number,
  levelGap: number,
  siblingGap: number,
  isHorizontal: boolean,
  mainScale: number,
  crossScale: number,
): void {
  const node = nodes[nodeIdx];
  const level = levels[nodeIdx];

  // Main-axis position: sum of previous level sizes + gaps
  let main = 0;
  for (let l = 0; l < level; l++) {
    main += levelMainSizes[l] + levelGap;
  }

  // Cross-axis: center self within subtree span
  const selfCross = isHorizontal ? node.height : node.width;
  const subtreeSpan = spans[nodeIdx];
  const centerOffset = (subtreeSpan - selfCross) / 2;

  positions[nodeIdx] = {
    main: main * mainScale,
    cross: (crossOffset + centerOffset) * crossScale,
  };

  // Position children
  let childCross = crossOffset;
  for (const childIdx of node.children) {
    assignPositions(
      childIdx, nodes, levels, spans, levelMainSizes,
      positions, 0, childCross, levelGap, siblingGap, isHorizontal,
      mainScale, crossScale,
    );
    childCross += spans[childIdx] + siblingGap;
  }
}
