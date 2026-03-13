/**
 * Style Helpers
 *
 * Converts IRStyle properties to Konva-compatible attribute objects.
 * Also provides corner radius resolution, font style building, and transform application.
 *
 * All functions are pure: they do not create Konva nodes, only compute attribute values
 * or apply properties to already-created nodes.
 */

import type Konva from 'konva'; // type-only: no new Konva.*() calls here
import type { IRStyle, IRGradient, IRShape } from '@depix/core';
import type { CoordinateTransform } from '../coordinate-transform.js';

// ---------------------------------------------------------------------------
// Style attribute resolution
// ---------------------------------------------------------------------------

export function resolveStyleAttrs(
  style: IRStyle,
  transform: CoordinateTransform,
): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};

  if (style.fill !== undefined) {
    if (typeof style.fill === 'string') {
      attrs.fill = style.fill;
    } else {
      // Konva gradient: [position0, color0, position1, color1, ...]
      attrs.fillLinearGradientColorStops = resolveGradientStops(style.fill);
    }
  }

  if (style.stroke !== undefined) {
    if (typeof style.stroke === 'string') {
      attrs.stroke = style.stroke;
    }
  }

  if (style.strokeWidth !== undefined) {
    attrs.strokeWidth = transform.toAbsoluteSize(style.strokeWidth);
  }

  if (style.dashPattern) {
    attrs.dash = style.dashPattern.map((d) => transform.toAbsoluteSize(d));
  }

  if (style.shadow) {
    attrs.shadowColor = style.shadow.color;
    attrs.shadowBlur = transform.toAbsoluteSize(style.shadow.blur);
    attrs.shadowOffsetX = transform.toAbsoluteSize(style.shadow.offsetX);
    attrs.shadowOffsetY = transform.toAbsoluteSize(style.shadow.offsetY);
    attrs.shadowEnabled = true;
  }

  return attrs;
}

// Konva gradient stops format: interleaved [position, color, position, color, ...]
function resolveGradientStops(gradient: IRGradient): (number | string)[] {
  const stops: (number | string)[] = [];
  for (const stop of gradient.stops) {
    stops.push(stop.position, stop.color);
  }
  return stops;
}

// ---------------------------------------------------------------------------
// Corner radius
// ---------------------------------------------------------------------------

export function resolveCornerRadius(
  cr: IRShape['cornerRadius'],
  transform: CoordinateTransform,
): number | number[] | undefined {
  if (cr === undefined) return undefined;
  if (typeof cr === 'number') return transform.toAbsoluteSize(cr);
  // Konva corner radius array order: [topLeft, topRight, bottomRight, bottomLeft]
  return [
    transform.toAbsoluteSize(cr.tl),
    transform.toAbsoluteSize(cr.tr),
    transform.toAbsoluteSize(cr.br),
    transform.toAbsoluteSize(cr.bl),
  ];
}

// ---------------------------------------------------------------------------
// Font style
// ---------------------------------------------------------------------------

export function buildFontStyle(
  weight?: 'normal' | 'bold',
  style?: 'normal' | 'italic',
): string {
  const parts: string[] = [];
  if (style === 'italic') parts.push('italic');
  if (weight === 'bold') parts.push('bold');
  return parts.join(' ') || 'normal';
}

// ---------------------------------------------------------------------------
// Transform application
// ---------------------------------------------------------------------------

export function applyTransform(
  node: Konva.Group | Konva.Shape,
  element: { transform?: { rotate?: number; opacity?: number; blur?: number } },
  _transform: CoordinateTransform,
): void {
  if (!element.transform) return;
  if (element.transform.rotate) {
    node.rotation(element.transform.rotate);
  }
  if (element.transform.opacity !== undefined) {
    node.opacity(element.transform.opacity);
  }
}
