import { describe, it, expect } from 'vitest';
import type { IRBounds, IRPoint } from '../../../src/ir/types.js';
import {
  getBoundsCenter,
  getRectBoundaryPoint,
  getEllipseBoundaryPoint,
  getAutoAnchors,
  createStraightPath,
  createPolylinePath,
  createBezierPath,
  getBezierMidpoint,
  getPolylineMidpoint,
  routeEdge,
  routeEdges,
  type RouteEdgeInput,
} from '../../../src/compiler/routing/edge-router.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shorthand for creating an IRBounds. */
function bounds(x: number, y: number, w: number, h: number): IRBounds {
  return { x, y, w, h };
}

/** Shorthand for creating an IRPoint. */
function pt(x: number, y: number): IRPoint {
  return { x, y };
}

/** Assert two points are approximately equal. */
function expectPointClose(actual: IRPoint, expected: IRPoint, precision = 1) {
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
}

// ===========================================================================
// getBoundsCenter
// ===========================================================================

describe('getBoundsCenter', () => {
  it('returns center of a standard rectangle', () => {
    const center = getBoundsCenter(bounds(10, 20, 30, 40));
    expect(center).toEqual({ x: 25, y: 40 });
  });

  it('returns center of a zero-size bounds', () => {
    const center = getBoundsCenter(bounds(50, 50, 0, 0));
    expect(center).toEqual({ x: 50, y: 50 });
  });

  it('returns center of a bounds at origin', () => {
    const center = getBoundsCenter(bounds(0, 0, 100, 100));
    expect(center).toEqual({ x: 50, y: 50 });
  });
});

// ===========================================================================
// getRectBoundaryPoint
// ===========================================================================

describe('getRectBoundaryPoint', () => {
  const rect = bounds(10, 10, 20, 10);
  // Center: (20, 15), hw=10, hh=5

  it('returns right face point when target is to the right', () => {
    const result = getRectBoundaryPoint(rect, pt(60, 15));
    expect(result.x).toBeCloseTo(30, 5); // x + w = 30
    expect(result.y).toBeCloseTo(15, 5); // same y as center
  });

  it('returns left face point when target is to the left', () => {
    const result = getRectBoundaryPoint(rect, pt(0, 15));
    expect(result.x).toBeCloseTo(10, 5); // x = 10
    expect(result.y).toBeCloseTo(15, 5);
  });

  it('returns bottom face point when target is below', () => {
    const result = getRectBoundaryPoint(rect, pt(20, 80));
    expect(result.y).toBeCloseTo(20, 5); // y + h = 20
    expect(result.x).toBeCloseTo(20, 5); // same x as center
  });

  it('returns top face point when target is above', () => {
    const result = getRectBoundaryPoint(rect, pt(20, 0));
    expect(result.y).toBeCloseTo(10, 5); // y = 10
    expect(result.x).toBeCloseTo(20, 5);
  });

  it('handles diagonal target (upper-right)', () => {
    const result = getRectBoundaryPoint(rect, pt(50, 5));
    // dx=30, dy=-10, absDy*hw = 10*10 = 100, hh*absDx = 5*30 = 150
    // 100 <= 150 => exits right face
    expect(result.x).toBeCloseTo(30, 5);
  });

  it('returns right face when target is exactly at center (degenerate)', () => {
    const result = getRectBoundaryPoint(rect, pt(20, 15));
    expect(result.x).toBeCloseTo(30, 5);
    expect(result.y).toBeCloseTo(15, 5);
  });

  it('handles square bounds correctly', () => {
    const square = bounds(0, 0, 20, 20);
    // Center: (10, 10)
    // Target at 45 degrees (diagonal): should hit corner
    const result = getRectBoundaryPoint(square, pt(30, 30));
    // dx=20, dy=20, absDy*hw = 20*10 = 200, hh*absDx = 10*20 = 200
    // 200 <= 200 => exits right face (or top/bottom at exact diagonal)
    expect(result.x).toBeCloseTo(20, 5);
    expect(result.y).toBeCloseTo(20, 5);
  });
});

