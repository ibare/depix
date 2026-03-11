/**
 * Scene DSL — End-to-End Compilation Tests
 *
 * Verifies the full pipeline: DSL source → compile() → DepixIR
 * for presentation mode.
 */

import { describe, it, expect } from 'vitest';
import { compile } from '../../../src/compiler/compiler.js';
import type { IRContainer, IRText, IRScene } from '../../../src/ir/types.js';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function compileScene(dsl: string) {
  return compile(dsl);
}

function findTexts(scene: IRScene): IRText[] {
  const texts: IRText[] = [];
  for (const el of scene.elements) {
    if (el.type === 'text') texts.push(el);
    if (el.type === 'container') {
      for (const child of el.children) {
        if (child.type === 'text') texts.push(child);
        if (child.type === 'container') {
          for (const gc of child.children) {
            if (gc.type === 'text') texts.push(gc);
          }
        }
      }
    }
  }
  return texts;
}

// ---------------------------------------------------------------------------
// Basic compilation
// ---------------------------------------------------------------------------

describe('Scene E2E compilation', () => {
  it('compiles a single title scene', () => {
    const { ir, errors } = compileScene(`
@presentation

scene "intro" {
  layout: title
  heading "Welcome to Depix"
  label "A DSL for diagrams"
}
`);
    expect(errors).toEqual([]);
    expect(ir.scenes).toHaveLength(1);
    expect(ir.scenes[0].id).toBe('intro');

    const texts = findTexts(ir.scenes[0]);
    const headingText = texts.find(t => t.content === 'Welcome to Depix');
    expect(headingText).toBeDefined();
    expect(headingText!.fontWeight).toBe('bold');

    const labelText = texts.find(t => t.content === 'A DSL for diagrams');
    expect(labelText).toBeDefined();
  });

  it('compiles 3 scenes (title + bullets + statement)', () => {
    const { ir, errors } = compileScene(`
@presentation
@ratio 16:9

scene "title" {
  layout: title
  heading "2025 Strategy"
  label "Q1 Report"
}

scene "points" {
  layout: bullets
  heading "Key Points"
  bullet {
    item "Revenue up 30%"
    item "New markets entered"
    item "Team grew to 50"
  }
}

scene "closing" {
  layout: statement
  heading "The future is bright"
  label "Thank you"
}
`);
    expect(errors).toEqual([]);
    expect(ir.scenes).toHaveLength(3);
    expect(ir.scenes[0].id).toBe('title');
    expect(ir.scenes[1].id).toBe('points');
    expect(ir.scenes[2].id).toBe('closing');

    // Verify meta
    expect(ir.meta.aspectRatio).toEqual({ width: 16, height: 9 });
    expect(ir.meta.background.type).toBe('solid');

    // Verify transitions between scenes
    expect(ir.transitions).toHaveLength(2);
    expect(ir.transitions[0].from).toBe('title');
    expect(ir.transitions[0].to).toBe('points');
    expect(ir.transitions[1].from).toBe('points');
    expect(ir.transitions[1].to).toBe('closing');
  });

  it('compiles a bullets scene with item content', () => {
    const { ir } = compileScene(`
@presentation

scene {
  layout: bullets
  heading "Topics"
  bullet {
    item "Alpha"
    item "Beta"
  }
}
`);
    expect(ir.scenes).toHaveLength(1);
    const texts = findTexts(ir.scenes[0]);
    // Should find bullet items
    const items = texts.filter(t => t.content.includes('Alpha') || t.content.includes('Beta'));
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it('compiles a big-number scene with stats', () => {
    const { ir } = compileScene(`
@presentation

scene "metrics" {
  layout: big-number
  heading "Key Metrics"
  stat "340%" { label: "Growth" }
  stat "-15%" { label: "Costs" }
}
`);
    expect(ir.scenes).toHaveLength(1);
    const texts = findTexts(ir.scenes[0]);
    // Should have stat values and labels
    expect(texts.find(t => t.content === '340%')).toBeDefined();
    expect(texts.find(t => t.content === 'Growth')).toBeDefined();
  });

  it('compiles a quote scene', () => {
    const { ir } = compileScene(`
@presentation

scene "wisdom" {
  layout: quote
  quote "Speed matters." { attribution: "Peter Drucker" }
}
`);
    expect(ir.scenes).toHaveLength(1);
    const texts = findTexts(ir.scenes[0]);
    // Quote text should have curly quotes
    expect(texts.find(t => t.content.includes('Speed matters.'))).toBeDefined();
    // Attribution
    expect(texts.find(t => t.content.includes('Peter Drucker'))).toBeDefined();
  });

  it('compiles a two-column scene', () => {
    const { ir } = compileScene(`
@presentation

scene {
  layout: two-column
  heading "Comparison"
  column {
    heading "Before" { level: 2 }
    label "Old way"
  }
  column {
    heading "After" { level: 2 }
    label "New way"
  }
}
`);
    expect(ir.scenes).toHaveLength(1);
    const scene = ir.scenes[0];
    // Should have columns as containers
    const containers = scene.elements.filter(e => e.type === 'container') as IRContainer[];
    expect(containers.length).toBeGreaterThanOrEqual(2);
  });

  it('IR elements have valid bounds (0-100 range)', () => {
    const { ir } = compileScene(`
@presentation
scene { layout: title heading "Test" label "Sub" }
`);
    for (const scene of ir.scenes) {
      for (const el of scene.elements) {
        expect(el.bounds.x).toBeGreaterThanOrEqual(0);
        expect(el.bounds.y).toBeGreaterThanOrEqual(0);
        expect(el.bounds.x + el.bounds.w).toBeLessThanOrEqual(101);
        expect(el.bounds.y + el.bounds.h).toBeLessThanOrEqual(101);
      }
    }
  });

  it('without @presentation, compiles as normal diagram', () => {
    const { ir } = compile(`
flow {
  node "A" #a
  node "B" #b
  #a -> #b
}
`);
    // Standard diagram mode — should have scenes but no scene-specific structure
    expect(ir.scenes).toHaveLength(1);
    // No scene backgrounds
    expect(ir.scenes[0].elements.every(e => e.type !== 'shape' || (e as any).shape !== 'rect' || (e as any).style?.fill !== '#FFFFFF')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Scene-specific features
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// New layout types
// ---------------------------------------------------------------------------

describe('New scene layouts', () => {
  it('compiles an image-text scene', () => {
    const { ir, errors } = compileScene(`
@presentation

scene "hero" {
  layout: image-text
  heading "Product Overview"
  image "screenshot.png" { alt: "Product" }
  label "A powerful tool"
  label "Easy to use"
}
`);
    expect(errors).toEqual([]);
    expect(ir.scenes).toHaveLength(1);
    expect(ir.scenes[0].id).toBe('hero');
    const texts = findTexts(ir.scenes[0]);
    expect(texts.find(t => t.content === 'Product Overview')).toBeDefined();
    expect(texts.find(t => t.content === 'A powerful tool')).toBeDefined();
    // Image placeholder should contain alt text
    expect(texts.find(t => t.content.includes('Product'))).toBeDefined();
  });

  it('compiles an icon-grid scene', () => {
    const { ir, errors } = compileScene(`
@presentation

scene "features" {
  layout: icon-grid
  heading "Key Features"
  icon "P" { label: "Parse", description: "Fast tokenizer" }
  icon "C" { label: "Compile", description: "13-pass pipeline" }
  icon "R" { label: "Render", description: "Canvas output" }
  icon "E" { label: "Edit", description: "Real-time" }
}
`);
    expect(errors).toEqual([]);
    expect(ir.scenes).toHaveLength(1);
    const texts = findTexts(ir.scenes[0]);
    expect(texts.find(t => t.content === 'Key Features')).toBeDefined();
    expect(texts.find(t => t.content === 'P')).toBeDefined();
    expect(texts.find(t => t.content === 'Parse')).toBeDefined();
    expect(texts.find(t => t.content === 'Fast tokenizer')).toBeDefined();
  });

  it('compiles a timeline scene', () => {
    const { ir, errors } = compileScene(`
@presentation

scene "roadmap" {
  layout: timeline
  heading "Roadmap"
  step "Q1" { label: "Research" }
  step "Q2" { label: "Build" }
  step "Q3" { label: "Launch" }
}
`);
    expect(errors).toEqual([]);
    expect(ir.scenes).toHaveLength(1);
    const texts = findTexts(ir.scenes[0]);
    expect(texts.find(t => t.content === 'Roadmap')).toBeDefined();
    expect(texts.find(t => t.content === 'Q1')).toBeDefined();
    expect(texts.find(t => t.content === 'Research')).toBeDefined();
    expect(texts.find(t => t.content === 'Q2')).toBeDefined();
  });

  it('IR elements from new layouts have valid bounds', () => {
    const { ir } = compileScene(`
@presentation
scene { layout: image-text heading "T" image "img.png" label "Text" }
scene { layout: icon-grid heading "T" icon "A" { label: "X" } icon "B" { label: "Y" } }
scene { layout: timeline heading "T" step "1" { label: "S1" } step "2" { label: "S2" } }
`);
    expect(ir.scenes).toHaveLength(3);
    for (const scene of ir.scenes) {
      for (const el of scene.elements) {
        expect(el.bounds.x).toBeGreaterThanOrEqual(0);
        expect(el.bounds.y).toBeGreaterThanOrEqual(0);
        expect(el.bounds.x + el.bounds.w).toBeLessThanOrEqual(101);
        expect(el.bounds.y + el.bounds.h).toBeLessThanOrEqual(101);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Scene-specific features
// ---------------------------------------------------------------------------

describe('Scene features', () => {
  it('generates scene backgrounds', () => {
    const { ir } = compileScene(`
@presentation
scene { layout: title heading "Hi" }
`);
    expect(ir.scenes[0].background).toBeDefined();
    expect(ir.scenes[0].background!.type).toBe('solid');
  });

  it('uses scene IDs when provided', () => {
    const { ir } = compileScene(`
@presentation
scene "my-slide" { layout: title heading "Hi" }
`);
    expect(ir.scenes[0].id).toBe('my-slide');
  });

  it('generates auto IDs when no ID provided', () => {
    const { ir } = compileScene(`
@presentation
scene { layout: title heading "Hi" }
`);
    expect(ir.scenes[0].id).toMatch(/scene-\d+/);
  });

  it('respects @ratio directive in meta', () => {
    const { ir } = compileScene(`
@presentation
@ratio 4:3
scene { layout: title heading "Hi" }
`);
    expect(ir.meta.aspectRatio).toEqual({ width: 4, height: 3 });
  });

  it('uses custom transition type from @transition', () => {
    const { ir } = compileScene(`
@presentation
@transition slide-left
scene "s1" { layout: title heading "1" }
scene "s2" { layout: title heading "2" }
`);
    expect(ir.transitions).toHaveLength(1);
    expect(ir.transitions[0].type).toBe('slide-left');
  });

  it('heading fontSize is larger than body fontSize', () => {
    const { ir } = compileScene(`
@presentation
scene {
  layout: bullets
  heading "Title"
  bullet { item "Body text" }
}
`);
    const texts = findTexts(ir.scenes[0]);
    const heading = texts.find(t => t.content === 'Title');
    const bodyItem = texts.find(t => t.content.includes('Body text'));
    if (heading && bodyItem) {
      expect(heading.fontSize).toBeGreaterThan(bodyItem.fontSize);
    }
  });
});

// ---------------------------------------------------------------------------
// Element with block child (content-flexible slots)
// ---------------------------------------------------------------------------

describe('Scene E2E — element with block child', () => {
  it('heading flow compiles to container with node children', () => {
    const { ir, errors } = compileScene(`
@presentation
scene "S" {
  layout: title
  heading flow direction:right {
    node "Client" #a
    node "Server" #b
    #a -> #b "API"
  }
}
`);
    expect(errors).toEqual([]);
    expect(ir.scenes).toHaveLength(1);
    const scene = ir.scenes[0];
    // The heading slot should contain a container (from emitInlineBlock)
    const containers = scene.elements.filter(e => e.type === 'container') as IRContainer[];
    expect(containers.length).toBeGreaterThanOrEqual(1);
    // The flow container should have children (nodes + edge)
    const flowContainer = containers.find(c => c.children.length >= 2);
    expect(flowContainer).toBeDefined();
  });

  it('bullet table compiles to table in bullet slot', () => {
    const { ir, errors } = compileScene(`
@presentation
scene "S" {
  layout: bullets
  heading "Title"
  bullet table {
    "Col1" "Col2"
    "A" "B"
  }
}
`);
    expect(errors).toEqual([]);
    const scene = ir.scenes[0];
    const texts = findTexts(scene);
    // heading text should still exist
    expect(texts.find(t => t.content === 'Title')).toBeDefined();
    // table should produce a container with cell texts
    const containers = scene.elements.filter(e => e.type === 'container') as IRContainer[];
    expect(containers.length).toBeGreaterThanOrEqual(1);
  });

  it('mixed string and block children compile correctly', () => {
    const { ir, errors } = compileScene(`
@presentation
scene "S" {
  layout: bullets
  heading "Title"
  bullet { item "Normal text" }
  bullet flow {
    node "X" #x
    node "Y" #y
    #x -> #y
  }
}
`);
    expect(errors).toEqual([]);
    const scene = ir.scenes[0];
    const texts = findTexts(scene);
    expect(texts.find(t => t.content === 'Title')).toBeDefined();
    expect(texts.find(t => t.content.includes('Normal text'))).toBeDefined();
    // At least one element should be a flow container
    expect(scene.elements.length).toBeGreaterThanOrEqual(3);
  });

  it('heading with string still works (no regression)', () => {
    const { ir, errors } = compileScene(`
@presentation
scene "S" {
  layout: title
  heading "Keep Working"
  label "Subtitle"
}
`);
    expect(errors).toEqual([]);
    const texts = findTexts(ir.scenes[0]);
    const heading = texts.find(t => t.content === 'Keep Working');
    expect(heading).toBeDefined();
    expect(heading!.fontWeight).toBe('bold');
  });
});
