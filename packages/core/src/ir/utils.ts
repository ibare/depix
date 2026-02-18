/**
 * Utility functions for working with DepixIR structures.
 *
 * @module @depix/core/ir/utils
 */

import type {
  DepixIR,
  IRContainer,
  IRElement,
  IRScene,
} from './types.js';

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

/** Counter to ensure uniqueness within the same millisecond. */
let idCounter = 0;

/**
 * Generate a unique element ID.
 *
 * The format is `el-{timestamp}-{random}` where timestamp is the
 * current time in milliseconds and random is a 4-character hex string.
 * A monotonic counter is appended when multiple IDs are generated in
 * the same millisecond to guarantee uniqueness.
 *
 * @returns A unique string suitable for use as an IR element ID.
 */
export function generateId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(16).slice(2, 6).padEnd(4, '0');
  const counter = idCounter++;
  return `el-${timestamp}-${random}${counter > 0 ? `-${counter}` : ''}`;
}

// ---------------------------------------------------------------------------
// Element search
// ---------------------------------------------------------------------------

/**
 * Search for an element by ID in a single scene.
 *
 * Searches the top-level elements and recursively descends into
 * containers.
 *
 * @param scene - The scene to search.
 * @param id    - The element ID to find.
 * @returns The matching element, or `undefined` if not found.
 */
export function findElementInScene(
  scene: IRScene,
  id: string,
): IRElement | undefined {
  for (const element of scene.elements) {
    const found = findInElement(element, id);
    if (found) return found;
  }
  return undefined;
}

/**
 * Search for an element by ID across all scenes in an IR document.
 *
 * Recursively descends into containers within each scene.
 *
 * @param ir - The DepixIR document to search.
 * @param id - The element ID to find.
 * @returns The matching element, or `undefined` if not found.
 */
export function findElement(
  ir: DepixIR,
  id: string,
): IRElement | undefined {
  for (const scene of ir.scenes) {
    const found = findElementInScene(scene, id);
    if (found) return found;
  }
  return undefined;
}

/**
 * Recursively search within a single element (and its children if it
 * is a container).
 */
function findInElement(
  element: IRElement,
  id: string,
): IRElement | undefined {
  if (element.id === id) return element;
  if (element.type === 'container') {
    for (const child of element.children) {
      const found = findInElement(child, id);
      if (found) return found;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Tree traversal
// ---------------------------------------------------------------------------

/**
 * Depth-first traversal of all elements in a scene.
 *
 * The visitor is called for every element, including nested children
 * of containers. For container children, the parent container is
 * passed as the second argument.
 *
 * @param scene   - The scene to traverse.
 * @param visitor - Callback invoked for each element.
 */
export function walkElements(
  scene: IRScene,
  visitor: (element: IRElement, parent?: IRContainer) => void,
): void {
  for (const element of scene.elements) {
    walkElement(element, undefined, visitor);
  }
}

/**
 * Internal recursive walker.
 */
function walkElement(
  element: IRElement,
  parent: IRContainer | undefined,
  visitor: (element: IRElement, parent?: IRContainer) => void,
): void {
  visitor(element, parent);
  if (element.type === 'container') {
    for (const child of element.children) {
      walkElement(child, element, visitor);
    }
  }
}

// ---------------------------------------------------------------------------
// Parent lookup
// ---------------------------------------------------------------------------

/**
 * Find the parent of an element by its ID within a scene.
 *
 * Returns the containing {@link IRContainer} if the element is nested,
 * or the {@link IRScene} if the element is at the top level. Returns
 * `undefined` if the element is not found.
 *
 * @param scene     - The scene to search.
 * @param elementId - The ID of the element whose parent to find.
 * @returns The parent container or scene, or `undefined`.
 */
export function getElementParent(
  scene: IRScene,
  elementId: string,
): IRContainer | IRScene | undefined {
  for (const element of scene.elements) {
    if (element.id === elementId) return scene;
    if (element.type === 'container') {
      const found = findParentInContainer(element, elementId);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Recursively search for a parent within a container hierarchy.
 */
function findParentInContainer(
  container: IRContainer,
  elementId: string,
): IRContainer | undefined {
  for (const child of container.children) {
    if (child.id === elementId) return container;
    if (child.type === 'container') {
      const found = findParentInContainer(child, elementId);
      if (found) return found;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Deep clone
// ---------------------------------------------------------------------------

/**
 * Create a deep clone of an element with a newly generated ID.
 *
 * Container children are recursively cloned, each receiving a new ID.
 * All other properties are deep-copied.
 *
 * @param element - The element to clone.
 * @returns A new element with the same properties but a fresh ID.
 */
export function cloneElement<T extends IRElement>(element: T): T {
  const cloned = structuredClone(element);
  assignNewIds(cloned);
  return cloned;
}

/**
 * Recursively assign new IDs to an element and its children.
 */
function assignNewIds(element: IRElement): void {
  element.id = generateId();
  if (element.type === 'container') {
    for (const child of element.children) {
      assignNewIds(child);
    }
  }
}
