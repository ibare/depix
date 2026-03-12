/**
 * SelectInput
 *
 * A labeled `<select>` dropdown for choosing from a list of options.
 */

import React from 'react';
import { controlWrapperStyle, controlLabelStyle, controlInputStyle } from './control-styles.js';

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

const selectStyle: React.CSSProperties = {
  ...controlInputStyle,
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
    <label style={controlWrapperStyle} data-control="select">
      <span style={controlLabelStyle}>{label}</span>
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
