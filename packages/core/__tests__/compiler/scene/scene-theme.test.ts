/**
 * SceneTheme Tests
 */

import { describe, it, expect } from 'vitest';
import { defaultSceneTheme, type SceneTheme } from '../../../src/theme/scene-theme.js';

describe('SceneTheme', () => {
  it('defaultSceneTheme has all required color fields', () => {
    const { colors } = defaultSceneTheme;
    expect(colors.background).toBeDefined();
    expect(colors.surface).toBeDefined();
    expect(colors.primary).toBeDefined();
    expect(colors.text).toBeDefined();
    expect(colors.textMuted).toBeDefined();
    expect(colors.accent).toBeDefined();
  });

  it('defaultSceneTheme has valid HEX colors', () => {
    const { colors } = defaultSceneTheme;
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    expect(colors.background).toMatch(hexPattern);
    expect(colors.surface).toMatch(hexPattern);
    expect(colors.primary).toMatch(hexPattern);
    expect(colors.text).toMatch(hexPattern);
    expect(colors.textMuted).toMatch(hexPattern);
    expect(colors.accent).toMatch(hexPattern);
  });

  it('defaultSceneTheme has typography multipliers', () => {
    const { typography } = defaultSceneTheme;
    expect(typography.headingSize).toBeGreaterThan(0);
    expect(typography.bodySize).toBeGreaterThan(0);
    expect(typography.statSize).toBeGreaterThan(0);
    expect(typography.headingFont).toBeDefined();
    expect(typography.bodyFont).toBeDefined();
  });

  it('defaultSceneTheme has layout percentages', () => {
    const { layout } = defaultSceneTheme;
    expect(layout.scenePadding).toBeGreaterThan(0);
    expect(layout.scenePadding).toBeLessThan(50);
    expect(layout.columnGap).toBeGreaterThan(0);
    expect(layout.itemGap).toBeGreaterThan(0);
    expect(layout.headingHeight).toBeGreaterThan(0);
    expect(layout.headingHeight).toBeLessThan(50);
  });

  it('defaultSceneTheme has density hints', () => {
    const { density } = defaultSceneTheme;
    expect(density.bulletItemsMax).toBeGreaterThan(0);
    expect(density.statCountMax).toBeGreaterThan(0);
  });

  it('SceneTheme is structurally valid', () => {
    const custom: SceneTheme = {
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
        scenePadding: 10,
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
