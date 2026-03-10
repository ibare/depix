import { describe, it, expect } from 'vitest';
import {
  computePieChartPositions,
  type ChartDataPoint,
} from '../../../src/compiler/layout/chart-layout.js';

describe('computePieChartPositions', () => {
  const bounds = { x: 0, y: 0, w: 100, h: 100 };

  it('returns empty for no data', () => {
    const result = computePieChartPositions(bounds, []);
    expect(result.wedges).toHaveLength(0);
    expect(result.totalValue).toBe(0);
    expect(result.radius).toBe(0);
  });

  it('creates wedges for each data item', () => {
    const data: ChartDataPoint[] = [
      { category: 'A', value: 25 },
      { category: 'B', value: 50 },
      { category: 'C', value: 25 },
    ];
    const result = computePieChartPositions(bounds, data);
    expect(result.wedges).toHaveLength(3);
    expect(result.totalValue).toBe(100);
  });

  it('calculates correct percentages', () => {
    const data: ChartDataPoint[] = [
      { category: 'A', value: 25 },
      { category: 'B', value: 75 },
    ];
    const result = computePieChartPositions(bounds, data);
    expect(result.wedges[0].percentage).toBeCloseTo(25, 5);
    expect(result.wedges[1].percentage).toBeCloseTo(75, 5);
  });

  it('generates valid SVG path data for each wedge', () => {
    const data: ChartDataPoint[] = [
      { category: 'A', value: 30 },
      { category: 'B', value: 70 },
    ];
    const result = computePieChartPositions(bounds, data);

    for (const wedge of result.wedges) {
      // Path should start with M, contain L, A, and end with Z
      expect(wedge.pathD).toMatch(/^M\s/);
      expect(wedge.pathD).toContain('L');
      expect(wedge.pathD).toContain('A');
      expect(wedge.pathD).toMatch(/Z$/);
    }
  });

  it('center is at bounds midpoint', () => {
    const result = computePieChartPositions(bounds, [
      { category: 'A', value: 50 },
    ]);
    expect(result.center.x).toBe(50);
    expect(result.center.y).toBe(50);
  });

  it('radius is proportional to min(w, h)', () => {
    const result = computePieChartPositions(bounds, [
      { category: 'A', value: 50 },
    ]);
    expect(result.radius).toBe(Math.min(100, 100) * 0.35);
  });

  it('handles non-square bounds', () => {
    const wideBounds = { x: 10, y: 20, w: 80, h: 40 };
    const result = computePieChartPositions(wideBounds, [
      { category: 'A', value: 30 },
      { category: 'B', value: 70 },
    ]);
    expect(result.center.x).toBe(50); // 10 + 80/2
    expect(result.center.y).toBe(40); // 20 + 40/2
    expect(result.radius).toBe(40 * 0.35); // min(80, 40) * 0.35
  });

  it('each wedge has label bounds', () => {
    const data: ChartDataPoint[] = [
      { category: 'X', value: 40 },
      { category: 'Y', value: 60 },
    ];
    const result = computePieChartPositions(bounds, data);
    for (const wedge of result.wedges) {
      expect(wedge.labelBounds.w).toBeGreaterThan(0);
      expect(wedge.labelBounds.h).toBeGreaterThan(0);
    }
  });

  it('handles all-zero values', () => {
    const data: ChartDataPoint[] = [
      { category: 'A', value: 0 },
      { category: 'B', value: 0 },
    ];
    const result = computePieChartPositions(bounds, data);
    expect(result.totalValue).toBe(0);
    expect(result.wedges).toHaveLength(0);
  });

  it('single item gets 100%', () => {
    const data: ChartDataPoint[] = [
      { category: 'Only', value: 42 },
    ];
    const result = computePieChartPositions(bounds, data);
    expect(result.wedges).toHaveLength(1);
    expect(result.wedges[0].percentage).toBeCloseTo(100, 5);
  });

  it('preserves category names', () => {
    const data: ChartDataPoint[] = [
      { category: 'Alpha', value: 10 },
      { category: 'Beta', value: 20 },
    ];
    const result = computePieChartPositions(bounds, data);
    expect(result.wedges[0].category).toBe('Alpha');
    expect(result.wedges[1].category).toBe('Beta');
  });
});
