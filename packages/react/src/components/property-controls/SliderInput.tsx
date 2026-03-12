/**
 * SliderInput
 *
 * A labeled range slider input with min, max, and optional step.
 * Supports tick labels and a dragging tooltip.
 */

import React, { useState, useRef } from 'react';
import { controlWrapperStyle, controlLabelStyle } from './control-styles.js';
import { EDITOR_COLORS } from '../editor/editor-colors.js';

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
  /** Tick labels displayed below the slider track. */
  ticks?: string[];
  /** Show a floating tooltip with the current value while dragging. Default: false */
  showTooltip?: boolean;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const sliderContainerStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 60,
  position: 'relative',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
};

const valueStyle: React.CSSProperties = {
  fontSize: 11,
  color: EDITOR_COLORS.labelText,
  minWidth: 28,
  textAlign: 'right',
};

const tickContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: 2,
};

const tickLabelStyle: React.CSSProperties = {
  fontSize: 9,
  color: EDITOR_COLORS.textDim,
  userSelect: 'none',
};

const tooltipStyle: React.CSSProperties = {
  position: 'absolute',
  top: -24,
  padding: '2px 6px',
  borderRadius: 3,
  fontSize: 10,
  fontWeight: 600,
  color: '#fff',
  backgroundColor: EDITOR_COLORS.accent,
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
  transform: 'translateX(-50%)',
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
  ticks,
  showTooltip = false,
}) => {
  const [dragging, setDragging] = useState(false);
  const sliderRef = useRef<HTMLInputElement>(null);

  const tooltipLeft =
    max > min ? `${((value - min) / (max - min)) * 100}%` : '50%';

  return (
    <label style={controlWrapperStyle} data-control="slider">
      <span style={controlLabelStyle}>{label}</span>
      <div style={sliderContainerStyle}>
        {showTooltip && dragging && (
          <span style={{ ...tooltipStyle, left: tooltipLeft }} data-testid="slider-tooltip">
            {value}
          </span>
        )}
        <input
          ref={sliderRef}
          type="range"
          value={value}
          aria-label={label}
          style={inputStyle}
          min={min}
          max={max}
          step={step}
          onMouseDown={() => setDragging(true)}
          onMouseUp={() => setDragging(false)}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
        {ticks && ticks.length > 0 && (
          <div style={tickContainerStyle} data-testid="slider-ticks">
            {ticks.map((t, i) => (
              <span key={i} style={tickLabelStyle}>
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <span style={valueStyle} data-testid="slider-value">
        {value}
      </span>
    </label>
  );
};
