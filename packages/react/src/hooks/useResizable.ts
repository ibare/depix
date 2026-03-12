/**
 * useResizable
 *
 * A React hook that makes an element resizable via a drag handle.
 * Returns size state and props to spread onto a resize handle element.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseResizableOptions {
  initialWidth: number;
  initialHeight: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  /** Static max height. Overridden by maxHeightFn if provided. */
  maxHeight?: number;
  /** Dynamic max height (e.g. () => window.innerHeight). */
  maxHeightFn?: () => number;
}

export interface UseResizableReturn {
  size: { width: number; height: number };
  resizeHandleProps: { onMouseDown: (e: React.MouseEvent) => void };
  isResizing: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useResizable(options: UseResizableOptions): UseResizableReturn {
  const {
    initialWidth,
    initialHeight,
    minWidth = 0,
    maxWidth = Infinity,
    minHeight = 0,
    maxHeight = Infinity,
    maxHeightFn,
  } = options;

  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [isResizing, setIsResizing] = useState(false);

  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, w: 0, h: 0 });
  const constraintsRef = useRef({ minWidth, maxWidth, minHeight, maxHeight, maxHeightFn });
  constraintsRef.current = { minWidth, maxWidth, minHeight, maxHeight, maxHeightFn };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const { mouseX, mouseY, w, h } = dragStartRef.current;
    const { minWidth: mnW, maxWidth: mxW, minHeight: mnH, maxHeight: mxH, maxHeightFn: mxHFn } =
      constraintsRef.current;

    const effectiveMaxH = mxHFn ? mxHFn() : mxH;

    const newW = Math.min(mxW, Math.max(mnW, w + (e.clientX - mouseX)));
    const newH = Math.min(effectiveMaxH, Math.max(mnH, h + (e.clientY - mouseY)));
    setSize({ width: newW, height: newH });
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        w: size.width,
        h: size.height,
      };

      setIsResizing(true);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [size, handleMouseMove, handleMouseUp],
  );

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return {
    size,
    resizeHandleProps: { onMouseDown: handleMouseDown },
    isResizing,
  };
}
