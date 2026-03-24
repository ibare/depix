/**
 * Compiler Pass — Allocate Bounds
 *
 * Top-down space allocation: the parent gives each child a portion of its
 * available space proportional to the child's weight. Block children are
 * laid out using the existing layout algorithms; leaf elements receive
 * the allocated space (filling the parent's allocation).
 *
 * Pipeline: DiagramLayoutPlan + canvasBounds → BoundsMap
 */

import type { IRBounds } from '../../ir/types.js';
import type { DepixTheme } from '../../theme/types.js';
import type { ASTEdge } from '../ast.js';
import { layoutStack } from '../layout/stack-layout.js';
import { layoutGrid } from '../layout/grid-layout.js';
import { layoutFlow } from '../layout/flow-layout.js';
import { layoutTree } from '../layout/tree-layout.js';
import { layoutGroup } from '../layout/group-layout.js';
import { layoutLayers } from '../layout/layers-layout.js';
import { layoutTable } from '../layout/table-layout.js';
import { layoutChart } from '../layout/chart-layout.js';
import type {
  LayoutChild,
  LayoutResult,
  TreeNode,
} from '../layout/types.js';
import type { LayoutPlanNode, DiagramLayoutPlan } from './plan-layout.js';
import type { MeasureMap } from './measure.js';
import type { ConstraintMap } from './budget-types.js';
import type { ScaleContext } from './scale-system.js';
import { computeGap, computePadding, computeFontSize } from './scale-system.js';
import { computeTreeLevelInfo, computeFlowLayerInfo } from './layout-analysis.js';
import {
  analyzeFlowRoles, roleWeight,
  distributeByWeights, applyAccentPattern,
} from './structural-roles.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max width:height ratio for shape elements inside a box (col layout). */
const MAX_SHAPE_ASPECT = 3.0;

/** 황금비(golden ratio). flow/tree 노드의 cross-axis 크기를 main-axis 기준으로 산출.
 *  수평: idealCross = main / PHI, 수직: idealCross = main * PHI. 단위: 무차원 비율. */
const PHI = 1.618;

/** Tree 레벨 간격 배율. connectorGap 대비 2배 적용하여 레벨 간 시각적 계층 분리 확보.
 *  Tree는 flow 대비 레벨 간 시각적 분리가 중요(수직 계층 구조). 단위: 무차원 배율. */
export const TREE_LEVEL_GAP_SCALE = 2;

/** Preferred w:h ratio for strict-ratio shapes. Others use MAX_SHAPE_ASPECT fallback. */
const SHAPE_PREFERRED_RATIO: Readonly<Record<string, number>> = {
  diamond: 1.6,
  circle: 1.0,
  hexagon: 1.15,
};

const SHAPE_ELEMENT_TYPES: ReadonlySet<string> = new Set([
  'node', 'cell', 'rect', 'circle', 'badge', 'icon', 'diamond', 'hexagon',
]);

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type BoundsMap = Map<string, IRBounds>;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Allocate bounds for every node in a scene plan.
 *
 * Returns a BoundsMap keyed by node id containing computed IRBounds.
 * Also stores container bounds under each block's id.
 */
export function allocateDiagram(
  plan: DiagramLayoutPlan,
  canvasBounds: IRBounds,
  _theme: DepixTheme,
  scaleCtx?: ScaleContext,
  measureMap?: MeasureMap,
  constraintMap?: ConstraintMap,
): BoundsMap {
  const boundsMap: BoundsMap = new Map();

  if (plan.children.length === 0) return boundsMap;

  const gap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'sectionGap') : 3;
  const usableHeight = canvasBounds.h - gap * (plan.children.length - 1);

  // When measureMap is available, enforce minimum heights from measurements.
  // First pass: compute weight-based heights, then clamp to minHeight.
  const rawHeights: number[] = [];
  const minHeights: number[] = [];
  for (const child of plan.children) {
    const fraction = plan.totalWeight > 0 ? child.weight / plan.totalWeight : 1 / plan.children.length;
    rawHeights.push(usableHeight * fraction);
    const m = measureMap?.get(child.id);
    minHeights.push(m ? m.minHeight : 0);
  }

  // Redistribute: clamp each child to its minHeight, then redistribute surplus
  // (overflow compression is handled inside redistributeWithMinimums)
  const finalHeights = redistributeWithMinimums(rawHeights, minHeights, usableHeight);

  let currentY = canvasBounds.y;
  for (let i = 0; i < plan.children.length; i++) {
    const childBounds: IRBounds = {
      x: canvasBounds.x,
      y: currentY,
      w: canvasBounds.w,
      h: finalHeights[i],
    };

    allocateNode(plan.children[i], childBounds, boundsMap, scaleCtx, measureMap, constraintMap);
    currentY += finalHeights[i] + gap;
  }

  return boundsMap;
}

