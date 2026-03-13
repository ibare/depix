/**
 * useCanvasClickHandler
 *
 * Registers a Konva Stage click listener that maps click events to IR element
 * selection. Uses a two-pass strategy:
 *   1. Konva walk-up — reliable for edges (line stroke hit detection).
 *   2. IR coordinate-based hit detection — for shapes, containers, text.
 *
 * Only active when the canvas is in edit mode (isEditing || !!toolProp).
 * Uses engine.getStage() to access the Konva Stage without importing konva.
 */

import { useEffect } from 'react';
import type { DepixIR, IRElement, IRContainer } from '@depix/core';
import { findElement } from '@depix/core';
import type { DepixEngine } from '@depix/engine';
import type { SelectionManager } from '@depix/editor';
import type { ToolType } from '../types.js';

// ---------------------------------------------------------------------------
// IR hit detection helper
// ---------------------------------------------------------------------------

/**
 * Find the deepest IR element (non-edge) at a given IR coordinate point.
 * For containers, recursively checks children first (innermost match wins).
 * Edges are skipped — they are handled by Konva's line-stroke hit detection.
 */
function findIRElementAtPoint(elements: IRElement[], irX: number, irY: number): IRElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.type === 'edge') continue;
    const { x, y, w, h } = el.bounds;
    if (irX >= x && irX <= x + w && irY >= y && irY <= y + h) {
      if (el.type === 'container') {
        const child = findIRElementAtPoint((el as IRContainer).children, irX, irY);
        if (child) return child;
      }
      return el;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseCanvasClickHandlerOptions {
  engineRef: React.RefObject<DepixEngine | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  irRef: React.RefObject<DepixIR | null>;
  selectionRef: React.RefObject<SelectionManager | null>;
  storeApi: { getState(): { activeSceneIndex: number; selectedIds: string[] } };
  toolProp: ToolType | undefined;
  internalTool: ToolType;
  isEditing: boolean;
  readOnly: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCanvasClickHandler(opts: UseCanvasClickHandlerOptions): void {
  const { engineRef, containerRef, irRef, selectionRef, storeApi, toolProp, internalTool, isEditing, readOnly } = opts;

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || readOnly || (!isEditing && !toolProp)) return;

    // engine.getStage() returns the Konva Stage reference managed by DepixEngine.
    // Typed as any to avoid importing konva types in @depix/react.
    const stage = engine.getStage() as any;
    if (!stage || typeof stage.on !== 'function') return;

    const handleStageClick = (e: any) => {
      // Only handle selection when in select mode
      const currentTool = toolProp ?? internalTool;
      if (currentTool !== 'select') return;

      const shiftKey = e.evt?.shiftKey ?? false;

      // Step 1: Konva walk-up — reliable ONLY for edges (line stroke hit detection)
      const target = e.target;
      if (target && target !== stage) {
        let node = target;
        while (node && node !== stage) {
          const id = typeof node.id === 'function' ? node.id() : node.id;
          if (id && typeof id === 'string' && id.startsWith('el-')) {
            const element = irRef.current ? findElement(irRef.current, id) : null;
            if (element?.type === 'edge') {
              selectionRef.current?.select(id, shiftKey);
              return;
            }
            break; // non-edge el- found — fall through to IR detection
          }
          node = node.parent;
        }
      }

      // Step 2: IR coordinate-based hit detection for shapes/containers/text
      const container = containerRef.current;
      if (!container || !engine) return;

      const nativeEvent = e.evt as MouseEvent | undefined;
      if (!nativeEvent) return;

      const rect = container.getBoundingClientRect();
      const pixelX = nativeEvent.clientX - rect.left;
      const pixelY = nativeEvent.clientY - rect.top;
      const irPoint = engine.getTransform().toRelativePoint(pixelX, pixelY);

      const sceneIdx = storeApi.getState().activeSceneIndex;
      const scene = irRef.current?.scenes[sceneIdx];
      if (!scene) return;

      const hit = findIRElementAtPoint(scene.elements, irPoint.x, irPoint.y);
      if (hit) {
        selectionRef.current?.select(hit.id, shiftKey);
      } else {
        const currentIds = storeApi.getState().selectedIds;
        if (currentIds.length > 0) {
          selectionRef.current?.clearSelection();
        } else {
          // Nothing hit and nothing selected → select root layout container
          const rootEl = scene.elements.find((el) => el.type === 'container');
          if (rootEl) selectionRef.current?.select(rootEl.id, false);
        }
      }
    };

    stage.on('click', handleStageClick);
    return () => {
      stage.off('click', handleStageClick);
    };
  }, [readOnly, toolProp, internalTool, isEditing]);
}
