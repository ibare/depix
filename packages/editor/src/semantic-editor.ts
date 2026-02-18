/**
 * Semantic Editor — smart editing functions that leverage IROrigin metadata.
 *
 * When an element is added to a flow/stack/grid container, the appropriate
 * layout algorithm is re-run so that children are automatically repositioned.
 *
 * All functions return NEW DepixIR objects (immutable pattern).
 *
 * @module @depix/editor/semantic-editor
 */

import type {
  DepixIR,
  IRElement,
  IRContainer,
  IREdge,
  IRBounds,
} from '@depix/core';
import {
  findElement,
  layoutStack,
  layoutGrid,
  layoutFlow,
  layoutGroup,
  layoutLayers,
} from '@depix/core';
import type {
  LayoutChild,
  FlowEdge,
  StackLayoutConfig,
  GridLayoutConfig,
  FlowLayoutConfig,
  GroupLayoutConfig,
  LayersLayoutConfig,
} from '@depix/core';

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/**
 * Check if an element is a semantic container (has origin metadata).
 */
export function isSemanticContainer(element: IRElement): boolean {
  return element.type === 'container' && element.origin != null;
}

/**
 * Get the semantic type of an element's origin, or null.
 */
export function getSemanticType(element: IRElement): string | null {
  return element.origin?.sourceType ?? null;
}

// ---------------------------------------------------------------------------
// Smart editing operations
// ---------------------------------------------------------------------------

/**
 * Add a node to a flow container and re-run flow layout.
 * Optionally specify edges from/to the new node.
 * Returns a new IR.
 */
export function addNodeToFlow(
  ir: DepixIR,
  containerId: string,
  newNode: IRElement,
  edges?: Array<{ fromId: string; toId: string }>,
): DepixIR {
  const clone = structuredClone(ir);
  const container = findElement(clone, containerId);

  if (
    !container ||
    container.type !== 'container' ||
    container.origin?.sourceType !== 'flow'
  ) {
    return clone;
  }

  const typedContainer = container as IRContainer;

  // Add the new node to children
  typedContainer.children.push(structuredClone(newNode));

  // Add edge elements if provided
  if (edges && edges.length > 0) {
    for (const edge of edges) {
      const edgeElement: IREdge = {
        id: `edge-${edge.fromId}-${edge.toId}`,
        type: 'edge',
        bounds: { x: 0, y: 0, w: 0, h: 0 },
        style: {},
        fromId: edge.fromId,
        toId: edge.toId,
        fromAnchor: { x: 0, y: 0 },
        toAnchor: { x: 0, y: 0 },
        path: { type: 'straight' },
      };
      typedContainer.children.push(edgeElement);
    }
  }

  // Re-run layout
  return relayoutContainerInPlace(clone, typedContainer);
}

/**
 * Reorder a child within a stack container and re-run stack layout.
 * Returns a new IR.
 */
export function reorderStackChild(
  ir: DepixIR,
  containerId: string,
  fromIndex: number,
  toIndex: number,
): DepixIR {
  const clone = structuredClone(ir);
  const container = findElement(clone, containerId);

  if (
    !container ||
    container.type !== 'container' ||
    container.origin?.sourceType !== 'stack'
  ) {
    return clone;
  }

  const typedContainer = container as IRContainer;
  const children = typedContainer.children;

  // Validate indices
  if (
    fromIndex < 0 ||
    fromIndex >= children.length ||
    toIndex < 0 ||
    toIndex >= children.length
  ) {
    return clone;
  }

  // Splice: remove from fromIndex, insert at toIndex
  const [moved] = children.splice(fromIndex, 1);
  children.splice(toIndex, 0, moved);

  // Re-run layout
  return relayoutContainerInPlace(clone, typedContainer);
}

/**
 * Add a cell to a grid container and re-run grid layout.
 * Returns a new IR.
 */
export function addGridCell(
  ir: DepixIR,
  containerId: string,
  newCell: IRElement,
): DepixIR {
  const clone = structuredClone(ir);
  const container = findElement(clone, containerId);

  if (
    !container ||
    container.type !== 'container' ||
    container.origin?.sourceType !== 'grid'
  ) {
    return clone;
  }

  const typedContainer = container as IRContainer;

  // Add the new cell to children
  typedContainer.children.push(structuredClone(newCell));

  // Re-run layout
  return relayoutContainerInPlace(clone, typedContainer);
}

