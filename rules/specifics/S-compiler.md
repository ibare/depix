---
version: 1
last_verified: 2026-03-07
---

# 컴파일러 S-compiler

## When to Apply

`packages/core/src/compiler/` 하위 파일을 생성하거나 수정할 때.

## MUST

- 컴파일러 최상위 파이프라인 순서: `parse → resolveData → flattenHierarchy → resolveTheme → extractOverrides → normalizeScenes → emitSceneIR → applyOverridesToIR`
  각 패스는 이전 패스의 출력만을 입력으로 받는다. 순서를 바꾸거나 패스를 건너뛰지 않는다.
  `flattenHierarchy`는 connection 계열 레이아웃(tree, flow)의 nested element를 flat children + implicit edges로 정규화하는 AST 변환 패스이다.
  `normalizeScenes`는 모든 top-level 블록을 슬롯 기반 scene block으로 정규화하는 AST 변환 패스이다. 비-scene 블록(flow, stack 등)은 `scene { layout: full; body: <block> }`으로 래핑된다.
  `emitSceneIR`이 최종 통합 단계이다: 모든 블록은 `normalizeScenes`에 의해 슬롯 기반 scene으로 정규화된 후, `planScene → emitScene` 경로를 탄다. 다이어그램 블록은 scene 내에서 `emitInlineBlock`으로 처리된다.

- 다이어그램 블록의 내부 파이프라인 순서: `planLayout → createScaleContext → computeConstraints → allocateBudgets → measure → allocateBounds → layout → routeEdges → emitIR`
  `computeConstraints`는 plan 트리를 bottom-up(후위순회)으로 순회하며 각 노드의 최소/최대 크기 제약을 수집하는 패스이다.
  `allocateBudgets`는 캔버스 루트로부터 top-down(BFS)으로 가용 공간을 배분하여 각 노드의 예산(budget)을 결정하는 패스이다.
  `measure`는 plan 트리를 bottom-up으로 순회하며 각 노드의 fontSize, lineHeight, padding, 최소 크기를 산출하는 측정 패스이다. budgetMap이 제공되면 예산 기반으로 fontSize를 결정한다.

- 새 레이아웃 알고리즘은 `packages/core/src/compiler/layout/` 에 독립 파일로 추가한다. `emit-ir.ts` 내부에 인라인으로 작성하지 않는다.

- 레이아웃 함수의 시그니처는 `(children: LayoutChild[], config: XxxLayoutConfig): LayoutResult` 형태를 따른다.

- `emitIR` 패스는 IR 요소를 생성만 한다. 레이아웃 계산, 색상 해석, 경로 라우팅을 emitIR 내부에서 직접 수행하지 않는다. 이미 완료된 `BoundsMap`과 `ScaleContext`를 사용한다.

- `ScaleContext`의 `baseUnit`은 `sqrt(canvasArea / elementCount) * DENSITY_FACTOR(0.55)` 공식으로 산출한다. 임의의 고정값을 사용하지 않는다.

- `computeConstraints`(bottom-up)와 `allocateBudgets`(top-down)의 2-pass 구조로 fontSize↔공간의 순환 의존을 해결한다. 제약 수집이 예산 배분보다 먼저 실행되어야 한다.

- tree 블록의 cross-axis 예산은 `subtreeSpan`(리프 노드 수) 비례로 배분한다. 균등 분배가 아닌 서브트리 크기 비례 분배를 사용한다.

- `countElements()`에서 list 요소의 `items` 배열 길이를 리프 수에 반영한다. list items는 plan tree의 자식이 아니지만 밀도(density) 계산에 포함되어야 한다.

- box/layer 요소에 title/subtitle이 있으면 자식 예산 배분 전 해당 높이를 차감(reserve)한다. 타이틀 공간을 고려하지 않고 자식에게 전체 예산을 배분하지 않는다.

- fontSize 결정 우선순위: (1) 사용자 인라인 스타일(`font-size`) → (2) budget 기반 ScaleSystem(`computeFontSize`) → (3) 테마 폴백. `budgetMap`이 제공되면 `plan.intrinsicSize` 대신 budget의 shortSide를 사용한다.

- `pinnedWidth`/`pinnedHeight`가 설정된 노드는 예산 배분에서 고정 크기로 취급하고 나머지를 다른 노드에 재분배한다.

- 자식들의 minSize 합계가 부모 예산을 초과하면 비례 축소(ratio compression)한다. `redistributeWithMinimums`를 사용하여 최소 크기를 보장하면서 전체를 조정한다.

- 컴파일러 패스 파일의 경험적 수치 상수(magic constant)는 반드시 근거 주석을 포함한다.
  주석에는 (1) 도출 방식 또는 기준, (2) 단위(0–100 상대 좌표 기준)를 명시한다.
  수학적으로 자명한 값(0, 1, Math.PI 등)은 제외.

## MUST NOT

- 컴파일러 패스 함수가 전역 변수, 모듈 수준 캐시, 클로저 외부 상태를 읽거나 쓰지 않는다.

- `resolveTheme` 패스 이후 AST에 시맨틱 토큰(`'primary'`, `'md'`, `'lg'` 등)이 남아 있어서는 안 된다.

- 레이아웃 알고리즘이 픽셀 단위(px)로 계산하지 않는다. 항상 0–100 상대 좌표계를 사용한다.

- 파서가 레이아웃을 수행하거나 레이아웃 함수가 파싱을 수행하지 않는다. 각 패스의 책임을 침범하지 않는다.

## PREFER

- 레이아웃 알고리즘은 재귀보다 반복(iteration)으로 구현한다. 깊은 재귀로 인한 스택 오버플로우를 방지한다.
- 에지 케이스(빈 자식, 단일 자식)를 함수 초반부에 early return으로 처리한다.
