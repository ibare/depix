/**
 * useDraggable Tests
 *
 * Tests the draggable hook for position state, mouse event handling,
 * enabled/disabled state, and isDragging status.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

import { useDraggable } from '../src/hooks/useDraggable.js';
import type { UseDraggableOptions } from '../src/hooks/useDraggable.js';

// ---------------------------------------------------------------------------
// Test harness component
// ---------------------------------------------------------------------------

/**
 * Renders a div that uses useDraggable and exposes state via data attributes.
 */
function DraggableHarness(props: { options?: UseDraggableOptions }) {
  const { position, dragHandleProps, isDragging } = useDraggable(props.options);

  return (
    <div
      data-testid="draggable"
      data-x={position.x}
      data-y={position.y}
      data-dragging={isDragging ? 'true' : 'false'}
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      {...dragHandleProps}
    />
  );
}

function getHarness(container: HTMLElement) {
  const el = container.querySelector('[data-testid="draggable"]') as HTMLElement;
  if (!el) throw new Error('Harness element not found');
  return el;
}

function getPosition(el: HTMLElement) {
  return {
    x: Number(el.getAttribute('data-x')),
    y: Number(el.getAttribute('data-y')),
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

// ===========================================================================
// Tests
// ===========================================================================

describe('useDraggable', () => {
  // ---- Initial state -------------------------------------------------------

  describe('initial state', () => {
    it('starts at default position (0, 0)', () => {
      const { container } = render(<DraggableHarness />);
      const el = getHarness(container);
      const pos = getPosition(el);

      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
    });

    it('starts at custom initial position', () => {
      const { container } = render(
        <DraggableHarness options={{ initialPosition: { x: 100, y: 200 } }} />,
      );
      const el = getHarness(container);
      const pos = getPosition(el);

      expect(pos.x).toBe(100);
      expect(pos.y).toBe(200);
    });

    it('isDragging is false initially', () => {
      const { container } = render(<DraggableHarness />);
      const el = getHarness(container);

      expect(el.getAttribute('data-dragging')).toBe('false');
    });
  });

  // ---- Drag behavior -------------------------------------------------------

  describe('drag behavior', () => {
    it('sets isDragging to true on mousedown', () => {
      const { container } = render(<DraggableHarness />);
      const el = getHarness(container);

      fireEvent.mouseDown(el, { clientX: 50, clientY: 50 });

      expect(el.getAttribute('data-dragging')).toBe('true');
    });

    it('updates position during mousemove', () => {
      const { container } = render(<DraggableHarness />);
      const el = getHarness(container);

      // Start drag at (50, 50)
      fireEvent.mouseDown(el, { clientX: 50, clientY: 50 });

      // Move mouse to (150, 200) -> delta = (100, 150)
      act(() => {
        fireEvent.mouseMove(document, { clientX: 150, clientY: 200 });
      });

      const pos = getPosition(el);
      expect(pos.x).toBe(100);
      expect(pos.y).toBe(150);
    });

    it('stops dragging on mouseup', () => {
      const { container } = render(<DraggableHarness />);
      const el = getHarness(container);

      fireEvent.mouseDown(el, { clientX: 50, clientY: 50 });
      expect(el.getAttribute('data-dragging')).toBe('true');

      act(() => {
        fireEvent.mouseUp(document);
      });

      expect(el.getAttribute('data-dragging')).toBe('false');
    });

    it('retains final position after drag ends', () => {
      const { container } = render(<DraggableHarness />);
      const el = getHarness(container);

      fireEvent.mouseDown(el, { clientX: 0, clientY: 0 });

      act(() => {
        fireEvent.mouseMove(document, { clientX: 75, clientY: 30 });
      });

      act(() => {
        fireEvent.mouseUp(document);
      });

      const pos = getPosition(el);
      expect(pos.x).toBe(75);
      expect(pos.y).toBe(30);
    });

    it('handles drag from custom initial position', () => {
      const { container } = render(
        <DraggableHarness options={{ initialPosition: { x: 50, y: 50 } }} />,
      );
      const el = getHarness(container);

      fireEvent.mouseDown(el, { clientX: 100, clientY: 100 });

      act(() => {
        fireEvent.mouseMove(document, { clientX: 200, clientY: 300 });
      });

      const pos = getPosition(el);
      expect(pos.x).toBe(150); // 50 + (200 - 100)
      expect(pos.y).toBe(250); // 50 + (300 - 100)
    });

    it('does not update position on mousemove without prior mousedown', () => {
      const { container } = render(<DraggableHarness />);
      const el = getHarness(container);

      act(() => {
        fireEvent.mouseMove(document, { clientX: 100, clientY: 100 });
      });

      const pos = getPosition(el);
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
    });
  });

  // ---- Enabled / Disabled --------------------------------------------------

  describe('enabled option', () => {
    it('does not start drag when enabled=false', () => {
      const { container } = render(
        <DraggableHarness options={{ enabled: false }} />,
      );
      const el = getHarness(container);

      fireEvent.mouseDown(el, { clientX: 50, clientY: 50 });

      expect(el.getAttribute('data-dragging')).toBe('false');
    });

    it('does not update position when enabled=false', () => {
      const { container } = render(
        <DraggableHarness options={{ enabled: false }} />,
      );
      const el = getHarness(container);

      fireEvent.mouseDown(el, { clientX: 50, clientY: 50 });

      act(() => {
        fireEvent.mouseMove(document, { clientX: 150, clientY: 200 });
      });

      const pos = getPosition(el);
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
    });

    it('defaults enabled to true', () => {
      const { container } = render(<DraggableHarness />);
      const el = getHarness(container);

      fireEvent.mouseDown(el, { clientX: 0, clientY: 0 });

      expect(el.getAttribute('data-dragging')).toBe('true');
    });
  });

  // ---- Cleanup -------------------------------------------------------------

  describe('cleanup', () => {
    it('removes event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      const { unmount } = render(<DraggableHarness />);

      unmount();

      // Should have called removeEventListener for mousemove and mouseup
      const removedEvents = removeEventListenerSpy.mock.calls.map(call => call[0]);
      expect(removedEvents).toContain('mousemove');
      expect(removedEvents).toContain('mouseup');

      removeEventListenerSpy.mockRestore();
    });
  });
});
