/**
 * Shared utilities and styles for ObjectTab section components.
 */

import type React from 'react';
import { EDITOR_COLORS } from '../../editor/editor-colors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function resolveColor(value: string | { type: string } | undefined): string {
  if (!value) return '#000000';
  if (typeof value === 'string') return value;
  return '#000000';
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

export const sectionStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: `1px solid ${EDITOR_COLORS.border}`,
};

export const typeTagStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 6px',
  borderRadius: 3,
  backgroundColor: EDITOR_COLORS.bgLighter,
  color: EDITOR_COLORS.textMuted,
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  marginBottom: 8,
};

export const emptyStyle: React.CSSProperties = {
  color: EDITOR_COLORS.textDim,
  fontSize: 11,
  textAlign: 'center',
  padding: '16px 8px',
};