// ===========================================================================
// getEllipseBoundaryPoint
// ===========================================================================

describe('getEllipseBoundaryPoint', () => {
  const ellipse = bounds(10, 10, 20, 10);
  // Center: (20, 15), rx=10, ry=5

  it('returns rightmost point when target is directly to the right', () => {
    const result = getEllipseBoundaryPoint(ellipse, pt(80, 15));
    expect(result.x).toBeCloseTo(30, 5); // cx + rx
    expect(result.y).toBeCloseTo(15, 5); // cy
  });

  it('returns leftmost point when target is directly to the left', () => {
    const result = getEllipseBoundaryPoint(ellipse, pt(0, 15));
    expect(result.x).toBeCloseTo(10, 5); // cx - rx
    expect(result.y).toBeCloseTo(15, 5);
  });

  it('returns bottom point when target is directly below', () => {
    const result = getEllipseBoundaryPoint(ellipse, pt(20, 80));
    expect(result.x).toBeCloseTo(20, 5);
    expect(result.y).toBeCloseTo(20, 5); // cy + ry
  });

  it('returns top point when target is directly above', () => {
    const result = getEllipseBoundaryPoint(ellipse, pt(20, 0));
    expect(result.x).toBeCloseTo(20, 5);
    expect(result.y).toBeCloseTo(10, 5); // cy - ry
  });

  it('returns point on ellipse for diagonal target', () => {
    const result = getEllipseBoundaryPoint(ellipse, pt(40, 25));
    // Should be on the ellipse: ((x-cx)/rx)^2 + ((y-cy)/ry)^2 = 1
    const normX = (result.x - 20) / 10;
    const normY = (result.y - 15) / 5;
    expect(normX * normX + normY * normY).toBeCloseTo(1, 3);
  });

  it('handles degenerate case (target at center)', () => {
    const result = getEllipseBoundaryPoint(ellipse, pt(20, 15));
    // Should return rightmost point
    expect(result.x).toBeCloseTo(30, 5);
    expect(result.y).toBeCloseTo(15, 5);
  });

  it('works with a circle (equal width and height)', () => {
    const circle = bounds(10, 10, 20, 20);
    // Center: (20, 20), r=10
    const result = getEllipseBoundaryPoint(circle, pt(40, 20));
    expect(result.x).toBeCloseTo(30, 5);
    expect(result.y).toBeCloseTo(20, 5);
  });
});

// ===========================================================================
// getAutoAnchors
// ===========================================================================

describe('getAutoAnchors', () => {
  it('selects right face of from and left face of to when target is to the right', () => {
    const fromB = bounds(10, 40, 20, 10); // center (20, 45)
    const toB = bounds(60, 40, 20, 10);   // center (70, 45)

    const { from, to } = getAutoAnchors(fromB, toB);

    // From should exit the right face: x = 30
    expect(from.x).toBeCloseTo(30, 1);
    expect(from.y).toBeCloseTo(45, 1);

    // To should exit the left face: x = 60
    expect(to.x).toBeCloseTo(60, 1);
    expect(to.y).toBeCloseTo(45, 1);
  });

  it('selects bottom face of from and top face of to when target is below', () => {
    const fromB = bounds(40, 10, 20, 10); // center (50, 15)
    const toB = bounds(40, 60, 20, 10);   // center (50, 65)

    const { from, to } = getAutoAnchors(fromB, toB);

    // From should exit the bottom face: y = 20
    expect(from.y).toBeCloseTo(20, 1);
    expect(from.x).toBeCloseTo(50, 1);

    // To should exit the top face: y = 60
    expect(to.y).toBeCloseTo(60, 1);
    expect(to.x).toBeCloseTo(50, 1);
  });

  it('uses ellipse boundary for circle shapes', () => {
    const fromB = bounds(10, 10, 20, 20); // circle, center (20, 20)
    const toB = bounds(60, 10, 20, 20);   // circle, center (70, 20)

    const { from, to } = getAutoAnchors(fromB, toB, 'circle', 'circle');

    // From exits right: (30, 20)
    expect(from.x).toBeCloseTo(30, 1);
    expect(from.y).toBeCloseTo(20, 1);

    // To exits left: (60, 20)
    expect(to.x).toBeCloseTo(60, 1);
    expect(to.y).toBeCloseTo(20, 1);
  });

  it('handles mixed shapes (rect to ellipse)', () => {
    const fromB = bounds(10, 10, 20, 10); // rect, center (20, 15)
    const toB = bounds(60, 10, 20, 20);   // ellipse, center (70, 20)

    const { from, to } = getAutoAnchors(fromB, toB, 'rect', 'ellipse');

    // From exits right face of rect
    expect(from.x).toBeCloseTo(30, 1);

    // To exits left side of ellipse
    expect(to.x).toBeCloseTo(60, 1);
  });
});

