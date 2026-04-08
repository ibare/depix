# PR-1 Review & PR-2 Preparation — 논의 기록

**생성일**: 2026-04-08
**작성 이유**: 컨텍스트 압축 직전 상태 저장. 이 파일만 읽으면 대화 전체 맥락을 복원하여 중단 지점에서 이어갈 수 있어야 한다.
**관련 문서**: `tasks/unified-plan-tree-pipeline.md` (1198줄, 전체 리팩토링 계획)

---

## 0. 현재 상태 스냅샷

### PR-1 완료 상태
- **PR-1 = L1 + L2**: 단일 PlanNode 트리 + 루트 단일 파이프라인
- **커밋 구조 (5 Step + 1 cleanup, 로컬 main에 적재, 푸시 안 함)**:
  - `063351b` chore(rules) — Step A
  - `5e5193a` feat(core) — Step B 신규 파일
  - `f7770ff` refactor(core) — Step C 시그니처 교체 + 삭제
  - `e9bb03b` test(core,engine) — Step D 테스트 마이그레이션
  - `a32a2c3` test(+build) — Step E 신규 테스트 + 빌드 수정
  - `58f05b6` docs(todo) — Phase 4 cleanup (T-32~T-35 제외)
- **테스트**: core 1237, engine 120, editor 344, react 286 — 전원 통과
- **빌드**: pnpm 워크스페이스 전 패키지 빌드 PASS
- **위치**: `/Users/mintae/Documents/Develop/side-projects/depix`

### 계획 문서 내 PR 단계
```
PR-1  [L1+L2]  Plan 트리 통합 + 루트 단일 파이프라인          ← 완료 (본 리뷰 대상)
PR-2  [L3]    모든 블록 타입 measureMap 활용                  ← 다음
PR-3  [L4]    scene-measure.ts 폐기 + scene/ 디렉터리 삭제
PR-4  [L5]    slot↔container 역류 채널
PR-5  [L6]    Fixed-point 수렴 루프
```

---

## 1. 1차 설계 리뷰 (실제 코드 기반)

사용자 요청: "객관적 관점에서 구조 변경 목적을 이해한 후, 변경하려는 구조가 올바르게 설계되었는지, 잘못된 접근은 없는지 코드 기반으로 점검" (계획 문서가 아닌 **실제 구현 코드**로만)

### 1.1 조사 방법
4개 병렬 Opus Explore 에이전트 투입:
- Agent 1: PR-1 달성도 검증
- Agent 2: PR-2 전제(measureMap 사용 편중) 검증
- Agent 3: PR-3 전제(scene-measure.ts 잔존) 검증
- Agent 4: PR-4+5 전제(reverse flow 부재, fixpoint 부재) 검증

### 1.2 1차 리뷰 결론 — "자기 규칙 위반 4건"

> ⚠️ **주의**: 이 중 2건(B, C)은 2차 재평가에서 **제 오독**으로 정정됨. 아래 §2 참조.

**(A) Scene loop가 "루트 1회" 원칙 위반**
- `packages/core/src/compiler/compiler.ts:96,102-115`
- `planDocument(ast, theme)`가 `PlanNode[]` 반환 (scene당 1개)
- `for (let i = 0; i < plans.length; i++) { ... }` 루프 안에서 `createScaleContext`, `computeConstraints`, `allocateBudgets`, `measureDiagram`, `allocateBounds` 호출
- → 4개 패스가 scene 수 × 1번 호출되므로 `S-pipeline.md` MUST "정확히 1회씩"을 문자적으로 위반
- `plan-all.ts:10-12` 주석은 "문서 레벨의 scene 배열 전체를 갖는 단일 PlanNode 트리" 주장 / 구현은 배열 반환 (주석-구현 괴리)

