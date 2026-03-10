/**
 * SlideTheme Tests
 */

import { describe, it, expect } from 'vitest';
import { defaultSlideTheme, type SlideTheme } from '../../../src/theme/slide-theme.js';

describe('SlideTheme', () => {
  it('defaultSlideTheme has all required color fields', () => {
    const { colors } = defaultSlideTheme;
    expect(colors.background).toBeDefined();
    expect(colors.surface).toBeDefined();
    expect(colors.primary).toBeDefined();
    expect(colors.text).toBeDefined();
    expect(colors.textMuted).toBeDefined();
    expect(colors.accent).toBeDefined();
  });

  it('defaultSlideTheme has valid HEX colors', () => {
    const { colors } = defaultSlideTheme;
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    expect(colors.background).toMatch(hexPattern);
    expect(colors.surface).toMatch(hexPattern);
    expect(colors.primary).toMatch(hexPattern);
    expect(colors.text).toMatch(hexPattern);
    expect(colors.textMuted).toMatch(hexPattern);
    expect(colors.accent).toMatch(hexPattern);
  });

  it('defaultSlideTheme has typography multipliers', () => {
    const { typography } = defaultSlideTheme;
    expect(typography.headingSize).toBeGreaterThan(0);
    expect(typography.bodySize).toBeGreaterThan(0);
    expect(typography.statSize).toBeGreaterThan(0);
    expect(typography.headingFont).toBeDefined();
    expect(typography.bodyFont).toBeDefined();
  });

  it('defaultSlideTheme has layout percentages', () => {
    const { layout } = defaultSlideTheme;
    expect(layout.slidePadding).toBeGreaterThan(0);
    expect(layout.slidePadding).toBeLessThan(50);
    expect(layout.columnGap).toBeGreaterThan(0);
    expect(layout.itemGap).toBeGreaterThan(0);
    expect(layout.headingHeight).toBeGreaterThan(0);
    expect(layout.headingHeight).toBeLessThan(50);
  });

  it('defaultSlideTheme has density hints', () => {
    const { density } = defaultSlideTheme;
    expect(density.bulletItemsMax).toBeGreaterThan(0);
    expect(density.statCountMax).toBeGreaterThan(0);
  });

  it('SlideTheme is structurally valid', () => {
    const custom: SlideTheme = {
      colors: {
        background: '#000000',
        surface: '#111111',
        primary: '#FFFFFF',
        text: '#FFFFFF',
        textMuted: '#888888',
        accent: '#FF0000',
      },
      typography: {
        headingFont: 'Arial',
        bodyFont: 'Arial',
        headingSize: 1.2,
        bodySize: 0.5,
        statSize: 2.5,
      },
      layout: {
        slidePadding: 10,
        columnGap: 5,
        itemGap: 3,
        headingHeight: 20,
      },
      density: {
        bulletItemsMax: 4,
        statCountMax: 2,
      },
    };
    expect(custom.colors.background).toBe('#000000');
    expect(custom.typography.headingSize).toBe(1.2);
  });
});
