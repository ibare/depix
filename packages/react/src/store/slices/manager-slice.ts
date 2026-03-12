import { SelectionManager, HistoryManager, HandleManager, SnapGuideManager } from '@depix/editor';
import type { StateCreator } from 'zustand';
import type { DepixEditorStore, ManagerSlice } from '../types.js';

export const createManagerSlice: StateCreator<
  DepixEditorStore,
  [['zustand/devtools', never], ['zustand/immer', never]],
  [],
  ManagerSlice
> = (set, get) => ({
  _managers: {
    selection: null,
    history: null,
    handle: null,
    snap: null,
  },

  _initManagers: (onSelectionChange) => {
    // Avoid double-init
    const existing = get()._managers;
    if (existing.selection) return;

    const selection = new SelectionManager({
      onChange: (state) => {
        set({ selectedIds: state.selectedIds, hoveredId: state.hoveredId });
        onSelectionChange?.(state.selectedIds);
      },
    });

    const history = new HistoryManager();
    history.onChange((state) => {
      set({ canUndo: state.canUndo, canRedo: state.canRedo });
    });

    const handle = new HandleManager();
    const snap = new SnapGuideManager();

    set({
      _managers: { selection, history, handle, snap },
    });
  },

  _destroyManagers: () => {
    const { selection, history, handle } = get()._managers;
    selection?.destroy();
    history?.destroy();
    handle?.destroy();
    set({
      _managers: { selection: null, history: null, handle: null, snap: null },
    });
  },
});