// ---------------------------------------------------------------------------
// Internal: recursive allocation
// ---------------------------------------------------------------------------

function allocateNode(
  plan: LayoutPlanNode,
  availBounds: IRBounds,
  boundsMap: BoundsMap,
  scaleCtx?: ScaleContext,
  measureMap?: MeasureMap,
  constraintMap?: ConstraintMap,
): void {
  if (plan.astNode.kind === 'block') {
    allocateBlock(plan, availBounds, boundsMap, scaleCtx, measureMap, constraintMap);
  } else {
    allocateLeaf(plan, availBounds, boundsMap, scaleCtx, measureMap);
  }
}

/**
 * Allocate bounds for a leaf element (non-block).
 *
 * Uses the available bounds from the parent allocation.
 * Elements with explicit size props (width/height) honour those values.
 */
function allocateLeaf(
  plan: LayoutPlanNode,
  availBounds: IRBounds,
  boundsMap: BoundsMap,
  scaleCtx?: ScaleContext,
  measureMap?: MeasureMap,
): void {
  const node = plan.astNode;
  const hasExplicitW = node.kind === 'element' && typeof node.props.width === 'number';
  const hasExplicitH = node.kind === 'element' && typeof node.props.height === 'number';

  // Use measure minimums as lower bounds
  const m = measureMap?.get(plan.id);
  const minW = m ? m.minWidth : 0;
  const minH = m ? m.minHeight : 0;

  const bounds: IRBounds = {
    x: availBounds.x,
    y: availBounds.y,
    w: hasExplicitW ? plan.intrinsicSize.width : Math.max(availBounds.w, minW),
    h: hasExplicitH ? plan.intrinsicSize.height : Math.max(availBounds.h, minH),
  };

  boundsMap.set(plan.id, bounds);

  // Handle children of box/layer/shape-with-children
  if (plan.children.length > 0) {
    const mParent = measureMap?.get(plan.id);
    const padding = mParent ? mParent.padding : (scaleCtx ? computePadding(scaleCtx.baseUnit) : 2);
    const childGap = mParent ? mParent.childGap : (scaleCtx ? computeGap(scaleCtx.baseUnit, 'childGap') : 1);

    // Reserve space for title and subtitle (box/layer elements)
    let headerOffset = 0;
    if (mParent?.titleHeight) {
      headerOffset += mParent.titleHeight + childGap;
    }
    if (mParent?.subtitleHeight) {
      headerOffset += mParent.subtitleHeight + childGap;
    }

    const innerBounds: IRBounds = {
      x: bounds.x + padding,
      y: bounds.y + padding + headerOffset,
      w: Math.max(bounds.w - padding * 2, 1),
      h: Math.max(bounds.h - padding * 2 - headerOffset, 1),
    };
    const childCount = plan.children.length;
    const childUsable = innerBounds.h - childGap * Math.max(childCount - 1, 0);

    // Collect min heights and weight-based heights, then redistribute
    const rawHeights: number[] = [];
    const childMinHeights: number[] = [];
    const totalChildWeight = plan.children.reduce((s, c) => s + c.weight, 0);
    for (const child of plan.children) {
      const fraction = totalChildWeight > 0 ? child.weight / totalChildWeight : 1 / childCount;
      rawHeights.push(childUsable * fraction);
      const cm = measureMap?.get(child.id);
      childMinHeights.push(cm ? cm.minHeight : 0);
    }
    const finalHeights = redistributeWithMinimums(rawHeights, childMinHeights, childUsable);

    let childY = innerBounds.y;
    for (let i = 0; i < plan.children.length; i++) {
      const ch = plan.children[i];
      const { w: childW, x: childX } = applyShapeAspect(ch, innerBounds, finalHeights[i]);
      const childBounds: IRBounds = {
        x: childX,
        y: childY,
        w: childW,
        h: finalHeights[i],
      };
      boundsMap.set(ch.id, childBounds);
      childY += finalHeights[i] + childGap;
    }
  }
}

