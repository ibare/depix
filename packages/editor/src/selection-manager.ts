/**
 * SelectionManager — IR element ID-based selection state manager.
 *
 * Pure state management with no rendering dependencies.
 * Manages element selection, hover state, and emits events for
 * drag/transform operations to be consumed by the engine/UI layer.
 *
 * @module @depix/editor/selection-manager
 */

import type { DepixIR, IRElement } from '@depix/core';
import { findElement } from '@depix/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Immutable snapshot of the current selection state.
 */
export interface SelectionState {
  /** Currently selected element IDs (insertion order preserved). */
  selectedIds: string[];
  /** Currently hovered element ID, if any. */
  hoveredId: string | null;
}

/**
 * Callback invoked when the selection or hover state changes.
 */
export type SelectionChangeHandler = (state: SelectionState) => void;

/**
 * Callback invoked when an element drag operation ends.
 */
export type DragEndHandler = (
  elementId: string,
  dx: number,
  dy: number,
) => void;

/**
 * Callback invoked when an element transform operation ends.
 */
export type TransformEndHandler = (
  elementId: string,
  newBounds: { x: number; y: number; w: number; h: number },
) => void;

/**
 * Options for constructing a SelectionManager.
 */
export interface SelectionManagerOptions {
  /** Called when selection or hover state changes. */
  onChange?: SelectionChangeHandler;
}

// ---------------------------------------------------------------------------
// SelectionManager
// ---------------------------------------------------------------------------

/**
 * Manages element selection and hover state for the editor.
 *
 * - Selection is tracked as an ordered set of element IDs.
 * - Hover state tracks a single element ID.
 * - Change handlers are notified on any state mutation.
 * - Drag/transform end events are emitted by the UI layer and forwarded
 *   to registered handlers.
 *
 * This class has **no** rendering dependencies and is designed to be
 * easily testable in a pure Node.js environment.
 */
export class SelectionManager {
  private selectedIds: Set<string>;
  private hoveredId: string | null;
  private changeHandlers: Set<SelectionChangeHandler>;
  private dragEndHandlers: Set<DragEndHandler>;
  private transformEndHandlers: Set<TransformEndHandler>;

  constructor(options?: SelectionManagerOptions) {
    this.selectedIds = new Set();
    this.hoveredId = null;
    this.changeHandlers = new Set();
    this.dragEndHandlers = new Set();
    this.transformEndHandlers = new Set();

    if (options?.onChange) {
      this.changeHandlers.add(options.onChange);
    }
  }

  // -----------------------------------------------------------------------
  // Selection
  // -----------------------------------------------------------------------

  /**
   * Select a single element.
   *
   * @param elementId - The ID of the element to select.
   * @param append    - If `true`, add to the current selection; otherwise
   *                    replace the entire selection with this single element.
   */
  select(elementId: string, append = false): void {
    if (!append) {
      this.selectedIds.clear();
    }
    this.selectedIds.add(elementId);
    this.notify();
  }

  /**
   * Select multiple elements, replacing the current selection.
   *
   * @param elementIds - The IDs of the elements to select.
   */
  selectMultiple(elementIds: string[]): void {
    this.selectedIds.clear();
    for (const id of elementIds) {
      this.selectedIds.add(id);
    }
    this.notify();
  }

  /**
   * Remove an element from the selection.
   *
   * No-op if the element is not currently selected.
   *
   * @param elementId - The ID of the element to deselect.
   */
  deselect(elementId: string): void {
    if (this.selectedIds.delete(elementId)) {
      this.notify();
    }
  }

  /**
   * Clear all selections.
   *
   * Only fires a change event if the selection was non-empty.
   */
  clearSelection(): void {
    if (this.selectedIds.size === 0) return;
    this.selectedIds.clear();
    this.notify();
  }

  /**
   * Toggle selection of an element.
   *
   * If the element is selected it will be deselected; otherwise it will
   * be added (appended) to the current selection. Useful for Ctrl+click.
   *
   * @param elementId - The ID of the element to toggle.
   */
  toggleSelection(elementId: string): void {
    if (this.selectedIds.has(elementId)) {
      this.selectedIds.delete(elementId);
    } else {
      this.selectedIds.add(elementId);
    }
    this.notify();
  }

  /**
   * Check whether an element is currently selected.
   *
   * @param elementId - The ID of the element to check.
   * @returns `true` if the element is in the selection set.
   */
  isSelected(elementId: string): boolean {
    return this.selectedIds.has(elementId);
  }