**(B) `computeSceneNaturalHeight` 잔존 — ⚠️ 이후 정정됨**
- `compiler.ts:36` `import { computeSceneNaturalHeight } from './scene/scene-measure.js';`
- `compiler.ts:104` `const h = isAutoHeight ? computeSceneNaturalHeight(...) : 100;`
- `scene/scene-measure.ts:212-228` `computeSceneNaturalHeight`는 `estimateBlockNaturalHeight`를 재귀 호출
- S-pipeline MUST NOT: "Scene 측 별도 measure 함수 부활 금지"와 충돌한다고 판단
- **정정**: "부활 금지"는 전향적 규칙이고, PR-3에서 삭제 예정. §2.2 참조.

**(C) scene/ dead code 5파일 — ⚠️ 부분 정정됨**
- Grep 결과 외부 import 0건: `scene-blocks.ts`, `scene-elements.ts`, `scene-elements-compound.ts`, `scene-charts.ts`, `scene-helpers.ts`
- 현재 파이프라인이 import하는 scene/ 파일: `scene-meta.ts`, `scene-measure.ts`, `scene-types.ts` 3개뿐
- S-pipeline MUST NOT "옛+새 공존 금지" 위반이라 판단
- **정정**: "한 PR 내 공존 금지"는 per-PR 규칙, orphan dead code는 다른 문제. §2.3 참조.

**(D) walker sub-bounds 분배 잔존 — 유효**
- `emit-element-walker.ts`:
  - `walkBullet` line 155-206: `scale = bounds.h / totalNeeded`, item별 y 좌표 계산
  - `walkStat` line 212-263: `valueH = bounds.h × 0.65`
  - `walkQuote` line 269-318: `quoteH = bounds.h × 0.75`
- S-pipeline MUST: "walker 내부에서는 크기 분배, 좌표 계산을 수행하지 않는다" 위반
- 파일 상단 주석(`stat/quote/step: 단일 IR 요소로 단순화 — 자식 bounds 계산 없음`)과 실제 코드 불일치

### 1.3 기타 조사 결과 (여전히 유효)

**PR-2 전제 검증** — measureMap 사용 분포:
- `allocate-bounds.ts`에 measureMap 참조 13곳
- **min-floor 용도**는 광범위 사용 (line 115, 224, 239, 268, 333, 362)
- **cross-axis 크기 결정**: flow / tree / grid / layers / group / table / chart **전부 heuristic** (PHI, SHAPE_PREFERRED_RATIO)
- `flow-layout.ts:224-225`: `usedH = isHorizontal ? bounds.h : totalMainNeeded` (cross axis 하드코딩)
- → PR-2 전제는 유효하지만 표현이 "measureMap 미사용"이 아닌 **"cross-axis sizing이 measure 결과를 참조하지 않음"**이 정확

**PR-4 전제 검증** — reverse flow 부재:
- `allocate-bounds.ts:314` `boundsMap.set(plan.id, layoutResult.containerBounds)` 저장은 하지만 부모 재흡수 없음
- `flow-layout.ts:228` `Math.min(usedW, bounds.w)` clamp만, 부모에게 "덜 썼음" 보고 없음
- → 유효

**PR-5 전제 검증** — fixpoint 부재:
- compile()은 엄격한 DAG
- passes의 `while`/`iterative`는 2-stack post-order traversal 용도
- → 유효. 단 PR-4 이후 실측으로 필요성 재검증 권장

---

## 2. 사용자 재질문 → 2차 재평가

### 2.1 사용자 질문
> "PR-1의 남겨준 부분과 설계에서 놓친 부분이 이후 PR-2~ 단계에서 처리하려는 시도는 아니었는가?"

### 2.2 계획 문서 §6 (L4/PR-3) 실제 내용
```
6. L4 — `scene-measure.ts` 폐기
6.1 목표: Scene 크기 추정을 모두 measureDiagram 결과 조회로 대체
6.2 변경: scene/scene-measure.ts 파일 **삭제**.
         호출부: const h = measureMap.get(node.id)?.minHeight ?? 0;
         해결: slot 크기 가늠을 planAll에서 빼고 allocateBounds의 scene case로 이동
```

