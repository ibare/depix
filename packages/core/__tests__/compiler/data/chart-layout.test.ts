import { describe, it, expect } from 'vitest';
import { layoutChart } from '../../../src/compiler/layout/chart-layout.js';
import type { LayoutChild } from '../../../src/compiler/layout/types.js';

describe('layoutChart', () => {
  const baseBounds = { x: 0, y: 0, w: 100, h: 100 };

  it('returns empty childBounds for no children', () => {
    const result = layoutChart([], { bounds: baseBounds, gap: 2 });
    expect(result.childBounds).toHaveLength(0);
    expect(result.containerBounds).toEqual(baseBounds);
  });

  it('creates bars with widths proportional to count', () => {
    const children: LayoutChild[] = [
      { id: 'bar0', width: 20, height: 100 },
      { id: 'bar1', width: 20, height: 50 },
      { id: 'bar2', width: 20, height: 75 },
    ];
    const result = layoutChart(children, { bounds: baseBounds, gap: 0 });

    expect(result.childBounds).toHaveLength(3);
    // All bars should have same width
    const widths = result.childBounds.map(b => b.w);
    expect(widths[0]).toBeCloseTo(widths[1]);
    expect(widths[1]).toBeCloseTo(widths[2]);
  });

  it('scales bar heights relative to max value', () => {
    const children: LayoutChild[] = [
      { id: 'bar0', width: 20, height: 100 },
      { id: 'bar1', width: 20, height: 50 },
    ];
    const result = layoutChart(children, { bounds: baseBounds, gap: 0 });

    // The tallest bar should use full plot height
    const maxBarH = Math.max(...result.childBounds.map(b => b.h));
    const minBarH = Math.min(...result.childBounds.map(b => b.h));
    expect(maxBarH).toBeGreaterThan(minBarH);
    expect(minBarH / maxBarH).toBeCloseTo(0.5, 1);
  });

  it('bars align to bottom of plot area', () => {
    const children: LayoutChild[] = [
      { id: 'bar0', width: 20, height: 100 },
      { id: 'bar1', width: 20, height: 50 },
    ];
    const result = layoutChart(children, { bounds: baseBounds, gap: 0 });

    // All bars should end at the same y (bottom of plot area)
    const bottoms = result.childBounds.map(b => b.y + b.h);
    expect(bottoms[0]).toBeCloseTo(bottoms[1]);
  });

  it('leaves margin for axis labels', () => {
    const children: LayoutChild[] = [
      { id: 'bar0', width: 20, height: 100 },
    ];
    const result = layoutChart(children, { bounds: baseBounds, gap: 0 });

    // Bar should start after left axis margin
    expect(result.childBounds[0].x).toBeGreaterThan(0);
  });

  it('handles single bar', () => {
    const children: LayoutChild[] = [
      { id: 'bar0', width: 20, height: 100 },
    ];
    const result = layoutChart(children, { bounds: baseBounds, gap: 0 });
    expect(result.childBounds).toHaveLength(1);
    expect(result.childBounds[0].h).toBeGreaterThan(0);
  });

  it('applies gap between bars', () => {
    const children: LayoutChild[] = [
      { id: 'bar0', width: 20, height: 100 },
      { id: 'bar1', width: 20, height: 100 },
    ];
    const result = layoutChart(children, { bounds: baseBounds, gap: 5 });

    const gap = result.childBounds[1].x - (result.childBounds[0].x + result.childBounds[0].w);
    expect(gap).toBeCloseTo(5);
  });
});
