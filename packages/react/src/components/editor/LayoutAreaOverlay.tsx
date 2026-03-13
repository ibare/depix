/**
 * LayoutAreaOverlay — shows slot area boundaries as colored overlays.
 *
 * Renders semi-transparent colored boxes for each slot so the user
 * can understand how the current layout divides the canvas.
 */

import React from 'react';
import type { CoordinateTransform } from './SlotOverlay.js';
import type { SlotInfo } from '../../hooks/useDSLSync.js';

// Each slot gets a distinct color cycling through this palette
const SLOT_COLORS = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#8b5cf6', // violet
  '#0ea5e9', // sky
];

export interface LayoutAreaOverlayProps {
  slots: SlotInfo[];
  transform: CoordinateTransform;
}

export function LayoutAreaOverlay({ slots, transform }: LayoutAreaOverlayProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      {slots.map((slot, i) => {
        const color = SLOT_COLORS[i % SLOT_COLORS.length];
        return (
          <div
            key={`${slot.name}-${i}`}
            style={{
              position: 'absolute',
              left: transform.toPixelX(slot.bounds.x),
              top: transform.toPixelY(slot.bounds.y),
              width: transform.toPixelW(slot.bounds.w),
              height: transform.toPixelH(slot.bounds.h),
              border: `2px solid ${color}`,
              background: `${color}18`,
              borderRadius: 4,
              padding: '4px 6px',
              boxSizing: 'border-box',
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontFamily: 'monospace',
                color,
                fontWeight: 600,
                lineHeight: 1,
                userSelect: 'none',
              }}
            >
              {slot.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