/**
 * Re-run the appropriate layout algorithm for a semantic container.
 * This is the core function that dispatches to the right layout based on origin.sourceType.
 * Returns a new IR with updated child bounds.
 */
export function relayoutContainer(
  ir: DepixIR,
  containerId: string,
): DepixIR {
  const clone = structuredClone(ir);
  const container = findElement(clone, containerId);

  if (!container || container.type !== 'container') {
    return clone;
  }

  const typedContainer = container as IRContainer;

  if (!typedContainer.origin) {
    return clone;
  }

  return relayoutContainerInPlace(clone, typedContainer);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Re-run the layout algorithm for a container that is already part of a
 * cloned IR. Mutates the clone in-place and returns it.
 */
function relayoutContainerInPlace(
  clone: DepixIR,
  container: IRContainer,
): DepixIR {
  if (!container.origin) {
    return clone;
  }

  const { sourceType, sourceProps = {} } = container.origin;

  // Separate non-edge children (layout targets) from edge children
  const nonEdgeChildren: IRElement[] = [];
  const nonEdgeIndices: number[] = [];
  for (let i = 0; i < container.children.length; i++) {
    if (container.children[i].type !== 'edge') {
      nonEdgeChildren.push(container.children[i]);
      nonEdgeIndices.push(i);
    }
  }

  // Build LayoutChild[] from non-edge children
  const layoutChildren: LayoutChild[] = nonEdgeChildren.map((child) => ({
    id: child.id,
    width: child.bounds.w,
    height: child.bounds.h,
  }));

  let childBounds: IRBounds[] | undefined;

  switch (sourceType) {
    case 'stack': {
      const config: StackLayoutConfig = {
        bounds: container.bounds,
        direction: (sourceProps.direction as 'row' | 'col') ?? 'col',
        gap: (sourceProps.gap as number) ?? 2,
        align: (sourceProps.align as 'start' | 'center' | 'end' | 'stretch') ?? 'start',
        wrap: (sourceProps.wrap as boolean) ?? false,
      };
      const result = layoutStack(layoutChildren, config);
      childBounds = result.childBounds;
      break;
    }

    case 'grid': {
      const config: GridLayoutConfig = {
        bounds: container.bounds,
        cols: (sourceProps.cols as number) ?? 2,
        gap: (sourceProps.gap as number) ?? 2,
      };
      const result = layoutGrid(layoutChildren, config);
      childBounds = result.childBounds;
      break;
    }

    case 'flow': {
      // Collect edges from container children
      const flowEdges: FlowEdge[] = [];
      for (const child of container.children) {
        if (child.type === 'edge') {
          const edge = child as IREdge;
          flowEdges.push({ fromId: edge.fromId, toId: edge.toId });
        }
      }

      const config: FlowLayoutConfig = {
        bounds: container.bounds,
        direction: (sourceProps.direction as 'right' | 'left' | 'down' | 'up') ?? 'right',
        gap: (sourceProps.gap as number) ?? 5,
        edges: flowEdges,
      };
      const result = layoutFlow(layoutChildren, config);
      childBounds = result.childBounds;
      break;
    }

    case 'tree': {
      // Tree layout needs hierarchical TreeNode[], complex to rebuild
      // Skip relayout for tree containers
      return clone;
    }

    case 'group': {
      const config: GroupLayoutConfig = {
        bounds: container.bounds,
        padding: (sourceProps.padding as number) ?? 2,
      };
      const result = layoutGroup(layoutChildren, config);
      childBounds = result.childBounds;
      break;
    }

    case 'layers': {
      const config: LayersLayoutConfig = {
        bounds: container.bounds,
        gap: (sourceProps.gap as number) ?? 1,
      };
      const result = layoutLayers(layoutChildren, config);
      childBounds = result.childBounds;
      break;
    }

    case 'canvas': {
      // Canvas = free positioning, no relayout
      return clone;
    }

    default:
      return clone;
  }

  // Apply layout result to non-edge children only
  if (childBounds) {
    for (let i = 0; i < nonEdgeIndices.length; i++) {
      const childIdx = nonEdgeIndices[i];
      container.children[childIdx].bounds = childBounds[i];
    }
  }

  return clone;
}
