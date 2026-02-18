/**
 * CanvasTab
 *
 * Property panel tab for canvas-level settings:
 * - Aspect ratio presets
 * - Background color
 */

import React from 'react';
import type { IRBackground } from '@depix/core';
import { ColorInput } from '../property-controls/ColorInput.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CanvasTabProps {
  /** Current aspect ratio. */
  aspectRatio: { width: number; height: number };
  /** Current background. */
  background: IRBackground;
  /** Callback when aspect ratio changes. */
  onAspectRatioChange?: (ratio: { width: number; height: number }) => void;
  /** Callback when background changes. */
  onBackgroundChange?: (bg: IRBackground) => void;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

interface AspectPreset {
  label: string;
  width: number;
  height: number;
}

const ASPECT_PRESETS: AspectPreset[] = [
  { label: '16:9', width: 16, height: 9 },
  { label: '4:3', width: 4, height: 3 },
  { label: '1:1', width: 1, height: 1 },
  { label: '9:16', width: 9, height: 16 },
];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const sectionStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid #333',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  color: '#888',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const presetGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '4px',
};

const presetBtnStyle: React.CSSProperties = {
  padding: '6px 4px',
  border: '1px solid #444',
  borderRadius: '4px',
  backgroundColor: 'transparent',
  color: '#ccc',
  cursor: 'pointer',
  fontSize: '11px',
  textAlign: 'center',
};

const presetBtnActiveStyle: React.CSSProperties = {
  ...presetBtnStyle,
  borderColor: '#3b82f6',
  backgroundColor: 'rgba(59, 130, 246, 0.15)',
  color: '#3b82f6',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CanvasTab: React.FC<CanvasTabProps> = ({
  aspectRatio,
  background,
  onAspectRatioChange,
  onBackgroundChange,
}) => {
  const isPresetActive = (preset: AspectPreset): boolean =>
    aspectRatio.width === preset.width && aspectRatio.height === preset.height;

  const bgColor = background.type === 'solid' ? (background.color ?? '#ffffff') : '#ffffff';

  return (
    <div data-tab="canvas">
      {/* Aspect Ratio */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Aspect Ratio</div>
        <div style={presetGridStyle}>
          {ASPECT_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              style={isPresetActive(preset) ? presetBtnActiveStyle : presetBtnStyle}
              onClick={() => onAspectRatioChange?.({ width: preset.width, height: preset.height })}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Background */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Background</div>
        <ColorInput
          label="Color"
          value={bgColor}
          onChange={(color) =>
            onBackgroundChange?.({ type: 'solid', color })
          }
        />
      </div>
    </div>
  );
};
