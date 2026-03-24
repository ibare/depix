/**
 * Edge routing engine.
 *
 * Computes concrete path points for edges (connections between elements).
 * All coordinates are in the relative 0-100 coordinate space.
 *
 * @module @depix/core/compiler/routing/edge-router
 */

import type {
  IRBounds,
  IREdge,
  IREdgeLabel,
  IREdgePath,
  IREdgePathBezier,
  IREdgePathPolyline,
  IREdgePathStraight,
  IRPoint,
  IRShapeType,
  IRStyle,
  IRArrowType,
} from '../../ir/types.js';
import { generateId } from '../../ir/utils.js';

// ---------------------------------------------------------------------------
// Input interface
// ---------------------------------------------------------------------------

/**
 * Input for routing a single edge between two elements.
 */
export interface RouteEdgeInput {
  /** Source element ID. */
  fromId: string;
  /** Target element ID. */
  toId: string;
  /** Bounding box of the source element. */
  fromBounds: IRBounds;
  /** Bounding box of the target element. */
  toBounds: IRBounds;
  /** Shape type of the source element. */
  fromShape?: IRShapeType;
  /** Shape type of the target element. */
  toShape?: IRShapeType;
  /** DSL edge style determining arrow heads and dash pattern. */
  edgeStyle: '->' | '-->' | '--' | '<->';
  /** Optional label text for the edge. */
  label?: string;
  /** Path type for the edge route. Defaults to 'bezier'. */
  pathType?: 'straight' | 'polyline' | 'bezier';
  /** True for cycle-closing edges — routed with wider curves around the main flow. */
  isBackEdge?: boolean;
}

// ---------------------------------------------------------------------------
// Geometry helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Compute the center point of a bounding box.
 */
export function getBoundsCenter(bounds: IRBounds): IRPoint {
  return {
    x: bounds.x + bounds.w / 2,
    y: bounds.y + bounds.h / 2,
  };
}

/**
 * Compute intersection of the line from the rectangle center to
 * a target point with the rectangle perimeter.
 *
 * Uses slope comparison to determine which face of the rectangle
 * the line exits through.
 */
export function getRectBoundaryPoint(
  bounds: IRBounds,
  target: IRPoint,
): IRPoint {
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  // Guard against negative/zero dimensions (e.g. from overly tight layout)
  const hw = Math.max(Math.abs(bounds.w / 2), 0.1);
  const hh = Math.max(Math.abs(bounds.h / 2), 0.1);

  const dx = target.x - cx;
  const dy = target.y - cy;

  // Degenerate case: target is at the center
  if (dx === 0 && dy === 0) {
    return { x: cx + hw, y: cy };
  }

  // Compare slope of the line to the diagonal slope of the rectangle
  // to determine which face is hit.
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // If the line is more horizontal than the diagonal, it exits left or right.
  // Diagonal slope: hh / hw. Line slope: absDy / absDx.
  // Line exits horizontally if absDy / absDx <= hh / hw
  // i.e., absDy * hw <= hh * absDx

  if (absDy * hw <= hh * absDx) {
    // Exits left or right face
    const signX = dx > 0 ? 1 : -1;
    const t = hw / absDx;
    return {
      x: cx + signX * hw,
      y: cy + dy * t,
    };
  } else {
    // Exits top or bottom face
    const signY = dy > 0 ? 1 : -1;
    const t = hh / absDy;
    return {
      x: cx + dx * t,
      y: cy + signY * hh,
    };
  }
}

/**
 * Compute intersection of the line from the ellipse center to
 * a target point with the ellipse perimeter.
 *
 * Uses parametric angle: t = atan2(dy/ry, dx/rx).
 */
export function getEllipseBoundaryPoint(
  bounds: IRBounds,
  target: IRPoint,
): IRPoint {
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  const rx = bounds.w / 2;
  const ry = bounds.h / 2;

  const dx = target.x - cx;
  const dy = target.y - cy;

  // Degenerate case: target is at the center
  if (dx === 0 && dy === 0) {
    return { x: cx + rx, y: cy };
  }

  const t = Math.atan2(dy / ry, dx / rx);
  return {
    x: cx + rx * Math.cos(t),
    y: cy + ry * Math.sin(t),
  };
}

/**
 * Compute intersection of the line from the diamond center to a target
 * point with the diamond perimeter.
 *
 * Uses the L1-norm property: a point on the diamond satisfies
 * |dx|/hw + |dy|/hh = 1, so the parameter t = 1 / (|dx|/hw + |dy|/hh).
 */
