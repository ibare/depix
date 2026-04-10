/**
 * Compiler Pass — Allocate Bounds
 *
 * Top-down space allocation: the parent gives each child a portion of its
 * available space proportional to the child's weight. Block children are
 * laid out using the existing layout algorithms; leaf elements receive
 * the allocated space (filling the parent's allocation).
 *
 * Pipeline: PlanNode + canvasBounds → BoundsMap
 */

import type { IRBounds } from '../../ir/types.js';
import type { SceneTheme } from '../../theme/scene-theme.js';
import { layoutStack } from '../layout/stack-layout.js';
import { layoutGrid } from '../layout/grid-layout.js';
import { layoutFlow } from '../layout/flow-layout.js';
import { layoutTree } from '../layout/tree-layout.js';
import { layoutGroup } from '../layout/group-layout.js';
import { layoutLayers } from '../layout/layers-layout.js';
import { layoutTable } from '../layout/table-layout.js';
import { layoutChart } from '../layout/chart-layout.js';
import { layoutScene } from '../layout/scene-layout.js';
import type {
  LayoutChild,
  LayoutResult,
  SceneLayoutConfig,
  TreeNode,
} from '../layout/types.js';
import type { PlanNode, PlanEdge } from '../layout/plan-types.js';
import type { MeasureMap } from './measure.js';
import type { ConstraintMap } from './budget-types.js';
import type { ScaleContext } from './scale-system.js';
import { computeGap, computePadding, computeFontSize } from './scale-system.js';
import { computeTreeLevelInfo, computeFlowLayerInfo } from './layout-analysis.js';

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

/** Preferred w:h ratio for strict-ratio shapes. Others use MAX_SHAPE_ASPECT fallback.
 *  Unit: dimensionless w:h ratio. */
const SHAPE_PREFERRED_RATIO: Readonly<Record<string, number>> = {
  circle: 1.0,    // Perfect circle — equal width and height.
  hexagon: 1.15,  // Regular hexagon circumscribed rect ≈ 2/sqrt(3) ≈ 1.155.
  ellipse: 1.3,   // Visually balanced horizontal ellipse.
  trapezoid: 1.4, // Wider than tall to accommodate skewed top edge.
  diamond: 1.6,   // Rotated square needs extra width for label readability.
  pill: 2.0,      // Capsule shape — width is 2× height for horizontal emphasis.
  cylinder: 0.8,  // Taller than wide to suggest vertical storage container.
};

/** Minimum fraction of allocated dimension kept after aspect-ratio fitting.
 *  Derived from pill(w:h=2:1) in 8-layer horizontal flow (100×75 canvas):
 *  strict ratio yields h=5.15 out of 23.33 available (22%), losing 78% of cross-axis.
 *  0.4 caps shrinkage at 60%, giving h≈9.33 — enough for single-line label readability
 *  while still communicating the shape's wider-than-tall intent.
 *  Unit: dimensionless ratio (0–1). */
const MIN_ASPECT_KEEP = 0.4;

/** Flow/tree cross-axis cap expressed as a multiple of baseUnit.
 *  baseUnit = sqrt(canvasArea / elementCount) × densityFactor — already encodes
 *  node density: 12 nodes → baseUnit≈15.9, 3 nodes → baseUnit≈31.7.
 *  Factor 1.0 means cross-axis ≤ baseUnit, giving density-proportional sizing
 *  that adapts to both dense (Binary Search 12 nodes) and sparse (3 nodes) flows.
 *  Unit: dimensionless multiplier applied to baseUnit (0–100 coordinate). */
const FLOW_CROSS_BASEUNIT_FACTOR = 0.7;

/** Minimum gap-to-node ratio for flow/tree main-axis spacing.
 *  Ensures inter-node gaps are at least this fraction of node main size,
 *  giving edges and labels readable space between nodes.
 *  Derived algebraically: L = mainAxis / (N + r*(N-1)), G = L*r.
 *  At r=0.5, gap:node = 1:2 — nodes occupy 2/3, gaps 1/3 of main axis.
 *  Sparse flows (3 nodes): gap grows from connectorGap 4.8 to 10.5.
 *  Dense flows (9+ layers): connectorGap already exceeds threshold → no change.
 *  Unit: dimensionless ratio (0–1). */
const FLOW_MIN_GAP_RATIO = 0.5;

