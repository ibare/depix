# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Baden Monitoring
- Project Name: `depix`  

이 프로젝트는 Baden 모니터링 하에 운영된다. 모든 행동에 대해 해당하는 baden MCP 도구를 호출하라.

### 사용자 지시 수신
사용자가 새로운 지시를 내리면, **작업을 시작하기 전에** `baden_start_task`를 호출하라.
이후 같은 작업의 모든 도구 호출에 반환된 `taskId`를 사용하라.

### 계획 수립 보고
코드를 읽거나 수정하지 않더라도, **접근 방식을 결정하거나 계획을 세울 때** `baden_plan`을 호출하라.
계획 모드(plan mode)에 진입했을 때도 동일하게 보고한다.

### 행동 보고
이후 모든 행동을 실행하기 **전에** `baden_action`을 호출하라.
규칙 관련 행동은 `baden_rule`, 검증 행동은 `baden_verify`를 사용한다.

### 작업 완료 보고
작업이 완료되면 `baden_complete_task`를 호출하라.

### 원칙
- **보고 없이 행동하지 마라.** 파일 읽기, 검색, 테스트 실행 등 모든 행동은 Baden에 보고한 뒤 수행한다.
- **계획 수립도 보고하라.** 접근 방식 결정, 계획 작성 등 도구를 사용하지 않는 사고 과정도 보고 대상이다.
- **action은 자유롭게 서술하라.** 수행할 행동을 요약하는 snake_case 키워드를 직접 만들어 사용하라.
- **reason은 구체적으로 기술하라.** 나중에 읽어도 맥락을 이해할 수 있는 설명을 작성하라.


## Rule Guard

코드를 수정할 때 rule-guard 서브에이전트를 두 번 호출한다:
1. 수정 계획 수립 후, 실행 전 → 사전 검토
2. 수정 완료 후 → 사후 검증

`rules/INDEX.yaml`에서 현재 작업에 적용되는 규칙을 확인한다.
MUST / MUST NOT 위반은 금지한다. 규칙 파일을 먼저 읽는다. 추론하지 않는다.
규칙 파일을 수정하지 않는다.

## Build & Development Commands

```bash
pnpm build            # Build all packages (tsc)
pnpm test             # Run all tests
pnpm test:coverage    # Run tests with coverage
pnpm lint             # ESLint across monorepo
pnpm typecheck        # tsc -b composite check

# Single package
pnpm --filter @depix/core test
pnpm --filter @depix/react test

# Single test file
pnpm --filter @depix/core exec vitest run __tests__/compiler/tokenizer.test.ts

# Watch mode
pnpm --filter @depix/core test:watch

# Demo app
pnpm --filter @depix/demo dev
```

## Architecture

**3-layer pipeline:** DSL v2 → Compiler → DepixIR → Renderer

```
DSL v2 Text
    ↓  Tokenizer → Parser (packages/core/src/compiler/)
AST
    ↓  Theme resolution → Layout → Edge routing
DepixIR  (fully resolved: all coordinates, colors, paths computed)
    ↓  CoordinateTransform → Konva nodes (packages/engine/)
Canvas
```

**DepixIR is the central data structure.** It contains scenes, each with positioned elements. The compiler produces it; the engine renders it; the editor mutates it. IR is immutable in the pipeline — editor operations return new cloned IR objects.

### Package Dependency Graph

```
@depix/core          ← no internal deps (DSL, IR types, compiler, theme, layouts)
@depix/engine        ← core (Konva renderer, coordinate transform, PNG export)
@depix/editor        ← core, engine (selection, history, handles, snap, IR operations)
@depix/react         ← core, engine, editor (React components, hooks, TipTap integration)
```

### Key Subsystems

- **Compiler** (`core/src/compiler/`): tokenizer → parser → AST → theme resolver → layout pass → edge routing → IR emit. Layout algorithms: stack, grid, flow, tree, group, layers, canvas.
- **DepixEngine** (`engine/src/depix-engine.ts`): Renders IR to Konva Stage. `load()` resets scene to 0 (new document); `update()` preserves scene index (editing). `fitToAspectRatio()` auto-fits stage within available space.
- **Editor managers** (`editor/src/`): SelectionManager, HistoryManager, HandleManager, SnapGuideManager — each is a standalone class with event subscriptions, instantiated by React components.
- **IR operations** (`editor/src/operations/`): Pure functions that clone and mutate IR: moveElement, resizeElement, addElement, removeElement, updateStyle. Semantic operations for flow/stack/grid/tree editing.

### IR Element Types

7 discriminated types via `element.type`: `shape`, `text`, `line`, `edge`, `container`, `image`, `path`. Each has `id`, `bounds` (x/y/width/height in 0-100 relative coords), `style`, and type-specific fields.

## Monorepo Structure

- `packages/core/` — Pure logic, no DOM dependency. Test env: `node`
- `packages/engine/` — Konva rendering. Test env: `happy-dom`. Konva cannot fully run in happy-dom, so tests mock or test pure functions.
- `packages/editor/` — IR manipulation. Test env: `happy-dom`
- `packages/react/` — React components/hooks. Test env: `happy-dom`. DepixEngine is mocked in tests.
- `apps/demo/` — Vite + React demo app
- `docs/` — Architecture docs, IR spec, DSL grammar, TODO tracking

## Testing Conventions

- **Vitest** with per-package `vitest.config.ts`
- `core` has custom matchers in `__tests__/setup.ts` (e.g., `toHaveBoundsCloseTo`)
- Test fixtures in `__tests__/fixtures/` (DSL strings, AST snapshots, IR JSON)
- Layout algorithm tests use invariant helpers from `__tests__/helpers/layout-assertions.ts`
- React component tests mock `@depix/engine` (DepixEngine constructor) and `@depix/editor` (all managers) via `vi.hoisted()` + `vi.mock()`

## Code Conventions

- **ESM with `.js` extensions** in imports: `import { foo } from './module.js'`
- **Type-only imports**: `import type { SomeType } from './types.js'`
- **Immutable IR pattern**: operations clone the IR, never mutate in place
- **Coordinates**: IR uses 0-100 relative system; CoordinateTransform converts to pixels
- **Formatting**: Single quotes, semicolons, trailing commas, 100 char width
- **Unused vars**: prefix with `_` (ESLint configured)
- **한국어 커뮤니케이션**: User prefers Korean for all communication
