/**
 * Public types for the DepixCanvasEditable component.
 */

import type React from 'react';
import type { DepixIR, IRElement, DepixTheme } from '@depix/core';
import type { DepixEngine } from '@depix/engine';
import type { ToolType } from './types.js';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DepixCanvasEditableProps {
  /** The IR document to render and edit (controlled). */
  ir: DepixIR;
  /** Called when the IR changes due to editing operations. */
  onIRChange: (ir: DepixIR) => void;
  /** Called when element selection changes. */
  onSelectionChange?: (selectedIds: string[]) => void;
  /** Currently active tool. Default: 'select'. */
  tool?: ToolType;
  /** When true, disables all editing interactions. */
  readOnly?: boolean;
  /** CSS class name. */
  className?: string;
  /** CSS style. */
  style?: React.CSSProperties;
  /** Initial width in pixels. Default: 800 */
  width?: number;
  /** Initial height in pixels. Default: 450 */
  height?: number;

  // ---- Edit mode props ----
  /** Whether to start in edit mode. Default: false */
  initialEditMode?: boolean;
  /** Position of the edit button in read mode. Default: 'top-right' */
  editButtonPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Callback when edit mode changes. */
  onEditModeChange?: (editing: boolean) => void;
  /** Show debug overlay with element bounding boxes. Default: false */
  debug?: boolean;

  // ---- DSL-first editing props (optional) ----
  /** DSL source text. When provided with onDSLChange, enables DSL-first edit mode. */
  dsl?: string;
  /** Called when DSL text changes via editor actions. */
  onDSLChange?: (dsl: string) => void;
  /** Theme for DSL compilation. */
  dslTheme?: DepixTheme;
}

// ---------------------------------------------------------------------------
// Ref
// ---------------------------------------------------------------------------

export interface DepixCanvasEditableRef {
  /** Undo the last action. */
  undo: () => void;
  /** Redo the last undone action. */
  redo: () => void;
  /** Whether undo is available. */
  canUndo: boolean;
  /** Whether redo is available. */
  canRedo: boolean;
  /** Select all elements in the current scene. */
  selectAll: () => void;
  /** Clear the current selection. */
  clearSelection: () => void;
  /** Delete the currently selected elements. */
  deleteSelected: () => void;
  /** Get the selected IR elements. */
  getSelectedElements: () => IRElement[];
  /** Add an element to the first scene. */
  addElement: (element: IRElement) => void;
  /** Remove an element by ID. */
  removeElement: (id: string) => void;
  /** Get the underlying DepixEngine instance. */
  getEngine: () => DepixEngine | null;
}
