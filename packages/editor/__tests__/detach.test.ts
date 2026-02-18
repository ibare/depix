/**
 * Tests for semantic detach — "Remove Auto Layout" operation.
 *
 * @module @depix/editor/__tests__/detach
 */

import { describe, it, expect } from 'vitest';
import { detachFromLayout, detachAll } from '../src/detach.js';
import type { DepixIR, IRContainer, IRShape } from '@depix/core';
import { findElement } from '@depix/core';

// ---------------------------------------------------------------------------
// Test fixture helpers
// ---------------------------------------------------------------------------

function createMeta() {
  return {
    aspectRatio: { width: 16, height: 9 },
    background: { type: 'solid' as const, color: '#fff' },
    drawingStyle: 'default' as const,
  };
}

/**
 * Creates a test IR with:
 * - flow-1 container (origin: flow) with children:
 *   - n1 shape (rect)
 *   - n2 shape (rect)
 *   - nested-stack container (origin: stack) with children:
 *     - n3 shape (rect)
 *     - n4 shape (rect)
 * - standalone shape (circle)
 */
function createTestIR(): DepixIR {
  return {
    meta: createMeta(),
    scenes: [
      {
        id: 'scene-1',
        elements: [
          {
            id: 'flow-1',
            type: 'container',
            bounds: { x: 0, y: 0, w: 100, h: 100 },
            style: {},
            origin: {
              sourceType: 'flow',
              sourceProps: { direction: 'right', gap: 5 },
            },
            children: [
              {
                id: 'n1',
                type: 'shape',
                shape: 'rect',
                bounds: { x: 5, y: 20, w: 20, h: 15 },
                style: { fill: '#f00' },
              } as IRShape,
              {
                id: 'n2',
                type: 'shape',
                shape: 'rect',
                bounds: { x: 35, y: 20, w: 20, h: 15 },
                style: { fill: '#0f0' },
              } as IRShape,
              {
                id: 'nested-stack',
                type: 'container',
                bounds: { x: 65, y: 10, w: 30, h: 40 },
                style: {},
                origin: {
                  sourceType: 'stack',
                  sourceProps: { direction: 'col', gap: 2 },
                },
                children: [
                  {
                    id: 'n3',
                    type: 'shape',
                    shape: 'rect',
                    bounds: { x: 65, y: 10, w: 30, h: 18 },
                    style: {},
                  } as IRShape,
                  {
                    id: 'n4',
                    type: 'shape',
                    shape: 'rect',
                    bounds: { x: 65, y: 30, w: 30, h: 18 },
                    style: {},
                  } as IRShape,
                ],
              } as IRContainer,
            ],
          } as IRContainer,
          {
            id: 'standalone',
            type: 'shape',
            shape: 'circle',
            bounds: { x: 80, y: 80, w: 10, h: 10 },
            style: {},
          } as IRShape,
        ],
      },
    ],
    transitions: [],
  };
}

/**
 * Creates an IR with multiple scenes, each with semantic containers.
 */
function createMultiSceneIR(): DepixIR {
  return {
    meta: createMeta(),
    scenes: [
      {
        id: 'scene-1',
        elements: [
          {
            id: 'stack-s1',
            type: 'container',
            bounds: { x: 0, y: 0, w: 50, h: 50 },
            style: {},
            origin: { sourceType: 'stack', sourceProps: { direction: 'col', gap: 2 } },
            children: [
              {
                id: 'child-s1',
                type: 'shape',
                shape: 'rect',
                bounds: { x: 0, y: 0, w: 50, h: 20 },
                style: {},
              } as IRShape,
            ],
          } as IRContainer,
        ],
      },
      {
        id: 'scene-2',
        elements: [
          {
            id: 'grid-s2',
            type: 'container',
            bounds: { x: 0, y: 0, w: 80, h: 80 },
            style: {},
            origin: { sourceType: 'grid', sourceProps: { cols: 3, gap: 1 } },
            children: [
              {
                id: 'child-s2',
                type: 'shape',
                shape: 'rect',
                bounds: { x: 0, y: 0, w: 25, h: 25 },
                style: {},
              } as IRShape,
            ],
          } as IRContainer,
        ],
      },
    ],
    transitions: [],
  };
}

