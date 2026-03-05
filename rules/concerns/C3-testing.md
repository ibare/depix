---
version: 1
last_verified: 2026-03-05
---

# 테스트 원칙 C3

## When to Apply

새 테스트 파일을 작성하거나 기존 테스트를 수정할 때.

## MUST

- 레이아웃 결과는 정확한 좌표 값이 아닌 **불변식(invariant)**으로 검증한다. 알고리즘 세부 구현이 바뀌어도 테스트가 깨지지 않아야 한다.
  ```ts
  // ✅ 불변식 검증
  assertChildrenWithinParent(parent, children);
  assertNoOverlap(children);
  assertOrderedInDirection(children, 'right');
  // ❌ 좌표 하드코딩
  expect(children[0].bounds.x).toBe(12.5);
  ```

- IR 빌더 함수(`shape()`, `container()`, `scene()` 등)를 사용해 테스트 픽스처를 생성한다. 직접 객체 리터럴로 IR을 작성하지 않는다.

- 컴파일러 패스 테스트는 해당 패스만 독립적으로 테스트한다. 전체 `compile()` 파이프라인에 의존하지 않는다.

- 불변성(immutability) 테스트를 포함한다. 함수 호출 후 입력 객체가 변경되지 않았는지 확인한다.

## MUST NOT

- 레이아웃 좌표를 픽셀 수준으로 하드코딩하지 않는다. 정확한 숫자 단언은 알고리즘 변경 시 깨진다.

- Konva를 실제로 실행하는 테스트를 `@depix/core`, `@depix/editor`에 작성하지 않는다. engine 패키지에서만 허용된다.

- 테스트에서 `setTimeout`, `setInterval` 같은 비동기 타이머에 의존하지 않는다. vi.useFakeTimers()를 사용한다.

## PREFER

- 경계 케이스(빈 입력, 단일 요소, 최대 깊이)를 항상 테스트한다.
- `it.each`로 같은 구조의 테스트를 파라미터화한다.
- 스냅샷 테스트는 AST/IR 전체 구조 확인에만 사용한다. 세부 좌표 검증에는 사용하지 않는다.