§10.2 삭제 테이블:
- `compiler/scene/scene-measure.ts` → **PR-3**
- `compiler/scene/` 디렉터리 자체 → **PR-3** (모든 파일 삭제 후)

**→ (B) 판정 정정**: "부활 금지"는 전향적 규칙. 현재 `computeSceneNaturalHeight` 존재는 "부활"이 아니라 "삭제 대기 중인 레거시". PR-3에 명시 예정. **지적 철회.**

### 2.3 §1.4 dead code 식별 실제 내용
```
§1.4 Dead Code 식별 (rule-guard 사전 검토에서 발견)
passes/ 아래 다음 4파일은 현재 어디서도 import되지 않는 dead cluster:
  - emit-ir-blocks.ts
  - emit-ir-elements.ts
  - emit-ir-charts.ts
  - emit-ir-helpers.ts
이 4파일은 PR-1에서 emit-ir.ts와 함께 무조건 삭제한다.
```

→ `scene/` 5파일(scene-blocks/elements/elements-compound/charts/helpers)은 §1.4에도 §10.2 개별 항목에도 **명시 없음**. `scene/` 디렉터리 전체가 PR-3로 사라지는 것만 §10.2에 적힘.

→ 이 5파일은 `emit-scene.ts` 삭제로 **사후적으로 orphan이 된** 상태. 계획 작성 시점에 예측되지 않음.

**→ (C) 판정 정정**: "옛+새 공존 금지"는 per-PR 규칙이고 현재 파이프라인이 이들을 import하지 않으므로 엄밀한 위반 아님. 계획의 **scope oversight** (개별 명시 누락)로 재분류. PR-3 시작 시 §10.2 개별 명시만 추가하면 됨.

### 2.4 계획 문서 §3.3 / §4.2 실제 내용 — (A)는 유효

**§3.3 신규 함수** (line 247):
```ts
export function planAll(ast: ASTRoot, theme: DepixTheme): PlanNode {
  // 1. ast.children이 단일 scene이면 그대로 root
  // 2. 아니면 implicit scene으로 감싸기
  // 3. 재귀적으로 ASTBlock/ASTElement → PlanNode 변환
}
```
→ **ASTRoot → 단일 PlanNode** 시그니처. 문서 단일 루트.

**§4.2 의사코드** (line 747-760):
```ts
const plan      = planAll(ast, theme);                       // 단일 plan
const scaleCtx  = createScaleContext(plan, canvas);          // 1회
const constr    = computeConstraints(plan, scaleCtx);        // 1회
const budgets   = allocateBudgets(plan, canvas, constr, scaleCtx);  // 1회
const measure   = measureDiagram(plan, theme, scaleCtx, budgets);   // 1회
const bounds    = allocateBounds(plan, canvas, measure, ...);       // 1회
return emit(plan, bounds, edges, theme);
```
→ 각 패스 **1회** 호출. 루프 없음.

**실제 구현**: `planDocument → PlanNode[] + scene loop`. 각 패스 N회 호출. **계획과 구현의 문서화되지 않은 괴리.**

추정 원인: auto-height 모드에서 scene별 canvas 높이가 달라서 "단일 plan + 단일 canvas" 시그니처로 표현 불가. 구현 중 우회한 것으로 보임.

**→ (A) 판정 유지**: PR-2~5 어디에도 "나중에 합칠 것"이라고 명시되지 않음. 진짜 괴리.

### 2.5 (D) 계획 내 언급 여부 grep
- 키워드: `stat`, `quote`, `bullet`, `sub`, `compound`, `자식 bounds`, `승격` 등
- 결과: §4.5 / §4.6 테이블의 `allocateBounds` 항목 외 언급 없음
- compound element 처리 방침, planAll 확장, walker carveout 모두 **계획 문서에 존재하지 않음**

**→ (D) 판정 유지**: 진짜 계획 누락.

### 2.6 2차 재평가 요약

