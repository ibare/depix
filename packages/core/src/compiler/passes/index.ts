/**
 * Compiler Passes — Public Exports
 *
 * 패스 실행 순서 (compiler.ts가 이 순서로 호출):
 *   flattenHierarchy → resolveTheme → planLayout → createScaleContext
 *   → computeConstraints → allocateBudgets → measureDiagram
 *   → allocateBounds → layout → routeEdges → emitIR
 *
 * 각 패스의 입출력 계약은 개별 패스 파일 상단 JSDoc 참조.
 */

export { resolveTheme } from './resolve-theme.js';
export { emitIR } from './emit-ir.js';
export { planDiagram, planNode } from './plan-layout.js';
export type { LayoutPlanNode, PlanNodeType, PlanMetrics, DiagramLayoutPlan } from './plan-layout.js';
export { allocateDiagram, runLayout, buildTreeNodes, computeLayoutChildren, redistributeWithMinimums } from './allocate-bounds.js';
export type { BoundsMap } from './allocate-bounds.js';
export { computeConstraints } from './compute-constraints.js';
export { allocateBudgets } from './allocate-budgets.js';
export type { NodeConstraint, ConstraintMap, NodeBudget, BudgetMap } from './budget-types.js';
export { computeTreeLevelInfo, computeFlowLayerInfo } from './layout-analysis.js';
export type { TreeLevelInfo, FlowLayerInfo } from './layout-analysis.js';
export { createScaleContext, computeBaseUnit, computeGap, computeFontSize, computePadding, countElements } from './scale-system.js';
export type { ScaleContext, GapType, TextRole } from './scale-system.js';
export { extractOverrides, applyOverridesToIR } from './apply-overrides.js';
export type { OverrideEntry, OverrideMap } from './apply-overrides.js';
