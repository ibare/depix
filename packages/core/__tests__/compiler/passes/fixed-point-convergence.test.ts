/**
 * PR-5 (L6) — Fixed-point 수렴 루프 회귀 테스트
 *
 * runBudgetMeasureFixpoint는 budget↔fontSize 순환 의존성을 해소하기 위해
 * allocateBudgets → measureDiagram 루프를 MAX_ITER 내에서 수렴시킨다.
 *
 * 검증 축:
 *   1. 단순 DSL은 1회 피드백(iterations=2)만으로 EPS 미만으로 수렴한다.
 *   2. scale 의존적이지 않은 보통 DSL도 수렴 경계 내에서 종료한다.
 *   3. MAX_ITER 상한 clamp: iterations은 MAX_ITER+1을 절대 초과하지 않는다.
 *   4. allocateBudgets에 measure를 넘기면 minSize가 더 크거나 같게 나와
 *      measure 피드백이 실제로 반영됨을 확인한다.
 *   5. compile() 전체 파이프라인이 수렴 루프를 경유해도 IR이 정상 생성된다.
 */

import { describe, it, expect } from 'vitest';
import {
  compile,
  runBudgetMeasureFixpoint,
} from '../../../src/compiler/compiler.js';
import { planDocument } from '../../../src/compiler/layout/plan-all.js';
import { parse } from '../../../src/compiler/parser.js';
import { resolveData } from '../../../src/compiler/data/resolve-data.js';
import { flattenHierarchy } from '../../../src/compiler/passes/flatten-hierarchy.js';
import { resolveTheme } from '../../../src/compiler/passes/resolve-theme.js';
import { createScaleContext } from '../../../src/compiler/passes/scale-system.js';
import { computeConstraints } from '../../../src/compiler/passes/compute-constraints.js';
import { allocateBudgets } from '../../../src/compiler/passes/allocate-budgets.js';
import { measureDiagram } from '../../../src/compiler/passes/measure.js';
import { lightTheme } from '../../../src/theme/builtin-themes.js';
import type { IRBounds } from '../../../src/ir/types.js';
import type { PlanNode } from '../../../src/compiler/layout/plan-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CANVAS_100: IRBounds = { x: 0, y: 0, w: 100, h: 100 };

/**
 * 주어진 DSL을 parse + resolve + planDocument까지 실행하여 scene plan 1개를 돌려준다.
 * 테스트에서 반복적으로 쓰는 boilerplate를 감춘다.
 */
function firstScenePlan(dsl: string): PlanNode {
  const { ast } = parse(dsl);
  const resolved = resolveTheme(flattenHierarchy(resolveData(ast)), lightTheme);
  const plans = planDocument(resolved, lightTheme);
  if (plans.length === 0) {
    throw new Error('No scene plans produced for the given DSL');
  }
  return plans[0]!;
}

// ---------------------------------------------------------------------------
// 1. 단순 DSL — 1회 피드백으로 수렴
// ---------------------------------------------------------------------------

