# Zustand Store — S-zustand

## When to Apply
`packages/react/src/store/` 파일을 수정하거나,
`useEditorStore`, `useEditorStoreApi`, `createEditorStore`를 사용할 때.

## MUST
- Store는 `@depix/react` 패키지의 `src/store/` 디렉터리에만 위치한다.
- 인스턴스별 store 패턴을 사용한다: `createStore()` + React Context.
  글로벌 싱글턴 `create()`를 사용하지 않는다.
- Store에는 UI 상태만 저장한다 (선택, 도구, 모드, 패널 위치 등).
  매니저 클래스 인스턴스(`_managers`)는 라이프사이클 관리 목적으로 예외적으로
  store에 보관할 수 있다. 단, 매니저의 상태는 onChange 콜백으로 store의
  UI 상태에 미러링해야 한다.
- 컴포넌트는 selector를 통해 필요한 slice만 구독한다:
  `useEditorStore(s => s.selectedIds)` (O)
  `useEditorStore(s => s)` (X — 전체 구독 금지)
- 매니저 클래스(SelectionManager, HistoryManager 등)는 onChange 콜백으로
  store에 미러링한다. 매니저를 store 슬라이스로 흡수하지 않는다.
- 슬라이스 팩토리는 Zustand StateCreator 패턴을 따른다.
- Store 테스트는 React 없이 `createEditorStore()` 직접 호출로 작성한다.

## MUST NOT
- DSL 텍스트(`dsl: string`)를 store에 저장하지 않는다.
  DSL은 부모 컴포넌트가 controlled prop으로 소유한다.
- IR(`DepixIR`)을 store에 저장하지 않는다.
  IR은 `useDSLSync` 훅이 DSL에서 파생한다.
- Konva 객체(Stage, Layer, Node, Transformer)를 store에 저장하지 않는다. (C4)
- `@depix/core`, `@depix/engine`, `@depix/editor`에서 store를 import하지 않는다. (P1)
- store 액션 내에서 컴파일러 또는 렌더러를 직접 호출하지 않는다.
- 비React 코드(컴파일러, IR 연산)에서 store 훅을 사용하지 않는다.

## PREFER
- 관련 상태는 같은 슬라이스에 그룹화한다 (ui, selection, scene, history).
- immer 미들웨어로 중첩 객체 업데이트를 간소화한다.
- shallow 비교가 필요한 객체 셀렉터에는 `shallow`를 명시한다.
