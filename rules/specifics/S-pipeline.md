---
version: 2
last_verified: 2026-04-08
---

# 컴파일러 파이프라인 S-pipeline

## When to Apply

`packages/core/src/compiler/` 하위에서 `compile()` 진입점, `passes/`, `emit*.ts`, `layout/plan-*.ts` 파일을 생성하거나 수정할 때.

본 규칙은 "단일 Plan 트리 + 루트 1회 핑퐁" 파이프라인의 무결성을 보장한다. `S-compiler.md`가 각 패스의 _내부 규칙_ 을 다룬다면, `S-pipeline.md`는 패스들이 _어떻게 서로 조립되는지_ 를 다룬다.

## MUST

- `compile()`은 _각 scene PlanNode 루트마다_ `computeConstraints` / `allocateBounds`를 정확히 1회씩 호출한다.
  `allocateBudgets`와 `measureDiagram`은 budget↔fontSize 상호 의존을 해소하기 위해 루트 스코프 fixed-point 수렴 루프로 호출되며, 단일 헬퍼(`runBudgetMeasureFixpoint` in `compiler/compiler.ts`)로 캡슐화되어 `compile()` 본문에서는 1회 호출로 나타난다. 루프 경계 제약은 아래의 별도 MUST 항목을 참조.
  각 패스는 `PlanNode` 루트 하나를 받고 _그 트리 전체를 자체 재귀로 순회_ 한다. container별 자체 호출 금지.
  Document는 scene PlanNode의 컬렉션이며 (`planDocument: ASTDocument → PlanNode[]`), 별도의 document-level 레이아웃 루트를 두지 않는다.
  scene별 호출은 "루트 1회 핑퐁"의 _위반이 아니다_ — 각 scene 트리가 독립 파이프라인 단위이기 때문이다. 금지 대상은 같은 트리 안에서 파이프라인이 재진입하는 container별 핑퐁이다.

- Root-scope `runBudgetMeasureFixpoint` 헬퍼는 다음 경계 제약을 모두 만족해야 한다:
  (1) 단일 exported helper로 `packages/core/src/compiler/compiler.ts`에 정의하고, `compile()`은 이를 1회만 호출한다.
  (2) `MAX_ITER` 상한 ≤ 5. 초기 1회 + 루프 본체 최대 MAX_ITER회 = 총 MAX_ITER+1회의 `allocateBudgets`/`measureDiagram` 호출만 허용한다.
  (3) `EPS` 수렴 조건 필수. `MeasureMap`의 `minWidth`/`minHeight` 필드에 대한 최대 절댓값 차가 `EPS` 미만이면 조기 종료한다.
  (4) 루프 본체는 `allocateBudgets` → `measureDiagram` 순서만 반복한다. `computeConstraints` / `allocateBounds` / 기타 패스는 루프 외부에서 1회 호출된다.
  (5) 루프는 PlanNode 루트 범위에서만 동작한다. container 내부에서의 재진입은 S-pipeline MUST NOT "container별 자체 핑퐁"에 여전히 해당하며 금지된다.

- `emit` walker (`compiler/emit.ts` 및 그 분할 파일들)는 `BoundsMap` 조회와 IR 요소 생성만 수행한다.
  walker 내부에서는 크기 분배, 좌표 계산, measure/allocate 호출, 색상 해석을 수행하지 않는다. 모든 계산은 walker 호출 전에 완료되어 있어야 한다.

- Plan은 단일 트리 타입(`PlanNode`)이다. `DiagramLayoutPlan` / `SceneNode` 같이 scene과 container를 분리한 plan 타입을 새로 만들지 않는다.
  scene / layout slot / container / element는 모두 `PlanNode` 한 타입의 `blockType` 필드로 구분한다.

## MUST NOT

- `emit` walker가 `measureDiagram` / `allocateBudgets` / `computeConstraints` / `allocateBounds`를 호출하지 않는다.
  walker는 이미 결정된 `BoundsMap`을 읽기만 한다. 호출이 필요하다면 `compile()` 본문에 추가해야 하며, 그 경우에도 루트 1회 호출 원칙을 유지한다.

- Container별 자체 핑퐁(과거 `emitInlineBlock` 패턴 — `inlineConstraints`를 별도로 계산하거나 container 범위에서 measure/allocate를 다시 도는 구조) 부활 금지.
  "내 자식들의 크기는 내가 다시 재어서 내가 나눈다"는 로직은 전부 루트 파이프라인으로 승격해야 한다.

- Scene 측 별도 measure 함수(과거 `scene/scene-measure.ts::estimateBlockNaturalHeight` — block 구조를 무시한 naive sum 추정) 부활 금지.
  scene의 slot 크기 결정도 `measureDiagram` 결과를 조회해서 구한다.

- 옛+새 경로 공존 금지. 한 PR 안에서 옛 파이프라인(`emitSceneIR`, `emitInlineBlock`, `normalizeScenes`, `planLayout`, `planScene` 등)과 새 파이프라인(`planAll`, `emit`)이 동시에 존재하는 중간 상태를 만들지 않는다.
  옛 함수·옛 타입은 _삭제_ 하고 호출부를 새 시그니처로 직접 교체한다. deprecated 표시나 호환 shim은 허용하지 않는다.

- Document-level 단일 레이아웃 루트 facade 도입 금지. scene들을 wrapper PlanNode의 자식으로 묶어 "진짜 단일 루트"를 흉내 내는 구조를 만들지 않는다.
  이유: depix의 scene은 독립 다이어그램 단위다. 여러 scene 사이에는 공간/배치 관계가 없고, `@page *` auto-height는 single-scene 전제 기능이다. 의미 없는 wrapper는 구조적 기만이며 auto-height·scene-local canvas와 지속적으로 충돌한다.

- Compound element walker(`walkStat`, `walkQuote`, `walkBullet`)의 sub-bounds 분배는 PR-6 post-cleanup까지 위 MUST로부터 한시적으로 carveout된다.
  현재 이 3개 walker는 `bounds.h`에 대한 비율 분배(예: `valueH = bounds.h * 0.65`)와 item별 y 계산을 수행한다. 이는 `planAll`이 compound element를 자식 PlanNode로 펼치는 설계를 포함하지 않았기 때문이며, PR-6에서 `plan-all-element.ts`를 확장하여 해소한다. 그 외 walker는 carveout 대상이 아니며 MUST를 그대로 준수한다.

## PREFER

- Plan 트리의 leaf 조건은 `blockType.startsWith('element-')`로 판정한다. `children.length === 0`을 leaf 판정에 쓰지 않는다(빈 container와 element를 구분할 수 없기 때문).

- `compile()` 본문의 패스 호출 순서를 변경해야 할 경우, 의사코드 주석을 본문 상단에 남긴다 — "왜 이 순서인가"가 암묵지가 되지 않도록.

- 새 패스를 추가할 때는 `PlanNode`를 받아 `Map<PlanNode.id, PassResult>`를 반환하는 관용을 따른다. plan 트리 구조 자체는 변경하지 않는다.
