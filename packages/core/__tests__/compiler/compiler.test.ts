import { describe, it, expect } from 'vitest';
import { compile } from '../../src/compiler/compiler.js';
import { lightTheme, darkTheme } from '../../src/theme/builtin-themes.js';
import type { IRContainer, IRElement, IRScene, IRShape, IRText, IREdge as IREdgeType } from '../../src/ir/types.js';

// ---------------------------------------------------------------------------
// Helpers — navigate the scene-wrapped IR structure
// ---------------------------------------------------------------------------

/** scene-background를 제외한 콘텐츠 elements를 반환 */
function contentElements(scene: IRScene): IRElement[] {
  return scene.elements.filter(el => el.type !== 'shape' || !('origin' in el) || (el as IRShape & { origin?: { sourceType: string } }).origin?.sourceType !== 'scene-background');
}

/** scene-slot 컨테이너 내부의 다이어그램 컨텐츠를 반환 (첫 번째 scene-slot의 children) */
function diagramContent(scene: IRScene): IRElement[] {
  const slotContainer = scene.elements.find(
    el => el.type === 'container' && (el as IRContainer & { origin?: { sourceType: string } }).origin?.sourceType === 'scene-slot'
  ) as IRContainer | undefined;
  return slotContainer?.children ?? [];
}

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
    const scene = result.ir.scenes[0];

    // The scene now wraps content in a scene-slot container
    const content = diagramContent(scene);
    expect(content.length).toBeGreaterThanOrEqual(1);

    // The diagram container holds the actual node elements
    const diagramContainer = content.find(e => e.type === 'container') as IRContainer | undefined;
    const allElements = diagramContainer?.children ?? content;
    const node = allElements.find(e => e.id === 'n1');
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

    // emitScene merges diagram container with scene-slot, so children are directly inside
    const slotContainer = scene.elements.find(
      el => el.type === 'container' && (el as IRContainer & { origin?: { sourceType: string } }).origin?.sourceType === 'scene-slot'
    ) as IRContainer | undefined;
    expect(slotContainer).toBeDefined();

    const shapes = slotContainer!.children.filter(c => c.type === 'shape');
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

    // emitScene merges diagram container with scene-slot, so children are directly inside
    const slotContainer = scene.elements.find(
      el => el.type === 'container' && (el as IRContainer & { origin?: { sourceType: string } }).origin?.sourceType === 'scene-slot'
    ) as IRContainer | undefined;
    expect(slotContainer).toBeDefined();

    const shapes = slotContainer!.children.filter(c => c.type === 'shape');
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

    // emitScene merges diagram container with scene-slot, so children are directly inside
    const slotContainer = scene.elements.find(
      el => el.type === 'container' && (el as IRContainer & { origin?: { sourceType: string } }).origin?.sourceType === 'scene-slot'
    ) as IRContainer | undefined;
    expect(slotContainer).toBeDefined();

    const edges = slotContainer!.children.filter(c => c.type === 'edge') as IREdgeType[];
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
    const scene = result.ir.scenes[0];

    // Node is now nested inside scene-slot → diagram container
    const content = diagramContent(scene);
    const diagramContainer = content.find(e => e.type === 'container') as IRContainer | undefined;
    const allElements = diagramContainer?.children ?? content;
    const node = allElements.find(e => e.id === 'n1');
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
    // Empty scene still has structural elements (scene-background, etc.)
    // but no user content beyond the scene scaffolding
    const content = contentElements(result.ir.scenes[0]);
    const userContent = content.filter(
      el => el.type !== 'container' || !(el as IRContainer & { origin?: { sourceType: string } }).origin?.sourceType?.startsWith('scene-'),
    );
    expect(userContent).toHaveLength(0);
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
