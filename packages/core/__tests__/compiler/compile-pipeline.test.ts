/**
 * compile-pipeline.test.ts — 루트 1회 파이프라인 검증
 *
 * S-pipeline MUST: "compile()은 measure/allocateBudgets/computeConstraints/allocateBounds를
 * 루트에서 1회씩 호출한다"를 spy로 검증한다.
 *
 * scene이 N개이면 각 패스가 N회 호출된다 (scene 하나당 1회씩). 이것이 의도된 동작이다.
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

describe('compile() — 루트 1회 파이프라인', () => {
  it('단일 node DSL → 각 패스가 정확히 1회 호출됨', () => {
    const measureSpy = vi.spyOn(measureMod, 'measureDiagram');
    const budgetsSpy = vi.spyOn(budgetsMod, 'allocateBudgets');
    const constraintsSpy = vi.spyOn(constraintsMod, 'computeConstraints');
    const boundsSpy = vi.spyOn(boundsMod, 'allocateBounds');

    compile('node "A"', { theme: lightTheme });

    expect(measureSpy).toHaveBeenCalledTimes(1);
    expect(budgetsSpy).toHaveBeenCalledTimes(1);
    expect(constraintsSpy).toHaveBeenCalledTimes(1);
    expect(boundsSpy).toHaveBeenCalledTimes(1);
  });

  it('flow + 3 nodes → 각 패스가 정확히 1회 호출됨 (단일 scene)', () => {
    const measureSpy = vi.spyOn(measureMod, 'measureDiagram');
    const budgetsSpy = vi.spyOn(budgetsMod, 'allocateBudgets');

    compile(`
flow {
  node "A" #a
  node "B" #b
  node "C" #c
  #a -> #b
  #b -> #c
}`, { theme: lightTheme });

    expect(measureSpy).toHaveBeenCalledTimes(1);
    expect(budgetsSpy).toHaveBeenCalledTimes(1);
  });

  it('2-scene DSL → 각 패스가 정확히 2회 호출됨 (scene 수 비례)', () => {
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

    expect(measureSpy).toHaveBeenCalledTimes(2);
    expect(budgetsSpy).toHaveBeenCalledTimes(2);
    expect(constraintsSpy).toHaveBeenCalledTimes(2);
    expect(boundsSpy).toHaveBeenCalledTimes(2);
  });

  it('compile() 결과에 오류 없이 유효한 IR이 반환됨', () => {
    const { ir, errors } = compile('node "Hello" #n1', { theme: lightTheme });

    expect(errors).toHaveLength(0);
    expect(ir.scenes).toHaveLength(1);
    expect(ir.scenes[0].elements.length).toBeGreaterThan(0);
  });
});