// ===========================================================================
// createStraightPath
// ===========================================================================

describe('createStraightPath', () => {
  it('returns a straight path descriptor', () => {
    const path = createStraightPath();
    expect(path).toEqual({ type: 'straight' });
  });
});

// ===========================================================================
// createPolylinePath
// ===========================================================================

describe('createPolylinePath', () => {
  it('creates orthogonal route through midpoint', () => {
    const path = createPolylinePath(pt(10, 20), pt(80, 60));
    expect(path.type).toBe('polyline');
    expect(path.points).toHaveLength(2);

    const midX = (10 + 80) / 2;
    expect(path.points[0]).toEqual({ x: midX, y: 20 });
    expect(path.points[1]).toEqual({ x: midX, y: 60 });
  });

  it('all segments are horizontal or vertical', () => {
    const from = pt(10, 30);
    const to = pt(70, 60);
    const path = createPolylinePath(from, to);
    const fullPoints = [from, ...path.points, to];

    for (let i = 1; i < fullPoints.length; i++) {
      const dx = fullPoints[i].x - fullPoints[i - 1].x;
      const dy = fullPoints[i].y - fullPoints[i - 1].y;
      // Either horizontal (dy=0) or vertical (dx=0)
      const isOrtho = Math.abs(dx) < 0.001 || Math.abs(dy) < 0.001;
      expect(isOrtho).toBe(true);
    }
  });

  it('handles same X position', () => {
    const path = createPolylinePath(pt(50, 10), pt(50, 80));
    expect(path.points).toHaveLength(2);
    expect(path.points[0].x).toBeCloseTo(50);
    expect(path.points[1].x).toBeCloseTo(50);
  });

  it('handles same Y position', () => {
    const path = createPolylinePath(pt(10, 50), pt(80, 50));
    expect(path.points).toHaveLength(2);
    expect(path.points[0].y).toBeCloseTo(50);
    expect(path.points[1].y).toBeCloseTo(50);
  });
});

// ===========================================================================
// createBezierPath
// ===========================================================================

