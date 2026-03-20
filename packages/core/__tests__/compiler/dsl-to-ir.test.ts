/**
 * DSL → IR Integration Tests
 *
 * Verifies that DSL source text, when compiled through the full pipeline
 * (tokenize → parse → resolveTheme → layout → emit-ir), produces IR
 * where all semantic content is faithfully preserved.
 *
 * These tests catch bugs at pass boundaries — where one pass's output
 * doesn't match the next pass's expectations (e.g. parser puts subtitle
 * in props, but emit-ir reads from style).
 */

import { describe, it, expect } from 'vitest';
import { compile } from '../../src/compiler/compiler.js';
import { lightTheme, darkTheme } from '../../src/theme/builtin-themes.js';
import type { IRContainer, IRShape, IRText, IREdge as IREdgeType } from '../../src/ir/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function compileIR(dsl: string, theme = lightTheme) {
  const { ir, errors } = compile(dsl, { theme });
  return { ir, errors, scene: ir.scenes[0] };
}

/** Recursively collect all IR elements of a given type from a scene. */
function collectByType<T extends { type: string }>(
  elements: { type: string; children?: unknown[] }[],
  type: string,
): T[] {
  const result: T[] = [];
  for (const el of elements) {
    if (el.type === type) result.push(el as T);
    if ('children' in el && Array.isArray(el.children)) {
      result.push(...collectByType<T>(el.children, type));
    }
  }
  return result;
}

