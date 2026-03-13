---
version: 2
last_verified: 2026-03-13
---

# Konva 격리 C4

## 목적

- **테스트 가능성**: `@depix/react` 테스트에서 `DepixEngine`을 `vi.mock()`으로 모킹하면 Konva가 테스트 환경에 로드되지 않는다.
- **좌표계 분리**: IR 좌표(0–100 상대 좌표)와 Konva 픽셀 좌표의 혼용을 방지한다.

## When to Apply

`@depix/core`, `@depix/editor`, `@depix/react` 패키지에서 렌더링 관련 코드를 작성할 때.

## MUST

- `konva` 패키지 import는 `@depix/engine` 내부에서만 한다.
  `@depix/core`, `@depix/editor`, `@depix/react`에서 `import ... from 'konva'`를 작성하지 않는다.

- `@depix/react`에서 Konva 객체가 필요한 경우, `DepixEngine`의 메서드를 통해 참조를 획득한다.
  Konva 객체를 직접 생성(`new Konva.*()`)하지 않는다.

- `@depix/editor`의 IR 조작 함수는 IR 좌표계(0–100 상대 좌표)로만 동작한다.

- `@depix/react` 테스트에서는 `DepixEngine`을 `vi.mock()`으로 모킹한다.
  Konva를 직접 테스트하지 않는다.

## MUST NOT

- `@depix/core`, `@depix/editor`에서 `import ... from 'konva'`를 작성하지 않는다.

- `@depix/react`에서 `new Konva.*()` 로 Konva 노드를 직접 생성하지 않는다.
  Konva 객체의 **생성과 소멸**은 `DepixEngine`이 담당한다.

- IR 좌표(0–100)와 Konva 픽셀 좌표를 혼용하지 않는다.
  변환은 반드시 `CoordinateTransform`을 통한다.

## PREFER

- Konva와 무관한 로직은 `@depix/editor`나 `@depix/core`로 분리해 테스트 가능성을 높인다.
