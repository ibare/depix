/**
 * Tests for semantic editor — smart editing functions leveraging IROrigin.
 *
 * @module @depix/editor/__tests__/semantic-editor
 */

import { describe, it, expect } from 'vitest';
import type {
  DepixIR,
  IRShape,
  IRContainer,
  IRElement,
  IREdge,
  IROrigin,
} from '@depix/core';
import { findElement } from '@depix/core';
import {
  isSemanticContainer,
  getSemanticType,
  addNodeToFlow,
  reorderStackChild,
  addGridCell,
  relayoutContainer,
} from '../src/semantic-editor.js';

// ---------------------------------------------------------------------------
// Test fixture helpers
// ---------------------------------------------------------------------------

function createMeta() {
  return {
    aspectRatio: { width: 16, height: 9 },
    background: { type: 'solid' as const, color: '#ffffff' },
    drawingStyle: 'default' as const,
  };
}

function createShape(
  id: string,
  bounds = { x: 0, y: 0, w: 10, h: 10 },
): IRShape {
  return {
    id,
    type: 'shape',
    shape: 'rect',
    bounds: { ...bounds },
    style: { fill: '#aaaaaa' },
  };
}

function createStackContainer(
  children: IRElement[],
  props?: Record<string, unknown>,
): IRContainer {
  return {
    id: 'stack-1',
    type: 'container',
    bounds: { x: 0, y: 0, w: 100, h: 100 },
    style: {},
    origin: {
      sourceType: 'stack',
      sourceProps: {
        direction: 'col',
        gap: 2,
        align: 'start',
        wrap: false,
        ...props,
      },
    },
    children,
  };
}

function createGridContainer(
  children: IRElement[],
  props?: Record<string, unknown>,
): IRContainer {
  return {
    id: 'grid-1',
    type: 'container',
    bounds: { x: 0, y: 0, w: 100, h: 100 },
    style: {},
    origin: {
      sourceType: 'grid',
      sourceProps: { cols: 2, gap: 2, ...props },
    },
    children,
  };
}

function createFlowContainer(
  children: IRElement[],
  edges: IREdge[] = [],
  props?: Record<string, unknown>,
): IRContainer {
  return {
    id: 'flow-1',
    type: 'container',
    bounds: { x: 0, y: 0, w: 100, h: 100 },
    style: {},
    origin: {
      sourceType: 'flow',
      sourceProps: { direction: 'right', gap: 5, ...props },
    },
    children: [...children, ...edges],
  };
}

function createGroupContainer(
  children: IRElement[],
  props?: Record<string, unknown>,
): IRContainer {
  return {
    id: 'group-1',
    type: 'container',
    bounds: { x: 0, y: 0, w: 100, h: 100 },
    style: {},
    origin: {
      sourceType: 'group',
      sourceProps: { padding: 2, ...props },
    },
    children,
  };
}

function createLayersContainer(
  children: IRElement[],
  props?: Record<string, unknown>,
): IRContainer {
  return {
    id: 'layers-1',
    type: 'container',
    bounds: { x: 0, y: 0, w: 100, h: 100 },
    style: {},
    origin: {
      sourceType: 'layers',
      sourceProps: { gap: 1, ...props },
    },
    children,
  };
}

function createEdge(fromId: string, toId: string): IREdge {
  return {
    id: `edge-${fromId}-${toId}`,
    type: 'edge',
    bounds: { x: 0, y: 0, w: 0, h: 0 },
    style: {},
    fromId,
    toId,
    fromAnchor: { x: 0, y: 0 },
    toAnchor: { x: 0, y: 0 },
    path: { type: 'straight' },
  };
}

function wrapInIR(container: IRContainer): DepixIR {
  return {
    meta: createMeta(),
    scenes: [
      {
        id: 'scene-1',
        elements: [container],
      },
    ],
    transitions: [],
  };
}

// ===========================================================================
// isSemanticContainer
// ===========================================================================

