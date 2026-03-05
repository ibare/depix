# Principles

모든 코드에 항상 적용되는 핵심 원칙.

---

## 1. 레이어 의존성 방향

패키지 의존은 한 방향으로만 흐른다:

```
@depix/core  ←  @depix/engine  ←  @depix/editor  ←  @depix/react
```

- `core`는 다른 어떤 내부 패키지도 import하지 않는다.
- `engine`은 `core`만 import한다.
- `editor`는 `core`, `engine`만 import한다.
- `react`는 `core`, `engine`, `editor`를 import한다.
- 역방향 의존은 어떤 이유로도 허용하지 않는다.

## 2. IR 불변성

IR은 직접 변경하지 않는다. IR을 조작하는 모든 함수는 `structuredClone`으로 깊은 복사 후 수정된 새 IR을 반환한다.

- 원본 IR 객체의 프로퍼티를 직접 할당하거나 push하지 않는다.
- 반환값은 항상 새로운 객체여야 한다.

## 3. 컴파일러 패스 순수성

컴파일러의 각 패스(tokenize, parse, resolveTheme, planLayout, allocateBounds, layout, routeEdges, emitIR)는 순수 함수다.

- 전역 상태를 읽거나 쓰지 않는다.
- 파일 I/O, 네트워크, 타이머를 사용하지 않는다.
- 같은 입력에 항상 같은 출력을 반환한다.

## 4. IR은 완전 해결 상태

IR에는 시맨틱 토큰이나 미해결 값이 포함되지 않는다. 컴파일러가 IR을 생성하는 시점에 모든 값이 확정되어야 한다.

- 색상: `'primary'`, `'success'` 같은 시맨틱 컬러가 IR에 들어가면 안 된다. HEX 문자열만 허용.
- 좌표: `'auto'`, `'fill'`, `'hug'` 같은 동적 크기가 IR에 들어가면 안 된다. 숫자만 허용.
- 간격: `'md'`, `'lg'` 같은 시맨틱 토큰이 IR에 들어가면 안 된다.

## 5. 패키지 경계 준수

패키지 간 의존은 반드시 `index.ts` barrel export를 통한다. 패키지 내부 파일을 직접 참조하지 않는다.

- `@depix/core/src/compiler/tokenizer.js` 같은 경로 직접 참조 금지.
- `@depix/core`로 import하고 index.ts가 export하는 것만 사용한다.

## 6. Konva 격리

Konva 의존은 `@depix/engine` 패키지 내부에만 허용한다.

- `@depix/core`, `@depix/editor`에서 `konva`를 import하지 않는다.
- `@depix/react`에서 Konva API를 직접 호출하지 않는다. DepixEngine을 통해서만 상호작용한다.
