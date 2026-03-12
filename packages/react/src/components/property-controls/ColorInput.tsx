/**
 * ColorInput
 *
 * A labeled color picker wrapping the native `<input type="color">` element.
 * Accepts and emits HEX color strings.
 */

import React from 'react';
import { controlWrapperStyle, controlLabelStyle } from './control-styles.js';
import { EDITOR_COLORS } from '../editor/editor-colors.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColorInputProps {
  /** Current color value (HEX string). */
  value: string;
  /** Callback when color changes. */
  onChange: (color: string) => void;
  /** Accessible label text. */
  label: string;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  width: 32,
  height: 24,
  padding: 0,
  border: `1px solid ${EDITOR_COLORS.inputBorder}`,
  borderRadius: 4,
  cursor: 'pointer',
  backgroundColor: 'transparent',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ColorInput: React.FC<ColorInputProps> = ({ value, onChange, label }) => {
  return (
    <label style={controlWrapperStyle} data-control="color">
      <span style={controlLabelStyle}>{label}</span>
      <input
        type="color"
        value={value}
        aria-label={label}
        style={inputStyle}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
};