| 1차 지적 | PR-2~5에 명시? | 최종 판정 |
|---|---|---|
| (A) Scene loop vs 루트 1회 | 아니오 | **유효** — 계획-구현 괴리 |
| (B) computeSceneNaturalHeight | 예, PR-3 | **철회** (제 오독) |
| (C) scene/ dead 5파일 | 부분적, scene/ 전체가 PR-3 | **부분 철회** (계획 누락) |
| (D) walker sub-bounds | 아니오 | **유효** — 계획 누락 |

**→ PR-2 이전 정리 대상은 2건 (A, D)**. B는 PR-3에서 자연 해소, C는 PR-3 시작 시 §10.2 한 줄 추가로 해소.

---

## 3. 전략 논의 — 지금 수정 vs 나중 일괄 점검

### 3.1 사용자 제안
> "계획대로 잔여 단계를 모두 진행한 후 한번 더 문제를 점검해서 나온 문제를 고치는게 좋을까? 어떻게 진행해도 한번은 점검해서 진행해야한다면 후자도 합리적인 방식이 아닐까?"

### 3.2 제 답변 — 두 건이 서로 다른 프로필

**(A) Scene loop**: **정의적(definitional) 기반**
- 계획 §3.3 / 구현 / 규칙이 세 가지 다른 말을 함
- PR-2~5가 이 정의를 전제로 설계됨 (예: PR-2 measureMap이 문서 전역인가 scene-local인가?)
- `S-pipeline.md` MUST와 코드 불일치 상태로 PR 열면 **rule-guard가 매 PR마다 재심의**
- 미루면 나중에 되돌려야 할 코드가 커짐
- → **지금 반드시 해결**

**(D) Compound element**: **문서-코드 불일치 수준**
- 코드 동작, 테스트 통과. 단지 MUST NOT 문자적 해석과 충돌
- 해결 선택지 두 가지 중 하나(carveout)는 10분, 다른 하나(planAll 확장)는 PR 하나 규모
- PR-2~5 설계에 영향 없음
- → **carveout만 지금, 근본 해소는 post-PR-5**

### 3.3 제 권장 — 혼합 전략
1. **지금 최소 작업 (~1시간)**:
   - (A) 방향 결정 후 계획 §3.3/§4.2 + `S-pipeline.md` MUST를 코드에 맞춤
   - (D) MUST NOT에 carveout 한 줄 + 계획 문서에 post-PR-5 cleanup 섹션 추가
   - §10.2에 scene/ orphaned 4파일 명시 (덤)
   - **이 3가지 외 건드리지 않음** (선제적 예방 수정 금지)
2. **PR-2 ~ PR-5 계획대로 진행**
3. **PR-5 후 전면 점검** — 누적 drift + 자잘한 건 + (D)의 최종 해소를 단일 cleanup PR로

### 3.4 사용자 결정
> "오케이, 그러면 두가지 모두 해결하고 PR-2로 넘어가자."

---

## 4. 제시된 선택지 (사용자 결정 대기 중)

### 4.1 (A) Scene loop 방향

| 선택지 | 내용 | 비용 | 제 권장 |
|---|---|---|---|
| **A-1** | "scene별 1회 호출"을 공식 정의로 승격. 계획 §3.3/§4.2와 `S-pipeline.md` MUST 문구를 현재 구현에 맞춤 | 문서 수정만, 코드 변경 없음 | ✅ |
| **A-2** | 진짜 document-level 단일 루트로 `compile()` 개편. scene loop 제거 | auto-height에서 scene별 canvas 높이 처리 재설계 필요 — 별도 PR 규모 | ❌ |

### 4.2 (D) Compound element 방향

| 선택지 | 내용 | 비용 | 제 권장 |
|---|---|---|---|
| **D-1** | `S-pipeline.md` MUST NOT에 carveout + 계획에 post-PR-5 cleanup 섹션 추가. 근본 해소는 PR-5 이후 | 문서 수정만 | ✅ |
| **D-2** | 지금 `planAll`이 stat/quote/bullet을 자식 PlanNode로 펼침 | 계획에 없던 새 작업 — `plan-all-element.ts` 확장 + 테스트 재작성 | ❌ |

