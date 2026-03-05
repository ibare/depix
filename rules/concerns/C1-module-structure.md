---
version: 1
last_verified: 2026-03-05
---

# 모듈 구조 C1

## When to Apply

새 파일을 생성하거나 import 구문을 추가/변경할 때.

## MUST

- 패키지 내부 모듈 간 import에 `.js` 확장자를 사용한다. TypeScript ESM 규칙.
  ```ts
  // ✅
  import { foo } from './module.js';
  import type { Bar } from './types.js';
  // ❌
  import { foo } from './module';
  import { foo } from './module.ts';
  ```

- 타입만 import할 때는 `import type`을 사용한다.
  ```ts
  // ✅
  import type { DepixIR } from './ir/types.js';
  // ❌
  import { DepixIR } from './ir/types.js'; // 값이 없는 타입을 일반 import
  ```

- 각 패키지의 공개 API는 `src/index.ts`에서만 export한다. 패키지 내부 파일을 직접 노출하지 않는다.

- 파일명은 kebab-case를 사용한다. (`edge-router.ts`, `snap-calculator.ts`)

- React 컴포넌트 파일명은 PascalCase를 사용한다. (`DepixCanvas.tsx`, `FloatingToolbar.tsx`)

## MUST NOT

- 순환 의존을 만들지 않는다. A가 B를 import하고 B가 A를 import하는 구조 금지.

- 패키지 내부 경로를 외부에서 직접 참조하지 않는다.
  ```ts
  // ❌
  import { tokenize } from '@depix/core/src/compiler/tokenizer.js';
  // ✅
  import { compile } from '@depix/core';
  ```

## PREFER

- 관련 기능은 같은 디렉터리에 모으고 `index.ts`로 barrel export한다.
- 파일 하나에 하나의 주요 export를 담는다.
