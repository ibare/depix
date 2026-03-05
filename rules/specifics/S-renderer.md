---
version: 1
last_verified: 2026-03-05
---

# 렌더러 S-renderer

## When to Apply

`packages/engine/src/` 하위 파일을 생성하거나 수정할 때.

## MUST

- 렌더러는 IR의 값을 그대로 Konva 노드에 매핑한다. 좌표 계산, 색상 해석, 경로 라우팅을 렌더러 내부에서 수행하지 않는다. 이미 해결된 IR 값을 사용한다.

- 좌표 변환은 반드시 `CoordinateTransform`을 통한다. IR 좌표(0–100)를 직접 픽셀로 계산하지 않는다.

- `DepixEngine.load(ir)`는 씬 인덱스를 0으로 초기화한다 (새 문서 로드). `DepixEngine.update(ir)`는 현재 씬 인덱스를 유지한다 (편집 중 업데이트).

- `renderElement(element, transform)`은 element의 `type` 필드로만 분기한다. 타입 외의 조건(특정 id, style 값 등)으로 렌더링을 다르게 하지 않는다.

## MUST NOT

- 렌더러가 IR을 변경하지 않는다. `renderElement`는 Konva 노드를 반환할 뿐, 입력 IR을 수정하지 않는다.

- 렌더러가 레이아웃 알고리즘을 import하거나 실행하지 않는다. `@depix/core/src/compiler/layout/`을 참조하지 않는다.

- 씬 전환 로직이 요소 렌더링 로직과 혼재되지 않는다. 씬 관리는 `scene-manager.ts`에서 담당한다.

## PREFER

- 각 element type의 렌더링 로직은 별도 함수로 분리한다. `renderElement`는 type 기반 디스패치만 담당한다.
- Konva 노드 생성 시 style이 없는 기본값을 명시적으로 설정한다. undefined 암묵적 기본값에 의존하지 않는다.
