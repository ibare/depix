---
version: 1
last_verified: 2026-03-05
---

# IR 조작 S-ir-ops

## When to Apply

`packages/editor/src/ir-operations.ts`, `packages/editor/src/ir-edge-operations.ts`, `packages/editor/src/semantic-editor.ts`, `packages/editor/src/detach.ts`를 수정하거나 새 IR 조작 함수를 추가할 때.

## MUST

- IR 조작 함수는 반드시 `structuredClone(ir)`으로 깊은 복사한 후 복사본을 수정하고 반환한다.
  ```ts
  // ✅
  export function moveElement(ir: DepixIR, elementId: string, dx: number, dy: number): DepixIR {
    const cloned = structuredClone(ir);
    // cloned를 수정...
    return cloned;
  }
  // ❌
  ir.scenes[0].elements[0].bounds.x += dx;
  return ir;
  ```

- 조작 함수의 반환 타입은 항상 `DepixIR`이다. 부분 업데이트나 diff를 반환하지 않는다.

- 엘리먼트 제거 시 해당 엘리먼트와 연결된 모든 `IREdge`도 함께 제거한다.

- `recalculateEdge`는 기존 엣지의 `id`와 `style`을 유지한 채 경로(`path`)만 갱신한다.

- `semantic-editor.ts`의 스마트 편집 함수는 조작 후 반드시 `relayoutContainer`를 호출해 레이아웃을 동기화한다.

## MUST NOT

- IR 조작 함수가 Konva API를 호출하지 않는다. 순수 데이터 변환만 수행한다.

- IR 조작 함수가 React 상태나 DOM에 접근하지 않는다.

- `structuredClone` 없이 IR 프로퍼티를 직접 할당하지 않는다.
  ```ts
  // ❌
  ir.scenes[0].elements.push(newElement);
  ```

- `origin` 필드를 임의로 설정하거나 제거하지 않는다. `origin`은 컴파일러가 설정하고 `detach.ts`만 제거할 수 있다.

## PREFER

- no-op 최적화: 변경 사항이 없으면 원본 참조를 그대로 반환해 불필요한 리렌더링을 방지한다.
  ```ts
  if (element === undefined) return ir; // no-op
  ```
- 조작 함수의 인자는 최소화한다. IR, elementId, 변경값 세 가지로 충분한 경우가 대부분이다.
