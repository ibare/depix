/**
 * Shape Renderer
 *
 * Renders IRShape elements to Konva nodes.
 * Supports: rect, circle, ellipse, diamond, pill, hexagon, triangle, parallelogram.
 */

import Konva from 'konva';
import type { IRShape } from '@depix/core';
import type { CoordinateTransform } from '../coordinate-transform.js';
import { resolveStyleAttrs, resolveCornerRadius, applyTransform } from './style.js';

export function renderShape(shape: IRShape, transform: CoordinateTransform): Konva.Group {
  const abs = transform.toAbsoluteBounds(shape.bounds);
  const group = new Konva.Group({
    x: abs.x,
    y: abs.y,
    id: shape.id,
  });

  const styleAttrs = resolveStyleAttrs(shape.style, transform);
  let shapeNode: Konva.Shape;

  switch (shape.shape) {
    case 'rect':
      shapeNode = new Konva.Rect({
        width: abs.width,
        height: abs.height,
        cornerRadius: resolveCornerRadius(shape.cornerRadius, transform),
        ...styleAttrs,
      });
      break;

    case 'circle': {
      const r = Math.min(abs.width, abs.height) / 2;
      shapeNode = new Konva.Circle({
        // Konva Circle uses center (x, y); Group is at abs.x/y, so shape center = half dimensions
        x: abs.width / 2,
        y: abs.height / 2,
        radius: r,
        ...styleAttrs,
      });
      break;
    }

    case 'ellipse':
      shapeNode = new Konva.Ellipse({
        // Konva Ellipse uses center (x, y); same centering pattern as Circle
        x: abs.width / 2,
        y: abs.height / 2,
        radiusX: abs.width / 2,
        radiusY: abs.height / 2,
        ...styleAttrs,
      });
      break;

    case 'diamond':
      shapeNode = new Konva.Line({
        points: [
          abs.width / 2, 0,
          abs.width, abs.height / 2,
          abs.width / 2, abs.height,
          0, abs.height / 2,
        ],
        closed: true,
        ...styleAttrs,
      });
      break;

    case 'pill':
      shapeNode = new Konva.Rect({
        width: abs.width,
        height: abs.height,
        cornerRadius: abs.height / 2,
        ...styleAttrs,
      });
      break;

    case 'hexagon': {
      const hh = abs.height / 2;
      const inset = abs.width * 0.25;
      shapeNode = new Konva.Line({
        points: [
          inset, 0,
          abs.width - inset, 0,
          abs.width, hh,
          abs.width - inset, abs.height,
          inset, abs.height,
          0, hh,
        ],
        closed: true,
        ...styleAttrs,
      });
      break;
    }

    case 'triangle':
      shapeNode = new Konva.Line({
        points: [
          abs.width / 2, 0,
          abs.width, abs.height,
          0, abs.height,
        ],
        closed: true,
        ...styleAttrs,
      });
      break;

    case 'parallelogram': {
      const skew = abs.width * 0.2;
      shapeNode = new Konva.Line({
        points: [
          skew, 0,
          abs.width, 0,
          abs.width - skew, abs.height,
          0, abs.height,
        ],
        closed: true,
        ...styleAttrs,
      });
      break;
    }

    default:
      // Fallback to rect
      shapeNode = new Konva.Rect({
        width: abs.width,
        height: abs.height,
        ...styleAttrs,
      });
  }

  group.add(shapeNode);

  // Inner text
  if (shape.innerText) {
    const fontSize = transform.toAbsoluteSize(shape.innerText.fontSize);
    const textNode = new Konva.Text({
      text: shape.innerText.content,
      width: abs.width,
      height: abs.height,
      fontSize,
      fill: shape.innerText.color,
      fontStyle: shape.innerText.fontWeight === 'bold' ? 'bold' : 'normal',
      align: shape.innerText.align ?? 'center',
      verticalAlign: shape.innerText.valign ?? 'middle',
    });
    group.add(textNode);
  }

  applyTransform(group, shape, transform);
  return group;
}
