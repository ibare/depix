/**
 * Semantic Detach — "Remove Auto Layout" operation.
 *
 * Removes `origin` metadata from containers, converting them from
 * smart semantic layouts to free-form positioning. Children retain
 * their current absolute positions (bounds unchanged).
 *
 * This is equivalent to Figma's "Remove Auto Layout".
 *
 * All functions return NEW DepixIR objects (immutable pattern).
 * No-op cases return the ORIGINAL ir reference for change detection.
 *
 * @module @depix/editor/detach
 */

import type { DepixIR, IRElement } from '@depix/core';
import { findElement, walkElements } from '@depix/core';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Recursively remove `origin` from an element and all its nested
 * container children.
 */
function removeOriginRecursive(element: IRElement): void {
  if ('origin' in element) {
    delete element.origin;
  }
  if (element.type === 'container') {
    for (const child of element.children) {
      removeOriginRecursive(child);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detach a container from its semantic layout.
 *
 * Removes the `origin` property from the target container and all
 * nested containers within it. After detaching:
 * - All children retain their current absolute positions (bounds unchanged)
 * - No automatic re-layout will be triggered on subsequent edits
 * - The container becomes a plain grouping container
 *
 * This is equivalent to Figma's "Remove Auto Layout".
 *
 * @param ir - The current IR document
 * @param containerId - The ID of the container to detach
 * @returns A new IR with the container detached, or the same IR if
 *          the container was not found or had no origin.
 */
export function detachFromLayout(ir: DepixIR, containerId: string): DepixIR {
  // Find the element in the original IR to check preconditions
  const element = findElement(ir, containerId);

  // No-op: element not found
  if (!element) {
    return ir;
  }

  // No-op: not a container
  if (element.type !== 'container') {
    return ir;
  }

  // No-op: container has no origin (already detached or plain container)
  if (!element.origin) {
    return ir;
  }

  // Clone the IR and find the container in the clone
  const clone = structuredClone(ir);
  const clonedElement = findElement(clone, containerId)!;

  // Remove origin from the container and all nested containers
  removeOriginRecursive(clonedElement);

  return clone;
}

/**
 * Detach ALL semantic containers in the entire IR document.
 * Useful for "flatten" or "export as static" operations.
 *
 * @param ir - The current IR document
 * @returns A new IR with all origins removed
 */
export function detachAll(ir: DepixIR): DepixIR {
  const clone = structuredClone(ir);

  for (const scene of clone.scenes) {
    walkElements(scene, (element) => {
      if ('origin' in element) {
        delete element.origin;
      }
    });
  }

  return clone;
}