  /**
   * Get the list of selected element IDs in insertion order.
   *
   * @returns A new array of selected IDs.
   */
  getSelectedIds(): string[] {
    return [...this.selectedIds];
  }

  /**
   * Get the number of currently selected elements.
   */
  getSelectionCount(): number {
    return this.selectedIds.size;
  }

  // -----------------------------------------------------------------------
  // Hover
  // -----------------------------------------------------------------------

  /**
   * Set the hovered element.
   *
   * Pass `null` to clear the hover state. Only fires a change event if
   * the value actually changed.
   *
   * @param elementId - The ID of the hovered element, or `null`.
   */
  setHovered(elementId: string | null): void {
    if (this.hoveredId === elementId) return;
    this.hoveredId = elementId;
    this.notify();
  }

  /**
   * Get the currently hovered element ID.
   *
   * @returns The hovered element ID, or `null` if nothing is hovered.
   */
  getHoveredId(): string | null {
    return this.hoveredId;
  }

  // -----------------------------------------------------------------------
  // Element lookup helpers
  // -----------------------------------------------------------------------

  /**
   * Resolve the current selection to actual IR elements.
   *
   * Elements that cannot be found in the IR (e.g. deleted) are silently
   * filtered out.
   *
   * @param ir - The DepixIR document to search.
   * @returns An array of resolved IR elements.
   */
  getSelectedElements(ir: DepixIR): IRElement[] {
    const elements: IRElement[] = [];
    for (const id of this.selectedIds) {
      const element = findElement(ir, id);
      if (element) {
        elements.push(element);
      }
    }
    return elements;
  }

  /**
   * Get the primary (first) selected element ID.
   *
   * @returns The first selected ID, or `null` if nothing is selected.
   */
  getPrimarySelection(): string | null {
    const first = this.selectedIds.values().next();
    return first.done ? null : first.value;
  }

  // -----------------------------------------------------------------------
  // Events
  // -----------------------------------------------------------------------

  /**
   * Register a selection/hover change listener.
   *
   * @param handler - Callback invoked with the new state on each change.
   * @returns An unsubscribe function.
   */
  onChange(handler: SelectionChangeHandler): () => void {
    this.changeHandlers.add(handler);
    return () => {
      this.changeHandlers.delete(handler);
    };
  }

  /**
   * Register a drag end listener.
   *
   * @param handler - Callback invoked when a drag operation ends.
   * @returns An unsubscribe function.
   */
  onDragEnd(handler: DragEndHandler): () => void {
    this.dragEndHandlers.add(handler);
    return () => {
      this.dragEndHandlers.delete(handler);
    };
  }

  /**
   * Register a transform end listener.
   *
   * @param handler - Callback invoked when a transform operation ends.
   * @returns An unsubscribe function.
   */
  onTransformEnd(handler: TransformEndHandler): () => void {
    this.transformEndHandlers.add(handler);
    return () => {
      this.transformEndHandlers.delete(handler);
    };
  }

  /**
   * Emit a drag end event.
   *
   * Called by the engine/UI layer when an element drag operation completes.
   *
   * @param elementId - The ID of the dragged element.
   * @param dx        - Horizontal displacement.
   * @param dy        - Vertical displacement.
   */
  emitDragEnd(elementId: string, dx: number, dy: number): void {
    for (const handler of this.dragEndHandlers) {
      handler(elementId, dx, dy);
    }
  }

  /**
   * Emit a transform end event.
   *
   * Called by the engine/UI layer when an element transform operation
   * completes (e.g. resize via handles).
   *
   * @param elementId - The ID of the transformed element.
   * @param newBounds - The new bounding box after the transform.
   */
  emitTransformEnd(
    elementId: string,
    newBounds: { x: number; y: number; w: number; h: number },
  ): void {
    for (const handler of this.transformEndHandlers) {
      handler(elementId, newBounds);
    }
  }

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  /**
   * Get a snapshot of the full selection state.
   *
   * @returns An immutable-style state object.
   */
  getState(): SelectionState {
    return {
      selectedIds: [...this.selectedIds],
      hoveredId: this.hoveredId,
    };
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Destroy the manager and clean up all listeners and state.
   */
  destroy(): void {
    this.selectedIds.clear();
    this.hoveredId = null;
    this.changeHandlers.clear();
    this.dragEndHandlers.clear();
    this.transformEndHandlers.clear();
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  /**
   * Notify all change handlers with the current state.
   */
  private notify(): void {
    const state = this.getState();
    for (const handler of this.changeHandlers) {
      handler(state);
    }
  }
}
