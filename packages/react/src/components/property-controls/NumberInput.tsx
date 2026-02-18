/**
 * NumberInput
 *
 * A labeled number input with optional min, max, and step constraints.
 */

import React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NumberInputProps {
  /** Current numeric value. */
  value: number;
  /** Callback when value changes. */
  onChange: (value: number) => void;
  /** Accessible label text. */
  label: string;
  /** Minimum allowed value. */
  min?: number;
  /** Maximum allowed value. */
  max?: number;
  /** Step increment. */
  step?: number;
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
  width: '60px',
  padding: '2px 4px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  fontSize: '12px',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  label,
  min,
  max,
  step,
}) => {
  return (
    <label style={wrapperStyle} data-control="number">
      <span style={labelStyle}>{label}</span>
      <input
        type="number"
        value={value}
        aria-label={label}
        style={inputStyle}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const parsed = parseFloat(e.target.value);
          if (!isNaN(parsed)) {
            onChange(parsed);
          }
        }}
      />
    </label>
  );
};
