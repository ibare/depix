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
  IRPoint,
  IRShapeType,
  IRStyle,
  IRArrowType,
} from '../../ir/types.js';
import { generateId } from '../../ir/utils.js';
import { createEdgePath, computeBackEdgeDetour, type EdgePathType, type PathContext } from './edge-paths/index.js';
import type { Face } from './edge-paths/index.js';

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
  /** Path type for the edge route. Defaults to 'smooth-step'. */
  pathType?: EdgePathType;
  /** True for cycle-closing edges — routed with wider curves around the main flow. */
  isBackEdge?: boolean;
  /**
   * Port offset for multi-edge distribution at the source node.
   * Range [-1, 1]: 0 = center, ±1 = edge of perpendicular spread.
   * Applied perpendicular to the center-to-center direction.
   */
  fromPortOffset?: number;
  /**
   * Port offset for multi-edge distribution at the target node.
   * Same semantics as fromPortOffset.
   */
  toPortOffset?: number;
  /**
   * 백엣지 회피용: from/to를 제외한 같은 블록 내 형제 노드들의 bounds.
   * 백엣지 경로가 다른 노드를 관통하지 않도록 방향 선택에 사용.
   */
  siblingBounds?: IRBounds[];
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
 * 도형의 특정 면(face) 중심 좌표를 반환한다.
 * 백엣지 앵커 계산에 사용 — 호의 우회 방향과 일치하는 면에서 출발/도착.
 */
function getFaceCenter(bounds: IRBounds, face: Face): IRPoint {
  switch (face) {
    case 'right':  return { x: bounds.x + bounds.w,     y: bounds.y + bounds.h / 2 };
    case 'left':   return { x: bounds.x,                y: bounds.y + bounds.h / 2 };
    case 'top':    return { x: bounds.x + bounds.w / 2, y: bounds.y };
    case 'bottom': return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h };
  }
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
 * Compute intersection of a ray from polygon center to target with polygon edges.
 * vertices: polygon vertices in order (closed — first vertex is NOT repeated at end).
 */
function getPolygonBoundaryPoint(
  center: IRPoint,
  target: IRPoint,
  vertices: IRPoint[],
): IRPoint {
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  if (dx === 0 && dy === 0) return vertices[0];

  let bestT = Infinity;
  let bestPoint = vertices[0];
  const n = vertices.length;

  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    // Ray: center + t*(target - center), t > 0
    // Edge: a + s*(b - a), 0 <= s <= 1
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < 1e-10) continue;

    const t = ((a.x - center.x) * ey - (a.y - center.y) * ex) / denom;
    const s = ((a.x - center.x) * dy - (a.y - center.y) * dx) / denom;

    if (t > 0 && s >= 0 && s <= 1 && t < bestT) {
      bestT = t;
      bestPoint = { x: center.x + t * dx, y: center.y + t * dy };
    }
  }

  return bestPoint;
}

/**
 * Hexagon boundary: 6 vertices forming a regular flat-top hexagon.
 * Inset = 25% of half-width on left/right edges.
 */
function getHexagonBoundaryPoint(bounds: IRBounds, target: IRPoint): IRPoint {
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  const hw = bounds.w / 2;
  const hh = bounds.h / 2;
  // 0.25 = flat-top hexagon inset ratio (quarter of half-width)
  const inset = hw * 0.25;
  const vertices: IRPoint[] = [
    { x: cx - hw + inset, y: cy - hh }, // top-left
    { x: cx + hw - inset, y: cy - hh }, // top-right
    { x: cx + hw, y: cy },              // right
    { x: cx + hw - inset, y: cy + hh }, // bottom-right
    { x: cx - hw + inset, y: cy + hh }, // bottom-left
    { x: cx - hw, y: cy },              // left
  ];
  return getPolygonBoundaryPoint({ x: cx, y: cy }, target, vertices);
}

/**
 * Triangle boundary: isosceles pointing up, base at bottom.
 */
