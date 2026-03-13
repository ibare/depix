/**
 * Scale System — Dynamic size/spacing/font calculation
 *
 * Computes a unified baseUnit from canvas area and element count,
 * then derives gap, fontSize, and padding values dynamically.
 *
 * Design principles:
 * - Existing layout function signatures unchanged
 * - Public compile() API unchanged
 * - IR output format unchanged
 * - DSL explicit values (gap, font-size) always take priority
 */

import type { IRBounds } from '../../ir/types.js';
import type { LayoutPlanNode, DiagramLayoutPlan } from './plan-layout.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GapType = 'innerPadding' | 'childGap' | 'siblingGap' | 'connectorGap' | 'sectionGap';
export type TextRole = 'innerLabel' | 'standaloneText' | 'listItem' | 'edgeLabel';

export interface ScaleContext {
  baseUnit: number;
  elementCount: number;
  canvasArea: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// baseUnit = sqrt(canvasArea / elementCount) * DENSITY_FACTOR
// 0.55: 요소 평균 점유율 ~30%일 때 적절한 폰트·간격 스케일을 내도록 실측 튜닝된 값
const DENSITY_FACTOR = 0.55;

const GAP_RATIO: Record<GapType, number> = {
  // baseUnit × ratio = 해당 간격 크기. 단위: 캔버스 0–100 상대 좌표
  innerPadding: 0.06,   // 요소 내부 여백. 폰트 크기의 약 2배 여백 확보
  childGap:     0.03,   // 부모–자식 간격. innerPadding 절반 (계층 구조 강조)
  siblingGap:   0.10,   // 형제 간격. innerPadding보다 커야 그루핑이 시각적으로 드러남
  connectorGap: 0.15,   // 엣지 연결 간격. 화살표 헤드 공간 확보
  sectionGap:   0.12,   // 섹션 경계 간격. siblingGap과 connectorGap 사이 중간값
};

const GAP_CLAMP: Record<GapType, { min: number; max: number }> = {
  // 극소·극대 캔버스에서 ratio 기반 값이 너무 작거나 커지는 것을 방지하는 절댓값 한계
  // 단위: 캔버스 100 기준 상대 좌표 (예: 1.0 = 캔버스 너비의 1%)
  innerPadding: { min: 1.0, max: 5.0 },
  childGap:     { min: 0.5, max: 3.0 },
  siblingGap:   { min: 1.5, max: 6.0 },
  connectorGap: { min: 2.5, max: 8.0 },
  sectionGap:   { min: 2.0, max: 7.0 },
};

const TEXT_ROLE_RATIO: Record<TextRole, number> = {
  // fontSize = containerShortSide × ratio. 역할별 가독성 기준으로 튜닝된 비율
  innerLabel:     0.30, // 박스 내부 라벨: 컨테이너 대비 작은 텍스트
  standaloneText: 0.25, // 독립 텍스트 요소: 더 작은 기본 크기
  listItem:       0.20, // 목록 항목: 여러 줄 표시를 위해 가장 작게
  edgeLabel:      0.60, // 엣지 라벨: 연결 의미 전달을 위해 의도적으로 크게
};

// 폰트 크기 하한 (0–100 상대 좌표 기준). 0.6 미만 ≈ ~3px 이하 → 렌더링 불가
const FONT_SIZE_MIN = 0.6;

const FONT_SIZE_MAX_BY_ROLE: Record<TextRole, number> = {
  innerLabel: 4.0,       // ~22px at 1000×560 viewport
  standaloneText: 3.5,   // ~20px
  listItem: 2.5,         // ~14px
  edgeLabel: 2.0,        // ~11px
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a ScaleContext from a scene layout plan and canvas bounds.
 */
export function createScaleContext(
  plan: DiagramLayoutPlan,
  canvasBounds: IRBounds,
): ScaleContext {
  const canvasArea = canvasBounds.w * canvasBounds.h;
  const elementCount = countElements(plan);
  const baseUnit = computeBaseUnit(canvasArea, elementCount);
  return { baseUnit, elementCount, canvasArea };
}

/**
 * Compute the base unit from canvas area and element count.
 *
 * baseUnit = sqrt(canvasArea / elementCount) * densityFactor
 */
export function computeBaseUnit(
  canvasArea: number,
  elementCount: number,
  densityFactor: number = DENSITY_FACTOR,
): number {
  const count = Math.max(elementCount, 1);
  return Math.sqrt(canvasArea / count) * densityFactor;
}

/**
 * Compute a gap value for a given type based on baseUnit.
 *
 * gap = clamp(baseUnit * GAP_RATIO[type], min, max)
 */
export function computeGap(baseUnit: number, gapType: GapType): number {
  const ratio = GAP_RATIO[gapType];
  const { min, max } = GAP_CLAMP[gapType];
  return clamp(baseUnit * ratio, min, max);
}

/**
 * Compute font size based on container short side and text role.
 *
 * fontSize = clamp(containerShortSide * TEXT_ROLE_RATIO[role], min, max)
 */
export function computeFontSize(
  containerShortSide: number,
  textRole: TextRole,
): number {
  const ratio = TEXT_ROLE_RATIO[textRole];
  const max = FONT_SIZE_MAX_BY_ROLE[textRole];
  return clamp(containerShortSide * ratio, FONT_SIZE_MIN, max);
}

/**
 * Compute padding — alias for computeGap(baseUnit, 'innerPadding').
 */
export function computePadding(baseUnit: number): number {
  return computeGap(baseUnit, 'innerPadding');
}

/**
 * Count leaf elements in a plan (non-block nodes without children).
 * Returns at least 1 to avoid division by zero.
 */
export function countElements(plan: DiagramLayoutPlan): number {
  let count = 0;
  for (const child of plan.children) {
    count += countNodeLeaves(child);
  }
  return Math.max(count, 1);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function countNodeLeaves(node: LayoutPlanNode): number {
  if (node.children.length === 0) {
    // List items are visually distinct elements that contribute to density
    if (node.astNode.kind === 'element' && node.astNode.elementType === 'list') {
      return Math.max(node.astNode.items?.length ?? 1, 1);
    }
    return 1;
  }
  let count = 0;
  for (const child of node.children) {
    count += countNodeLeaves(child);
  }
  return count;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