describe('isSemanticContainer', () => {
  it('should return true for a container with origin', () => {
    const container = createStackContainer([]);
    expect(isSemanticContainer(container)).toBe(true);
  });

  it('should return false for a container without origin', () => {
    const container: IRContainer = {
      id: 'plain-1',
      type: 'container',
      bounds: { x: 0, y: 0, w: 50, h: 50 },
      style: {},
      children: [],
    };
    expect(isSemanticContainer(container)).toBe(false);
  });

  it('should return false for a non-container element', () => {
    const shape = createShape('shape-1');
    expect(isSemanticContainer(shape)).toBe(false);
  });

  it('should return false for a non-container element even with origin', () => {
    const shape: IRShape = {
      ...createShape('shape-1'),
      origin: { sourceType: 'stack' },
    };
    // Shapes are not containers, even if they somehow have origin
    expect(isSemanticContainer(shape)).toBe(false);
  });

  it('should return true for all semantic container types', () => {
    const types: IROrigin['sourceType'][] = [
      'flow',
      'stack',
      'grid',
      'tree',
      'group',
      'layers',
      'canvas',
    ];
    for (const sourceType of types) {
      const container: IRContainer = {
        id: `${sourceType}-1`,
        type: 'container',
        bounds: { x: 0, y: 0, w: 50, h: 50 },
        style: {},
        origin: { sourceType },
        children: [],
      };
      expect(isSemanticContainer(container)).toBe(true);
    }
  });
});

// ===========================================================================
// getSemanticType
// ===========================================================================

describe('getSemanticType', () => {
  it('should return "flow" for a flow container', () => {
    const container = createFlowContainer([]);
    expect(getSemanticType(container)).toBe('flow');
  });

  it('should return "stack" for a stack container', () => {
    const container = createStackContainer([]);
    expect(getSemanticType(container)).toBe('stack');
  });

  it('should return "grid" for a grid container', () => {
    const container = createGridContainer([]);
    expect(getSemanticType(container)).toBe('grid');
  });

  it('should return null for non-semantic element', () => {
    const shape = createShape('shape-1');
    expect(getSemanticType(shape)).toBeNull();
  });

  it('should return null for container without origin', () => {
    const container: IRContainer = {
      id: 'plain',
      type: 'container',
      bounds: { x: 0, y: 0, w: 50, h: 50 },
      style: {},
      children: [],
    };
    expect(getSemanticType(container)).toBeNull();
  });
});

// ===========================================================================
// addNodeToFlow
// ===========================================================================