function allocateBlock(
  plan: LayoutPlanNode,
  availBounds: IRBounds,
  boundsMap: BoundsMap,
  scaleCtx?: ScaleContext,
  measureMap?: MeasureMap,
  constraintMap?: ConstraintMap,
): void {
  const block = plan.astNode;
  if (block.kind !== 'block') return;

  const blockType = block.blockType;
  const props = block.props;

  // Build LayoutChild[] with sizes proportional to available bounds
  const layoutChildren = computeLayoutChildren(plan, availBounds, scaleCtx, measureMap, constraintMap);

  // Run the appropriate layout algorithm
  const layoutResult = runLayout(
    blockType,
    layoutChildren,
    props,
    availBounds,
    plan.edges,
    scaleCtx,
  );

  // Store container bounds
  boundsMap.set(plan.id, layoutResult.containerBounds);

  // Recurse into children
  for (let i = 0; i < plan.children.length; i++) {
    const childPlan = plan.children[i];
    const childBounds = layoutResult.childBounds[i];

    if (childPlan.astNode.kind === 'block') {
      allocateNode(childPlan, childBounds, boundsMap, scaleCtx, measureMap, constraintMap);
    } else {
      // For flow/tree blocks, apply shape aspect ratio to leaf elements
      const isConnectionBlock = blockType === 'flow' || blockType === 'tree';
      const finalBounds = isConnectionBlock
        ? applyShapeAspectToBounds(childPlan, childBounds)
        : childBounds;
      boundsMap.set(childPlan.id, finalBounds);

      // Handle nested children (box/layer elements with children)
      if (childPlan.children.length > 0) {
        const mParent = measureMap?.get(childPlan.id);
        const padding = mParent ? mParent.padding : (scaleCtx ? computePadding(scaleCtx.baseUnit) : 2);
        const childGap = mParent ? mParent.childGap : (scaleCtx ? computeGap(scaleCtx.baseUnit, 'childGap') : 1);

        // Reserve space for title and subtitle
        let headerOffset = 0;
        if (mParent?.titleHeight) {
          headerOffset += mParent.titleHeight + childGap;
        }
        if (mParent?.subtitleHeight) {
          headerOffset += mParent.subtitleHeight + childGap;
        }

        const innerBounds: IRBounds = {
          x: finalBounds.x + padding,
          y: finalBounds.y + padding + headerOffset,
          w: Math.max(finalBounds.w - padding * 2, 1),
          h: Math.max(finalBounds.h - padding * 2 - headerOffset, 1),
        };
        const gcCount = childPlan.children.length;
        const gcUsable = innerBounds.h - childGap * Math.max(gcCount - 1, 0);

        // Redistribute grandchild heights with measure minimums
        const gcRawHeights: number[] = [];
        const gcMinHeights: number[] = [];
        const gcTotalWeight = childPlan.children.reduce((s, c) => s + c.weight, 0);
        for (const grandchild of childPlan.children) {
          const fraction = gcTotalWeight > 0 ? grandchild.weight / gcTotalWeight : 1 / gcCount;
          gcRawHeights.push(gcUsable * fraction);
          const gm = measureMap?.get(grandchild.id);
          gcMinHeights.push(gm ? gm.minHeight : 0);
        }
        const gcFinalHeights = redistributeWithMinimums(gcRawHeights, gcMinHeights, gcUsable);

        let childY = innerBounds.y;
        for (let j = 0; j < childPlan.children.length; j++) {
          const gc = childPlan.children[j];
          const { w: gcW, x: gcX } = applyShapeAspect(gc, innerBounds, gcFinalHeights[j]);
          const gcBounds: IRBounds = {
            x: gcX,
            y: childY,
            w: gcW,
            h: gcFinalHeights[j],
          };
          boundsMap.set(gc.id, gcBounds);
          childY += gcFinalHeights[j] + childGap;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Block-type-aware child sizing
// ---------------------------------------------------------------------------

/**
 * Compute LayoutChild sizes for a block's children based on the block type
 * and available bounds. This is the core of the top-down space allocation.
 *
 * - stack col: full width, height proportional to weight
 * - stack row: full height, width proportional to weight
 * - grid: uniform cell sizes (bounds ÷ cols/rows)
 * - flow/tree: weight-based area allocation with aspect hint
 * - layers: full width, uniform height
 * - group: stacked vertically with padding, proportional height
 */
export function computeLayoutChildren(
  plan: LayoutPlanNode,
  bounds: IRBounds,
  scaleCtx?: ScaleContext,
  measureMap?: MeasureMap,
  constraintMap?: ConstraintMap,
): LayoutChild[] {
  const block = plan.astNode;
  if (block.kind !== 'block') return [];

  const props = block.props;
  const n = plan.children.length;
  if (n === 0) return [];

  const totalWeight = plan.children.reduce((s, c) => s + c.weight, 0);
  const defaultGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'siblingGap') : 3;
  const gap = typeof props.gap === 'number' ? props.gap : defaultGap;

  switch (block.blockType) {
    case 'stack': {
      const dir = (props.direction as string) ?? 'col';
      if (dir === 'row') {
        const usable = bounds.w - gap * Math.max(n - 1, 0);
        const rawWidths = plan.children.map(c => {
          const hasExplicitW = c.astNode.kind === 'element' && typeof c.astNode.props.width === 'number';
          return hasExplicitW ? c.intrinsicSize.width : (totalWeight > 0 ? usable * (c.weight / totalWeight) : usable / n);
        });
        const minWidths = plan.children.map(c => {
          const m = measureMap?.get(c.id);
          return m ? m.minWidth : 0;
        });
        const finalWidths = redistributeWithMinimums(rawWidths, minWidths, usable);
        return plan.children.map((c, i) => {
          const cc = constraintMap?.get(c.id);
          const maxW = cc?.maxWidth ?? Infinity;
          return { id: c.id, width: Math.min(finalWidths[i], maxW), height: bounds.h };
        });
      } else {
        const usable = bounds.h - gap * Math.max(n - 1, 0);

        // Flex model: text/divider leaves get a content-natural height; blocks/shapes share the remainder.
        // Mirrors CSS flexbox: fixed items shrink-0, flexible items grow into remaining space.

        // TEXT_BLOCK_MULTIPLIER: 텍스트 자연 높이 = fontSize × 배율.
        // 1.8 = line-height 기본값(1.4) + 상하 여백 여유(0.4). measure.ts의 TEXT_BLOCK_MULTIPLIER와 동일한 값.
        // 단위: 0–100 상대 좌표 기준 fontSize에 곱하는 무차원 배율.
        const TEXT_BLOCK_MULTIPLIER = 1.8;
        // textNaturalH 폴백(6): scaleCtx 없을 때 baseUnit ≈ 10 가정 시
        // computeFontSize(10, 'standaloneText') = 10 × 0.25 = 2.5, × 1.8 ≈ 4.5.
        // 안전 여유를 포함해 6으로 설정. 단위: 0–100 상대 좌표.
        const textNaturalH = scaleCtx
          ? computeFontSize(scaleCtx.baseUnit, 'standaloneText') * TEXT_BLOCK_MULTIPLIER
          : 6;

        const naturalHeights: (number | null)[] = plan.children.map(c => {
          const m = measureMap?.get(c.id);
          if (m) return m.minHeight; // measured minHeight takes priority
          if (c.nodeType === 'element-text' || c.nodeType === 'element-divider') {
            return textNaturalH; // text leaf → natural content height
          }
          return null; // block or shape → flex (share of remaining)
        });

        const fixedSum = naturalHeights.reduce<number>((s, h) => s + (h ?? 0), 0);
        const flexItems = plan.children.filter((_, i) => naturalHeights[i] === null);
        const flexWeight = flexItems.reduce((s, c) => s + c.weight, 0);
        const remaining = Math.max(usable - fixedSum, 0);

        return plan.children.map((c, i) => {
          const cc = constraintMap?.get(c.id);
          const maxH = cc?.maxHeight ?? Infinity;
          const rawH = naturalHeights[i] !== null
            ? naturalHeights[i]!
            : flexWeight > 0 ? remaining * (c.weight / flexWeight) : remaining / Math.max(flexItems.length, 1);
          return { id: c.id, width: bounds.w, height: Math.min(rawH, maxH) };
        });
      }
    }

    case 'grid': {
      const cols = typeof props.cols === 'number' ? props.cols : 2;
      const rows = Math.ceil(n / cols);
      const cellW = (bounds.w - gap * Math.max(cols - 1, 0)) / cols;
      const cellH = (bounds.h - gap * Math.max(rows - 1, 0)) / rows;
      return plan.children.map(c => ({
        id: c.id,
        width: cellW,
        height: cellH,
      }));
    }

    case 'flow': {
      const defaultFlowGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'connectorGap') : 5;
      const flowGap = typeof props.gap === 'number' ? props.gap : defaultFlowGap;
      const dir = (props.direction as string) ?? 'right';
      const isHorizontal = dir === 'right' || dir === 'left';
      const mainAxis = isHorizontal ? bounds.w : bounds.h;
      const crossAxis = isHorizontal ? bounds.h : bounds.w;

      const nodeIds = plan.children.map(c => c.id);
      const layerInfo = computeFlowLayerInfo(nodeIds, plan.edges);
      const layerCount = Math.max(layerInfo.layerCount, 1);
      const mainUsable = mainAxis - flowGap * Math.max(layerCount - 1, 0);

      // Role-based layer sizing: entry(S) / transform(M) / terminal(S) / junction(M)
      const roles = analyzeFlowRoles(nodeIds, plan.edges);
      const rawWeights = plan.children.map(c => roleWeight(roles.get(c.id) ?? 'leaf', c));
      const accentedWeights = applyAccentPattern(rawWeights);
      const layerWeights: number[] = new Array(layerCount).fill(0);
      plan.children.forEach((c, i) => {
        const layer = layerInfo.nodeLayer.get(c.id) ?? 0;
        layerWeights[layer] = Math.max(layerWeights[layer], accentedWeights[i]);
      });
      const layerMainSizes = distributeByWeights(layerWeights, mainUsable);

      // Cross-axis: per-layer golden-ratio cap (orientation-aware)
      const maxNodesInAnyLayer = Math.max(...layerInfo.nodesPerLayer, 1);
      const referenceCross = (crossAxis - flowGap * Math.max(maxNodesInAnyLayer - 1, 0)) / Math.max(maxNodesInAnyLayer, 1);

      return plan.children.map(c => {
        const layer = layerInfo.nodeLayer.get(c.id) ?? 0;
        const layerMain = layerMainSizes[layer];

        // Shape-specific preferred ratio (circle=1:1, diamond=1.6:1); default = PHI
        const elementType = c.astNode.kind === 'element' ? c.astNode.elementType : '';
        const preferredRatio = SHAPE_PREFERRED_RATIO[elementType] ?? PHI;
        const idealCross = isHorizontal
          ? (layerMain / preferredRatio)
          : (layerMain * preferredRatio);
        const cappedCross = Math.min(referenceCross, idealCross);

        const cc = constraintMap?.get(c.id);
        const maxW = cc?.maxWidth ?? Infinity;
        const maxH = cc?.maxHeight ?? Infinity;

        if (isHorizontal) {
          return { id: c.id, width: Math.min(Math.max(layerMain, 4), maxW), height: Math.min(Math.max(cappedCross, 3), maxH) };
        }
        return { id: c.id, width: Math.min(Math.max(cappedCross, 4), maxW), height: Math.min(Math.max(layerMain, 3), maxH) };
      });
    }

    case 'tree': {
      const defaultLevelGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'connectorGap') : 5;
      const levelGap = typeof props.gap === 'number' ? props.gap : defaultLevelGap;
      const siblingGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'siblingGap') : 3;
      const dir = (props.direction as string) ?? 'down';
      const isHorizontal = dir === 'right' || dir === 'left';
      const mainAxis = isHorizontal ? bounds.w : bounds.h;
      const crossAxis = isHorizontal ? bounds.h : bounds.w;

      const nodeIds = plan.children.map(c => c.id);
      const levelInfo = computeTreeLevelInfo(nodeIds, plan.edges);
      const numLevels = Math.max(levelInfo.numLevels, 1);

      // Uniform level heights — hierarchy conveyed by position, not size
      const treeLevelGap = levelGap * TREE_LEVEL_GAP_SCALE;
      const mainUsable = mainAxis - treeLevelGap * Math.max(numLevels - 1, 0);
      const uniformLevelMain = mainUsable / numLevels;

      // Dense levels auto-shrink to maintain golden ratio with available cross space
      const levelMainSizes: number[] = [];
      for (let l = 0; l < numLevels; l++) {
        const nodesAtLevel = levelInfo.nodesPerLevel[l] ?? 1;
        const lvlCross = (crossAxis - siblingGap * Math.max(nodesAtLevel - 1, 0)) / Math.max(nodesAtLevel, 1);
        const maxMainFromCross = isHorizontal ? lvlCross * PHI : lvlCross / PHI;
        levelMainSizes.push(Math.min(uniformLevelMain, maxMainFromCross));
      }

      // Per-level golden-ratio cross sizing
      return plan.children.map(c => {
        const level = levelInfo.nodeLevel.get(c.id) ?? 0;
        const nodeMain = levelMainSizes[level] ?? mainUsable / Math.max(levelInfo.numLevels, 1);
        const nodesAtLevel = levelInfo.nodesPerLevel[level] ?? 1;
        const levelCrossAvail = (crossAxis - siblingGap * Math.max(nodesAtLevel - 1, 0)) / Math.max(nodesAtLevel, 1);
        const elementType = c.astNode.kind === 'element' ? c.astNode.elementType : '';
        const preferredRatio = SHAPE_PREFERRED_RATIO[elementType] ?? PHI;
        const idealCross = isHorizontal
          ? (nodeMain / preferredRatio)
          : (nodeMain * preferredRatio);
        const nodeCross = Math.min(levelCrossAvail, idealCross);

        const cc = constraintMap?.get(c.id);
        const maxW = cc?.maxWidth ?? Infinity;
        const maxH = cc?.maxHeight ?? Infinity;

        if (isHorizontal) {
          return { id: c.id, width: Math.min(Math.max(nodeMain, 4), maxW), height: Math.min(Math.max(nodeCross, 3), maxH) };
        }
        return { id: c.id, width: Math.min(Math.max(nodeCross, 4), maxW), height: Math.min(Math.max(nodeMain, 3), maxH) };
      });
    }

    case 'layers': {
      const defaultLayerGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'siblingGap') : 2;
      const layerGap = typeof props.gap === 'number' ? props.gap : defaultLayerGap;
      const layerH = (bounds.h - layerGap * Math.max(n - 1, 0)) / n;
      return plan.children.map(c => {
        const cc = constraintMap?.get(c.id);
        const maxH = cc?.maxHeight ?? Infinity;
        return { id: c.id, width: bounds.w, height: Math.min(layerH, maxH) };
      });
    }

    case 'group': {
      const defaultPadding = scaleCtx ? computePadding(scaleCtx.baseUnit) : 3;
      const padding = typeof props.padding === 'number' ? props.padding : defaultPadding;
      const innerH = bounds.h - padding * 2;
      const innerW = bounds.w - padding * 2;
      const usable = innerH - gap * Math.max(n - 1, 0);
      return plan.children.map(c => {
        const cc = constraintMap?.get(c.id);
        const maxH = cc?.maxHeight ?? Infinity;
        const rawH = totalWeight > 0 ? usable * (c.weight / totalWeight) : usable / n;
        return { id: c.id, width: innerW, height: Math.min(rawH, maxH) };
      });
    }

    case 'table': {
      // Table: all rows get full width, equal height
      const tableGap = gap * 0.3;
      const usable = bounds.h - tableGap * Math.max(n - 1, 0);
      const rowH = usable / n;
      return plan.children.map(c => ({
        id: c.id,
        width: bounds.w,
        height: rowH,
      }));
    }

    case 'chart': {
      // Chart: children represent bar data points
      // Height encodes the numeric value for the chart layout algorithm
      const chartGap = gap * 0.5;
      const barW = (bounds.w - chartGap * Math.max(n - 1, 0)) / n;
      return plan.children.map(c => {
        // Extract numeric value from row element (first non-header numeric cell)
        const ast = c.astNode;
        let value = 1;
        if (ast.kind === 'element' && ast.values) {
          const numericVal = ast.values.find(v => typeof v === 'number');
          if (typeof numericVal === 'number') value = numericVal;
        }
        return { id: c.id, width: barW, height: value };
      });
    }

    case 'box':
    case 'layer': {
      // Visual containers: compact stacking — each child gets its min height, no surplus redistribution
      return plan.children.map(c => {
        const hasExplicitH = c.astNode.kind === 'element' && typeof c.astNode.props.height === 'number';
        const m = measureMap?.get(c.id);
        const h = hasExplicitH ? c.intrinsicSize.height : (m ? m.minHeight : c.intrinsicSize.height || 4);
        return { id: c.id, width: bounds.w, height: h };
      });
    }

    case 'canvas':
    default: {
      // canvas/default: stack col behaviour
      const usable = bounds.h - gap * Math.max(n - 1, 0);
      return plan.children.map(c => ({
        id: c.id,
        width: bounds.w,
        height: totalWeight > 0 ? usable * (c.weight / totalWeight) : usable / n,
      }));
    }
  }
}