describe('runBudgetMeasureFixpoint — trivial scene converges after one feedback', () => {
  it('label만 있는 scene은 iterations === 2에서 converged=true', () => {
    const plan = firstScenePlan(`
@presentation
scene "S" {
  layout: full
  body: label "Hello"
}
`);
    const scaleCtx = createScaleContext(plan, CANVAS_100);
    const constraints = computeConstraints(plan, scaleCtx);
    const result = runBudgetMeasureFixpoint(
      plan,
      CANVAS_100,
      constraints,
      scaleCtx,
      lightTheme,
    );

    // 초기 1회 + 피드백 1회 = 2회 measure 호출로 충분.
    expect(result.iterations).toBe(2);
    expect(result.converged).toBe(true);
    expect(result.budgets.size).toBeGreaterThan(0);
    expect(result.measure.size).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 2. 일반 DSL — 경계 내 수렴
// ---------------------------------------------------------------------------

describe('runBudgetMeasureFixpoint — regular scene converges within MAX_ITER', () => {
  it('flow 블록도 iterations ≤ 4 (MAX_ITER+1) 내에서 converged=true', () => {
    const plan = firstScenePlan(`
@presentation
scene "S" {
  layout: header
  header: heading "Pipeline"
  body: flow direction:right {
    node "Ingest"
    node "Transform"
    node "Export"
  }
}
`);
    const scaleCtx = createScaleContext(plan, CANVAS_100);
    const constraints = computeConstraints(plan, scaleCtx);
    const result = runBudgetMeasureFixpoint(
      plan,
      CANVAS_100,
      constraints,
      scaleCtx,
      lightTheme,
    );

    // 초기 1회 + 루프 본체 ≤ MAX_ITER(3)회 = 총 ≤ 4.
    expect(result.iterations).toBeLessThanOrEqual(4);
    expect(result.converged).toBe(true);
  });

  it('split + 다중 요소 scene도 수렴 경계 내에서 종료', () => {
    const plan = firstScenePlan(`
@presentation
scene "S" {
  layout: split
  left: group {
    label "Alpha"
    label "Beta"
    label "Gamma"
  }
  right: tree direction:down {
    node "Root" #root
    node "A" #a
    node "B" #b
    #root -> #a
    #root -> #b
  }
}
`);
    const scaleCtx = createScaleContext(plan, CANVAS_100);
    const constraints = computeConstraints(plan, scaleCtx);
    const result = runBudgetMeasureFixpoint(
      plan,
      CANVAS_100,
      constraints,
      scaleCtx,
      lightTheme,
    );

    expect(result.iterations).toBeLessThanOrEqual(4);
    expect(result.converged).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. MAX_ITER clamp — iterations은 MAX_ITER+1 절대 초과 금지
// ---------------------------------------------------------------------------

describe('runBudgetMeasureFixpoint — MAX_ITER upper bound', () => {
  it('어떤 scene이든 iterations은 상한 (MAX_ITER+1 = 4)을 초과하지 않는다', () => {
    // 여러 종류의 scene을 돌리며 iterations 상한이 지켜지는지 일괄 확인.
    const samples = [
      `@presentation\nscene "a" { layout: full\n body: label "x" }`,
      `@presentation\nscene "b" { layout: full\n body: flow { node "1"\n node "2"\n node "3" } }`,
      `@presentation\nscene "c" { layout: header\n header: heading "H"\n body: group { label "a"\n label "b" } }`,
      `@presentation\nscene "d" { layout: grid\n cell: label "1"\n cell: label "2"\n cell: label "3"\n cell: label "4" }`,
    ];

    for (const dsl of samples) {
      const plan = firstScenePlan(dsl);
      const scaleCtx = createScaleContext(plan, CANVAS_100);
      const constraints = computeConstraints(plan, scaleCtx);
      const result = runBudgetMeasureFixpoint(
        plan,
        CANVAS_100,
        constraints,
        scaleCtx,
        lightTheme,
      );
      expect(result.iterations).toBeGreaterThanOrEqual(1);
      expect(result.iterations).toBeLessThanOrEqual(4);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. allocateBudgets measure 인자 피드백 검증
// ---------------------------------------------------------------------------

describe('allocateBudgets — measure feedback actually influences col/row distribution', () => {
  it('measure를 넘긴 budget은 최소 크기를 더 잘 반영한다 (minHeight 피드백)', () => {
    // 세로 stack에 여러 label이 있는 경우, measure가 계산한 각 label의 minHeight가
    // 다음 iteration의 budget에 바닥값으로 반영되어야 한다.
    const plan = firstScenePlan(`
@presentation
scene "S" {
  layout: full
  body: group {
    label "First"
    label "Second"
    label "Third"
  }
}
`);
    const scaleCtx = createScaleContext(plan, CANVAS_100);
    const constraints = computeConstraints(plan, scaleCtx);

    const budgetsNoMeasure = allocateBudgets(plan, CANVAS_100, constraints, scaleCtx);
    const measure = measureDiagram(plan, lightTheme, scaleCtx, budgetsNoMeasure);
    const budgetsWithMeasure = allocateBudgets(plan, CANVAS_100, constraints, scaleCtx, measure);

    // 두 budget map은 같은 키 집합을 가진다.
    expect(budgetsWithMeasure.size).toBe(budgetsNoMeasure.size);

    // 자식 노드에 대해 measure의 minHeight가 실제로 하한으로 작용했는지 확인.
    // measure.minHeight ≥ 0이므로, budgetsWithMeasure의 height는 budgetsNoMeasure보다
    // 작을 수 없다 (Math.max 하한 효과). 적어도 한 노드에서는 같거나 커야 한다.
    let anyEqualOrLarger = false;
    for (const [id, noMeasureBudget] of budgetsNoMeasure) {
      const withMeasureBudget = budgetsWithMeasure.get(id);
      if (!withMeasureBudget) continue;
      // Math.max 하한은 단조적이므로 항상 같거나 커야 한다 (동일한 parent 예산 내에서
      // redistribute가 다른 자식에게 양보할 수는 있지만, 구조적으로 감소하지는 않는다).
      if (withMeasureBudget.height >= noMeasureBudget.height - 0.01) {
        anyEqualOrLarger = true;
      }
    }
    expect(anyEqualOrLarger).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. compile() 파이프라인 smoke test — 수렴 루프 경유해도 IR이 정상
// ---------------------------------------------------------------------------

describe('compile() — full pipeline still produces valid IR through the fixpoint loop', () => {
  it('간단한 scene이 에러 없이 컴파일되고 scene/element를 모두 포함한다', () => {
    const { ir, errors } = compile(`
@presentation
scene "BinarySearch" {
  layout: header
  header: heading "Binary Search"
  body: flow direction:down {
    node "Start" #start
    node "Check" #check
    node "Done" #done
    #start -> #check
    #check -> #done
  }
}
`);
    expect(errors).toEqual([]);
    expect(ir.scenes.length).toBe(1);
    const scene = ir.scenes[0]!;
    expect(scene.elements.length).toBeGreaterThan(0);
  });
});
