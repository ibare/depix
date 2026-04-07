/**
 * SmoothStep Edge Path
 *
 * 직교 세그먼트 + 꺾임 라운딩으로 깔끔한 다이어그램 엣지를 생성한다.
 * React Flow의 SmoothStep 패턴과 동일한 접근:
 *   1. anchor에서 face 법선 방향으로 extension
 *   2. 두 extension point 사이를 직교 세그먼트로 연결
 *   3. 꺾임점에 quadratic→cubic bezier 라운딩 적용
 *
 * 출력: IREdgePathBezier (기존 bezier 렌더러와 호환)
 */

import type { IREdgePathBezier, IRBezierSegment, IRPoint } from '../../../ir/types.js';
import type { PathContext, Face } from './types.js';
import { FACE_DIR, detectFace } from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// 2.0 = 꺾임 라운딩 반지름 (IR 0-100 단위). 더 부드러운 코너를 위해 1.5→2.0 상향.
//       너무 크면 직선 구간이 줄고, 작으면 각진다.
const BORDER_RADIUS = 2.0;
// 2.0 = face에서 첫 번째 꺾임까지의 최소 직선 연장 (IR 단위)
const MIN_EXTENSION = 2.0;
// 0.12 = from→to 거리 대비 연장 비율. 가까운 노드는 짧게, 먼 노드는 길게.
const EXTENSION_RATIO = 0.12;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createSmoothStepPath(
  from: IRPoint,
  to: IRPoint,
  ctx: PathContext,
  options?: { extensionScale?: number },
): IREdgePathBezier {
  const fromFace = detectFace(from, ctx.fromBounds);
  const toFace = detectFace(to, ctx.toBounds);

  const scale = options?.extensionScale ?? 1;
  const dist = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
  const extension = Math.max(dist * EXTENSION_RATIO * scale, MIN_EXTENSION * scale);

  const exitDir = FACE_DIR[fromFace];
  const entryDir = FACE_DIR[toFace];

  // face 법선 방향으로 연장
  const p1: IRPoint = {
    x: from.x + exitDir.x * extension,
    y: from.y + exitDir.y * extension,
  };
  const pN: IRPoint = {
    x: to.x + entryDir.x * extension,
    y: to.y + entryDir.y * extension,
  };

  // 직교 waypoint 계산
  const waypoints = computeOrthogonalWaypoints(p1, pN, fromFace, toFace);

  // 전체 경로: from → p1 → waypoints → pN → to
  const fullPath = dedup([from, p1, ...waypoints, pN, to]);

  // 꺾임 라운딩 + cubic bezier 변환
  return pathToRoundedBezier(fullPath, BORDER_RADIUS);
}

// ---------------------------------------------------------------------------
// Orthogonal waypoint computation
// ---------------------------------------------------------------------------

/**
 * p1(exit extension)과 pN(entry extension) 사이의 직교 waypoint를 계산한다.
 *
 * 3가지 케이스:
 *   1a. 대향 면 (top↔bottom, left↔right): 중간 축에서 수평/수직 연결
 *   1b. 같은 면 (둘 다 right 등): 외곽 extension point로 U자형 우회
 *   2.  수직 면 (top/bottom ↔ left/right): 단일 꺾임
 */
function computeOrthogonalWaypoints(
  p1: IRPoint,
  pN: IRPoint,
  fromFace: Face,
  toFace: Face,
): IRPoint[] {
  const isFromVert = fromFace === 'top' || fromFace === 'bottom';
  const isToVert = toFace === 'top' || toFace === 'bottom';

  // Case 1: 평행 면 — 중간 축 연결 (대향 면) 또는 외곽 연결 (같은 면)
  if (isFromVert && isToVert) {
    // 같은 면(top-top, bottom-bottom): 외곽 extension point로 U자형 우회
    // 대향 면(top↔bottom): 중간 축 연결
    const sameFace = fromFace === toFace;
    const connectY = sameFace
      ? (fromFace === 'bottom' ? Math.max(p1.y, pN.y) : Math.min(p1.y, pN.y))
      : (p1.y + pN.y) / 2;
    return [
      { x: p1.x, y: connectY },
      { x: pN.x, y: connectY },
    ];
  }
  if (!isFromVert && !isToVert) {
    const sameFace = fromFace === toFace;
    const connectX = sameFace
      ? (fromFace === 'right' ? Math.max(p1.x, pN.x) : Math.min(p1.x, pN.x))
      : (p1.x + pN.x) / 2;
    return [
      { x: connectX, y: p1.y },
      { x: connectX, y: pN.y },
    ];
  }

  // Case 2: 수직 면 — 단일 꺾임
  if (isFromVert) {
    // from은 수직, to는 수평 → 꺾임점 (p1.x, pN.y)
    return [{ x: p1.x, y: pN.y }];
  }
  // from은 수평, to는 수직 → 꺾임점 (pN.x, p1.y)
  return [{ x: pN.x, y: p1.y }];
}

// ---------------------------------------------------------------------------
// Rounded bezier conversion
// ---------------------------------------------------------------------------