function getTriangleBoundaryPoint(bounds: IRBounds, target: IRPoint): IRPoint {
  const cx = bounds.x + bounds.w / 2;
  const vertices: IRPoint[] = [
    { x: cx, y: bounds.y },                          // top
    { x: bounds.x + bounds.w, y: bounds.y + bounds.h }, // bottom-right
    { x: bounds.x, y: bounds.y + bounds.h },            // bottom-left
  ];
  // 0.6 = 삼각형 centroid 근사 (정삼각형 centroid는 2/3 ≈ 0.667이나 시각적 균형을 위해 0.6 사용); 비율 단위 (bounds.h 대비)
  return getPolygonBoundaryPoint({ x: cx, y: bounds.y + bounds.h * 0.6 }, target, vertices);
}

/**
 * Trapezoid boundary: wider at bottom, narrower at top.
 * Top inset = 20% of width on each side.
 */
function getTrapezoidBoundaryPoint(bounds: IRBounds, target: IRPoint): IRPoint {
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  // 0.2 = top-edge inset ratio (each side narrows by 20% of width)
  const topInset = bounds.w * 0.2;
  const vertices: IRPoint[] = [
    { x: bounds.x + topInset, y: bounds.y },            // top-left
    { x: bounds.x + bounds.w - topInset, y: bounds.y }, // top-right
    { x: bounds.x + bounds.w, y: bounds.y + bounds.h }, // bottom-right
    { x: bounds.x, y: bounds.y + bounds.h },            // bottom-left
  ];
  return getPolygonBoundaryPoint({ x: cx, y: cy }, target, vertices);
}

/**
 * Parallelogram boundary: skewed rectangle.
 * Skew = 15% of width.
 */
function getParallelogramBoundaryPoint(bounds: IRBounds, target: IRPoint): IRPoint {
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  // 0.15 = skew ratio (horizontal offset as fraction of width)
  const skew = bounds.w * 0.15;
  const vertices: IRPoint[] = [
    { x: bounds.x + skew, y: bounds.y },                    // top-left
    { x: bounds.x + bounds.w, y: bounds.y },                // top-right
    { x: bounds.x + bounds.w - skew, y: bounds.y + bounds.h }, // bottom-right
    { x: bounds.x, y: bounds.y + bounds.h },                   // bottom-left
  ];
  return getPolygonBoundaryPoint({ x: cx, y: cy }, target, vertices);
}

/**
 * Get a boundary point on a shape given its type.
 *
 * - Elliptic shapes (circle, ellipse, pill): ellipse math.
 * - Diamond: L1-norm diamond perimeter intersection.
 * - Cylinder: ellipse for top/bottom approach, rect for sides.
 * - Polygon shapes (hexagon, triangle, trapezoid, parallelogram): exact polygon intersection.
 * - Others (rect): rect approximation.
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
  if (shape === 'hexagon') return getHexagonBoundaryPoint(bounds, target);
  if (shape === 'triangle') return getTriangleBoundaryPoint(bounds, target);
  if (shape === 'trapezoid') return getTrapezoidBoundaryPoint(bounds, target);
  if (shape === 'parallelogram') return getParallelogramBoundaryPoint(bounds, target);
  return getRectBoundaryPoint(bounds, target);
}

/**
 * Auto-detect anchor points on element boundaries based on relative position.
 *
 * Calculates the center of each element, then finds the boundary
 * intersection points from each center toward the other center.
 *
 * When port offsets are provided (for multi-edge distribution), the target
 * point is shifted perpendicular to the center-to-center axis before
 * computing the boundary intersection. This spreads multiple edges across
 * the face of the node instead of all converging on the same point.
 */
