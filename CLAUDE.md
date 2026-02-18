# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