### 4.3 덤 — §10.2 orphaned scene/ 5파일 명시 추가 (C)

- `scene-blocks.ts`, `scene-elements.ts`, `scene-elements-compound.ts`, `scene-charts.ts`, `scene-helpers.ts`
- 현재 §10.2는 "scene/ 디렉터리 자체 → PR-3"만 있고 개별 파일 없음
- 일관성 위해 함께 추가 권장

### 4.4 대기 중인 사용자 결정 3건

1. **(A)**: A-1로 가도 됩니까? (기본 권장)
2. **(D)**: D-1로 가도 됩니까? (기본 권장)
3. **(C)**: §10.2에 scene/ 5파일 명시 추가를 함께 처리하시겠습니까?

**사용자 답변 대기 중 — 이 시점에서 컨텍스트 압축 걱정으로 파일 저장 요청.**

---

## 5. 결정 후 실행 계획 (A-1 + D-1 + C 가정)

### 5.1 수정 대상 파일 — 코드 로직 변경 0건

| # | 파일 | 수정 내용 | 성격 |
|---|---|---|---|
| 1 | `rules/specifics/S-pipeline.md` | MUST: "루트에서 1회씩" → "각 scene PlanNode 루트에서 1회씩" / MUST NOT: compound element carveout 한 줄 추가 | 규칙 |
| 2 | `tasks/unified-plan-tree-pipeline.md` §3.3 | `planAll` 시그니처 설명을 "scene당 1개 PlanNode"로 수정, "문서 레벨 단일 루트" 표현 제거 | 계획 |
| 3 | `tasks/unified-plan-tree-pipeline.md` §4.2 | 의사코드를 `planDocument → for scene of plans` 루프로 수정 | 계획 |
| 4 | `tasks/unified-plan-tree-pipeline.md` 신규 섹션 | "PR-6 Post-cleanup" 섹션 (compound element 해소 + drift 정리) | 계획 |
| 5 | `tasks/unified-plan-tree-pipeline.md` §10.2 | scene/ orphaned 4파일(5개에서 scene-measure 제외)을 PR-3 삭제 목록에 추가 | 계획 |
| 6 | `packages/core/src/compiler/layout/plan-all.ts` line 10-12 | 주석 정정: "문서 레벨 단일 루트" → "scene당 1개 PlanNode" | 주석만 |
| 7 | `packages/core/src/compiler/emit-element-walker.ts` line 1-17 | 주석 정정: "자식 bounds 계산 없음" → "compound element는 S-pipeline carveout 적용" | 주석만 |

### 5.2 실행 순서

1. 사용자 결정 3건 확정
2. 구체 수정 계획 작성 (수정 문구 초안 포함)
3. **rule-guard 사전 검토 호출** (C1, S-pipeline, S-compiler 규칙 검증, taskId 포함)
4. PASS 시 실제 수정 실행
5. **rule-guard 사후 검증 호출** (taskId 포함)
6. PASS 시 단일 커밋
   - 커밋 메시지 초안: `docs(plan): PR-1 정합화 — scene loop 공식화 + compound element carveout + scene/ orphan 정리`
   - 푸시 안 함 (사용자 지시 대기)
7. PR-2 시작

---

## 6. 실제 코드 근거 모음 (재확인 필요 시 참조)

### 6.1 compiler.ts scene loop (A의 근거)
- 경로: `packages/core/src/compiler/compiler.ts`
- line 96: `const plans = planDocument(resolvedAST, theme);`
- line 102-115: scene loop
- 각 반복 안에서 `createScaleContext`, `computeConstraints`, `allocateBudgets`, `measureDiagram`, `allocateBounds` 호출
- line 104: `isAutoHeight ? computeSceneNaturalHeight(...) : 100` — scene별 canvas 높이 차이가 scene loop의 원인

