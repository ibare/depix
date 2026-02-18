/**
 * DepixCanvas
 *
 * A read-only React component for viewing Depix diagrams.
 * Accepts either a DSL v2 string or a pre-compiled DepixIR document,
 * and renders it using a DepixEngine (Konva) internally.
 *
 * This component does NOT use react-konva; it creates its own
 * DepixEngine which manages the Konva stage lifecycle.
 */

import React, {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useId,
} from 'react';
import type { DepixIR } from '@depix/core';
import { compile } from '@depix/core';
import { DepixEngine } from '@depix/engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DepixCanvasProps {
  /** DSL v2 text or pre-compiled DepixIR. */
  data: string | DepixIR;
  /** Called when scene changes. */
  onSceneChange?: (index: number) => void;
  /** Called on canvas click. */
  onClick?: () => void;
  /** CSS class name. */
  className?: string;
  /** CSS style. */
  style?: React.CSSProperties;
  /** Initial width in pixels. Default: 800 */
  width?: number;
  /** Initial height in pixels. Default: 450 */
  height?: number;
}

export interface DepixCanvasRef {
  /** Go to next scene. */
  nextScene: () => void;
  /** Go to previous scene. */
  prevScene: () => void;
  /** Go to specific scene by index. */
  setScene: (index: number) => void;
  /** Get current scene index. */
  getSceneIndex: () => number;
  /** Get total scene count. */
  getSceneCount: () => number;
  /** Get the underlying engine. */
  getEngine: () => DepixEngine | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the data prop into a DepixIR document.
 * If `data` is a string, compile it. If it is already IR, return it directly.
 * Returns `null` when the data is empty / cannot be compiled.
 */
function resolveIR(data: string | DepixIR): DepixIR | null {
  if (typeof data === 'string') {
    if (data.trim().length === 0) return null;
    const { ir } = compile(data);
    return ir;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Read-only canvas component for viewing Depix diagrams.
 */
export const DepixCanvas = forwardRef<DepixCanvasRef, DepixCanvasProps>(
  function DepixCanvas(props, ref) {
    const {
      data,
      onSceneChange,
      onClick,
      className,
      style,
      width = 800,
      height = 450,
    } = props;

    const generatedId = useId();
    const containerId = `depix-canvas-${generatedId.replace(/:/g, '')}`;

    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<DepixEngine | null>(null);

    // ---- Engine lifecycle --------------------------------------------------

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      // Ensure the container has the id that Konva needs
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
      // We intentionally only run this on mount/unmount.
      // Width/height changes are handled via resize below.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---- Data loading ------------------------------------------------------

    useEffect(() => {
      const engine = engineRef.current;
      if (!engine) return;

      const ir = resolveIR(data);
      if (!ir) return;

      engine.load(ir);
    }, [data]);

    // ---- Responsive resize via ResizeObserver ------------------------------

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

      return () => {
        observer.disconnect();
      };
    }, []);

    // ---- Imperative handle -------------------------------------------------

    useImperativeHandle(ref, () => ({
      nextScene() {
        const engine = engineRef.current;
        if (!engine) return;
        engine.nextScene();
        onSceneChange?.(engine.sceneIndex);
      },
      prevScene() {
        const engine = engineRef.current;
        if (!engine) return;
        engine.prevScene();
        onSceneChange?.(engine.sceneIndex);
      },
      setScene(index: number) {
        const engine = engineRef.current;
        if (!engine) return;
        engine.setScene(index);
        onSceneChange?.(engine.sceneIndex);
      },
      getSceneIndex() {
        return engineRef.current?.sceneIndex ?? 0;
      },
      getSceneCount() {
        return engineRef.current?.sceneCount ?? 0;
      },
      getEngine() {
        return engineRef.current;
      },
    }), [onSceneChange]);

    // ---- Render ------------------------------------------------------------

    const containerStyle: React.CSSProperties = {
      width: style?.width ?? width,
      height: style?.height ?? height,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      ...style,
    };

    return (
      <div
        ref={containerRef}
        className={className}
        style={containerStyle}
        onClick={onClick}
      />
    );
  },
);
