import { describe, it, expect } from 'vitest';
import { createEditorStore } from '../../../src/store/create-editor-store.js';

describe('SelectionSlice', () => {
  it('has correct defaults', () => {
    const store = createEditorStore();
    expect(store.getState().selectedIds).toEqual([]);
    expect(store.getState().hoveredId).toBeNull();
  });

  it('setSelectedIds updates selection', () => {
    const store = createEditorStore();
    store.getState().setSelectedIds(['el-1', 'el-2']);
    expect(store.getState().selectedIds).toEqual(['el-1', 'el-2']);
  });

  it('setSelectedIds replaces previous selection', () => {
    const store = createEditorStore();
    store.getState().setSelectedIds(['el-1']);
    store.getState().setSelectedIds(['el-3']);
    expect(store.getState().selectedIds).toEqual(['el-3']);
  });

  it('setHoveredId updates hover', () => {
    const store = createEditorStore();
    store.getState().setHoveredId('el-5');
    expect(store.getState().hoveredId).toBe('el-5');
  });

  it('setHoveredId clears hover', () => {
    const store = createEditorStore();
    store.getState().setHoveredId('el-5');
    store.getState().setHoveredId(null);
    expect(store.getState().hoveredId).toBeNull();
  });
});
