/**
 * compile-pipeline.test.ts — 루트 1회 파이프라인 검증
 *
 * S-pipeline MUST:
 *   - `computeConstraints` / `allocateBounds` — scene 루트당 정확히 1회
 *   - `allocateBudgets` / `measureDiagram` — `runBudgetMeasureFixpoint` 내부에서
 *     fixed-point 수렴 루프로 호출되므로 scene당 ≥1, ≤ MAX_ITER+1(=4)회.
 *     수렴 후 조기 종료되므로 일반적으로 2회 내외.
 *
 * scene이 N개이면 constraints/bounds는 N회, budgets/measure는 N~4N회 사이.
 */

import { vi, describe, it, expect, afterEach } from 'vitest';
import * as measureMod from '../../src/compiler/passes/measure.js';
import * as budgetsMod from '../../src/compiler/passes/allocate-budgets.js';
import * as constraintsMod from '../../src/compiler/passes/compute-constraints.js';
import * as boundsMod from '../../src/compiler/passes/allocate-bounds.js';
import { compile } from '../../src/compiler/compiler.js';
import { lightTheme } from '../../src/theme/builtin-themes.js';

afterEach(() => {
  vi.restoreAllMocks();
});

// MAX_ITER는 compiler.ts의 FIXPOINT_MAX_ITER와 일치해야 한다. 초기 1회 + 루프 본체 최대
// MAX_ITER회 = 총 최대 MAX_ITER+1회의 allocateBudgets/measureDiagram 호출을 허용한다.
const FIXPOINT_MAX_CALLS_PER_SCENE = 4; // MAX_ITER(3) + 1

describe('compile() — 루트 1회 파이프라인', () => {
  it('단일 node DSL → constraints/bounds는 1회, budgets/measure는 루프 상한(4) 이하', () => {
    const measureSpy = vi.spyOn(measureMod, 'measureDiagram');
    const budgetsSpy = vi.spyOn(budgetsMod, 'allocateBudgets');
    const constraintsSpy = vi.spyOn(constraintsMod, 'computeConstraints');
    const boundsSpy = vi.spyOn(boundsMod, 'allocateBounds');

    compile('node "A"', { theme: lightTheme });

    // constraints/bounds는 fixed-point 루프 밖 — scene당 정확히 1회.
    expect(constraintsSpy).toHaveBeenCalledTimes(1);
    expect(boundsSpy).toHaveBeenCalledTimes(1);

    // budgets/measure는 수렴 루프 내 — ≥1, ≤ MAX_ITER+1.
    expect(measureSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(measureSpy.mock.calls.length).toBeLessThanOrEqual(FIXPOINT_MAX_CALLS_PER_SCENE);
    expect(budgetsSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(budgetsSpy.mock.calls.length).toBeLessThanOrEqual(FIXPOINT_MAX_CALLS_PER_SCENE);
  });

  it('flow + 3 nodes → 단일 scene, budgets/measure는 루프 상한 이하', () => {
    const measureSpy = vi.spyOn(measureMod, 'measureDiagram');
    const budgetsSpy = vi.spyOn(budgetsMod, 'allocateBudgets');
    const constraintsSpy = vi.spyOn(constraintsMod, 'computeConstraints');

    compile(`
flow {
  node "A" #a
  node "B" #b
  node "C" #c
  #a -> #b
  #b -> #c
}`, { theme: lightTheme });

    expect(constraintsSpy).toHaveBeenCalledTimes(1);
    expect(measureSpy.mock.calls.length).toBeLessThanOrEqual(FIXPOINT_MAX_CALLS_PER_SCENE);
    expect(budgetsSpy.mock.calls.length).toBeLessThanOrEqual(FIXPOINT_MAX_CALLS_PER_SCENE);
  });

  it('2-scene DSL → constraints/bounds 2회, budgets/measure는 루프 상한×scene 이하', () => {
    const measureSpy = vi.spyOn(measureMod, 'measureDiagram');
    const budgetsSpy = vi.spyOn(budgetsMod, 'allocateBudgets');
    const constraintsSpy = vi.spyOn(constraintsMod, 'computeConstraints');
    const boundsSpy = vi.spyOn(boundsMod, 'allocateBounds');

    compile(`
scene "First" {
  node "A"
}
scene "Second" {
  node "B"
}`, { theme: lightTheme });

    // scene 2개 → constraints/bounds는 각각 정확히 2회.
    expect(constraintsSpy).toHaveBeenCalledTimes(2);
    expect(boundsSpy).toHaveBeenCalledTimes(2);

    // budgets/measure는 scene당 1~4회 → 총 2~8회.
    expect(measureSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(measureSpy.mock.calls.length).toBeLessThanOrEqual(2 * FIXPOINT_MAX_CALLS_PER_SCENE);
    expect(budgetsSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(budgetsSpy.mock.calls.length).toBeLessThanOrEqual(2 * FIXPOINT_MAX_CALLS_PER_SCENE);
  });

  it('compile() 결과에 오류 없이 유효한 IR이 반환됨', () => {
    const { ir, errors } = compile('node "Hello" #n1', { theme: lightTheme });

    expect(errors).toHaveLength(0);
    expect(ir.scenes).toHaveLength(1);
    expect(ir.scenes[0].elements.length).toBeGreaterThan(0);
  });
});
