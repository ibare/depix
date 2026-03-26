/**
 * Scene Emission — Shared Helpers
 *
 * Utility functions shared across scene element and block emitters.
 */

import type { IRStyle } from '../../ir/types.js';
import type { ASTBlock, ASTElement } from '../ast.js';

// ---------------------------------------------------------------------------
// Style resolution
// ---------------------------------------------------------------------------

export function resolveElementStyle(el: ASTElement | ASTBlock): IRStyle {
  const style: IRStyle = {};
  if ('background' in el.style) style.fill = String(el.style.background);
  if ('border' in el.style && typeof el.style.border === 'string') style.stroke = el.style.border;
  if ('border-width' in el.style && typeof el.style['border-width'] === 'number') style.strokeWidth = el.style['border-width'];
  return style;
}

export function resolveTextColor(style: Record<string, string | number>, fallback: string): string {
  return typeof style.color === 'string' ? style.color : fallback;
}
