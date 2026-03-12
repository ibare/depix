import type { StateCreator } from 'zustand';
import type { DepixEditorStore, SceneSlice } from '../types.js';

export const createSceneSlice: StateCreator<
  DepixEditorStore,
  [['zustand/devtools', never], ['zustand/immer', never]],
  [],
  SceneSlice
> = (set) => ({
  activeSceneIndex: 0,

  setActiveSceneIndex: (index) => set({ activeSceneIndex: index }),
});
