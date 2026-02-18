/**
 * Tests for layout assertion helpers.
 *
 * Verifies that each assertion function:
 * 1. Passes for valid layouts
 * 2. Fails for invalid layouts (with descriptive errors)
 */

import { describe, it, expect } from 'vitest';
import type { IRBounds } from '../../../src/ir/types.js';
import {
  assertChildrenWithinParent,
  assertNoOverlap,
  assertOrderedInDirection,
  assertUniformGap,
  assertCrossAlignment,
} from '../layout-assertions.js';

describe('Layout Assertions', () => {
  // -------------------------------------------------------------------------
  // assertChildrenWithinParent
  // -------------------------------------------------------------------------

  describe('assertChildrenWithinParent', () => {
    const parent: IRBounds = { x: 10, y: 10, w: 80, h: 60 };

    it('passes when all children are inside parent', () => {
      const children: IRBounds[] = [
        { x: 15, y: 15, w: 20, h: 10 },
        { x: 40, y: 20, w: 30, h: 20 },
      ];
      // Should not throw
      assertChildrenWithinParent(parent, children);
    });

    it('passes for a child exactly at parent bounds', () => {
      const children: IRBounds[] = [
        { x: 10, y: 10, w: 80, h: 60 },
      ];
      assertChildrenWithinParent(parent, children);
    });

    it('passes with empty children array', () => {
      assertChildrenWithinParent(parent, []);
    });

    it('fails when a child overflows to the right', () => {
      const children: IRBounds[] = [
        { x: 70, y: 15, w: 30, h: 10 }, // x + w = 100 > parent.x + parent.w = 90
      ];
      expect(() => {
        assertChildrenWithinParent(parent, children);
      }).toThrow();
    });

    it('fails when a child overflows below', () => {
      const children: IRBounds[] = [
        { x: 15, y: 60, w: 20, h: 20 }, // y + h = 80 > parent.y + parent.h = 70
      ];
      expect(() => {
        assertChildrenWithinParent(parent, children);
      }).toThrow();
    });

    it('fails when a child is above parent', () => {
      const children: IRBounds[] = [
        { x: 15, y: 5, w: 20, h: 10 }, // y = 5 < parent.y = 10
      ];
      expect(() => {
        assertChildrenWithinParent(parent, children);
      }).toThrow();
    });

    it('fails when a child is left of parent', () => {
      const children: IRBounds[] = [
        { x: 5, y: 15, w: 20, h: 10 }, // x = 5 < parent.x = 10
      ];
      expect(() => {
        assertChildrenWithinParent(parent, children);
      }).toThrow();
    });

    it('respects tolerance', () => {
      const children: IRBounds[] = [
        { x: 9.5, y: 10, w: 80, h: 60 }, // x is slightly outside but within tolerance
      ];
      // Should pass with tolerance of 1
      assertChildrenWithinParent(parent, children, 1);
    });
  });

  // -------------------------------------------------------------------------
  // assertNoOverlap
  // -------------------------------------------------------------------------

  describe('assertNoOverlap', () => {
    it('passes when children do not overlap', () => {
      const children: IRBounds[] = [
        { x: 0, y: 0, w: 10, h: 10 },
        { x: 15, y: 0, w: 10, h: 10 },
        { x: 30, y: 0, w: 10, h: 10 },
      ];
      assertNoOverlap(children);
    });

    it('passes when children share a single edge (touching)', () => {
      const children: IRBounds[] = [
        { x: 0, y: 0, w: 10, h: 10 },
        { x: 10, y: 0, w: 10, h: 10 }, // Shares left edge with first child's right edge
      ];
      assertNoOverlap(children);
    });

    it('passes with empty array', () => {
      assertNoOverlap([]);
    });

    it('passes with single child', () => {
      assertNoOverlap([{ x: 0, y: 0, w: 10, h: 10 }]);
    });

    it('fails when two children clearly overlap', () => {
      const children: IRBounds[] = [
        { x: 0, y: 0, w: 20, h: 20 },
        { x: 10, y: 10, w: 20, h: 20 }, // Overlaps with first child
      ];
      expect(() => {
        assertNoOverlap(children);
      }).toThrow();
    });

    it('fails when children overlap on y-axis only (but both axes intersect)', () => {
      const children: IRBounds[] = [
        { x: 0, y: 0, w: 20, h: 20 },
        { x: 5, y: 5, w: 10, h: 10 }, // Fully contained within first
      ];
      expect(() => {
        assertNoOverlap(children);
      }).toThrow();
    });

    it('does not flag non-overlapping children separated on x-axis', () => {
      const children: IRBounds[] = [
        { x: 0, y: 0, w: 10, h: 30 },
        { x: 20, y: 0, w: 10, h: 30 },
      ];
      assertNoOverlap(children);
    });
  });

  // -------------------------------------------------------------------------
  // assertOrderedInDirection
  // -------------------------------------------------------------------------

  describe('assertOrderedInDirection', () => {
    describe('right direction', () => {
      it('passes when children are ordered left to right', () => {
        const children: IRBounds[] = [
          { x: 0, y: 0, w: 10, h: 10 },
          { x: 15, y: 0, w: 10, h: 10 },
          { x: 30, y: 0, w: 10, h: 10 },
        ];
        assertOrderedInDirection(children, 'right');
      });

      it('passes when children are adjacent (no gap)', () => {
        const children: IRBounds[] = [
          { x: 0, y: 0, w: 10, h: 10 },
          { x: 10, y: 0, w: 10, h: 10 },
        ];
        assertOrderedInDirection(children, 'right');
      });

      it('fails when children are in reverse order', () => {
        const children: IRBounds[] = [
          { x: 30, y: 0, w: 10, h: 10 },
          { x: 0, y: 0, w: 10, h: 10 },
        ];
        expect(() => {
          assertOrderedInDirection(children, 'right');
        }).toThrow();
      });

      it('passes with single element', () => {
        assertOrderedInDirection([{ x: 0, y: 0, w: 10, h: 10 }], 'right');
      });

      it('passes with empty array', () => {
        assertOrderedInDirection([], 'right');
      });
    });

    describe('down direction', () => {
      it('passes when children are ordered top to bottom', () => {
        const children: IRBounds[] = [
          { x: 0, y: 0, w: 10, h: 10 },
          { x: 0, y: 15, w: 10, h: 10 },
          { x: 0, y: 30, w: 10, h: 10 },
        ];
        assertOrderedInDirection(children, 'down');
      });

      it('fails when children are in reverse order', () => {
        const children: IRBounds[] = [
          { x: 0, y: 30, w: 10, h: 10 },
          { x: 0, y: 0, w: 10, h: 10 },
        ];
        expect(() => {
          assertOrderedInDirection(children, 'down');
        }).toThrow();
      });
    });
  });

  // -------------------------------------------------------------------------
  // assertUniformGap
  // -------------------------------------------------------------------------

  describe('assertUniformGap', () => {
    describe('row direction', () => {
      it('passes when horizontal gaps match expected', () => {
        const children: IRBounds[] = [
          { x: 0, y: 0, w: 10, h: 10 },
          { x: 15, y: 0, w: 10, h: 10 },  // gap = 5
          { x: 30, y: 0, w: 10, h: 10 },  // gap = 5
        ];
        assertUniformGap(children, 'row', 5);
      });

      it('passes with zero gap', () => {
        const children: IRBounds[] = [
          { x: 0, y: 0, w: 10, h: 10 },
          { x: 10, y: 0, w: 10, h: 10 },
        ];
        assertUniformGap(children, 'row', 0);
      });

      it('fails when gaps are not uniform', () => {
        const children: IRBounds[] = [
          { x: 0, y: 0, w: 10, h: 10 },
          { x: 15, y: 0, w: 10, h: 10 },  // gap = 5
          { x: 35, y: 0, w: 10, h: 10 },  // gap = 10
        ];
        expect(() => {
          assertUniformGap(children, 'row', 5, 0.1);
        }).toThrow();
      });

      it('passes with tolerance', () => {
        const children: IRBounds[] = [
          { x: 0, y: 0, w: 10, h: 10 },
          { x: 15.3, y: 0, w: 10, h: 10 }, // gap = 5.3 (close to 5)
          { x: 30.1, y: 0, w: 10, h: 10 }, // gap = 4.8 (close to 5)
        ];
        assertUniformGap(children, 'row', 5, 0.5);
      });

      it('passes with single element (no gaps to check)', () => {
        assertUniformGap([{ x: 0, y: 0, w: 10, h: 10 }], 'row', 5);
      });
    });

    describe('col direction', () => {
      it('passes when vertical gaps match expected', () => {
        const children: IRBounds[] = [
          { x: 0, y: 0, w: 10, h: 10 },
          { x: 0, y: 20, w: 10, h: 10 },  // gap = 10
          { x: 0, y: 40, w: 10, h: 10 },  // gap = 10
        ];
        assertUniformGap(children, 'col', 10);
      });

      it('fails when vertical gaps do not match', () => {
        const children: IRBounds[] = [
          { x: 0, y: 0, w: 10, h: 10 },
          { x: 0, y: 20, w: 10, h: 10 },  // gap = 10
          { x: 0, y: 50, w: 10, h: 10 },  // gap = 20
        ];
        expect(() => {
          assertUniformGap(children, 'col', 10, 0.1);
        }).toThrow();
      });
    });
  });

  // -------------------------------------------------------------------------
  // assertCrossAlignment
  // -------------------------------------------------------------------------

  describe('assertCrossAlignment', () => {
    const parentBounds: IRBounds = { x: 0, y: 0, w: 100, h: 60 };

    describe('row direction (cross-axis = Y)', () => {
      it('verifies start alignment', () => {
        const children: IRBounds[] = [
          { x: 0, y: 0, w: 20, h: 10 },
          { x: 25, y: 0, w: 20, h: 15 },
        ];
        assertCrossAlignment(children, parentBounds, 'start', 'row');
      });

      it('verifies center alignment', () => {
        // Parent center Y = 0 + 60/2 = 30
        const children: IRBounds[] = [
          { x: 0, y: 25, w: 20, h: 10 },  // center Y = 30
          { x: 25, y: 22, w: 20, h: 16 }, // center Y = 30
        ];
        assertCrossAlignment(children, parentBounds, 'center', 'row');
      });

      it('verifies end alignment', () => {
        // Parent bottom = 60
        const children: IRBounds[] = [
          { x: 0, y: 50, w: 20, h: 10 },  // bottom = 60
          { x: 25, y: 45, w: 20, h: 15 }, // bottom = 60
        ];
        assertCrossAlignment(children, parentBounds, 'end', 'row');
      });

      it('verifies stretch alignment', () => {
        const children: IRBounds[] = [
          { x: 0, y: 0, w: 20, h: 60 },
          { x: 25, y: 0, w: 20, h: 60 },
        ];
        assertCrossAlignment(children, parentBounds, 'stretch', 'row');
      });
    });

    describe('col direction (cross-axis = X)', () => {
      it('verifies start alignment', () => {
        const children: IRBounds[] = [
          { x: 0, y: 0, w: 20, h: 10 },
          { x: 0, y: 15, w: 30, h: 10 },
        ];
        assertCrossAlignment(children, parentBounds, 'start', 'col');
      });

      it('verifies center alignment', () => {
        // Parent center X = 0 + 100/2 = 50
        const children: IRBounds[] = [
          { x: 40, y: 0, w: 20, h: 10 },  // center X = 50
          { x: 35, y: 15, w: 30, h: 10 }, // center X = 50
        ];
        assertCrossAlignment(children, parentBounds, 'center', 'col');
      });

      it('verifies end alignment', () => {
        // Parent right = 100
        const children: IRBounds[] = [
          { x: 80, y: 0, w: 20, h: 10 },  // right = 100
          { x: 70, y: 15, w: 30, h: 10 }, // right = 100
        ];
        assertCrossAlignment(children, parentBounds, 'end', 'col');
      });

      it('verifies stretch alignment', () => {
        const children: IRBounds[] = [
          { x: 0, y: 0, w: 100, h: 10 },
          { x: 0, y: 15, w: 100, h: 10 },
        ];
        assertCrossAlignment(children, parentBounds, 'stretch', 'col');
      });
    });
  });
});
