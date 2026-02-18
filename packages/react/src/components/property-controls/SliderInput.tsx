/**
 * SliderInput
 *
 * A labeled range slider input with min, max, and optional step.
 */

import React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SliderInputProps {
  /** Current numeric value. */
  value: number;
  /** Callback when value changes. */
  onChange: (value: number) => void;
  /** Accessible label text. */
  label: string;
  /** Minimum slider value. */
  min: number;
  /** Maximum slider value. */
  max: number;
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
  flex: 1,
  minWidth: '60px',
};

const valueStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#777',
  minWidth: '28px',
  textAlign: 'right',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SliderInput: React.FC<SliderInputProps> = ({
  value,
  onChange,
  label,
  min,
  max,
  step,
}) => {
  return (
    <label style={wrapperStyle} data-control="slider">
      <span style={labelStyle}>{label}</span>
      <input
        type="range"
        value={value}
        aria-label={label}
        style={inputStyle}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span style={valueStyle} data-testid="slider-value">
        {value}
      </span>
    </label>
  );
};
