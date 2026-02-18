/**
 * Tests for IR operations — the primitive editing operations.
 *
 * @module @depix/editor/__tests__/ir-operations
 */

import { describe, it, expect } from 'vitest';
import type {
  DepixIR,
  IRShape,
  IRText,
  IREdge,
  IRContainer,
  IRElement,
} from '@depix/core';
import { findElement } from '@depix/core';
import {
  moveElement,
  resizeElement,
  addElement,
  removeElement,
  updateStyle,
  updateText,
  reorderElements,
} from '../src/ir-operations.js';
import {
  recalculateEdge,
  recalculateConnectedEdges,
} from '../src/ir-edge-operations.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function createTestIR(): DepixIR {
  return {
    meta: {
      aspectRatio: { width: 16, height: 9 },
      background: { type: 'solid', color: '#ffffff' },
      drawingStyle: 'default',
    },
    scenes: [
      {
        id: 'scene-1',
        elements: [
          {
            id: 'shape-1',
            type: 'shape',
            shape: 'rect',
            bounds: { x: 10, y: 10, w: 20, h: 15 },
            style: { fill: '#ff0000', strokeWidth: 2 },
          } as IRShape,
          {
            id: 'shape-2',
            type: 'shape',
            shape: 'circle',
            bounds: { x: 50, y: 50, w: 20, h: 20 },
            style: { fill: '#00ff00' },
          } as IRShape,
          {
            id: 'text-1',
            type: 'text',
            content: 'Hello',
            fontSize: 16,
            color: '#000000',
            bounds: { x: 30, y: 30, w: 40, h: 10 },
            style: {},
          } as IRText,
        ],
      },
    ],
    transitions: [],
  };
}

function createIRWithContainer(): DepixIR {
  return {
    meta: {
      aspectRatio: { width: 16, height: 9 },
      background: { type: 'solid', color: '#ffffff' },
      drawingStyle: 'default',
    },
    scenes: [
      {
        id: 'scene-1',
        elements: [
          {
            id: 'container-1',
            type: 'container',
            bounds: { x: 5, y: 5, w: 40, h: 30 },
            style: {},
            children: [
              {
                id: 'child-1',
                type: 'shape',
                shape: 'rect',
                bounds: { x: 10, y: 10, w: 15, h: 10 },
                style: { fill: '#aaaaaa' },
              } as IRShape,
              {
                id: 'child-2',
                type: 'shape',
                shape: 'circle',
                bounds: { x: 25, y: 10, w: 10, h: 10 },
                style: { fill: '#bbbbbb' },
              } as IRShape,
            ],
          } as IRContainer,
          {
            id: 'shape-outer',
            type: 'shape',
            shape: 'rect',
            bounds: { x: 60, y: 60, w: 10, h: 10 },
            style: { fill: '#cccccc' },
          } as IRShape,
        ],
      },
    ],
    transitions: [],
  };
}

function createIRWithEdges(): DepixIR {
  return {
    meta: {
      aspectRatio: { width: 16, height: 9 },
      background: { type: 'solid', color: '#ffffff' },
      drawingStyle: 'default',
    },
    scenes: [
      {
        id: 'scene-1',
        elements: [
          {
            id: 'node-a',
            type: 'shape',
            shape: 'rect',
            bounds: { x: 10, y: 10, w: 20, h: 15 },
            style: { fill: '#ff0000' },
          } as IRShape,
          {
            id: 'node-b',
            type: 'shape',
            shape: 'rect',
            bounds: { x: 60, y: 10, w: 20, h: 15 },
            style: { fill: '#00ff00' },
          } as IRShape,
          {
            id: 'node-c',
            type: 'shape',
            shape: 'circle',
            bounds: { x: 35, y: 50, w: 20, h: 20 },
            style: { fill: '#0000ff' },
          } as IRShape,
          {
            id: 'edge-ab',
            type: 'edge',
            bounds: { x: 30, y: 17, w: 30, h: 1 },
            style: { stroke: '#333333', strokeWidth: 0.3 },
            fromId: 'node-a',
            toId: 'node-b',
            fromAnchor: { x: 30, y: 17.5 },
            toAnchor: { x: 60, y: 17.5 },
            path: { type: 'straight' },
            arrowEnd: 'triangle',
          } as IREdge,
          {
            id: 'edge-ac',
            type: 'edge',
            bounds: { x: 20, y: 25, w: 25, h: 25 },
            style: { stroke: '#333333', strokeWidth: 0.3, dashPattern: [4, 3] },
            fromId: 'node-a',
            toId: 'node-c',
            fromAnchor: { x: 20, y: 25 },
            toAnchor: { x: 45, y: 50 },
            path: { type: 'bezier', controlPoints: [{ cp1: { x: 25, y: 30 }, cp2: { x: 40, y: 45 }, end: { x: 45, y: 50 } }] },
            arrowEnd: 'triangle',
          } as IREdge,
          {
            id: 'edge-bc',
            type: 'edge',
            bounds: { x: 55, y: 25, w: 25, h: 25 },
            style: { stroke: '#333333', strokeWidth: 0.3 },
            fromId: 'node-b',
            toId: 'node-c',
            fromAnchor: { x: 70, y: 25 },
            toAnchor: { x: 55, y: 50 },
            path: { type: 'straight' },
          } as IREdge,
        ],
      },
    ],
    transitions: [],
  };
}

