/**
 * emit.test.ts — emit walker BoundsMap 조회 전용 검증
 *
 * S-pipeline MUST: "emit walker는 bounds 조회 외 어떤 분배 로직도 갖지 않는다."
 *
 * 파이프라인(plan → constraints → budgets → measure → bounds)으로 BoundsMap을 만들고
 * emit()에 직접 주입하여, 결과 IR이 BoundsMap에서 bounds를 그대로 반영하는지 검증한다.
 * compile() 전체를 쓰지 않고 각 패스를 직접 호출하여 단계별 의존성을 명시한다.
 */

import { describe, it, expect } from 'vitest';
import { emit } from '../../src/compiler/emit.js';
import { planDocument } from '../../src/compiler/layout/plan-all.js';
import { parse } from '../../src/compiler/parser.js';
import { resolveTheme } from '../../src/compiler/passes/resolve-theme.js';
import { flattenHierarchy } from '../../src/compiler/passes/flatten-hierarchy.js';
import { resolveData } from '../../src/compiler/data/resolve-data.js';
import { createScaleContext } from '../../src/compiler/passes/scale-system.js';
import { computeConstraints } from '../../src/compiler/passes/compute-constraints.js';
import { allocateBudgets } from '../../src/compiler/passes/allocate-budgets.js';
import { measureDiagram } from '../../src/compiler/passes/measure.js';
import { allocateBounds } from '../../src/compiler/passes/allocate-bounds.js';
import type { BoundsMap } from '../../src/compiler/passes/allocate-bounds.js';
import type { MeasureMap } from '../../src/compiler/passes/measure.js';
import { lightTheme } from '../../src/theme/builtin-themes.js';
import { defaultSceneTheme } from '../../src/theme/scene-theme.js';
import type { IRContainer } from '../../src/ir/types.js';

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

interface PipelineResult {
  plans: ReturnType<typeof planDocument>;
  boundsMap: BoundsMap;
  measureMap: MeasureMap;
}

function buildArtifacts(dsl: string): PipelineResult {
  const { ast } = parse(dsl);
  const resolved = resolveTheme(flattenHierarchy(resolveData(ast)), lightTheme);
  const plans = planDocument(resolved, lightTheme);
  const canvas = { x: 0, y: 0, w: 100, h: 100 };

  const allBounds: BoundsMap = new Map();
  const allMeasure: MeasureMap = new Map();

  for (const plan of plans) {
    const scaleCtx = createScaleContext(plan, canvas);
    const constraints = computeConstraints(plan, scaleCtx);
    const budgets = allocateBudgets(plan, canvas, constraints, scaleCtx);
    const measure = measureDiagram(plan, lightTheme, scaleCtx, budgets);
    const bounds = allocateBounds(plan, canvas, defaultSceneTheme, scaleCtx, measure, constraints);
    for (const [k, v] of bounds) allBounds.set(k, v);
    for (const [k, v] of measure) allMeasure.set(k, v);
  }

  return { plans, boundsMap: allBounds, measureMap: allMeasure };
}

// ---------------------------------------------------------------------------
// smoke test — 다양한 DSL 패턴
// ---------------------------------------------------------------------------

describe('emit() — BoundsMap 조회 전용 smoke test', () => {
  const patterns: [string, string][] = [
    ['단일 node', 'node "A"'],
    ['flow + edges', 'flow { node "A" #a\n node "B" #b\n #a -> #b }'],
    ['stack', 'stack { node "A"\n node "B"\n node "C" }'],
    ['grid', 'grid cols:2 { node "A"\n node "B"\n node "C"\n node "D" }'],
    ['scene with layout', 'scene { layout: full\n body: flow { node "A"\n node "B" } }'],
  ];

  for (const [name, dsl] of patterns) {
    it(`${name} → 모든 element.bounds가 정의된 숫자`, () => {
      const { plans, boundsMap, measureMap } = buildArtifacts(dsl);
      const scenes = emit(plans, boundsMap, lightTheme, defaultSceneTheme, measureMap);

      expect(scenes).toHaveLength(1);
      expect(scenes[0].elements.length).toBeGreaterThan(0);

      function checkBounds(elements: typeof scenes[0]['elements']): void {
        for (const el of elements) {
          expect(el.bounds).toBeDefined();
          expect(typeof el.bounds.x).toBe('number');
          expect(typeof el.bounds.y).toBe('number');
          expect(typeof el.bounds.w).toBe('number');
          expect(typeof el.bounds.h).toBe('number');
          expect(el.bounds.w).toBeGreaterThanOrEqual(0);
          expect(el.bounds.h).toBeGreaterThanOrEqual(0);
          if (el.type === 'container') {
            checkBounds((el as IRContainer).children);
          }
        }
      }
      checkBounds(scenes[0].elements);
    });
  }
});

// ---------------------------------------------------------------------------
// BoundsMap 일치 검증
// ---------------------------------------------------------------------------

describe('emit() — IR bounds는 BoundsMap과 일치', () => {
  it('scene-background는 유효한 양수 bounds를 가짐', () => {
    const { plans, boundsMap, measureMap } = buildArtifacts('node "A"');
    const scenes = emit(plans, boundsMap, lightTheme, defaultSceneTheme, measureMap);

    // elements[0]은 scene-background shape
    const bg = scenes[0].elements[0];
    expect(bg.type).toBe('shape');
    expect(bg.bounds.w).toBeGreaterThan(0);
    expect(bg.bounds.h).toBeGreaterThan(0);
  });

  it('BoundsMap 입력을 변경하지 않는다 (불변성)', () => {
    const { plans, boundsMap, measureMap } = buildArtifacts('node "A"');
    const originalSize = boundsMap.size;
    const snapshot = new Map(boundsMap);

    emit(plans, boundsMap, lightTheme, defaultSceneTheme, measureMap);

    expect(boundsMap.size).toBe(originalSize);
    for (const [k, v] of snapshot) {
      expect(boundsMap.get(k)).toEqual(v);
    }
  });

  it('2-scene DSL → scenes 배열 길이 2', () => {
    const dsl = `
scene "A" {
  node "First"
}
scene "B" {
  node "Second"
}`;
    const { plans, boundsMap, measureMap } = buildArtifacts(dsl);
    const scenes = emit(plans, boundsMap, lightTheme, defaultSceneTheme, measureMap);
    expect(scenes).toHaveLength(2);
  });
});