/**
 * 직교 경로의 꺾임점에 quadratic bezier 라운딩을 적용하여
 * IREdgePathBezier로 변환한다.
 *
 * 각 꺾임점 B (between A and C):
 *   - A' = B 방향으로 radius만큼 A쪽에서 접근
 *   - C' = B 방향으로 radius만큼 C쪽으로 출발
 *   - quadratic bezier(A', B, C') → cubic bezier 근사
 *
 * 직선 구간은 degenerate cubic bezier로 표현.
 */
function pathToRoundedBezier(
  points: IRPoint[],
  radius: number,
): IREdgePathBezier {
  if (points.length < 2) {
    return { type: 'bezier', controlPoints: [] };
  }
  if (points.length === 2) {
    return {
      type: 'bezier',
      controlPoints: [straightSegment(points[0], points[1])],
    };
  }

  // 꺾임 감지: 방향이 바뀌는 지점만 라운딩 대상
  const segments: IRBezierSegment[] = [];
  let cursor = points[0];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const bend = points[i];
    const next = points[i + 1];

    // 세그먼트 길이 기반으로 radius 제한 (짧은 세그먼트 보호)
    const dPrev = vecLen(bend.x - prev.x, bend.y - prev.y);
    const dNext = vecLen(next.x - bend.x, next.y - bend.y);
    // 0.45 = 한 세그먼트의 최대 45%까지만 라운딩에 사용 (반지름 상한 비율, 무차원).
    //        BORDER_RADIUS 상향(1.5→2.0)에 맞춰 짧은 세그먼트의 라운딩 손실을 줄이기 위해 0.4→0.45 상향.
    const r = Math.min(radius, dPrev * 0.45, dNext * 0.45);

    if (r < 0.01 || isCollinear(prev, bend, next)) {
      // 라운딩 불필요 (직선 구간)
      if (vecLen(cursor.x - bend.x, cursor.y - bend.y) > 0.01) {
        segments.push(straightSegment(cursor, bend));
        cursor = bend;
      }
      continue;
    }

    // 꺾임 접근점: bend에서 prev 방향으로 r만큼
    const toPrev = normalize(prev.x - bend.x, prev.y - bend.y);
    const approachPt: IRPoint = {
      x: bend.x + toPrev.x * r,
      y: bend.y + toPrev.y * r,
    };

    // 꺾임 출발점: bend에서 next 방향으로 r만큼
    const toNext = normalize(next.x - bend.x, next.y - bend.y);
    const departurePt: IRPoint = {
      x: bend.x + toNext.x * r,
      y: bend.y + toNext.y * r,
    };

    // cursor → approachPt: 직선 구간
    if (vecLen(cursor.x - approachPt.x, cursor.y - approachPt.y) > 0.01) {
      segments.push(straightSegment(cursor, approachPt));
    }

    // approachPt → bend(control) → departurePt: quadratic→cubic 변환
    segments.push(quadToCubic(approachPt, bend, departurePt));
    cursor = departurePt;
  }

  // 마지막 직선 구간: cursor → 마지막 점
  const lastPt = points[points.length - 1];
  if (vecLen(cursor.x - lastPt.x, cursor.y - lastPt.y) > 0.01) {
    segments.push(straightSegment(cursor, lastPt));
  }

  return { type: 'bezier', controlPoints: segments };
}

// ---------------------------------------------------------------------------
// Geometry utilities
// ---------------------------------------------------------------------------

/** 직선을 degenerate cubic bezier로 표현 */
function straightSegment(from: IRPoint, to: IRPoint): IRBezierSegment {
  return {
    cp1: { x: from.x + (to.x - from.x) / 3, y: from.y + (to.y - from.y) / 3 },
    cp2: { x: from.x + (to.x - from.x) * 2 / 3, y: from.y + (to.y - from.y) * 2 / 3 },
    end: to,
  };
}

/**
 * Quadratic bezier (P0, control, P2) → Cubic bezier 근사.
 * cp1 = P0 + 2/3 * (control - P0)
 * cp2 = P2 + 2/3 * (control - P2)
 */
function quadToCubic(
  p0: IRPoint,
  control: IRPoint,
  p2: IRPoint,
): IRBezierSegment {
  return {
    cp1: {
      x: p0.x + (2 / 3) * (control.x - p0.x),
      y: p0.y + (2 / 3) * (control.y - p0.y),
    },
    cp2: {
      x: p2.x + (2 / 3) * (control.x - p2.x),
      y: p2.y + (2 / 3) * (control.y - p2.y),
    },
    end: p2,
  };
}

function vecLen(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

function normalize(x: number, y: number): IRPoint {
  const len = vecLen(x, y);
  if (len < 1e-10) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

/** 세 점이 일직선 상에 있는지 (방향 변화 없음) */
function isCollinear(a: IRPoint, b: IRPoint, c: IRPoint): boolean {
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return Math.abs(cross) < 0.01;
}

/** 연속 중복 점 제거 */
function dedup(pts: IRPoint[]): IRPoint[] {
  const result: IRPoint[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (vecLen(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) > 0.01) {
      result.push(pts[i]);
    }
  }
  return result;
}
