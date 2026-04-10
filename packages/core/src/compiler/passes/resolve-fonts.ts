/**
 * Compiler Pass — Resolve Fonts (Post-allocation)
 *
 * allocateBounds 이후 실행. 각 요소의 최종 할당 bounds를 기반으로
 * fontSize를 결정한다. measure 패스에서 budget 기반으로 추정했던
 * fontSize를 실제 도형 크기에 맞게 재산출한다.
 *
 * 우선순위: (1) user-specified font-size → (2) bounds 기반 computeBoundsFontSize
 *
 * Pipeline: PlanNode + BoundsMap + MeasureMap → MeasureMap (새 Map 반환)
 */

import type { PlanNode } from '../layout/plan-types.js';
import type { BoundsMap } from './allocate-bounds.js';
import type { MeasureMap, MeasureResult } from './measure.js';
import type { TextRole } from './scale-system.js';
import { computeBoundsFontSize } from './scale-system.js';
import { getElementConfig } from '../element-type-registry.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve fontSize for all elements based on their final allocated bounds.
 * Returns a new MeasureMap with updated fontSize values.
 * User-specified font-size (inline style) entries are preserved as-is.
 */
export function resolveFonts(
  plans: PlanNode[],
  boundsMap: BoundsMap,
  measureMap: MeasureMap,
): MeasureMap {
  // 기존 MeasureMap을 복사 (순수성 보장)
  const result: MeasureMap = new Map();
  for (const [id, m] of measureMap) {
    result.set(id, { ...m });
  }

  for (const plan of plans) {
    for (const child of plan.children) {
      resolveNode(child, boundsMap, result);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Internal: recursive font resolution
// ---------------------------------------------------------------------------

function resolveNode(
  plan: PlanNode,
  boundsMap: BoundsMap,
  measureMap: MeasureMap,
): void {
  // Recurse children first (bottom-up is not required, but consistent with measure)
  for (const child of plan.children) {
    resolveNode(child, boundsMap, measureMap);
  }

  // Only process element nodes
  if (!plan.blockType.startsWith('element-')) return;
  if (!plan.elementType) return;

  const m = measureMap.get(plan.id);
  if (!m) return;

  // User-specified font-size: measure에서 이미 올바르게 설정됨 — 건너뜀
  if (typeof plan.style['font-size'] === 'number') return;

  const bounds = boundsMap.get(plan.id);
  if (!bounds) return;

  const config = getElementConfig(plan.elementType);
  const role = measureKindToTextRole(config.measure);
  const fontSize = computeBoundsFontSize(
    bounds.w,
    bounds.h,
    role,
    plan.label,
    config.fontScale,
  );

  m.fontSize = fontSize;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map element type registry's measure kind to TextRole for fontSize computation.
 *
 * - 'text' (heading, label 등) → 'standaloneText' (0.25 ratio)
 * - 'list' (list, bullet)      → 'listItem' (0.20 ratio)
 * - 'shape', 'row' 등          → 'innerLabel' (0.30 ratio)
 */
function measureKindToTextRole(measure: string): TextRole {
  switch (measure) {
    case 'text': return 'standaloneText';
    case 'list': return 'listItem';
    default: return 'innerLabel';
  }
}
