import { describe, it, expect } from 'vitest';
import {
  computeLineChartPositions,
  type ChartDataPoint,
} from '../../../src/compiler/layout/chart-layout.js';

describe('computeLineChartPositions', () => {
  const bounds = { x: 0, y: 0, w: 100, h: 100 };

  it('returns empty for no data', () => {
    const result = computeLineChartPositions(bounds, []);
    expect(result.points).toHaveLength(0);
    expect(result.lines).toHaveLength(0);
    expect(result.maxValue).toBe(0);
  });

  it('creates points for each data item', () => {
    const data: ChartDataPoint[] = [
      { category: 'A', value: 10 },
      { category: 'B', value: 20 },
      { category: 'C', value: 30 },
    ];
    const result = computeLineChartPositions(bounds, data);
    expect(result.points).toHaveLength(3);
    expect(result.maxValue).toBe(30);
  });

  it('creates line segments connecting adjacent points', () => {
    const data: ChartDataPoint[] = [
      { category: 'A', value: 10 },
      { category: 'B', value: 20 },
      { category: 'C', value: 30 },
    ];
    const result = computeLineChartPositions(bounds, data);
    expect(result.lines).toHaveLength(2);

    // First segment connects point 0 to point 1
    expect(result.lines[0].from).toEqual(result.points[0].center);
    expect(result.lines[0].to).toEqual(result.points[1].center);

    // Second segment connects point 1 to point 2
    expect(result.lines[1].from).toEqual(result.points[1].center);
    expect(result.lines[1].to).toEqual(result.points[2].center);
  });

  it('distributes points evenly along x-axis', () => {
    const data: ChartDataPoint[] = [
      { category: 'A', value: 10 },
      { category: 'B', value: 20 },
      { category: 'C', value: 30 },
    ];
    const result = computeLineChartPositions(bounds, data);
    const xs = result.points.map(p => p.center.x);
    // Points should be evenly distributed
    const gap1 = xs[1] - xs[0];
    const gap2 = xs[2] - xs[1];
    expect(gap1).toBeCloseTo(gap2, 5);
  });

  it('scales y-values so max value is at top of plot', () => {
    const data: ChartDataPoint[] = [
      { category: 'A', value: 50 },
      { category: 'B', value: 100 },
    ];
    const result = computeLineChartPositions(bounds, data);
    // Max value point should be higher (smaller y) than smaller value
    expect(result.points[1].center.y).toBeLessThan(result.points[0].center.y);
  });

  it('provides axes', () => {
    const data: ChartDataPoint[] = [
      { category: 'A', value: 10 },
      { category: 'B', value: 20 },
    ];
    const result = computeLineChartPositions(bounds, data);
    expect(result.axes.yAxis.from.x).toBe(result.axes.yAxis.to.x);
    expect(result.axes.xAxis.from.y).toBe(result.axes.xAxis.to.y);
    expect(result.axes.yLabelMax.content).toBe('20');
  });

  it('handles single data point', () => {
    const data: ChartDataPoint[] = [{ category: 'A', value: 42 }];
    const result = computeLineChartPositions(bounds, data);
    expect(result.points).toHaveLength(1);
    expect(result.lines).toHaveLength(0);
  });

  it('each point has a positive radius', () => {
    const data: ChartDataPoint[] = [
      { category: 'A', value: 10 },
      { category: 'B', value: 20 },
    ];
    const result = computeLineChartPositions(bounds, data);
    for (const pt of result.points) {
      expect(pt.radius).toBeGreaterThan(0);
    }
  });

  it('each point has label bounds', () => {
    const data: ChartDataPoint[] = [
      { category: 'X', value: 5 },
      { category: 'Y', value: 15 },
    ];
    const result = computeLineChartPositions(bounds, data);
    for (const pt of result.points) {
      expect(pt.labelBounds.w).toBeGreaterThan(0);
      expect(pt.labelBounds.h).toBeGreaterThan(0);
      expect(pt.category).toBeTruthy();
    }
  });
});