describe('addNodeToFlow', () => {
  it('should add a node to flow container children', () => {
    const nodeA = createShape('node-a', { x: 0, y: 0, w: 15, h: 10 });
    const container = createFlowContainer([nodeA]);
    const ir = wrapInIR(container);

    const newNode = createShape('node-b', { x: 0, y: 0, w: 15, h: 10 });
    const result = addNodeToFlow(ir, 'flow-1', newNode);

    const flowContainer = findElement(result, 'flow-1') as IRContainer;
    const nonEdgeChildren = flowContainer.children.filter(
      (c) => c.type !== 'edge',
    );
    expect(nonEdgeChildren).toHaveLength(2);
    expect(nonEdgeChildren[1].id).toBe('node-b');
  });

  it('should re-run flow layout updating child bounds', () => {
    const nodeA = createShape('node-a', { x: 0, y: 0, w: 15, h: 10 });
    const container = createFlowContainer([nodeA]);
    const ir = wrapInIR(container);

    const newNode = createShape('node-b', { x: 0, y: 0, w: 15, h: 10 });
    const result = addNodeToFlow(ir, 'flow-1', newNode, [
      { fromId: 'node-a', toId: 'node-b' },
    ]);

    const flowContainer = findElement(result, 'flow-1') as IRContainer;
    const nodeAResult = flowContainer.children.find(
      (c) => c.id === 'node-a',
    )!;
    const nodeBResult = flowContainer.children.find(
      (c) => c.id === 'node-b',
    )!;

    // After flow layout with direction=right, node-b should be positioned
    // to the right of node-a (they should not overlap)
    expect(nodeBResult.bounds.x).toBeGreaterThanOrEqual(nodeAResult.bounds.x);
  });

  it('should add edge elements when edges are provided', () => {
    const nodeA = createShape('node-a', { x: 0, y: 0, w: 15, h: 10 });
    const container = createFlowContainer([nodeA]);
    const ir = wrapInIR(container);

    const newNode = createShape('node-b', { x: 0, y: 0, w: 15, h: 10 });
    const result = addNodeToFlow(ir, 'flow-1', newNode, [
      { fromId: 'node-a', toId: 'node-b' },
    ]);

    const flowContainer = findElement(result, 'flow-1') as IRContainer;
    const edgeChildren = flowContainer.children.filter(
      (c) => c.type === 'edge',
    );
    expect(edgeChildren).toHaveLength(1);
    expect((edgeChildren[0] as IREdge).fromId).toBe('node-a');
    expect((edgeChildren[0] as IREdge).toId).toBe('node-b');
  });

  it('should return unchanged clone for non-flow container', () => {
    const container = createStackContainer([createShape('child-1')]);
    const ir = wrapInIR(container);

    const newNode = createShape('node-new');
    const result = addNodeToFlow(ir, 'stack-1', newNode);

    // Should not have added the node
    const stackContainer = findElement(result, 'stack-1') as IRContainer;
    expect(stackContainer.children).toHaveLength(1);
    expect(stackContainer.children[0].id).toBe('child-1');
  });

  it('should return unchanged clone when container is not found', () => {
    const container = createFlowContainer([createShape('node-a')]);
    const ir = wrapInIR(container);

    const newNode = createShape('node-b');
    const result = addNodeToFlow(ir, 'nonexistent', newNode);

    expect(result).not.toBe(ir);
    const flowContainer = findElement(result, 'flow-1') as IRContainer;
    expect(flowContainer.children).toHaveLength(1);
  });

  it('should not mutate the original IR', () => {
    const nodeA = createShape('node-a');
    const container = createFlowContainer([nodeA]);
    const ir = wrapInIR(container);
    const original = structuredClone(ir);

    const newNode = createShape('node-b');
    addNodeToFlow(ir, 'flow-1', newNode);

    expect(ir).toEqual(original);
  });
});

// ===========================================================================
// reorderStackChild
// ===========================================================================

