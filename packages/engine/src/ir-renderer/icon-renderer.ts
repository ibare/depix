/**
 * Icon Renderer — renders IRIcon elements.
 *
 * At render time the ShapeRegistry is consulted:
 * - Key found    → Konva.Image (pre-loaded SVG) + optional label/description
 * - Key missing  → fallback: dashed-outline rect + icon name as centered text
 *
 * SVG images are pre-loaded into HTMLImageElement by resolveIcons() before
 * the first render, so this renderer remains fully synchronous.
 *
 * Layout (when label and/or description present):
 *   ┌──────────────┐
 *   │  SVG image   │  60% of height
 *   │   (icon)     │
 *   │    label     │  25% of height
 *   │  description │  15% of height
 *   └──────────────┘
 */

import Konva from 'konva';
import type { IRIcon } from '@depix/core';
import type { CoordinateTransform } from '../coordinate-transform.js';
import type { IconDefinition, ShapeRegistry } from '../registry/shape-registry.js';
import { applyTransform } from './style.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function renderIcon(
  icon: IRIcon,
  transform: CoordinateTransform,
  registry: ShapeRegistry,
): Konva.Group {
  const def = icon.iconId ? registry.get(icon.iconId) : undefined;
  return def && def.image
    ? renderSvgIcon(icon, def, transform)
    : renderFallbackIcon(icon, transform);
}

// ---------------------------------------------------------------------------
// SVG icon (pre-loaded image)
// ---------------------------------------------------------------------------

/**
 * Parse the viewBox attribute from an SVG string to get the intrinsic dimensions.
 * Falls back to 24×24 if the viewBox cannot be parsed.
 */
function parseSvgViewBox(svg: string): { w: number; h: number } {
  const match = svg.match(/viewBox=["']([^"']+)["']/);
  if (match) {
    const parts = match[1].trim().split(/[\s,]+/);
    if (parts.length >= 4) {
      const w = parseFloat(parts[2]);
      const h = parseFloat(parts[3]);
      if (w > 0 && h > 0) return { w, h };
    }
  }
  return { w: 24, h: 24 };
}

function renderSvgIcon(
  icon: IRIcon,
  def: IconDefinition,
  transform: CoordinateTransform,
): Konva.Group {
  const abs = transform.toAbsoluteBounds(icon.bounds);
  const group = new Konva.Group({ x: abs.x, y: abs.y, id: icon.id });

  const iconAreaH = icon.label ? abs.height * 0.6 : abs.height;
  const labelAreaH = abs.height * 0.25;
  const descAreaH = abs.height * 0.15;

  const { w: vbW, h: vbH } = parseSvgViewBox(def.svg);
  const scaleX = abs.width / vbW;
  const scaleY = iconAreaH / vbH;
  const scale = Math.min(scaleX, scaleY);
  const scaledW = vbW * scale;
  const scaledH = vbH * scale;

  // Konva.Image does not support width/height of the SVG source — we rely on
  // the pre-loaded HTMLImageElement and explicit width/height props to scale it.
  // x/y offset centers the scaled image within the icon area.
  group.add(new Konva.Image({
    x: (abs.width - scaledW) / 2,
    y: (iconAreaH - scaledH) / 2,
    image: def.image!,
    width: scaledW,
    height: scaledH,
  }));

  if (icon.label) {
    group.add(new Konva.Text({
      x: 0,
      y: iconAreaH,
      width: abs.width,
      height: labelAreaH,
      text: icon.label,
      fontSize: Math.max(transform.toAbsoluteSize(2.5), 11),
      fill: '#303336',
      fontStyle: 'bold',
      align: 'center',
      verticalAlign: 'middle',
    }));
  }

  if (icon.description) {
    group.add(new Konva.Text({
      x: abs.width * 0.05,
      y: iconAreaH + labelAreaH,
      width: abs.width * 0.9,
      height: descAreaH,
      text: icon.description,
      fontSize: Math.max(transform.toAbsoluteSize(2), 9),
      fill: '#6b7280',
      align: 'center',
      verticalAlign: 'top',
    }));
  }

  applyTransform(group, icon, transform);
  return group;
}

// ---------------------------------------------------------------------------
// Fallback icon (registry miss or image not yet loaded)
// ---------------------------------------------------------------------------

function renderFallbackIcon(
  icon: IRIcon,
  transform: CoordinateTransform,
): Konva.Group {
  const abs = transform.toAbsoluteBounds(icon.bounds);
  const group = new Konva.Group({ x: abs.x, y: abs.y, id: icon.id });

  const iconAreaH = icon.label ? abs.height * 0.6 : abs.height;
  const labelAreaH = abs.height * 0.25;
  const descAreaH = abs.height * 0.15;

  const boxSize = Math.min(abs.width * 0.7, iconAreaH * 0.8);
  const boxX = (abs.width - boxSize) / 2;
  const boxY = (iconAreaH - boxSize) / 2;

  group.add(new Konva.Rect({
    x: boxX,
    y: boxY,
    width: boxSize,
    height: boxSize,
    stroke: '#9ca3af',
    strokeWidth: 1,
    dash: [3, 3],
    fill: '#f9fafb',
    cornerRadius: 4,
  }));

  const displayText = icon.iconId
    ? icon.iconId.slice(0, 8) + (icon.iconId.length > 8 ? '…' : '')
    : '?';

  group.add(new Konva.Text({
    x: boxX,
    y: boxY,
    width: boxSize,
    height: boxSize,
    text: displayText,
    fontSize: Math.max(transform.toAbsoluteSize(1.8), 8),
    fill: '#9ca3af',
    align: 'center',
    verticalAlign: 'middle',
  }));

  if (icon.label) {
    group.add(new Konva.Text({
      x: 0,
      y: iconAreaH,
      width: abs.width,
      height: labelAreaH,
      text: icon.label,
      fontSize: Math.max(transform.toAbsoluteSize(2.5), 11),
      fill: '#303336',
      fontStyle: 'bold',
      align: 'center',
      verticalAlign: 'middle',
    }));
  }

  if (icon.description) {
    group.add(new Konva.Text({
      x: abs.width * 0.05,
      y: iconAreaH + labelAreaH,
      width: abs.width * 0.9,
      height: descAreaH,
      text: icon.description,
      fontSize: Math.max(transform.toAbsoluteSize(2), 9),
      fill: '#6b7280',
      align: 'center',
      verticalAlign: 'top',
    }));
  }

  applyTransform(group, icon, transform);
  return group;
}
