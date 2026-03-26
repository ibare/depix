/**
 * useEditableEngine
 *
 * Manages the DepixEngine lifecycle, resize observation, scene/debug sync,
 * fullscreen behaviour, body scroll lock, and editing-dimension recomputation
 * for DepixCanvasEditable.
 */

import { useRef, useEffect, useCallback, useId } from 'react';
import type { DepixIR } from '@depix/core';
import { DepixEngine } from '@depix/engine';
import type { EditorStore } from './store/index.js';
import { computeEditDims } from './editable-styles.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseEditableEngineOptions {
  /** The IR currently rendered (may be editingIR during DSL editing). */
  renderIR: DepixIR;
  /** Base canvas width. */
  width: number;
  /** Base canvas height. */
  height: number;
  /** Whether debug mode is enabled. */
  debug: boolean;
  /** Current scene index. */
  currentSceneIndex: number;
  /** Whether the component is in edit mode. */
  isEditing: boolean;
  /** Whether the component is in fullscreen. */
  isFullscreen: boolean;
  /** Total number of scenes in the IR. */
  totalScenes: number;
  /** Aspect ratio from IR metadata. */
  aspectRatio: { width: number; height: number } | undefined;
  /** Zustand store API. */
  storeApi: EditorStore;
}

export interface UseEditableEngineReturn {
  /** Ref to the container div (attach to the canvas wrapper). */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Ref to the DepixEngine instance. */
  engineRef: React.MutableRefObject<DepixEngine | null>;
  /** Unique container DOM id. */
  containerId: string;
  /** Enter fullscreen on the container's parent. */
  enterFullscreen: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEditableEngine({
  renderIR,
  width,
  height,
  debug,
  currentSceneIndex,
  isEditing,
  isFullscreen,
  totalScenes,
  aspectRatio,
  storeApi,
}: UseEditableEngineOptions): UseEditableEngineReturn {
  const generatedId = useId();
  const containerId = `depix-editable-${generatedId.replace(/:/g, '')}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<DepixEngine | null>(null);

  // ---- Engine lifecycle ---------------------------------------------------

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.id = containerId;

    const engine = new DepixEngine({
      container: containerId,
      width,
      height,
    });

    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Update IR when it changes -----------------------------------------

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.update(renderIR);
  }, [renderIR]);

  // ---- Sync debug mode to engine -----------------------------------------

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setDebugMode(debug);
  }, [debug]);

  // ---- Sync scene index to engine ----------------------------------------

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setScene(currentSceneIndex);
  }, [currentSceneIndex]);

  // ---- Responsive resize --------------------------------------------------

  useEffect(() => {
    const container = containerRef.current;
    const engine = engineRef.current;
    if (!container || !engine) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          engine.resize(w, h);
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ---- Fullscreen management ----------------------------------------------

  useEffect(() => {
    const onChange = () => {
      storeApi.getState().setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [storeApi]);

  const enterFullscreen = useCallback(() => {
    containerRef.current?.parentElement?.requestFullscreen();
  }, []);

  // ---- Fullscreen keyboard navigation ------------------------------------

  useEffect(() => {
    if (!isFullscreen || isEditing) return;

    const handleKey = (e: KeyboardEvent) => {
      const idx = storeApi.getState().activeSceneIndex;
      switch (e.key) {
        case ' ':
        case 'ArrowRight':
          e.preventDefault();
          storeApi.getState().setActiveSceneIndex(Math.min(totalScenes - 1, idx + 1));
          break;
        case 'Backspace':
        case 'ArrowLeft':
          e.preventDefault();
          storeApi.getState().setActiveSceneIndex(Math.max(0, idx - 1));
          break;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFullscreen, isEditing, totalScenes, storeApi]);

  // ---- Lock body scroll while editing ------------------------------------

  useEffect(() => {
    if (!isEditing) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isEditing]);

  // ---- Recompute editing dimensions on window resize ----------------------

  useEffect(() => {
    if (!isEditing) return;

    const handleResize = () => {
      const ar = aspectRatio ?? { width: 16, height: 9 };
      storeApi.getState().setEditDims(computeEditDims(ar));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isEditing, aspectRatio, storeApi]);

  return {
    containerRef,
    engineRef,
    containerId,
    enterFullscreen,
  };
}
