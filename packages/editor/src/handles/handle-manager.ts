/**
 * HandleManager -- manages handle state for the current selection.
 *
 * Provides handle definitions based on the selected IR elements.
 * For single selection, the definition matches the element type.
 * For multi-selection, a merged definition is used (bounding-box,
 * no rotation, all anchors).
 *
 * This class has no rendering dependencies -- it produces handle
 * definitions that the React integration layer uses to configure
 * Konva.Transformer.
 *
 * @module @depix/editor/handles/handle-manager
 */

import type { IRElement } from '@depix/core';
import type { HandleDefinition, HandleType } from './types.js';
import { ALL_ANCHORS } from './types.js';
import { getHandleDefinition } from './handle-strategies.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for constructing a HandleManager.
 */
export interface HandleManagerOptions {
  /** Callback when handle definition changes (e.g. for updating a Konva.Transformer). */
  onHandleChange?: (definition: HandleDefinition | null) => void;
}

// ---------------------------------------------------------------------------
// Multi-selection merged definition
// ---------------------------------------------------------------------------

/**
 * The merged handle definition used for multi-element selections.
 *
 * Multi-select always uses a bounding-box around all elements,
 * disables rotation, and enables all anchors.
 */
function createMultiSelectionDefinition(): HandleDefinition {
  return {
    handleType: 'bounding-box',
    keepRatio: false,
    rotateEnabled: false,
    enabledAnchors: [...ALL_ANCHORS],
  };
}

// ---------------------------------------------------------------------------
// HandleManager
// ---------------------------------------------------------------------------

/**
 * Manages handle definitions for the current element selection.
 *
 * Usage:
 * 1. Call `updateForElements(elements)` when the selection changes.
 * 2. Read `getDefinition()` to configure the transformer.
 * 3. Subscribe to changes via `onHandleChange(handler)`.
 * 4. Call `hideHandles()` during mode changes or drag operations.
 * 5. Call `destroy()` on teardown.
 */
export class HandleManager {
  private currentElements: IRElement[];
  private currentDefinition: HandleDefinition | null;
  private handleChangeHandlers: Set<(definition: HandleDefinition | null) => void>;

  constructor(options?: HandleManagerOptions) {
    this.currentElements = [];
    this.currentDefinition = null;
    this.handleChangeHandlers = new Set();

    if (options?.onHandleChange) {
      this.handleChangeHandlers.add(options.onHandleChange);
    }
  }

  // -----------------------------------------------------------------------
  // Core API
  // -----------------------------------------------------------------------

  /**
   * Update handles for the given selected elements.
   *
   * Determines the appropriate handle definition:
   * - Empty array: clears all handles.
   * - Single element: uses the element's type-specific definition.
   * - Multiple elements: uses the merged multi-selection definition.
   *
   * @param elements - The currently selected IR elements.
   */
  updateForElements(elements: IRElement[]): void {
    this.currentElements = [...elements];

    if (elements.length === 0) {
      this.currentDefinition = null;
    } else if (elements.length === 1) {
      this.currentDefinition = getHandleDefinition(elements[0]);
    } else {
      this.currentDefinition = createMultiSelectionDefinition();
    }

    this.notify();
  }

  /**
   * Get the current active handle type.
   *
   * @returns The handle type of the current definition, or `'none'` if
   *          nothing is selected or handles are hidden.
   */
  getActiveHandleType(): HandleType {
    return this.currentDefinition?.handleType ?? 'none';
  }

  /**
   * Get the current handle definition.
   *
   * @returns The active handle definition, or `null` if nothing is
   *          selected or handles are hidden.
   */
  getDefinition(): HandleDefinition | null {
    return this.currentDefinition;
  }

  /**
   * Get the elements currently managed.
   *
   * @returns A copy of the current element array.
   */
  getElements(): IRElement[] {
    return [...this.currentElements];
  }

  /**
   * Hide all handles (e.g. during a mode change or drag operation).
   *
   * Clears the current definition and elements, then notifies listeners.
   */
  hideHandles(): void {
    this.currentElements = [];
    this.currentDefinition = null;
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Events
  // -----------------------------------------------------------------------

  /**
   * Register a handle change listener.
   *
   * @param handler - Callback invoked with the new definition (or null).
   * @returns An unsubscribe function.
   */
  onHandleChange(handler: (definition: HandleDefinition | null) => void): () => void {
    this.handleChangeHandlers.add(handler);
    return () => {
      this.handleChangeHandlers.delete(handler);
    };
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Destroy the manager and clean up all listeners and state.
   */
  destroy(): void {
    this.currentElements = [];
    this.currentDefinition = null;
    this.handleChangeHandlers.clear();
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  /**
   * Notify all handle change handlers with the current definition.
   */
  private notify(): void {
    const definition = this.currentDefinition;
    for (const handler of this.handleChangeHandlers) {
      handler(definition);
    }
  }
}
