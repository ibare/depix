---
version: 1
last_verified: 2026-04-07
---

# 컴파일러 파이프라인 S-pipeline

## When to Apply

`packages/core/src/compiler/` 하위에서 `compile()` 진입점, `passes/`, `emit*.ts`, `layout/plan-*.ts` 파일을 생성하거나 수정할 때.

본 규칙은 "단일 Plan 트리 + 루트 1회 핑퐁" 파이프라인의 무결성을 보장한다. `S-compiler.md`가 각 패스의 _내부 규칙_ 을 다룬다면, `S-pipeline.md`는 패스들이 _어떻게 서로 조립되는지_ 를 다룬다.

## MUST

- `compile()`은 `measureDiagram` / `allocateBudgets` / `computeConstraints` / `allocateBounds`를 _루트에서 정확히 1회씩_ 호출한다.
  각 패스는 `PlanNode` 루트 하나를 받고 트리 전체를 자체 재귀로 순회한다. container별 자체 호출 금지.

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

## PREFER

- Plan 트리의 leaf 조건은 `blockType.startsWith('element-')`로 판정한다. `children.length === 0`을 leaf 판정에 쓰지 않는다(빈 container와 element를 구분할 수 없기 때문).

- `compile()` 본문의 패스 호출 순서를 변경해야 할 경우, 의사코드 주석을 본문 상단에 남긴다 — "왜 이 순서인가"가 암묵지가 되지 않도록.

- 새 패스를 추가할 때는 `PlanNode`를 받아 `Map<PlanNode.id, PassResult>`를 반환하는 관용을 따른다. plan 트리 구조 자체는 변경하지 않는다.
