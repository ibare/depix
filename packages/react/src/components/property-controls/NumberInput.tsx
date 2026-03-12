/**
 * NumberInput
 *
 * A labeled number input with optional min, max, and step constraints.
 * Supports inline label mode and a reset button via defaultValue.
 */

import React, { useEffect } from 'react';
import { X } from '@phosphor-icons/react';
import { controlWrapperStyle, controlLabelStyle, controlInputStyle } from './control-styles.js';
import { EDITOR_COLORS } from '../editor/editor-colors.js';

// ---------------------------------------------------------------------------
// Hide native number spinner (injected once)
// ---------------------------------------------------------------------------

const SPINNER_STYLE_ID = 'depix-hide-number-spinner';

function useHideNumberSpinner() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById(SPINNER_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = SPINNER_STYLE_ID;
    style.textContent = [
      '[data-control="number"] input[type="number"]::-webkit-outer-spin-button,',
      '[data-control="number"] input[type="number"]::-webkit-inner-spin-button {',
      '  -webkit-appearance: none; margin: 0;',
      '}',
      '[data-control="number"] input[type="number"] {',
      '  -moz-appearance: textfield;',
      '}',
    ].join('\n');
    document.head.appendChild(style);
  }, []);
}

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
  /** Default value — when provided, a reset button (×) appears. */
  defaultValue?: number;
  /** Place label inside the input field on the left. Default: false */
  inlineLabel?: boolean;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  ...controlInputStyle,
  width: 60,
};

const inlineWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 4,
};

const inlineFieldStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  ...controlInputStyle,
  padding: 0,
  flex: 1,
};

const inlineLabelInsideStyle: React.CSSProperties = {
  fontSize: 11,
  color: EDITOR_COLORS.labelText,
  padding: '4px 0 4px 6px',
  flexShrink: 0,
  userSelect: 'none',
};

const inlineInputStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: EDITOR_COLORS.inputText,
  fontSize: 12,
  outline: 'none',
  width: 48,
  padding: '4px 6px',
};

const resetButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: EDITOR_COLORS.textMuted,
  fontSize: 12,
  cursor: 'pointer',
  padding: '0 4px',
  lineHeight: 1,
  flexShrink: 0,
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
  defaultValue,
  inlineLabel = false,
}) => {
  useHideNumberSpinner();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseFloat(e.target.value);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const showReset = defaultValue !== undefined && value !== defaultValue;

  if (inlineLabel) {
    return (
      <div style={inlineWrapperStyle} data-control="number">
        <div style={inlineFieldStyle}>
          <span style={inlineLabelInsideStyle}>{label}</span>
          <input
            type="number"
            value={value}
            aria-label={label}
            style={inlineInputStyle}
            min={min}
            max={max}
            step={step}
            onChange={handleChange}
          />
        </div>
        {showReset && (
          <button
            type="button"
            aria-label={`Reset ${label}`}
            style={resetButtonStyle}
            onClick={() => onChange(defaultValue)}
          >
            <X size={12} weight="bold" />
          </button>
        )}
      </div>
    );
  }

  return (
    <label style={controlWrapperStyle} data-control="number">
      <span style={controlLabelStyle}>{label}</span>
      <input
        type="number"
        value={value}
        aria-label={label}
        style={inputStyle}
        min={min}
        max={max}
        step={step}
        onChange={handleChange}
      />
      {showReset && (
        <button
          type="button"
          aria-label={`Reset ${label}`}
          style={resetButtonStyle}
          onClick={() => onChange(defaultValue)}
        >
          <X size={12} weight="bold" />
        </button>
      )}
    </label>
  );
};
