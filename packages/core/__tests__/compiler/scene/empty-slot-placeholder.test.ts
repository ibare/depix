/**
 * Empty Slot Placeholder Tests
 *
 * When a scene has a layout with multiple slots but not all slots have content,
 * the compiler emits placeholder IRContainer elements for empty slots with
 * `origin.placeholder === true`.
 */

import { describe, it, expect } from 'vitest';
import { compile } from '../../../src/compiler/compiler.js';
import type { IRContainer } from '../../../src/ir/types.js';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function findPlaceholders(sceneIndex: number, dsl: string): IRContainer[] {
  const { ir, errors } = compile(dsl);
  expect(errors).toEqual([]);
  const scene = ir.scenes[sceneIndex];
  return scene.elements.filter(
    (el): el is IRContainer =>
      el.type === 'container' && el.origin?.placeholder === true,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Empty slot placeholders', () => {
  it('header layout, only body content — emits placeholder for header slot', () => {
    const placeholders = findPlaceholders(0, `
@presentation
scene {
  layout: header
  body: heading "Test"
}
`);
    expect(placeholders).toHaveLength(1);
    expect(placeholders[0].origin?.slotName).toBe('header');
    expect(placeholders[0].origin?.placeholder).toBe(true);
    expect(placeholders[0].children).toHaveLength(0);
  });

  it('split layout, only left content — emits placeholder for right slot', () => {
    const placeholders = findPlaceholders(0, `
@presentation
scene {
  layout: split
  left: heading "Test"
}
`);
    expect(placeholders).toHaveLength(1);
    expect(placeholders[0].origin?.slotName).toBe('right');
    expect(placeholders[0].origin?.placeholder).toBe(true);
    expect(placeholders[0].children).toHaveLength(0);
  });

  it('header layout, both slots filled — no placeholders', () => {
    const placeholders = findPlaceholders(0, `
@presentation
scene {
  layout: header
  header: heading "H"
  body: text "B"
}
`);
    expect(placeholders).toHaveLength(0);
  });

  it('full layout, body filled — no placeholders', () => {
    const placeholders = findPlaceholders(0, `
@presentation
scene {
  layout: full
  body: heading "Test"
}
`);
    expect(placeholders).toHaveLength(0);
  });

  it('placeholder has correct bounds — non-zero width and height', () => {
    const placeholders = findPlaceholders(0, `
@presentation
scene {
  layout: header
  body: heading "Test"
}
`);
    expect(placeholders).toHaveLength(1);
    const { bounds } = placeholders[0];
    expect(bounds.w).toBeGreaterThan(0);
    expect(bounds.h).toBeGreaterThan(0);
  });
});
