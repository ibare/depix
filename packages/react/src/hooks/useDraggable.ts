/**
 * useDraggable
 *
 * A React hook that makes an element draggable via mouse events.
 * Returns position state and props to spread onto a drag handle element.
 *
 * Usage:
 * ```tsx
 * const { position, dragHandleProps, isDragging } = useDraggable({
 *   initialPosition: { x: 100, y: 50 },
 * });
 *
 * return (
 *   <div style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
 *     <div {...dragHandleProps}>Drag me</div>
 *     <div>Content</div>
 *   </div>
 * );
 * ```
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseDraggableOptions {
  /** Initial position. Default: { x: 0, y: 0 } */
  initialPosition?: { x: number; y: number };
  /** Whether dragging is enabled. Default: true */
  enabled?: boolean;
}

export interface DragHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
}

export interface UseDraggableReturn {
  /** Current position of the draggable element. */
  position: { x: number; y: number };
  /** Props to spread onto the drag handle element. */
  dragHandleProps: DragHandleProps;
  /** Whether the element is currently being dragged. */
  isDragging: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDraggable(options?: UseDraggableOptions): UseDraggableReturn {
  const enabled = options?.enabled ?? true;
  const initialPosition = options?.initialPosition ?? { x: 0, y: 0 };

  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);

  // Use refs to track drag state without triggering re-renders during movement
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const { mouseX, mouseY, posX, posY } = dragStartRef.current;
    const dx = e.clientX - mouseX;
    const dy = e.clientY - mouseY;
    setPosition({ x: posX + dx, y: posY + dy });
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;

      // Prevent text selection during drag
      e.preventDefault();

      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        posX: position.x,
        posY: position.y,
      };

      setIsDragging(true);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [enabled, position, handleMouseMove, handleMouseUp],
  );

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return {
    position,
    dragHandleProps: {
      onMouseDown: handleMouseDown,
    },
    isDragging,
  };
}
