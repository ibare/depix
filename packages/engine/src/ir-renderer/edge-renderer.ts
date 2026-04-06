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
import { createArrowMarker, getArrowLength, getEdgePenultimatePoint, getEdgeSecondPoint } from './helpers.js';

export function renderEdge(edge: IREdge, transform: CoordinateTransform): Konva.Group {
  const group = new Konva.Group({ id: edge.id });
  const styleAttrs = resolveStyleAttrs(edge.style, transform);

  const absFrom = transform.toAbsolutePoint(edge.fromAnchor);
  const absTo = transform.toAbsolutePoint(edge.toAnchor);

  // Retract line endpoints so the stroke doesn't poke through arrow markers.
  // The line ends at the arrow base, while the arrow tip sits at the original anchor.
  const hasArrowEnd = !!edge.arrowEnd && edge.arrowEnd !== 'none';
  const hasArrowStart = !!edge.arrowStart && edge.arrowStart !== 'none';
  const arrowLen = (hasArrowEnd || hasArrowStart) ? getArrowLength(edge.style, transform) : 0;

  const lineStart = hasArrowStart
    ? retractPoint(absFrom, getEdgeSecondPoint(edge, absTo, transform), arrowLen)
    : absFrom;
  const lineEnd = hasArrowEnd
    ? retractPoint(absTo, getEdgePenultimatePoint(edge, absFrom, transform), arrowLen)
    : absTo;

  // Edge lines are thin (1–2px stroke) making them nearly impossible to click.
  // hitStrokeWidth expands the clickable area along the path without changing visuals.
  const hitStrokeWidth = 12;

  if (edge.path.type === 'straight') {
    const line = new Konva.Line({
      points: [lineStart.x, lineStart.y, lineEnd.x, lineEnd.y],
      hitStrokeWidth,
      ...styleAttrs,
    });
    group.add(line);
  } else if (edge.path.type === 'polyline') {
    const poly = edge.path as IREdgePathPolyline;
    const points: number[] = [lineStart.x, lineStart.y];
    for (const wp of poly.points) {
      const p = transform.toAbsolutePoint(wp);
      points.push(p.x, p.y);
    }
    points.push(lineEnd.x, lineEnd.y);

    const line = new Konva.Line({
      points,
      hitStrokeWidth,
      ...styleAttrs,
    });
    group.add(line);
  } else if (edge.path.type === 'bezier') {
    const bezier = edge.path as IREdgePathBezier;
    const lastIdx = bezier.controlPoints.length - 1;
    let d = `M ${lineStart.x} ${lineStart.y}`;
    for (let i = 0; i < bezier.controlPoints.length; i++) {
      const seg = bezier.controlPoints[i];
      const cp1 = transform.toAbsolutePoint(seg.cp1);
      const cp2 = transform.toAbsolutePoint(seg.cp2);
      // Retract only the final segment's endpoint
      const end = i === lastIdx ? lineEnd : transform.toAbsolutePoint(seg.end);
      d += ` C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${end.x} ${end.y}`;
    }

    const pathNode = new Konva.Path({
      data: d,
      hitStrokeWidth,
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

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/**
 * Retract `target` point toward `from` by `amount` pixels.
 * Used to shorten line endpoints so the stroke ends at the arrow base.
 */
function retractPoint(
  target: { x: number; y: number },
  from: { x: number; y: number },
  amount: number,
): { x: number; y: number } {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-10) return target;
  return {
    x: target.x - (dx / len) * amount,
    y: target.y - (dy / len) * amount,
  };
}