function createIRWithInnerText(): DepixIR {
  return {
    meta: {
      aspectRatio: { width: 16, height: 9 },
      background: { type: 'solid', color: '#ffffff' },
      drawingStyle: 'default',
    },
    scenes: [
      {
        id: 'scene-1',
        elements: [
          {
            id: 'shape-with-text',
            type: 'shape',
            shape: 'rect',
            bounds: { x: 10, y: 10, w: 30, h: 20 },
            style: { fill: '#ff0000' },
            innerText: {
              content: 'Original',
              color: '#000000',
              fontSize: 14,
            },
          } as IRShape,
          {
            id: 'shape-no-text',
            type: 'shape',
            shape: 'circle',
            bounds: { x: 50, y: 50, w: 20, h: 20 },
            style: { fill: '#00ff00' },
          } as IRShape,
        ],
      },
    ],
    transitions: [],
  };
}

// ===========================================================================
// moveElement
// ===========================================================================

describe('moveElement', () => {
  it('should update bounds by the given delta', () => {
    const ir = createTestIR();
    const result = moveElement(ir, 'shape-1', 5, 3);

    const el = findElement(result, 'shape-1') as IRShape;
    expect(el.bounds).toEqual({ x: 15, y: 13, w: 20, h: 15 });
  });

  it('should not mutate the original IR', () => {
    const ir = createTestIR();
    const original = structuredClone(ir);
    moveElement(ir, 'shape-1', 5, 3);

    expect(ir).toEqual(original);
  });

  it('should move container children recursively', () => {
    const ir = createIRWithContainer();
    const result = moveElement(ir, 'container-1', 10, 5);

    const container = findElement(result, 'container-1') as IRContainer;
    expect(container.bounds).toEqual({ x: 15, y: 10, w: 40, h: 30 });

    const child1 = findElement(result, 'child-1') as IRShape;
    expect(child1.bounds).toEqual({ x: 20, y: 15, w: 15, h: 10 });

    const child2 = findElement(result, 'child-2') as IRShape;
    expect(child2.bounds).toEqual({ x: 35, y: 15, w: 10, h: 10 });
  });

  it('should handle negative deltas', () => {
    const ir = createTestIR();
    const result = moveElement(ir, 'shape-1', -5, -3);

    const el = findElement(result, 'shape-1') as IRShape;
    expect(el.bounds).toEqual({ x: 5, y: 7, w: 20, h: 15 });
  });

  it('should handle zero delta (no-op)', () => {
    const ir = createTestIR();
    const result = moveElement(ir, 'shape-1', 0, 0);

    const el = findElement(result, 'shape-1') as IRShape;
    expect(el.bounds).toEqual({ x: 10, y: 10, w: 20, h: 15 });
  });

  it('should return unchanged clone when element is not found', () => {
    const ir = createTestIR();
    const result = moveElement(ir, 'nonexistent', 5, 3);

    // The result should still be a valid clone (different reference)
    expect(result).not.toBe(ir);
    expect(result.scenes[0].elements).toHaveLength(3);
  });

  it('should not affect other elements when moving one', () => {
    const ir = createTestIR();
    const result = moveElement(ir, 'shape-1', 5, 3);

    const shape2 = findElement(result, 'shape-2') as IRShape;
    expect(shape2.bounds).toEqual({ x: 50, y: 50, w: 20, h: 20 });
  });
});

// ===========================================================================
// resizeElement
// ===========================================================================

