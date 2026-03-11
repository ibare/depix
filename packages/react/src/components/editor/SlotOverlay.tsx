/**
 * SlotOverlay — HTML overlay on top of Konva canvas showing slot boundaries.
 * Empty slots show dashed borders with name and [+] button.
 */

import React from 'react';
import { EDITOR_COLORS } from './editor-colors.js';

export interface SlotOverlaySlot {
  name: string;
  bounds: { x: number; y: number; w: number; h: number };
  isEmpty: boolean;
}

export interface CoordinateTransform {
  toPixelX: (relX: number) => number;
  toPixelY: (relY: number) => number;
  toPixelW: (relW: number) => number;
  toPixelH: (relH: number) => number;
}

export interface SlotOverlayProps {
  slots: SlotOverlaySlot[];
  transform: CoordinateTransform;
  onSlotClick?: (slotName: string) => void;
}

export function SlotOverlay({ slots, transform, onSlotClick }: SlotOverlayProps) {
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
      {slots.map((slot) => {
        const px = transform.toPixelX(slot.bounds.x);
        const py = transform.toPixelY(slot.bounds.y);
        const pw = transform.toPixelW(slot.bounds.w);
        const ph = transform.toPixelH(slot.bounds.h);

        return (
          <div
            key={slot.name}
            style={{
              position: 'absolute',
              left: px,
              top: py,
              width: pw,
              height: ph,
              border: slot.isEmpty
                ? `1px dashed ${EDITOR_COLORS.textDim}`
                : `1px solid transparent`,
              borderRadius: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: slot.isEmpty ? 'auto' : 'none',
              cursor: slot.isEmpty ? 'pointer' : 'default',
            }}
            onClick={slot.isEmpty ? () => onSlotClick?.(slot.name) : undefined}
          >
            {slot.isEmpty && (
              <>
                <span
                  style={{
                    fontSize: 10,
                    color: EDITOR_COLORS.textDim,
                    marginBottom: 4,
                  }}
                >
                  {slot.name}
                </span>
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: `1px dashed ${EDITOR_COLORS.textDim}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    color: EDITOR_COLORS.textDim,
                  }}
                >
                  +
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
