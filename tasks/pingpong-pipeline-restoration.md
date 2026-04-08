# 핑퐁 파이프라인 복원 — Container 단위 measure/budget 복구

## 배경

### 발견 경위
사용자가 `@page 4:3, scene { layout: full, body: flow { ... } }` (Binary Search flowchart) DSL에서
"수직 공간 활용 부족" 증상을 보고. layout이 `full`임에도 flow 노드가 cross 축에서 작게 그려지고
위아래에 빈 공간이 생기는 문제.

### Git 고고학 결과
- `742b742` (03-06): `measure.ts` 도입 — 옛 `emitIR()` 안에서 정상 호출됨
- `bb2c085` (03-07): `allocate-budgets.ts` 도입 — 옛 `emitIR()` 안에서 정상 호출됨
- `8dd856f` (03-10): `emitInlineBlock` 신규 도입 — **첫 커밋부터 `measureMap = new Map()`**
- `b7aa975` (03-16): "unify DSL pipeline via AST normalization" — scene 통합, 두 진입점 공존
- `b71a0c5` (04-06): "emitIR 레거시 제거" — `allocateBudgets/measureDiagram` 호출 0건이 됨

→ 핑퐁은 _옛 진입점에서는_ 정상 작동했고, _새 scene 진입점에서는 첫날부터 끊겨_ 있었음.
   레거시 정리 시점에 활성 호출도 함께 사라짐.

### 4계층 컨셉과의 정합성
사용자 의도 아키텍처: `Scene > Layout(슬롯) > Container > Element/Container 중첩`
- Scene/Layout: layout preset이 결정 — 핑퐁 영역 밖
- **Container**: 자식 needs를 받아 분배 — ★ 핑퐁의 캔버스
- Element: 핑퐁이 needs를 측정하는 leaf

핑퐁의 스코프는 _한 컨테이너 단위_. 그 자리는 정확히 `emitInlineBlock` 안.
슬롯 bounds가 그 컨테이너의 캔버스 역할.

---

## 조사 확정 사실 (코드 직독)

### `measureDiagram` (`passes/measure.ts:65`)
- 시그니처: `(plan, theme, scaleCtx?, budgetMap?) → MeasureMap`
- BFS 재귀, leaf → root 자연 크기 산출. 그대로 호출 가능.

### `allocateBudgets` (`passes/allocate-budgets.ts:23`)
- 시그니처: `(plan, canvasBounds, constraints, scaleCtx) → BudgetMap`
- **이미 임의 bounds를 받도록 설계**되어 있음 — 슬롯 bounds를 그대로 전달 가능
- `allocateTreeFlowBudgets` (316행)는 layer 위상 + crossAvail로 `cappedCross`까지 산출 — budget 값은 합리적

### `computeLayoutChildren` (`passes/allocate-bounds.ts:346`)
- 시그니처: `(plan, bounds, scaleCtx?, measureMap?, constraintMap?) → LayoutChild[]`
- **현재 stack case만 measureMap 사용** (374, 401행)
- **flow case (444-476)는 measureMap 미사용** — PHI 휴리스틱 단독:
  ```ts
  const idealCross = isHorizontal ? (layerMainSize / PHI) : (layerMainSize * PHI);
  const uniformCross = Math.min(referenceCross, idealCross);
  ```
- → 핑퐁 호출만 복원해서는 부족. flow case에 활용 코드도 추가해야 함.

### `emitInlineBlock` (`passes/emit-ir.ts:219-336`)
- 250행에 이미 `inlineConstraints`를 만드는 반쪽짜리 미봉책이 있음 (`e4ec77c`):
  ```ts
  const fakePlan: DiagramLayoutPlan = { children: plan.children, totalWeight: ... };
  inlineConstraints = computeConstraints(fakePlan, scaleCtx);
  const layoutChildren = computeLayoutChildren(plan, bounds, scaleCtx, undefined, inlineConstraints);
  //                                                                  ^^^^^^^^^ measureMap = undefined
  ```
- 자식이 block일 때 재귀 호출 (267행) → **각 컨테이너 레벨이 자기 자식 단위 핑퐁을 자동 수행** 가능

