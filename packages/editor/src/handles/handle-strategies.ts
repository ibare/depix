/**
 * Handle strategy resolution for IR elements.
 *
 * Determines the appropriate handle definition for any IR element type.
 * This is a pure function with no Konva dependency -- it maps IR element
 * types to handle behaviour descriptions.
 *
 * The IR unifies shapes so we only need 7 strategies
 * (one per IRElementType).
 *
 * @module @depix/editor/handles/handle-strategies
 */

import type { IRElement, IRShape, IRShapeType } from '@depix/core';
import type { HandleDefinition } from './types.js';
import { ALL_ANCHORS, CORNER_ANCHORS } from './types.js';

// ---------------------------------------------------------------------------
// Shape sub-type helpers
// ---------------------------------------------------------------------------

/**
 * Check if a specific shape type should maintain aspect ratio.
 *
 * Returns `true` for `'circle'` which must stay square to remain circular.
 * Ellipses are allowed to resize freely on each axis.
 *
 * @param shapeType - The IRShapeType to check.
 * @returns `true` if the shape must keep aspect ratio.
 */
export function isKeepRatioShape(shapeType: IRShapeType): boolean {
  return shapeType === 'circle';
}

// ---------------------------------------------------------------------------
// Per-type strategy functions
// ---------------------------------------------------------------------------

function shapeStrategy(element: IRShape): HandleDefinition {
  const keepRatio = isKeepRatioShape(element.shape);

  return {
    handleType: 'bounding-box',
    keepRatio,
    rotateEnabled: true,
    enabledAnchors: keepRatio ? [...CORNER_ANCHORS] : [...ALL_ANCHORS],
  };
}

function textStrategy(): HandleDefinition {
  return {
    handleType: 'bounding-box',
    keepRatio: false,
    rotateEnabled: false,
    enabledAnchors: [...ALL_ANCHORS],
  };
}

function imageStrategy(): HandleDefinition {
  return {
    handleType: 'bounding-box',
    keepRatio: true,
    rotateEnabled: false,
    enabledAnchors: [...CORNER_ANCHORS],
  };
}

function lineStrategy(): HandleDefinition {
  return {
    handleType: 'endpoint',
    keepRatio: false,
    rotateEnabled: false,
    enabledAnchors: [],
  };
}

function pathStrategy(): HandleDefinition {
  return {
    handleType: 'bounding-box',
    keepRatio: true,
    rotateEnabled: true,
    enabledAnchors: [...CORNER_ANCHORS],
  };
}

function edgeStrategy(): HandleDefinition {
  return {
    handleType: 'connector',
    keepRatio: false,
    rotateEnabled: false,
    enabledAnchors: [],
  };
}

function containerStrategy(): HandleDefinition {
  return {
    handleType: 'bounding-box',
    keepRatio: false,
    rotateEnabled: false,
    enabledAnchors: [...ALL_ANCHORS],
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Determine the handle definition for an IR element.
 *
 * This is a pure function -- no Konva dependency. It inspects the
 * element's `type` (and `shape` sub-type for shapes) to determine
 * the appropriate handle behaviour.
 *
 * @param element - The IR element to get handle definitions for.
 * @returns The handle definition describing anchors, ratio, and rotation.
 */
export function getHandleDefinition(element: IRElement): HandleDefinition {
  switch (element.type) {
    case 'shape':
      return shapeStrategy(element);
    case 'text':
      return textStrategy();
    case 'image':
      return imageStrategy();
    case 'line':
      return lineStrategy();
    case 'path':
      return pathStrategy();
    case 'edge':
      return edgeStrategy();
    case 'container':
      return containerStrategy();
  }
}
