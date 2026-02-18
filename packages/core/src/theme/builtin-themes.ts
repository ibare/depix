/**
 * Built-in Themes
 *
 * Provides two default themes: light and dark.
 * These themes define the concrete values for all semantic tokens
 * used in the Depix DSL v2 theme system.
 *
 * @module @depix/core/theme
 */

import type { DepixTheme } from './types.js';

// ---------------------------------------------------------------------------
// Light Theme
// ---------------------------------------------------------------------------

/**
 * Default light theme.
 *
 * Optimized for light backgrounds with high-contrast colors.
 * Based on a Tailwind-inspired palette.
 */
export const lightTheme: DepixTheme = {
  name: 'light',

  colors: {
    primary: '#3b82f6',
    secondary: '#6b7280',
    accent: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4',
    muted: '#9ca3af',
  },

  namedColors: {
    red: '#ef4444',
    orange: '#f97316',
    yellow: '#eab308',
    green: '#22c55e',
    blue: '#3b82f6',
    purple: '#a855f7',
    gray: '#6b7280',
    white: '#ffffff',
    black: '#1f2937',
  },

  spacing: {
    xs: 1,
    sm: 2,
    md: 3,
    lg: 5,
    xl: 8,
  },

  fontSize: {
    xs: 0.6,
    sm: 0.8,
    md: 1.0,
    lg: 1.4,
    xl: 1.8,
    '2xl': 2.4,
    '3xl': 3.2,
  },

  shadow: {
    sm: { offsetX: 0, offsetY: 1, blur: 3, color: 'rgba(0,0,0,0.1)' },
    md: { offsetX: 0, offsetY: 2, blur: 6, color: 'rgba(0,0,0,0.12)' },
    lg: { offsetX: 0, offsetY: 4, blur: 12, color: 'rgba(0,0,0,0.15)' },
  },

  radius: {
    sm: 0.5,
    md: 1,
    lg: 2,
    full: 50,
  },

  borderWidth: {
    thin: 0.3,
    medium: 0.6,
    thick: 1.0,
  },

  node: {
    fill: '#ffffff',
    stroke: '#e5e7eb',
    strokeWidth: 1,
    cornerRadius: 1,
    shadow: 'sm',
    padding: 2,
    minWidth: 12,
    minHeight: 8,
  },

  edge: {
    stroke: '#6b7280',
    strokeWidth: 0.3,
    arrowEnd: 'triangle',
  },

  background: '#ffffff',
  foreground: '#1f2937',
  border: '#e5e7eb',
};

// ---------------------------------------------------------------------------
// Dark Theme
// ---------------------------------------------------------------------------

/**
 * Default dark theme.
 *
 * Optimized for dark backgrounds with appropriately adjusted colors
 * for readability and visual comfort.
 */
export const darkTheme: DepixTheme = {
  name: 'dark',

  colors: {
    primary: '#60a5fa',
    secondary: '#9ca3af',
    accent: '#a78bfa',
    success: '#34d399',
    warning: '#fbbf24',
    danger: '#f87171',
    info: '#22d3ee',
    muted: '#6b7280',
  },

  namedColors: {
    red: '#f87171',
    orange: '#fb923c',
    yellow: '#facc15',
    green: '#4ade80',
    blue: '#60a5fa',
    purple: '#c084fc',
    gray: '#9ca3af',
    white: '#f8fafc',
    black: '#0f172a',
  },

  spacing: {
    xs: 1,
    sm: 2,
    md: 3,
    lg: 5,
    xl: 8,
  },

  fontSize: {
    xs: 0.6,
    sm: 0.8,
    md: 1.0,
    lg: 1.4,
    xl: 1.8,
    '2xl': 2.4,
    '3xl': 3.2,
  },

  shadow: {
    sm: { offsetX: 0, offsetY: 1, blur: 3, color: 'rgba(0,0,0,0.3)' },
    md: { offsetX: 0, offsetY: 2, blur: 6, color: 'rgba(0,0,0,0.35)' },
    lg: { offsetX: 0, offsetY: 4, blur: 12, color: 'rgba(0,0,0,0.4)' },
  },

  radius: {
    sm: 0.5,
    md: 1,
    lg: 2,
    full: 50,
  },

  borderWidth: {
    thin: 0.3,
    medium: 0.6,
    thick: 1.0,
  },

  node: {
    fill: '#1e293b',
    stroke: '#374151',
    strokeWidth: 1,
    cornerRadius: 1,
    shadow: 'sm',
    padding: 2,
    minWidth: 12,
    minHeight: 8,
  },

  edge: {
    stroke: '#9ca3af',
    strokeWidth: 0.3,
    arrowEnd: 'triangle',
  },

  background: '#1a1a2e',
  foreground: '#e2e8f0',
  border: '#374151',
};
