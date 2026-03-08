/**
 * Compiler Pass — Measure
 *
 * Bottom-up measurement of each plan node to determine content-aware sizes.
 * Resolves fontSize, lineHeight, padding, and computes minimum dimensions
 * that the subsequent allocate-bounds pass uses as constraints.
 *
 * Pipeline: SceneLayoutPlan + ScaleContext + Theme → MeasureMap
 */

import type { DepixTheme } from '../../theme/types.js';
import type { ASTBlock, ASTElement } from '../ast.js';
import type { LayoutPlanNode, SceneLayoutPlan } from './plan-layout.js';
import type { ScaleContext } from './scale-system.js';
import { computeFontSize, computePadding, computeGap } from './scale-system.js';
import type { BudgetMap } from './budget-types.js';

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
export function measureScene(
  plan: SceneLayoutPlan,
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
  plan: LayoutPlanNode,
  theme: DepixTheme,
  scaleCtx: ScaleContext | undefined,
  measureMap: MeasureMap,
  budgetMap?: BudgetMap,
): MeasureResult {
  // Measure children first (bottom-up)
  for (const child of plan.children) {
    measureNode(child, theme, scaleCtx, measureMap, budgetMap);
  }

  const node = plan.astNode;
  let result: MeasureResult;

  if (node.kind === 'block') {
    result = measureBlock(plan, theme, scaleCtx, measureMap);
  } else {
    result = measureElement(node, plan, theme, scaleCtx, measureMap, budgetMap);
  }

  measureMap.set(plan.id, result);
  return result;
}

// ---------------------------------------------------------------------------
// Block measurement
// ---------------------------------------------------------------------------

function measureBlock(
  plan: LayoutPlanNode,
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
  element: ASTElement,
  plan: LayoutPlanNode,
  theme: DepixTheme,
  scaleCtx: ScaleContext | undefined,
  measureMap: MeasureMap,
  budgetMap?: BudgetMap,
): MeasureResult {
  switch (element.elementType) {
    case 'box':
    case 'layer':
      return measureBox(element, plan, theme, scaleCtx, measureMap, budgetMap);
    case 'list':
      return measureList(element, plan, theme, scaleCtx, budgetMap);
    case 'label':
    case 'text':
      return measureText(element, plan, theme, scaleCtx, budgetMap);
    case 'node':
    case 'cell':
    case 'rect':
    case 'circle':
    case 'badge':
    case 'icon':
      return measureShape(element, plan, theme, scaleCtx, budgetMap);
    case 'divider':
    case 'line':
      return measureDivider();
    case 'image':
      return measureImage(element);
    default:
      return measureShape(element, plan, theme, scaleCtx, budgetMap);
  }
}

// ---------------------------------------------------------------------------
// Element-specific measurements
// ---------------------------------------------------------------------------

function measureText(
  element: ASTElement,
  plan: LayoutPlanNode,
  theme: DepixTheme,
  scaleCtx: ScaleContext | undefined,
  budgetMap?: BudgetMap,
): MeasureResult {
  const fontSize = resolveElementFontSize(element, plan, theme, scaleCtx, 'standaloneText', budgetMap);
  const lineHeight = DEFAULT_LINE_HEIGHT;
  const textHeight = fontSize * TEXT_BLOCK_MULTIPLIER;

  return {
    fontSize,
    lineHeight,
    padding: 0,
    childGap: 0,
    minWidth: fontSize * 2,
    minHeight: textHeight,
  };
}

function measureShape(
  element: ASTElement,
  plan: LayoutPlanNode,
  theme: DepixTheme,
  scaleCtx: ScaleContext | undefined,
  budgetMap?: BudgetMap,
): MeasureResult {
  const fontSize = resolveElementFontSize(element, plan, theme, scaleCtx, 'innerLabel', budgetMap);
  const lineHeight = DEFAULT_LINE_HEIGHT;
  const labelHeight = element.label ? fontSize * TEXT_BLOCK_MULTIPLIER : 0;
  const minW = typeof element.props.width === 'number' ? element.props.width : theme.node.minWidth;
  const minH = typeof element.props.height === 'number' ? element.props.height : Math.max(theme.node.minHeight, labelHeight);

  return {
    fontSize,
    lineHeight,
    padding: 0,
    childGap: 0,
    minWidth: minW,
    minHeight: minH,
  };
}

