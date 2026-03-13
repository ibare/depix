/**
 * Edge Renderer
 *
 * Renders IREdge elements to Konva nodes.
 * Supports three path types: straight, polyline, bezier.
 * Also handles arrow markers (arrowStart/arrowEnd) and mid-edge labels.
 */

import Konva from 'konva';
import type { IREdge, IREdgePathPolyline, IREdgePathBezier } from '@depix/core';
import type { CoordinateTransform } from '../coordinate-transform.js';
import { resolveStyleAttrs } from './style.js';
import { createArrowMarker, getEdgePenultimatePoint, getEdgeSecondPoint } from './helpers.js';

export function renderEdge(edge: IREdge, transform: CoordinateTransform): Konva.Group {
  const group = new Konva.Group({ id: edge.id });
  const styleAttrs = resolveStyleAttrs(edge.style, transform);

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
      fill: undefined, // bezier path should not be filled (only stroked)
    });
    group.add(pathNode);
  }

  // Arrow markers
  if (edge.arrowEnd && edge.arrowEnd !== 'none') {
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

  // Labels: Konva Text is positioned at its top-left by default.
  // We use offsetX/offsetY to shift the origin to the text center,
  // so that label.position refers to the center of the label.
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
      // offsetX/offsetY shift the node's origin to its visual center
      textNode.offsetX(textNode.width() / 2);
      textNode.offsetY(textNode.height() / 2);
      group.add(textNode);
    }
  }

  return group;
}