const SHAPE_ELEMENT_TYPES: ReadonlySet<string> = new Set([
  'node', 'cell', 'rect', 'circle', 'badge', 'icon',
  'diamond', 'pill', 'hexagon', 'triangle', 'parallelogram',
  'ellipse', 'cylinder', 'trapezoid',
]);

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type BoundsMap = Map<string, IRBounds>;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Allocate bounds for every node in a plan.
 *
 * Returns a BoundsMap keyed by node id containing computed IRBounds.
 * Also stores container bounds under each block's id.
 *
 * When plan.blockType === 'scene', delegates to allocateScene (slot-based layout).
 */
export function allocateBounds(
  plan: PlanNode,
  canvasBounds: IRBounds,
  sceneTheme: SceneTheme,
  scaleCtx?: ScaleContext,
  measureMap?: MeasureMap,
  constraintMap?: ConstraintMap,
): BoundsMap {
  const boundsMap: BoundsMap = new Map();

  if (plan.blockType === 'scene') {
    allocateScene(plan, canvasBounds, boundsMap, sceneTheme, scaleCtx, measureMap, constraintMap);
    return boundsMap;
  }

  if (plan.children.length === 0) return boundsMap;

  const gap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'sectionGap') : 3;
  const usableHeight = canvasBounds.h - gap * (plan.children.length - 1);

  // When measureMap is available, enforce minimum heights from measurements.
  // First pass: compute weight-based heights, then clamp to minHeight.
  const rawHeights: number[] = [];
  const minHeights: number[] = [];
  const totalWeight = plan.children.reduce((s, c) => s + c.weight, 0);
  for (const child of plan.children) {
    const fraction = totalWeight > 0 ? child.weight / totalWeight : 1 / plan.children.length;
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
// Internal: scene slot allocation
// ---------------------------------------------------------------------------

function allocateScene(
  plan: PlanNode,
  canvasBounds: IRBounds,
  boundsMap: BoundsMap,
  sceneTheme: SceneTheme,
  scaleCtx?: ScaleContext,
  measureMap?: MeasureMap,
  constraintMap?: ConstraintMap,
): void {
  const config: SceneLayoutConfig = {
    bounds: canvasBounds,
    padding: sceneTheme.layout.scenePadding,
    headerHeight: sceneTheme.layout.headingHeight,
    gap: sceneTheme.layout.columnGap,
    ratio: typeof plan.props.ratio === 'number' ? (plan.props.ratio as number) : undefined,
    direction: typeof plan.props.direction === 'string' ? (plan.props.direction as string) : undefined,
  };
  const preset = plan.layout?.preset ?? 'full';
  const cellCount = plan.children.filter(c => c.slot === 'cell').length;
  const result = layoutScene(preset, config, cellCount);
  const cellChildren = plan.children.filter(c => c.slot === 'cell');

  for (const child of plan.children) {
    if (!child.slot) continue;
    const slotArr = result.slotBounds.get(child.slot);
    if (!slotArr) continue;
    const slotBounds = child.slot === 'cell'
      ? slotArr[cellChildren.indexOf(child)]
      : slotArr[0];
    if (!slotBounds) continue;
    boundsMap.set(child.id, slotBounds);
    allocateNode(child, slotBounds, boundsMap, scaleCtx, measureMap, constraintMap);
  }

  // 미채워진 슬롯을 placeholder 키로 BoundsMap에 등록 (walker가 조회하여 placeholder IRContainer 생성).
  const filledSlots = new Set(plan.children.map(c => c.slot).filter(Boolean));
  for (const [slotName, boundsArr] of result.slotBounds) {
    if (slotName === 'cell') continue;
    if (filledSlots.has(slotName)) continue;
    const bounds = boundsArr[0];
    if (!bounds) continue;
    boundsMap.set(`${plan.id}-placeholder-${slotName}`, bounds);
  }
}

// ---------------------------------------------------------------------------
// Internal: recursive allocation
// ---------------------------------------------------------------------------

function allocateNode(
  plan: PlanNode,
  availBounds: IRBounds,
  boundsMap: BoundsMap,
  scaleCtx?: ScaleContext,
  measureMap?: MeasureMap,
  constraintMap?: ConstraintMap,
): void {
  if (!plan.blockType.startsWith('element-')) {
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
  plan: PlanNode,
  availBounds: IRBounds,
  boundsMap: BoundsMap,
  scaleCtx?: ScaleContext,
  measureMap?: MeasureMap,
): void {
  const hasExplicitW = typeof plan.props.width === 'number';
  const hasExplicitH = typeof plan.props.height === 'number';

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
  plan: PlanNode,
  availBounds: IRBounds,
  boundsMap: BoundsMap,
  scaleCtx?: ScaleContext,
  measureMap?: MeasureMap,
  constraintMap?: ConstraintMap,
): void {
  const blockType = plan.blockType;
  const props = plan.props;

  // Build LayoutChild[] with sizes proportional to available bounds
  const layoutChildren = computeLayoutChildren(plan, availBounds, scaleCtx, measureMap, constraintMap);

  // Run the appropriate layout algorithm
  const layoutResult = runLayout(
    blockType,
    layoutChildren,
    props,
    availBounds,
    plan.edges ?? [],
    scaleCtx,
  );

  // Store container bounds
  boundsMap.set(plan.id, layoutResult.containerBounds);

  // Recurse into children
  for (let i = 0; i < plan.children.length; i++) {
    const childPlan = plan.children[i];
    const childBounds = layoutResult.childBounds[i];

    if (!childPlan.blockType.startsWith('element-')) {
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
  plan: PlanNode,
  bounds: IRBounds,
  scaleCtx?: ScaleContext,
  measureMap?: MeasureMap,
  constraintMap?: ConstraintMap,
): LayoutChild[] {
  if (plan.blockType.startsWith('element-')) return [];

  const props = plan.props;
  const n = plan.children.length;
  if (n === 0) return [];

  const totalWeight = plan.children.reduce((s, c) => s + c.weight, 0);
  const defaultGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'siblingGap') : 3;
  const gap = typeof props.gap === 'number' ? props.gap : defaultGap;

  switch (plan.blockType) {
    case 'stack': {
      const dir = (props.direction as string) ?? 'col';
      if (dir === 'row') {
        const usable = bounds.w - gap * Math.max(n - 1, 0);
        const rawWidths = plan.children.map(c => {
          const hasExplicitW = typeof c.props.width === 'number';
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
          if (c.blockType === 'element-text' || c.blockType === 'element-divider') {
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
          const h = Math.min(rawH, maxH);

          // Shape 요소: height 기반 preferred ratio로 width 계산 (flow/tree와 동일 원칙)
          const elementType = c.elementType ?? '';
          const preferredRatio = SHAPE_PREFERRED_RATIO[elementType];
          const w = preferredRatio ? Math.min(h * preferredRatio, bounds.w) : bounds.w;

          return { id: c.id, width: Math.max(w, 4), height: Math.max(h, 3) };
        });
      }
    }

    case 'grid': {
      const cols = typeof props.cols === 'number' ? props.cols : 2;
      const rows = Math.ceil(n / cols);
      const cellW = (bounds.w - gap * Math.max(cols - 1, 0)) / cols;
      const cellH = (bounds.h - gap * Math.max(rows - 1, 0)) / rows;
      return plan.children.map(c => {
        const m = measureMap?.get(c.id);
        const cc = constraintMap?.get(c.id);
        const maxW = cc?.maxWidth ?? Infinity;
        const maxH = cc?.maxHeight ?? Infinity;
        const w = Math.min(Math.max(cellW, m?.minWidth ?? 0), maxW);
        const h = Math.min(Math.max(cellH, m?.minHeight ?? 0), maxH);
        return { id: c.id, width: w, height: h };
      });
    }

    case 'flow': {
      const defaultFlowGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'connectorGap') : 5;
      const flowGap = typeof props.gap === 'number' ? props.gap : defaultFlowGap;
      const dir = (props.direction as string) ?? 'right';
      const isHorizontal = dir === 'right' || dir === 'left';
      const mainAxis = isHorizontal ? bounds.w : bounds.h;
      const crossAxis = isHorizontal ? bounds.h : bounds.w;

      const nodeIds = plan.children.map(c => c.id);
      const layerInfo = computeFlowLayerInfo(nodeIds, plan.edges ?? []);
      const layerCount = Math.max(layerInfo.layerCount, 1);

      // Proportional gap: gap ≥ nodeMain * FLOW_MIN_GAP_RATIO for edge readability.
      // Algebraic: L = mainAxis / (N + r*(N-1)), G = L*r. Only activates when G > connectorGap.
      const gapSlots = Math.max(layerCount - 1, 0);
      const proportionalMain = mainAxis / (layerCount + FLOW_MIN_GAP_RATIO * gapSlots);
      const effectiveFlowGap = Math.max(flowGap, proportionalMain * FLOW_MIN_GAP_RATIO);
      const mainUsable = mainAxis - effectiveFlowGap * gapSlots;

      // 균등 분할: flow 노드는 모두 동일한 main/cross 크기를 가짐.
      // cross-axis 상한을 baseUnit 기반으로 밀도 적응.
      // 개별 도형의 비율 보정은 applyShapeAspectToBounds에서 처리.
      const layerMainSize = mainUsable / layerCount;
      const maxNodesInAnyLayer = Math.max(...layerInfo.nodesPerLayer, 1);
      const referenceCross = (crossAxis - effectiveFlowGap * Math.max(maxNodesInAnyLayer - 1, 0)) / Math.max(maxNodesInAnyLayer, 1);
      const crossCap = scaleCtx ? scaleCtx.baseUnit * FLOW_CROSS_BASEUNIT_FACTOR : referenceCross;
      const uniformCross = Math.min(referenceCross, crossCap);

      return plan.children.map(c => {
        const m = measureMap?.get(c.id);
        const measuredW = m?.minWidth ?? 0;
        const measuredH = m?.minHeight ?? 0;
        // Flow 레이아웃이 사이징 권한을 가지므로 SHAPE_MAX cap을 적용하지 않음.
        // 사용자가 명시적으로 지정한 크기(pinned)만 max 제약으로 사용.
        const cc = constraintMap?.get(c.id);
        const maxW = cc?.pinnedWidth ? (cc.maxWidth ?? Infinity) : Infinity;
        const maxH = cc?.pinnedHeight ? (cc.maxHeight ?? Infinity) : Infinity;

        if (isHorizontal) {
          const finalW = Math.max(layerMainSize, measuredW, 4);
          const finalH = Math.max(uniformCross, measuredH, 3);
          return { id: c.id, width: Math.min(finalW, maxW), height: Math.min(finalH, maxH) };
        }
        const finalW = Math.max(uniformCross, measuredW, 4);
        const finalH = Math.max(layerMainSize, measuredH, 3);
        return { id: c.id, width: Math.min(finalW, maxW), height: Math.min(finalH, maxH) };
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
      const levelInfo = computeTreeLevelInfo(nodeIds, plan.edges ?? []);
      const numLevels = Math.max(levelInfo.numLevels, 1);

      // Uniform level heights — hierarchy conveyed by position, not size
      const baseTreeLevelGap = levelGap * TREE_LEVEL_GAP_SCALE;
      // Proportional gap: gap ≥ nodeMain * FLOW_MIN_GAP_RATIO
      const treeLevelGapSlots = Math.max(numLevels - 1, 0);
      const treeProportionalMain = mainAxis / (numLevels + FLOW_MIN_GAP_RATIO * treeLevelGapSlots);
      const treeLevelGap = Math.max(baseTreeLevelGap, treeProportionalMain * FLOW_MIN_GAP_RATIO);
      const mainUsable = mainAxis - treeLevelGap * treeLevelGapSlots;
      const uniformLevelMain = mainUsable / numLevels;

      // cross-axis는 가용 공간을 직접 사용한다 (PHI 천장 없음).
      // 명시적 preferredRatio가 있는 도형만 비율 제약.
      // 개별 도형의 비율 보정은 applyShapeAspectToBounds에서 처리.
      return plan.children.map(c => {
        const level = levelInfo.nodeLevel.get(c.id) ?? 0;
        const nodeMain = uniformLevelMain;
        const nodesAtLevel = levelInfo.nodesPerLevel[level] ?? 1;
        const levelCrossAvail = (crossAxis - siblingGap * Math.max(nodesAtLevel - 1, 0)) / Math.max(nodesAtLevel, 1);
        const elementType = c.elementType ?? '';
        const preferredRatio = SHAPE_PREFERRED_RATIO[elementType];
        const treeCrossCap = scaleCtx ? scaleCtx.baseUnit * FLOW_CROSS_BASEUNIT_FACTOR : levelCrossAvail;
        const nodeCross = preferredRatio
          ? Math.min(levelCrossAvail, isHorizontal ? nodeMain / preferredRatio : nodeMain * preferredRatio)
          : Math.min(levelCrossAvail, treeCrossCap);

        const m = measureMap?.get(c.id);
        const measuredW = m?.minWidth ?? 0;
        const measuredH = m?.minHeight ?? 0;
        // Tree 레이아웃이 사이징 권한을 가지므로 SHAPE_MAX cap을 적용하지 않음.
        const cc = constraintMap?.get(c.id);
        const maxW = cc?.pinnedWidth ? (cc.maxWidth ?? Infinity) : Infinity;
        const maxH = cc?.pinnedHeight ? (cc.maxHeight ?? Infinity) : Infinity;

        if (isHorizontal) {
          const finalW = Math.max(nodeMain, measuredW, 4);
          const finalH = Math.max(nodeCross, measuredH, 3);
          return { id: c.id, width: Math.min(finalW, maxW), height: Math.min(finalH, maxH) };
        }
        const finalW = Math.max(nodeCross, measuredW, 4);
        const finalH = Math.max(nodeMain, measuredH, 3);
        return { id: c.id, width: Math.min(finalW, maxW), height: Math.min(finalH, maxH) };
      });
    }

    case 'layers': {
      const defaultLayerGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'siblingGap') : 2;
      const layerGap = typeof props.gap === 'number' ? props.gap : defaultLayerGap;
      const layerH = (bounds.h - layerGap * Math.max(n - 1, 0)) / n;
      return plan.children.map(c => {
        const m = measureMap?.get(c.id);
        const cc = constraintMap?.get(c.id);
        const maxW = cc?.maxWidth ?? Infinity;
        const maxH = cc?.maxHeight ?? Infinity;
        const w = Math.min(Math.max(bounds.w, m?.minWidth ?? 0), maxW);
        const h = Math.min(Math.max(layerH, m?.minHeight ?? 0), maxH);
        return { id: c.id, width: w, height: h };
      });
    }

    case 'group': {
      const defaultPadding = scaleCtx ? computePadding(scaleCtx.baseUnit) : 3;
      const padding = typeof props.padding === 'number' ? props.padding : defaultPadding;
      const innerH = bounds.h - padding * 2;
      const innerW = bounds.w - padding * 2;
      const usable = innerH - gap * Math.max(n - 1, 0);
      return plan.children.map(c => {
        const m = measureMap?.get(c.id);
        const measuredW = m?.minWidth ?? 0;
        const measuredH = m?.minHeight ?? 0;
        const cc = constraintMap?.get(c.id);
        const maxW = cc?.maxWidth ?? Infinity;
        const maxH = cc?.maxHeight ?? Infinity;
        const rawH = totalWeight > 0 ? usable * (c.weight / totalWeight) : usable / n;
        const h = Math.min(Math.max(rawH, measuredH), maxH);

        // Shape 요소: height 기반 preferred ratio로 width 계산 (flow/tree와 동일 원칙)
        const elementType = c.elementType ?? '';
        const preferredRatio = SHAPE_PREFERRED_RATIO[elementType];
        const idealW = preferredRatio ? Math.min(h * preferredRatio, innerW) : innerW;
        const w = Math.min(Math.max(idealW, measuredW), maxW);

        return { id: c.id, width: Math.max(w, 4), height: Math.max(h, 3) };
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
        const value = typeof c.props.value === 'number' ? (c.props.value as number) : 1;
        return { id: c.id, width: barW, height: value };
      });
    }

    case 'box':
    case 'layer': {
      // Visual containers: compact stacking — each child gets its min height, no surplus redistribution.
      // Width takes the parent stretch width but is widened if the child's measured min exceeds it.
      return plan.children.map(c => {
        const hasExplicitH = typeof c.props.height === 'number';
        const m = measureMap?.get(c.id);
        const h = hasExplicitH ? c.intrinsicSize.height : (m ? m.minHeight : c.intrinsicSize.height || 4);
        const w = Math.max(bounds.w, m?.minWidth ?? 0);
        return { id: c.id, width: w, height: h };
      });
    }

    default: {
      // default: stack col behaviour
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
  props: Record<string, unknown>,
  bounds: IRBounds,
  edges: PlanEdge[],
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
      const flowEdges = edges.map(e => ({ fromId: e.fromId, toId: e.toId, structural: e.edgeStyle !== '--' }));
      const defaultFlowGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'connectorGap') : 5;
      const baseFlowGap = typeof props.gap === 'number' ? props.gap : defaultFlowGap;
      const dir = (props.direction as 'right' | 'left' | 'down' | 'up') ?? 'right';
      // Proportional gap: match computeLayoutChildren sizing
      const isHz = dir === 'right' || dir === 'left';
      const mainAvail = isHz ? bounds.w : bounds.h;
      const nodeIds = children.map(c => c.id);
      const flowLayerInfo = computeFlowLayerInfo(nodeIds, edges.map(e => ({
        fromId: e.fromId, toId: e.toId, edgeStyle: e.edgeStyle,
      })));
      const flowLayerCount = Math.max(flowLayerInfo.layerCount, 1);
      const flowGapSlots = Math.max(flowLayerCount - 1, 0);
      const proportionalMain = mainAvail / (flowLayerCount + FLOW_MIN_GAP_RATIO * flowGapSlots);
      const flowGap = Math.max(baseFlowGap, proportionalMain * FLOW_MIN_GAP_RATIO);
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
      const baseTreeLvlGap = baseLevelGap * TREE_LEVEL_GAP_SCALE;
      // Proportional gap: match computeLayoutChildren tree sizing
      const isTreeHz = treeDir === 'right' || treeDir === 'left';
      const treeMainAvail = isTreeHz ? bounds.w : bounds.h;
      const treeNodeIds = children.map(c => c.id);
      const treeLvlInfo = computeTreeLevelInfo(treeNodeIds, edges.map(e => ({
        fromId: e.fromId, toId: e.toId, edgeStyle: e.edgeStyle,
      })));
      const treeLvlCount = Math.max(treeLvlInfo.numLevels, 1);
      const treeLvlGapSlots = Math.max(treeLvlCount - 1, 0);
      const treePropMain = treeMainAvail / (treeLvlCount + FLOW_MIN_GAP_RATIO * treeLvlGapSlots);
      const treeLevelGap = Math.max(baseTreeLvlGap, treePropMain * FLOW_MIN_GAP_RATIO);
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
  edges: PlanEdge[],
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
  child: PlanNode,
  innerBounds: IRBounds,
  height: number,
): { w: number; x: number } {
  if (
    SHAPE_ELEMENT_TYPES.has(child.elementType ?? '') &&
    typeof child.props.width !== 'number'
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
 * both axes. Other shapes use the generic MAX_SHAPE_ASPECT bidirectional cap.
 */
function applyShapeAspectToBounds(
  child: PlanNode,
  bounds: IRBounds,
): IRBounds {
  if (
    !SHAPE_ELEMENT_TYPES.has(child.elementType ?? '') ||
    typeof child.props.width === 'number' ||
    typeof child.props.height === 'number'
  ) {
    return bounds;
  }

  let { x, y, w, h } = bounds;
  const preferredRatio = SHAPE_PREFERRED_RATIO[child.elementType ?? ''];

  if (preferredRatio) {
    // Ratio-aware fit: prefer strict ratio but cap shrinkage via MIN_ASPECT_KEEP
    const currentRatio = w / h;
    if (currentRatio > preferredRatio) {
      const strictW = h * preferredRatio;
      const finalW = Math.max(strictW, w * MIN_ASPECT_KEEP);
      x += (w - finalW) / 2;
      w = finalW;
    } else if (currentRatio < preferredRatio) {
      const strictH = w / preferredRatio;
      const finalH = Math.max(strictH, h * MIN_ASPECT_KEEP);
      y += (h - finalH) / 2;
      h = finalH;
    }
  } else {
    // Generic fallback: cap both width and height to MAX_SHAPE_ASPECT
    const maxW = h * MAX_SHAPE_ASPECT;
    const maxH = w * MAX_SHAPE_ASPECT;
    if (w > maxW) {
      x += (w - maxW) / 2;
      w = maxW;
    } else if (h > maxH) {
      y += (h - maxH) / 2;
      h = maxH;
    }
  }

  return { x, y, w, h };
}