describe('reorderStackChild', () => {
  it('should reorder children and re-run stack layout', () => {
    const children = [
      createShape('child-a', { x: 0, y: 0, w: 10, h: 10 }),
      createShape('child-b', { x: 0, y: 0, w: 10, h: 20 }),
      createShape('child-c', { x: 0, y: 0, w: 10, h: 30 }),
    ];
    const container = createStackContainer(children);
    const ir = wrapInIR(container);

    // Move child-a (index 0) to index 2
    const result = reorderStackChild(ir, 'stack-1', 0, 2);

    const stackContainer = findElement(result, 'stack-1') as IRContainer;
    expect(stackContainer.children[0].id).toBe('child-b');
    expect(stackContainer.children[1].id).toBe('child-c');
    expect(stackContainer.children[2].id).toBe('child-a');
  });

  it('should update positions after reorder (stack col layout)', () => {
    const children = [
      createShape('child-a', { x: 0, y: 0, w: 10, h: 10 }),
      createShape('child-b', { x: 0, y: 0, w: 10, h: 20 }),
    ];
    const container = createStackContainer(children, {
      direction: 'col',
      gap: 2,
    });
    const ir = wrapInIR(container);

    // Move child-b (index 1) to index 0
    const result = reorderStackChild(ir, 'stack-1', 1, 0);

    const stackContainer = findElement(result, 'stack-1') as IRContainer;
    // child-b (h=20) is now first, child-a (h=10) is second
    const childB = stackContainer.children[0];
    const childA = stackContainer.children[1];

    // In col direction, child-b should start at y=0, child-a at y=22 (20+2 gap)
    expect(childB.bounds.y).toBe(0);
    expect(childA.bounds.y).toBe(22); // 20 + 2 gap
  });

  it('should return unchanged clone for non-stack container', () => {
    const children = [
      createShape('child-a'),
      createShape('child-b'),
    ];
    const container = createGridContainer(children);
    const ir = wrapInIR(container);

    const result = reorderStackChild(ir, 'grid-1', 0, 1);

    const gridContainer = findElement(result, 'grid-1') as IRContainer;
    expect(gridContainer.children[0].id).toBe('child-a');
    expect(gridContainer.children[1].id).toBe('child-b');
  });

  it('should return unchanged clone for out-of-range fromIndex', () => {
    const children = [createShape('child-a'), createShape('child-b')];
    const container = createStackContainer(children);
    const ir = wrapInIR(container);

    const result = reorderStackChild(ir, 'stack-1', -1, 0);

    const stackContainer = findElement(result, 'stack-1') as IRContainer;
    expect(stackContainer.children[0].id).toBe('child-a');
  });

  it('should return unchanged clone for out-of-range toIndex', () => {
    const children = [createShape('child-a'), createShape('child-b')];
    const container = createStackContainer(children);
    const ir = wrapInIR(container);

    const result = reorderStackChild(ir, 'stack-1', 0, 5);

    const stackContainer = findElement(result, 'stack-1') as IRContainer;
    expect(stackContainer.children[0].id).toBe('child-a');
  });

  it('should not mutate the original IR', () => {
    const children = [createShape('child-a'), createShape('child-b')];
    const container = createStackContainer(children);
    const ir = wrapInIR(container);
    const original = structuredClone(ir);

    reorderStackChild(ir, 'stack-1', 0, 1);

    expect(ir).toEqual(original);
  });
});

// ===========================================================================
// addGridCell
// ===========================================================================

describe('addGridCell', () => {
  it('should add a cell to the grid container', () => {
    const children = [
      createShape('cell-1', { x: 0, y: 0, w: 10, h: 10 }),
      createShape('cell-2', { x: 0, y: 0, w: 10, h: 10 }),
    ];
    const container = createGridContainer(children);
    const ir = wrapInIR(container);

    const newCell = createShape('cell-3', { x: 0, y: 0, w: 10, h: 10 });
    const result = addGridCell(ir, 'grid-1', newCell);

    const gridContainer = findElement(result, 'grid-1') as IRContainer;
    expect(gridContainer.children).toHaveLength(3);
    expect(gridContainer.children[2].id).toBe('cell-3');
  });

  it('should re-run grid layout after adding a cell', () => {
    const children = [
      createShape('cell-1', { x: 0, y: 0, w: 10, h: 10 }),
      createShape('cell-2', { x: 0, y: 0, w: 10, h: 10 }),
    ];
    const container = createGridContainer(children, { cols: 2, gap: 2 });
    const ir = wrapInIR(container);

    const newCell = createShape('cell-3', { x: 0, y: 0, w: 10, h: 10 });
    const result = addGridCell(ir, 'grid-1', newCell);

    const gridContainer = findElement(result, 'grid-1') as IRContainer;
    // With 2 cols: cell-1 at (col 0, row 0), cell-2 at (col 1, row 0), cell-3 at (col 0, row 1)
    const cell3 = gridContainer.children[2];
    // cell-3 should be on the second row (y > 0)
    expect(cell3.bounds.y).toBeGreaterThan(0);
  });

  it('should return unchanged clone for non-grid container', () => {
    const container = createStackContainer([createShape('child-1')]);
    const ir = wrapInIR(container);

    const newCell = createShape('cell-new');
    const result = addGridCell(ir, 'stack-1', newCell);

    const stackContainer = findElement(result, 'stack-1') as IRContainer;
    expect(stackContainer.children).toHaveLength(1);
  });

  it('should not mutate the original IR', () => {
    const container = createGridContainer([createShape('cell-1')]);
    const ir = wrapInIR(container);
    const original = structuredClone(ir);

    addGridCell(ir, 'grid-1', createShape('cell-new'));

    expect(ir).toEqual(original);
  });
});

