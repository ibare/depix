/**
 * useDSLInspectorCallbacks Tests
 *
 * Verifies the adapter hook correctly bridges IR-based callbacks
 * to DSL text mutations.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { compile, parse } from '@depix/core';
import { useDSLInspectorCallbacks } from '../src/hooks/useDSLInspectorCallbacks.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function compileDSL(dsl: string) {
  try {
    const result = compile(dsl);
    return result.ir;
  } catch {
    return null;
  }
}

function createProps(overrides: {
  dsl?: string;
  onDSLChange?: ReturnType<typeof vi.fn>;
  activeSceneIndex?: number;
  onActiveSceneIndexChange?: ReturnType<typeof vi.fn>;
}) {
  const dsl = overrides.dsl ?? '';
  return {
    dsl,
    onDSLChange: overrides.onDSLChange ?? vi.fn(),
    activeSceneIndex: overrides.activeSceneIndex ?? 0,
    onActiveSceneIndexChange: overrides.onActiveSceneIndexChange ?? vi.fn(),
    ir: compileDSL(dsl),
  };
}

// ---------------------------------------------------------------------------
// Scene callbacks
// ---------------------------------------------------------------------------

describe('useDSLInspectorCallbacks — scene callbacks', () => {
  it('onAddScene appends a new scene', () => {
    const onDSLChange = vi.fn();
    const dsl = 'scene "First" {\n  node "A"\n}';
    const { result } = renderHook(() =>
      useDSLInspectorCallbacks(createProps({ dsl, onDSLChange })),
    );

    act(() => result.current.onAddScene());

    expect(onDSLChange).toHaveBeenCalledOnce();
    const newDsl = onDSLChange.mock.calls[0][0];
    const { ast } = parse(newDsl);
    expect(ast.scenes).toHaveLength(2);
  });

  it('onDeleteScene removes a scene by index', () => {
    const onDSLChange = vi.fn();
    const dsl = 'scene "A" {\n  node "1"\n}\n\nscene "B" {\n  node "2"\n}';
    const { result } = renderHook(() =>
      useDSLInspectorCallbacks(createProps({ dsl, onDSLChange })),
    );

    act(() => result.current.onDeleteScene(0));

    expect(onDSLChange).toHaveBeenCalledOnce();
    const newDsl = onDSLChange.mock.calls[0][0];
    const { ast } = parse(newDsl);
    expect(ast.scenes).toHaveLength(1);
    expect(ast.scenes[0].label).toBe('B');
  });

  it('onRenameScene changes scene title', () => {
    const onDSLChange = vi.fn();
    const dsl = 'scene "Original" {\n  node "A"\n}';
    const { result } = renderHook(() =>
      useDSLInspectorCallbacks(createProps({ dsl, onDSLChange })),
    );

    act(() => result.current.onRenameScene(0, 'Updated'));

    expect(onDSLChange).toHaveBeenCalledOnce();
    const newDsl = onDSLChange.mock.calls[0][0];
    const { ast } = parse(newDsl);
    expect(ast.scenes[0].label).toBe('Updated');
  });

  it('onSceneChange calls onActiveSceneIndexChange', () => {
    const onActiveSceneIndexChange = vi.fn();
    const { result } = renderHook(() =>
      useDSLInspectorCallbacks(createProps({ onActiveSceneIndexChange })),
    );

    act(() => result.current.onSceneChange(2));

    expect(onActiveSceneIndexChange).toHaveBeenCalledWith(2);
  });
});

// ---------------------------------------------------------------------------
// Layout callback
// ---------------------------------------------------------------------------

describe('useDSLInspectorCallbacks — layout', () => {
  it('onLayoutChange sets layout on scene', () => {
    const onDSLChange = vi.fn();
    const dsl = 'scene "Slide" {\n  node "A"\n}';
    const { result } = renderHook(() =>
      useDSLInspectorCallbacks(createProps({ dsl, onDSLChange })),
    );

    act(() => result.current.onLayoutChange('header'));

    expect(onDSLChange).toHaveBeenCalledOnce();
    const newDsl = onDSLChange.mock.calls[0][0];
    const { ast } = parse(newDsl);
    expect(ast.scenes[0].props.layout).toBe('header');
  });
});

// ---------------------------------------------------------------------------
// Element callbacks (with explicit IDs)
// ---------------------------------------------------------------------------

describe('useDSLInspectorCallbacks — element callbacks', () => {
  it('onTextChange updates element label via ID→index mapping', () => {
    const onDSLChange = vi.fn();
    const dsl = 'flow {\n  node "Old" #mynode\n}';
    const { result } = renderHook(() =>
      useDSLInspectorCallbacks(createProps({ dsl, onDSLChange })),
    );

    act(() => result.current.onTextChange('mynode', 'New Label'));

    expect(onDSLChange).toHaveBeenCalledOnce();
    const newDsl = onDSLChange.mock.calls[0][0];
    const { ast } = parse(newDsl);
    // Find the element in the AST
    const flow = ast.scenes[0].children[0];
    expect(flow.kind).toBe('block');
    const el = (flow as any).children[0];
    expect(el.label).toBe('New Label');
  });

  it('onBoundsChange creates/updates @overrides entry', () => {
    const onDSLChange = vi.fn();
    const dsl = 'flow {\n  node "A" #a\n}';
    const { result } = renderHook(() =>
      useDSLInspectorCallbacks(createProps({ dsl, onDSLChange })),
    );

    act(() => result.current.onBoundsChange('a', { x: 50, y: 60 }));

    expect(onDSLChange).toHaveBeenCalledOnce();
    const newDsl = onDSLChange.mock.calls[0][0];
    const { ast } = parse(newDsl);
    const overrides = ast.directives.find((d) => d.key === 'overrides');
    expect(overrides).toBeDefined();
  });

  it('onTextChange is no-op for unknown ID', () => {
    const onDSLChange = vi.fn();
    const dsl = 'flow {\n  node "A"\n}';
    const { result } = renderHook(() =>
      useDSLInspectorCallbacks(createProps({ dsl, onDSLChange })),
    );

    act(() => result.current.onTextChange('nonexistent', 'X'));

    expect(onDSLChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Derived data
// ---------------------------------------------------------------------------

describe('useDSLInspectorCallbacks — derived data', () => {
  it('sceneElements returns elements from active scene', () => {
    const dsl = 'scene "S" {\n  node "A"\n  node "B"\n}';
    const { result } = renderHook(() =>
      useDSLInspectorCallbacks(createProps({ dsl })),
    );

    expect(result.current.sceneElements.length).toBeGreaterThanOrEqual(1);
  });

  it('scenes returns all IR scenes', () => {
    const dsl = 'scene "A" {\n  node "1"\n}\n\nscene "B" {\n  node "2"\n}';
    const { result } = renderHook(() =>
      useDSLInspectorCallbacks(createProps({ dsl })),
    );

    expect(result.current.scenes).toHaveLength(2);
  });

  it('returns empty data for empty DSL', () => {
    const { result } = renderHook(() =>
      useDSLInspectorCallbacks(createProps({})),
    );

    expect(result.current.scenes).toHaveLength(0);
    expect(result.current.sceneElements).toHaveLength(0);
  });
});