function measureBox(
  element: ASTElement,
  plan: LayoutPlanNode,
  theme: DepixTheme,
  scaleCtx: ScaleContext | undefined,
  measureMap: MeasureMap,
  budgetMap?: BudgetMap,
): MeasureResult {
  const padding = scaleCtx ? computePadding(scaleCtx.baseUnit) : 2;
  const childGap = scaleCtx ? computeGap(scaleCtx.baseUnit, 'childGap') : 1;

  // Title
  const titleFontSize = resolveElementFontSize(element, plan, theme, scaleCtx, 'innerLabel', budgetMap);
  const titleHeight = element.label ? titleFontSize * TEXT_BLOCK_MULTIPLIER : 0;

  // Subtitle
  const hasSubtitle = typeof element.props.subtitle === 'string';
  const subtitleFontSize = hasSubtitle
    ? resolveElementFontSize(element, plan, theme, scaleCtx, 'listItem', budgetMap)
    : 0;
  const subtitleHeight = hasSubtitle ? subtitleFontSize * TEXT_BLOCK_MULTIPLIER : 0;

  // Children (list items, nested elements)
  let childrenHeight = 0;
  for (let i = 0; i < plan.children.length; i++) {
    const childMeasure = measureMap.get(plan.children[i].id);
    if (childMeasure) {
      childrenHeight += childMeasure.minHeight;
    }
    if (i < plan.children.length - 1) {
      childrenHeight += childGap;
    }
  }

  // Total content height
  let contentHeight = 0;
  if (titleHeight > 0) {
    contentHeight += titleHeight;
    if (subtitleHeight > 0 || childrenHeight > 0) contentHeight += childGap;
  }
  if (subtitleHeight > 0) {
    contentHeight += subtitleHeight;
    if (childrenHeight > 0) contentHeight += childGap;
  }
  contentHeight += childrenHeight;

  const minHeight = contentHeight + padding * 2;
  const minWidth = typeof element.props.width === 'number'
    ? element.props.width
    : Math.max(titleFontSize * 4, 10) + padding * 2;

  return {
    fontSize: titleFontSize,
    lineHeight: DEFAULT_LINE_HEIGHT,
    padding,
    childGap,
    minWidth,
    minHeight,
    titleFontSize,
    titleHeight,
    subtitleFontSize: hasSubtitle ? subtitleFontSize : undefined,
    subtitleHeight: hasSubtitle ? subtitleHeight : undefined,
  };
}

function measureList(
  element: ASTElement,
  plan: LayoutPlanNode,
  theme: DepixTheme,
  scaleCtx: ScaleContext | undefined,
  budgetMap?: BudgetMap,
): MeasureResult {
  const items = element.items ?? [];
  const itemCount = Math.max(items.length, 1);

  // Use per-item effective height so fontSize scales with item count
  const fontSize = resolveListFontSize(element, plan, theme, scaleCtx, itemCount, budgetMap);
  const lineHeight = DEFAULT_LINE_HEIGHT;
  const itemHeight = fontSize * TEXT_BLOCK_MULTIPLIER;
  const itemGap = fontSize * 0.3;
  const totalHeight = items.length > 0
    ? items.length * itemHeight + (items.length - 1) * itemGap
    : itemHeight;

  return {
    fontSize,
    lineHeight,
    padding: 0,
    childGap: itemGap,
    minWidth: fontSize * 4,
    minHeight: totalHeight,
  };
}

/**
 * Resolve fontSize for a list element, accounting for item count.
 * Uses per-item height as the effective short side so that more items → smaller font.
 */
function resolveListFontSize(
  element: ASTElement,
  plan: LayoutPlanNode,
  theme: DepixTheme,
  scaleCtx: ScaleContext | undefined,
  itemCount: number,
  budgetMap?: BudgetMap,
): number {
  // Priority 1: user-specified
  if (typeof element.style['font-size'] === 'number') {
    return element.style['font-size'];
  }

  // Priority 2: budget-aware with per-item height
  if (scaleCtx) {
    const budget = budgetMap?.get(plan.id);
    const totalH = budget ? budget.height : plan.intrinsicSize.height;
    const perItemH = totalH / itemCount;
    const width = budget ? budget.width : plan.intrinsicSize.width;
    const shortSide = Math.min(width, perItemH);
    if (shortSide > 0) {
      return computeFontSize(shortSide, 'listItem');
    }
  }

  // Priority 3: theme fallback
  return theme.fontSize.sm;
}