### `emit-scene.ts`의 `emitInlineBlock` 호출 지점
- 222행: element 안 nested block — **scaleCtx 없이 호출** (4계층 컨셉 위반 1건)
- 276행: diagram-like block — scaleCtx 정상 생성·전달

---

## 변경 사항

### 단계 1 — `emitInlineBlock`에 핑퐁 복원 (필수, 본체)
**파일**: `packages/core/src/compiler/passes/emit-ir.ts:244-250`

**Before**:
```ts
let inlineConstraints;
if (scaleCtx) {
  const fakePlan: DiagramLayoutPlan = { children: plan.children, totalWeight: plan.children.reduce((s, c) => s + c.weight, 0) };
  inlineConstraints = computeConstraints(fakePlan, scaleCtx);
}
const layoutChildren = computeLayoutChildren(plan, bounds, scaleCtx, undefined, inlineConstraints);
```

**After**:
```ts
let inlineConstraints: ConstraintMap | undefined;
let inlineMeasureMap: MeasureMap | undefined;
if (scaleCtx) {
  const inlinePlan: DiagramLayoutPlan = {
    children: plan.children,
    totalWeight: plan.children.reduce((s, c) => s + c.weight, 0),
  };
  inlineConstraints = computeConstraints(inlinePlan, scaleCtx);
  // 핑퐁: 슬롯 bounds를 캔버스로 보고 자식들에게 budget 분배 → budget 기반 measure
  const inlineBudgetMap = allocateBudgets(inlinePlan, bounds, inlineConstraints, scaleCtx);
  inlineMeasureMap = measureDiagram(inlinePlan, theme, scaleCtx, inlineBudgetMap);
}
const layoutChildren = computeLayoutChildren(plan, bounds, scaleCtx, inlineMeasureMap, inlineConstraints);
```

**Import 추가** (`emit-ir.ts` 상단):
```ts
import { allocateBudgets } from './allocate-budgets.js';
import { measureDiagram } from './measure.js';
import type { ConstraintMap } from './budget-types.js';
// MeasureMap은 이미 import됨 (38행)
```

**핵심 포인트**:
- `bounds`(슬롯 영역)를 `canvasBounds` 자리에 그대로 전달 — `allocateBudgets`는 임의 bounds를 받음
- `fakePlan` → `inlinePlan` 변수명 정정. "이 컨테이너 단위의 정상 plan"임을 명시
- emitInlineBlock 재귀 호출(267행) 덕분에 컨테이너 중첩 시 각 레벨이 자기 핑퐁 자동 수행

### 단계 2 — `computeLayoutChildren` flow case에 measureMap 활용 (필수, 핵심)
**파일**: `packages/core/src/compiler/passes/allocate-bounds.ts:444-476`

**Before**:
```ts
case 'flow': {
  // ... layerInfo, layerCount, mainUsable 계산 ...
  const layerMainSize = mainUsable / layerCount;
  const maxNodesInAnyLayer = Math.max(...layerInfo.nodesPerLayer, 1);
  const referenceCross = (crossAxis - flowGap * Math.max(maxNodesInAnyLayer - 1, 0)) / Math.max(maxNodesInAnyLayer, 1);
  const idealCross = isHorizontal ? (layerMainSize / PHI) : (layerMainSize * PHI);
  const uniformCross = Math.min(referenceCross, idealCross);
  // ... return ...
}
```

**After**:
```ts
case 'flow': {
  // ... layerInfo, layerCount, mainUsable 계산 (변경 없음) ...
  const layerMainSize = mainUsable / layerCount;
  const maxNodesInAnyLayer = Math.max(...layerInfo.nodesPerLayer, 1);
  const referenceCross = (crossAxis - flowGap * Math.max(maxNodesInAnyLayer - 1, 0)) / Math.max(maxNodesInAnyLayer, 1);
  const idealCross = isHorizontal ? (layerMainSize / PHI) : (layerMainSize * PHI);

  // 자식들의 measured needs를 cross 축으로 환산하여 _PHI 하한_ 으로 사용.
  // - measureMap 없으면 → 기존 PHI 휴리스틱 그대로 (회귀 zero)
  // - measureMap 있으면 → max(needs, idealCross)로 PHI를 _하한_, referenceCross로 _상한_
  // 효과: needs > PHI면 확장(자식 needs 반영), needs ≤ PHI면 PHI 유지(시각 일관성).
  let measuredCross = 0;
  if (measureMap) {
    for (const c of plan.children) {
      const m = measureMap.get(c.id);
      if (!m) continue;
      const need = isHorizontal ? m.minHeight : m.minWidth;
      if (need > measuredCross) measuredCross = need;
    }
  }
  const targetCross = measuredCross > 0 ? Math.max(measuredCross, idealCross) : idealCross;
  const uniformCross = Math.min(referenceCross, targetCross);
  // ... return (변경 없음) ...
}
```