describe('createBezierPath', () => {
  it('creates bezier path with one segment', () => {
    const path = createBezierPath(pt(10, 50), pt(90, 50));
    expect(path.type).toBe('bezier');
    expect(path.controlPoints).toHaveLength(1);
  });

  it('uses horizontal bias when dx > dy', () => {
    const from = pt(10, 50);
    const to = pt(90, 50);
    const path = createBezierPath(from, to);
    const seg = path.controlPoints[0];

    // Horizontal bias: cp1.y = from.y, cp2.y = to.y
    expect(seg.cp1.y).toBeCloseTo(from.y);
    expect(seg.cp2.y).toBeCloseTo(to.y);

    // cp1.x should be between from.x and to.x
    expect(seg.cp1.x).toBeGreaterThan(from.x);
    expect(seg.cp1.x).toBeLessThan(to.x);
  });

  it('uses vertical bias when dy >= dx', () => {
    const from = pt(50, 10);
    const to = pt(50, 90);
    const path = createBezierPath(from, to);
    const seg = path.controlPoints[0];

    // Vertical bias: cp1.x = from.x, cp2.x = to.x
    expect(seg.cp1.x).toBeCloseTo(from.x);
    expect(seg.cp2.x).toBeCloseTo(to.x);

    // cp1.y should be between from.y and to.y
    expect(seg.cp1.y).toBeGreaterThan(from.y);
    expect(seg.cp1.y).toBeLessThan(to.y);
  });

  it('control points are within reasonable range', () => {
    const from = pt(20, 30);
    const to = pt(80, 70);
    const path = createBezierPath(from, to);
    const seg = path.controlPoints[0];

    // All control points should be in the 0-100 space (roughly)
    for (const cp of [seg.cp1, seg.cp2]) {
      expect(cp.x).toBeGreaterThanOrEqual(-10);
      expect(cp.x).toBeLessThanOrEqual(110);
      expect(cp.y).toBeGreaterThanOrEqual(-10);
      expect(cp.y).toBeLessThanOrEqual(110);
    }
  });

  it('handles same-position from and to (zero distance)', () => {
    const from = pt(50, 50);
    const to = pt(50, 50);
    const path = createBezierPath(from, to);
    expect(path.type).toBe('bezier');
    expect(path.controlPoints).toHaveLength(1);
    // offset = 0 * 0.3 = 0, so control points collapse to from/to
    const seg = path.controlPoints[0];
    expect(seg.cp1.x).toBeCloseTo(50);
    expect(seg.cp1.y).toBeCloseTo(50);
  });

  it('end point equals the to point', () => {
    const from = pt(10, 20);
    const to = pt(80, 60);
    const path = createBezierPath(from, to);
    expect(path.controlPoints[0].end).toEqual(to);
  });
});

// ===========================================================================
// getBezierMidpoint
// ===========================================================================

describe('getBezierMidpoint', () => {
  it('midpoint of a straight horizontal bezier is the center', () => {
    // Control points at exact thirds along the straight line
    const from = pt(0, 50);
    const cp1 = pt(100 / 3, 50);
    const cp2 = pt(200 / 3, 50);
    const to = pt(100, 50);
    const mid = getBezierMidpoint(from, cp1, cp2, to);
    expectPointClose(mid, pt(50, 50));
  });

  it('midpoint lies between from and to', () => {
    const from = pt(10, 20);
    const cp1 = pt(30, 10);
    const cp2 = pt(60, 70);
    const to = pt(80, 50);
    const mid = getBezierMidpoint(from, cp1, cp2, to);

    // Midpoint x should be between from.x and to.x (approximately)
    expect(mid.x).toBeGreaterThan(from.x);
    expect(mid.x).toBeLessThan(to.x);
  });

  it('degenerate case: all points at same location', () => {
    const p = pt(50, 50);
    const mid = getBezierMidpoint(p, p, p, p);
    expectPointClose(mid, p);
  });
});

// ===========================================================================
// getPolylineMidpoint
// ===========================================================================

describe('getPolylineMidpoint', () => {
  it('midpoint of two points is the average', () => {
    const mid = getPolylineMidpoint([pt(0, 0), pt(100, 0)]);
    expectPointClose(mid, pt(50, 0));
  });

  it('midpoint of three collinear points is at half total length', () => {
    const mid = getPolylineMidpoint([pt(0, 0), pt(40, 0), pt(100, 0)]);
    expectPointClose(mid, pt(50, 0));
  });

  it('midpoint of L-shaped path', () => {
    // Path: (0,0) -> (0,60) -> (80,60)
    // Total length: 60 + 80 = 140, half = 70
    // First segment covers 60, so remaining = 10 into second segment
    const mid = getPolylineMidpoint([pt(0, 0), pt(0, 60), pt(80, 60)]);
    expectPointClose(mid, pt(10, 60));
  });

  it('returns single point for one-element array', () => {
    const mid = getPolylineMidpoint([pt(42, 73)]);
    expect(mid).toEqual(pt(42, 73));
  });

  it('returns origin for empty array', () => {
    const mid = getPolylineMidpoint([]);
    expect(mid).toEqual(pt(0, 0));
  });

  it('handles all points at same position', () => {
    const mid = getPolylineMidpoint([pt(50, 50), pt(50, 50), pt(50, 50)]);
    expectPointClose(mid, pt(50, 50));
  });
});

