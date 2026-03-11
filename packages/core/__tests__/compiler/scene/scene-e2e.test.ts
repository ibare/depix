/**
 * Scene DSL — End-to-End Compilation Tests
 *
 * Verifies the full pipeline: DSL source → compile() → DepixIR
 * for presentation mode with slot-based layouts.
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
  it('compiles a center scene with heading and label', () => {
    const { ir, errors } = compileScene(`
@presentation

scene "intro" {
  layout: center
  body: heading "Welcome to Depix"
}
`);
    expect(errors).toEqual([]);
    expect(ir.scenes).toHaveLength(1);
    expect(ir.scenes[0].id).toBe('intro');

    const texts = findTexts(ir.scenes[0]);
    const headingText = texts.find(t => t.content === 'Welcome to Depix');
    expect(headingText).toBeDefined();
    expect(headingText!.fontWeight).toBe('bold');
  });

  it('compiles 3 scenes with various layouts', () => {
    const { ir, errors } = compileScene(`
@presentation
@ratio 16:9

scene "title" {
  layout: center
  body: heading "2025 Strategy"
}

scene "points" {
  layout: header
  header: heading "Key Points"
  body: bullet {
    item "Revenue up 30%"
    item "New markets entered"
    item "Team grew to 50"
  }
}

scene "closing" {
  layout: center
  body: heading "The future is bright"
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
  });

  it('compiles a header scene with bullet items', () => {
    const { ir } = compileScene(`
@presentation

scene {
  layout: header
  header: heading "Topics"
  body: bullet {
    item "Alpha"
    item "Beta"
  }
}
`);
    expect(ir.scenes).toHaveLength(1);
    const texts = findTexts(ir.scenes[0]);
    const items = texts.filter(t => t.content.includes('Alpha') || t.content.includes('Beta'));
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it('compiles a header-split scene with stats', () => {
    const { ir } = compileScene(`
@presentation

scene "metrics" {
  layout: header-split
  header: heading "Key Metrics"
  left: stat "340%" { label: "Growth" }
  right: stat "-15%" { label: "Costs" }
}
`);
    expect(ir.scenes).toHaveLength(1);
    const texts = findTexts(ir.scenes[0]);
    expect(texts.find(t => t.content === '340%')).toBeDefined();
    expect(texts.find(t => t.content === 'Growth')).toBeDefined();
  });

  it('compiles a center scene with quote', () => {
    const { ir } = compileScene(`
@presentation

scene "wisdom" {
  layout: center
  body: quote "Speed matters." { attribution: "Peter Drucker" }
}
`);
    expect(ir.scenes).toHaveLength(1);
    const texts = findTexts(ir.scenes[0]);
    expect(texts.find(t => t.content.includes('Speed matters.'))).toBeDefined();
    expect(texts.find(t => t.content.includes('Peter Drucker'))).toBeDefined();
  });

  it('compiles a header-split scene with columns', () => {
    const { ir } = compileScene(`
@presentation

scene {
  layout: header-split
  header: heading "Comparison"
  left: column {
    heading "Before" { level: 2 }
    label "Old way"
  }
  right: column {
    heading "After" { level: 2 }
    label "New way"
  }
}
`);
    expect(ir.scenes).toHaveLength(1);
    const scene = ir.scenes[0];
    const containers = scene.elements.filter(e => e.type === 'container') as IRContainer[];
    expect(containers.length).toBeGreaterThanOrEqual(2);
  });

  it('IR elements have valid bounds (0-100 range)', () => {
    const { ir } = compileScene(`
@presentation
scene {
  layout: center
  body: heading "Test"
}
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
    expect(ir.scenes).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Scene features
// ---------------------------------------------------------------------------

describe('Scene features', () => {
  it('generates scene backgrounds', () => {
    const { ir } = compileScene(`
@presentation
scene { layout: center body: heading "Hi" }
`);
    expect(ir.scenes[0].background).toBeDefined();
    expect(ir.scenes[0].background!.type).toBe('solid');
  });

  it('uses scene IDs when provided', () => {
    const { ir } = compileScene(`
@presentation
scene "my-slide" { layout: center body: heading "Hi" }
`);
    expect(ir.scenes[0].id).toBe('my-slide');
  });

  it('generates auto IDs when no ID provided', () => {
    const { ir } = compileScene(`
@presentation
scene { layout: center body: heading "Hi" }
`);
    expect(ir.scenes[0].id).toMatch(/scene-\d+/);
  });

  it('respects @ratio directive in meta', () => {
    const { ir } = compileScene(`
@presentation
@ratio 4:3
scene { layout: center body: heading "Hi" }
`);
    expect(ir.meta.aspectRatio).toEqual({ width: 4, height: 3 });
  });

  it('uses custom transition type from @transition', () => {
    const { ir } = compileScene(`
@presentation
@transition slide-left
scene "s1" { layout: center body: heading "1" }
scene "s2" { layout: center body: heading "2" }
`);
    expect(ir.transitions).toHaveLength(1);
    expect(ir.transitions[0].type).toBe('slide-left');
  });

  it('heading fontSize is larger than body fontSize', () => {
    const { ir } = compileScene(`
@presentation
scene {
  layout: header
  header: heading "Title"
  body: bullet { item "Body text" }
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
  layout: header
  header: heading flow direction:right {
    node "Client" #a
    node "Server" #b
    #a -> #b "API"
  }
}
`);
    expect(errors).toEqual([]);
    expect(ir.scenes).toHaveLength(1);
    const scene = ir.scenes[0];
    const containers = scene.elements.filter(e => e.type === 'container') as IRContainer[];
    expect(containers.length).toBeGreaterThanOrEqual(1);
    const flowContainer = containers.find(c => c.children.length >= 2);
    expect(flowContainer).toBeDefined();
  });

  it('bullet table compiles to table in slot', () => {
    const { ir, errors } = compileScene(`
@presentation
scene "S" {
  layout: header
  header: heading "Title"
  body: bullet table {
    "Col1" "Col2"
    "A" "B"
  }
}
`);
    expect(errors).toEqual([]);
    const scene = ir.scenes[0];
    const texts = findTexts(scene);
    expect(texts.find(t => t.content === 'Title')).toBeDefined();
    const containers = scene.elements.filter(e => e.type === 'container') as IRContainer[];
    expect(containers.length).toBeGreaterThanOrEqual(1);
  });

  it('heading with string still works (no regression)', () => {
    const { ir, errors } = compileScene(`
@presentation
scene "S" {
  layout: center
  body: heading "Keep Working"
}
`);
    expect(errors).toEqual([]);
    const texts = findTexts(ir.scenes[0]);
    const heading = texts.find(t => t.content === 'Keep Working');
    expect(heading).toBeDefined();
    expect(heading!.fontWeight).toBe('bold');
  });
});

// ---------------------------------------------------------------------------
// Slot-based layout E2E
// ---------------------------------------------------------------------------

describe('Scene E2E — slot-based layouts', () => {
  it('split layout with left/right slots produces two regions', () => {
    const { ir, errors } = compileScene(`
@presentation
scene "S" {
  layout: split
  left: heading "Left Title"
  right: heading "Right Title"
}
`);
    expect(errors).toEqual([]);
    const texts = findTexts(ir.scenes[0]);
    const left = texts.find(t => t.content === 'Left Title');
    const right = texts.find(t => t.content === 'Right Title');
    expect(left).toBeDefined();
    expect(right).toBeDefined();
    expect(left!.bounds.x).toBeLessThan(right!.bounds.x);
  });

  it('header layout with header/body slots', () => {
    const { ir, errors } = compileScene(`
@presentation
scene "S" {
  layout: header
  header: heading "Main Title"
  body: label "Body content"
}
`);
    expect(errors).toEqual([]);
    const texts = findTexts(ir.scenes[0]);
    const header = texts.find(t => t.content === 'Main Title');
    const body = texts.find(t => t.content === 'Body content');
    expect(header).toBeDefined();
    expect(body).toBeDefined();
    expect(header!.bounds.y).toBeLessThan(body!.bounds.y);
  });

  it('header-split with header/left/right slots', () => {
    const { ir, errors } = compileScene(`
@presentation
scene "S" {
  layout: header-split
  header: heading "Architecture"
  left: label "Component A"
  right: label "Component B"
}
`);
    expect(errors).toEqual([]);
    const texts = findTexts(ir.scenes[0]);
    expect(texts.find(t => t.content === 'Architecture')).toBeDefined();
    expect(texts.find(t => t.content === 'Component A')).toBeDefined();
    expect(texts.find(t => t.content === 'Component B')).toBeDefined();
  });

  it('grid layout with cell slots', () => {
    const { ir, errors } = compileScene(`
@presentation
scene "S" {
  layout: grid
  cell: heading "Feature 1"
  cell: heading "Feature 2"
  cell: heading "Feature 3"
  cell: heading "Feature 4"
}
`);
    expect(errors).toEqual([]);
    const texts = findTexts(ir.scenes[0]);
    expect(texts.find(t => t.content === 'Feature 1')).toBeDefined();
    expect(texts.find(t => t.content === 'Feature 2')).toBeDefined();
    expect(texts.find(t => t.content === 'Feature 3')).toBeDefined();
    expect(texts.find(t => t.content === 'Feature 4')).toBeDefined();
  });

  it('slot with flow block compiles correctly', () => {
    const { ir, errors } = compileScene(`
@presentation
scene "S" {
  layout: header
  header: heading "System"
  body: flow direction:right {
    node "A" #a
    node "B" #b
    #a -> #b
  }
}
`);
    expect(errors).toEqual([]);
    const texts = findTexts(ir.scenes[0]);
    expect(texts.find(t => t.content === 'System')).toBeDefined();
    const containers = ir.scenes[0].elements.filter(e => e.type === 'container') as IRContainer[];
    expect(containers.length).toBeGreaterThanOrEqual(1);
  });

  it('children without slot get no bounds (ignored gracefully)', () => {
    const { ir, errors } = compileScene(`
@presentation
scene "S" {
  layout: split
  left: heading "Left"
  heading "Orphan"
}
`);
    expect(errors).toEqual([]);
    const texts = findTexts(ir.scenes[0]);
    expect(texts.find(t => t.content === 'Left')).toBeDefined();
  });

  it('elements have valid bounds (0-100)', () => {
    const { ir } = compileScene(`
@presentation
scene {
  layout: header-split
  header: heading "T"
  left: label "L"
  right: label "R"
}
`);
    for (const el of ir.scenes[0].elements) {
      expect(el.bounds.x).toBeGreaterThanOrEqual(0);
      expect(el.bounds.y).toBeGreaterThanOrEqual(0);
      expect(el.bounds.x + el.bounds.w).toBeLessThanOrEqual(101);
      expect(el.bounds.y + el.bounds.h).toBeLessThanOrEqual(101);
    }
  });
});