/** Find an element by id, searching recursively. */
function findById<T extends { id: string; type: string; children?: unknown[] }>(
  elements: T[],
  id: string,
): T | undefined {
  for (const el of elements) {
    if (el.id === id) return el;
    if ('children' in el && Array.isArray(el.children)) {
      const found = findById(el.children as T[], id);
      if (found) return found;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Element content — node
// ---------------------------------------------------------------------------

describe('DSL→IR — node content', () => {
  it('node label appears as shape innerText content', () => {
    const { scene } = compileIR('node "Hello World" #n1');
    // Standalone nodes go through the scene pipeline and become IRShape via emitSceneShape
    const node = findById(scene.elements, 'n1') as IRShape;

    expect(node).toBeDefined();
    expect(node.type).toBe('shape');
    expect(node.innerText?.content).toBe('Hello World');
  });

  it('node inside flow retains shape with innerText', () => {
    const { scene } = compileIR('flow { node "Bold" #n1 { bold } }');
    // Nodes inside diagram blocks go through emitInlineBlock → IRShape
    const node = findById(scene.elements, 'n1') as IRShape;

    expect(node.type).toBe('shape');
    expect(node.innerText!.fontWeight).toBe('bold');
  });

  it('badge label appears as shape innerText content', () => {
    const { scene } = compileIR('badge "NEW" #b1');
    // Standalone badges go through the scene pipeline and become IRShape via emitSceneShape
    const badge = findById(scene.elements, 'b1') as IRShape;

    expect(badge.type).toBe('shape');
    expect(badge.innerText?.content).toBe('NEW');
  });
});

// ---------------------------------------------------------------------------
// Element content — box
// ---------------------------------------------------------------------------

describe('DSL→IR — box content', () => {
  it('standalone box becomes a container', () => {
    const { scene } = compileIR('box "My Title" #box1');
    // Standalone boxes go through diagram pipeline → IRContainer (pure container, no implicit title)
    const box = findById(scene.elements, 'box1') as IRContainer;

    expect(box).toBeDefined();
    expect(box.type).toBe('container');
  });

  it('box inside flow becomes a pure container (no implicit title/subtitle)', () => {
    const dsl = `flow {
  box "Card" #box1 {
    subtitle: "Description here"
  }
}`;
    const { scene } = compileIR(dsl);
    // Box is a pure container block — no implicit title or subtitle text children
    const box = findById(scene.elements, 'box1') as IRContainer;
    expect(box.type).toBe('container');
  });

  it('box inside stack with list preserves list items (no implicit title/subtitle)', () => {
    const dsl = `stack {
  box "Features" #box1 {
    subtitle: "What we offer"
    list ["Fast", "Safe", "Easy"]
  }
}`;
    const { scene } = compileIR(dsl);
    const box = findById(scene.elements, 'box1') as IRContainer;
    expect(box.type).toBe('container');

    // Box is a pure container — no implicit title or subtitle text.
    // Only list items survive as text children.
    const allTexts = collectByType<IRText>(box.children, 'text');
    const listTexts = allTexts.filter(t =>
      t.content.includes('Fast') || t.content.includes('Safe') || t.content.includes('Easy'),
    );
    expect(listTexts.length).toBeGreaterThanOrEqual(3);
  });

  it('box inside flow without label is a pure container', () => {
    const dsl = `flow {
  box #box1 {
    subtitle: "Only subtitle"
  }
}`;
    const { scene } = compileIR(dsl);
    // Box is a pure container block — no implicit title or subtitle text
    const box = findById(scene.elements, 'box1') as IRContainer;
    expect(box.type).toBe('container');
    expect(box.children).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Element content — label, list, divider
// ---------------------------------------------------------------------------

describe('DSL→IR — other elements', () => {
  it('label text appears in IR', () => {
    const { scene } = compileIR('label "Important Note" #l1');
    const allTexts = collectByType<IRText>(scene.elements, 'text');

    expect(allTexts.some(t => t.content === 'Important Note')).toBe(true);
  });

  it('list items appear as text children inside diagram block', () => {
    // Standalone list goes through scene pipeline (emitLabel).
    // Inside a diagram block, list items go through emitInlineBlock → IRContainer with text children.
    const dsl = `stack {
  list ["Alpha", "Beta", "Gamma"]
}`;
    const { scene } = compileIR(dsl);
    const containers = collectByType<IRContainer>(scene.elements, 'container');

    expect(containers.length).toBeGreaterThanOrEqual(1);
    const allTexts = collectByType<IRText>(scene.elements, 'text');
    expect(allTexts.some(t => t.content.includes('Alpha'))).toBe(true);
    expect(allTexts.some(t => t.content.includes('Beta'))).toBe(true);
    expect(allTexts.some(t => t.content.includes('Gamma'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Style propagation through pipeline
// ---------------------------------------------------------------------------

describe('DSL→IR — style propagation', () => {
  it('standalone node in scene context gets scene-theme fill (not DSL background)', () => {
    const dsl = 'node "Styled" #n1 { background: primary }';
    const { scene } = compileIR(dsl);
    // Standalone nodes use emitSceneShape which applies scene-theme colors,
    // not per-element DSL styles (those apply inside diagram blocks)
    const node = findById(scene.elements, 'n1') as IRShape;

    expect(node.type).toBe('shape');
    expect(node.innerText?.content).toBe('Styled');
    // Scene-emitted shapes use sceneTheme defaults
    expect(node.style.fill).toBeDefined();
  });

  it('standalone node in scene context gets scene-theme stroke (not DSL border)', () => {
    const dsl = 'node "Bordered" #n1 { border: danger }';
    const { scene } = compileIR(dsl);
    // Standalone nodes use emitSceneShape which applies scene-theme colors,
    // not per-element DSL styles (those apply inside diagram blocks)
    const node = findById(scene.elements, 'n1') as IRShape;

    expect(node.type).toBe('shape');
    expect(node.innerText?.content).toBe('Bordered');
    // Scene-emitted shapes use sceneTheme defaults
    expect(node.style.stroke).toBeDefined();
  });

  it('shadow: md resolves to IRShadow on node inside diagram block', () => {
    // Nodes inside diagram blocks go through emitInlineBlock and retain shadow styles
    const dsl = `flow {
  node "Shadowed" #n1 { shadow: md }
}`;
    const { scene } = compileIR(dsl);
    const node = findById(scene.elements, 'n1') as IRShape;

    expect(node.style.shadow).toBeDefined();
    expect(node.style.shadow!.blur).toBeGreaterThan(0);
  });

  it('color: primary on box produces a container', () => {
    const dsl = 'box "Colored" #box1 { color: primary }';
    const { scene } = compileIR(dsl);
    // Box is now a block — goes through the diagram pipeline as a container
    const box = findById(scene.elements, 'box1') as IRContainer;
    expect(box).toBeDefined();
    expect(box.type).toBe('container');
  });

  it('explicit background overrides palette expansion', () => {
    const dsl = 'box "Manual" #box1 { color: primary, background: #ff0000 }';
    const { scene } = compileIR(dsl);
    const box = findById(scene.elements, 'box1') as IRContainer;

    expect(box.style.fill).toBe('#ff0000');
  });

  it('no semantic tokens remain in IR styles', () => {
    const dsl = `
node "A" #n1 { background: primary, border: secondary, shadow: lg }
box "B" #box1 { color: accent }`;
    const { scene } = compileIR(dsl);

    const semanticTokens = ['primary', 'secondary', 'accent', 'success', 'warning', 'danger', 'info', 'muted'];
    const sizeTokens = ['sm', 'md', 'lg', 'xl'];

    for (const el of scene.elements) {
      const { fill, stroke } = el.style;
      if (typeof fill === 'string') {
        expect(semanticTokens).not.toContain(fill);
      }
      if (typeof stroke === 'string') {
        expect(semanticTokens).not.toContain(stroke);
      }
    }
  });

  it('dark theme preserves node content as shape', () => {
    const dsl = 'node "Dark" #n1 { background: primary }';
    const lightResult = compileIR(dsl, lightTheme);
    const darkResult = compileIR(dsl, darkTheme);

    // Standalone nodes become IRShape in both themes
    const lightNode = findById(lightResult.scene.elements, 'n1') as IRShape;
    const darkNode = findById(darkResult.scene.elements, 'n1') as IRShape;

    expect(lightNode.type).toBe('shape');
    expect(darkNode.type).toBe('shape');
    expect(lightNode.innerText?.content).toBe('Dark');
    expect(darkNode.innerText?.content).toBe('Dark');
  });
});

// ---------------------------------------------------------------------------
// Layout structure
// ---------------------------------------------------------------------------

describe('DSL→IR — layout structure', () => {
  it('stack preserves child order and content', () => {
    const dsl = `
stack direction:col {
  node "First" #n1
  node "Second" #n2
  node "Third" #n3
}`;
    const { scene } = compileIR(dsl);
    // The outermost container is now a scene-slot wrapper; the stack container is inside it
    const slotContainer = scene.elements.find(e => e.type === 'container') as IRContainer;
    expect(slotContainer).toBeDefined();
    expect(slotContainer.origin?.sourceType).toBe('scene-slot');

    const shapes = slotContainer.children.filter(c => c.type === 'shape') as IRShape[];
    expect(shapes).toHaveLength(3);
    expect(shapes[0].innerText?.content).toBe('First');
    expect(shapes[1].innerText?.content).toBe('Second');
    expect(shapes[2].innerText?.content).toBe('Third');
  });

  it('flow preserves edges with correct IDs', () => {
    const dsl = `
flow direction:right {
  node "Start" #start
  node "Middle" #mid
  node "End" #end
  #start -> #mid
  #mid -> #end
}`;
    const { scene } = compileIR(dsl);
    const container = scene.elements.find(e => e.type === 'container') as IRContainer;
    const edges = container.children.filter(c => c.type === 'edge') as IREdgeType[];

    expect(edges).toHaveLength(2);
    expect(edges.some(e => e.fromId === 'start' && e.toId === 'mid')).toBe(true);
    expect(edges.some(e => e.fromId === 'mid' && e.toId === 'end')).toBe(true);
  });

  it('grid contains correct number of children with content', () => {
    const dsl = `
grid cols:2 {
  node "A" #a
  node "B" #b
  node "C" #c
  node "D" #d
}`;
    const { scene } = compileIR(dsl);
    // The outermost container is now a scene-slot wrapper; grid content is inside it
    const container = scene.elements.find(e => e.type === 'container') as IRContainer;
    expect(container.origin?.sourceType).toBe('scene-slot');

    const shapes = container.children.filter(c => c.type === 'shape') as IRShape[];
    expect(shapes).toHaveLength(4);

    const labels = shapes.map(s => s.innerText?.content);
    expect(labels).toEqual(['A', 'B', 'C', 'D']);
  });
});

// ---------------------------------------------------------------------------
// Nested structures
// ---------------------------------------------------------------------------

describe('DSL→IR — nesting', () => {
  it('box inside stack are pure containers (no implicit title/subtitle)', () => {
    const dsl = `
stack direction:col {
  box "Header" #header
  box "Body" #body {
    subtitle: "Details"
  }
}`;
    const { scene } = compileIR(dsl);

    const header = findById(scene.elements, 'header') as IRContainer;
    const body = findById(scene.elements, 'body') as IRContainer;

    expect(header).toBeDefined();
    expect(header.type).toBe('container');
    expect(body).toBeDefined();
    expect(body.type).toBe('container');
  });

  it('box with nested list preserves list items (no implicit title)', () => {
    // Box with nested list inside a diagram block goes through emitBlockFromPlan
    const dsl = `
stack {
  box "Menu" #menu {
    list ["Home", "About", "Contact"]
  }
}`;
    const { scene } = compileIR(dsl);
    const menu = findById(scene.elements, 'menu') as IRContainer;
    expect(menu.type).toBe('container');

    // No implicit title text, but list items are preserved
    const allTexts = collectByType<IRText>(menu.children, 'text');
    expect(allTexts.some(t => t.content.includes('Home'))).toBe(true);
    expect(allTexts.some(t => t.content.includes('Contact'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Composite real-world scenarios
// ---------------------------------------------------------------------------

describe('DSL→IR — composite scenarios', () => {
  it('card with color + subtitle becomes a container', () => {
    // Standalone box goes through diagram pipeline → IRContainer (pure container)
    const dsl = `
box "Hello Depix" #card {
  color: primary
  subtitle: "Your first diagram"
}`;
    const { scene } = compileIR(dsl);
    const card = findById(scene.elements, 'card') as IRContainer;

    // Structure — standalone box becomes IRContainer in diagram pipeline
    expect(card).toBeDefined();
    expect(card.type).toBe('container');
  });

  it('flow diagram with styled nodes preserves everything', () => {
    const dsl = `
flow direction:right gap:5 {
  node "Input" #input { background: success }
  node "Process" #proc { background: primary }
  node "Output" #output { background: accent }
  #input -> #proc
  #proc -> #output
}`;
    const { scene } = compileIR(dsl);
    const container = scene.elements.find(e => e.type === 'container') as IRContainer;

    // Content
    const shapes = container.children.filter(c => c.type === 'shape') as IRShape[];
    expect(shapes.find(s => s.innerText?.content === 'Input')).toBeDefined();
    expect(shapes.find(s => s.innerText?.content === 'Process')).toBeDefined();
    expect(shapes.find(s => s.innerText?.content === 'Output')).toBeDefined();

    // Style
    const input = shapes.find(s => s.id === 'input')!;
    expect(input.style.fill).toBe(lightTheme.colors.success);

    // Edges
    const edges = container.children.filter(c => c.type === 'edge') as IREdgeType[];
    expect(edges).toHaveLength(2);
  });

  it('multi-scene document preserves content across scenes', () => {
    const dsl = `
scene "Intro" {
  node "Welcome" #w
}
scene "Main" {
  node "Content" #c
}`;
    const { ir } = compileIR(dsl);

    expect(ir.scenes).toHaveLength(2);

    // Standalone nodes inside scenes go through scene pipeline → IRShape
    const w = findById(ir.scenes[0].elements, 'w') as IRShape;
    const c = findById(ir.scenes[1].elements, 'c') as IRShape;

    expect(w.type).toBe('shape');
    expect(w.innerText?.content).toBe('Welcome');
    expect(c.type).toBe('shape');
    expect(c.innerText?.content).toBe('Content');
  });
});
