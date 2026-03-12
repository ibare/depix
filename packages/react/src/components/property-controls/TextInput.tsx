/**
 * TextInput
 *
 * A labeled text input that supports single-line (`<input>`) and
 * multi-line (`<textarea>`) modes.
 */

import React from 'react';
import { controlWrapperStyle, controlLabelStyle, controlInputStyle } from './control-styles.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TextInputProps {
  /** Current text value. */
  value: string;
  /** Callback when text changes. */
  onChange: (value: string) => void;
  /** Accessible label text. */
  label: string;
  /** Whether to render a multi-line textarea. Default: false */
  multiline?: boolean;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const wrapperStyle: React.CSSProperties = {
  ...controlWrapperStyle,
  alignItems: 'flex-start',
};

const labelStyle: React.CSSProperties = {
  ...controlLabelStyle,
  paddingTop: 4,
};

const inputStyle: React.CSSProperties = {
  ...controlInputStyle,
  flex: 1,
  fontFamily: 'inherit',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 48,
  resize: 'vertical',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const TextInput: React.FC<TextInputProps> = ({
  value,
  onChange,
  label,
  multiline = false,
}) => {
  return (
    <label style={wrapperStyle} data-control="text">
      <span style={labelStyle}>{label}</span>
      {multiline ? (
        <textarea
          value={value}
          aria-label={label}
          style={textareaStyle}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type="text"
          value={value}
          aria-label={label}
          style={inputStyle}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
};
