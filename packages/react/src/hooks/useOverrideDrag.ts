/**
 * useOverrideDrag — converts element drag events into @overrides DSL mutations.
 *
 * When an element is dragged, this hook updates the DSL text by upserting
 * the element's new position into an @overrides directive.
 */

import { useRef, useCallback } from 'react';
import { upsertOverride } from '@depix/editor';
import type { CoordinateTransform } from '../components/editor/SlotOverlay.js';

export interface UseOverrideDragOptions {
  dsl: string;
  onDSLChange: (dsl: string) => void;
  canvasWidth: number;
  canvasHeight: number;
}

export interface UseOverrideDragReturn {
  onDragStart: (elementId: string) => void;
  onDragMove: (elementId: string, pixelX: number, pixelY: number) => void;
  onDragEnd: (elementId: string) => void;
}

export function useOverrideDrag({
  dsl,
  onDSLChange,
  canvasWidth,
  canvasHeight,
}: UseOverrideDragOptions): UseOverrideDragReturn {
  const dslRef = useRef(dsl);
  dslRef.current = dsl;

  const onDragStart = useCallback((_elementId: string) => {
    // Could snapshot for undo here in future
  }, []);

  const onDragMove = useCallback((elementId: string, pixelX: number, pixelY: number) => {
    // Convert pixel coordinates to 0-100 relative space
    const relX = (pixelX / canvasWidth) * 100;
    const relY = (pixelY / canvasHeight) * 100;

    const newDsl = upsertOverride(dslRef.current, elementId, {
      x: Math.round(relX * 100) / 100,
      y: Math.round(relY * 100) / 100,
    });
    onDSLChange(newDsl);
  }, [canvasWidth, canvasHeight, onDSLChange]);

  const onDragEnd = useCallback((_elementId: string) => {
    // Drag complete — DSL already updated via onDragMove
  }, []);

  return { onDragStart, onDragMove, onDragEnd };
}