describe('resizeElement', () => {
  it('should update bounds to new values', () => {
    const ir = createTestIR();
    const result = resizeElement(ir, 'shape-1', { x: 5, y: 5, w: 30, h: 25 });

    const el = findElement(result, 'shape-1') as IRShape;
    expect(el.bounds).toEqual({ x: 5, y: 5, w: 30, h: 25 });
  });

  it('should not mutate the original IR', () => {
    const ir = createTestIR();
    const original = structuredClone(ir);
    resizeElement(ir, 'shape-1', { x: 5, y: 5, w: 30, h: 25 });

    expect(ir).toEqual(original);
  });

  it('should enforce minimum size of 1x1', () => {
    const ir = createTestIR();
    const result = resizeElement(ir, 'shape-1', { x: 10, y: 10, w: 0, h: -5 });

    const el = findElement(result, 'shape-1') as IRShape;
    expect(el.bounds.w).toBe(1);
    expect(el.bounds.h).toBe(1);
  });

  it('should enforce minimum size when exactly zero', () => {
    const ir = createTestIR();
    const result = resizeElement(ir, 'shape-1', { x: 10, y: 10, w: 0.5, h: 0.5 });

    const el = findElement(result, 'shape-1') as IRShape;
    // 0.5 < 1, so clamped to 1
    expect(el.bounds.w).toBe(1);
    expect(el.bounds.h).toBe(1);
  });

  it('should return unchanged clone when element is not found', () => {
    const ir = createTestIR();
    const result = resizeElement(ir, 'nonexistent', { x: 0, y: 0, w: 10, h: 10 });

    expect(result).not.toBe(ir);
    expect(result.scenes[0].elements).toHaveLength(3);
  });
});

// ===========================================================================
// addElement
// ===========================================================================

describe('addElement', () => {
  it('should add element to scene top-level', () => {
    const ir = createTestIR();
    const newEl: IRShape = {
      id: 'new-shape',
      type: 'shape',
      shape: 'diamond',
      bounds: { x: 80, y: 80, w: 10, h: 10 },
      style: { fill: '#0000ff' },
    };

    const result = addElement(ir, 'scene-1', newEl);

    expect(result.scenes[0].elements).toHaveLength(4);
    const found = findElement(result, 'new-shape') as IRShape;
    expect(found).toBeDefined();
    expect(found.shape).toBe('diamond');
  });

  it('should add element as child of a container', () => {
    const ir = createIRWithContainer();
    const newEl: IRShape = {
      id: 'new-child',
      type: 'shape',
      shape: 'ellipse',
      bounds: { x: 15, y: 20, w: 8, h: 6 },
      style: { fill: '#dddddd' },
    };

    const result = addElement(ir, 'scene-1', newEl, 'container-1');

    const container = findElement(result, 'container-1') as IRContainer;
    expect(container.children).toHaveLength(3);
    expect(container.children[2].id).toBe('new-child');
  });

  it('should not mutate the original IR', () => {
    const ir = createTestIR();
    const original = structuredClone(ir);
    const newEl: IRShape = {
      id: 'new-shape',
      type: 'shape',
      shape: 'rect',
      bounds: { x: 0, y: 0, w: 10, h: 10 },
      style: {},
    };

    addElement(ir, 'scene-1', newEl);

    expect(ir).toEqual(original);
  });

  it('should be findable after adding', () => {
    const ir = createTestIR();
    const newEl: IRText = {
      id: 'new-text',
      type: 'text',
      content: 'New text',
      fontSize: 12,
      color: '#333',
      bounds: { x: 0, y: 0, w: 20, h: 5 },
      style: {},
    };

    const result = addElement(ir, 'scene-1', newEl);
    const found = findElement(result, 'new-text');

    expect(found).toBeDefined();
    expect(found!.type).toBe('text');
  });

  it('should return unchanged clone when scene is not found', () => {
    const ir = createTestIR();
    const newEl: IRShape = {
      id: 'new-shape',
      type: 'shape',
      shape: 'rect',
      bounds: { x: 0, y: 0, w: 10, h: 10 },
      style: {},
    };

    const result = addElement(ir, 'nonexistent-scene', newEl);

    expect(result.scenes[0].elements).toHaveLength(3);
  });
});

// ===========================================================================
// removeElement
// ===========================================================================

