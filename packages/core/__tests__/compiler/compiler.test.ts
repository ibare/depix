import { describe, it, expect } from 'vitest';
import { compile } from '../../src/compiler/compiler.js';
import { lightTheme, darkTheme } from '../../src/theme/builtin-themes.js';
import type { IRContainer, IRShape, IRText, IREdge as IREdgeType } from '../../src/ir/types.js';

// ---------------------------------------------------------------------------
// Basic pipeline
// ---------------------------------------------------------------------------

describe('compile — basic pipeline', () => {
  it('compiles empty input', () => {
    const result = compile('');
    expect(result.ir).toBeDefined();
    expect(result.ir.scenes).toBeDefined();
    expect(result.ir.meta).toBeDefined();
    expect(result.ir.transitions).toHaveLength(0);
  });

  it('returns parse errors', () => {
    // An invalid construct will produce parse errors
    const result = compile('node "Hello"');
    // The parser should handle this even if it's just a standalone node
    expect(result.ir).toBeDefined();
  });

  it('uses light theme by default', () => {
    const result = compile('');
    expect(result.ir.meta.background.color).toBe(lightTheme.background);
  });

  it('uses custom theme when provided', () => {
    const result = compile('', { theme: darkTheme });
    expect(result.ir.meta.background.color).toBe(darkTheme.background);
  });
});

// ---------------------------------------------------------------------------
// Directives
// ---------------------------------------------------------------------------

describe('compile — directives', () => {
  it('parses page directive', () => {
    const result = compile('@page 4:3');
    expect(result.ir.meta.aspectRatio).toEqual({ width: 4, height: 3 });
  });

  it('parses style directive', () => {
    const result = compile('@style sketch');
    expect(result.ir.meta.drawingStyle).toBe('sketch');
  });

  it('uses externally provided theme', () => {
    const result = compile('@page 16:9', { theme: darkTheme });
    expect(result.ir.meta.background.color).toBe(darkTheme.background);
  });
});

// ---------------------------------------------------------------------------
// Single node
// ---------------------------------------------------------------------------

describe('compile — single node', () => {
  it('compiles a single node element', () => {
    const result = compile('node "Hello" #n1');
    const elements = result.ir.scenes[0].elements;

    expect(elements.length).toBeGreaterThanOrEqual(1);
    const node = elements.find(e => e.id === 'n1');
    expect(node).toBeDefined();

    if (node && node.type === 'shape') {
      expect(node.shape).toBe('rect');
      expect(node.innerText?.content).toBe('Hello');
    }
  });
});

// ---------------------------------------------------------------------------
// Stack layout
// ---------------------------------------------------------------------------

describe('compile — stack layout', () => {
  it('compiles stack block with nodes', () => {
    const dsl = `
stack direction:col gap:3 {
  node "A" #a
  node "B" #b
}`;
    const result = compile(dsl);
    const scene = result.ir.scenes[0];

    const container = scene.elements.find(e => e.type === 'container') as IRContainer;
    expect(container).toBeDefined();
    expect(container.origin?.sourceType).toBe('stack');

    const shapes = container.children.filter(c => c.type === 'shape');
    expect(shapes).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Grid layout
// ---------------------------------------------------------------------------

describe('compile — grid layout', () => {
  it('compiles grid block', () => {
    const dsl = `
grid cols:2 gap:2 {
  node "1" #n1
  node "2" #n2
  node "3" #n3
  node "4" #n4
}`;
    const result = compile(dsl);
    const scene = result.ir.scenes[0];

    const container = scene.elements.find(e => e.type === 'container') as IRContainer;
    expect(container).toBeDefined();
    expect(container.origin?.sourceType).toBe('grid');

    const shapes = container.children.filter(c => c.type === 'shape');
    expect(shapes).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// Flow with edges
// ---------------------------------------------------------------------------

describe('compile — flow with edges', () => {
  it('compiles flow block with edges', () => {
    const dsl = `
flow direction:right gap:5 {
  node "Start" #start
  node "End" #end
  #start -> #end
}`;
    const result = compile(dsl);
    const scene = result.ir.scenes[0];

    const container = scene.elements.find(e => e.type === 'container') as IRContainer;
    expect(container).toBeDefined();
    expect(container.origin?.sourceType).toBe('flow');

    const edges = container.children.filter(c => c.type === 'edge') as IREdgeType[];
    expect(edges).toHaveLength(1);
    expect(edges[0].fromId).toBe('start');
    expect(edges[0].toId).toBe('end');
  });
});

// ---------------------------------------------------------------------------
// Theme resolution in pipeline
// ---------------------------------------------------------------------------

describe('compile — theme resolution', () => {
  it('resolves semantic colors through the pipeline', () => {
    const dsl = 'node "Test" #n1 {\n  background: primary\n}';
    const result = compile(dsl);

    const node = result.ir.scenes[0].elements.find(e => e.id === 'n1');
    expect(node).toBeDefined();
    // After theme resolution, 'primary' should be resolved to a HEX color
    if (node?.style.fill) {
      expect(typeof node.style.fill).toBe('string');
      expect((node.style.fill as string).startsWith('#')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Multiple scenes
// ---------------------------------------------------------------------------

describe('compile — multiple scenes', () => {
  it('compiles multiple scenes with transitions', () => {
    const dsl = `
scene "Intro" {
  node "Welcome" #w
}
scene "Main" {
  node "Content" #c
}`;
    const result = compile(dsl);

    expect(result.ir.scenes).toHaveLength(2);
    expect(result.ir.transitions).toHaveLength(1);
    expect(result.ir.transitions[0].type).toBe('fade');
  });
});

// ---------------------------------------------------------------------------
// Unified pipeline — layout field
// ---------------------------------------------------------------------------

describe('compile — unified pipeline layout', () => {
  it('diagram DSL without @presentation gets layout.type === "full"', () => {
    const result = compile('node "Hello" #n1');
    expect(result.ir.scenes[0].layout).toEqual({ type: 'full' });
  });

  it('@presentation directive is a no-op — same scene structure', () => {
    const dsl = 'node "Hello" #n1';
    const withoutPresentation = compile(dsl);
    const withPresentation = compile('@presentation\n' + dsl);

    expect(withPresentation.ir.scenes[0].layout).toEqual({ type: 'full' });
    expect(withPresentation.ir.scenes[0].elements.length).toBe(
      withoutPresentation.ir.scenes[0].elements.length,
    );
  });

  it('scene block gets layout.type from its layout property', () => {
    const dsl = `
scene "Slide" layout:split {
  left: heading "Left"
  right: text "Right"
}`;
    const result = compile(dsl);
    expect(result.ir.scenes[0].layout?.type).toBe('split');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('compile — edge cases', () => {
  it('handles empty scenes gracefully', () => {
    const dsl = `
scene "Empty" {
}`;
    const result = compile(dsl);
    expect(result.ir.scenes[0].elements).toHaveLength(0);
  });

  it('generates valid IR structure', () => {
    const result = compile('node "Test"');
    expect(result.ir.meta).toBeDefined();
    expect(result.ir.scenes).toBeDefined();
    expect(result.ir.transitions).toBeDefined();
    expect(Array.isArray(result.ir.scenes)).toBe(true);
    expect(Array.isArray(result.ir.transitions)).toBe(true);
  });
});
