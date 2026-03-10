/**
 * Slide Layout Tests
 *
 * Unit tests for each of the 8 slide layout functions.
 */

import { describe, it, expect } from 'vitest';
import type { IRBounds } from '../../../src/ir/types.js';
import type { SlideLayoutChild, SlideLayoutConfig } from '../../../src/compiler/layout/types.js';
import {
  layoutSlide,
  layoutSlideTitle,
  layoutSlideStatement,
  layoutSlideBullets,
  layoutSlideTwoColumn,
  layoutSlideThreeColumn,
  layoutSlideBigNumber,
  layoutSlideQuote,
  layoutSlideCustom,
} from '../../../src/compiler/layout/slide-layout.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CANVAS: IRBounds = { x: 0, y: 0, w: 100, h: 100 };

function defaultConfig(bounds = CANVAS): SlideLayoutConfig {
  return {
    bounds,
    padding: 8,
    headingHeight: 18,
    columnGap: 4,
    itemGap: 2,
  };
}

function child(contentType: SlideLayoutChild['contentType'], id = `c-${contentType}`): SlideLayoutChild {
  return { id, width: 0, height: 0, contentType };
}

function boundsWithin(b: IRBounds, container: IRBounds): boolean {
  return (
    b.x >= container.x - 0.01 &&
    b.y >= container.y - 0.01 &&
    b.x + b.w <= container.x + container.w + 0.01 &&
    b.y + b.h <= container.y + container.h + 0.01
  );
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

describe('layoutSlide dispatcher', () => {
  it('dispatches title layout', () => {
    const result = layoutSlide('title', [child('heading')], defaultConfig());
    expect(result.childBounds).toHaveLength(1);
  });

  it('dispatches all 8 layout types without error', () => {
    const types = ['title', 'statement', 'bullets', 'two-column', 'three-column', 'big-number', 'quote', 'custom'] as const;
    for (const type of types) {
      const result = layoutSlide(type, [child('heading')], defaultConfig());
      expect(result.childBounds).toHaveLength(1);
      expect(result.containerBounds).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Title layout
// ---------------------------------------------------------------------------

describe('layoutSlideTitle', () => {
  it('positions heading in vertical center region', () => {
    const result = layoutSlideTitle(
      [child('heading'), child('label')],
      defaultConfig(),
    );
    expect(result.childBounds).toHaveLength(2);
    // Heading should be in upper-middle area
    expect(result.childBounds[0].y).toBeGreaterThan(20);
    expect(result.childBounds[0].y).toBeLessThan(50);
  });

  it('positions labels below heading', () => {
    const result = layoutSlideTitle(
      [child('heading'), child('label', 'l1'), child('label', 'l2')],
      defaultConfig(),
    );
    expect(result.childBounds[1].y).toBeGreaterThan(result.childBounds[0].y);
    expect(result.childBounds[2].y).toBeGreaterThan(result.childBounds[1].y);
  });

  it('all bounds are within canvas', () => {
    const result = layoutSlideTitle(
      [child('heading'), child('label')],
      defaultConfig(),
    );
    for (const b of result.childBounds) {
      expect(boundsWithin(b, CANVAS)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Statement layout
// ---------------------------------------------------------------------------

describe('layoutSlideStatement', () => {
  it('vertically centers heading', () => {
    const result = layoutSlideStatement([child('heading')], defaultConfig());
    const b = result.childBounds[0];
    const centerY = b.y + b.h / 2;
    expect(centerY).toBeGreaterThan(30);
    expect(centerY).toBeLessThan(70);
  });

  it('label follows heading', () => {
    const result = layoutSlideStatement(
      [child('heading'), child('label')],
      defaultConfig(),
    );
    expect(result.childBounds[1].y).toBeGreaterThan(result.childBounds[0].y);
  });
});

// ---------------------------------------------------------------------------
// Bullets layout
// ---------------------------------------------------------------------------

describe('layoutSlideBullets', () => {
  it('heading at top, bullet below', () => {
    const result = layoutSlideBullets(
      [child('heading'), child('bullet')],
      defaultConfig(),
    );
    expect(result.childBounds[0].y).toBeLessThan(result.childBounds[1].y);
  });

  it('bullet area fills remaining space', () => {
    const result = layoutSlideBullets(
      [child('heading'), child('bullet')],
      defaultConfig(),
    );
    const bulletBounds = result.childBounds[1];
    expect(bulletBounds.h).toBeGreaterThan(40);
  });
});

// ---------------------------------------------------------------------------
// Two-column layout
// ---------------------------------------------------------------------------

describe('layoutSlideTwoColumn', () => {
  it('heading at top, two columns side by side', () => {
    const result = layoutSlideTwoColumn(
      [child('heading'), child('column', 'col1'), child('column', 'col2')],
      defaultConfig(),
    );
    expect(result.childBounds).toHaveLength(3);
    // Columns should be side by side
    const col1 = result.childBounds[1];
    const col2 = result.childBounds[2];
    expect(col1.x).toBeLessThan(col2.x);
    expect(col1.y).toBeCloseTo(col2.y, 0);
  });

  it('columns have roughly equal width', () => {
    const result = layoutSlideTwoColumn(
      [child('heading'), child('column', 'c1'), child('column', 'c2')],
      defaultConfig(),
    );
    const c1w = result.childBounds[1].w;
    const c2w = result.childBounds[2].w;
    expect(Math.abs(c1w - c2w)).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// Three-column layout
// ---------------------------------------------------------------------------

describe('layoutSlideThreeColumn', () => {
  it('positions three columns side by side', () => {
    const result = layoutSlideThreeColumn(
      [child('heading'), child('column', 'c1'), child('column', 'c2'), child('column', 'c3')],
      defaultConfig(),
    );
    const c1 = result.childBounds[1];
    const c2 = result.childBounds[2];
    const c3 = result.childBounds[3];
    expect(c1.x).toBeLessThan(c2.x);
    expect(c2.x).toBeLessThan(c3.x);
  });
});

// ---------------------------------------------------------------------------
// Big-number layout
// ---------------------------------------------------------------------------

describe('layoutSlideBigNumber', () => {
  it('heading at top, stats in grid below', () => {
    const result = layoutSlideBigNumber(
      [child('heading'), child('stat', 's1'), child('stat', 's2'), child('stat', 's3')],
      defaultConfig(),
    );
    // Heading above stats
    expect(result.childBounds[0].y).toBeLessThan(result.childBounds[1].y);
    // Stats horizontally distributed
    expect(result.childBounds[1].x).toBeLessThan(result.childBounds[2].x);
    expect(result.childBounds[2].x).toBeLessThan(result.childBounds[3].x);
  });

  it('single stat is centered', () => {
    const result = layoutSlideBigNumber(
      [child('heading'), child('stat')],
      defaultConfig(),
    );
    const stat = result.childBounds[1];
    expect(stat.w).toBeGreaterThan(50);
  });
});

// ---------------------------------------------------------------------------
// Quote layout
// ---------------------------------------------------------------------------

describe('layoutSlideQuote', () => {
  it('vertically centers quote', () => {
    const result = layoutSlideQuote([child('quote')], defaultConfig());
    const b = result.childBounds[0];
    const centerY = b.y + b.h / 2;
    expect(centerY).toBeGreaterThan(30);
    expect(centerY).toBeLessThan(70);
  });

  it('attribution label below quote', () => {
    const result = layoutSlideQuote(
      [child('quote'), child('label')],
      defaultConfig(),
    );
    expect(result.childBounds[1].y).toBeGreaterThan(result.childBounds[0].y);
  });
});

// ---------------------------------------------------------------------------
// Custom layout
// ---------------------------------------------------------------------------

describe('layoutSlideCustom', () => {
  it('evenly distributes children', () => {
    const result = layoutSlideCustom(
      [child('heading'), child('label'), child('label')],
      defaultConfig(),
    );
    expect(result.childBounds).toHaveLength(3);
    expect(result.childBounds[0].y).toBeLessThan(result.childBounds[1].y);
    expect(result.childBounds[1].y).toBeLessThan(result.childBounds[2].y);
  });

  it('handles empty children', () => {
    const result = layoutSlideCustom([], defaultConfig());
    expect(result.childBounds).toHaveLength(0);
  });
});
