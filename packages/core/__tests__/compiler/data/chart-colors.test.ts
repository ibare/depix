import { describe, it, expect } from 'vitest';
import { getChartColor, CHART_PALETTE_KEYS } from '../../../src/compiler/layout/chart-colors.js';
import { lightTheme, darkTheme } from '../../../src/theme/builtin-themes.js';

describe('CHART_PALETTE_KEYS', () => {
  it('has 8 palette keys', () => {
    expect(CHART_PALETTE_KEYS).toHaveLength(8);
  });

  it('starts with accent', () => {
    expect(CHART_PALETTE_KEYS[0]).toBe('accent');
  });

  it('contains all expected semantic colors', () => {
    expect(CHART_PALETTE_KEYS).toContain('primary');
    expect(CHART_PALETTE_KEYS).toContain('success');
    expect(CHART_PALETTE_KEYS).toContain('warning');
    expect(CHART_PALETTE_KEYS).toContain('danger');
    expect(CHART_PALETTE_KEYS).toContain('info');
    expect(CHART_PALETTE_KEYS).toContain('secondary');
    expect(CHART_PALETTE_KEYS).toContain('muted');
  });
});

describe('getChartColor', () => {
  it('returns accent color for index 0', () => {
    expect(getChartColor(0, lightTheme)).toBe(lightTheme.colors.accent);
  });

  it('returns primary color for index 1', () => {
    expect(getChartColor(1, lightTheme)).toBe(lightTheme.colors.primary);
  });

  it('returns different colors for consecutive indices', () => {
    const colors = Array.from({ length: 8 }, (_, i) => getChartColor(i, lightTheme));
    const unique = new Set(colors);
    // At least some should be distinct (theme may have duplicates, but most should differ)
    expect(unique.size).toBeGreaterThanOrEqual(4);
  });

  it('cycles through palette with modulo for index >= 8', () => {
    expect(getChartColor(8, lightTheme)).toBe(getChartColor(0, lightTheme));
    expect(getChartColor(9, lightTheme)).toBe(getChartColor(1, lightTheme));
    expect(getChartColor(16, lightTheme)).toBe(getChartColor(0, lightTheme));
  });

  it('works with dark theme', () => {
    expect(getChartColor(0, darkTheme)).toBe(darkTheme.colors.accent);
    expect(getChartColor(1, darkTheme)).toBe(darkTheme.colors.primary);
  });

  it('returns HEX string', () => {
    const color = getChartColor(0, lightTheme);
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
