/**
 * Plan 노드 가중치 — 튜닝 전용 파일.
 *
 * 사용자 요청: "weight는 언제든 조정하기 쉬운 구조로 구현해".
 * → 모든 가중치 상수를 이 파일에 모아두고, 튜닝 시 다른 파일을 건드리지 않게 한다.
 *

 * PR-1 Step C에서 `plan-all-element.ts` / `plan-all-block.ts`가 `computeWeight()`를
 * 호출하도록 연결되면서 실제 파이프라인에 진입한다.
 *
 * 참고: 옛 파이프라인의 `compiler/passes/plan-layout.ts::BASE_WEIGHT` / `computeWeight`와
 *      동일한 의미론을 16종 `PlanBlockType`에 맞춰 재매핑했다.
 *      (구 `block-canvas`=2.5 → `scene`=2.5, 구 `block-visual`=2.0 → `box`/`layer` 모두 2.0)
 */

import type { PlanBlockType, PlanMetrics } from './plan-types.js';

// ---------------------------------------------------------------------------
// BASE_WEIGHT — 16종 PlanBlockType의 기본 가중치
// ---------------------------------------------------------------------------

/**
 * 형제 노드 사이의 상대 budget 분배 가중치.
 *
 * 단위: dimensionless ratio. 0–100 좌표값이 아니라 `allocateBudgets`에서
 *       형제 weight 합 대비 비율로 사용된다 (예: weight 3.0 vs 1.5 → 2:1 분배).
 *
 * 도출 기준:
 *   - 옛 `plan-layout.ts::computeWeight()`의 `PlanNodeType`별 base 값을
 *     16종 `PlanBlockType`으로 매핑 (§3.4.2 표 + §3.4.3).
 *   - 기존 값 그대로 유지하여 회귀 0 보장:
 *       block-canvas → scene 2.5, block-flow → flow 3.0, block-tree → tree 3.5,
 *       block-stack → stack 2.5, block-grid → grid 3.0, block-group → group 2.0,
 *       block-layers → layers 3.0, block-visual → layer/box 모두 2.0,
 *       block-table → table 2.5, block-chart → chart 3.0.
 *   - element-text (0.6)는 row 흡수 후에도 그대로 — ISSUE G 결정.
 *     row를 element-row(1.0)로 분리하면 기존 element-text(0.6) 대비 +66% 회귀.
 *
 * 튜닝: 이 파일만 수정하면 된다. 테스트는 weight 절댓값을 검증하지 않고
 *       상대 순서 (예: `tree > flow > grid > stack`)만 검증해야 한다.
 */
export const BASE_WEIGHT: Record<PlanBlockType, number> = {
  // 구조 컨테이너 11종
  scene: 2.5, // 구 block-canvas 값 유지
  flow: 3.0,
  tree: 3.5, // 계층 분기가 많아 가장 큰 기본값
  stack: 2.5, // 구 block-stack + column 흡수
  grid: 3.0,
  group: 2.0,
  layers: 3.0, // 컨테이너
  layer: 2.0, // 구 block-visual 값 유지
  box: 2.0, // 구 block-visual 값 유지
  table: 2.5,
  chart: 3.0,
  // 리프 5종 (row는 element-text 안에 흡수, ISSUE G)
  'element-shape': 1.0,
  'element-text': 0.6, // row 포함
  'element-list': 1.2,
  'element-divider': 0.3,
  'element-image': 1.5,
};

// ---------------------------------------------------------------------------
// 가중치 다항식 계수 — content/depth 보정
// ---------------------------------------------------------------------------

/**
 * 가중치 다항식의 base 항. 모든 인자가 0일 때도 base 가중치가 살아남도록 1.
 *
 * 단위: dimensionless. `computeWeight` 공식의 `1 + ...` 항.
 */
export const CONTENT_MUL_BASE = 1;

/**
 * descendantCount의 `sqrt` 스케일 계수.
 *
 * 단위: dimensionless. 최종 가중치 = base × (1 + √descendantCount × COEF) × ...
 *
 * 도출 기준: 자손 수가 많을수록 더 큰 공간이 필요하지만 선형으로 커지면 거대 서브트리가
 *   형제 공간을 완전히 먹어버린다. sqrt로 감쇠시켜 완화. 계수 1은 옛 `plan-layout.ts`의
 *   동일 지점 값(= `1 + Math.sqrt(descendantCount)`)과 일치 — 회귀 0.
 */
export const CONTENT_MUL_SQRT = 1;

/**
 * `blockChildCount`(직계 블록 자식 수)의 선형 계수.
 *
 * 단위: dimensionless. 최종 가중치 = base × ... × (1 + blockChildCount × COEF) × ...
 *
 * 도출 기준: 리프가 아닌 블록 자식이 많을수록 내부에 또 다른 레이아웃이 돌아가므로
 *   추가 공간이 필요하다. 0.5는 옛 값 유지 (회귀 0).
 */
export const CONTENT_MUL_BLOCK = 0.5;

/**
 * 깊이 multiplier의 base 항. 최상단 노드(`maxDepth === 0`)도 감쇠되지 않도록 1.
 *
 * 단위: dimensionless.
 */
export const DEPTH_MUL_BASE = 1;

/**
 * `maxDepth`의 선형 계수.
 *
 * 단위: dimensionless. 최종 가중치 = base × content × (1 + maxDepth × COEF).
 *
 * 도출 기준: 깊이가 깊을수록 내부에 더 많은 여백/텍스트/연결선이 필요하다.
 *   0.2는 옛 값 유지 (회귀 0). 0.5 이상이면 깊은 서브트리가 과도하게 커진다.
 */
export const DEPTH_MUL_COEF = 0.2;

// ---------------------------------------------------------------------------
// computeWeight — 최종 가중치 산출
// ---------------------------------------------------------------------------

/**
 * 블록 타입과 구조 메트릭으로부터 상대 가중치를 계산한다.
 *
 * 공식:
 *   weight = BASE_WEIGHT[blockType]
 *          × (CONTENT_MUL_BASE + √descendantCount × CONTENT_MUL_SQRT)
 *          × (CONTENT_MUL_BASE + blockChildCount × CONTENT_MUL_BLOCK)
 *          × (DEPTH_MUL_BASE + maxDepth × DEPTH_MUL_COEF)
 *
 * 이 함수는 순수 함수다. 전역 상태나 캐시를 사용하지 않는다 (S-compiler MUST NOT).
 */
export function computeWeight(blockType: PlanBlockType, metrics: PlanMetrics): number {
  const base = BASE_WEIGHT[blockType];
  const contentMul =
    (CONTENT_MUL_BASE + Math.sqrt(metrics.descendantCount) * CONTENT_MUL_SQRT) *
    (CONTENT_MUL_BASE + metrics.blockChildCount * CONTENT_MUL_BLOCK);
  const depthMul = DEPTH_MUL_BASE + metrics.maxDepth * DEPTH_MUL_COEF;
  return base * contentMul * depthMul;
}
