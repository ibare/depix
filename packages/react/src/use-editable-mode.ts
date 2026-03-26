/**
 * useEditableMode
 *
 * Manages DSL editing state, edit-mode enter/confirm/cancel lifecycle,
 * and derives the IR to render during editing.
 */

import { useRef, useCallback, useState, useMemo } from 'react';
import type { DepixIR } from '@depix/core';
import { compile } from '@depix/core';
import type { DepixTheme } from '@depix/core';
import type { EditorStore } from './store/index.js';
import type { SelectionManager } from '@depix/editor';
import { computeEditDims } from './editable-styles.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseEditableModeOptions {
  /** Parent IR (controlled prop). */
  ir: DepixIR;
  /** Parent IR change callback. */
  onIRChange: (ir: DepixIR) => void;
  /** Whether DSL mode is active. */
  isDSLMode: boolean;
  /** Current DSL text (from parent). */
  dsl: string | undefined;
  /** Parent DSL change callback. */
  onDSLChange: ((dsl: string) => void) | undefined;
  /** Theme for DSL compilation. */
  dslTheme: DepixTheme | undefined;
  /** Whether the component is currently in edit mode (from store). */
  isEditing: boolean;
  /** Callback when edit mode changes. */
  onEditModeChange: ((editing: boolean) => void) | undefined;
  /** Zustand store API. */
  storeApi: EditorStore;
  /** Selection manager ref. */
  selectionRef: React.MutableRefObject<SelectionManager | null>;
}

export interface UseEditableModeReturn {
  /** The IR to render (editingIR during DSL editing, otherwise parent IR). */
  renderIR: DepixIR;
  /** Internal DSL text being edited (null when not editing). */
  editingDsl: string | null;
  /** Setter for internal DSL text. */
  setEditingDsl: (dsl: string | null) => void;
  /** Compiled IR from editingDsl (null when not editing or compile fails). */
  editingIR: DepixIR | null;
  /** Enter edit mode (takes snapshot, opens overlay). */
  enterEditMode: () => void;
  /** Confirm edits and exit edit mode. */
  handleConfirm: () => void;
  /** Cancel edits and exit edit mode (restores snapshot). */
  handleCancel: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEditableMode({
  ir,
  onIRChange,
  isDSLMode,
  dsl,
  onDSLChange,
  dslTheme,
  isEditing,
  onEditModeChange,
  storeApi,
  selectionRef,
}: UseEditableModeOptions): UseEditableModeReturn {
  const snapshotRef = useRef<DepixIR | null>(null);

  // ---- Internal DSL editing state ----------------------------------------

  const [editingDsl, setEditingDsl] = useState<string | null>(null);

  /** Compile editingDsl to IR for canvas rendering during editing. */
  const editingIR = useMemo(() => {
    if (editingDsl === null) return null;
    try {
      const result = compile(editingDsl, { theme: dslTheme });
      return result.ir;
    } catch (e) {
      console.error('[depix] editingIR compile failed', e);
      return null;
    }
  }, [editingDsl, dslTheme]);

  /** IR to render: internal editingIR during DSL editing, otherwise parent's ir. */
  const renderIR = (isEditing && isDSLMode && editingIR) ? editingIR : ir;

  // ---- Edit mode lifecycle -----------------------------------------------

  const enterEditMode = useCallback(() => {
    snapshotRef.current = structuredClone(ir);
    if (isDSLMode) {
      setEditingDsl(dsl!);
    }
    const ar = ir.meta.aspectRatio ?? { width: 16, height: 9 };
    storeApi.getState().enterEditMode(computeEditDims(ar));
    onEditModeChange?.(true);
  }, [ir, onEditModeChange, isDSLMode, dsl, storeApi]);

  const handleConfirm = useCallback(() => {
    if (isDSLMode && editingDsl !== null) {
      onDSLChange!(editingDsl);
      if (editingIR) onIRChange(editingIR);
    }
    snapshotRef.current = null;
    setEditingDsl(null);
    storeApi.getState().exitEditMode();
    selectionRef.current?.clearSelection();
    onEditModeChange?.(false);
  }, [onEditModeChange, isDSLMode, editingDsl, editingIR, onDSLChange, onIRChange, storeApi, selectionRef]);

  const handleCancel = useCallback(() => {
    if (!isDSLMode && snapshotRef.current) {
      onIRChange(snapshotRef.current);
    }
    snapshotRef.current = null;
    setEditingDsl(null);
    storeApi.getState().exitEditMode();
    selectionRef.current?.clearSelection();
    onEditModeChange?.(false);
  }, [onIRChange, onEditModeChange, isDSLMode, storeApi, selectionRef]);

  return {
    renderIR,
    editingDsl,
    setEditingDsl,
    editingIR,
    enterEditMode,
    handleConfirm,
    handleCancel,
  };
}
