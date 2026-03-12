import type { StateCreator } from 'zustand';
import type { DepixEditorStore, SelectionSlice } from '../types.js';

export const createSelectionSlice: StateCreator<
  DepixEditorStore,
  [['zustand/devtools', never], ['zustand/immer', never]],
  [],
  SelectionSlice
> = (set) => ({
  selectedIds: [],
  hoveredId: null,

  setSelectedIds: (ids) => set({ selectedIds: ids }),
  setHoveredId: (id) => set({ hoveredId: id }),
});
