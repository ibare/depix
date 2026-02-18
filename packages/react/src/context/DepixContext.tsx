/**
 * DepixContext
 *
 * Provides editing state to descendant components (e.g. FloatingToolbar,
 * PropertyPanel). Consumers access the context via the `useDepixContext` hook.
 *
 * @module @depix/react/context
 */

import React, { createContext, useContext, useMemo } from 'react';
import type { DepixIR } from '@depix/core';
import type { ToolType } from '../types.js';

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

/**
 * The shape of the Depix editing context.
 *
 * Provides the current IR, selection state, tool state, and history controls
 * to any descendant component that needs to reflect or drive editor state.
 */
export interface DepixContextValue {
  /** The current IR document. */
  ir: DepixIR;
  /** IDs of currently selected elements. */
  selectedIds: string[];
  /** The currently active tool. */
  tool: ToolType;
  /** Switch the active tool. */
  setTool: (tool: ToolType) => void;
  /** Undo the last action. */
  undo: () => void;
  /** Redo the last undone action. */
  redo: () => void;
  /** Whether undo is available. */
  canUndo: boolean;
  /** Whether redo is available. */
  canRedo: boolean;
  /** Replace the IR document (for external mutations). */
  updateIR: (ir: DepixIR) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const DepixContext = createContext<DepixContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface DepixProviderProps {
  /** The context value to provide. */
  value: DepixContextValue;
  /** Child components. */
  children: React.ReactNode;
}

/**
 * Provides the Depix editing context to descendant components.
 *
 * Wrap your editor UI tree with this provider and pass the context value
 * obtained from the DepixCanvasEditable or assembled manually.
 */
export function DepixProvider({ value, children }: DepixProviderProps): React.JSX.Element {
  // Memoize the value to prevent unnecessary re-renders when the
  // parent re-renders but the context value has not changed.
  const memoized = useMemo(() => value, [
    value.ir,
    value.selectedIds,
    value.tool,
    value.setTool,
    value.undo,
    value.redo,
    value.canUndo,
    value.canRedo,
    value.updateIR,
  ]);

  return (
    <DepixContext.Provider value={memoized}>
      {children}
    </DepixContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access the Depix editing context.
 *
 * Must be used within a `<DepixProvider>`. Throws if the context is missing.
 */
export function useDepixContext(): DepixContextValue {
  const ctx = useContext(DepixContext);
  if (!ctx) {
    throw new Error(
      'useDepixContext must be used within a <DepixProvider>. ' +
      'Wrap your component tree with <DepixProvider value={...}>.',
    );
  }
  return ctx;
}