### 6.2 plan-all.ts planDocument (A의 근거)
- 경로: `packages/core/src/compiler/layout/plan-all.ts`
- line 10-12: 주석이 "문서 레벨 단일 루트" 주장
- line 41-43: `planAll(block, theme, rootId): PlanNode` — 단일 scene 블록 시그니처
- line 52-54: `planDocument(ast, theme): PlanNode[]` — `ast.scenes.map(...)` 배열 반환

### 6.3 scene-measure.ts 상태 (B의 근거, PR-3 대기)
- 경로: `packages/core/src/compiler/scene/scene-measure.ts` (228 lines)
- 주요 export: `estimateTextWidth`, `computeFitScale`, `adaptBoxPadding`, `estimateContentHeight`, `computeCompactHeights`, `adaptBaseFontSize`, `estimateBlockNaturalHeight`, `computeSceneNaturalHeight`
- 외부 import (Grep 결과): `compiler.ts:36`에서 `computeSceneNaturalHeight` 만

### 6.4 scene/ 디렉터리 파일 목록 (C의 근거)
```
packages/core/src/compiler/scene/
  ├── scene-types.ts       ← 현역 (classifySceneLayout)
  ├── scene-helpers.ts     ← orphan (scene-blocks/elements만 참조)
  ├── scene-blocks.ts      ← orphan
  ├── scene-charts.ts      ← orphan
  ├── scene-meta.ts        ← 현역 (compiler.ts)
  ├── scene-measure.ts     ← 현역 (compiler.ts, PR-3 삭제 예정)
  ├── scene-elements-compound.ts  ← orphan
  ├── scene-elements.ts    ← orphan
  └── index.ts             ← classifySceneLayout만 re-export
```

### 6.5 emit-element-walker.ts compound 분배 (D의 근거)
- 경로: `packages/core/src/compiler/emit-element-walker.ts`
- line 1-17: 상단 주석이 "자식 bounds 계산 없음" 주장
- line 155-206 `walkBullet`: `scale = bounds.h / totalNeeded`, item별 y 계산
- line 212-263 `walkStat`: `valueH = labelProp ? bounds.h * 0.65 : bounds.h`
- line 269-318 `walkQuote`: `quoteH = attribution ? bounds.h * 0.75 : bounds.h`
- line 60: `baseFontSize = measuredFontSize ?? Math.min(bounds.h, 100) * 0.07` (회색지대)

### 6.6 allocate-bounds.ts measureMap 사용 (PR-2 근거)
- 경로: `packages/core/src/compiler/passes/allocate-bounds.ts` (970 lines)
- measureMap 참조 13곳: line 92, 98, 107, 115, 132, 149, 174, 197, 201, 218, 224, 239, 268, 294, 301, 322, 333, 362, 404, 427, 454, 642
- **min-floor 광범위 사용**: top-level 자식(line 115), leaf 요소(224), nested grandchild(362), box/layer title/subtitle(333)
- **cross-axis 결정에 미사용**: flow(497-529 PHI), tree(531-580 PHI), grid(485-495), layers(582-591), group(593-612), table(614-623), chart(626-635)
- **stack만 부분 사용**: row(427 minWidth), col(454 minHeight as natural)
- **box/layer만 직접 사용**: line 642

### 6.7 flow-layout.ts cross axis 하드코딩 (PR-4 근거)
- 경로: `packages/core/src/compiler/layout/flow-layout.ts`
- line 224-225: `const usedW = isHorizontal ? totalMainNeeded : bounds.w; const usedH = isHorizontal ? bounds.h : totalMainNeeded;`
- 부모에게 "내가 실제로 쓴 크기"를 보고하는 경로 없음

### 6.8 S-pipeline.md MUST/MUST NOT 전문
- 경로: `rules/specifics/S-pipeline.md`
- MUST:
  1. "compile()은 measureDiagram / allocateBudgets / computeConstraints / allocateBounds를 **루트에서 정확히 1회씩** 호출한다. 각 패스는 PlanNode 루트 하나를 받고 트리 전체를 자체 재귀로 순회한다."
  2. "emit walker는 BoundsMap 조회와 IR 요소 생성만 수행한다. walker 내부에서는 크기 분배, 좌표 계산, measure/allocate 호출, 색상 해석을 수행하지 않는다."
  3. "Plan은 단일 트리 타입(PlanNode)이다."