// ===========================================================================
// routeEdge — straight connection
// ===========================================================================

describe('routeEdge — straight connection', () => {
  it('produces from/to anchors on element boundaries', () => {
    const edge = routeEdge({
      fromId: 'a',
      toId: 'b',
      fromBounds: bounds(10, 40, 20, 10),
      toBounds: bounds(60, 40, 20, 10),
      edgeStyle: '->',
      pathType: 'straight',
    });

    expect(edge.type).toBe('edge');
    expect(edge.path.type).toBe('straight');

    // fromAnchor should be on the right face of fromBounds (x=30)
    expect(edge.fromAnchor.x).toBeCloseTo(30, 1);
    expect(edge.fromAnchor.y).toBeCloseTo(45, 1);

    // toAnchor should be on the left face of toBounds (x=60)
    expect(edge.toAnchor.x).toBeCloseTo(60, 1);
    expect(edge.toAnchor.y).toBeCloseTo(45, 1);
  });

  it('has correct IREdge structure', () => {
    const edge = routeEdge({
      fromId: 'node-1',
      toId: 'node-2',
      fromBounds: bounds(10, 10, 20, 20),
      toBounds: bounds(60, 10, 20, 20),
      edgeStyle: '->',
      pathType: 'straight',
    });

    expect(edge.id).toBeDefined();
    expect(edge.id).toMatch(/^el-/);
    expect(edge.type).toBe('edge');
    expect(edge.fromId).toBe('node-1');
    expect(edge.toId).toBe('node-2');
    expect(edge.bounds).toBeDefined();
    expect(edge.style).toBeDefined();
    expect(edge.style.stroke).toBe('#333333');
    expect(edge.style.strokeWidth).toBe(0.3);
  });
});

// ===========================================================================
// routeEdge — polyline connection
// ===========================================================================

describe('routeEdge — polyline connection', () => {
  it('all intermediate segments are horizontal or vertical', () => {
    const edge = routeEdge({
      fromId: 'a',
      toId: 'b',
      fromBounds: bounds(10, 20, 20, 10),
      toBounds: bounds(60, 60, 20, 10),
      edgeStyle: '->',
      pathType: 'polyline',
    });

    expect(edge.path.type).toBe('polyline');
    if (edge.path.type !== 'polyline') return;

    const fullPoints = [edge.fromAnchor, ...edge.path.points, edge.toAnchor];
    for (let i = 1; i < fullPoints.length; i++) {
      const dx = Math.abs(fullPoints[i].x - fullPoints[i - 1].x);
      const dy = Math.abs(fullPoints[i].y - fullPoints[i - 1].y);
      expect(dx < 0.001 || dy < 0.001).toBe(true);
    }
  });
});

// ===========================================================================
// routeEdge — bezier connection
// ===========================================================================

