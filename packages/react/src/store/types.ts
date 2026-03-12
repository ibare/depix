/**
 * Store type definitions for the Depix editor.
 *
 * The store holds UI-only state. DSL (controlled prop) and IR (derived)
 * are intentionally excluded — they live outside the store.
 */

import type { SelectionManager, HistoryManager, HandleManager, SnapGuideManager } from '@depix/editor';
import type { ToolType } from '../types.js';

// ---------------------------------------------------------------------------
// Slice interfaces
// ---------------------------------------------------------------------------

export interface UISlice {
  isEditing: boolean;
  isHovered: boolean;
  isFullscreen: boolean;
  activeTool: ToolType;
  inspectorTab: 'layers' | 'canvas' | 'scenes';
  objectPanelOpen: boolean;
  pickerSlot: { name: string; position: { x: number; y: number } } | null;
  pickerExpanded: boolean;
  panelPositions: { toolbar: { top: number; left: number }; panel: { top: number; left: number } } | null;
  editDims: { width: number; height: number } | null;

  setIsEditing: (editing: boolean) => void;
  setIsHovered: (hovered: boolean) => void;
  setIsFullscreen: (fullscreen: boolean) => void;
  setActiveTool: (tool: ToolType) => void;
  setInspectorTab: (tab: 'layers' | 'canvas' | 'scenes') => void;
  setObjectPanelOpen: (open: boolean) => void;
  setPickerSlot: (slot: { name: string; position: { x: number; y: number } } | null) => void;
  setPickerExpanded: (expanded: boolean) => void;
  setPanelPositions: (positions: { toolbar: { top: number; left: number }; panel: { top: number; left: number } } | null) => void;
  setEditDims: (dims: { width: number; height: number } | null) => void;
  enterEditMode: (dims: { width: number; height: number }) => void;
  exitEditMode: () => void;
}

export interface SelectionSlice {
  selectedIds: string[];
  hoveredId: string | null;

  setSelectedIds: (ids: string[]) => void;
  setHoveredId: (id: string | null) => void;
}

export interface SceneSlice {
  activeSceneIndex: number;

  setActiveSceneIndex: (index: number) => void;
}

export interface HistorySlice {
  canUndo: boolean;
  canRedo: boolean;

  setCanUndo: (canUndo: boolean) => void;
  setCanRedo: (canRedo: boolean) => void;
}

export interface ManagerSlice {
  _managers: {
    selection: SelectionManager | null;
    history: HistoryManager | null;
    handle: HandleManager | null;
    snap: SnapGuideManager | null;
  };

  _initManagers: (onSelectionChange?: (ids: string[]) => void) => void;
  _destroyManagers: () => void;
}

// ---------------------------------------------------------------------------
// Combined store
// ---------------------------------------------------------------------------

export type DepixEditorStore =
  & UISlice
  & SelectionSlice
  & SceneSlice
  & HistorySlice
  & ManagerSlice;