function getDiamondBoundaryPoint(
  bounds: IRBounds,
  target: IRPoint,
): IRPoint {
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  const hw = bounds.w / 2;
  const hh = bounds.h / 2;

  const dx = target.x - cx;
  const dy = target.y - cy;

  if (dx === 0 && dy === 0) return { x: cx + hw, y: cy };

  const t = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
  return { x: cx + t * dx, y: cy + t * dy };
}

/**
 * Get a boundary point on a shape given its type.
 *
 * - Elliptic shapes (circle, ellipse, pill): ellipse math.
 * - Diamond: L1-norm diamond perimeter intersection.
 * - Cylinder: ellipse for top/bottom approach, rect for sides.
 * - Others (rect, hexagon, triangle, parallelogram, trapezoid): rect approximation.
 */
function getShapeBoundaryPoint(
  bounds: IRBounds,
  target: IRPoint,
  shape?: IRShapeType,
): IRPoint {
  if (shape === 'circle' || shape === 'ellipse' || shape === 'pill') {
    return getEllipseBoundaryPoint(bounds, target);
  }
  if (shape === 'diamond') {
    return getDiamondBoundaryPoint(bounds, target);
  }
  if (shape === 'cylinder') {
    // Cylinder top/bottom are elliptical; use ellipse when approaching vertically
    const cy = bounds.y + bounds.h / 2;
    const dy = target.y - cy;
    if (Math.abs(dy) > bounds.h * 0.3) {
      return getEllipseBoundaryPoint(bounds, target);
    }
    return getRectBoundaryPoint(bounds, target);
  }
  return getRectBoundaryPoint(bounds, target);
}

/**
 * Auto-detect anchor points on element boundaries based on relative position.
 *
 * Calculates the center of each element, then finds the boundary
 * intersection points from each center toward the other center.
 */
export function getAutoAnchors(
  fromBounds: IRBounds,
  toBounds: IRBounds,
  fromShape?: IRShapeType,
  toShape?: IRShapeType,
): { from: IRPoint; to: IRPoint } {
  const fromCenter = getBoundsCenter(fromBounds);
  const toCenter = getBoundsCenter(toBounds);

  const fromAnchor = getShapeBoundaryPoint(fromBounds, toCenter, fromShape);
  const toAnchor = getShapeBoundaryPoint(toBounds, fromCenter, toShape);

  return { from: fromAnchor, to: toAnchor };
}

// ---------------------------------------------------------------------------
// Path creation helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Create a straight path descriptor.
 */
export function createStraightPath(): IREdgePathStraight {
  return { type: 'straight' };
}

/**
 * Create an orthogonal (elbow) polyline path.
 *
 * Routes through a vertical midline:
 *   from -> (midX, from.y) -> (midX, to.y) -> to
 */
export function createPolylinePath(
  from: IRPoint,
  to: IRPoint,
): IREdgePathPolyline {
  const midX = (from.x + to.x) / 2;
  return {
    type: 'polyline',
    points: [
      { x: midX, y: from.y },
      { x: midX, y: to.y },
    ],
  };
}

/**
 * Create a cubic bezier path with adaptive control points.
 *
 * The offset is distance * 0.3. Control points are biased
 * horizontally or vertically depending on the connection direction.
 */
/**
 * Create a bezier path for a back-edge (cycle-closing feedback edge).
 * Routes the curve around the main flow by offsetting control points
 * to the side, producing a wide arc that loops back visually.
 *
 * Offset factor 0.6 = 60% of inter-node distance; chosen to clear
 * intermediate nodes in typical 3–5 node cycles. Unit: 0–100 coords.
 */
function createBackEdgePath(
  from: IRPoint,
  to: IRPoint,
): IREdgePathBezier {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // 0.6 = wider arc than normal bezier (0.3) to loop around nodes.
  const offset = Math.max(dist * 0.6, 8);

  // Determine which side to route on — prefer the side with more space
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  // Route to the right/below if midpoint is in left/top half, otherwise left/above
  const sideX = midX < 50 ? 1 : -1;
  const sideY = midY < 50 ? 1 : -1;

  let cp1: IRPoint;
  let cp2: IRPoint;

  if (Math.abs(dy) >= Math.abs(dx)) {
    // Primarily vertical flow — route sideways
    cp1 = { x: from.x + sideX * offset, y: from.y };
    cp2 = { x: to.x + sideX * offset, y: to.y };
  } else {
    // Primarily horizontal flow — route above/below
    cp1 = { x: from.x, y: from.y + sideY * offset };
    cp2 = { x: to.x, y: to.y + sideY * offset };
  }

  return {
    type: 'bezier',
    controlPoints: [{ cp1, cp2, end: to }],
  };
}

