/**
 * Scene Theme System
 *
 * Defines the SceneTheme interface and default theme for presentation mode.
 * SceneTheme controls scene-specific styling: colors, typography multipliers,
 * layout percentages, and density hints.
 */

// ---------------------------------------------------------------------------
// SceneTheme interface
// ---------------------------------------------------------------------------

export interface SceneTheme {
  /** Scene color palette. */
  colors: {
    background: string;
    surface: string;
    primary: string;
    text: string;
    textMuted: string;
    accent: string;
  };

  /** Typography multipliers (applied to baseFontSize = sceneHeight * 0.04). */
  typography: {
    headingFont: string;
    bodyFont: string;
    headingSize: number;
    bodySize: number;
    statSize: number;
  };

  /** Layout percentages (0-100 scale). */
  layout: {
    scenePadding: number;
    columnGap: number;
    itemGap: number;
    headingHeight: number;
  };

  /** Density hints (for LLM prompt guidance, not used by compiler). */
  density: {
    bulletItemsMax: number;
    statCountMax: number;
  };
}

// ---------------------------------------------------------------------------
// Default scene theme
// ---------------------------------------------------------------------------

export const defaultSceneTheme: SceneTheme = {
  colors: {
    background: '#FFFFFF',
    surface: '#F8F9FA',
    primary: '#1A1A2E',
    text: '#1A1A2E',
    textMuted: '#6B7280',
    accent: '#4F46E5',
  },
  typography: {
    headingFont: 'Inter',
    bodyFont: 'Inter',
    headingSize: 1.0,
    bodySize: 0.6,
    statSize: 2.0,
  },
  layout: {
    scenePadding: 8,
    columnGap: 4,
    itemGap: 2,
    headingHeight: 18,
  },
  density: {
    bulletItemsMax: 5,
    statCountMax: 3,
  },
};
