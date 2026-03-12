/**
 * EditorPropertyPanel — context-sensitive property panel for DSL editor.
 * Shows different fields based on the selected context (scene, slot, element, multi).
 */

import React from 'react';
import { EDITOR_COLORS } from './editor-colors.js';

export interface EditorPropertyPanelProps {
  context: 'scene' | 'slot' | 'element' | 'multi' | 'none';
  sceneTitle?: string;
  layout?: string;
  elementType?: string;
  elementProps?: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  /** Inline style overrides (for position: fixed from parent) */
  style?: React.CSSProperties;
}

export function EditorPropertyPanel({
  context,
  sceneTitle,
  layout,
  elementType,
  elementProps,
  onChange,
  style,
}: EditorPropertyPanelProps) {
  return (
    <div
      style={{
        width: 240,
        maxHeight: 400,
        background: EDITOR_COLORS.bg,
        border: `1px solid ${EDITOR_COLORS.border}`,
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        zIndex: 10000,
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        ...style,
      }}
    >
      <div
        style={{
          padding: '12px 16px 8px',
          fontSize: 11,
          color: EDITOR_COLORS.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 1,
          borderBottom: `1px solid ${EDITOR_COLORS.border}`,
        }}
      >
        {context === 'none' ? 'Properties' : context}
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {context === 'none' && (
          <div style={{ color: EDITOR_COLORS.textDim, fontSize: 12, textAlign: 'center', padding: 20 }}>
            Select an element to edit its properties
          </div>
        )}

        {context === 'scene' && (
          <>
            <PropertyField label="Title">
              <input
                type="text"
                value={sceneTitle ?? ''}
                onChange={(e) => onChange('title', e.target.value)}
                style={inputStyle}
              />
            </PropertyField>
            <PropertyField label="Layout">
              <input
                type="text"
                value={layout ?? ''}
                onChange={(e) => onChange('layout', e.target.value)}
                style={inputStyle}
              />
            </PropertyField>
          </>
        )}

        {context === 'element' && elementType && (
          <>
            <PropertyField label="Type">
              <div style={{ color: EDITOR_COLORS.text, fontSize: 12, padding: '4px 0' }}>
                {elementType}
              </div>
            </PropertyField>
            {elementProps && Object.entries(elementProps).map(([key, value]) => (
              <PropertyField key={key} label={key}>
                <input
                  type="text"
                  value={String(value ?? '')}
                  onChange={(e) => onChange(key, e.target.value)}
                  style={inputStyle}
                />
              </PropertyField>
            ))}
          </>
        )}

        {context === 'multi' && (
          <div style={{ color: EDITOR_COLORS.textDim, fontSize: 12, textAlign: 'center', padding: 20 }}>
            Multiple elements selected
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal components
// ---------------------------------------------------------------------------

function PropertyField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 10, color: EDITOR_COLORS.textMuted, display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: EDITOR_COLORS.bgLight,
  border: `1px solid ${EDITOR_COLORS.border}`,
  borderRadius: 4,
  color: EDITOR_COLORS.text,
  padding: '4px 8px',
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
};
