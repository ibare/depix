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

export { usePanelPositions } from './hooks/usePanelPositions.js';
export type { PanelPosition, UsePanelPositionsOptions, UsePanelPositionsReturn } from './hooks/usePanelPositions.js';

// UI Components
export { FloatingToolbar } from './components/FloatingToolbar.js';
export type { FloatingToolbarProps } from './components/FloatingToolbar.js';

export { FloatingPropertyPanel } from './components/FloatingPropertyPanel.js';
export type { FloatingPropertyPanelProps } from './components/FloatingPropertyPanel.js';

export { SymbolPicker } from './components/SymbolPicker.js';
export type { SymbolPickerProps } from './components/SymbolPicker.js';

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