export function createBezierPath(
  from: IRPoint,
  to: IRPoint,
): IREdgePathBezier {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const offset = dist * 0.3;

  let cp1: IRPoint;
  let cp2: IRPoint;

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal bias: control points offset along X
    const signX = dx >= 0 ? 1 : -1;
    cp1 = { x: from.x + signX * offset, y: from.y };
    cp2 = { x: to.x - signX * offset, y: to.y };
  } else {
    // Vertical bias: control points offset along Y
    const signY = dy >= 0 ? 1 : -1;
    cp1 = { x: from.x, y: from.y + signY * offset };
    cp2 = { x: to.x, y: to.y - signY * offset };
  }

  return {
    type: 'bezier',
    controlPoints: [
      {
        cp1,
        cp2,
        end: to,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Midpoint helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Compute the midpoint of a cubic bezier curve at t=0.5.
 *
 * Uses the standard cubic bezier formula:
 *   B(t) = (1-t)^3*P0 + 3*(1-t)^2*t*P1 + 3*(1-t)*t^2*P2 + t^3*P3
 */
export function getBezierMidpoint(
  from: IRPoint,
  cp1: IRPoint,
  cp2: IRPoint,
  to: IRPoint,
): IRPoint {
  const t = 0.5;
  const t1 = 1 - t;
  const t1_2 = t1 * t1;
  const t1_3 = t1_2 * t1;
  const t_2 = t * t;
  const t_3 = t_2 * t;

  return {
    x: t1_3 * from.x + 3 * t1_2 * t * cp1.x + 3 * t1 * t_2 * cp2.x + t_3 * to.x,
    y: t1_3 * from.y + 3 * t1_2 * t * cp1.y + 3 * t1 * t_2 * cp2.y + t_3 * to.y,
  };
}

/**
 * Compute the midpoint along a polyline by arc length.
 *
 * Walks the segments of the polyline, accumulates length, and
 * finds the point at half the total length.
 */
export function getPolylineMidpoint(points: IRPoint[]): IRPoint {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }
  if (points.length === 1) {
    return { x: points[0].x, y: points[0].y };
  }

  // Compute total length
  let totalLength = 0;
  const segmentLengths: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    segmentLengths.push(len);
    totalLength += len;
  }

  // Edge case: all points at the same position
  if (totalLength === 0) {
    return { x: points[0].x, y: points[0].y };
  }

  const halfLength = totalLength / 2;
  let accumulated = 0;

  for (let i = 0; i < segmentLengths.length; i++) {
    const segLen = segmentLengths[i];
    if (accumulated + segLen >= halfLength) {
      // The midpoint lies within this segment
      const remaining = halfLength - accumulated;
      const ratio = remaining / segLen;
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * ratio,
        y: points[i].y + (points[i + 1].y - points[i].y) * ratio,
      };
    }
    accumulated += segLen;
  }

  // Fallback: return the last point
  return { x: points[points.length - 1].x, y: points[points.length - 1].y };
}

// ---------------------------------------------------------------------------
// Style mapping
// ---------------------------------------------------------------------------

/**
 * Map a DSL edge style to arrow types and visual style.
 */
function mapEdgeStyle(edgeStyle: '->' | '-->' | '--' | '<->'): {
  arrowStart?: IRArrowType;
  arrowEnd?: IRArrowType;
  style: IRStyle;
} {
  const baseStyle: IRStyle = {
    stroke: '#333333',
    strokeWidth: 0.3,
  };

  switch (edgeStyle) {
    case '->':
      return {
        arrowEnd: 'triangle',
        style: baseStyle,
      };
    case '-->':
      return {
        arrowEnd: 'triangle',
        style: { ...baseStyle, dashPattern: [4, 3] },
      };
    case '--':
      return {
        style: baseStyle,
      };
    case '<->':
      return {
        arrowStart: 'triangle',
        arrowEnd: 'triangle',
        style: baseStyle,
      };
  }
}

// ---------------------------------------------------------------------------
// Bounding box computation
// ---------------------------------------------------------------------------