describe('routeEdge — bezier connection', () => {
  it('produces bezier path with control points', () => {
    const edge = routeEdge({
      fromId: 'a',
      toId: 'b',
      fromBounds: bounds(10, 40, 20, 10),
      toBounds: bounds(60, 40, 20, 10),
      edgeStyle: '->',
      pathType: 'bezier',
    });

    expect(edge.path.type).toBe('bezier');
    if (edge.path.type !== 'bezier') return;

    expect(edge.path.controlPoints).toHaveLength(1);
    const seg = edge.path.controlPoints[0];
    expect(seg.cp1).toBeDefined();
    expect(seg.cp2).toBeDefined();
    expect(seg.end).toBeDefined();
  });

  it('defaults to bezier when pathType is not specified', () => {
    const edge = routeEdge({
      fromId: 'a',
      toId: 'b',
      fromBounds: bounds(10, 40, 20, 10),
      toBounds: bounds(60, 40, 20, 10),
      edgeStyle: '->',
    });

    expect(edge.path.type).toBe('bezier');
  });

  it('control points are within reasonable range', () => {
    const edge = routeEdge({
      fromId: 'a',
      toId: 'b',
      fromBounds: bounds(10, 10, 20, 20),
      toBounds: bounds(60, 60, 20, 20),
      edgeStyle: '->',
      pathType: 'bezier',
    });

    if (edge.path.type !== 'bezier') return;

    const seg = edge.path.controlPoints[0];
    for (const cp of [seg.cp1, seg.cp2]) {
      expect(cp.x).toBeGreaterThanOrEqual(-20);
      expect(cp.x).toBeLessThanOrEqual(120);
      expect(cp.y).toBeGreaterThanOrEqual(-20);
      expect(cp.y).toBeLessThanOrEqual(120);
    }
  });
});

// ===========================================================================
// Label placement
// ===========================================================================

describe('Label placement', () => {
  it('places label near the midpoint of a straight edge', () => {
    const edge = routeEdge({
      fromId: 'a',
      toId: 'b',
      fromBounds: bounds(10, 40, 20, 10),
      toBounds: bounds(60, 40, 20, 10),
      edgeStyle: '->',
      pathType: 'straight',
      label: 'connection',
    });

    expect(edge.labels).toBeDefined();
    expect(edge.labels).toHaveLength(1);
    const label = edge.labels![0];
    expect(label.text).toBe('connection');
    expect(label.placement).toBe('middle');

    // Label position should be near the midpoint (with small normal offset from line)
    const midX = (edge.fromAnchor.x + edge.toAnchor.x) / 2;
    const midY = (edge.fromAnchor.y + edge.toAnchor.y) / 2;
    expect(Math.abs(label.position.x - midX)).toBeLessThan(2);
    expect(Math.abs(label.position.y - midY)).toBeLessThan(2);
  });

  it('places label on polyline path midpoint', () => {
    const edge = routeEdge({
      fromId: 'a',
      toId: 'b',
      fromBounds: bounds(10, 20, 20, 10),
      toBounds: bounds(60, 60, 20, 10),
      edgeStyle: '->',
      pathType: 'polyline',
      label: 'elbow',
    });

    expect(edge.labels).toHaveLength(1);
    const label = edge.labels![0];
    expect(label.text).toBe('elbow');
    // Position should exist (we don't assert exact value for polyline,
    // just that it doesn't crash and is in a reasonable range)
    expect(label.position.x).toBeGreaterThanOrEqual(0);
    expect(label.position.x).toBeLessThanOrEqual(100);
  });

  it('places label on bezier path midpoint', () => {
    const edge = routeEdge({
      fromId: 'a',
      toId: 'b',
      fromBounds: bounds(10, 40, 20, 10),
      toBounds: bounds(60, 40, 20, 10),
      edgeStyle: '->',
      pathType: 'bezier',
      label: 'curved',
    });

    expect(edge.labels).toHaveLength(1);
    const label = edge.labels![0];
    expect(label.text).toBe('curved');
    // Midpoint should be between the two anchors roughly
    expect(label.position.x).toBeGreaterThan(edge.fromAnchor.x);
    expect(label.position.x).toBeLessThan(edge.toAnchor.x);
  });

  it('omits labels when no label is provided', () => {
    const edge = routeEdge({
      fromId: 'a',
      toId: 'b',
      fromBounds: bounds(10, 40, 20, 10),
      toBounds: bounds(60, 40, 20, 10),
      edgeStyle: '->',
    });

    expect(edge.labels).toBeUndefined();
  });
});

// ===========================================================================
// Style mapping — arrow heads and dash patterns
// ===========================================================================

