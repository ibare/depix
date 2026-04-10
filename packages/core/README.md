# @depix/core

Depix의 핵심 패키지. DSL 파서, 컴파일러, IR 타입, 테마 시스템을 포함한다.

**외부 의존성 없음** — 순수 TypeScript로 작성되어 어떤 환경(Node.js, 브라우저, 엣지)에서든 동작한다.

## 설치

```bash
pnpm add @depix/core
```

## 사용법

### DSL 컴파일

```ts
import { compile } from '@depix/core';

const dsl = `
  flow direction:right {
    node "A" #a
    node "B" #b
    #a -> #b "연결"
  }
`;

const { ir, errors } = compile(dsl);
// ir: DepixIR — 모든 좌표, 색상이 해결된 IR 문서
// errors: ParseError[] — 구문 오류 (비치명적)
```

### 테마 적용

```ts
import { compile, darkTheme } from '@depix/core';

const { ir } = compile(dsl, { theme: darkTheme });
```

### 파서 단독 사용

```ts
import { parse, tokenize } from '@depix/core';

const tokens = tokenize(dsl);          // Token[]
const { ast, errors } = parse(dsl);    // ASTDocument + ParseError[]
```

### AST 라운드트립

```ts
import { parse, serialize } from '@depix/core';

const { ast } = parse(dsl);
const roundtripped = serialize(ast);   // AST → DSL 문자열
```

## 주요 export

| 카테고리 | export |
|----------|--------|
| 컴파일러 | `compile`, `parse`, `tokenize`, `serialize` |
| IR 타입 | `DepixIR`, `IRScene`, `IRElement`, `IRShape`, `IRText`, `IREdge`, `IRContainer`, `IRBounds`, `IRStyle` |
| IR 유틸 | `cloneElement`, `findElement`, `walkElements`, `generateId` |
| IR 검증 | `validateIR`, `validateElement`, `validateBounds` |
| 테마 | `lightTheme`, `darkTheme`, `defaultSceneTheme`, `resolveColor`, `resolveSpacing` |
| 상수 | `BLOCK_TYPES`, `ELEMENT_TYPES`, `FLAGS` |
| 에셋 | `createAssetRegistry`, `BUILTIN_ASSETS` |

## 아키텍처

```
DSL 텍스트 → tokenize → parse → AST
  → resolveData → flattenHierarchy → resolveTheme
  → planDocument → PlanNode[]
  → per-scene: scale → constraints → fixpoint(budget↔measure) → allocate-bounds → resolveFonts
  → emit → IRScene[]
  → applyOverrides → DepixIR
```

모든 패스는 순수 함수이다. 전역 상태를 읽지 않고, 같은 입력에 항상 같은 출력을 반환한다.