describe('removeElement', () => {
  it('should remove a top-level element', () => {
    const ir = createTestIR();
    const result = removeElement(ir, 'shape-1');

    expect(result.scenes[0].elements).toHaveLength(2);
    expect(findElement(result, 'shape-1')).toBeUndefined();
  });

  it('should not mutate the original IR', () => {
    const ir = createTestIR();
    const original = structuredClone(ir);
    removeElement(ir, 'shape-1');

    expect(ir).toEqual(original);
  });

  it('should remove element with connected edges also removing those edges', () => {
    const ir = createIRWithEdges();
    // Remove node-a: should also remove edge-ab and edge-ac
    const result = removeElement(ir, 'node-a');

    expect(findElement(result, 'node-a')).toBeUndefined();
    expect(findElement(result, 'edge-ab')).toBeUndefined();
    expect(findElement(result, 'edge-ac')).toBeUndefined();
    // edge-bc should remain (connects node-b to node-c)
    expect(findElement(result, 'edge-bc')).toBeDefined();
    // node-b and node-c should remain
    expect(findElement(result, 'node-b')).toBeDefined();
    expect(findElement(result, 'node-c')).toBeDefined();
  });

  it('should remove element from nested container', () => {
    const ir = createIRWithContainer();
    const result = removeElement(ir, 'child-1');

    const container = findElement(result, 'container-1') as IRContainer;
    expect(container.children).toHaveLength(1);
    expect(container.children[0].id).toBe('child-2');
    expect(findElement(result, 'child-1')).toBeUndefined();
  });

  it('should return unchanged clone when element is not found', () => {
    const ir = createTestIR();
    const result = removeElement(ir, 'nonexistent');

    expect(result).not.toBe(ir);
    expect(result.scenes[0].elements).toHaveLength(3);
  });

  it('should remove a container and all its children', () => {
    const ir = createIRWithContainer();
    const result = removeElement(ir, 'container-1');

    expect(findElement(result, 'container-1')).toBeUndefined();
    expect(findElement(result, 'child-1')).toBeUndefined();
    expect(findElement(result, 'child-2')).toBeUndefined();
    // shape-outer should remain
    expect(findElement(result, 'shape-outer')).toBeDefined();
    expect(result.scenes[0].elements).toHaveLength(1);
  });
});

// ===========================================================================
// updateStyle
// ===========================================================================

describe('updateStyle', () => {
  it('should merge partial style preserving existing properties', () => {
    const ir = createTestIR();
    const result = updateStyle(ir, 'shape-1', { stroke: '#000000' });

    const el = findElement(result, 'shape-1') as IRShape;
    expect(el.style.fill).toBe('#ff0000');
    expect(el.style.strokeWidth).toBe(2);
    expect(el.style.stroke).toBe('#000000');
  });

  it('should not mutate the original IR', () => {
    const ir = createTestIR();
    const original = structuredClone(ir);
    updateStyle(ir, 'shape-1', { stroke: '#000000' });

    expect(ir).toEqual(original);
  });

  it('should add a new property that did not exist', () => {
    const ir = createTestIR();
    const result = updateStyle(ir, 'shape-2', { shadow: { offsetX: 2, offsetY: 2, blur: 4, color: '#00000088' } });

    const el = findElement(result, 'shape-2') as IRShape;
    expect(el.style.shadow).toEqual({ offsetX: 2, offsetY: 2, blur: 4, color: '#00000088' });
  });

  it('should overwrite an existing property', () => {
    const ir = createTestIR();
    const result = updateStyle(ir, 'shape-1', { fill: '#0000ff' });

    const el = findElement(result, 'shape-1') as IRShape;
    expect(el.style.fill).toBe('#0000ff');
  });

  it('should return unchanged clone when element is not found', () => {
    const ir = createTestIR();
    const result = updateStyle(ir, 'nonexistent', { fill: '#0000ff' });

    expect(result).not.toBe(ir);
    expect(result.scenes[0].elements).toHaveLength(3);
  });
});

// ===========================================================================
// updateText
// ===========================================================================