describe('Style mapping', () => {
  it('-> produces solid + triangle arrowEnd', () => {
    const edge = routeEdge({
      fromId: 'a',
      toId: 'b',
      fromBounds: bounds(10, 40, 20, 10),
      toBounds: bounds(60, 40, 20, 10),
      edgeStyle: '->',
    });

    expect(edge.arrowEnd).toBe('triangle');
    expect(edge.arrowStart).toBeUndefined();
    expect(edge.style.dashPattern).toBeUndefined();
    expect(edge.style.stroke).toBe('#333333');
    expect(edge.style.strokeWidth).toBe(0.3);
  });

  it('--> produces dashed + triangle arrowEnd', () => {
    const edge = routeEdge({
      fromId: 'a',
      toId: 'b',
      fromBounds: bounds(10, 40, 20, 10),
      toBounds: bounds(60, 40, 20, 10),
      edgeStyle: '-->',
    });

    expect(edge.arrowEnd).toBe('triangle');
    expect(edge.arrowStart).toBeUndefined();
    expect(edge.style.dashPattern).toEqual([4, 3]);
  });

  it('-- produces solid, no arrows', () => {
    const edge = routeEdge({
      fromId: 'a',
      toId: 'b',
      fromBounds: bounds(10, 40, 20, 10),
      toBounds: bounds(60, 40, 20, 10),
      edgeStyle: '--',
    });

    expect(edge.arrowEnd).toBeUndefined();
    expect(edge.arrowStart).toBeUndefined();
    expect(edge.style.dashPattern).toBeUndefined();
  });

  it('<-> produces solid + triangle arrowStart + triangle arrowEnd', () => {
    const edge = routeEdge({
      fromId: 'a',
      toId: 'b',
      fromBounds: bounds(10, 40, 20, 10),
      toBounds: bounds(60, 40, 20, 10),
      edgeStyle: '<->',
    });

    expect(edge.arrowStart).toBe('triangle');
    expect(edge.arrowEnd).toBe('triangle');
    expect(edge.style.dashPattern).toBeUndefined();
  });
});

// ===========================================================================
// Edge bounds
// ===========================================================================

describe('Edge bounds', () => {
  it('bounds encompass fromAnchor and toAnchor', () => {
    const edge = routeEdge({
      fromId: 'a',
      toId: 'b',
      fromBounds: bounds(10, 40, 20, 10),
      toBounds: bounds(60, 40, 20, 10),
      edgeStyle: '->',
      pathType: 'straight',
    });

    const b = edge.bounds;
    expect(b.x).toBeLessThanOrEqual(edge.fromAnchor.x);
    expect(b.y).toBeLessThanOrEqual(edge.fromAnchor.y);
    expect(b.x + b.w).toBeGreaterThanOrEqual(edge.toAnchor.x);
    expect(b.y + b.h).toBeGreaterThanOrEqual(edge.toAnchor.y);
  });

  it('bounds encompass polyline waypoints', () => {
    const edge = routeEdge({
      fromId: 'a',
      toId: 'b',
      fromBounds: bounds(10, 20, 20, 10),
      toBounds: bounds(60, 60, 20, 10),
      edgeStyle: '->',
      pathType: 'polyline',
    });

    if (edge.path.type !== 'polyline') return;

    const b = edge.bounds;
    for (const p of edge.path.points) {
      expect(p.x).toBeGreaterThanOrEqual(b.x - 0.001);
      expect(p.y).toBeGreaterThanOrEqual(b.y - 0.001);
      expect(p.x).toBeLessThanOrEqual(b.x + b.w + 0.001);
      expect(p.y).toBeLessThanOrEqual(b.y + b.h + 0.001);
    }
  });
});

// ===========================================================================
// Same-position elements (degenerate case)
// ===========================================================================

