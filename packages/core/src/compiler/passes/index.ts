/**
 * Compiler Passes — Public Exports
 *
 * 패스 실행 순서 (compiler.ts가 이 순서로 호출):
 *   resolveTheme → planDocument → createScaleContext
 *   → computeConstraints → allocateBudgets → measureDiagram
 *   → allocateBounds → resolveFonts → emit
 *
 * 각 패스의 입출력 계약은 개별 패스 파일 상단 JSDoc 참조.
 */

export { resolveTheme } from './resolve-theme.js';
export type { PlanNode, PlanEdge, PlanBlockType, SceneLayoutSpec, PlanMetrics } from '../layout/plan-types.js';
export { allocateBounds, runLayout, buildTreeNodes, computeLayoutChildren, redistributeWithMinimums } from './allocate-bounds.js';
export type { BoundsMap } from './allocate-bounds.js';
export { measureDiagram } from './measure.js';
export type { MeasureMap, MeasureResult } from './measure.js';
export { computeConstraints } from './compute-constraints.js';
export { allocateBudgets } from './allocate-budgets.js';
export type { NodeConstraint, ConstraintMap, NodeBudget, BudgetMap } from './budget-types.js';
export { computeTreeLevelInfo, computeFlowLayerInfo } from './layout-analysis.js';
export type { TreeLevelInfo, FlowLayerInfo } from './layout-analysis.js';
export { createScaleContext, computeBaseUnit, computeGap, computeFontSize, computePadding, countElements, computeBoundsFontSize, applyTextLengthPenalty, clampFontToFit, TEXT_BLOCK_MULTIPLIER } from './scale-system.js';
export type { ScaleContext, GapType, TextRole } from './scale-system.js';
export { resolveFonts } from './resolve-fonts.js';
export { extractOverrides, applyOverridesToIR } from './apply-overrides.js';
export type { OverrideEntry, OverrideMap } from './apply-overrides.js';
