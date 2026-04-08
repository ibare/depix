/**
 * PR-2 (L3) 회귀 매트릭스 — `computeLayoutChildren`이 모든 block-type case에서
 * `measureMap`의 minWidth/minHeight를 floor로 존중하는지 검증한다.
 *
 * 검증 원칙:
 *   1. measureMap 미제공 시: 결과가 변경되지 않는다 (PHI/SHAPE_PREFERRED_RATIO 보존).
 *   2. measureMap 제공 시: 자식 size ≥ measureMap의 min (heuristic 결과보다 큰 경우).
 *   3. 입력 불변성: PlanNode와 MeasureMap snapshot이 호출 전후 동일하다.
 *
 * 좌표 하드코딩을 피하고 모두 `toBeGreaterThanOrEqual`/`toBeLessThanOrEqual`
 * 같은 불변식 단언을 사용한다.
 */

import { describe, it, expect } from 'vitest';
import { computeLayoutChildren } from '../../../src/compiler/passes/allocate-bounds.js';
import type { MeasureResult } from '../../../src/compiler/passes/measure.js';
import {
  CANVAS,
  buildMeasureMap,
  defaultMeasure,
  makeBlockPlan,
  makeEdge,
} from './allocate-bounds-test-helpers.js';

// ---------------------------------------------------------------------------
// 1. measureMap 미제공 회귀 — heuristic 결과 보존
// ---------------------------------------------------------------------------