// ---------------------------------------------------------------------------
// Layout dispatch (moved from emit-ir.ts)
// ---------------------------------------------------------------------------

export function runLayout(
  blockType: string,
  children: LayoutChild[],
  props: Record<string, string | number>,
  bounds: IRBounds,
  edges: ASTEdge[],
  scaleCtx?: ScaleContext,
): LayoutResult {
  const defaultGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'siblingGap') : 3;
  const gap = typeof props.gap === 'number' ? props.gap : defaultGap;

  switch (blockType) {
    case 'stack':
      return layoutStack(children, {
        bounds,
        direction: (props.direction as 'row' | 'col') ?? 'col',
        gap,
        align: (props.align as 'start' | 'center' | 'end' | 'stretch') ?? 'stretch',
        wrap: props.wrap === 'true' || props.wrap === 1,
      });

    case 'grid':
      return layoutGrid(children, {
        bounds,
        cols: typeof props.cols === 'number' ? props.cols : 2,
        gap,
      });

    case 'flow': {
      const flowEdges = edges.map(e => ({ fromId: e.fromId, toId: e.toId }));
      const defaultFlowGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'connectorGap') : 5;
      const baseGap = typeof props.gap === 'number' ? props.gap : defaultFlowGap;
      const dir = (props.direction as 'right' | 'left' | 'down' | 'up') ?? 'right';
      const isHz = dir === 'right' || dir === 'left';
      const mainAvail = isHz ? bounds.w : bounds.h;
      // When edges exist, ensure gap is proportional to available space
      const flowGap = flowEdges.length > 0
        ? Math.max(baseGap, mainAvail / (2 * children.length))
        : baseGap;
      return layoutFlow(children, {
        bounds,
        direction: dir,
        gap: flowGap,
        edges: flowEdges,
      });
    }

    case 'tree': {
      const treeNodes = buildTreeNodes(children, edges);
      const defaultLevelGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'connectorGap') : 5;
      const defaultSiblingGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'siblingGap') : 3;
      const baseLevelGap = typeof props.gap === 'number' ? props.gap : defaultLevelGap;
      const treeDir = (props.direction as 'down' | 'right' | 'up' | 'left') ?? 'down';
      const isTreeHz = treeDir === 'right' || treeDir === 'left';
      const treeMainAvail = isTreeHz ? bounds.w : bounds.h;
      // Ensure level gap is large enough for visual hierarchy separation
      const treeLevelGap = Math.max(
        baseLevelGap * TREE_LEVEL_GAP_SCALE,
        edges.length > 0 ? treeMainAvail / (2 * children.length) : 0,
      );
      return layoutTree(treeNodes, {
        bounds,
        direction: treeDir,
        levelGap: treeLevelGap,
        siblingGap: typeof props.gap === 'number' ? props.gap : defaultSiblingGap,
      });
    }

    case 'group': {
      const defaultGroupPadding = scaleCtx ? computePadding(scaleCtx.baseUnit) : 3;
      return layoutGroup(children, {
        bounds,
        padding: typeof props.padding === 'number' ? props.padding : defaultGroupPadding,
      });
    }

    case 'layers': {
      const defaultLayersGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'siblingGap') : 2;
      return layoutLayers(children, {
        bounds,
        gap: typeof props.gap === 'number' ? props.gap : defaultLayersGap,
      });
    }

    case 'table': {
      const headerRows = children.length > 0 ? 1 : 0;
      return layoutTable(children, {
        bounds,
        headerRows,
        gap: gap * 0.3,
      });
    }

    case 'chart':
      return layoutChart(children, {
        bounds,
        gap: gap * 0.5,
      });

    case 'box':
    case 'layer':
      return layoutStack(children, {
        bounds,
        direction: 'col',
        gap,
        align: 'stretch',
        wrap: false,
      });

    case 'canvas':
    default:
      return layoutStack(children, {
        bounds,
        direction: 'col',
        gap,
        align: 'stretch',
        wrap: false,
      });
  }
}

