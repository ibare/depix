---
version: 1
last_verified: 2026-03-26
---

# DSL Mutations — S-dsl-mutations

## When to Apply

`packages/editor/src/dsl-mutations.ts`, `packages/core/src/compiler/serializer.ts`,
또는 DSL 텍스트를 프로그래밍 방식으로 조작하는 코드를 수정할 때.

## MUST

- 모든 뮤테이션 함수는 `parse(dsl) → AST 조작 → serialize(ast)` 패턴을 따른다.
  AST를 직접 문자열 조작으로 우회하지 않는다.
- 뮤테이션 함수는 순수 함수여야 한다. 같은 DSL 입력에 항상 같은 DSL 출력을 반환한다.
- serialize(parse(dsl))의 라운드트립은 의미적으로 동등한 DSL을 생성해야 한다.
  (공백/줄바꿈은 달라질 수 있으나 컴파일 결과가 동일해야 한다.)
- AST 노드 순회 시 존재하지 않는 인덱스 접근을 방어한다.
  (예: sceneIndex가 scenes 배열 범위를 초과하면 원본 DSL을 그대로 반환한다.)

## MUST NOT

- DSL 문자열을 정규식이나 문자열 치환으로 직접 조작하지 않는다.
  반드시 파서를 통해 AST로 변환한 뒤 조작한다.
- 뮤테이션 함수 내에서 compile()을 호출하지 않는다.
  뮤테이션은 텍스트 레벨 변환이며, IR 생성은 호출자의 책임이다.
- serialize()가 생성하는 DSL에 원본에 없던 디렉티브나 블록을 삽입하지 않는다.

## PREFER

- 새로운 뮤테이션 함수를 추가할 때 기존 함수와 동일한 시그니처 패턴을 따른다:
  `(dsl: string, ...params) => string`
- 뮤테이션 함수명은 동작을 명확히 표현한다: add*, remove*, change*, upsert*, reorder*
