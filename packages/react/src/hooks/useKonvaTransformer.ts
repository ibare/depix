/**
 * useKonvaTransformer
 *
 * Manages the Konva Transformer lifecycle for edit mode selection UI.
 * Delegates Konva object creation/destruction to DepixEngine to satisfy C4
 * (no new Konva.*() in @depix/react).
 *
 * Two effects:
 *   1. Edit mode change → engine.createEditOverlay / engine.destroyEditOverlay
 *   2. Selection change → sync Transformer nodes via engine.getEditTransformer()
 */

import { useEffect } from 'react';
import type { DepixIR, IRElement } from '@depix/core';
import { findElement } from '@depix/core';
import type { DepixEngine } from '@depix/engine';
import type { HandleManager } from '@depix/editor';
import type { ToolType } from '../types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseKonvaTransformerOptions {
  engineRef: React.RefObject<DepixEngine | null>;
  ir: DepixIR;
  isEditing: boolean;
  toolProp: ToolType | undefined;
  isDSLMode: boolean;
  selectedIds: string[];
  handleRef: React.RefObject<HandleManager | null>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useKonvaTransformer(opts: UseKonvaTransformerOptions): void {
  const { engineRef, ir, isEditing, toolProp, isDSLMode, selectedIds, handleRef } = opts;
  const isEditActive = isEditing || !!toolProp;

  // ---- Create / destroy overlay on edit mode change -----------------------
  // engine.createEditOverlay handles new Konva.Layer() and new Konva.Transformer()
  // internally — no konva import or construction in this hook.

  useEffect(() => {
    const engine = engineRef.current;
    if (!isEditActive) {
      engine?.destroyEditOverlay();
      return;
    }
    if (!engine) return;

    engine.createEditOverlay(isDSLMode);
    return () => {
      engine.destroyEditOverlay();
    };
  }, [isEditing, toolProp, isDSLMode]);

  // ---- Sync Transformer nodes when selection changes ----------------------
  // Uses engine.getEditTransformer() and engine.getOverlayLayer() to access
  // Konva references without importing konva types directly.

  useEffect(() => {
    const engine = engineRef.current;
    // Typed as any: Konva.Transformer returned by engine, no konva import needed.
    const transformer = engine?.getEditTransformer() as any;
    if (!transformer || !isEditActive) return;

    const stage = engine?.getStage() as any;
    if (!stage) return;

    if (selectedIds.length === 0) {
      transformer.nodes([]);
      (engine?.getOverlayLayer() as any)?.batchDraw();
      return;
    }

    // Find rendered Konva nodes by element ID
    const nodes: any[] = [];
    for (const id of selectedIds) {
      const node = stage.findOne(`#${id}`);
      if (node) nodes.push(node);
    }

    if (nodes.length === 0) {
      transformer.nodes([]);
      (engine?.getOverlayLayer() as any)?.batchDraw();
      return;
    }

    // Configure Transformer based on mode
    if (isDSLMode) {
      // DSL mode: border-only selection indicator, no manipulation
      transformer.enabledAnchors([]);
      transformer.rotateEnabled(false);
      transformer.resizeEnabled(false);
    } else {
      // Freeform mode: configure from HandleManager definition
      const elements = selectedIds
        .map((id) => findElement(ir, id))
        .filter((el): el is IRElement => el !== undefined);

      handleRef.current?.updateForElements(elements);
      const def = handleRef.current?.getDefinition();

      if (def?.handleType === 'bounding-box') {
        transformer.keepRatio(def.keepRatio ?? false);
        transformer.rotateEnabled(def.rotateEnabled ?? true);
        if (def.enabledAnchors) {
          transformer.enabledAnchors(def.enabledAnchors);
        }
      }
    }

    transformer.nodes(nodes);
    const overlayLayer = engine?.getOverlayLayer() as any;
    overlayLayer?.moveToTop();
    overlayLayer?.batchDraw();
  }, [selectedIds, ir, isEditing, toolProp]);
}
