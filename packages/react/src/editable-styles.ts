/**
 * Style constants and layout utilities for the DepixCanvasEditable overlay pill UI.
 */

import type React from 'react';

// ---------------------------------------------------------------------------
// Layout utility
// ---------------------------------------------------------------------------

/** Compute canvas dimensions that fit within 80% of the viewport, preserving aspect ratio. */
export function computeEditDims(ar: { width: number; height: number }): { width: number; height: number } {
  const maxW = window.innerWidth * 0.8;
  const maxH = window.innerHeight * 0.8;
  const ratio = ar.width / ar.height;
  let w: number, h: number;
  if (maxW / maxH > ratio) { h = maxH; w = maxH * ratio; }
  else { w = maxW; h = maxW / ratio; }
  return { width: Math.floor(w), height: Math.floor(h) };
}

// ---------------------------------------------------------------------------
// Edit button position map
// ---------------------------------------------------------------------------

export const OVERLAY_PILL_POSITIONS: Record<string, React.CSSProperties> = {
  'top-left': { top: '8px', left: '8px' },
  'top-right': { top: '8px', right: '8px' },
  'bottom-left': { bottom: '8px', left: '8px' },
  'bottom-right': { bottom: '8px', right: '8px' },
};

export const overlayPillStyle: React.CSSProperties = {
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  padding: '4px',
  borderRadius: '10px',
  border: 'none',
  backgroundColor: 'rgba(30,30,30,0.88)',
  opacity: 0,
  transition: 'opacity 0.2s',
  zIndex: 10,
  pointerEvents: 'none',
};

export const pillIconBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  borderRadius: '7px',
  border: 'none',
  backgroundColor: 'transparent',
  color: '#ddd',
  cursor: 'pointer',
  padding: 0,
  lineHeight: 0,
  transition: 'background-color 0.15s',
};
