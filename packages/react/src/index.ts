// @depix/react — React components, hooks, and integrations for Depix

// Canvas components
export { DepixCanvas } from './DepixCanvas.js';
export type { DepixCanvasProps, DepixCanvasRef } from './DepixCanvas.js';

export { DepixCanvasEditable } from './DepixCanvasEditable.js';
export type { DepixCanvasEditableProps, DepixCanvasEditableRef } from './DepixCanvasEditable.js';

// Types
export type { ToolType } from './types.js';

// Context
export { DepixProvider, useDepixContext } from './context/DepixContext.js';
export type { DepixContextValue, DepixProviderProps } from './context/DepixContext.js';

// Hooks
export { useDepixCanvas } from './hooks/useDepixCanvas.js';
export type { UseDepixCanvasOptions, UseDepixCanvasReturn } from './hooks/useDepixCanvas.js';

export { useDraggable } from './hooks/useDraggable.js';
export type { UseDraggableOptions, DragHandleProps, UseDraggableReturn } from './hooks/useDraggable.js';

export { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
export type { UseKeyboardShortcutsOptions } from './hooks/useKeyboardShortcuts.js';

export { useObjectCreation } from './hooks/useObjectCreation.js';
export type { UseObjectCreationOptions, CreationHandlers, UseObjectCreationReturn } from './hooks/useObjectCreation.js';

// UI Components
export { SymbolPicker } from './components/SymbolPicker.js';
export type { SymbolPickerProps } from './components/SymbolPicker.js';

// Property Panel Tabs
export { ObjectTab } from './components/property-panel-tabs/ObjectTab.js';
export type { ObjectTabProps } from './components/property-panel-tabs/ObjectTab.js';

export { LayersTab } from './components/property-panel-tabs/LayersTab.js';
export type { LayersTabProps } from './components/property-panel-tabs/LayersTab.js';

export { CanvasTab } from './components/property-panel-tabs/CanvasTab.js';
export type { CanvasTabProps } from './components/property-panel-tabs/CanvasTab.js';

export { SceneTab } from './components/property-panel-tabs/SceneTab.js';
export type { SceneTabProps } from './components/property-panel-tabs/SceneTab.js';

// Tool Icons
export {
  SelectIcon,
  RectIcon,
  CircleIcon,
  TextIcon,
  LineIcon,
  ConnectorIcon,
  ImageIcon,
  UndoIcon,
  RedoIcon,
  DeleteIcon,
  TOOL_ICON_MAP,
} from './icons/ToolIcons.js';

// Property Controls
export {
  ColorInput,
  NumberInput,
  SliderInput,
  SelectInput,
  TextInput,
} from './components/property-controls/index.js';
export type {
  ColorInputProps,
  NumberInputProps,
  SliderInputProps,
  SelectInputProps,
  SelectOption,
  TextInputProps,
} from './components/property-controls/index.js';

// TipTap integration
export {
  serializeDepixBlock,
  parseDepixBlock,
  hasDepixBlocks,
  parseAllDepixBlocks,
} from './tiptap/index.js';
export type { DepixBlockAttrs, DepixBlockConfig } from './tiptap/index.js';

// DSL Editor
export { DepixDSLEditor } from './DepixDSLEditor.js';
export type { DepixDSLEditorProps } from './DepixDSLEditor.js';

// DSL Editor Hooks
export { useDSLSync } from './hooks/useDSLSync.js';
export type { UseDSLSyncOptions, UseDSLSyncReturn, SceneInfo, SlotInfo } from './hooks/useDSLSync.js';

export { useOverrideDrag } from './hooks/useOverrideDrag.js';
export type { UseOverrideDragOptions, UseOverrideDragReturn } from './hooks/useOverrideDrag.js';

// DSL Editor Components
export { SceneStrip } from './components/editor/SceneStrip.js';
export type { SceneStripProps, SceneStripScene } from './components/editor/SceneStrip.js';

export { LayoutPicker } from './components/editor/LayoutPicker.js';
export type { LayoutPickerProps } from './components/editor/LayoutPicker.js';

export { SlotOverlay } from './components/editor/SlotOverlay.js';
export type { SlotOverlayProps, CoordinateTransform } from './components/editor/SlotOverlay.js';

export { ContentTypePicker } from './components/editor/ContentTypePicker.js';
export type { ContentTypePickerProps } from './components/editor/ContentTypePicker.js';

export { ContextAwarePicker } from './components/editor/ContextAwarePicker.js';
export type { ContextAwarePickerProps } from './components/editor/ContextAwarePicker.js';

export { ContextBar } from './components/editor/ContextBar.js';
export type { ContextBarProps } from './components/editor/ContextBar.js';

export { EditorPropertyPanel } from './components/editor/EditorPropertyPanel.js';
export type { EditorPropertyPanelProps } from './components/editor/EditorPropertyPanel.js';

export { InspectorPanel } from './components/editor/InspectorPanel.js';
export type { InspectorPanelProps } from './components/editor/InspectorPanel.js';

export { EDITOR_COLORS } from './components/editor/editor-colors.js';

// Store
export {
  createEditorStore,
  EditorStoreProvider,
  useEditorStore,
  useEditorStoreApi,
  useSelectedElements,
  useSceneElements,
  useIsEditActive,
} from './store/index.js';
export type {
  DepixEditorStore,
  UISlice,
  SelectionSlice,
  SceneSlice,
  HistorySlice,
} from './store/index.js';
