/**
 * Shared styles for property control components.
 * All controls import from here for consistent dark theme appearance.
 */

import type React from 'react';
import { EDITOR_COLORS } from '../editor/editor-colors.js';

export const controlWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 4,
};

export const controlLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: EDITOR_COLORS.labelText,
  flexShrink: 0,
};

export const controlInputStyle: React.CSSProperties = {
  padding: '4px 6px',
  border: `1px solid ${EDITOR_COLORS.inputBorder}`,
  borderRadius: 4,
  fontSize: 12,
  backgroundColor: EDITOR_COLORS.inputBg,
  color: EDITOR_COLORS.inputText,
  outline: 'none',
};