// ===========================================================================
// relayoutContainer
// ===========================================================================

describe('relayoutContainer', () => {
  it('should relayout a stack container (col direction)', () => {
    const children = [
      createShape('child-a', { x: 50, y: 50, w: 10, h: 10 }),
      createShape('child-b', { x: 50, y: 50, w: 10, h: 15 }),
    ];
    const container = createStackContainer(children, {
      direction: 'col',
      gap: 5,
      align: 'start',
    });
    const ir = wrapInIR(container);

    const result = relayoutContainer(ir, 'stack-1');

    const stackContainer = findElement(result, 'stack-1') as IRContainer;
    const childA = stackContainer.children[0];
    const childB = stackContainer.children[1];

    // In col direction, children stack vertically
    expect(childA.bounds.y).toBe(0);
    expect(childB.bounds.y).toBe(15); // 10 + 5 gap
  });

  it('should relayout a stack container (row direction)', () => {
    const children = [
      createShape('child-a', { x: 50, y: 50, w: 20, h: 10 }),
      createShape('child-b', { x: 50, y: 50, w: 30, h: 10 }),
    ];
    const container = createStackContainer(children, {
      direction: 'row',
      gap: 3,
      align: 'start',
    });
    const ir = wrapInIR(container);

    const result = relayoutContainer(ir, 'stack-1');

    const stackContainer = findElement(result, 'stack-1') as IRContainer;
    const childA = stackContainer.children[0];
    const childB = stackContainer.children[1];

    // In row direction, children stack horizontally
    expect(childA.bounds.x).toBe(0);
    expect(childB.bounds.x).toBe(23); // 20 + 3 gap
  });

  it('should relayout a grid container', () => {
    const children = [
      createShape('cell-1', { x: 0, y: 0, w: 10, h: 10 }),
      createShape('cell-2', { x: 0, y: 0, w: 10, h: 10 }),
      createShape('cell-3', { x: 0, y: 0, w: 10, h: 10 }),
    ];
    const container = createGridContainer(children, { cols: 2, gap: 2 });
    const ir = wrapInIR(container);

    const result = relayoutContainer(ir, 'grid-1');

    const gridContainer = findElement(result, 'grid-1') as IRContainer;
    // cell-1: col 0, row 0
    // cell-2: col 1, row 0
    // cell-3: col 0, row 1
    expect(gridContainer.children[0].bounds.x).toBe(0);
    expect(gridContainer.children[1].bounds.x).toBeGreaterThan(0);
    expect(gridContainer.children[2].bounds.y).toBeGreaterThan(0);
    expect(gridContainer.children[2].bounds.x).toBe(0); // back to col 0
  });

  it('should relayout a flow container', () => {
    const nodeA = createShape('node-a', { x: 0, y: 0, w: 10, h: 10 });
    const nodeB = createShape('node-b', { x: 0, y: 0, w: 10, h: 10 });
    const edge = createEdge('node-a', 'node-b');
    const container = createFlowContainer([nodeA, nodeB], [edge], {
      direction: 'right',
      gap: 5,
    });
    const ir = wrapInIR(container);

    const result = relayoutContainer(ir, 'flow-1');

    const flowContainer = findElement(result, 'flow-1') as IRContainer;
    const resultNodeA = flowContainer.children.find(
      (c) => c.id === 'node-a',
    )!;
    const resultNodeB = flowContainer.children.find(
      (c) => c.id === 'node-b',
    )!;

    // node-b should be to the right of node-a in flow direction 'right'
    expect(resultNodeB.bounds.x).toBeGreaterThan(resultNodeA.bounds.x);
  });

  it('should relayout a group container', () => {
    const children = [
      createShape('child-a', { x: 50, y: 50, w: 20, h: 10 }),
      createShape('child-b', { x: 50, y: 50, w: 20, h: 15 }),
    ];
    const container = createGroupContainer(children, { padding: 5 });
    const ir = wrapInIR(container);

    const result = relayoutContainer(ir, 'group-1');

    const groupContainer = findElement(result, 'group-1') as IRContainer;
    const childA = groupContainer.children[0];
    const childB = groupContainer.children[1];

    // Group layout applies padding — children should start after padding
    expect(childA.bounds.x).toBeGreaterThanOrEqual(5);
    expect(childA.bounds.y).toBeGreaterThanOrEqual(5);
    // child-b should be below child-a
    expect(childB.bounds.y).toBeGreaterThan(childA.bounds.y);
  });

  it('should relayout a layers container', () => {
    const children = [
      createShape('layer-1', { x: 0, y: 0, w: 100, h: 10 }),
      createShape('layer-2', { x: 0, y: 0, w: 100, h: 10 }),
      createShape('layer-3', { x: 0, y: 0, w: 100, h: 10 }),
    ];
    const container = createLayersContainer(children, { gap: 2 });
    const ir = wrapInIR(container);

    const result = relayoutContainer(ir, 'layers-1');

    const layersContainer = findElement(result, 'layers-1') as IRContainer;
    // Layers divides space equally
    const l1 = layersContainer.children[0];
    const l2 = layersContainer.children[1];
    const l3 = layersContainer.children[2];

    expect(l1.bounds.y).toBe(0);
    expect(l2.bounds.y).toBeGreaterThan(l1.bounds.y);
    expect(l3.bounds.y).toBeGreaterThan(l2.bounds.y);
    // All layers should have the full container width
    expect(l1.bounds.w).toBe(100);
    expect(l2.bounds.w).toBe(100);
    expect(l3.bounds.w).toBe(100);
  });

  it('should not change a non-semantic container', () => {
    const container: IRContainer = {
      id: 'plain-1',
      type: 'container',
      bounds: { x: 0, y: 0, w: 100, h: 100 },
      style: {},
      children: [
        createShape('child-a', { x: 10, y: 20, w: 30, h: 40 }),
      ],
    };
    const ir: DepixIR = {
      meta: createMeta(),
      scenes: [{ id: 'scene-1', elements: [container] }],
      transitions: [],
    };

    const result = relayoutContainer(ir, 'plain-1');

    const resultContainer = findElement(result, 'plain-1') as IRContainer;
    // Bounds should be unchanged
    expect(resultContainer.children[0].bounds).toEqual({
      x: 10,
      y: 20,
      w: 30,
      h: 40,
    });
  });

  it('should not modify edge children during relayout', () => {
    const nodeA = createShape('node-a', { x: 0, y: 0, w: 10, h: 10 });
    const nodeB = createShape('node-b', { x: 0, y: 0, w: 10, h: 10 });
    const edge = createEdge('node-a', 'node-b');
    // Give the edge specific bounds to check it does not get repositioned
    edge.bounds = { x: 5, y: 5, w: 20, h: 1 };
    const container = createFlowContainer([nodeA, nodeB], [edge]);
    const ir = wrapInIR(container);

    const result = relayoutContainer(ir, 'flow-1');

    const flowContainer = findElement(result, 'flow-1') as IRContainer;
    const resultEdge = flowContainer.children.find(
      (c) => c.type === 'edge',
    ) as IREdge;
    // Edge bounds should remain the same
    expect(resultEdge.bounds).toEqual({ x: 5, y: 5, w: 20, h: 1 });
  });

  it('should skip relayout for tree containers', () => {
    const children = [
      createShape('child-a', { x: 10, y: 20, w: 15, h: 15 }),
    ];
    const container: IRContainer = {
      id: 'tree-1',
      type: 'container',
      bounds: { x: 0, y: 0, w: 100, h: 100 },
      style: {},
      origin: { sourceType: 'tree', sourceProps: {} },
      children,
    };
    const ir = wrapInIR(container);

    const result = relayoutContainer(ir, 'tree-1');

    const treeContainer = findElement(result, 'tree-1') as IRContainer;
    // Bounds should be unchanged (tree relayout is skipped)
    expect(treeContainer.children[0].bounds).toEqual({
      x: 10,
      y: 20,
      w: 15,
      h: 15,
    });
  });

  it('should skip relayout for canvas containers', () => {
    const children = [
      createShape('child-a', { x: 10, y: 20, w: 15, h: 15 }),
    ];
    const container: IRContainer = {
      id: 'canvas-1',
      type: 'container',
      bounds: { x: 0, y: 0, w: 100, h: 100 },
      style: {},
      origin: { sourceType: 'canvas', sourceProps: {} },
      children,
    };
    const ir = wrapInIR(container);

    const result = relayoutContainer(ir, 'canvas-1');

    const canvasContainer = findElement(
      result,
      'canvas-1',
    ) as IRContainer;
    // Bounds should be unchanged (canvas = free positioning)
    expect(canvasContainer.children[0].bounds).toEqual({
      x: 10,
      y: 20,
      w: 15,
      h: 15,
    });
  });
});

