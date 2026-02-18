/**
 * useObjectCreation
 *
 * A React hook for creating IR elements via mouse drag on the canvas.
 * Returns mouse event handlers to attach to the canvas element, along with
 * creation state (isCreating, previewBounds).
 *
 * When the user finishes a drag gesture that exceeds the minimum size
 * threshold (5x5), the hook creates an appropriate IR element based on the
 * current tool and calls `onElementCreated`.
 *
 * @module @depix/react/hooks/useObjectCreation
 */

import { useState, useRef, useCallback } from 'react';
import type {
  IRElement,
  IRBounds,
  IRShape,
  IRText,
  IRLine,
  IREdge,
  IRImage,
} from '@depix/core';
import { generateId } from '@depix/core';
import type { ToolType } from '../types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseObjectCreationOptions {
  /** Current drawing tool. */
  tool: ToolType;
  /** Called when a new element is created. */
  onElementCreated: (element: IRElement) => void;
  /** Whether creation is enabled. Default: true */
  enabled?: boolean;
}

export interface CreationHandlers {
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
}

export interface UseObjectCreationReturn {
  /** Mouse event handlers to attach to the canvas. */
  creationHandlers: CreationHandlers;
  /** Whether the user is currently creating (dragging). */
  isCreating: boolean;
  /** Preview bounds during drag (null when not creating). */
  previewBounds: IRBounds | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum size threshold for element creation. */
const MIN_SIZE = 5;

/** Tools that trigger creation mode (not select/hand). */
const CREATION_TOOLS: ReadonlySet<ToolType> = new Set([
  'rect',
  'circle',
  'text',
  'line',
  'connector',
  'image',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute bounds from start and end coordinates.
 * Handles negative width/height from dragging in any direction.
 */
function computeBounds(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): IRBounds {
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const w = Math.abs(endX - startX);
  const h = Math.abs(endY - startY);
  return { x, y, w, h };
}

/**
 * Create a default IR element based on the tool type.
 */
function createElementForTool(tool: ToolType, bounds: IRBounds): IRElement {
  const id = generateId();
  const defaultStyle = { fill: '#cccccc', strokeWidth: 1, stroke: '#333333' };

  switch (tool) {
    case 'rect':
      return {
        id,
        type: 'shape',
        shape: 'rect',
        bounds,
        style: defaultStyle,
      } satisfies IRShape;

    case 'circle':
      return {
        id,
        type: 'shape',
        shape: 'circle',
        bounds,
        style: defaultStyle,
      } satisfies IRShape;

    case 'text':
      return {
        id,
        type: 'text',
        bounds,
        content: '',
        fontSize: 16,
        color: '#000000',
        style: {},
      } satisfies IRText;

    case 'line':
      return {
        id,
        type: 'line',
        bounds,
        from: { x: bounds.x, y: bounds.y },
        to: { x: bounds.x + bounds.w, y: bounds.y + bounds.h },
        style: { stroke: '#333333', strokeWidth: 2 },
      } satisfies IRLine;

    case 'connector':
      return {
        id,
        type: 'edge',
        bounds,
        fromId: '',
        toId: '',
        fromAnchor: { x: bounds.x, y: bounds.y },
        toAnchor: { x: bounds.x + bounds.w, y: bounds.y + bounds.h },
        path: { type: 'straight' },
        style: { stroke: '#333333', strokeWidth: 2 },
      } satisfies IREdge;

    case 'image':
      return {
        id,
        type: 'image',
        bounds,
        src: '',
        style: {},
      } satisfies IRImage;

    // select / hand should never reach here, but satisfy exhaustiveness
    default:
      return {
        id,
        type: 'shape',
        shape: 'rect',
        bounds,
        style: defaultStyle,
      } satisfies IRShape;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useObjectCreation(
  options: UseObjectCreationOptions,
): UseObjectCreationReturn {
  const { tool, onElementCreated, enabled = true } = options;

  const [isCreating, setIsCreating] = useState(false);
  const [previewBounds, setPreviewBounds] = useState<IRBounds | null>(null);

  const startPointRef = useRef<{ x: number; y: number } | null>(null);

  const isActive = enabled && CREATION_TOOLS.has(tool);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isActive) return;

      startPointRef.current = { x: e.clientX, y: e.clientY };
      setIsCreating(true);
      setPreviewBounds({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
    },
    [isActive],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isActive || !startPointRef.current) return;

      const bounds = computeBounds(
        startPointRef.current.x,
        startPointRef.current.y,
        e.clientX,
        e.clientY,
      );
      setPreviewBounds(bounds);
    },
    [isActive],
  );

  const onMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!isActive || !startPointRef.current) return;

      const bounds = computeBounds(
        startPointRef.current.x,
        startPointRef.current.y,
        e.clientX,
        e.clientY,
      );

      // Only create if above minimum size threshold
      if (bounds.w >= MIN_SIZE && bounds.h >= MIN_SIZE) {
        const element = createElementForTool(tool, bounds);
        onElementCreated(element);
      }

      // Reset state
      startPointRef.current = null;
      setIsCreating(false);
      setPreviewBounds(null);
    },
    [isActive, tool, onElementCreated],
  );

  return {
    creationHandlers: { onMouseDown, onMouseMove, onMouseUp },
    isCreating,
    previewBounds,
  };
}
