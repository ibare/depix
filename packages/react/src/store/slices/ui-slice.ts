import type { StateCreator } from 'zustand';
import type { DepixEditorStore, UISlice } from '../types.js';

export const createUISlice: StateCreator<
  DepixEditorStore,
  [['zustand/devtools', never], ['zustand/immer', never]],
  [],
  UISlice
> = (set) => ({
  isEditing: false,
  isHovered: false,
  isFullscreen: false,
  activeTool: 'select',
  inspectorTab: 'layers',
  objectPanelOpen: false,
  pickerSlot: null,
  panelPositions: null,
  editDims: null,

  setIsEditing: (editing) => set({ isEditing: editing }),
  setIsHovered: (hovered) => set({ isHovered: hovered }),
  setIsFullscreen: (fullscreen) => set({ isFullscreen: fullscreen }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setInspectorTab: (tab) => set({ inspectorTab: tab }),
  setObjectPanelOpen: (open) => set({ objectPanelOpen: open }),
  setPickerSlot: (slot) => set({ pickerSlot: slot }),
  setPanelPositions: (positions) => set({ panelPositions: positions }),
  setEditDims: (dims) => set({ editDims: dims }),

  enterEditMode: (dims) =>
    set({
      isEditing: true,
      activeTool: 'select',
      editDims: dims,
    }),

  exitEditMode: () =>
    set({
      isEditing: false,
      editDims: null,
      panelPositions: null,
      pickerSlot: null,
      objectPanelOpen: false,
      inspectorTab: 'layers',
    }),
});
