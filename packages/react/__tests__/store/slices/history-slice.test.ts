import { describe, it, expect } from 'vitest';
import { createEditorStore } from '../../../src/store/create-editor-store.js';

describe('HistorySlice', () => {
  it('defaults to no undo/redo', () => {
    const store = createEditorStore();
    expect(store.getState().canUndo).toBe(false);
    expect(store.getState().canRedo).toBe(false);
  });

  it('setCanUndo updates undo state', () => {
    const store = createEditorStore();
    store.getState().setCanUndo(true);
    expect(store.getState().canUndo).toBe(true);
  });

  it('setCanRedo updates redo state', () => {
    const store = createEditorStore();
    store.getState().setCanRedo(true);
    expect(store.getState().canRedo).toBe(true);
  });

  it('manager bridge: _initManagers populates managers and history onChange updates store', () => {
    const store = createEditorStore();
    store.getState()._initManagers();

    const { _managers } = store.getState();
    expect(_managers.selection).not.toBeNull();
    expect(_managers.history).not.toBeNull();
    expect(_managers.handle).not.toBeNull();
    expect(_managers.snap).not.toBeNull();
  });

  it('manager bridge: selection onChange updates store selectedIds', () => {
    const store = createEditorStore();
    store.getState()._initManagers();

    const selection = store.getState()._managers.selection!;
    selection.select('el-1');
    expect(store.getState().selectedIds).toEqual(['el-1']);

    selection.select('el-2', true);
    expect(store.getState().selectedIds).toEqual(['el-1', 'el-2']);

    selection.clearSelection();
    expect(store.getState().selectedIds).toEqual([]);
  });

  it('manager bridge: _destroyManagers cleans up', () => {
    const store = createEditorStore();
    store.getState()._initManagers();
    store.getState()._destroyManagers();

    const { _managers } = store.getState();
    expect(_managers.selection).toBeNull();
    expect(_managers.history).toBeNull();
  });

  it('_initManagers avoids double initialization', () => {
    const store = createEditorStore();
    store.getState()._initManagers();
    const first = store.getState()._managers.selection;

    store.getState()._initManagers();
    const second = store.getState()._managers.selection;

    expect(first).toBe(second);
  });

  it('_initManagers forwards selection change to external callback', () => {
    const store = createEditorStore();
    const calls: string[][] = [];
    store.getState()._initManagers((ids) => calls.push(ids));

    store.getState()._managers.selection!.select('el-99');
    expect(calls).toEqual([['el-99']]);
  });
});
