import { describe, it, expect } from 'vitest';
import { layoutTable } from '../../../src/compiler/layout/table-layout.js';
import type { LayoutChild, TableLayoutConfig } from '../../../src/compiler/layout/types.js';

describe('layoutTable', () => {
  const baseBounds = { x: 0, y: 0, w: 100, h: 100 };

  it('returns empty childBounds for no children', () => {
    const result = layoutTable([], { bounds: baseBounds, headerRows: 1, gap: 1 });
    expect(result.childBounds).toHaveLength(0);
    expect(result.containerBounds).toEqual(baseBounds);
  });

  it('distributes rows vertically within bounds', () => {
    const children: LayoutChild[] = [
      { id: 'r0', width: 100, height: 10 },
      { id: 'r1', width: 100, height: 10 },
      { id: 'r2', width: 100, height: 10 },
    ];
    const result = layoutTable(children, { bounds: baseBounds, headerRows: 1, gap: 1 });

    expect(result.childBounds).toHaveLength(3);
    // All rows should have full width
    for (const b of result.childBounds) {
      expect(b.w).toBe(100);
      expect(b.x).toBe(0);
    }
  });

  it('gives header rows more height than data rows', () => {
    const children: LayoutChild[] = [
      { id: 'header', width: 100, height: 10 },
      { id: 'data1', width: 100, height: 10 },
      { id: 'data2', width: 100, height: 10 },
    ];
    const result = layoutTable(children, { bounds: baseBounds, headerRows: 1, gap: 0 });

    const headerH = result.childBounds[0].h;
    const dataH = result.childBounds[1].h;
    expect(headerH).toBeGreaterThan(dataH);
  });

  it('all rows start at correct y positions', () => {
    const children: LayoutChild[] = [
      { id: 'r0', width: 100, height: 10 },
      { id: 'r1', width: 100, height: 10 },
    ];
    const gap = 2;
    const result = layoutTable(children, { bounds: baseBounds, headerRows: 1, gap });

    expect(result.childBounds[0].y).toBe(0);
    expect(result.childBounds[1].y).toBeCloseTo(result.childBounds[0].h + gap);
  });

  it('respects bounds offset', () => {
    const bounds = { x: 10, y: 20, w: 80, h: 60 };
    const children: LayoutChild[] = [
      { id: 'r0', width: 80, height: 10 },
      { id: 'r1', width: 80, height: 10 },
    ];
    const result = layoutTable(children, { bounds, headerRows: 1, gap: 0 });

    expect(result.childBounds[0].x).toBe(10);
    expect(result.childBounds[0].y).toBe(20);
    expect(result.childBounds[0].w).toBe(80);
  });

  it('handles single row table', () => {
    const children: LayoutChild[] = [{ id: 'r0', width: 100, height: 10 }];
    const result = layoutTable(children, { bounds: baseBounds, headerRows: 1, gap: 0 });

    expect(result.childBounds).toHaveLength(1);
    expect(result.childBounds[0].h).toBe(100);
  });
});
