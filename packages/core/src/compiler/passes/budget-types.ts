/**
 * Budget System Types
 *
 * Types for the 2-pass budget system:
 *   Pass 1 (bottom-up): computeConstraints → ConstraintMap
 *   Pass 2 (top-down):  allocateBudgets   → BudgetMap
 */

export interface NodeConstraint {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
}

export type ConstraintMap = Map<string, NodeConstraint>;

export interface NodeBudget {
  width: number;
  height: number;
}

export type BudgetMap = Map<string, NodeBudget>;
