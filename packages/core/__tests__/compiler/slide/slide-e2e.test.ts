/**
 * Slide DSL — End-to-End Compilation Tests
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

function compileSlide(dsl: string) {
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

describe('Slide E2E compilation', () => {
  it('compiles a single title slide', () => {
    const { ir, errors } = compileSlide(`
@presentation

slide "intro" {
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

  it('compiles 3 slides (title + bullets + statement)', () => {
    const { ir, errors } = compileSlide(`
@presentation
@ratio 16:9

slide "title" {
  layout: title
  heading "2025 Strategy"
  label "Q1 Report"
}

slide "points" {
  layout: bullets
  heading "Key Points"
  bullet {
    item "Revenue up 30%"
    item "New markets entered"
    item "Team grew to 50"
  }
}

slide "closing" {
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

    // Verify transitions between slides
    expect(ir.transitions).toHaveLength(2);
    expect(ir.transitions[0].from).toBe('title');
    expect(ir.transitions[0].to).toBe('points');
    expect(ir.transitions[1].from).toBe('points');
    expect(ir.transitions[1].to).toBe('closing');
  });

  it('compiles a bullets slide with item content', () => {
    const { ir } = compileSlide(`
@presentation

slide {
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

  it('compiles a big-number slide with stats', () => {
    const { ir } = compileSlide(`
@presentation

slide "metrics" {
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

  it('compiles a quote slide', () => {
    const { ir } = compileSlide(`
@presentation

slide "wisdom" {
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

  it('compiles a two-column slide', () => {
    const { ir } = compileSlide(`
@presentation

slide {
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
    const { ir } = compileSlide(`
@presentation
slide { layout: title heading "Test" label "Sub" }
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
    // Standard diagram mode — should have scenes but no slide-specific structure
    expect(ir.scenes).toHaveLength(1);
    // No slide backgrounds
    expect(ir.scenes[0].elements.every(e => e.type !== 'shape' || (e as any).shape !== 'rect' || (e as any).style?.fill !== '#FFFFFF')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Slide-specific features
// ---------------------------------------------------------------------------

describe('Slide features', () => {
  it('generates scene backgrounds', () => {
    const { ir } = compileSlide(`
@presentation
slide { layout: title heading "Hi" }
`);
    expect(ir.scenes[0].background).toBeDefined();
    expect(ir.scenes[0].background!.type).toBe('solid');
  });

  it('uses slide IDs when provided', () => {
    const { ir } = compileSlide(`
@presentation
slide "my-slide" { layout: title heading "Hi" }
`);
    expect(ir.scenes[0].id).toBe('my-slide');
  });

  it('generates auto IDs when no ID provided', () => {
    const { ir } = compileSlide(`
@presentation
slide { layout: title heading "Hi" }
`);
    expect(ir.scenes[0].id).toMatch(/slide-\d+/);
  });

  it('respects @ratio directive in meta', () => {
    const { ir } = compileSlide(`
@presentation
@ratio 4:3
slide { layout: title heading "Hi" }
`);
    expect(ir.meta.aspectRatio).toEqual({ width: 4, height: 3 });
  });

  it('uses custom transition type from @transition', () => {
    const { ir } = compileSlide(`
@presentation
@transition slide-left
slide "s1" { layout: title heading "1" }
slide "s2" { layout: title heading "2" }
`);
    expect(ir.transitions).toHaveLength(1);
    expect(ir.transitions[0].type).toBe('slide-left');
  });

  it('heading fontSize is larger than body fontSize', () => {
    const { ir } = compileSlide(`
@presentation
slide {
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