function measureDivider(): MeasureResult {
  return {
    fontSize: 0,
    lineHeight: 1,
    padding: 0,
    childGap: 0,
    minWidth: 1,
    minHeight: 0.5,
  };
}

function measureImage(element: ASTElement): MeasureResult {
  const w = typeof element.props.width === 'number' ? element.props.width : 20;
  const h = typeof element.props.height === 'number' ? element.props.height : 15;
  return {
    fontSize: 0,
    lineHeight: 1,
    padding: 0,
    childGap: 0,
    minWidth: w,
    minHeight: h,
  };
}

// ---------------------------------------------------------------------------
// Font size resolution
// ---------------------------------------------------------------------------

type TextRole = 'innerLabel' | 'standaloneText' | 'listItem' | 'edgeLabel';

const AVG_CHAR_WIDTH_RATIO = 0.55;
const TEXT_PADDING_H_RATIO = 0.15;

/**
 * Shrink fontSize if the estimated text width exceeds the available node width.
 */
function clampFontToFit(fontSize: number, label: string | undefined, nodeWidth: number): number {
  if (!label || label.length === 0 || nodeWidth <= 0) return fontSize;
  const availableWidth = nodeWidth * (1 - TEXT_PADDING_H_RATIO * 2);
  const estimatedTextWidth = fontSize * label.length * AVG_CHAR_WIDTH_RATIO;
  if (estimatedTextWidth <= availableWidth) return fontSize;
  return fontSize * (availableWidth / estimatedTextWidth);
}

/**
 * Adjust fontSize based on label text length.
 * Short text (1-4 chars): reduce to prevent oversized appearance.
 * Long text (8+ chars): sqrt decay to prevent overflow.
 */
function applyTextLengthPenalty(fontSize: number, label?: string): number {
  if (!label || label.length === 0) return fontSize;

  const len = label.length;

  // Short text penalty: 1→0.70, 2→0.78, 3→0.86, 4→0.95
  const shortPenalty = len <= 4 ? 0.62 + len * 0.082 : 1.0;

  // Long text decay: sqrt(6 / len) for 8+ chars
  const longPenalty = len > 7 ? Math.sqrt(6 / len) : 1.0;

  return fontSize * Math.min(shortPenalty, longPenalty);
}

/**
 * Resolve fontSize for an element following the priority:
 * 1. User-specified inline style (font-size: number)
 * 2. ScaleSystem dynamic calculation (based on intrinsic short side)
 * 3. Theme fallback
 */
function resolveElementFontSize(
  element: ASTElement,
  plan: LayoutPlanNode,
  theme: DepixTheme,
  scaleCtx: ScaleContext | undefined,
  role: TextRole,
  budgetMap?: BudgetMap,
): number {
  // Priority 1: user-specified
  if (typeof element.style['font-size'] === 'number') {
    return element.style['font-size'];
  }

  // Priority 2: scale system (budget-aware) with text length correction
  if (scaleCtx) {
    const budget = budgetMap?.get(plan.id);
    const shortSide = budget
      ? Math.min(budget.width, budget.height)
      : Math.min(plan.intrinsicSize.width, plan.intrinsicSize.height);
    if (shortSide > 0) {
      const base = computeFontSize(shortSide, role);
      const adjusted = applyTextLengthPenalty(base, element.label);
      const nodeWidth = budget ? budget.width : plan.intrinsicSize.width;
      return clampFontToFit(adjusted, element.label, nodeWidth);
    }
  }

  // Priority 3: theme fallback
  switch (role) {
    case 'innerLabel':
    case 'standaloneText':
    case 'edgeLabel':
      return theme.fontSize.md;
    case 'listItem':
      return theme.fontSize.sm;
    default:
      return theme.fontSize.md;
  }
}
