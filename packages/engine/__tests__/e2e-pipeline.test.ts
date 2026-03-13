/**
 * E2E Pipeline Tests
 *
 * Tests the full pipeline: DSL source → compile → DepixIR → Konva render.
 * These tests verify that the entire system works end-to-end, from
 * text input to rendered visual nodes.
 */

import { describe, it, expect } from 'vitest';
import Konva from 'konva';
import { compile, lightTheme, darkTheme } from '@depix/core';
import type { IRContainer, IRShape, IREdge as IREdgeType, IRText, DepixIR } from '@depix/core';
import { renderElement, renderElements } from '../src/ir-renderer/index.js';
import { CoordinateTransform } from '../src/coordinate-transform.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function compileAndRender(dsl: string, theme = lightTheme) {
  const { ir, errors } = compile(dsl, { theme });
  const transform = new CoordinateTransform(
    { width: 1600, height: 900 },
    ir.meta.aspectRatio,
  );
  return { ir, errors, transform };
}

function renderScene(ir: DepixIR, sceneIndex: number, transform: CoordinateTransform) {
  const scene = ir.scenes[sceneIndex];
  if (!scene) return new Konva.Group();
  return renderElements(scene.elements, transform);
}

function collectNodes(group: Konva.Group): Konva.Node[] {
  const nodes: Konva.Node[] = [];
  group.getChildren().forEach(child => {
    nodes.push(child);
    if (child instanceof Konva.Group) {
      nodes.push(...collectNodes(child));
    }
  });
  return nodes;
}

// ---------------------------------------------------------------------------
// Basic pipeline
// ---------------------------------------------------------------------------

describe('E2E — basic pipeline', () => {
  it('compiles and renders a single node', () => {
    const { ir, errors, transform } = compileAndRender('node "Hello" #n1');

    expect(errors).toHaveLength(0);
    expect(ir.scenes.length).toBeGreaterThanOrEqual(1);

    const group = renderScene(ir, 0, transform);
    expect(group).toBeInstanceOf(Konva.Group);
    expect(group.getChildren().length).toBeGreaterThan(0);
  });

  it('produces Konva nodes with correct element structure', () => {
    const { ir, transform } = compileAndRender('node "World" #n1');
    const scene = ir.scenes[0];
    const el = scene.elements.find(e => e.id === 'n1');

    expect(el).toBeDefined();
    expect(el!.type).toBe('shape');

    const node = renderElement(el!, transform);
    expect(node).toBeInstanceOf(Konva.Group);
  });

  it('renders node with inner text', () => {
    const { ir, transform } = compileAndRender('node "Test Label" #n1');
    const el = ir.scenes[0].elements.find(e => e.id === 'n1') as IRShape;

    expect(el.innerText).toBeDefined();
    expect(el.innerText!.content).toBe('Test Label');

    const rendered = renderElement(el, transform) as Konva.Group;
    const textNodes = rendered.getChildren().filter(c => c instanceof Konva.Text);
    expect(textNodes.length).toBeGreaterThanOrEqual(1);
    expect((textNodes[0] as Konva.Text).text()).toBe('Test Label');
  });
});

// ---------------------------------------------------------------------------
// Layout blocks
// ---------------------------------------------------------------------------

describe('E2E — stack layout', () => {
  it('compiles and renders stack layout', () => {
    const dsl = `
stack direction:col gap:3 {
  node "A" #a
  node "B" #b
  node "C" #c
}`;
    const { ir, transform } = compileAndRender(dsl);
    const container = ir.scenes[0].elements[0] as IRContainer;

    expect(container.type).toBe('container');
    expect(container.origin?.sourceType).toBe('stack');

    const shapes = container.children.filter(c => c.type === 'shape') as IRShape[];
    expect(shapes).toHaveLength(3);

    // Verify vertical ordering
    expect(shapes[0].bounds.y).toBeLessThan(shapes[1].bounds.y);
    expect(shapes[1].bounds.y).toBeLessThan(shapes[2].bounds.y);

    // Render and verify nodes are created
    const group = renderScene(ir, 0, transform);
    const allNodes = collectNodes(group);
    expect(allNodes.length).toBeGreaterThan(3);
  });

  it('renders horizontal stack', () => {
    const dsl = `
stack direction:row gap:2 {
  node "X" #x
  node "Y" #y
}`;
    const { ir } = compileAndRender(dsl);
    const container = ir.scenes[0].elements[0] as IRContainer;
    const shapes = container.children.filter(c => c.type === 'shape') as IRShape[];

    expect(shapes[0].bounds.x).toBeLessThan(shapes[1].bounds.x);
  });
});

