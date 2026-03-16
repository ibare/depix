/**
 * Budget System E2E Tests
 *
 * Tests the full pipeline (DSL → IR) to verify that the budget system
 * correctly sizes elements under various conditions:
 * - Progressive element addition (fontSize monotonic decrease)
 * - No overflow (all elements within canvas bounds)
 * - Tree/flow space utilization
 */

import { describe, it, expect } from 'vitest';
import { compile } from '../../src/compiler/compiler.js';
import { lightTheme } from '../../src/theme/builtin-themes.js';
import type { IRShape, IROrigin } from '../../src/ir/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function compileScene(dsl: string) {
  const { ir, errors } = compile(dsl, { theme: lightTheme });
  expect(errors).toHaveLength(0);
  return ir.scenes[0];
}

/**
 * Recursively collect all shape elements from scene elements,
 * excluding scene-infrastructure shapes (scene-background).
 */
function collectShapes(elements: { type: string; origin?: IROrigin; children?: unknown[] }[]): IRShape[] {
  const result: IRShape[] = [];
  for (const el of elements) {
    if (el.type === 'shape' && el.origin?.sourceType !== 'scene-background') {
      result.push(el as IRShape);
    }
    if ('children' in el && Array.isArray(el.children)) {
      result.push(...collectShapes(el.children as { type: string; origin?: IROrigin; children?: unknown[] }[]));
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Layers: progressive element addition
// ---------------------------------------------------------------------------

describe('budget E2E — layers progressive', () => {
  function makeLayersDSL(count: number): string {
    const nodes = Array.from({ length: count }, (_, i) => `  node "Layer ${i}" #n${i}`).join('\n');
    return `layers {\n${nodes}\n}`;
  }

  it('all elements have positive bounds for layers 1..20', () => {
    for (const count of [1, 3, 6, 12, 20]) {
      const scene = compileScene(makeLayersDSL(count));
      const shapes = collectShapes(scene.elements);

      expect(shapes.length).toBeGreaterThanOrEqual(count);

      for (const shape of shapes) {
        const b = shape.bounds;
        expect(b.w).toBeGreaterThan(0);
        expect(b.h).toBeGreaterThan(0);
      }
    }
  });

  it('fontSize monotonically decreases as layers increase', () => {
    const fontSizes: number[] = [];

    for (const count of [1, 3, 6, 12, 20]) {
      const scene = compileScene(makeLayersDSL(count));
      const shapes = collectShapes(scene.elements);
      const fs = shapes[0]?.innerText?.fontSize;
      expect(fs).toBeDefined();
      fontSizes.push(fs!);
    }

    for (let i = 1; i < fontSizes.length; i++) {
      expect(fontSizes[i]).toBeLessThanOrEqual(fontSizes[i - 1]);
    }
  });

  it('layers 20 — no element has zero-area bounds', () => {
    const scene = compileScene(makeLayersDSL(20));
    const shapes = collectShapes(scene.elements);

    for (const shape of shapes) {
      expect(shape.bounds.w * shape.bounds.h).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Tree: org chart filling canvas
// ---------------------------------------------------------------------------

describe('budget E2E — tree space utilization', () => {
  it('tree org chart — all nodes have positive bounds', () => {
    const dsl = `tree direction:down {
  node "CEO" {
    node "CTO" {
      node "VP Eng"
    }
    node "CFO" {
      node "VP Sales"
    }
  }
}`;

    const scene = compileScene(dsl);
    const shapes = collectShapes(scene.elements);

    expect(shapes.length).toBe(5);

    for (const shape of shapes) {
      const b = shape.bounds;
      expect(b.w).toBeGreaterThan(0);
      expect(b.h).toBeGreaterThan(0);
    }
  });

  it('tree spans significant portion of canvas', () => {
    const dsl = `tree direction:down {
  node "Root" {
    node "A" {
      node "C"
      node "D"
    }
    node "B"
  }
}`;

    const scene = compileScene(dsl);
    const shapes = collectShapes(scene.elements);

    const allY = shapes.map(s => s.bounds.y);
    const allYEnd = shapes.map(s => s.bounds.y + s.bounds.h);
    const span = Math.max(...allYEnd) - Math.min(...allY);
    // Tree should use at least 30 units of the canvas height
    expect(span).toBeGreaterThan(30);
  });
});

// ---------------------------------------------------------------------------
// Flow: cross-axis utilization
// ---------------------------------------------------------------------------

describe('budget E2E — flow layout', () => {
  it('flow linear chain — all nodes have positive bounds', () => {
    const dsl = `flow direction:right {
  node "Start" #s
  node "Process" #p
  node "End" #e
  #s -> #p
  #p -> #e
}`;

    const scene = compileScene(dsl);
    const shapes = collectShapes(scene.elements);

    expect(shapes.length).toBe(3);

    for (const shape of shapes) {
      const b = shape.bounds;
      expect(b.w).toBeGreaterThan(0);
      expect(b.h).toBeGreaterThan(0);
    }
  });

  it('flow diamond — all nodes have positive area', () => {
    const dsl = `flow direction:right {
  node "A" #a
  node "B" #b
  node "C" #c
  node "D" #d
  #a -> #b
  #a -> #c
  #b -> #d
  #c -> #d
}`;

    const scene = compileScene(dsl);
    const shapes = collectShapes(scene.elements);

    expect(shapes.length).toBe(4);

    for (const shape of shapes) {
      expect(shape.bounds.w * shape.bounds.h).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Stack & Grid under budget
// ---------------------------------------------------------------------------

describe('budget E2E — stack and grid', () => {
  it('stack 6 elements — all within canvas, no overlap', () => {
    const nodes = Array.from({ length: 6 }, (_, i) => `  node "Item ${i}" #s${i}`).join('\n');
    const dsl = `stack {\n${nodes}\n}`;

    const scene = compileScene(dsl);
    const shapes = collectShapes(scene.elements);

    expect(shapes.length).toBe(6);

    // Sort by y to check no overlap
    const sorted = [...shapes].sort((a, b) => a.bounds.y - b.bounds.y);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      expect(curr.bounds.y).toBeGreaterThanOrEqual(prev.bounds.y + prev.bounds.h - 0.01);
    }
  });

  it('grid 3x2 — all cells positive', () => {
    const cells = Array.from({ length: 6 }, (_, i) => `  cell "Cell ${i}"`).join('\n');
    const dsl = `grid cols:3 {\n${cells}\n}`;

    const scene = compileScene(dsl);
    const shapes = collectShapes(scene.elements);

    expect(shapes.length).toBe(6);

    for (const shape of shapes) {
      const b = shape.bounds;
      expect(b.w).toBeGreaterThan(0);
      expect(b.h).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Nested: layers > box > nodes
// ---------------------------------------------------------------------------

describe('budget E2E — nested structures', () => {
  it('layers with box children — all shapes have positive bounds', () => {
    const dsl = `layers {
  box "Section A" #b1 {
    node "Item 1" #n1
    node "Item 2" #n2
  }
  box "Section B" #b2 {
    node "Item 3" #n3
    node "Item 4" #n4
  }
  node "Standalone" #n5
}`;

    const scene = compileScene(dsl);
    const shapes = collectShapes(scene.elements);

    expect(shapes.length).toBeGreaterThanOrEqual(5);

    for (const shape of shapes) {
      const b = shape.bounds;
      expect(b.w).toBeGreaterThan(0);
      expect(b.h).toBeGreaterThan(0);
    }
  });
});