// ===========================================================================
// Edge cases
// ===========================================================================

describe('edge cases', () => {
  it('should return unchanged clone when container is not found', () => {
    const ir: DepixIR = {
      meta: createMeta(),
      scenes: [{ id: 'scene-1', elements: [] }],
      transitions: [],
    };

    const result = relayoutContainer(ir, 'nonexistent');

    expect(result).not.toBe(ir);
    expect(result.scenes[0].elements).toHaveLength(0);
  });

  it('should handle empty children during relayout', () => {
    const container = createStackContainer([]);
    const ir = wrapInIR(container);

    const result = relayoutContainer(ir, 'stack-1');

    const stackContainer = findElement(result, 'stack-1') as IRContainer;
    expect(stackContainer.children).toHaveLength(0);
  });

  it('should use default sourceProps when missing', () => {
    // Create a stack container with no sourceProps
    const children = [
      createShape('child-a', { x: 50, y: 50, w: 10, h: 10 }),
      createShape('child-b', { x: 50, y: 50, w: 10, h: 15 }),
    ];
    const container: IRContainer = {
      id: 'stack-no-props',
      type: 'container',
      bounds: { x: 0, y: 0, w: 100, h: 100 },
      style: {},
      origin: { sourceType: 'stack' },
      children,
    };
    const ir: DepixIR = {
      meta: createMeta(),
      scenes: [{ id: 'scene-1', elements: [container] }],
      transitions: [],
    };

    const result = relayoutContainer(ir, 'stack-no-props');

    const stackContainer = findElement(
      result,
      'stack-no-props',
    ) as IRContainer;
    const childA = stackContainer.children[0];
    const childB = stackContainer.children[1];

    // Default: direction='col', gap=2
    expect(childA.bounds.y).toBe(0);
    expect(childB.bounds.y).toBe(12); // 10 + 2 default gap
  });

  it('should use default grid sourceProps when missing', () => {
    const children = [
      createShape('cell-1', { x: 0, y: 0, w: 10, h: 10 }),
      createShape('cell-2', { x: 0, y: 0, w: 10, h: 10 }),
      createShape('cell-3', { x: 0, y: 0, w: 10, h: 10 }),
    ];
    const container: IRContainer = {
      id: 'grid-no-props',
      type: 'container',
      bounds: { x: 0, y: 0, w: 100, h: 100 },
      style: {},
      origin: { sourceType: 'grid' },
      children,
    };
    const ir: DepixIR = {
      meta: createMeta(),
      scenes: [{ id: 'scene-1', elements: [container] }],
      transitions: [],
    };

    const result = relayoutContainer(ir, 'grid-no-props');

    const gridContainer = findElement(
      result,
      'grid-no-props',
    ) as IRContainer;
    // Default cols=2, so cell-3 goes to second row
    expect(gridContainer.children[2].bounds.y).toBeGreaterThan(0);
  });

  it('should return unchanged clone for non-container element ID', () => {
    const ir: DepixIR = {
      meta: createMeta(),
      scenes: [
        {
          id: 'scene-1',
          elements: [createShape('shape-1', { x: 10, y: 10, w: 20, h: 20 })],
        },
      ],
      transitions: [],
    };

    const result = relayoutContainer(ir, 'shape-1');

    const shape = findElement(result, 'shape-1') as IRShape;
    expect(shape.bounds).toEqual({ x: 10, y: 10, w: 20, h: 20 });
  });

  it('should use default flow sourceProps when missing', () => {
    const nodeA = createShape('node-a', { x: 0, y: 0, w: 10, h: 10 });
    const nodeB = createShape('node-b', { x: 0, y: 0, w: 10, h: 10 });
    const edge = createEdge('node-a', 'node-b');
    const container: IRContainer = {
      id: 'flow-no-props',
      type: 'container',
      bounds: { x: 0, y: 0, w: 100, h: 100 },
      style: {},
      origin: { sourceType: 'flow' },
      children: [nodeA, nodeB, edge],
    };
    const ir: DepixIR = {
      meta: createMeta(),
      scenes: [{ id: 'scene-1', elements: [container] }],
      transitions: [],
    };

    const result = relayoutContainer(ir, 'flow-no-props');

    const flowContainer = findElement(
      result,
      'flow-no-props',
    ) as IRContainer;
    const resultNodeA = flowContainer.children.find(
      (c) => c.id === 'node-a',
    )!;
    const resultNodeB = flowContainer.children.find(
      (c) => c.id === 'node-b',
    )!;

    // Default direction='right', so node-b should be to the right
    expect(resultNodeB.bounds.x).toBeGreaterThan(resultNodeA.bounds.x);
  });

  it('should use default layers sourceProps when missing', () => {
    const children = [
      createShape('l-1', { x: 0, y: 0, w: 50, h: 10 }),
      createShape('l-2', { x: 0, y: 0, w: 50, h: 10 }),
    ];
    const container: IRContainer = {
      id: 'layers-no-props',
      type: 'container',
      bounds: { x: 0, y: 0, w: 100, h: 100 },
      style: {},
      origin: { sourceType: 'layers' },
      children,
    };
    const ir: DepixIR = {
      meta: createMeta(),
      scenes: [{ id: 'scene-1', elements: [container] }],
      transitions: [],
    };

    const result = relayoutContainer(ir, 'layers-no-props');

    const layersContainer = findElement(
      result,
      'layers-no-props',
    ) as IRContainer;
    // Default gap=1, 2 layers: each layer height = (100 - 1) / 2 = 49.5
    expect(layersContainer.children[0].bounds.y).toBe(0);
    expect(layersContainer.children[1].bounds.y).toBeGreaterThan(0);
  });

  it('should use default group sourceProps when missing', () => {
    const children = [
      createShape('g-child', { x: 50, y: 50, w: 10, h: 10 }),
    ];
    const container: IRContainer = {
      id: 'group-no-props',
      type: 'container',
      bounds: { x: 0, y: 0, w: 100, h: 100 },
      style: {},
      origin: { sourceType: 'group' },
      children,
    };
    const ir: DepixIR = {
      meta: createMeta(),
      scenes: [{ id: 'scene-1', elements: [container] }],
      transitions: [],
    };

    const result = relayoutContainer(ir, 'group-no-props');

    const groupContainer = findElement(
      result,
      'group-no-props',
    ) as IRContainer;
    // Default padding=2, child should be inside padded area
    expect(groupContainer.children[0].bounds.y).toBeGreaterThanOrEqual(2);
  });
});
