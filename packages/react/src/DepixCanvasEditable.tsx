/**
 * DepixCanvasEditable
 *
 * An editable canvas component for the Depix editor.
 * Extends the rendering capabilities of DepixCanvas with selection,
 * undo/redo history, handle management, and snap guides.
 *
 * This is a **controlled** component: the parent owns the IR and is
 * notified of changes via `onIRChange`. The component manages internal
 * editing state (selection, history, handles, guides) and exposes an
 * imperative ref API for programmatic control.
 */

import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  useImperativeHandle,
  forwardRef,
  useId,
} from 'react';
import type { DepixIR, IRElement } from '@depix/core';
import { findElement } from '@depix/core';
import { DepixEngine } from '@depix/engine';
import {
  SelectionManager,
  HistoryManager,
  HandleManager,
  SnapGuideManager,
  addElement as irAddElement,
  removeElement as irRemoveElement,
} from '@depix/editor';
import type { ToolType } from './types.js';

// ---------------------------------------------------------------------------
// Types
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
}

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Editable canvas component for the Depix editor.
 */
export const DepixCanvasEditable = forwardRef<
  DepixCanvasEditableRef,
  DepixCanvasEditableProps
>(function DepixCanvasEditable(props, ref) {
  const {
    ir,
    onIRChange,
    onSelectionChange,
    tool = 'select',
    readOnly = false,
    className,
    style,
    width = 800,
    height = 450,
  } = props;

  const generatedId = useId();
  const containerId = `depix-editable-${generatedId.replace(/:/g, '')}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<DepixEngine | null>(null);

  // ---- Editor managers (stable across renders) ---------------------------

  const selectionRef = useRef<SelectionManager | null>(null);
  const historyRef = useRef<HistoryManager | null>(null);
  const handleRef = useRef<HandleManager | null>(null);
  const snapRef = useRef<SnapGuideManager | null>(null);

  // ---- History state for re-render triggers ------------------------------

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // ---- Initialize managers on mount --------------------------------------

  useEffect(() => {
    const selection = new SelectionManager({
      onChange: (state) => {
        onSelectionChange?.(state.selectedIds);
      },
    });

    const history = new HistoryManager();
    history.onChange((state) => {
      setCanUndo(state.canUndo);
      setCanRedo(state.canRedo);
    });

    const handle = new HandleManager();
    const snap = new SnapGuideManager();

    selectionRef.current = selection;
    historyRef.current = history;
    handleRef.current = handle;
    snapRef.current = snap;

    return () => {
      selection.destroy();
      history.destroy();
      handle.destroy();
    };
    // onSelectionChange is intentionally excluded: the selection manager's
    // onChange callback captures it via closure and only fires on state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Engine lifecycle --------------------------------------------------

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.id = containerId;

    const engine = new DepixEngine({
      container: containerId,
      width,
      height,
    });

    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Load IR when it changes -------------------------------------------

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.load(ir);
  }, [ir]);

  // ---- Responsive resize -------------------------------------------------

  useEffect(() => {
    const container = containerRef.current;
    const engine = engineRef.current;
    if (!container || !engine) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          engine.resize(w, h);
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ---- Keyboard shortcuts ------------------------------------------------

  useEffect(() => {
    if (readOnly) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // Undo: Ctrl+Z
      if (isCtrlOrCmd && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        historyRef.current?.undo();
      }

      // Redo: Ctrl+Shift+Z
      if (isCtrlOrCmd && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        historyRef.current?.redo();
      }

      // Redo: Ctrl+Y (alternative)
      if (isCtrlOrCmd && e.key === 'y') {
        e.preventDefault();
        historyRef.current?.redo();
      }

      // Delete: Delete/Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selection = selectionRef.current;
        if (!selection) return;
        const ids = selection.getSelectedIds();
        if (ids.length === 0) return;

        e.preventDefault();
        let currentIR = ir;
        for (const id of ids) {
          currentIR = irRemoveElement(currentIR, id);
        }
        selection.clearSelection();
        onIRChange(currentIR);
      }

      // Select all: Ctrl+A
      if (isCtrlOrCmd && e.key === 'a') {
        e.preventDefault();
        const scene = ir.scenes[0];
        if (!scene) return;
        const allIds = scene.elements.map((el) => el.id);
        selectionRef.current?.selectMultiple(allIds);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readOnly, ir, onIRChange]);

  // ---- Imperative ref API ------------------------------------------------

  const undo = useCallback(() => {
    historyRef.current?.undo();
  }, []);

  const redo = useCallback(() => {
    historyRef.current?.redo();
  }, []);

  const selectAll = useCallback(() => {
    const scene = ir.scenes[0];
    if (!scene) return;
    const allIds = scene.elements.map((el) => el.id);
    selectionRef.current?.selectMultiple(allIds);
  }, [ir]);

  const clearSelection = useCallback(() => {
    selectionRef.current?.clearSelection();
  }, []);

  const deleteSelected = useCallback(() => {
    const selection = selectionRef.current;
    if (!selection) return;
    const ids = selection.getSelectedIds();
    if (ids.length === 0) return;

    let currentIR = ir;
    for (const id of ids) {
      currentIR = irRemoveElement(currentIR, id);
    }
    selection.clearSelection();
    onIRChange(currentIR);
  }, [ir, onIRChange]);

  const getSelectedElements = useCallback((): IRElement[] => {
    const selection = selectionRef.current;
    if (!selection) return [];
    return selection.getSelectedElements(ir);
  }, [ir]);

  const addElementFn = useCallback(
    (element: IRElement) => {
      const scene = ir.scenes[0];
      if (!scene) return;
      const newIR = irAddElement(ir, scene.id, element);
      onIRChange(newIR);
    },
    [ir, onIRChange],
  );

  const removeElementFn = useCallback(
    (id: string) => {
      const newIR = irRemoveElement(ir, id);
      onIRChange(newIR);
    },
    [ir, onIRChange],
  );

  const getEngine = useCallback(() => {
    return engineRef.current;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      undo,
      redo,
      canUndo,
      canRedo,
      selectAll,
      clearSelection,
      deleteSelected,
      getSelectedElements,
      addElement: addElementFn,
      removeElement: removeElementFn,
      getEngine,
    }),
    [
      undo,
      redo,
      canUndo,
      canRedo,
      selectAll,
      clearSelection,
      deleteSelected,
      getSelectedElements,
      addElementFn,
      removeElementFn,
      getEngine,
    ],
  );

  // ---- Render ------------------------------------------------------------

  const containerStyle: React.CSSProperties = {
    width: style?.width ?? width,
    height: style?.height ?? height,
    ...style,
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
      data-tool={tool}
      data-readonly={readOnly || undefined}
    />
  );
});