// ===========================================================================
// detachFromLayout — Basic detach
// ===========================================================================

describe('detachFromLayout', () => {
  describe('basic detach', () => {
    it('should remove origin from a flow container', () => {
      const ir = createTestIR();
      const result = detachFromLayout(ir, 'flow-1');

      const container = findElement(result, 'flow-1') as IRContainer;
      expect(container.origin).toBeUndefined();
    });

    it('should delete origin property entirely (not set to undefined)', () => {
      const ir = createTestIR();
      const result = detachFromLayout(ir, 'flow-1');

      const container = findElement(result, 'flow-1') as IRContainer;
      expect('origin' in container).toBe(false);
    });

    it('should preserve the container type as "container"', () => {
      const ir = createTestIR();
      const result = detachFromLayout(ir, 'flow-1');

      const container = findElement(result, 'flow-1') as IRContainer;
      expect(container.type).toBe('container');
    });

    it('should preserve the container bounds', () => {
      const ir = createTestIR();
      const result = detachFromLayout(ir, 'flow-1');

      const container = findElement(result, 'flow-1') as IRContainer;
      expect(container.bounds).toEqual({ x: 0, y: 0, w: 100, h: 100 });
    });

    it('should preserve children count', () => {
      const ir = createTestIR();
      const result = detachFromLayout(ir, 'flow-1');

      const container = findElement(result, 'flow-1') as IRContainer;
      expect(container.children).toHaveLength(3);
    });
  });

  // ===========================================================================
  // detachFromLayout — Nested containers
  // ===========================================================================

  describe('nested containers', () => {
    it('should remove origin from the parent and nested containers', () => {
      const ir = createTestIR();
      const result = detachFromLayout(ir, 'flow-1');

      const parent = findElement(result, 'flow-1') as IRContainer;
      const nested = findElement(result, 'nested-stack') as IRContainer;

      expect('origin' in parent).toBe(false);
      expect('origin' in nested).toBe(false);
    });

    it('should recursively remove origin from deeply nested containers', () => {
      // Create a 3-level deep nesting
      const ir: DepixIR = {
        meta: createMeta(),
        scenes: [
          {
            id: 'scene-1',
            elements: [
              {
                id: 'level-1',
                type: 'container',
                bounds: { x: 0, y: 0, w: 100, h: 100 },
                style: {},
                origin: { sourceType: 'flow' },
                children: [
                  {
                    id: 'level-2',
                    type: 'container',
                    bounds: { x: 0, y: 0, w: 50, h: 50 },
                    style: {},
                    origin: { sourceType: 'stack' },
                    children: [
                      {
                        id: 'level-3',
                        type: 'container',
                        bounds: { x: 0, y: 0, w: 25, h: 25 },
                        style: {},
                        origin: { sourceType: 'grid' },
                        children: [
                          {
                            id: 'leaf',
                            type: 'shape',
                            shape: 'rect',
                            bounds: { x: 0, y: 0, w: 10, h: 10 },
                            style: {},
                          } as IRShape,
                        ],
                      } as IRContainer,
                    ],
                  } as IRContainer,
                ],
              } as IRContainer,
            ],
          },
        ],
        transitions: [],
      };

      const result = detachFromLayout(ir, 'level-1');

      const l1 = findElement(result, 'level-1') as IRContainer;
      const l2 = findElement(result, 'level-2') as IRContainer;
      const l3 = findElement(result, 'level-3') as IRContainer;

      expect('origin' in l1).toBe(false);
      expect('origin' in l2).toBe(false);
      expect('origin' in l3).toBe(false);
    });

    it('should retain bounds of children in nested containers', () => {
      const ir = createTestIR();
      const result = detachFromLayout(ir, 'flow-1');

      const n3 = findElement(result, 'n3')!;
      const n4 = findElement(result, 'n4')!;

      expect(n3.bounds).toEqual({ x: 65, y: 10, w: 30, h: 18 });
      expect(n4.bounds).toEqual({ x: 65, y: 30, w: 30, h: 18 });
    });
  });

  // ===========================================================================
  // detachFromLayout — Immutability
  // ===========================================================================

  describe('immutability', () => {
    it('should not mutate the original IR', () => {
      const ir = createTestIR();
      const original = structuredClone(ir);

      detachFromLayout(ir, 'flow-1');

      expect(ir).toEqual(original);
    });

    it('should return a different reference from the original IR', () => {
      const ir = createTestIR();
      const result = detachFromLayout(ir, 'flow-1');

      expect(result).not.toBe(ir);
    });

    it('should not share nested object references with original', () => {
      const ir = createTestIR();
      const result = detachFromLayout(ir, 'flow-1');

      const originalContainer = findElement(ir, 'flow-1') as IRContainer;
      const resultContainer = findElement(result, 'flow-1') as IRContainer;

      expect(resultContainer).not.toBe(originalContainer);
      expect(resultContainer.children).not.toBe(originalContainer.children);
    });
  });

  // ===========================================================================
  // detachFromLayout — No-op cases
  // ===========================================================================

  describe('no-op cases', () => {
    it('should return same IR reference when container is not found', () => {
      const ir = createTestIR();
      const result = detachFromLayout(ir, 'nonexistent');

      expect(result).toBe(ir);
    });

    it('should return same IR reference when element has no origin', () => {
      const ir: DepixIR = {
        meta: createMeta(),
        scenes: [
          {
            id: 'scene-1',
            elements: [
              {
                id: 'plain-container',
                type: 'container',
                bounds: { x: 0, y: 0, w: 50, h: 50 },
                style: {},
                children: [],
              } as IRContainer,
            ],
          },
        ],
        transitions: [],
      };

      const result = detachFromLayout(ir, 'plain-container');

      expect(result).toBe(ir);
    });

    it('should return same IR reference for a non-container element ID', () => {
      const ir = createTestIR();
      const result = detachFromLayout(ir, 'standalone');

      expect(result).toBe(ir);
    });

    it('should return same IR reference for an already detached container', () => {
      const ir = createTestIR();

      // First detach
      const detached = detachFromLayout(ir, 'flow-1');

      // Second detach — should be a no-op (same reference returned)
      const result = detachFromLayout(detached, 'flow-1');

      expect(result).toBe(detached);
    });
  });

  // ===========================================================================
  // detachFromLayout — Children position preservation
  // ===========================================================================

  describe('children position preservation', () => {
    it('should preserve all child bounds exactly after detach', () => {
      const ir = createTestIR();
      const result = detachFromLayout(ir, 'flow-1');

      const n1 = findElement(result, 'n1')!;
      const n2 = findElement(result, 'n2')!;

      expect(n1.bounds).toEqual({ x: 5, y: 20, w: 20, h: 15 });
      expect(n2.bounds).toEqual({ x: 35, y: 20, w: 20, h: 15 });
    });

    it('should preserve nested grandchild bounds', () => {
      const ir = createTestIR();
      const result = detachFromLayout(ir, 'flow-1');

      const n3 = findElement(result, 'n3')!;
      const n4 = findElement(result, 'n4')!;
      const nestedStack = findElement(result, 'nested-stack')!;

      expect(nestedStack.bounds).toEqual({ x: 65, y: 10, w: 30, h: 40 });
      expect(n3.bounds).toEqual({ x: 65, y: 10, w: 30, h: 18 });
      expect(n4.bounds).toEqual({ x: 65, y: 30, w: 30, h: 18 });
    });

    it('should preserve style properties on children', () => {
      const ir = createTestIR();
      const result = detachFromLayout(ir, 'flow-1');

      const n1 = findElement(result, 'n1') as IRShape;
      const n2 = findElement(result, 'n2') as IRShape;

      expect(n1.style).toEqual({ fill: '#f00' });
      expect(n2.style).toEqual({ fill: '#0f0' });
    });
  });

  // ===========================================================================
  // detachFromLayout — Detaching only nested container
  // ===========================================================================

  describe('detaching nested container only', () => {
    it('should only remove origin from the targeted nested container', () => {
      const ir = createTestIR();
      const result = detachFromLayout(ir, 'nested-stack');

      // Parent should still have origin
      const parent = findElement(result, 'flow-1') as IRContainer;
      expect(parent.origin).toBeDefined();
      expect(parent.origin!.sourceType).toBe('flow');

      // Nested container should not have origin
      const nested = findElement(result, 'nested-stack') as IRContainer;
      expect('origin' in nested).toBe(false);
    });
  });
});

