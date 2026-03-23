/**
 * Structural Roles — Role-based size palette for natural layout
 *
 * Replaces uniform budget distribution with structure-aware weighting.
 * Algorithm sources:
 *   - Visual Salience (Cartography): importance = role in structure, not content size
 *   - Editorial Layout: element size ∝ reader dwell time in reading flow
 *   - Squarified Treemap spirit: PHI-based weights → golden-ratio aspect ratios
 *   - Accent Pattern (Musical rhythm): prevent monotone size sequences
 */

import type { LayoutPlanNode } from './plan-layout.js';
import type { TreeLevelInfo } from './layout-analysis.js';
import { computeFlowLayerInfo } from './layout-analysis.js';

// ---------------------------------------------------------------------------
// Size palette
// ---------------------------------------------------------------------------

const PHI = 1.618; // 황금비 φ

/**
 * 5단계 황금비 팔레트. 각 단계는 φ 배율로 증가한다.
 * 단위: 무차원 상대 가중치 (예산/bounds 배분 비율 계산에 사용).
 * PHI^0=1.0, PHI^1=1.618, PHI^2=2.618, PHI^3=4.236, PHI^4=6.854
 */
export const SIZE_PALETTE = {
  XS: 1.0,
  S:  PHI,       // 1.618
  M:  PHI ** 2,  // 2.618
  L:  PHI ** 3,  // 4.236
  XL: PHI ** 4,  // 6.854
} as const;

export type SizeStep = keyof typeof SIZE_PALETTE;

// ---------------------------------------------------------------------------
// Structural roles
// ---------------------------------------------------------------------------

export type StructuralRole =
  | 'root'        // tree 최상단 노드
  | 'branch'      // tree 중간 노드 (자식 있음)
  | 'leaf'        // tree/flow 끝단 노드
  | 'entry'       // flow 진입점 (in-degree = 0)
  | 'terminal'    // flow 종료점 (out-degree = 0)
  | 'junction'    // flow 분기/수렴점 (degree ≥ 3)
  | 'transform'   // flow 중심 변환 노드 (중간 레이어)
  | 'container'   // 시각적 컨테이너
  | 'cell'        // grid 셀
  | 'header-cell' // grid 헤더 셀
  | 'label-cell'; // grid 레이블 셀

const ROLE_TO_STEP: Record<StructuralRole, SizeStep> = {
  root: 'M',  branch: 'S',  container: 'M',
  transform: 'M',  junction: 'M',
  entry: 'S',  terminal: 'S',  leaf: 'S',
  cell: 'S',  'header-cell': 'S',  'label-cell': 'S',
};

// ---------------------------------------------------------------------------
// Role analysis
// ---------------------------------------------------------------------------

/**
 * Analyze structural roles for flow block children.
 *
 * - entry: in-degree = 0
 * - terminal: out-degree = 0
 * - junction: total degree ≥ 3 (branch/merge)
 * - transform: node in the center Sugiyama layer
 * - leaf: everything else
 */
export function analyzeFlowRoles(
  nodeIds: string[],
  edges: { fromId: string; toId: string }[],
): Map<string, StructuralRole> {
  const roles = new Map<string, StructuralRole>();
  if (nodeIds.length === 0) return roles;

  const inDeg = new Map<string, number>();
  const outDeg = new Map<string, number>();
  for (const id of nodeIds) { inDeg.set(id, 0); outDeg.set(id, 0); }
  for (const e of edges) {
    if (inDeg.has(e.fromId) && inDeg.has(e.toId)) {
      outDeg.set(e.fromId, (outDeg.get(e.fromId) ?? 0) + 1);
      inDeg.set(e.toId, (inDeg.get(e.toId) ?? 0) + 1);
    }
  }

  const layerInfo = computeFlowLayerInfo(nodeIds, edges);
  // 짝수 개 레이어면 후반부 첫 번째를 중심으로 취급 (floor → 후반부 쪽)
  const centerLayerIdx = Math.floor((layerInfo.layerCount - 1) / 2);

  for (const id of nodeIds) {
    const ind = inDeg.get(id) ?? 0;
    const outd = outDeg.get(id) ?? 0;
    const degree = ind + outd;
    if (ind === 0)          roles.set(id, 'entry');
    else if (outd === 0)    roles.set(id, 'terminal');
    else if (degree >= 3)   roles.set(id, 'junction');
    else if ((layerInfo.nodeLayer.get(id) ?? 0) === centerLayerIdx) roles.set(id, 'transform');
    else                    roles.set(id, 'leaf');
  }

  return roles;
}

/**
 * Analyze structural roles for tree block children.
 *
 * - root: no parent in the edge set
 * - branch: has outgoing edges (children)
 * - leaf: has parent but no children
 */
