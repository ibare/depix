import type { StateCreator } from 'zustand';
import type { DepixEditorStore, HistorySlice } from '../types.js';

export const createHistorySlice: StateCreator<
  DepixEditorStore,
  [['zustand/devtools', never], ['zustand/immer', never]],
  [],
  HistorySlice
> = (set) => ({
  canUndo: false,
  canRedo: false,

  setCanUndo: (canUndo) => set({ canUndo }),
  setCanRedo: (canRedo) => set({ canRedo }),
});
