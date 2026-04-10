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
import type { PlanNode } from '../layout/plan-types.js';

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

// ---------------------------------------------------------------------------
// Post-allocation text sizing utilities
// ---------------------------------------------------------------------------

// 0.55: 프로포셔널 폰트의 평균 문자 너비 ≈ fontSize × 0.55 (실측 기반 근삿값)
const AVG_CHAR_WIDTH_RATIO = 0.55;
// 0.15: 노드 너비의 양측 15%씩 수평 패딩 여백 (텍스트 끝–경계 간격 확보)
const TEXT_PADDING_H_RATIO = 0.15;
// 1.8: line-height 기본값(1.4) + 상하 여백 여유(0.4). 텍스트 블록 높이 산출에 사용
export const TEXT_BLOCK_MULTIPLIER = 1.8;

/**
 * Adjust fontSize based on label text length.
 * Short text (1-4 chars): reduce to prevent oversized appearance.
 * Long text (8+ chars): sqrt decay to prevent overflow.
 */
export function applyTextLengthPenalty(fontSize: number, label?: string): number {
  if (!label || label.length === 0) return fontSize;

  const len = label.length;

  // Short text penalty: 1→0.70, 2→0.78, 3→0.86, 4→0.95
  const shortPenalty = len <= 4 ? 0.62 + len * 0.082 : 1.0;

  // Long text decay: sqrt(6 / len) for 8+ chars
  const longPenalty = len > 7 ? Math.sqrt(6 / len) : 1.0;

  return fontSize * Math.min(shortPenalty, longPenalty);
}

/**
 * Shrink fontSize if the estimated text width exceeds the available node width.
 */
export function clampFontToFit(fontSize: number, label: string | undefined, nodeWidth: number): number {
  if (!label || label.length === 0 || nodeWidth <= 0) return fontSize;
  const availableWidth = nodeWidth * (1 - TEXT_PADDING_H_RATIO * 2);
  const estimatedTextWidth = fontSize * label.length * AVG_CHAR_WIDTH_RATIO;
  if (estimatedTextWidth <= availableWidth) return fontSize;
  return fontSize * (availableWidth / estimatedTextWidth);
}

/**
 * Compute fontSize for an element based on its final allocated bounds.
 * Called AFTER layout allocation in the resolveFonts pass.
 *
 * @param boundsW  — 요소의 최종 할당 너비 (0–100 상대 좌표)
 * @param boundsH  — 요소의 최종 할당 높이 (0–100 상대 좌표)
 * @param role     — 텍스트 역할 (innerLabel, standaloneText, listItem 등)
 * @param label    — 요소 라벨 (텍스트 길이 기반 보정에 사용)
 * @param fontScale — 요소 타입별 폰트 배율 (heading: 1.5, 기본: 1.0)
 */
export function computeBoundsFontSize(
  boundsW: number,
  boundsH: number,
  role: TextRole,
  label?: string,
  fontScale: number = 1,
): number {
  const shortSide = Math.min(boundsW, boundsH);
  if (shortSide <= 0) return FONT_SIZE_MIN;
  const base = computeFontSize(shortSide, role) * fontScale;
  const adjusted = applyTextLengthPenalty(base, label);
  return clampFontToFit(adjusted, label, boundsW);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a ScaleContext from a scene layout plan and canvas bounds.
 */
export function createScaleContext(
  plan: PlanNode,
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
 * fontSize = max(containerShortSide * TEXT_ROLE_RATIO[role], FONT_SIZE_MIN)
 */
export function computeFontSize(
  containerShortSide: number,
  textRole: TextRole,
): number {
  const ratio = TEXT_ROLE_RATIO[textRole];
  return Math.max(containerShortSide * ratio, FONT_SIZE_MIN);
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
export function countElements(plan: PlanNode): number {
  return Math.max(countNodeLeaves(plan), 1);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function countNodeLeaves(node: PlanNode): number {
  if (node.children.length === 0) {
    // List items are visually distinct elements that contribute to density
    if (node.elementType === 'list' || node.elementType === 'bullet') {
      return Math.max(node.items?.length ?? 1, 1);
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
