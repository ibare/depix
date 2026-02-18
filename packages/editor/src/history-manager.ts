/**
 * Type-agnostic Undo/Redo system for the @depix/editor.
 *
 * Manages an undo/redo stack of {@link HistoryAction} objects with support for
 * action merging (e.g. rapid property changes), configurable stack limits, and
 * change-notification listeners.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A reversible action that can be pushed onto the history stack. */
export interface HistoryAction {
  /** Human-readable label (e.g. "Move element", "Change color"). */
  label: string;
  /** Execute (or re-execute) the action. */
  execute: () => void;
  /** Reverse the action. */
  undo: () => void;
  /** Optional key for merge grouping — actions with the same mergeKey within mergeTimeout are combined. */
  mergeKey?: string;
}

/** Snapshot of the current history state, suitable for driving UI. */
export interface HistoryState {
  undoCount: number;
  redoCount: number;
  canUndo: boolean;
  canRedo: boolean;
}

/** Callback invoked whenever the history state changes. */
export type HistoryChangeHandler = (state: HistoryState) => void;

/** Configuration options for {@link HistoryManager}. */
export interface HistoryManagerOptions {
  /** Maximum number of actions in the undo stack. Default: 100 */
  maxHistory?: number;
  /** Time window in ms for action merging. Default: 300 */
  mergeTimeout?: number;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface InternalEntry {
  action: HistoryAction;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// HistoryManager
// ---------------------------------------------------------------------------

export class HistoryManager {
  private readonly maxHistory: number;
  private readonly mergeTimeout: number;

  private undoStack: InternalEntry[] = [];
  private redoStack: InternalEntry[] = [];
  private listeners = new Set<HistoryChangeHandler>();

  constructor(options?: HistoryManagerOptions) {
    this.maxHistory = options?.maxHistory ?? 100;
    this.mergeTimeout = options?.mergeTimeout ?? 300;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Push an action onto the undo stack and execute it immediately.
   *
   * If the action has a `mergeKey` matching the last action's mergeKey AND the
   * time elapsed is within `mergeTimeout`, the two actions are merged: the new
   * action's `execute` replaces the previous one while the original `undo` is
   * preserved.
   *
   * Pushing always clears the redo stack.
   */
  push(action: HistoryAction): void {
    const now = Date.now();

    // Attempt merge with the top of the undo stack.
    if (
      action.mergeKey !== undefined &&
      this.undoStack.length > 0
    ) {
      const top = this.undoStack[this.undoStack.length - 1];
      if (
        top.action.mergeKey === action.mergeKey &&
        now - top.timestamp <= this.mergeTimeout
      ) {
        // Merge: keep original undo, replace execute, update timestamp.
        top.action = {
          label: action.label,
          execute: action.execute,
          undo: top.action.undo,
          mergeKey: action.mergeKey,
        };
        top.timestamp = now;

        // Execute the new action's execute.
        action.execute();

        // Clear redo stack.
        this.redoStack = [];

        this.notify();
        return;
      }
    }

    // Normal push.
    action.execute();

    this.undoStack.push({ action, timestamp: now });

    // Enforce maxHistory.
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.splice(0, this.undoStack.length - this.maxHistory);
    }

    // Clear redo stack.
    this.redoStack = [];

    this.notify();
  }

  /** Undo the last action. Returns `true` if an action was undone. */
  undo(): boolean {
    const entry = this.undoStack.pop();
    if (!entry) return false;

    entry.action.undo();
    this.redoStack.push(entry);

    this.notify();
    return true;
  }

  /** Redo the last undone action. Returns `true` if an action was redone. */
  redo(): boolean {
    const entry = this.redoStack.pop();
    if (!entry) return false;

    entry.action.execute();
    this.undoStack.push(entry);

    this.notify();
    return true;
  }

  /** Whether there are actions to undo. */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /** Whether there are actions to redo. */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Get current state snapshot. */
  getState(): HistoryState {
    return {
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
    };
  }

  /** Clear all undo and redo history. */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  /**
   * Register a change listener. Returns an unsubscribe function.
   *
   * The handler is called whenever the history state changes (push, undo,
   * redo, clear).
   */
  onChange(handler: HistoryChangeHandler): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  /** Clean up: clear all stacks and listeners. */
  destroy(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.listeners.clear();
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private notify(): void {
    const state = this.getState();
    for (const handler of this.listeners) {
      handler(state);
    }
  }
}

// ---------------------------------------------------------------------------
// Helper factory functions
// ---------------------------------------------------------------------------

/**
 * Create a {@link HistoryAction} that changes a property on an object.
 *
 * Captures the current (old) value automatically before the change.
 */
export function createPropertyAction<T extends Record<string, unknown>>(
  target: T,
  key: keyof T,
  newValue: T[keyof T],
  label?: string,
): HistoryAction {
  const oldValue = target[key];
  return {
    label: label ?? `Change ${String(key)}`,
    execute: () => {
      target[key] = newValue;
    },
    undo: () => {
      target[key] = oldValue;
    },
  };
}

/**
 * Create a {@link HistoryAction} that adds an item to an array.
 *
 * If `index` is omitted the item is appended at the end.
 */
export function createAddAction<T>(
  array: T[],
  item: T,
  index?: number,
  label?: string,
): HistoryAction {
  const insertAt = index ?? array.length;
  return {
    label: label ?? 'Add item',
    execute: () => {
      array.splice(insertAt, 0, item);
    },
    undo: () => {
      const idx = array.indexOf(item);
      if (idx !== -1) {
        array.splice(idx, 1);
      }
    },
  };
}

/**
 * Create a {@link HistoryAction} that removes an item from an array.
 *
 * Captures the removed item so it can be restored on undo.
 */
export function createDeleteAction<T>(
  array: T[],
  index: number,
  label?: string,
): HistoryAction {
  const item = array[index];
  return {
    label: label ?? 'Delete item',
    execute: () => {
      array.splice(index, 1);
    },
    undo: () => {
      array.splice(index, 0, item);
    },
  };
}
