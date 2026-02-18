/**
 * SelectInput
 *
 * A labeled `<select>` dropdown for choosing from a list of options.
 */

import React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SelectOption {
  /** Option value. */
  value: string;
  /** Display label. */
  label: string;
}

export interface SelectInputProps {
  /** Currently selected value. */
  value: string;
  /** Callback when selection changes. */
  onChange: (value: string) => void;
  /** Accessible label text. */
  label: string;
  /** Available options. */
  options: SelectOption[];
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

const selectStyle: React.CSSProperties = {
  padding: '2px 4px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  fontSize: '12px',
  backgroundColor: '#fff',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SelectInput: React.FC<SelectInputProps> = ({
  value,
  onChange,
  label,
  options,
}) => {
  return (
    <label style={wrapperStyle} data-control="select">
      <span style={labelStyle}>{label}</span>
      <select
        value={value}
        aria-label={label}
        style={selectStyle}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
};
