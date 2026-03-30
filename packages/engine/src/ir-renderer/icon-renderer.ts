/**
 * Icon Renderer — renders IRIcon elements.
 *
 * At render time the ShapeRegistry is consulted:
 * - Key found    → SVG path scaled to bounds (Konva.Path) + optional label/description
 * - Key missing  → fallback: dashed-outline rect + icon name as centered text
 *
 * Layout (when label and/or description present):
 *   ┌──────────────┐
 *   │  SVG / text  │  60% of height
 *   │   (icon)     │
 *   │    label     │  25% of height
 *   │  description │  15% of height
 *   └──────────────┘
 */

import Konva from 'konva';
import type { IRIcon } from '@depix/core';
import type { CoordinateTransform } from '../coordinate-transform.js';
import type { ShapeRegistry } from '../registry/shape-registry.js';
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
  return def
    ? renderSvgIcon(icon, def.svgPath, def.viewBox, transform)
    : renderFallbackIcon(icon, transform);
}

// ---------------------------------------------------------------------------
// SVG icon
// ---------------------------------------------------------------------------

function renderSvgIcon(
  icon: IRIcon,
  svgPath: string,
  viewBox: string,
  transform: CoordinateTransform,
): Konva.Group {
  const abs = transform.toAbsoluteBounds(icon.bounds);
  const group = new Konva.Group({ x: abs.x, y: abs.y, id: icon.id });

  const iconAreaH = icon.label ? abs.height * 0.6 : abs.height;
  const labelAreaH = abs.height * 0.25;
  const descAreaH = abs.height * 0.15;

  // Parse viewBox to compute scale
  const [, , vbW, vbH] = (viewBox ?? '0 0 24 24').split(' ').map(Number);
  const safeVbW = vbW || 24;
  const safeVbH = vbH || 24;
  const scaleX = abs.width / safeVbW;
  const scaleY = iconAreaH / safeVbH;
  const scale = Math.min(scaleX, scaleY);
  const scaledW = safeVbW * scale;
  const scaledH = safeVbH * scale;
  // Center the path horizontally within the icon bounds
  const offsetX = (abs.width - scaledW) / 2;

  // Konva.Path does not support width/height props — the path data is drawn
  // at native SVG coordinates (0,0 origin in the viewBox space). We use
  // scaleX/scaleY to resize it to the desired pixel size, and x:offsetX to
  // shift the origin so the scaled path is horizontally centered.
  group.add(new Konva.Path({
    x: offsetX,
    y: 0,
    data: svgPath,
    scaleX: scale,
    scaleY: scale,
    fill: '#333333',
    strokeWidth: 0,
  }));

  if (icon.label) {
    group.add(new Konva.Text({
      x: 0,
      y: scaledH + (iconAreaH - scaledH) / 2,
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
// Fallback icon
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

  // Dashed outline box
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

  // Icon name inside the box
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
