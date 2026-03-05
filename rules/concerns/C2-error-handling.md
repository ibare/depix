---
version: 1
last_verified: 2026-03-05
---

# 에러 처리 C2

## When to Apply

컴파일러, 파서, IR 조작 함수, 외부 입력을 처리하는 모든 코드.

## MUST

- 컴파일/파싱 에러는 예외를 throw하지 않고 `ParseError[]` 배열로 수집하여 반환한다.
  ```ts
  // ✅
  return { ir, errors: [{ line: 3, message: 'Unexpected token' }] };
  // ❌
  throw new Error('Unexpected token at line 3');
  ```

- `ParseError`는 반드시 `line`과 `message`를 포함한다.

- 복구 불가능한 프로그래밍 오류(잘못된 인자 타입, 존재하지 않는 ID 참조 등)는 예외를 throw한다. 이는 호출자의 버그이지 데이터 에러가 아니다.

- catch한 에러를 무시하지 않는다. 로깅하거나 재전파하거나 에러 배열에 추가한다.

## MUST NOT

- 파서/컴파일러 함수가 에러 하나로 전체 처리를 중단하지 않는다. 에러를 수집하고 가능한 한 계속 진행한다 (에러 복구).

- `catch (e) {}` 빈 catch 블록을 사용하지 않는다.

- `any` 타입으로 에러를 처리하지 않는다. `(e as Error).message` 또는 `instanceof` 가드를 사용한다.

## PREFER

- 에러 복구 가능한 위치에서는 부분 결과와 에러 배열을 함께 반환하는 Result 패턴을 사용한다.
  ```ts
  return { result: partialIR, errors };
  ```