// ---------------------------------------------------------------------------
// Tree node conversion (moved from emit-ir.ts)
// ---------------------------------------------------------------------------

export function buildTreeNodes(
  children: LayoutChild[],
  edges: ASTEdge[],
): TreeNode[] {
  if (children.length === 0) return [];

  const idToIndex = new Map<string, number>();
  children.forEach((child, i) => idToIndex.set(child.id, i));

  const childrenMap = new Map<number, number[]>();
  children.forEach((_, i) => childrenMap.set(i, []));

  const hasParent = new Set<number>();
  for (const edge of edges) {
    const fromIdx = idToIndex.get(edge.fromId);
    const toIdx = idToIndex.get(edge.toId);
    if (fromIdx !== undefined && toIdx !== undefined) {
      childrenMap.get(fromIdx)!.push(toIdx);
      hasParent.add(toIdx);
    }
  }

  const treeNodes: TreeNode[] = children.map((child, i) => ({
    id: child.id,
    width: child.width,
    height: child.height,
    children: childrenMap.get(i) ?? [],
  }));

  // Ensure root (node without parent) is at index 0
  const rootIndex = treeNodes.findIndex((_, i) => !hasParent.has(i));
  if (rootIndex > 0) {
    const indexMap = new Map<number, number>();
    indexMap.set(0, rootIndex);
    indexMap.set(rootIndex, 0);

    const temp = treeNodes[0];
    treeNodes[0] = treeNodes[rootIndex];
    treeNodes[rootIndex] = temp;

    for (const node of treeNodes) {
      node.children = node.children.map(ci =>
        indexMap.has(ci) ? indexMap.get(ci)! : ci,
      );
    }
  }

  return treeNodes;
}