/**
 * Compute the bounding box that encompasses the entire edge path.
 */
function computeEdgeBounds(
  fromAnchor: IRPoint,
  toAnchor: IRPoint,
  path: IREdgePath,
): IRBounds {
  // Collect all relevant points
  const allPoints: IRPoint[] = [fromAnchor, toAnchor];

  if (path.type === 'polyline') {
    allPoints.push(...path.points);
  } else if (path.type === 'bezier') {
    for (const seg of path.controlPoints) {
      allPoints.push(seg.cp1, seg.cp2, seg.end);
    }
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of allPoints) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
  };
}

// ---------------------------------------------------------------------------
// Label placement
// ---------------------------------------------------------------------------

const LABEL_OFFSET = 1.2;

/**
 * Offset a label position perpendicular to the edge direction,
 * so the label doesn't overlap the line.
 */
function offsetLabelFromEdge(
  midpoint: IRPoint,
  from: IRPoint,
  to: IRPoint,
): IRPoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return midpoint;

  // Normal vector (perpendicular, pointing "up" or "left")
  const nx = -dy / len;
  const ny = dx / len;

  return {
    x: midpoint.x + nx * LABEL_OFFSET,
    y: midpoint.y + ny * LABEL_OFFSET,
  };
}

/**
 * Compute label position based on the edge path midpoint.
 */
function computeLabelPosition(
  fromAnchor: IRPoint,
  toAnchor: IRPoint,
  path: IREdgePath,
): IRPoint {
  switch (path.type) {
    case 'straight': {
      return {
        x: (fromAnchor.x + toAnchor.x) / 2,
        y: (fromAnchor.y + toAnchor.y) / 2,
      };
    }
    case 'polyline': {
      const fullPoints = [fromAnchor, ...path.points, toAnchor];
      return getPolylineMidpoint(fullPoints);
    }
    case 'bezier': {
      const seg = path.controlPoints[0];
      return getBezierMidpoint(fromAnchor, seg.cp1, seg.cp2, seg.end);
    }
  }
}

// ---------------------------------------------------------------------------
// Main routing functions
// ---------------------------------------------------------------------------

/**
 * Route a single edge between two elements.
 *
 * Computes anchor points, path, labels, and produces a complete IREdge.
 */
export function routeEdge(input: RouteEdgeInput): IREdge {
  const pathType = input.pathType ?? 'bezier';

  // 1. Compute anchor points
  const anchors = getAutoAnchors(
    input.fromBounds,
    input.toBounds,
    input.fromShape,
    input.toShape,
  );

  // 2. Compute path
  let path: IREdgePath;
  if (input.isBackEdge) {
    path = createBackEdgePath(anchors.from, anchors.to);
  } else {
    switch (pathType) {
      case 'straight':
        path = createStraightPath();
        break;
      case 'polyline':
        path = createPolylinePath(anchors.from, anchors.to);
        break;
      case 'bezier':
        path = createBezierPath(anchors.from, anchors.to);
        break;
    }
  }

  // 3. Map edge style to arrows and visual style
  const { arrowStart, arrowEnd, style } = mapEdgeStyle(input.edgeStyle);

  // 4. Compute labels with normal offset to avoid overlapping the line
  let labels: IREdgeLabel[] | undefined;
  if (input.label) {
    const midpoint = computeLabelPosition(anchors.from, anchors.to, path);
    const position = offsetLabelFromEdge(midpoint, anchors.from, anchors.to);
    labels = [
      {
        text: input.label,
        position,
        placement: 'middle',
        fontSize: 1.5,
        color: '#333333',
      },
    ];
  }

  // 5. Compute bounding box for the edge
  const bounds = computeEdgeBounds(anchors.from, anchors.to, path);

  // 6. Assemble the IREdge
  const edge: IREdge = {
    id: generateId(),
    type: 'edge',
    bounds,
    style,
    fromId: input.fromId,
    toId: input.toId,
    fromAnchor: anchors.from,
    toAnchor: anchors.to,
    path,
  };

  if (arrowStart) {
    edge.arrowStart = arrowStart;
  }
  if (arrowEnd) {
    edge.arrowEnd = arrowEnd;
  }
  if (labels) {
    edge.labels = labels;
  }

  return edge;
}

/**
 * Route multiple edges.
 */
export function routeEdges(inputs: RouteEdgeInput[]): IREdge[] {
  return inputs.map(routeEdge);
}