export function analyzeTreeRoles(
  nodeIds: string[],
  edges: { fromId: string; toId: string }[],
): Map<string, StructuralRole> {
  const roles = new Map<string, StructuralRole>();
  if (nodeIds.length === 0) return roles;

  const idSet = new Set(nodeIds);
  const hasParent = new Set<string>();
  const hasChild = new Set<string>();

  for (const e of edges) {
    if (idSet.has(e.fromId) && idSet.has(e.toId)) {
      hasChild.add(e.fromId);
      hasParent.add(e.toId);
    }
  }

  for (const id of nodeIds) {
    if (!hasParent.has(id))     roles.set(id, 'root');
    else if (hasChild.has(id))  roles.set(id, 'branch');
    else                        roles.set(id, 'leaf');
  }

  return roles;
}

// ---------------------------------------------------------------------------
// Weight calculation
// ---------------------------------------------------------------------------

/**
 * Convert structural role to a numeric size weight (relative, dimensionless).
 * Minor adjustment: leaf with long label (>15 chars) gets one step up.
 */
export function roleWeight(role: StructuralRole, node: LayoutPlanNode): number {
  let step = ROLE_TO_STEP[role];
  // 긴 라벨 leaf → 한 단계 상승 (S→M): 텍스트 공간 확보
  if (role === 'leaf' && (node.astNode.label?.length ?? 0) > 15) step = stepUp(step);
  return SIZE_PALETTE[step];
}

/**
 * Compute per-level weight array for tree layout.
 * Each level gets the maximum roleWeight among all nodes at that level.
 */
export function computeLevelWeights(
  levelInfo: TreeLevelInfo,
  children: LayoutPlanNode[],
  roles: Map<string, StructuralRole>,
): number[] {
  const weights = new Array<number>(levelInfo.numLevels).fill(SIZE_PALETTE.S);
  for (const c of children) {
    const level = levelInfo.nodeLevel.get(c.id) ?? 0;
    const role = roles.get(c.id) ?? 'leaf';
    const w = roleWeight(role, c);
    if (level < weights.length) weights[level] = Math.max(weights[level], w);
  }
  return weights;
}

/**
 * Distribute a total budget proportionally by weights.
 * Falls back to uniform if totalWeight is 0.
 */
export function distributeByWeights(weights: number[], total: number): number[] {
  const totalW = weights.reduce((s, w) => s + w, 0);
  if (totalW <= 0) return weights.map(() => total / Math.max(weights.length, 1));
  return weights.map(w => total * (w / totalW));
}

// ---------------------------------------------------------------------------
// Accent pattern constraint
// ---------------------------------------------------------------------------

/**
 * Post-process flow role weights to prevent monotone size sequences.
 * Inspired by Musical Rhythm accent principle: 작다-크다-작다 feels natural.
 *
 * Two adjustments:
 * 1. Clamp: max/min ratio capped at PHI^2 (≈2.618, 무차원 배율 상한)
 *    — prevents extreme size differences between siblings
 * 2. If strictly monotone → reorder to center-dominant pattern
 *    — ensures the visually dominant node sits in the middle
 *
 * Note: only applied to flow children. Tree level weights are naturally
 * decreasing (root→leaf) which IS the intended visual hierarchy.
 */
export function applyAccentPattern(weights: number[]): number[] {
  if (weights.length <= 2) return weights;

  let result = [...weights];

  // Step 1: Clamp max/min ratio to PHI^2
  const maxW = Math.max(...result);
  const minW = Math.min(...result);
  const MAX_RATIO = PHI ** 2; // 황금비 제곱 ≈ 2.618, 무차원 배율 상한
  if (minW > 0 && maxW / minW > MAX_RATIO) {
    const targetMin = maxW / MAX_RATIO;
    result = result.map(w => Math.max(w, targetMin));
  }

  // Step 2: If strictly monotone → center-dominant reorder
  if (isStrictlyMonotone(result)) {
    result = toCenterDominant(result);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function stepUp(step: SizeStep): SizeStep {
  const order: SizeStep[] = ['XS', 'S', 'M', 'L', 'XL'];
  const i = order.indexOf(step);
  return order[Math.min(i + 1, order.length - 1)];
}

function isStrictlyMonotone(arr: number[]): boolean {
  let inc = true;
  let dec = true;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] <= arr[i - 1]) inc = false;
    if (arr[i] >= arr[i - 1]) dec = false;
  }
  return inc || dec;
}

/**
 * Reorder weights so the largest value sits in the center position.
 * Remaining values fill outward alternately (right first, then left).
 * Example: [S, M, L] → [S, L, M]  (center=L, right=M, left=S)
 *          [S, S, M] → [S, M, S]  (center=M)
 */
function toCenterDominant(weights: number[]): number[] {
  const sorted = [...weights].sort((a, b) => b - a); // descending
  const result = new Array<number>(weights.length);
  const mid = Math.floor(weights.length / 2);
  result[mid] = sorted[0];
  let left = mid - 1;
  let right = mid + 1;
  let si = 1;
  while (si < sorted.length) {
    if (right < weights.length) { result[right++] = sorted[si++]; }
    if (si < sorted.length && left >= 0) { result[left--] = sorted[si++]; }
  }
  return result;
}
