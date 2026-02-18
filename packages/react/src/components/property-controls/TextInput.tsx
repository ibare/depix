/**
 * TextInput
 *
 * A labeled text input that supports single-line (`<input>`) and
 * multi-line (`<textarea>`) modes.
 */

import React from 'react';

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
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '8px',
  marginBottom: '4px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#555',
  flexShrink: 0,
  paddingTop: '4px',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '2px 4px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  fontSize: '12px',
  fontFamily: 'inherit',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: '48px',
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