// ===========================================================================
// detachAll
// ===========================================================================

describe('detachAll', () => {
  describe('basic behavior', () => {
    it('should remove origin from all containers', () => {
      const ir = createTestIR();
      const result = detachAll(ir);

      const flow = findElement(result, 'flow-1') as IRContainer;
      const nested = findElement(result, 'nested-stack') as IRContainer;

      expect('origin' in flow).toBe(false);
      expect('origin' in nested).toBe(false);
    });

    it('should not affect non-container elements', () => {
      const ir = createTestIR();
      const result = detachAll(ir);

      const standalone = findElement(result, 'standalone') as IRShape;
      expect(standalone.type).toBe('shape');
      expect(standalone.bounds).toEqual({ x: 80, y: 80, w: 10, h: 10 });
    });

    it('should handle multiple containers across different scenes', () => {
      const ir = createMultiSceneIR();
      const result = detachAll(ir);

      const stack = findElement(result, 'stack-s1') as IRContainer;
      const grid = findElement(result, 'grid-s2') as IRContainer;

      expect('origin' in stack).toBe(false);
      expect('origin' in grid).toBe(false);
    });
  });

  describe('immutability', () => {
    it('should not mutate the original IR', () => {
      const ir = createTestIR();
      const original = structuredClone(ir);

      detachAll(ir);

      expect(ir).toEqual(original);
    });

    it('should return a different reference from the original IR', () => {
      const ir = createTestIR();
      const result = detachAll(ir);

      expect(result).not.toBe(ir);
    });
  });

  describe('edge cases', () => {
    it('should return a clone for IR with no semantic containers', () => {
      const ir: DepixIR = {
        meta: createMeta(),
        scenes: [
          {
            id: 'scene-1',
            elements: [
              {
                id: 'plain',
                type: 'container',
                bounds: { x: 0, y: 0, w: 50, h: 50 },
                style: {},
                children: [],
              } as IRContainer,
            ],
          },
        ],
        transitions: [],
      };

      const result = detachAll(ir);

      // Should still be a new reference (clone is always made)
      expect(result).not.toBe(ir);
      // And the plain container should remain without origin
      const plain = findElement(result, 'plain') as IRContainer;
      expect('origin' in plain).toBe(false);
    });

    it('should handle empty scenes', () => {
      const ir: DepixIR = {
        meta: createMeta(),
        scenes: [
          { id: 'scene-empty', elements: [] },
        ],
        transitions: [],
      };

      const result = detachAll(ir);

      expect(result).not.toBe(ir);
      expect(result.scenes[0].elements).toHaveLength(0);
    });

    it('should preserve all child bounds after detachAll', () => {
      const ir = createTestIR();
      const result = detachAll(ir);

      const n1 = findElement(result, 'n1')!;
      const n2 = findElement(result, 'n2')!;
      const n3 = findElement(result, 'n3')!;
      const n4 = findElement(result, 'n4')!;

      expect(n1.bounds).toEqual({ x: 5, y: 20, w: 20, h: 15 });
      expect(n2.bounds).toEqual({ x: 35, y: 20, w: 20, h: 15 });
      expect(n3.bounds).toEqual({ x: 65, y: 10, w: 30, h: 18 });
      expect(n4.bounds).toEqual({ x: 65, y: 30, w: 30, h: 18 });
    });
  });
});