export function getAutoAnchors(
  fromBounds: IRBounds,
  toBounds: IRBounds,
  fromShape?: IRShapeType,
  toShape?: IRShapeType,
  fromPortOffset = 0,
  toPortOffset = 0,
): { from: IRPoint; to: IRPoint } {
  const fromCenter = getBoundsCenter(fromBounds);
  const toCenter = getBoundsCenter(toBounds);

  // Perpendicular unit vector to center-to-center axis
  const cdx = toCenter.x - fromCenter.x;
  const cdy = toCenter.y - fromCenter.y;
  const clen = Math.sqrt(cdx * cdx + cdy * cdy);

  let px = 0;
  let py = 0;
  if (clen > 0.01) {
    // Perpendicular direction: rotate 90 degrees CCW
    px = -cdy / clen;
    py = cdx / clen;
  }

  // Shift target points by port offset perpendicular to the main axis.
  // 0.25 = spread factor (25% of shorter dimension) — keeps anchors near face center
  const fromSpread = Math.min(fromBounds.w, fromBounds.h) * 0.25;
  const toSpread = Math.min(toBounds.w, toBounds.h) * 0.25;

  const fromTarget: IRPoint = {
    x: toCenter.x + px * fromPortOffset * fromSpread,
    y: toCenter.y + py * fromPortOffset * fromSpread,
  };
  const toTarget: IRPoint = {
    x: fromCenter.x + px * toPortOffset * toSpread,
    y: fromCenter.y + py * toPortOffset * toSpread,
  };

  const fromAnchor = getShapeBoundaryPoint(fromBounds, fromTarget, fromShape);
  const toAnchor = getShapeBoundaryPoint(toBounds, toTarget, toShape);

  return { from: fromAnchor, to: toAnchor };
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
      // 다중 segment bezier (SmoothStep 등): 중간 segment의 midpoint 사용
      const n = path.controlPoints.length;
      const midIdx = Math.floor(n / 2);
      const seg = path.controlPoints[midIdx];
      const start = midIdx === 0
        ? fromAnchor
        : path.controlPoints[midIdx - 1].end;
      return getBezierMidpoint(start, seg.cp1, seg.cp2, seg.end);
    }
  }
}

// ---------------------------------------------------------------------------
// Arrival gap
// ---------------------------------------------------------------------------

/**
 * Retract both anchor points inward by `gap` units along the from→to axis.
 * This creates a small visual separation between the edge endpoint and the
 * shape boundary, so arrows "float" near the shape rather than touching it.
 *
 * Mutates the anchors object in place.
 */
function applyArrivalGap(
  anchors: { from: IRPoint; to: IRPoint },
  gap: number,
): void {
  const dx = anchors.to.x - anchors.from.x;
  const dy = anchors.to.y - anchors.from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  // Skip if anchors are too close — gap would invert the edge
  if (len < gap * 3) return;

  const ux = dx / len;
  const uy = dy / len;

  anchors.from.x += ux * gap;
  anchors.from.y += uy * gap;
  anchors.to.x -= ux * gap;
  anchors.to.y -= uy * gap;
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
  const pathType = input.pathType ?? 'smooth-step';

  // 1. Compute anchor points
  let anchors: { from: IRPoint; to: IRPoint };

  if (input.isBackEdge) {
    // 백엣지: 호의 우회 방향에 맞는 면 중심을 앵커로 사용.
    // 중심→중심 직선 교차(getAutoAnchors)는 넓은 호와 방향이 불일치하므로
    // detour 방향을 먼저 결정하고 해당 면의 중심을 앵커로 잡는다.
    const fromCenter = getBoundsCenter(input.fromBounds);
    const toCenter = getBoundsCenter(input.toBounds);
    const { isVertical, side } = computeBackEdgeDetour(
      fromCenter, toCenter, input.siblingBounds,
    );
    const face: Face = isVertical
      ? (side > 0 ? 'right' : 'left')
      : (side > 0 ? 'bottom' : 'top');
    anchors = {
      from: getFaceCenter(input.fromBounds, face),
      to: getFaceCenter(input.toBounds, face),
    };
  } else {
    // 정상 엣지: 중심→중심 직선 교차 + port offset 분산
    const fromPortOffset = input.fromPortOffset ?? 0;
    const toPortOffset = input.toPortOffset ?? 0;
    anchors = getAutoAnchors(
      input.fromBounds,
      input.toBounds,
      input.fromShape,
      input.toShape,
      fromPortOffset,
      toPortOffset,
    );
  }

  // 1b. Apply arrival gap — retract endpoints away from shapes so arrows
  //     don't touch the shape boundary. 0.6 = gap in IR-coord units (0–100 space).
  applyArrivalGap(anchors, 0.6);

  // 2. Delegate path creation to edge-paths/ strategy
  const ctx: PathContext = {
    fromBounds: input.fromBounds,
    toBounds: input.toBounds,
    fromShape: input.fromShape,
    toShape: input.toShape,
    siblingBounds: input.siblingBounds,
  };
  const path = createEdgePath(pathType, anchors.from, anchors.to, ctx, input.isBackEdge);

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
