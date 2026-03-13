/**
 * IR Element Renderers — Dispatcher & Remaining Types
 *
 * Dispatches each IRElement type to its renderer.
 * Heavy renderers (shape, edge) are in separate files to stay under 300 lines.
 *
 * File structure:
 *   renderers.ts      — dispatcher + text, image, line, path, container renderers
 *   shape-renderer.ts — renderShape (9 shape types)
 *   edge-renderer.ts  — renderEdge (straight, polyline, bezier + arrows + labels)
 *   style.ts          — style attribute resolution helpers
 *   helpers.ts        — arrow marker and edge direction geometry
 */

import Konva from 'konva';
import type {
  IRElement,
  IRText,
  IRImage,
  IRLine,
  IRPath,
  IRContainer,
} from '@depix/core';
import type { CoordinateTransform } from '../coordinate-transform.js';
import { resolveStyleAttrs, buildFontStyle, applyTransform } from './style.js';
import { createArrowMarker } from './helpers.js';
import { renderShape } from './shape-renderer.js';
import { renderEdge } from './edge-renderer.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a single IR element to a Konva node.
 * Dispatches by element.type — no other condition is used for branching.
 */
export function renderElement(
  element: IRElement,
  transform: CoordinateTransform,
): Konva.Group | Konva.Shape {
  switch (element.type) {
    case 'shape':
      return renderShape(element, transform);
    case 'text':
      return renderText(element, transform);
    case 'image':
      return renderImage(element, transform);
    case 'line':
      return renderLine(element, transform);
    case 'path':
      return renderPath(element, transform);
    case 'edge':
      return renderEdge(element, transform);
    case 'container':
      return renderContainer(element, transform);
  }
}

/**
 * Render a list of IR elements to a Konva Group.
 */
export function renderElements(
  elements: IRElement[],
  transform: CoordinateTransform,
): Konva.Group {
  const group = new Konva.Group();
  for (const el of elements) {
    group.add(renderElement(el, transform));
  }
  return group;
}

// ---------------------------------------------------------------------------
// Text renderer
// ---------------------------------------------------------------------------

function renderText(text: IRText, transform: CoordinateTransform): Konva.Text {
  const abs = transform.toAbsoluteBounds(text.bounds);
  const fontSize = transform.toAbsoluteSize(text.fontSize);

  const node = new Konva.Text({
    x: abs.x,
    y: abs.y,
    width: abs.width,
    height: abs.height,
    text: text.content,
    fontSize,
    fill: text.color,
    fontFamily: text.fontFamily ?? 'Arial',
    fontStyle: buildFontStyle(text.fontWeight, text.fontStyle),
    textDecoration: text.textDecoration ?? 'none',
    align: text.align ?? 'left',
    verticalAlign: text.valign ?? 'top',
    lineHeight: text.lineHeight ?? 1.2,
    id: text.id,
  });

  applyTransform(node, text, transform);
  return node;
}

// ---------------------------------------------------------------------------
// Image renderer
// ---------------------------------------------------------------------------

function renderImage(image: IRImage, transform: CoordinateTransform): Konva.Group {
  const abs = transform.toAbsoluteBounds(image.bounds);
  const group = new Konva.Group({
    x: abs.x,
    y: abs.y,
    id: image.id,
  });

  // Placeholder rect (image loading is async, we create a placeholder)
  const placeholder = new Konva.Rect({
    width: abs.width,
    height: abs.height,
    fill: '#f0f0f0',
    cornerRadius: image.cornerRadius
      ? transform.toAbsoluteSize(image.cornerRadius)
      : undefined,
    ...resolveStyleAttrs(image.style, transform),
  });
  group.add(placeholder);

  // Clip for corner radius: Konva clipFunc receives a 2D canvas context
  // and clips within the Group's local coordinate space (origin = top-left of group)
  if (image.cornerRadius) {
    group.clipFunc((ctx) => {
      const r = transform.toAbsoluteSize(image.cornerRadius!);
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(abs.width - r, 0);
      ctx.arcTo(abs.width, 0, abs.width, r, r);
      ctx.lineTo(abs.width, abs.height - r);
      ctx.arcTo(abs.width, abs.height, abs.width - r, abs.height, r);
      ctx.lineTo(r, abs.height);
      ctx.arcTo(0, abs.height, 0, abs.height - r, r);
      ctx.lineTo(0, r);
      ctx.arcTo(0, 0, r, 0, r);
      ctx.closePath();
    });
  }

  applyTransform(group, image, transform);
  return group;
}

// ---------------------------------------------------------------------------
// Line renderer
// ---------------------------------------------------------------------------

function renderLine(line: IRLine, transform: CoordinateTransform): Konva.Group {
  const absFrom = transform.toAbsolutePoint(line.from);
  const absTo = transform.toAbsolutePoint(line.to);
  const group = new Konva.Group({ id: line.id });

  const lineNode = new Konva.Line({
    points: [absFrom.x, absFrom.y, absTo.x, absTo.y],
    ...resolveStyleAttrs(line.style, transform),
  });
  group.add(lineNode);

  if (line.arrowEnd && line.arrowEnd !== 'none') {
    const arrow = createArrowMarker(absFrom, absTo, line.style, transform);
    if (arrow) group.add(arrow);
  }

  return group;
}

// ---------------------------------------------------------------------------
// Path renderer
// ---------------------------------------------------------------------------

function renderPath(pathEl: IRPath, transform: CoordinateTransform): Konva.Path {
  const abs = transform.toAbsoluteBounds(pathEl.bounds);
  const { scaleX, scaleY } = transform.getScale();

  return new Konva.Path({
    x: abs.x,
    y: abs.y,
    data: pathEl.d,
    scaleX,
    scaleY,
    ...resolveStyleAttrs(pathEl.style, transform),
    id: pathEl.id,
  });
}

// ---------------------------------------------------------------------------
// Container renderer
// ---------------------------------------------------------------------------

function renderContainer(container: IRContainer, transform: CoordinateTransform): Konva.Group {
  const abs = transform.toAbsoluteBounds(container.bounds);
  const group = new Konva.Group({
    x: abs.x,
    y: abs.y,
    id: container.id,
  });

  const styleAttrs = resolveStyleAttrs(container.style, transform);
  if (styleAttrs.fill || styleAttrs.stroke) {
    const bg = new Konva.Rect({
      width: abs.width,
      height: abs.height,
      ...styleAttrs,
    });
    group.add(bg);
  }

  // Clipping: clipFunc uses the Group's local coordinate space (origin = group top-left)
  if (container.clip) {
    group.clipFunc((ctx) => {
      ctx.rect(0, 0, abs.width, abs.height);
    });
  }

  // Render children with position adjusted to Group-relative coordinates.
  // IR children use absolute canvas coordinates; subtract the container origin
  // so children are placed relative to the Group's local origin.
  for (const child of container.children) {
    const childNode = renderElement(child, transform);
    childNode.x(childNode.x() - abs.x);
    childNode.y(childNode.y() - abs.y);
    group.add(childNode);
  }

  applyTransform(group, container, transform);
  return group;
}
