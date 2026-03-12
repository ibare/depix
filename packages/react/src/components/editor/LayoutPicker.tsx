/**
 * LayoutPicker — dropdown to select scene layout preset.
 * Shows 14 layout options with minimap previews.
 */

import React, { useState, useRef, useEffect } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import { EDITOR_COLORS } from './editor-colors.js';

const LAYOUTS = [
  'full', 'center', 'split', 'rows', 'sidebar',
  'header', 'header-split', 'header-rows', 'header-sidebar',
  'grid', 'header-grid', 'focus', 'header-focus', 'custom',
] as const;

export interface LayoutPickerProps {
  currentLayout: string;
  onLayoutChange: (layout: string) => void;
}

export function LayoutPicker({ currentLayout, onLayoutChange }: LayoutPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', zIndex: 10 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: EDITOR_COLORS.bgLight,
          border: `1px solid ${EDITOR_COLORS.border}`,
          borderRadius: 6,
          color: EDITOR_COLORS.text,
          padding: '4px 12px',
          fontSize: 12,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <LayoutMini layout={currentLayout} size={16} />
        <span>{currentLayout || 'Layout'}</span>
        <CaretDown size={10} weight="bold" color={EDITOR_COLORS.textDim} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: 4,
            background: EDITOR_COLORS.bg,
            border: `1px solid ${EDITOR_COLORS.border}`,
            borderRadius: 8,
            padding: 8,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
            minWidth: 220,
          }}
        >
          {LAYOUTS.map((layout) => (
            <button
              key={layout}
              onClick={() => {
                onLayoutChange(layout);
                setOpen(false);
              }}
              style={{
                background: layout === currentLayout ? EDITOR_COLORS.accent : EDITOR_COLORS.bgLight,
                border: `1px solid ${layout === currentLayout ? EDITOR_COLORS.accent : EDITOR_COLORS.border}`,
                borderRadius: 4,
                padding: 4,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
              title={layout}
            >
              <LayoutMini layout={layout} size={28} />
              <span style={{ fontSize: 8, color: EDITOR_COLORS.textMuted }}>{layout}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini layout preview (simplified SVG)
// ---------------------------------------------------------------------------

function LayoutMini({ layout, size }: { layout: string; size: number }) {
  const w = size;
  const h = size * 0.6;
  const stroke = EDITOR_COLORS.textDim;

  const rects: Array<{ x: number; y: number; w: number; h: number }> = [];

  switch (layout) {
    case 'full':
      rects.push({ x: 1, y: 1, w: w - 2, h: h - 2 });
      break;
    case 'center':
      rects.push({ x: w * 0.2, y: h * 0.2, w: w * 0.6, h: h * 0.6 });
      break;
    case 'split':
      rects.push({ x: 1, y: 1, w: w * 0.48, h: h - 2 });
      rects.push({ x: w * 0.52, y: 1, w: w * 0.48 - 1, h: h - 2 });
      break;
    case 'rows':
      rects.push({ x: 1, y: 1, w: w - 2, h: h * 0.45 });
      rects.push({ x: 1, y: h * 0.55, w: w - 2, h: h * 0.45 });
      break;
    case 'header':
      rects.push({ x: 1, y: 1, w: w - 2, h: h * 0.25 });
      rects.push({ x: 1, y: h * 0.3, w: w - 2, h: h * 0.68 });
      break;
    default:
      rects.push({ x: 1, y: 1, w: w - 2, h: h - 2 });
      break;
  }

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {rects.map((r, i) => (
        <rect
          key={i}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          fill="none"
          stroke={stroke}
          strokeWidth={0.5}
          rx={1}
        />
      ))}
    </svg>
  );
}