describe('E2E — grid layout', () => {
  it('compiles and renders grid layout', () => {
    const dsl = `
grid cols:2 gap:2 {
  node "1" #n1
  node "2" #n2
  node "3" #n3
  node "4" #n4
}`;
    const { ir, transform } = compileAndRender(dsl);
    const container = ir.scenes[0].elements[0] as IRContainer;

    expect(container.origin?.sourceType).toBe('grid');

    const shapes = container.children.filter(c => c.type === 'shape') as IRShape[];
    expect(shapes).toHaveLength(4);

    // Grid: n1 and n2 should be on same row (similar Y)
    expect(Math.abs(shapes[0].bounds.y - shapes[1].bounds.y)).toBeLessThan(1);
    // n1 and n3 should be on different rows
    expect(shapes[0].bounds.y).toBeLessThan(shapes[2].bounds.y);

    // Render
    const group = renderScene(ir, 0, transform);
    expect(group.getChildren().length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Flow with edges
// ---------------------------------------------------------------------------

describe('E2E — flow with edges', () => {
  it('compiles flow block and routes edges', () => {
    const dsl = `
flow direction:right gap:5 {
  node "Start" #start
  node "Process" #process
  node "End" #end
  #start -> #process
  #process -> #end
}`;
    const { ir, transform } = compileAndRender(dsl);
    const container = ir.scenes[0].elements[0] as IRContainer;

    expect(container.origin?.sourceType).toBe('flow');

    const shapes = container.children.filter(c => c.type === 'shape') as IRShape[];
    const edges = container.children.filter(c => c.type === 'edge') as IREdgeType[];

    expect(shapes).toHaveLength(3);
    expect(edges).toHaveLength(2);

    // Edges should have valid anchors and paths
    for (const edge of edges) {
      expect(edge.fromAnchor).toBeDefined();
      expect(edge.toAnchor).toBeDefined();
      expect(edge.path).toBeDefined();
      expect(edge.arrowEnd).toBe('triangle');
    }

    // Render and verify
    const group = renderScene(ir, 0, transform);
    expect(group.getChildren().length).toBeGreaterThan(0);
  });

  it('renders edge labels', () => {
    const dsl = `
flow {
  node "A" #a
  node "B" #b
  #a -> #b "connects"
}`;
    const { ir } = compileAndRender(dsl);
    const container = ir.scenes[0].elements[0] as IRContainer;
    const edges = container.children.filter(c => c.type === 'edge') as IREdgeType[];

    expect(edges).toHaveLength(1);
    expect(edges[0].labels).toBeDefined();
    expect(edges[0].labels![0].text).toBe('connects');
  });
});

// ---------------------------------------------------------------------------
// Theme integration
// ---------------------------------------------------------------------------

describe('E2E — theme integration', () => {
  it('resolves semantic colors in the pipeline', () => {
    const dsl = 'node "Styled" #s1 {\n  background: primary\n}';
    const { ir } = compileAndRender(dsl);

    const el = ir.scenes[0].elements.find(e => e.id === 's1');
    expect(el).toBeDefined();
    // 'primary' should be resolved to the light theme primary color
    expect(el!.style.fill).toBe(lightTheme.colors.primary);
  });

  it('uses dark theme colors when specified', () => {
    const dsl = 'node "Dark" #d1 {\n  background: primary\n}';
    const { ir } = compileAndRender(dsl, darkTheme);

    const el = ir.scenes[0].elements.find(e => e.id === 'd1');
    expect(el!.style.fill).toBe(darkTheme.colors.primary);
    expect(ir.meta.background.color).toBe(darkTheme.background);
  });
});

// ---------------------------------------------------------------------------
// Directives
// ---------------------------------------------------------------------------

describe('E2E — directives', () => {
  it('applies aspect ratio from page directive', () => {
    const dsl = `
@page 4:3
node "Test" #t1`;
    const { ir } = compileAndRender(dsl);

    expect(ir.meta.aspectRatio).toEqual({ width: 4, height: 3 });
  });

  it('applies sketch drawing style', () => {
    const dsl = `
@style sketch
node "Sketch" #s1`;
    const { ir } = compileAndRender(dsl);

    expect(ir.meta.drawingStyle).toBe('sketch');
  });
});

// ---------------------------------------------------------------------------
// Multiple scenes
// ---------------------------------------------------------------------------

describe('E2E — multiple scenes', () => {
  it('compiles and renders multiple scenes', () => {
    const dsl = `
scene "Intro" {
  node "Welcome" #w
}
scene "Main" {
  node "Content" #c
}`;
    const { ir, transform } = compileAndRender(dsl);

    expect(ir.scenes).toHaveLength(2);
    expect(ir.transitions).toHaveLength(1);

    // Render first scene
    const group1 = renderScene(ir, 0, transform);
    expect(group1.getChildren().length).toBeGreaterThan(0);

    // Render second scene
    const group2 = renderScene(ir, 1, transform);
    expect(group2.getChildren().length).toBeGreaterThan(0);
  });

  it('creates transitions between scenes', () => {
    const dsl = `
@transition slide-left
scene "A" {
  node "A"
}
scene "B" {
  node "B"
}`;
    const { ir } = compileAndRender(dsl);

    expect(ir.transitions[0].type).toBe('slide-left');
    expect(ir.transitions[0].duration).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Mixed elements
// ---------------------------------------------------------------------------

describe('E2E — mixed element types', () => {
  it('renders scene with multiple element types', () => {
    const dsl = `
stack direction:col gap:2 {
  label "Title" #title bold
  node "Box" #box
}`;
    const { ir, transform } = compileAndRender(dsl);
    const container = ir.scenes[0].elements[0] as IRContainer;
    const children = container.children;

    // Should have a text and a shape
    const textEls = children.filter(c => c.type === 'text');
    const shapeEls = children.filter(c => c.type === 'shape');

    expect(textEls.length).toBeGreaterThanOrEqual(1);
    expect(shapeEls.length).toBeGreaterThanOrEqual(1);

    // Render
    const group = renderScene(ir, 0, transform);
    expect(group.getChildren().length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Coordinate transform integration
// ---------------------------------------------------------------------------

describe('E2E — coordinate transform', () => {
  it('renders elements within viewport bounds', () => {
    const dsl = 'node "Test" #t1';
    const { ir, transform } = compileAndRender(dsl);

    const el = ir.scenes[0].elements[0];
    const rendered = renderElement(el, transform);

    // Element should be positioned within the viewport
    expect(rendered.x()).toBeGreaterThanOrEqual(0);
    expect(rendered.y()).toBeGreaterThanOrEqual(0);
  });

  it('handles different aspect ratios', () => {
    const dsl = `
@page 1:1
node "Square" #sq`;
    const { ir } = compileAndRender(dsl);

    // 1:1 aspect ratio for 1600x900 viewport → letterboxed
    const transform = new CoordinateTransform(
      { width: 1600, height: 900 },
      ir.meta.aspectRatio,
    );

    const el = ir.scenes[0].elements[0];
    const rendered = renderElement(el, transform);

    // Element should still render
    expect(rendered).toBeDefined();
    expect(rendered.x()).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Complex scenario
// ---------------------------------------------------------------------------

describe('E2E — complex scenario', () => {
  it('compiles a realistic diagram', () => {
    const dsl = `
@page 16:9

flow direction:right gap:5 {
  node "Client" #client
  node "API Gateway" #gateway
  node "Service" #service
  node "Database" #db

  #client -> #gateway
  #gateway -> #service
  #service -> #db
}`;
    const { ir, errors, transform } = compileAndRender(dsl);

    expect(errors).toHaveLength(0);
    expect(ir.meta.aspectRatio).toEqual({ width: 16, height: 9 });

    const container = ir.scenes[0].elements[0] as IRContainer;
    expect(container.type).toBe('container');

    const shapes = container.children.filter(c => c.type === 'shape');
    const edges = container.children.filter(c => c.type === 'edge');

    expect(shapes).toHaveLength(4);
    expect(edges).toHaveLength(3);

    // All shapes should have valid bounds
    for (const shape of shapes) {
      expect(shape.bounds.w).toBeGreaterThan(0);
      expect(shape.bounds.h).toBeGreaterThan(0);
    }

    // Render entire scene
    const group = renderScene(ir, 0, transform);
    const allNodes = collectNodes(group);
    // Should have many nodes: container group + shapes + edges + text etc.
    expect(allNodes.length).toBeGreaterThan(5);
  });

  it('compiles nested layout blocks', () => {
    const dsl = `
stack direction:col gap:3 {
  label "Architecture" #title bold
  stack direction:row gap:5 {
    node "Frontend" #fe
    node "Backend" #be
    node "DB" #db
  }
}`;
    const { ir, transform } = compileAndRender(dsl);

    const outer = ir.scenes[0].elements[0] as IRContainer;
    expect(outer.type).toBe('container');

    // Should have label + inner container
    const innerContainers = outer.children.filter(c => c.type === 'container');
    expect(innerContainers.length).toBeGreaterThanOrEqual(1);

    const inner = innerContainers[0] as IRContainer;
    const innerShapes = inner.children.filter(c => c.type === 'shape');
    expect(innerShapes).toHaveLength(3);

    // Render
    const group = renderScene(ir, 0, transform);
    expect(group.getChildren().length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Edge style variants
// ---------------------------------------------------------------------------

describe('E2E — edge styles', () => {
  it('renders dashed edges with -->', () => {
    const dsl = `
flow {
  node "A" #a
  node "B" #b
  #a --> #b
}`;
    const { ir } = compileAndRender(dsl);
    const container = ir.scenes[0].elements[0] as IRContainer;
    const edge = container.children.find(c => c.type === 'edge') as IREdgeType;

    expect(edge).toBeDefined();
    expect(edge.arrowEnd).toBe('triangle');
    expect(edge.style.dashPattern).toBeDefined();
  });

  it('renders line without arrows with --', () => {
    const dsl = `
flow {
  node "A" #a
  node "B" #b
  #a -- #b
}`;
    const { ir } = compileAndRender(dsl);
    const container = ir.scenes[0].elements[0] as IRContainer;
    const edge = container.children.find(c => c.type === 'edge') as IREdgeType;

    expect(edge).toBeDefined();
    expect(edge.arrowStart).toBeUndefined();
    expect(edge.arrowEnd).toBeUndefined();
  });

  it('renders bidirectional edge with <->', () => {
    const dsl = `
flow {
  node "A" #a
  node "B" #b
  #a <-> #b
}`;
    const { ir } = compileAndRender(dsl);
    const container = ir.scenes[0].elements[0] as IRContainer;
    const edge = container.children.find(c => c.type === 'edge') as IREdgeType;

    expect(edge).toBeDefined();
    expect(edge.arrowStart).toBe('triangle');
    expect(edge.arrowEnd).toBe('triangle');
  });
});

// ---------------------------------------------------------------------------
// IR validation
// ---------------------------------------------------------------------------

describe('E2E — IR structure validation', () => {
  it('all IR elements have valid bounds', () => {
    const dsl = `
grid cols:2 gap:2 {
  node "A" #a
  node "B" #b
  node "C" #c
  node "D" #d
}`;
    const { ir } = compileAndRender(dsl);
    const container = ir.scenes[0].elements[0] as IRContainer;

    for (const child of container.children) {
      expect(child.bounds).toBeDefined();
      expect(typeof child.bounds.x).toBe('number');
      expect(typeof child.bounds.y).toBe('number');
      expect(child.bounds.w).toBeGreaterThanOrEqual(0);
      expect(child.bounds.h).toBeGreaterThanOrEqual(0);
    }
  });

  it('all IR edges have valid path data', () => {
    const dsl = `
flow {
  node "A" #a
  node "B" #b
  node "C" #c
  #a -> #b
  #b -> #c
}`;
    const { ir } = compileAndRender(dsl);
    const container = ir.scenes[0].elements[0] as IRContainer;
    const edges = container.children.filter(c => c.type === 'edge') as IREdgeType[];

    for (const edge of edges) {
      expect(edge.fromAnchor.x).toBeDefined();
      expect(edge.fromAnchor.y).toBeDefined();
      expect(edge.toAnchor.x).toBeDefined();
      expect(edge.toAnchor.y).toBeDefined();
      expect(['straight', 'polyline', 'bezier']).toContain(edge.path.type);
    }
  });

  it('IR meta has all required fields', () => {
    const { ir } = compileAndRender('node "Test"');

    expect(ir.meta.aspectRatio.width).toBeGreaterThan(0);
    expect(ir.meta.aspectRatio.height).toBeGreaterThan(0);
    expect(ir.meta.background).toBeDefined();
    expect(ir.meta.drawingStyle).toBeDefined();
  });
});
