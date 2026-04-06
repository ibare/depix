/**
 * Edge routing module.
 *
 * Re-exports the edge routing engine and path strategies.
 *
 * @module @depix/core/compiler/routing
 */

export {
  routeEdge,
  routeEdges,
  getBoundsCenter,
  getAutoAnchors,
  getRectBoundaryPoint,
  getEllipseBoundaryPoint,
  getBezierMidpoint,
  getPolylineMidpoint,
} from './edge-router.js';

export type { RouteEdgeInput } from './edge-router.js';

export {
  createEdgePath,
  createSmoothStepPath,
  createStraightPath,
  createBezierPath,
  createBackEdgePath,
  computeBackEdgeDetour,
  detectFace,
  FACE_DIR,
} from './edge-paths/index.js';

export type { EdgePathType, PathContext, Face, CreatePathFn, BackEdgeDetour } from './edge-paths/index.js';
