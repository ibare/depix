/**
 * Edge routing module.
 *
 * Re-exports the edge routing engine for computing concrete
 * path points for edges between elements.
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
  createStraightPath,
  createPolylinePath,
  createBezierPath,
  getBezierMidpoint,
  getPolylineMidpoint,
} from './edge-router.js';

export type { RouteEdgeInput } from './edge-router.js';
