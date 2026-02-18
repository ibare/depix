/**
 * useDepixCanvas
 *
 * A React hook for programmatic control of a Depix canvas.
 * Attach the returned `containerRef` to a `<div>` element and use the
 * control methods to load data and navigate between scenes.
 *
 * This hook owns the DepixEngine lifecycle: the engine is created when
 * the container element is available and destroyed on unmount.
 */

import {
  useRef,
  useCallback,
  useState,
  useEffect,
  useId,
} from 'react';
import type { DepixIR } from '@depix/core';
import { compile } from '@depix/core';
import { DepixEngine } from '@depix/engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseDepixCanvasOptions {
  /** Initial width in pixels. Default: 800 */
  width?: number;
  /** Initial height in pixels. Default: 450 */
  height?: number;
}

export interface UseDepixCanvasReturn {
  /** Ref to attach to a container div. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Load data (DSL string or DepixIR). */
  load: (data: string | DepixIR) => void;
  /** Navigate to next scene. */
  nextScene: () => void;
  /** Navigate to previous scene. */
  prevScene: () => void;
  /** Set scene by index. */
  setScene: (index: number) => void;
  /** Current scene index. */
  sceneIndex: number;
  /** Total scene count. */
  sceneCount: number;
  /** The underlying engine instance. */
  engine: DepixEngine | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook for programmatic control of a Depix canvas.
 * Attach `containerRef` to a div element.
 */
export function useDepixCanvas(options?: UseDepixCanvasOptions): UseDepixCanvasReturn {
  const width = options?.width ?? 800;
  const height = options?.height ?? 450;

  const generatedId = useId();
  const containerId = `depix-hook-${generatedId.replace(/:/g, '')}`;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<DepixEngine | null>(null);

  const [sceneIndex, setSceneIndex] = useState(0);
  const [sceneCount, setSceneCount] = useState(0);

  // ---- Engine lifecycle ----------------------------------------------------

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
    // Only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Data loading --------------------------------------------------------

  const load = useCallback((data: string | DepixIR) => {
    const engine = engineRef.current;
    if (!engine) return;

    let ir: DepixIR;
    if (typeof data === 'string') {
      if (data.trim().length === 0) return;
      const result = compile(data);
      ir = result.ir;
    } else {
      ir = data;
    }

    engine.load(ir);
    setSceneIndex(engine.sceneIndex);
    setSceneCount(engine.sceneCount);
  }, []);

  // ---- Scene navigation ----------------------------------------------------

  const nextScene = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.nextScene();
    setSceneIndex(engine.sceneIndex);
  }, []);

  const prevScene = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.prevScene();
    setSceneIndex(engine.sceneIndex);
  }, []);

  const setSceneByIndex = useCallback((index: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setScene(index);
    setSceneIndex(engine.sceneIndex);
  }, []);

  // ---- Return --------------------------------------------------------------

  return {
    containerRef,
    load,
    nextScene,
    prevScene,
    setScene: setSceneByIndex,
    sceneIndex,
    sceneCount,
    engine: engineRef.current,
  };
}
