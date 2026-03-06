---
version: 1
last_verified: 2026-03-05
---

# 컴파일러 S-compiler

## When to Apply

`packages/core/src/compiler/` 하위 파일을 생성하거나 수정할 때.

## MUST

- 컴파일러 패스는 정해진 순서를 따른다: `tokenize → parse → flattenHierarchy → resolveTheme → planLayout → createScaleContext → measure → allocateBounds → layout → routeEdges → emitIR`
  각 패스는 이전 패스의 출력만을 입력으로 받는다. 순서를 바꾸거나 패스를 건너뛰지 않는다.
  `flattenHierarchy`는 connection 계열 레이아웃(tree, flow)의 nested element를 flat children + implicit edges로 정규화하는 AST 변환 패스이다.
  `measure`는 plan 트리를 bottom-up으로 순회하며 각 노드의 fontSize, lineHeight, padding, 최소 크기를 산출하는 측정 패스이다.

- 새 레이아웃 알고리즘은 `packages/core/src/compiler/layout/` 에 독립 파일로 추가한다. `emit-ir.ts` 내부에 인라인으로 작성하지 않는다.

- 레이아웃 함수의 시그니처는 `(children: LayoutChild[], config: XxxLayoutConfig): LayoutResult` 형태를 따른다.

- `emitIR` 패스는 IR 요소를 생성만 한다. 레이아웃 계산, 색상 해석, 경로 라우팅을 emitIR 내부에서 직접 수행하지 않는다. 이미 완료된 `BoundsMap`과 `ScaleContext`를 사용한다.

- `ScaleContext`의 `baseUnit`은 `sqrt(canvasArea / elementCount) * DENSITY_FACTOR(0.55)` 공식으로 산출한다. 임의의 고정값을 사용하지 않는다.

## MUST NOT

- 컴파일러 패스 함수가 전역 변수, 모듈 수준 캐시, 클로저 외부 상태를 읽거나 쓰지 않는다.

- `resolveTheme` 패스 이후 AST에 시맨틱 토큰(`'primary'`, `'md'`, `'lg'` 등)이 남아 있어서는 안 된다.

- 레이아웃 알고리즘이 픽셀 단위(px)로 계산하지 않는다. 항상 0–100 상대 좌표계를 사용한다.

- 파서가 레이아웃을 수행하거나 레이아웃 함수가 파싱을 수행하지 않는다. 각 패스의 책임을 침범하지 않는다.

## PREFER

- 레이아웃 알고리즘은 재귀보다 반복(iteration)으로 구현한다. 깊은 재귀로 인한 스택 오버플로우를 방지한다.
- 에지 케이스(빈 자식, 단일 자식)를 함수 초반부에 early return으로 처리한다.