**핵심 포인트**:
- **PHI는 _하한_ 으로 보존** — 황금비 케이스(사용자가 좋아하는 Image #50, #51) 회귀 zero
- `referenceCross`는 _상한_ 유지 — 슬롯 cross 한계 초과 방지
- `measureMap` 없으면 기존 동작 그대로 → scaleCtx 없는 경로 회귀 zero
- tree case는 본 작업 _범위 외_ (사용자 보고 증상이 flow에 집중. tree는 별도 검증 필요)

### 단계 3 — `emit-scene.ts:222` scaleCtx 누락 보정 (소품, 일관성)
**파일**: `packages/core/src/compiler/scene/emit-scene.ts:222`

**Before**:
```ts
return emitInlineBlock(blockChild, bounds, theme, new Map());
```

**After** (264-276행 패턴 동일):
```ts
const inlinePlan = { children: [planNode(blockChild, theme)], totalWeight: 1 };
const inlineScaleCtx = createScaleContext(inlinePlan, bounds);
return emitInlineBlock(blockChild, bounds, theme, new Map(), inlineScaleCtx);
```

**왜 필요**: 단계 1의 핑퐁은 `scaleCtx`가 있어야 작동. 222행 호출은 scaleCtx 없음 → 핑퐁 미도달.
이 케이스는 _element 안에 nested block_ 이 들어가는 드문 경로. 영향 범위는 작지만
4계층 컨셉 위반 1건도 함께 해소.

### 단계 4 — 주석 동기화 (소품)
**파일**: `packages/core/src/compiler/passes/emit-ir.ts:212-218`

`emitInlineBlock`의 JSDoc에 한 문장 추가:
> 각 컨테이너 레벨에서 자기 자식 단위의 핑퐁(constraints → budgets → measure → bounds)을 수행한다.

`passes/index.ts:5-7`의 의도된 파이프라인 주석은 이미 옳게 적혀 있음. 변경 불요.

### (선택) 단계 5 — 슬롯 → 컨테이너 보고 채널 (이번 PR에서 _제외_)
사용자가 처음에 말한 "황금비로 축소할지, 전체를 사용할지의 _선택_ "은
단계 1~4로는 _자동화되지 않음_. 단계 1~4는 _노드 자체 크기_ 를 자식 needs에 맞춤,
슬롯과 컨테이너 사이 cross 공백은 그대로 남을 수 있음.

이 "선택" 자동화는 별도 채널 필요:
- `flow-layout.ts:224-225`의 `containerBounds.h = bounds.h` 고정 해제
- 자식 cross 합으로 컨테이너 축소
- 부모 layout이 그 차이를 받아 정렬

→ 변경 표면 넓음. **별도 PR로 분리**. A안 검증 결과를 보고 다음 작업으로.

---

## 변경 파일 요약

| # | 파일 | 변경 줄 | 성격 |
|:-:|---|:-:|---|
| 1 | `passes/emit-ir.ts` (emitInlineBlock + import) | ~10줄 | 핑퐁 호출 복원 |
| 2 | `passes/allocate-bounds.ts` (flow case) | ~12줄 | measureMap 활용 추가 |
| 3 | `scene/emit-scene.ts:222` | ~3줄 | scaleCtx 누락 보정 |
| 4 | `passes/emit-ir.ts` JSDoc | ~3줄 | 주석 동기화 |

**총 ~28줄**. 4계층 구조 자체는 한 줄도 건드리지 않음.
옛 emitIR 부활 없음. 신규 함수 생성 없음.

---

## 위험 분석

| 위험 | 평가 | 완화책 |
|---|:-:|---|
| 재귀 핑퐁 비용 | 낮음 | 컨테이너 깊이 ≤ 5, n 작음 → BFS measure/budget이 사실상 O(n) |
| PHI 케이스 회귀 (Image #50, #51) | **0** | 단계 2의 `Math.max(measuredCross, idealCross)`로 PHI 하한 보존 |
| 기존 1264개 코어 테스트 회귀 | 중간 | scaleCtx 없는 경로 변경 zero. PHI를 정확히 가정한 flow 테스트가 있다면 단계 4 검증에서 노출 |
| box/layer 경로 영향 | 낮음 | box/layer는 emitBoxBlock으로 처리, emitInlineBlock 우회. _box 안의 flow_ 케이스는 단계 4 검증 항목 |
| `fakePlan → inlinePlan` 변수명 변경 | **0** | 함수 내 로컬 변수 |
| element-내-block scaleCtx 추가 영향 | 낮음 | _기능 추가_ 이므로 기존 의존 동작 없음 |

---

## 검증 계획

### V1 — 단위 테스트 (자동)
1. `pnpm --filter @depix/core run test` — 기존 1264개 통과 확인
2. **신규 회귀 테스트** (`__tests__/compiler/passes/allocate-bounds.test.ts`):
   - `flow + measureMap=undefined` → 기존 PHI 결과와 동일 (회귀 zero)
   - `flow + measureMap에 큰 minHeight` → cross가 PHI 넘어 확장
   - `flow + measureMap에 작은 minHeight` → cross가 PHI 유지 (하한 검증)

### V2 — 통합 테스트
3. **신규 통합 테스트** (`__tests__/compiler/scene/inline-pingpong.test.ts`):
   - `scene { layout: full, body: flow { ... } }` 컴파일 → flow 컨테이너 자식 cross 크기가 measured minHeight 이상
   - 라벨이 짧을 때 → PHI 유지 검증

### V3 — 시각 검증 (수동)
4. Binary Search flowchart DSL 렌더링 → 수직 공간 활용 개선 확인
5. Image #50, #51 황금비 케이스 DSL 렌더링 → 회귀 없음 확인

### V4 — 빌드
6. `pnpm --filter @depix/core run build` — 타입 검사 통과

---

## Rule Guard 통과 계획

CLAUDE.md 원칙:
1. **사전 검토** — 단계 1~4 변경 계획을 rule-guard에 전달, taskId 포함
   - 적용 파일: `passes/emit-ir.ts`, `passes/allocate-bounds.ts`, `scene/emit-scene.ts`
2. PASS 받으면 단계 1 → 2 → 3 → 4 순서로 실행
3. 각 단계 완료 직후 사후 검증 호출 (총 4번)
4. ISSUE 발생 시 즉시 멈추고 재계획

---

## 결정 옵션

- **A안 (권장)**: 단계 1~4 일괄 적용. ~28줄, 한 PR. 핑퐁 호출 복원 + 활용 모두 포함
- **B안**: 단계 1만 먼저. 더 작지만 _체감 변화 거의 없음_ (computeLayoutChildren이 measureMap 안 씀). 비권장
- **C안**: 선택 단계 5까지. 변경 표면 넓고 위험 평가 별도 필요. 비권장

**기본 권장: A안**

---

## 사용자가 처음 제기한 통찰과의 매핑

> "자기 자신이 부모에게 '나는 이만큼 높이가 필요해'라고 전달해야겠지?"

- 단계 1: 자식이 measureDiagram으로 자기 needs를 산출 → 부모(컨테이너)가 받음 ✓
- 단계 2: 부모가 그 needs를 _실제로_ 사용해 자식 크기 결정 ✓
- 단계 5(미래): 부모가 자기 슬롯에게 다시 needs를 전달하는 채널 — 이번 작업 범위 밖

> "이 알고리즘 컨셉은 이미 depix에 구현되어있는 부모/자식간 예산 분배 핑퐁 파이프라인이 있는걸로 아는데"

확정: 코드(measure.ts, allocate-budgets.ts, compute-constraints.ts)는 존재.
단지 _scene 진입점이 호출하지 않을_ 뿐. 본 PR은 호출 채널만 다시 잇는 작업.