// ---------------------------------------------------------------------------
// Height/width redistribution with minimum constraints
// ---------------------------------------------------------------------------

/**
 * Redistribute sizes so that each item is at least its minimum.
 *
 * Items below their minimum are clamped up; the excess is taken
 * proportionally from items that have surplus above their minimum.
 * If total minimums exceed available space, each gets its minimum
 * (may overflow — the measure pass should prevent this in practice).
 */
export function redistributeWithMinimums(
  raw: number[],
  mins: number[],
  total: number,
): number[] {
  const n = raw.length;
  if (n === 0) return [];

  // Overflow compression: when total minimums exceed available space,
  // scale down minimums proportionally to fit within the budget.
  const totalMin = mins.reduce((s, v) => s + v, 0);
  const effectiveMins = totalMin > total && totalMin > 0
    ? mins.map(m => m * (total / totalMin))
    : mins;

  const result = raw.slice();

  // Clamp up to minimums
  let deficit = 0;
  for (let i = 0; i < n; i++) {
    if (result[i] < effectiveMins[i]) {
      deficit += effectiveMins[i] - result[i];
      result[i] = effectiveMins[i];
    }
  }

  if (deficit <= 0) return result;

  // Collect surplus from items above their minimum
  let totalSurplus = 0;
  for (let i = 0; i < n; i++) {
    const surplus = result[i] - effectiveMins[i];
    if (surplus > 0) totalSurplus += surplus;
  }

  if (totalSurplus <= 0) return result;

  // Take proportionally from surplus items
  const take = Math.min(deficit, totalSurplus);
  for (let i = 0; i < n; i++) {
    const surplus = result[i] - effectiveMins[i];
    if (surplus > 0) {
      const reduction = take * (surplus / totalSurplus);
      result[i] -= reduction;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Shape aspect-ratio helper
// ---------------------------------------------------------------------------

/**
 * For shape elements (node/rect/circle/…) inside a box col layout,
 * cap width to height × MAX_SHAPE_ASPECT and center horizontally.
 * Text, list, divider, and other flow elements keep full parent width.
 */
function applyShapeAspect(
  child: LayoutPlanNode,
  innerBounds: IRBounds,
  height: number,
): { w: number; x: number } {
  const ast = child.astNode;
  if (
    ast.kind === 'element' &&
    SHAPE_ELEMENT_TYPES.has(ast.elementType) &&
    !('width' in ast.props && typeof ast.props.width === 'number')
  ) {
    const maxW = height * MAX_SHAPE_ASPECT;
    if (maxW < innerBounds.w) {
      return { w: maxW, x: innerBounds.x + (innerBounds.w - maxW) / 2 };
    }
  }
  return { w: innerBounds.w, x: innerBounds.x };
}

/**
 * For shape elements in flow/tree blocks, enforce aspect ratio constraints
 * and center within the allocated bounds.
 *
 * Shapes with a preferred ratio (diamond, circle, hexagon) are adjusted on
 * both axes. Other shapes use the generic MAX_SHAPE_ASPECT width-only cap.
 */
function applyShapeAspectToBounds(
  child: LayoutPlanNode,
  bounds: IRBounds,
): IRBounds {
  const ast = child.astNode;
  if (
    ast.kind !== 'element' ||
    !SHAPE_ELEMENT_TYPES.has(ast.elementType) ||
    typeof ast.props.width === 'number' ||
    typeof ast.props.height === 'number'
  ) {
    return bounds;
  }

  let { x, y, w, h } = bounds;
  const preferredRatio = SHAPE_PREFERRED_RATIO[ast.elementType];

  if (preferredRatio) {
    // Strict ratio: fit within bounds maintaining preferred w:h
    const currentRatio = w / h;
    if (currentRatio > preferredRatio) {
      const newW = h * preferredRatio;
      x += (w - newW) / 2;
      w = newW;
    } else if (currentRatio < preferredRatio) {
      const newH = w / preferredRatio;
      y += (h - newH) / 2;
      h = newH;
    }
  } else {
    // Generic fallback: cap width only
    const maxW = h * MAX_SHAPE_ASPECT;
    if (w > maxW) {
      x += (w - maxW) / 2;
      w = maxW;
    }
  }

  return { x, y, w, h };
}