- MUST NOT:
  1. "emit walker가 measureDiagram / allocateBudgets / computeConstraints / allocateBounds를 호출하지 않는다."
  2. "Container별 자체 핑퐁 부활 금지."
  3. "Scene 측 별도 measure 함수(과거 scene/scene-measure.ts::estimateBlockNaturalHeight) 부활 금지."
  4. "옛+새 경로 공존 금지. 한 PR 안에서 옛 파이프라인과 새 파이프라인이 동시에 존재하는 중간 상태를 만들지 않는다."

---

## 7. 압축 후 새 세션을 위한 이어가기 가이드

### 7.1 빠른 맥락 복구 순서
1. 이 파일(`tasks/pr-1-review-and-pr2-prep.md`) 전체 읽기
2. `tasks/unified-plan-tree-pipeline.md` §3.3, §4.2, §6, §9.3, §10.2 확인
3. `rules/specifics/S-pipeline.md` MUST/MUST NOT 확인
4. git log로 PR-1 커밋 6개 확인 (063351b ~ 58f05b6)
5. 사용자에게 §4.4의 3가지 결정 다시 확인 (A-1 / D-1 / C 포함 여부)

### 7.2 중단 시점
- 사용자: "두 가지 모두 해결하고 PR-2로 넘어가자"
- 제 응답: 3가지 결정 항목 제시 + 파일 목록 + 실행 순서
- 대기: 사용자의 A-1 / D-1 / C 포함 여부 확정
- 사용자 다음 요청: 컨텍스트 압축 걱정 → 이 파일 생성 요청

### 7.3 사용자 결정 받은 후 할 일
1. 결정을 이 파일 §8(신규)에 기록
2. 구체 수정 문구 초안 작성 (특히 S-pipeline.md MUST/MUST NOT 새 문구, PR-6 섹션 템플릿)
3. rule-guard 사전 검토 호출 (taskId 필수)
4. 수정 실행
5. rule-guard 사후 검증
6. 단일 커밋 (푸시 안 함)
7. PR-2 시작

### 7.4 주의사항
- **코드 로직은 변경하지 않는다.** 주석 2곳만 정정.
- **선제적 예방 수정 금지.** (A)와 (D)와 (C) 외에는 건드리지 않는다.
- **푸시하지 않는다.** 사용자 별도 지시 대기.
- rule-guard 호출 시 taskId를 프롬프트에 반드시 포함.
- 모든 행동 전 baden_action 호출.

---

## 8. 결정 기록

- **(A) 선택**: **A-1** — "scene PlanNode 루트마다 1회씩"을 공식 정의로 승격
- **(D) 선택**: **D-1** — S-pipeline MUST NOT에 compound element carveout + 계획에 PR-6 post-cleanup 섹션 신설
- **(C) 포함 여부**: **포함** — §10.2 삭제 목록에 scene/ orphan 4파일(blocks/elements/elements-compound/charts/helpers) 명시
- **결정 시각**: 2026-04-08
- **사용자 보충 정보 (중요)**:
  > auto-height는 멀티 Scene을 허용하지 않는다는 전제로 만들어진 옵션. 사용 케이스가 많지 않아 문서상 디테일이 부족했음.

  → A-1 문구 작성 시 이 전제를 S-pipeline 또는 plan-all.ts 주석에 명시. auto-height의 scene-local canvas가 "multi-scene 구조 문제"가 아니라 "single-scene 모드 기능"임을 분명히 하여 A-1 정의(scene = 파이프라인 루트)가 auto-height와 무모순임을 드러낸다.
- **다음 게이트**: 사용자가 "결과를 본 후 PR-2 진행 결정". → 본 커밋 후 PR-2 착수 전 사용자 승인 필요.
