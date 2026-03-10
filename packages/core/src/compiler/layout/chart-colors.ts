/**
 * Chart Color Palette
 *
 * Provides per-item coloring for chart data points (bars, line points, pie wedges).
 * Colors are extracted from the DepixTheme in a fixed order and cycle with modulo.
 */

import type { DepixTheme } from '../../theme/types.js';
import type { SemanticColor } from '../../theme/types.js';

/** Ordered palette keys — determines which theme color each data item gets. */
export const CHART_PALETTE_KEYS: readonly SemanticColor[] = [
  'accent',
  'primary',
  'success',
  'warning',
  'danger',
  'info',
  'secondary',
  'muted',
] as const;

/**
 * Get the chart color for a data item at a given index.
 *
 * Returns a resolved HEX color from the theme's semantic palette.
 * Cycles through the palette using modulo when index >= palette length.
 */
export function getChartColor(index: number, theme: DepixTheme): string {
  const key = CHART_PALETTE_KEYS[index % CHART_PALETTE_KEYS.length];
  return theme.colors[key];
}
