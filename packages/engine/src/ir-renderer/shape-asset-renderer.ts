/**
 * Shape Asset Renderer — renders IRShapeAsset elements.
 *
 * At render time the ShapeRegistry is consulted:
 * - Key found    → Konva.Image (pre-loaded SVG) + optional label/description
 * - Key missing  → fallback: dashed-outline rect + shape name as centered text
 *
 * SVG images are pre-loaded into HTMLImageElement by resolveShapes() before
 * the first render, so this renderer remains fully synchronous.
 *
 * Layout (when label and/or description present):
 *   ┌──────────────┐
 *   │  SVG image   │  60% of height
 *   │   (shape)    │
 *   │    label     │  25% of height
 *   │  description │  15% of height
 *   └──────────────┘
 */

import Konva from 'konva';
import type { IRShapeAsset } from '@depix/core';
import type { CoordinateTransform } from '../coordinate-transform.js';
import type { ShapeDefinition, ShapeRegistry } from '../registry/shape-registry.js';
import { applyTransform } from './style.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function renderShapeAsset(
  shape: IRShapeAsset,
  transform: CoordinateTransform,
  registry: ShapeRegistry,
): Konva.Group {
  const def = shape.shapeId ? registry.get(shape.shapeId) : undefined;
  return def && def.image
    ? renderSvgShape(shape, def, transform)
    : renderFallbackShape(shape, transform);
}

// ---------------------------------------------------------------------------
// SVG shape (pre-loaded image)
// ---------------------------------------------------------------------------

/**
 * Parse the viewBox attribute from an SVG string to get the intrinsic dimensions.
 * Falls back to 24×24 if the viewBox cannot be parsed.
 */
function parseSvgViewBox(svg: string): { w: number; h: number } {
  const match = svg.match(/viewBox=[\"']([^\"']+)[\"']/);
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

function renderSvgShape(
  shape: IRShapeAsset,
  def: ShapeDefinition,
  transform: CoordinateTransform,
): Konva.Group {
  const abs = transform.toAbsoluteBounds(shape.bounds);
  const group = new Konva.Group({ x: abs.x, y: abs.y, id: shape.id });

  const shapeAreaH = shape.label ? abs.height * 0.6 : abs.height;
  const labelAreaH = abs.height * 0.25;
  const descAreaH = abs.height * 0.15;

  const { w: vbW, h: vbH } = parseSvgViewBox(def.svg);
  const scaleX = abs.width / vbW;
  const scaleY = shapeAreaH / vbH;
  const scale = Math.min(scaleX, scaleY);
  const scaledW = vbW * scale;
  const scaledH = vbH * scale;

  // Konva.Image does not support width/height of the SVG source — we rely on
  // the pre-loaded HTMLImageElement and explicit width/height props to scale it.
  // x/y offset centers the scaled image within the shape area.
  group.add(new Konva.Image({
    x: (abs.width - scaledW) / 2,
    y: (shapeAreaH - scaledH) / 2,
    image: def.image!,
    width: scaledW,
    height: scaledH,
  }));

  if (shape.label) {
    group.add(new Konva.Text({
      x: 0,
      y: shapeAreaH,
      width: abs.width,
      height: labelAreaH,
      text: shape.label,
      fontSize: Math.max(transform.toAbsoluteSize(2.5), 11),
      fill: '#303336',
      fontStyle: 'bold',
      align: 'center',
      verticalAlign: 'middle',
    }));
  }

  if (shape.description) {
    group.add(new Konva.Text({
      x: abs.width * 0.05,
      y: shapeAreaH + labelAreaH,
      width: abs.width * 0.9,
      height: descAreaH,
      text: shape.description,
      fontSize: Math.max(transform.toAbsoluteSize(2), 9),
      fill: '#6b7280',
      align: 'center',
      verticalAlign: 'top',
    }));
  }

  applyTransform(group, shape, transform);
  return group;
}

// ---------------------------------------------------------------------------
// Fallback shape (registry miss or image not yet loaded)
// ---------------------------------------------------------------------------

function renderFallbackShape(
  shape: IRShapeAsset,
  transform: CoordinateTransform,
): Konva.Group {
  const abs = transform.toAbsoluteBounds(shape.bounds);
  const group = new Konva.Group({ x: abs.x, y: abs.y, id: shape.id });

  const shapeAreaH = shape.label ? abs.height * 0.6 : abs.height;
  const labelAreaH = abs.height * 0.25;
  const descAreaH = abs.height * 0.15;

  const boxSize = Math.min(abs.width * 0.7, shapeAreaH * 0.8);
  const boxX = (abs.width - boxSize) / 2;
  const boxY = (shapeAreaH - boxSize) / 2;

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

  const displayText = shape.shapeId
    ? shape.shapeId.slice(0, 8) + (shape.shapeId.length > 8 ? '…' : '')
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

  if (shape.label) {
    group.add(new Konva.Text({
      x: 0,
      y: shapeAreaH,
      width: abs.width,
      height: labelAreaH,
      text: shape.label,
      fontSize: Math.max(transform.toAbsoluteSize(2.5), 11),
      fill: '#303336',
      fontStyle: 'bold',
      align: 'center',
      verticalAlign: 'middle',
    }));
  }

  if (shape.description) {
    group.add(new Konva.Text({
      x: abs.width * 0.05,
      y: shapeAreaH + labelAreaH,
      width: abs.width * 0.9,
      height: descAreaH,
      text: shape.description,
      fontSize: Math.max(transform.toAbsoluteSize(2), 9),
      fill: '#6b7280',
      align: 'center',
      verticalAlign: 'top',
    }));
  }

  applyTransform(group, shape, transform);
  return group;
}
