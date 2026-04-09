/**
 * Emit walker — top-level 진입점.
 *
 * `compile()`이 root 단일 파이프라인(measure → allocateBudgets → computeConstraints
 * → allocateBounds)을 실행한 뒤, 그 결과(BoundsMap + 옵션 MeasureMap)와 함께
 * 이 함수를 호출한다. 이 함수는 PlanNode 트리를 한 번 순회하면서 IR을 만든다.
 *
 * 책임:
 *   - PlanNode[] (scene 단위) → IRScene[] 변환을 일괄 수행 (`emit`)
 *   - 단일 PlanNode → 단일 IRScene 변환 (`emitOne`)
 *
 * S-pipeline MUST 준수:
 *   - 이 함수와 walker들은 BoundsMap을 **조회만** 한다. 재측정/재배치 없음.
 *   - measure/allocate를 import하지 않는다 (타입만 import).
 *   - container 단위 핑퐁 금지: scene 안의 slot 안의 컨테이너 안의 컨테이너… 어디서도
 *     `createScaleContext`/`adaptBaseFontSize`를 호출하지 않는다.
 *
 * `compiler.ts::compile()`이 호출하는 emit 진입점.
 */

import type { IRScene } from '../ir/types.js';
import type { DepixTheme } from '../theme/types.js';
import type { SceneTheme } from '../theme/scene-theme.js';
import type { BoundsMap } from './passes/allocate-bounds.js';
import type { MeasureMap } from './passes/measure.js';
import type { PlanNode } from './layout/plan-types.js';
import type { ChartPositionsMap } from './passes/compute-chart-positions.js';
import { walkScene } from './emit-scene-walker.js';
import { walkBlock } from './emit-block-walker.js';
import { walkElement } from './emit-element-walker.js';

// ---------------------------------------------------------------------------
// emit — 다중 scene 진입점
// ---------------------------------------------------------------------------

/**
 * 여러 PlanNode(보통 문서의 scene 트리들) → IRScene[] 변환.
 *
 * 호출 전제:
 *   - `plans`의 모든 원소가 `blockType === 'scene'`이어야 한다.
 *   - `boundsMap`에 모든 scene 및 자손의 bounds가 미리 들어 있어야 한다.
 */
export function emit(
  plans: PlanNode[],
  boundsMap: BoundsMap,
  theme: DepixTheme,
  sceneTheme: SceneTheme,
  measureMap?: MeasureMap,
  chartPositionsMap?: ChartPositionsMap,
): IRScene[] {
  const scenes: IRScene[] = [];
  for (let i = 0; i < plans.length; i++) {
    scenes.push(emitOne(plans[i], boundsMap, theme, sceneTheme, measureMap, i, chartPositionsMap));
  }
  return scenes;
}

// ---------------------------------------------------------------------------
// emitOne — 단일 PlanNode 진입점
// ---------------------------------------------------------------------------

/**
 * 단일 PlanNode → 단일 IRScene 변환.
 *
 * 표준 경로는 `plan.blockType === 'scene'`이며 `walkScene`로 위임한다.
 * 비-scene 루트가 들어오는 경우는 planAll이 implicit scene으로 래핑해 주므로
 * 정상 흐름에서는 발생하지 않는다. 안전 폴백으로 단일 IRScene을 합성한다.
 */
export function emitOne(
  plan: PlanNode,
  boundsMap: BoundsMap,
  theme: DepixTheme,
  sceneTheme: SceneTheme,
  measureMap?: MeasureMap,
  index = 0,
  chartPositionsMap?: ChartPositionsMap,
): IRScene {
  if (plan.blockType === 'scene') {
    return walkScene(plan, boundsMap, theme, sceneTheme, measureMap, index, chartPositionsMap);
  }

  // 안전 폴백: scene이 아닌 루트가 직접 들어오면 단일 element/container를 감싼
  // 미니멀 IRScene으로 합성한다. 정상 호출자(planAll 경유)에서는 발생하지 않는다.
  const bounds = boundsMap.get(plan.id) ?? { x: 0, y: 0, w: 100, h: 100 };
  const inner = plan.blockType.startsWith('element-')
    ? walkElement(plan, bounds, theme, sceneTheme, measureMap, boundsMap)
    : walkBlock(plan, boundsMap, theme, sceneTheme, measureMap, chartPositionsMap);

  return {
    id: plan.label ?? plan.id ?? `scene-${index}`,
    background: { type: 'solid', color: sceneTheme.colors.background },
    elements: [inner],
    layout: { type: 'full' },
  };
}