describe('updateText', () => {
  it('should update IRText content', () => {
    const ir = createTestIR();
    const result = updateText(ir, 'text-1', 'World');

    const el = findElement(result, 'text-1') as IRText;
    expect(el.content).toBe('World');
  });

  it('should not mutate the original IR', () => {
    const ir = createTestIR();
    const original = structuredClone(ir);
    updateText(ir, 'text-1', 'World');

    expect(ir).toEqual(original);
  });

  it('should update IRShape innerText content', () => {
    const ir = createIRWithInnerText();
    const result = updateText(ir, 'shape-with-text', 'Updated');

    const el = findElement(result, 'shape-with-text') as IRShape;
    expect(el.innerText!.content).toBe('Updated');
  });

  it('should not change a shape without innerText', () => {
    const ir = createIRWithInnerText();
    const result = updateText(ir, 'shape-no-text', 'Attempt');

    const el = findElement(result, 'shape-no-text') as IRShape;
    expect(el.innerText).toBeUndefined();
  });

  it('should return unchanged clone when element is not found', () => {
    const ir = createTestIR();
    const result = updateText(ir, 'nonexistent', 'Text');

    expect(result).not.toBe(ir);
    expect(result.scenes[0].elements).toHaveLength(3);
  });

  it('should not change a non-text, non-shape element', () => {
    const ir = createIRWithEdges();
    const result = updateText(ir, 'edge-ab', 'Should not change');

    const edge = findElement(result, 'edge-ab') as IREdge;
    // Edge should remain unchanged
    expect(edge.type).toBe('edge');
  });
});

// ===========================================================================
// reorderElements
// ===========================================================================

describe('reorderElements', () => {
  it('should reorder elements to match the given ID order', () => {
    const ir = createTestIR();
    const result = reorderElements(ir, 'scene-1', ['text-1', 'shape-2', 'shape-1']);

    const ids = result.scenes[0].elements.map((el) => el.id);
    expect(ids).toEqual(['text-1', 'shape-2', 'shape-1']);
  });

  it('should not mutate the original IR', () => {
    const ir = createTestIR();
    const original = structuredClone(ir);
    reorderElements(ir, 'scene-1', ['text-1', 'shape-2', 'shape-1']);

    expect(ir).toEqual(original);
  });

  it('should handle partial list — unlisted elements come after', () => {
    const ir = createTestIR();
    // Only specify shape-2, the rest come after in original relative order
    const result = reorderElements(ir, 'scene-1', ['shape-2']);

    const ids = result.scenes[0].elements.map((el) => el.id);
    expect(ids).toEqual(['shape-2', 'shape-1', 'text-1']);
  });

  it('should handle empty list — original order preserved', () => {
    const ir = createTestIR();
    const result = reorderElements(ir, 'scene-1', []);

    const ids = result.scenes[0].elements.map((el) => el.id);
    expect(ids).toEqual(['shape-1', 'shape-2', 'text-1']);
  });

  it('should return unchanged clone when scene is not found', () => {
    const ir = createTestIR();
    const result = reorderElements(ir, 'nonexistent', ['shape-1']);

    expect(result).not.toBe(ir);
    expect(result.scenes[0].elements).toHaveLength(3);
  });
});

// ===========================================================================
// recalculateEdge
// ===========================================================================

