/**
 * ColorInput
 *
 * A labeled color picker wrapping the native `<input type="color">` element.
 * Accepts and emits HEX color strings.
 */

import React from 'react';

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

const wrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  marginBottom: '4px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#555',
  flexShrink: 0,
};

const inputStyle: React.CSSProperties = {
  width: '32px',
  height: '24px',
  padding: '0',
  border: '1px solid #ccc',
  borderRadius: '4px',
  cursor: 'pointer',
  backgroundColor: 'transparent',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ColorInput: React.FC<ColorInputProps> = ({ value, onChange, label }) => {
  return (
    <label style={wrapperStyle} data-control="color">
      <span style={labelStyle}>{label}</span>
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
