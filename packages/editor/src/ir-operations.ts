/**
 * Pure functions that manipulate DepixIR objects.
 *
 * These are the primitive editing operations used by the editor.
 * ALL functions return NEW DepixIR objects (immutable pattern).
 *
 * @module @depix/editor/ir-operations
 */

import type {
  DepixIR,
  IRScene,
  IRElement,
  IRStyle,
  IRBounds,
  IRContainer,
  IREdge,
  IRText,
  IRShape,
} from '@depix/core';
import {
  findElement,
  findElementInScene,
  walkElements,
} from '@depix/core';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Deep clone the IR and find the target element in the cloned IR.
 * Returns the clone and the element reference within the clone.
 */
function cloneAndFind(
  ir: DepixIR,
  elementId: string,
): { clone: DepixIR; element: IRElement | undefined } {
  const clone = structuredClone(ir);
  const element = findElement(clone, elementId);
  return { clone, element };
}

/**
 * Recursively move all children of a container by a delta.
 */
function moveChildrenRecursive(
  container: IRContainer,
  dx: number,
  dy: number,
): void {
  for (const child of container.children) {
    child.bounds.x += dx;
    child.bounds.y += dy;
    if (child.type === 'container') {
      moveChildrenRecursive(child, dx, dy);
    }
  }
}

/**
 * Remove an element by ID from an elements array (in-place).
 * Returns true if the element was found and removed.
 */
function removeFromArray(elements: IRElement[], elementId: string): boolean {
  for (let i = 0; i < elements.length; i++) {
    if (elements[i].id === elementId) {
      elements.splice(i, 1);
      return true;
    }
    if (elements[i].type === 'container') {
      const container = elements[i] as IRContainer;
      if (removeFromArray(container.children, elementId)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Remove all edges referencing an element (by fromId or toId) from a scene.
 */
function removeConnectedEdges(scene: IRScene, elementId: string): void {
  // Collect all edge IDs that reference the element
  const edgeIdsToRemove: string[] = [];
  walkElements(scene, (el) => {
    if (el.type === 'edge') {
      const edge = el as IREdge;
      if (edge.fromId === elementId || edge.toId === elementId) {
        edgeIdsToRemove.push(edge.id);
      }
    }
  });

  // Remove each edge
  for (const edgeId of edgeIdsToRemove) {
    removeFromArray(scene.elements, edgeId);
  }
}

/**
 * Collect all element IDs (including nested children) for an element.
 */
function collectAllIds(element: IRElement): string[] {
  const ids = [element.id];
  if (element.type === 'container') {
    for (const child of (element as IRContainer).children) {
      ids.push(...collectAllIds(child));
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Move an element by delta. Returns a new IR with updated bounds.
 * If the element has connected edges, they are NOT recalculated here
 * (use recalculateConnectedEdges separately).
 */
export function moveElement(
  ir: DepixIR,
  elementId: string,
  dx: number,
  dy: number,
): DepixIR {
  const { clone, element } = cloneAndFind(ir, elementId);
  if (!element) return clone;

  element.bounds.x += dx;
  element.bounds.y += dy;

  // If it's a container, also move all children recursively
  if (element.type === 'container') {
    moveChildrenRecursive(element as IRContainer, dx, dy);
  }

  return clone;
}

/**
 * Resize an element to new bounds. Returns a new IR.
 * Enforces minimum size of 1x1.
 */
export function resizeElement(
  ir: DepixIR,
  elementId: string,
  newBounds: IRBounds,
): DepixIR {
  const { clone, element } = cloneAndFind(ir, elementId);
  if (!element) return clone;

  element.bounds.x = newBounds.x;
  element.bounds.y = newBounds.y;
  element.bounds.w = Math.max(newBounds.w, 1);
  element.bounds.h = Math.max(newBounds.h, 1);

  return clone;
}

/**
 * Add an element to a scene (at top-level or inside a container).
 * Returns a new IR.
 * @param targetId - If provided, add as child of this container. Otherwise add to scene top-level.
 */
export function addElement(
  ir: DepixIR,
  sceneId: string,
  element: IRElement,
  targetId?: string,
): DepixIR {
  const clone = structuredClone(ir);
  const scene = clone.scenes.find((s) => s.id === sceneId);
  if (!scene) return clone;

  if (targetId) {
    const container = findElementInScene(scene, targetId);
    if (container && container.type === 'container') {
      (container as IRContainer).children.push(structuredClone(element));
    }
  } else {
    scene.elements.push(structuredClone(element));
  }

  return clone;
}

/**
 * Remove an element from the IR. Also removes any edges referencing this element.
 * Returns a new IR.
 */
export function removeElement(ir: DepixIR, elementId: string): DepixIR {
  const clone = structuredClone(ir);

  // Find the element first to collect all IDs (for nested containers)
  const element = findElement(clone, elementId);
  if (!element) return clone;

  // Collect all IDs that will be removed (the element + its nested children)
  const removedIds = collectAllIds(element);

  for (const scene of clone.scenes) {
    // Remove edges referencing any of the removed elements
    for (const id of removedIds) {
      removeConnectedEdges(scene, id);
    }
    // Remove the element itself
    removeFromArray(scene.elements, elementId);
  }

  return clone;
}

/**
 * Update an element's style by merging partial style. Returns a new IR.
 * Existing style properties are preserved; only specified keys are overwritten.
 */
export function updateStyle(
  ir: DepixIR,
  elementId: string,
  style: Partial<IRStyle>,
): DepixIR {
  const { clone, element } = cloneAndFind(ir, elementId);
  if (!element) return clone;

  element.style = { ...element.style, ...style };

  return clone;
}

/**
 * Update text content of a text element or shape's innerText.
 * Returns a new IR.
 */
export function updateText(
  ir: DepixIR,
  elementId: string,
  content: string,
): DepixIR {
  const { clone, element } = cloneAndFind(ir, elementId);
  if (!element) return clone;

  if (element.type === 'text') {
    (element as IRText).content = content;
  } else if (element.type === 'shape' && (element as IRShape).innerText) {
    (element as IRShape).innerText!.content = content;
  }

  return clone;
}

/**
 * Reorder elements within a scene by providing the new order of element IDs.
 * Elements whose IDs are in the list are reordered to match the list order.
 * Elements whose IDs are NOT in the list remain in their original positions
 * relative to each other and come after the reordered elements.
 * Returns a new IR.
 */
export function reorderElements(
  ir: DepixIR,
  sceneId: string,
  elementIds: string[],
): DepixIR {
  const clone = structuredClone(ir);
  const scene = clone.scenes.find((s) => s.id === sceneId);
  if (!scene) return clone;

  const idSet = new Set(elementIds);
  const idToElement = new Map<string, IRElement>();
  const unlistedElements: IRElement[] = [];

  for (const el of scene.elements) {
    if (idSet.has(el.id)) {
      idToElement.set(el.id, el);
    } else {
      unlistedElements.push(el);
    }
  }

  // Build the reordered array: listed elements first in specified order, then unlisted
  const reordered: IRElement[] = [];
  for (const id of elementIds) {
    const el = idToElement.get(id);
    if (el) {
      reordered.push(el);
    }
  }
  reordered.push(...unlistedElements);

  scene.elements = reordered;

  return clone;
}
