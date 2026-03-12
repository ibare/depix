import { describe, it, expect } from 'vitest';
import { createEditorStore } from '../../src/store/create-editor-store.js';

describe('createEditorStore', () => {
  it('creates a store with all slices', () => {
    const store = createEditorStore();
    const state = store.getState();

    // UI slice
    expect(state.isEditing).toBe(false);
    expect(state.activeTool).toBe('select');
    expect(state.inspectorTab).toBe('layers');

    // Selection slice
    expect(state.selectedIds).toEqual([]);
    expect(state.hoveredId).toBeNull();

    // Scene slice
    expect(state.activeSceneIndex).toBe(0);

    // History slice
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);

    // Manager slice
    expect(state._managers.selection).toBeNull();
    expect(state._managers.history).toBeNull();
  });

  it('creates independent store instances', () => {
    const store1 = createEditorStore();
    const store2 = createEditorStore();

    store1.getState().setActiveTool('rect');

    expect(store1.getState().activeTool).toBe('rect');
    expect(store2.getState().activeTool).toBe('select');
  });

  it('supports immer-style mutations', () => {
    const store = createEditorStore();
    const before = store.getState();

    store.getState().setIsEditing(true);

    const after = store.getState();
    expect(after.isEditing).toBe(true);
    expect(before.isEditing).toBe(false);
  });
});
