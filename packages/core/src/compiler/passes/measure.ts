/**
 * Compiler Pass — Measure
 *
 * Bottom-up measurement of each plan node to determine content-aware sizes.
 * Resolves fontSize, lineHeight, padding, and computes minimum dimensions
 * that the subsequent allocate-bounds pass uses as constraints.
 *
 * Pipeline: PlanNode + ScaleContext + Theme → MeasureMap
 */

import type { DepixTheme } from '../../theme/types.js';
import type { PlanNode } from '../layout/plan-types.js';
import type { ScaleContext } from './scale-system.js';
import { computePadding, computeGap } from './scale-system.js';
import type { BudgetMap } from './budget-types.js';
import { getElementConfig } from '../element-type-registry.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MeasureResult {
  /** Resolved font size for the primary text of this element. */
  fontSize: number;
  /** Line height multiplier. */
  lineHeight: number;
  /** Inner padding (for containers). */
  padding: number;
  /** Gap between child elements. */
  childGap: number;
  /** Minimum width needed to render content without clipping. */
  minWidth: number;
  /** Minimum height needed to render content without clipping. */
  minHeight: number;
  /** Title font size (box elements only). */
  titleFontSize?: number;
  /** Title height (box elements only). */
  titleHeight?: number;
  /** Subtitle font size (box elements only). */
  subtitleFontSize?: number;
  /** Subtitle height (box elements only). */
  subtitleHeight?: number;
}

export type MeasureMap = Map<string, MeasureResult>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// 1.4: CSS 표준 line-height 기본값과 일치. 가독성을 확보하는 최솟값
const DEFAULT_LINE_HEIGHT = 1.4;
const TEXT_BLOCK_MULTIPLIER = 1.8; // height = fontSize * multiplier (accounts for lineHeight + vertical padding)

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Measure all nodes in a scene plan bottom-up.
 *
 * Returns a MeasureMap keyed by plan node id.
 */
export function measureDiagram(
  plan: PlanNode,
  theme: DepixTheme,
  scaleCtx?: ScaleContext,
  budgetMap?: BudgetMap,
): MeasureMap {
  const measureMap: MeasureMap = new Map();

  for (const child of plan.children) {
    measureNode(child, theme, scaleCtx, measureMap, budgetMap);
  }

  return measureMap;
}

// ---------------------------------------------------------------------------
// Internal: recursive measurement
// ---------------------------------------------------------------------------

function measureNode(
  plan: PlanNode,
  theme: DepixTheme,
  scaleCtx: ScaleContext | undefined,
  measureMap: MeasureMap,
  budgetMap?: BudgetMap,
): MeasureResult {
  // Measure children first (bottom-up)
  for (const child of plan.children) {
    measureNode(child, theme, scaleCtx, measureMap, budgetMap);
  }

  let result: MeasureResult;

  if (!plan.blockType.startsWith('element-')) {
    result = measureBlock(plan, theme, scaleCtx, measureMap);
  } else {
    result = measureElement(plan, theme, scaleCtx, measureMap, budgetMap);
  }

  measureMap.set(plan.id, result);
  return result;
}

// ---------------------------------------------------------------------------
// Block measurement
// ---------------------------------------------------------------------------

function measureBlock(
  plan: PlanNode,
  theme: DepixTheme,
  scaleCtx: ScaleContext | undefined,
  measureMap: MeasureMap,
): MeasureResult {
  const padding = scaleCtx ? computePadding(scaleCtx.baseUnit) : 2;
  const childGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'siblingGap') : 3;

  // Sum children's min heights + gaps
  let childrenMinHeight = 0;
  let maxChildMinWidth = 0;
  for (let i = 0; i < plan.children.length; i++) {
    const childMeasure = measureMap.get(plan.children[i].id);
    if (childMeasure) {
      childrenMinHeight += childMeasure.minHeight;
      if (childMeasure.minWidth > maxChildMinWidth) {
        maxChildMinWidth = childMeasure.minWidth;
      }
    }
    if (i < plan.children.length - 1) {
      childrenMinHeight += childGap;
    }
  }

  const minHeight = childrenMinHeight + padding * 2;
  const minWidth = maxChildMinWidth + padding * 2;

  return {
    fontSize: theme.fontSize.md,
    lineHeight: DEFAULT_LINE_HEIGHT,
    padding,
    childGap,
    minWidth,
    minHeight,
  };
}

// ---------------------------------------------------------------------------
// Element measurement
// ---------------------------------------------------------------------------

function measureElement(
  plan: PlanNode,
  theme: DepixTheme,
  scaleCtx: ScaleContext | undefined,
  measureMap: MeasureMap,
  budgetMap?: BudgetMap,
): MeasureResult {
  const config = getElementConfig(plan.elementType!);
  switch (config.measure) {
    case 'text':
      return measureText(plan, theme, scaleCtx, budgetMap, config.fontScale);
    case 'shape':
      return measureShape(plan, theme, scaleCtx, budgetMap);
    case 'list':
      return measureList(plan, theme, scaleCtx, budgetMap);
    case 'divider':
      return measureDivider();
    case 'image':
      return measureImage(plan);
    case 'row':
      return measureShape(plan, theme, scaleCtx, budgetMap);
  }
}

// ---------------------------------------------------------------------------
// Element-specific measurements
// ---------------------------------------------------------------------------