describe('Same-position elements', () => {
  it('does not crash when both elements are at the same position', () => {
    const sameBounds = bounds(40, 40, 20, 20);
    expect(() => {
      routeEdge({
        fromId: 'a',
        toId: 'b',
        fromBounds: sameBounds,
        toBounds: sameBounds,
        edgeStyle: '->',
        pathType: 'straight',
      });
    }).not.toThrow();
  });

  it('does not crash with zero-size elements', () => {
    expect(() => {
      routeEdge({
        fromId: 'a',
        toId: 'b',
        fromBounds: bounds(50, 50, 0, 0),
        toBounds: bounds(50, 50, 0, 0),
        edgeStyle: '->',
        pathType: 'bezier',
      });
    }).not.toThrow();
  });

  it('produces valid edge for overlapping elements', () => {
    const edge = routeEdge({
      fromId: 'a',
      toId: 'b',
      fromBounds: bounds(40, 40, 20, 20),
      toBounds: bounds(45, 45, 20, 20),
      edgeStyle: '->',
      pathType: 'polyline',
    });

    expect(edge.type).toBe('edge');
    expect(edge.fromAnchor).toBeDefined();
    expect(edge.toAnchor).toBeDefined();
  });
});

// ===========================================================================
// routeEdges — multiple edges
// ===========================================================================

describe('routeEdges', () => {
  it('routes multiple edges', () => {
    const inputs: RouteEdgeInput[] = [
      {
        fromId: 'a',
        toId: 'b',
        fromBounds: bounds(10, 40, 20, 10),
        toBounds: bounds(40, 40, 20, 10),
        edgeStyle: '->',
      },
      {
        fromId: 'b',
        toId: 'c',
        fromBounds: bounds(40, 40, 20, 10),
        toBounds: bounds(70, 40, 20, 10),
        edgeStyle: '-->',
        label: 'next',
      },
    ];

    const edges = routeEdges(inputs);
    expect(edges).toHaveLength(2);

    expect(edges[0].fromId).toBe('a');
    expect(edges[0].toId).toBe('b');
    expect(edges[0].arrowEnd).toBe('triangle');
    expect(edges[0].style.dashPattern).toBeUndefined();

    expect(edges[1].fromId).toBe('b');
    expect(edges[1].toId).toBe('c');
    expect(edges[1].arrowEnd).toBe('triangle');
    expect(edges[1].style.dashPattern).toEqual([4, 3]);
    expect(edges[1].labels).toHaveLength(1);
    expect(edges[1].labels![0].text).toBe('next');
  });

  it('returns empty array for empty input', () => {
    const edges = routeEdges([]);
    expect(edges).toEqual([]);
  });

  it('each edge has a unique id', () => {
    const inputs: RouteEdgeInput[] = [
      {
        fromId: 'a',
        toId: 'b',
        fromBounds: bounds(10, 40, 20, 10),
        toBounds: bounds(40, 40, 20, 10),
        edgeStyle: '->',
      },
      {
        fromId: 'c',
        toId: 'd',
        fromBounds: bounds(10, 60, 20, 10),
        toBounds: bounds(40, 60, 20, 10),
        edgeStyle: '--',
      },
    ];

    const edges = routeEdges(inputs);
    expect(edges[0].id).not.toBe(edges[1].id);
  });

  it('supports mixed path types', () => {
    const inputs: RouteEdgeInput[] = [
      {
        fromId: 'a',
        toId: 'b',
        fromBounds: bounds(10, 40, 20, 10),
        toBounds: bounds(60, 40, 20, 10),
        edgeStyle: '->',
        pathType: 'straight',
      },
      {
        fromId: 'a',
        toId: 'c',
        fromBounds: bounds(10, 40, 20, 10),
        toBounds: bounds(60, 70, 20, 10),
        edgeStyle: '<->',
        pathType: 'polyline',
      },
      {
        fromId: 'b',
        toId: 'c',
        fromBounds: bounds(60, 40, 20, 10),
        toBounds: bounds(60, 70, 20, 10),
        edgeStyle: '-->',
        pathType: 'bezier',
      },
    ];

    const edges = routeEdges(inputs);
    expect(edges[0].path.type).toBe('straight');
    expect(edges[1].path.type).toBe('polyline');
    expect(edges[2].path.type).toBe('bezier');
  });
});
