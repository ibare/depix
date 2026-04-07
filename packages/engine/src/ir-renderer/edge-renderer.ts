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
import { getArrowLength, getEdgePenultimatePoint, getEdgeSecondPoint } from './helpers.js';
import { createArrowMarker } from './arrow-markers/index.js';

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
    let segStart = lineStart;
    for (let i = 0; i < bezier.controlPoints.length; i++) {
      const seg = bezier.controlPoints[i];
      const isLast = i === lastIdx;
      const segEnd = isLast ? lineEnd : transform.toAbsolutePoint(seg.end);

      let cp1 = transform.toAbsolutePoint(seg.cp1);
      let cp2 = transform.toAbsolutePoint(seg.cp2);

      // smooth-step 라우터는 첫/마지막 segment를 '직선 cubic'(cp1 = from + 1/3 × (to-from),
      // cp2 = from + 2/3 × (to-from))으로 생성한다. arrowStart/arrowEnd 때문에
      // lineStart/lineEnd가 retract되면 원본 cp1/cp2가 새 끝점과 어긋나 t=0/t=1에서
      // 탄젠트가 역방향이 되고, 곡선이 화살촉 너머로 hook처럼 튀어나온다
      // (양방향 `<->` 엣지에서 왼쪽 화살촉 라인 돌출의 원인).
      // 첫/마지막 segment의 cp1/cp2를 새 양끝 기준으로 재계산해 직선 cubic을 유지한다.
      // 1/3, 2/3 = straightSegment의 직선 cubic 파라미터화 공식 (smooth-step.ts와 동일).
      // NOTE: 현재 bezier path는 smooth-step만 생성하며 첫/마지막 segment는 항상 직선 cubic이다.
      //       향후 곡선 bezier 라우터가 추가되면 이 분기의 전제(직선 cubic 가정)를 재검토할 것.
      const firstNeedsRecalc = i === 0 && hasArrowStart;
      const lastNeedsRecalc = isLast && hasArrowEnd;
      if (firstNeedsRecalc || lastNeedsRecalc) {
        cp1 = {
          x: segStart.x + (segEnd.x - segStart.x) / 3,
          y: segStart.y + (segEnd.y - segStart.y) / 3,
        };
        cp2 = {
          x: segStart.x + (segEnd.x - segStart.x) * 2 / 3,
          y: segStart.y + (segEnd.y - segStart.y) * 2 / 3,
        };
      }

      d += ` C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${segEnd.x} ${segEnd.y}`;
      segStart = segEnd;
    }

    const pathNode = new Konva.Path({
      data: d,
      hitStrokeWidth,
      ...styleAttrs,
      fill: undefined, // bezier path should not be filled (only stroked)
    });
    group.add(pathNode);
  }

  // Arrow markers — dispatch by IR arrow type to the pluggable registry.
  if (hasArrowEnd) {
    const prevPoint = getEdgePenultimatePoint(edge, absFrom, transform);
    const arrow = createArrowMarker(edge.arrowEnd, prevPoint, absTo, edge.style, arrowLen, transform);
    if (arrow) group.add(arrow);
  }

  if (hasArrowStart) {
    const nextPoint = getEdgeSecondPoint(edge, absTo, transform);
    const arrow = createArrowMarker(edge.arrowStart, nextPoint, absFrom, edge.style, arrowLen, transform);
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
