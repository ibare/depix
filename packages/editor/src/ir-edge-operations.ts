/**
 * Edge-specific IR manipulation operations.
 *
 * These functions recalculate edge paths when connected elements
 * are moved or resized. All functions return new DepixIR objects.
 *
 * @module @depix/editor/ir-edge-operations
 */

import type {
  DepixIR,
  IREdge,
  IRElement,
  IRShape,
  IRShapeType,
} from '@depix/core';
import {
  findElement,
  walkElements,
  routeEdge,
} from '@depix/core';
import type { RouteEdgeInput } from '@depix/core';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Determine the DSL edge style from an existing edge's arrow configuration.
 */
function inferEdgeStyle(edge: IREdge): '->' | '-->' | '--' | '<->' {
  const hasStart = edge.arrowStart && edge.arrowStart !== 'none';
  const hasEnd = edge.arrowEnd && edge.arrowEnd !== 'none';
  const hasDash =
    edge.style.dashPattern && edge.style.dashPattern.length > 0;

  if (hasStart && hasEnd) return '<->';
  if (hasEnd && hasDash) return '-->';
  if (hasEnd) return '->';
  return '--';
}

/**
 * Determine the path type from an existing edge's path.
 */
function inferPathType(
  edge: IREdge,
): 'straight' | 'polyline' | 'bezier' {
  return edge.path.type;
}

/**
 * Get the shape type from an element, if it is a shape.
 */
function getShapeType(element: IRElement): IRShapeType | undefined {
  if (element.type === 'shape') {
    return (element as IRShape).shape;
  }
  return undefined;
}

/**
 * Get the first label text from an edge, if any.
 */
function getEdgeLabel(edge: IREdge): string | undefined {
  if (edge.labels && edge.labels.length > 0) {
    return edge.labels[0].text;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Recalculate a single edge's path based on current element positions.
 * Returns a new IR with the updated edge.
 */
export function recalculateEdge(ir: DepixIR, edgeId: string): DepixIR {
  const edge = findElement(ir, edgeId);
  if (!edge || edge.type !== 'edge') {
    return structuredClone(ir);
  }

  const typedEdge = edge as IREdge;
  const fromEl = findElement(ir, typedEdge.fromId);
  const toEl = findElement(ir, typedEdge.toId);

  if (!fromEl || !toEl) {
    // Source or target element no longer exists; return unchanged clone
    return structuredClone(ir);
  }

  const input: RouteEdgeInput = {
    fromId: typedEdge.fromId,
    toId: typedEdge.toId,
    fromBounds: fromEl.bounds,
    toBounds: toEl.bounds,
    fromShape: getShapeType(fromEl),
    toShape: getShapeType(toEl),
    edgeStyle: inferEdgeStyle(typedEdge),
    label: getEdgeLabel(typedEdge),
    pathType: inferPathType(typedEdge),
  };

  const newEdge = routeEdge(input);
  // Preserve the original edge's ID and style
  newEdge.id = typedEdge.id;
  newEdge.style = typedEdge.style;

  // Clone IR and replace the edge
  const clone = structuredClone(ir);
  for (const scene of clone.scenes) {
    replaceEdgeInElements(scene.elements, edgeId, newEdge);
  }

  return clone;
}

/**
 * Recalculate all edges connected to an element (either as fromId or toId).
 * Returns a new IR.
 */
export function recalculateConnectedEdges(
  ir: DepixIR,
  elementId: string,
): DepixIR {
  // Collect all edge IDs connected to this element
  const connectedEdgeIds: string[] = [];
  for (const scene of ir.scenes) {
    walkElements(scene, (el) => {
      if (el.type === 'edge') {
        const edge = el as IREdge;
        if (edge.fromId === elementId || edge.toId === elementId) {
          connectedEdgeIds.push(edge.id);
        }
      }
    });
  }

  if (connectedEdgeIds.length === 0) {
    return structuredClone(ir);
  }

  // Recalculate each connected edge sequentially
  let result = ir;
  for (const edgeId of connectedEdgeIds) {
    result = recalculateEdge(result, edgeId);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Internal replace helper
// ---------------------------------------------------------------------------

/**
 * Replace an edge by ID in an elements array (in-place on the clone).
 */
function replaceEdgeInElements(
  elements: IRElement[],
  edgeId: string,
  newEdge: IREdge,
): boolean {
  for (let i = 0; i < elements.length; i++) {
    if (elements[i].id === edgeId && elements[i].type === 'edge') {
      elements[i] = structuredClone(newEdge);
      return true;
    }
    if (elements[i].type === 'container') {
      const container = elements[i] as { children: IRElement[] };
      if (replaceEdgeInElements(container.children, edgeId, newEdge)) {
        return true;
      }
    }
  }
  return false;
}