describe('computeLayoutChildren — measureMap 미제공 시 회귀', () => {
  const blockTypes = ['stack', 'grid', 'flow', 'tree', 'layers', 'group', 'box', 'layer'] as const;

  for (const bt of blockTypes) {
    it(`${bt}: measureMap 없이 호출해도 반환 형태가 일관되다`, () => {
      const plan = makeBlockPlan(bt, ['a', 'b', 'c']);
      const result = computeLayoutChildren(plan, CANVAS);
      expect(result).toHaveLength(plan.children.length);
      for (const r of result) {
        expect(r.width).toBeGreaterThan(0);
        expect(r.height).toBeGreaterThan(0);
      }
    });

    it(`${bt}: measureMap=undefined 결과는 빈 measureMap 결과와 동일하다`, () => {
      const plan = makeBlockPlan(bt, ['a', 'b']);
      const undefResult = computeLayoutChildren(plan, CANVAS);
      const emptyResult = computeLayoutChildren(plan, CANVAS, undefined, new Map());
      expect(emptyResult).toHaveLength(undefResult.length);
      for (let i = 0; i < undefResult.length; i++) {
        expect(emptyResult[i].width).toBeCloseTo(undefResult[i].width, 5);
        expect(emptyResult[i].height).toBeCloseTo(undefResult[i].height, 5);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 2. measureMap floor 존중 — 6 케이스 매트릭스
// ---------------------------------------------------------------------------

describe('computeLayoutChildren — measureMap minWidth/minHeight floor', () => {
  describe('grid', () => {
    it('per-cell measureMap minWidth/minHeight가 cellW/cellH보다 크면 floor가 적용된다', () => {
      // 4 children, 2 cols → 2 rows. Heuristic cellW/cellH ≈ 50, 50 (gap 무시 시)
      const plan = makeBlockPlan('grid', ['a', 'b', 'c', 'd'], [], { cols: 2, gap: 0 });
      const big = 80;
      const measureMap = buildMeasureMap(plan, () => defaultMeasure({ minWidth: big, minHeight: big }));

      const result = computeLayoutChildren(plan, CANVAS, undefined, measureMap);
      for (const r of result) {
        expect(r.width).toBeGreaterThanOrEqual(big);
        expect(r.height).toBeGreaterThanOrEqual(big);
      }
    });

    it('measureMap minWidth/minHeight가 cellW/cellH보다 작으면 cellW/cellH를 유지한다', () => {
      const plan = makeBlockPlan('grid', ['a', 'b', 'c', 'd'], [], { cols: 2, gap: 0 });
      const baseline = computeLayoutChildren(plan, CANVAS);
      const measureMap = buildMeasureMap(plan, () => defaultMeasure({ minWidth: 1, minHeight: 1 }));
      const withMeasure = computeLayoutChildren(plan, CANVAS, undefined, measureMap);
      for (let i = 0; i < baseline.length; i++) {
        expect(withMeasure[i].width).toBeCloseTo(baseline[i].width, 5);
        expect(withMeasure[i].height).toBeCloseTo(baseline[i].height, 5);
      }
    });
  });

  describe('flow', () => {
    it('horizontal flow에서 measure minHeight가 PHI uniformCross보다 크면 height가 측정값을 따른다', () => {
      const plan = makeBlockPlan('flow', ['a', 'b', 'c'], [], { direction: 'right', gap: 0 });
      const big = 70;
      const measureMap = buildMeasureMap(plan, () => defaultMeasure({ minHeight: big }));

      const result = computeLayoutChildren(plan, CANVAS, undefined, measureMap);
      for (const r of result) {
        expect(r.height).toBeGreaterThanOrEqual(big);
      }
    });

    it('vertical flow에서 measure minWidth가 cross보다 크면 width가 측정값을 따른다', () => {
      const plan = makeBlockPlan('flow', ['a', 'b'], [], { direction: 'down', gap: 0 });
      const big = 80;
      const measureMap = buildMeasureMap(plan, () => defaultMeasure({ minWidth: big }));

      const result = computeLayoutChildren(plan, CANVAS, undefined, measureMap);
      for (const r of result) {
        expect(r.width).toBeGreaterThanOrEqual(big);
      }
    });
  });

  describe('tree', () => {
    it('vertical tree에서 measure minHeight가 nodeMain보다 크면 floor가 적용된다', () => {
      const plan = makeBlockPlan('tree', ['r', 'c1', 'c2'], [makeEdge('r', 'c1'), makeEdge('r', 'c2')], { direction: 'down' });
      const big = 60;
      const measureMap = buildMeasureMap(plan, () => defaultMeasure({ minHeight: big }));

      const result = computeLayoutChildren(plan, CANVAS, undefined, measureMap);
      for (const r of result) {
        expect(r.height).toBeGreaterThanOrEqual(big);
      }
    });

    it('horizontal tree에서 measure minWidth가 floor로 적용된다', () => {
      const plan = makeBlockPlan('tree', ['r', 'c1'], [makeEdge('r', 'c1')], { direction: 'right' });
      const big = 60;
      const measureMap = buildMeasureMap(plan, () => defaultMeasure({ minWidth: big }));

      const result = computeLayoutChildren(plan, CANVAS, undefined, measureMap);
      for (const r of result) {
        expect(r.width).toBeGreaterThanOrEqual(big);
      }
    });
  });

  describe('layers', () => {
    it('measure minHeight가 layerH보다 크면 floor가 적용된다', () => {
      const plan = makeBlockPlan('layers', ['l1', 'l2', 'l3', 'l4']);
      const big = 50;
      const measureMap = buildMeasureMap(plan, () => defaultMeasure({ minHeight: big }));

      const result = computeLayoutChildren(plan, CANVAS, undefined, measureMap);
      for (const r of result) {
        expect(r.height).toBeGreaterThanOrEqual(big);
      }
    });

    it('measure minWidth가 bounds.w보다 크면 width가 floor를 따른다', () => {
      const plan = makeBlockPlan('layers', ['l1', 'l2']);
      const big = CANVAS.w + 20;
      const measureMap = buildMeasureMap(plan, () => defaultMeasure({ minWidth: big }));

      const result = computeLayoutChildren(plan, CANVAS, undefined, measureMap);
      for (const r of result) {
        expect(r.width).toBeGreaterThanOrEqual(big);
      }
    });
  });

  describe('group', () => {
    it('weight 분배 결과가 measure minHeight보다 작으면 measure가 floor가 된다', () => {
      const plan = makeBlockPlan('group', ['a', 'b', 'c', 'd', 'e']);
      const big = 40;
      const measureMap = buildMeasureMap(plan, () => defaultMeasure({ minHeight: big }));

      const result = computeLayoutChildren(plan, CANVAS, undefined, measureMap);
      for (const r of result) {
        expect(r.height).toBeGreaterThanOrEqual(big);
      }
    });

    it('shape preferred ratio 결과가 measure minWidth보다 작으면 measure가 floor가 된다', () => {
      const plan = makeBlockPlan('group', ['a', 'b']);
      const big = 90;
      const measureMap = buildMeasureMap(plan, () => defaultMeasure({ minWidth: big }));

      const result = computeLayoutChildren(plan, CANVAS, undefined, measureMap);
      for (const r of result) {
        expect(r.width).toBeGreaterThanOrEqual(big);
      }
    });
  });

  describe('box / layer', () => {
    for (const bt of ['box', 'layer'] as const) {
      it(`${bt}: measure minWidth가 bounds.w보다 크면 width가 floor를 따른다`, () => {
        const plan = makeBlockPlan(bt, ['a', 'b']);
        const big = CANVAS.w + 25;
        const measureMap = buildMeasureMap(plan, () => defaultMeasure({ minWidth: big }));

        const result = computeLayoutChildren(plan, CANVAS, undefined, measureMap);
        for (const r of result) {
          expect(r.width).toBeGreaterThanOrEqual(big);
        }
      });

      it(`${bt}: measure minHeight가 height로 사용된다 (intrinsic 폴백 위)`, () => {
        const plan = makeBlockPlan(bt, ['a', 'b']);
        const big = 30;
        const measureMap = buildMeasureMap(plan, () => defaultMeasure({ minHeight: big }));

        const result = computeLayoutChildren(plan, CANVAS, undefined, measureMap);
        for (const r of result) {
          expect(r.height).toBeGreaterThanOrEqual(big);
        }
      });
    }
  });
});

// ---------------------------------------------------------------------------
// 3. 입력 불변성 — PlanNode/MeasureMap이 호출 전후 동일
// ---------------------------------------------------------------------------

describe('computeLayoutChildren — 입력 불변성', () => {
  it('PlanNode를 mutate하지 않는다', () => {
    const plan = makeBlockPlan('flow', ['a', 'b', 'c']);
    const before = JSON.stringify(plan);
    const measureMap = buildMeasureMap(plan, () => defaultMeasure({ minWidth: 30, minHeight: 20 }));
    computeLayoutChildren(plan, CANVAS, undefined, measureMap);
    expect(JSON.stringify(plan)).toBe(before);
  });

  it('MeasureMap을 mutate하지 않는다', () => {
    const plan = makeBlockPlan('grid', ['a', 'b', 'c', 'd'], [], { cols: 2 });
    const measureMap = buildMeasureMap(plan, () => defaultMeasure({ minWidth: 30, minHeight: 30 }));
    const snapshot = new Map<string, MeasureResult>();
    measureMap.forEach((v, k) => snapshot.set(k, { ...v }));

    computeLayoutChildren(plan, CANVAS, undefined, measureMap);

    expect(measureMap.size).toBe(snapshot.size);
    for (const [k, v] of snapshot) {
      const after = measureMap.get(k);
      expect(after).toBeDefined();
      expect(after).toEqual(v);
    }
  });
});
