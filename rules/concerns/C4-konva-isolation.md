---
version: 1
last_verified: 2026-03-05
---

# Konva 격리 C4

## When to Apply

`@depix/core`, `@depix/editor`, `@depix/react` 패키지에서 렌더링 관련 코드를 작성할 때.

## MUST

- Konva API(`konva` 패키지)는 `@depix/engine` 패키지 내부에서만 import한다.

- `@depix/react`에서 캔버스 조작이 필요한 경우 `DepixEngine`의 메서드를 통해서만 수행한다.

- `@depix/editor`의 IR 조작 함수는 Konva 좌표(픽셀)가 아닌 IR 좌표계(0–100 상대 좌표)로만 동작한다.

- 테스트에서 Konva를 사용해야 하는 경우 `@depix/engine` 패키지에서만 작성한다. `@depix/react` 테스트에서는 `DepixEngine` 생성자를 `vi.mock()`으로 모킹한다.

## MUST NOT

- `@depix/core`, `@depix/editor`에서 `import ... from 'konva'`를 작성하지 않는다.

- `@depix/react` 컴포넌트가 Konva Stage, Layer, Node 객체를 직접 참조하지 않는다.

- IR 좌표(0–100)와 Konva 픽셀 좌표를 혼용하지 않는다. 변환은 반드시 `CoordinateTransform`을 통한다.

## PREFER

- Konva와 무관한 로직은 `@depix/editor`나 `@depix/core`로 분리해 테스트 가능성을 높인다.