function measureText(
  plan: PlanNode,
  theme: DepixTheme,
  scaleCtx: ScaleContext | undefined,
  _budgetMap?: BudgetMap,
  fontScale = 1,
): MeasureResult {
  // User-specified font-size: 레이아웃이 이 크기를 수용하도록 minSize에 반영
  const userFontSize = typeof plan.style['font-size'] === 'number' ? plan.style['font-size'] as number : null;
  if (userFontSize) {
    const fontSize = userFontSize * fontScale;
    const textHeight = fontSize * TEXT_BLOCK_MULTIPLIER;
    return {
      fontSize,
      lineHeight: DEFAULT_LINE_HEIGHT,
      padding: 0,
      childGap: 0,
      minWidth: fontSize * 2,
      minHeight: textHeight,
    };
  }

  // Auto: baseUnit 기반 최소 크기. fontSize는 resolveFonts 패스에서 최종 bounds 기반으로 결정.
  // 0.25: standaloneText ratio(0.25)와 동일. baseUnit 기반이므로 밀도 적응형.
  const baseSize = scaleCtx ? scaleCtx.baseUnit * 0.25 : theme.fontSize.md;
  return {
    fontSize: 0,
    lineHeight: DEFAULT_LINE_HEIGHT,
    padding: 0,
    childGap: 0,
    minWidth: baseSize * 2,
    minHeight: baseSize * TEXT_BLOCK_MULTIPLIER,
  };
}

function measureShape(
  plan: PlanNode,
  theme: DepixTheme,
  _scaleCtx: ScaleContext | undefined,
  _budgetMap?: BudgetMap,
): MeasureResult {
  // User-specified font-size: 레이아웃이 이 크기를 수용하도록 minH에 반영
  const userFontSize = typeof plan.style['font-size'] === 'number' ? plan.style['font-size'] as number : null;
  const labelHeight = userFontSize && plan.label ? userFontSize * TEXT_BLOCK_MULTIPLIER : 0;
  const minW = typeof plan.props.width === 'number' ? plan.props.width : theme.node.minWidth;
  const minH = typeof plan.props.height === 'number' ? plan.props.height : Math.max(theme.node.minHeight, labelHeight);

  return {
    fontSize: userFontSize ?? 0,
    lineHeight: DEFAULT_LINE_HEIGHT,
    padding: 0,
    childGap: 0,
    minWidth: minW,
    minHeight: minH,
  };
}

function measureList(
  plan: PlanNode,
  theme: DepixTheme,
  scaleCtx: ScaleContext | undefined,
  _budgetMap?: BudgetMap,
): MeasureResult {
  const items = plan.items ?? [];
  const itemCount = Math.max(items.length, 1);

  // User-specified font-size: 레이아웃이 이 크기를 수용하도록 minSize에 반영
  const userFontSize = typeof plan.style['font-size'] === 'number' ? plan.style['font-size'] as number : null;
  if (userFontSize) {
    const itemHeight = userFontSize * TEXT_BLOCK_MULTIPLIER;
    // 0.3: 항목 간격 = 폰트 크기의 30% (텍스트 행 간격 기준)
    const itemGap = userFontSize * 0.3;
    const totalHeight = items.length > 0
      ? items.length * itemHeight + (items.length - 1) * itemGap
      : itemHeight;
    return {
      fontSize: userFontSize,
      lineHeight: DEFAULT_LINE_HEIGHT,
      padding: 0,
      childGap: itemGap,
      minWidth: userFontSize * 4,
      minHeight: totalHeight,
    };
  }

  // Auto: baseUnit 기반 최소 크기. fontSize는 resolveFonts 패스에서 결정.
  // 0.20: listItem ratio(0.20)와 동일. 항목 수에 비례한 밀도 적응형 최소 높이.
  const itemSize = scaleCtx ? scaleCtx.baseUnit * 0.20 : theme.fontSize.sm;
  const itemHeight = itemSize * TEXT_BLOCK_MULTIPLIER;
  const itemGap = itemSize * 0.3;
  const totalHeight = itemCount > 0
    ? itemCount * itemHeight + Math.max(itemCount - 1, 0) * itemGap
    : itemHeight;
  return {
    fontSize: 0,
    lineHeight: DEFAULT_LINE_HEIGHT,
    padding: 0,
    childGap: itemGap,
    minWidth: itemSize * 4,
    minHeight: totalHeight,
  };
}

function measureDivider(): MeasureResult {
  return {
    fontSize: 0,
    lineHeight: 1,
    padding: 0,
    childGap: 0,
    minWidth: 1,    // 구분선 최소 너비 (0–100 기준 1%)
    minHeight: 0.5, // 구분선 최소 높이 = 선 두께에 해당 (~2.5px at 500px canvas)
  };
}

function measureImage(plan: PlanNode): MeasureResult {
  const w = typeof plan.props.width === 'number' ? plan.props.width : 20;  // 기본 이미지 너비 (0–100 기준 20%)
  const h = typeof plan.props.height === 'number' ? plan.props.height : 15; // 기본 이미지 높이 (0–100 기준 15%)
  return {
    fontSize: 0,
    lineHeight: 1,
    padding: 0,
    childGap: 0,
    minWidth: w,
    minHeight: h,
  };
}

