/**
 * DepixIR -- types, validators, and utilities for the Internal Representation.
 *
 * @module @depix/core/ir
 */

// Re-export all IR type definitions
export type {
  DepixIR,
  IRArrowType,
  IRBackground,
  IRBase,
  IRBezierSegment,
  IRBounds,
  IRContainer,
  IREdge,
  IREdgeLabel,
  IREdgePath,
  IREdgePathBezier,
  IREdgePathPolyline,
  IREdgePathStraight,
  IRElement,
  IRElementType,
  IRGradient,
  IRGradientStop,
  IRImage,
  IRInnerText,
  IRLine,
  IRMeta,
  IROrigin,
  IRPath,
  IRPoint,
  IRScene,
  IRShadow,
  IRShape,
  IRShapeType,
  IRStyle,
  IRText,
  IRTransform,
  IRTransition,
} from './types.js';

// Re-export validators
export {
  isValidColor,
  isValidHexColor,
  validateBounds,
  validateElement,
  validateIR,
} from './validators.js';
export type { ValidationResult } from './validators.js';

// Re-export utilities
export {
  cloneElement,
  findElement,
  findElementInScene,
  generateId,
  getElementParent,
  walkElements,
} from './utils.js';