describe('recalculateEdge', () => {
  it('should recalculate edge path after an element is moved', () => {
    let ir = createIRWithEdges();
    // Move node-b to a new position
    ir = moveElement(ir, 'node-b', 10, 20);
    // Recalculate edge-ab
    const result = recalculateEdge(ir, 'edge-ab');

    const edge = findElement(result, 'edge-ab') as IREdge;
    // The edge should still connect node-a and node-b
    expect(edge.fromId).toBe('node-a');
    expect(edge.toId).toBe('node-b');
    // The anchors should be recalculated (not the same as the original)
    // Since node-b moved, the toAnchor should reflect the new position
    expect(edge.type).toBe('edge');
    // Verify the edge still has the arrow (->)
    expect(edge.arrowEnd).toBe('triangle');
  });

  it('should preserve edge ID after recalculation', () => {
    let ir = createIRWithEdges();
    ir = moveElement(ir, 'node-b', 10, 20);
    const result = recalculateEdge(ir, 'edge-ab');

    const edge = findElement(result, 'edge-ab') as IREdge;
    expect(edge.id).toBe('edge-ab');
  });

  it('should return unchanged clone when edge is not found', () => {
    const ir = createIRWithEdges();
    const result = recalculateEdge(ir, 'nonexistent');

    expect(result).not.toBe(ir);
    // All original elements should still exist
    expect(findElement(result, 'edge-ab')).toBeDefined();
  });

  it('should return unchanged clone when edge source is missing', () => {
    // Create IR with an edge whose source does not exist
    const ir: DepixIR = {
      meta: {
        aspectRatio: { width: 16, height: 9 },
        background: { type: 'solid', color: '#ffffff' },
        drawingStyle: 'default',
      },
      scenes: [{
        id: 'scene-1',
        elements: [
          {
            id: 'orphan-edge',
            type: 'edge',
            bounds: { x: 0, y: 0, w: 10, h: 10 },
            style: { stroke: '#333' },
            fromId: 'deleted-node',
            toId: 'node-x',
            fromAnchor: { x: 0, y: 0 },
            toAnchor: { x: 10, y: 10 },
            path: { type: 'straight' },
          } as IREdge,
        ],
      }],
      transitions: [],
    };

    const result = recalculateEdge(ir, 'orphan-edge');
    // Should return clone without error
    expect(result).not.toBe(ir);
  });

  it('should infer dashed style for --> edges', () => {
    let ir = createIRWithEdges();
    // edge-ac has dashPattern, so it should be inferred as '-->'
    ir = moveElement(ir, 'node-c', 5, 5);
    const result = recalculateEdge(ir, 'edge-ac');

    const edge = findElement(result, 'edge-ac') as IREdge;
    expect(edge.arrowEnd).toBe('triangle');
    expect(edge.style.dashPattern).toBeDefined();
    expect(edge.style.dashPattern!.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// recalculateConnectedEdges
// ===========================================================================

describe('recalculateConnectedEdges', () => {
  it('should recalculate all edges connected to an element', () => {
    let ir = createIRWithEdges();
    // Move node-a and recalculate all connected edges
    ir = moveElement(ir, 'node-a', 15, 10);
    const result = recalculateConnectedEdges(ir, 'node-a');

    // edge-ab and edge-ac should be recalculated
    const edgeAB = findElement(result, 'edge-ab') as IREdge;
    const edgeAC = findElement(result, 'edge-ac') as IREdge;

    expect(edgeAB).toBeDefined();
    expect(edgeAC).toBeDefined();
    expect(edgeAB.fromId).toBe('node-a');
    expect(edgeAC.fromId).toBe('node-a');
  });

  it('should not affect unconnected edges', () => {
    let ir = createIRWithEdges();
    ir = moveElement(ir, 'node-a', 15, 10);

    // Save edge-bc before recalculation
    const edgeBCBefore = findElement(ir, 'edge-bc') as IREdge;
    const beforeAnchors = { from: { ...edgeBCBefore.fromAnchor }, to: { ...edgeBCBefore.toAnchor } };

    const result = recalculateConnectedEdges(ir, 'node-a');

    const edgeBC = findElement(result, 'edge-bc') as IREdge;
    // edge-bc connects node-b to node-c, should not be affected by moving node-a
    expect(edgeBC.fromAnchor).toEqual(beforeAnchors.from);
    expect(edgeBC.toAnchor).toEqual(beforeAnchors.to);
  });

  it('should handle element with no connected edges', () => {
    const ir = createTestIR();
    // shape-1 has no edges in the basic test IR
    const result = recalculateConnectedEdges(ir, 'shape-1');

    expect(result).not.toBe(ir);
    // All elements should remain unchanged
    expect(result.scenes[0].elements).toHaveLength(3);
  });

  it('should handle multiple edges from and to the same element', () => {
    let ir = createIRWithEdges();
    // node-c is connected to both edge-ac and edge-bc
    ir = moveElement(ir, 'node-c', -5, -5);
    const result = recalculateConnectedEdges(ir, 'node-c');

    const edgeAC = findElement(result, 'edge-ac') as IREdge;
    const edgeBC = findElement(result, 'edge-bc') as IREdge;

    expect(edgeAC).toBeDefined();
    expect(edgeBC).toBeDefined();
    // Both edges should still reference node-c
    expect(edgeAC.toId).toBe('node-c');
    expect(edgeBC.toId).toBe('node-c');
  });
});

// ===========================================================================
// Integration: move + recalculate
// ===========================================================================

describe('integration: move + recalculate edges', () => {
  it('should correctly chain moveElement and recalculateConnectedEdges', () => {
    const ir = createIRWithEdges();

    // Move node-a
    const moved = moveElement(ir, 'node-a', 20, 0);
    // Recalculate connected edges
    const result = recalculateConnectedEdges(moved, 'node-a');

    // node-a should be at new position
    const nodeA = findElement(result, 'node-a') as IRShape;
    expect(nodeA.bounds.x).toBe(30); // 10 + 20

    // edge-ab should be recalculated
    const edgeAB = findElement(result, 'edge-ab') as IREdge;
    expect(edgeAB).toBeDefined();
    expect(edgeAB.fromId).toBe('node-a');
    expect(edgeAB.toId).toBe('node-b');
  });
});
