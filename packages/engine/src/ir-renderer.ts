/**
 * IR Renderer
 *
 * Renders DepixIR elements to Konva nodes. All layout is pre-computed
 * in the IR, so the renderer simply maps IR elements to Konva primitives
 * with coordinate transformation.
 */

import Konva from 'konva';
import type {
  IRElement,
  IRShape,
  IRText,
  IRImage,
  IRLine,
  IRPath,
  IREdge,
  IRContainer,
  IRStyle,
  IRGradient,
  IRShadow,
  IRBounds,
  IRPoint,
  IREdgePathPolyline,
  IREdgePathBezier,
} from '@depix/core';
import { CoordinateTransform } from './coordinate-transform.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a single IR element to a Konva node.
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
// Shape renderer
// ---------------------------------------------------------------------------

function renderShape(shape: IRShape, transform: CoordinateTransform): Konva.Group {
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
        x: abs.width / 2,
        y: abs.height / 2,
        radius: r,
        ...styleAttrs,
      });
      break;
    }

    case 'ellipse':
      shapeNode = new Konva.Ellipse({
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
      const hw = abs.width / 2;
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

  // Clip for corner radius
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

  // Arrow markers
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
// Edge renderer
// ---------------------------------------------------------------------------

function renderEdge(edge: IREdge, transform: CoordinateTransform): Konva.Group {
  const group = new Konva.Group({ id: edge.id });
  const styleAttrs = resolveStyleAttrs(edge.style, transform);

  // Build points array from path
  const absFrom = transform.toAbsolutePoint(edge.fromAnchor);
  const absTo = transform.toAbsolutePoint(edge.toAnchor);

  if (edge.path.type === 'straight') {
    const line = new Konva.Line({
      points: [absFrom.x, absFrom.y, absTo.x, absTo.y],
      ...styleAttrs,
    });
    group.add(line);
  } else if (edge.path.type === 'polyline') {
    const poly = edge.path as IREdgePathPolyline;
    const points: number[] = [absFrom.x, absFrom.y];
    for (const wp of poly.points) {
      const p = transform.toAbsolutePoint(wp);
      points.push(p.x, p.y);
    }
    points.push(absTo.x, absTo.y);

    const line = new Konva.Line({
      points,
      ...styleAttrs,
    });
    group.add(line);
  } else if (edge.path.type === 'bezier') {
    const bezier = edge.path as IREdgePathBezier;
    // Build SVG path data for bezier
    let d = `M ${absFrom.x} ${absFrom.y}`;
    for (const seg of bezier.controlPoints) {
      const cp1 = transform.toAbsolutePoint(seg.cp1);
      const cp2 = transform.toAbsolutePoint(seg.cp2);
      const end = transform.toAbsolutePoint(seg.end);
      d += ` C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${end.x} ${end.y}`;
    }

    const pathNode = new Konva.Path({
      data: d,
      ...styleAttrs,
      fill: undefined, // paths should not be filled
    });
    group.add(pathNode);
  }

  // Arrow markers
  if (edge.arrowEnd && edge.arrowEnd !== 'none') {
    // Get the last two points for arrow direction
    const lastPoint = absTo;
    const prevPoint = getEdgePenultimatePoint(edge, absFrom, transform);
    const arrow = createArrowMarker(prevPoint, lastPoint, edge.style, transform);
    if (arrow) group.add(arrow);
  }

  if (edge.arrowStart && edge.arrowStart !== 'none') {
    const firstPoint = absFrom;
    const nextPoint = getEdgeSecondPoint(edge, absTo, transform);
    const arrow = createArrowMarker(nextPoint, firstPoint, edge.style, transform);
    if (arrow) group.add(arrow);
  }

  // Labels
  if (edge.labels) {
    for (const label of edge.labels) {
      const absPos = transform.toAbsolutePoint(label.position);
      const fontSize = transform.toAbsoluteSize(label.fontSize);
      const textNode = new Konva.Text({
        x: absPos.x,
        y: absPos.y,
        text: label.text,
        fontSize,
        fill: label.color,
        align: 'center',
      });
      // Center the label on its position
      textNode.offsetX(textNode.width() / 2);
      textNode.offsetY(textNode.height() / 2);
      group.add(textNode);
    }
  }

  return group;
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

  // Container background/border
  const styleAttrs = resolveStyleAttrs(container.style, transform);
  if (styleAttrs.fill || styleAttrs.stroke) {
    const bg = new Konva.Rect({
      width: abs.width,
      height: abs.height,
      ...styleAttrs,
    });
    group.add(bg);
  }

  // Clipping
  if (container.clip) {
    group.clipFunc((ctx) => {
      ctx.rect(0, 0, abs.width, abs.height);
    });
  }

  // Render children (offset relative to container)
  for (const child of container.children) {
    const childNode = renderElement(child, transform);
    // Adjust child position relative to container
    childNode.x(childNode.x() - abs.x);
    childNode.y(childNode.y() - abs.y);
    group.add(childNode);
  }

  applyTransform(group, container, transform);
  return group;
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

function resolveStyleAttrs(
  style: IRStyle,
  transform: CoordinateTransform,
): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};

  if (style.fill !== undefined) {
    if (typeof style.fill === 'string') {
      attrs.fill = style.fill;
    } else {
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

function resolveGradientStops(gradient: IRGradient): (number | string)[] {
  const stops: (number | string)[] = [];
  for (const stop of gradient.stops) {
    stops.push(stop.position, stop.color);
  }
  return stops;
}

function resolveCornerRadius(
  cr: IRShape['cornerRadius'],
  transform: CoordinateTransform,
): number | number[] | undefined {
  if (cr === undefined) return undefined;
  if (typeof cr === 'number') return transform.toAbsoluteSize(cr);
  return [
    transform.toAbsoluteSize(cr.tl),
    transform.toAbsoluteSize(cr.tr),
    transform.toAbsoluteSize(cr.br),
    transform.toAbsoluteSize(cr.bl),
  ];
}

function buildFontStyle(
  weight?: 'normal' | 'bold',
  style?: 'normal' | 'italic',
): string {
  const parts: string[] = [];
  if (style === 'italic') parts.push('italic');
  if (weight === 'bold') parts.push('bold');
  return parts.join(' ') || 'normal';
}

function applyTransform(
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

// ---------------------------------------------------------------------------
// Arrow marker helpers
// ---------------------------------------------------------------------------

function createArrowMarker(
  from: { x: number; y: number },
  to: { x: number; y: number },
  style: IRStyle,
  transform: CoordinateTransform,
): Konva.Line | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return null;

  const arrowSize = transform.toAbsoluteSize(1.5);
  const ux = dx / len;
  const uy = dy / len;

  // Perpendicular
  const px = -uy;
  const py = ux;

  const tipX = to.x;
  const tipY = to.y;
  const baseX = to.x - ux * arrowSize;
  const baseY = to.y - uy * arrowSize;

  return new Konva.Line({
    points: [
      baseX + px * arrowSize * 0.5,
      baseY + py * arrowSize * 0.5,
      tipX, tipY,
      baseX - px * arrowSize * 0.5,
      baseY - py * arrowSize * 0.5,
    ],
    closed: true,
    fill: typeof style.stroke === 'string' ? style.stroke : '#000000',
  });
}

function getEdgePenultimatePoint(
  edge: IREdge,
  absFrom: { x: number; y: number },
  transform: CoordinateTransform,
): { x: number; y: number } {
  if (edge.path.type === 'polyline') {
    const poly = edge.path as IREdgePathPolyline;
    if (poly.points.length > 0) {
      return transform.toAbsolutePoint(poly.points[poly.points.length - 1]);
    }
  }
  if (edge.path.type === 'bezier') {
    const bezier = edge.path as IREdgePathBezier;
    if (bezier.controlPoints.length > 0) {
      const last = bezier.controlPoints[bezier.controlPoints.length - 1];
      return transform.toAbsolutePoint(last.cp2);
    }
  }
  return absFrom;
}

function getEdgeSecondPoint(
  edge: IREdge,
  absTo: { x: number; y: number },
  transform: CoordinateTransform,
): { x: number; y: number } {
  if (edge.path.type === 'polyline') {
    const poly = edge.path as IREdgePathPolyline;
    if (poly.points.length > 0) {
      return transform.toAbsolutePoint(poly.points[0]);
    }
  }
  if (edge.path.type === 'bezier') {
    const bezier = edge.path as IREdgePathBezier;
    if (bezier.controlPoints.length > 0) {
      return transform.toAbsolutePoint(bezier.controlPoints[0].cp1);
    }
  }
  return absTo;
}
