/**
 * useObjectCreation Tests
 *
 * Tests element creation via mouse drag, tool-specific element types,
 * minimum size threshold, preview bounds, isCreating state, and
 * select/hand tool deactivation.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

import type { IRElement, IRBounds } from '@depix/core';
import {
  useObjectCreation,
  type UseObjectCreationOptions,
} from '../src/hooks/useObjectCreation.js';
import type { ToolType } from '../src/types.js';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

/** Expose hook state through data attributes and a ref. */
let lastCreationResult: {
  isCreating: boolean;
  previewBounds: IRBounds | null;
} = { isCreating: false, previewBounds: null };

function CreationHarness(props: { options: UseObjectCreationOptions }) {
  const { creationHandlers, isCreating, previewBounds } = useObjectCreation(
    props.options,
  );

  // Expose state for assertions
  lastCreationResult = { isCreating, previewBounds };

  return (
    <div
      data-testid="canvas"
      data-creating={isCreating ? 'true' : 'false'}
      data-bounds={previewBounds ? JSON.stringify(previewBounds) : ''}
      onMouseDown={creationHandlers.onMouseDown}
      onMouseMove={creationHandlers.onMouseMove}
      onMouseUp={creationHandlers.onMouseUp}
    />
  );
}

function getCanvas(container: HTMLElement) {
  const el = container.querySelector('[data-testid="canvas"]') as HTMLElement;
  if (!el) throw new Error('Canvas element not found');
  return el;
}

function simulateDrag(
  canvas: HTMLElement,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
) {
  fireEvent.mouseDown(canvas, { clientX: startX, clientY: startY });
  fireEvent.mouseMove(canvas, { clientX: endX, clientY: endY });
  fireEvent.mouseUp(canvas, { clientX: endX, clientY: endY });
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  lastCreationResult = { isCreating: false, previewBounds: null };
});

afterEach(() => {
  cleanup();
});

// ===========================================================================
// Tests
// ===========================================================================

describe('useObjectCreation', () => {
  // ---- Tool-specific creation ---------------------------------------------

  describe('tool-specific element creation', () => {
    it('creates an IRShape with shape="rect" for rect tool', () => {
      const onElementCreated = vi.fn();
      const { container } = render(
        <CreationHarness
          options={{ tool: 'rect', onElementCreated }}
        />,
      );
      const canvas = getCanvas(container);

      simulateDrag(canvas, 10, 10, 100, 100);

      expect(onElementCreated).toHaveBeenCalledOnce();
      const element = onElementCreated.mock.calls[0][0] as IRElement;
      expect(element.type).toBe('shape');
      if (element.type === 'shape') {
        expect(element.shape).toBe('rect');
      }
    });

    it('creates an IRShape with shape="circle" for circle tool', () => {
      const onElementCreated = vi.fn();
      const { container } = render(
        <CreationHarness
          options={{ tool: 'circle', onElementCreated }}
        />,
      );
      const canvas = getCanvas(container);

      simulateDrag(canvas, 0, 0, 50, 50);

      expect(onElementCreated).toHaveBeenCalledOnce();
      const element = onElementCreated.mock.calls[0][0] as IRElement;
      expect(element.type).toBe('shape');
      if (element.type === 'shape') {
        expect(element.shape).toBe('circle');
      }
    });

    it('creates an IRText for text tool', () => {
      const onElementCreated = vi.fn();
      const { container } = render(
        <CreationHarness
          options={{ tool: 'text', onElementCreated }}
        />,
      );
      const canvas = getCanvas(container);

      simulateDrag(canvas, 0, 0, 50, 30);

      expect(onElementCreated).toHaveBeenCalledOnce();
      const element = onElementCreated.mock.calls[0][0] as IRElement;
      expect(element.type).toBe('text');
    });

    it('creates an IRLine for line tool', () => {
      const onElementCreated = vi.fn();
      const { container } = render(
        <CreationHarness
          options={{ tool: 'line', onElementCreated }}
        />,
      );
      const canvas = getCanvas(container);

      simulateDrag(canvas, 10, 20, 100, 80);

      expect(onElementCreated).toHaveBeenCalledOnce();
      const element = onElementCreated.mock.calls[0][0] as IRElement;
      expect(element.type).toBe('line');
    });

    it('creates an IREdge for connector tool', () => {
      const onElementCreated = vi.fn();
      const { container } = render(
        <CreationHarness
          options={{ tool: 'connector', onElementCreated }}
        />,
      );
      const canvas = getCanvas(container);

      simulateDrag(canvas, 0, 0, 60, 60);

      expect(onElementCreated).toHaveBeenCalledOnce();
      const element = onElementCreated.mock.calls[0][0] as IRElement;
      expect(element.type).toBe('edge');
    });

    it('creates an IRImage for image tool', () => {
      const onElementCreated = vi.fn();
      const { container } = render(
        <CreationHarness
          options={{ tool: 'image', onElementCreated }}
        />,
      );
      const canvas = getCanvas(container);

      simulateDrag(canvas, 0, 0, 80, 60);

      expect(onElementCreated).toHaveBeenCalledOnce();
      const element = onElementCreated.mock.calls[0][0] as IRElement;
      expect(element.type).toBe('image');
    });
  });

  // ---- Bounds computation -------------------------------------------------

  describe('bounds computation', () => {
    it('computes correct bounds from drag coordinates', () => {
      const onElementCreated = vi.fn();
      const { container } = render(
        <CreationHarness
          options={{ tool: 'rect', onElementCreated }}
        />,
      );
      const canvas = getCanvas(container);

      simulateDrag(canvas, 10, 20, 60, 70);

      const element = onElementCreated.mock.calls[0][0] as IRElement;
      expect(element.bounds).toEqual({ x: 10, y: 20, w: 50, h: 50 });
    });

    it('handles reverse drag (bottom-right to top-left)', () => {
      const onElementCreated = vi.fn();
      const { container } = render(
        <CreationHarness
          options={{ tool: 'rect', onElementCreated }}
        />,
      );
      const canvas = getCanvas(container);

      simulateDrag(canvas, 100, 100, 50, 50);

      const element = onElementCreated.mock.calls[0][0] as IRElement;
      expect(element.bounds).toEqual({ x: 50, y: 50, w: 50, h: 50 });
    });
  });

  // ---- Minimum size threshold ---------------------------------------------

  describe('minimum size threshold', () => {
    it('does not create element when drag is smaller than 5x5', () => {
      const onElementCreated = vi.fn();
      const { container } = render(
        <CreationHarness
          options={{ tool: 'rect', onElementCreated }}
        />,
      );
      const canvas = getCanvas(container);

      simulateDrag(canvas, 10, 10, 13, 13);

      expect(onElementCreated).not.toHaveBeenCalled();
    });

    it('creates element when drag is exactly 5x5', () => {
      const onElementCreated = vi.fn();
      const { container } = render(
        <CreationHarness
          options={{ tool: 'rect', onElementCreated }}
        />,
      );
      const canvas = getCanvas(container);

      simulateDrag(canvas, 10, 10, 15, 15);

      expect(onElementCreated).toHaveBeenCalledOnce();
    });

    it('does not create element when only width is below threshold', () => {
      const onElementCreated = vi.fn();
      const { container } = render(
        <CreationHarness
          options={{ tool: 'rect', onElementCreated }}
        />,
      );
      const canvas = getCanvas(container);

      simulateDrag(canvas, 10, 10, 13, 100);

      expect(onElementCreated).not.toHaveBeenCalled();
    });
  });

  // ---- Preview bounds -----------------------------------------------------

  describe('previewBounds', () => {
    it('is null before any interaction', () => {
      const onElementCreated = vi.fn();
      render(
        <CreationHarness
          options={{ tool: 'rect', onElementCreated }}
        />,
      );

      expect(lastCreationResult.previewBounds).toBeNull();
    });

    it('updates during mousemove', () => {
      const onElementCreated = vi.fn();
      const { container } = render(
        <CreationHarness
          options={{ tool: 'rect', onElementCreated }}
        />,
      );
      const canvas = getCanvas(container);

      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 20 });
      fireEvent.mouseMove(canvas, { clientX: 50, clientY: 60 });

      expect(lastCreationResult.previewBounds).toEqual({
        x: 10,
        y: 20,
        w: 40,
        h: 40,
      });
    });

    it('resets to null after mouseup', () => {
      const onElementCreated = vi.fn();
      const { container } = render(
        <CreationHarness
          options={{ tool: 'rect', onElementCreated }}
        />,
      );
      const canvas = getCanvas(container);

      simulateDrag(canvas, 10, 10, 100, 100);

      expect(lastCreationResult.previewBounds).toBeNull();
    });
  });

  // ---- isCreating state ---------------------------------------------------

  describe('isCreating state', () => {
    it('is false initially', () => {
      const onElementCreated = vi.fn();
      render(
        <CreationHarness
          options={{ tool: 'rect', onElementCreated }}
        />,
      );

      expect(lastCreationResult.isCreating).toBe(false);
    });

    it('becomes true on mousedown', () => {
      const onElementCreated = vi.fn();
      const { container } = render(
        <CreationHarness
          options={{ tool: 'rect', onElementCreated }}
        />,
      );
      const canvas = getCanvas(container);

      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });

      expect(lastCreationResult.isCreating).toBe(true);
    });

    it('becomes false after mouseup', () => {
      const onElementCreated = vi.fn();
      const { container } = render(
        <CreationHarness
          options={{ tool: 'rect', onElementCreated }}
        />,
      );
      const canvas = getCanvas(container);

      simulateDrag(canvas, 10, 10, 100, 100);

      expect(lastCreationResult.isCreating).toBe(false);
    });
  });

  // ---- Select/hand tool deactivation --------------------------------------

  describe('select/hand tool deactivation', () => {
    it('does not start creation when tool is "select"', () => {
      const onElementCreated = vi.fn();
      const { container } = render(
        <CreationHarness
          options={{ tool: 'select', onElementCreated }}
        />,
      );
      const canvas = getCanvas(container);

      simulateDrag(canvas, 0, 0, 100, 100);

      expect(onElementCreated).not.toHaveBeenCalled();
      expect(lastCreationResult.isCreating).toBe(false);
    });

    it('does not start creation when tool is "hand"', () => {
      const onElementCreated = vi.fn();
      const { container } = render(
        <CreationHarness
          options={{ tool: 'hand', onElementCreated }}
        />,
      );
      const canvas = getCanvas(container);

      simulateDrag(canvas, 0, 0, 100, 100);

      expect(onElementCreated).not.toHaveBeenCalled();
      expect(lastCreationResult.isCreating).toBe(false);
    });
  });

  // ---- Enabled / Disabled -------------------------------------------------

  describe('enabled option', () => {
    it('does not create when enabled=false', () => {
      const onElementCreated = vi.fn();
      const { container } = render(
        <CreationHarness
          options={{ tool: 'rect', onElementCreated, enabled: false }}
        />,
      );
      const canvas = getCanvas(container);

      simulateDrag(canvas, 0, 0, 100, 100);

      expect(onElementCreated).not.toHaveBeenCalled();
    });

    it('defaults enabled to true', () => {
      const onElementCreated = vi.fn();
      const { container } = render(
        <CreationHarness
          options={{ tool: 'rect', onElementCreated }}
        />,
      );
      const canvas = getCanvas(container);

      simulateDrag(canvas, 0, 0, 100, 100);

      expect(onElementCreated).toHaveBeenCalledOnce();
    });
  });

  // ---- Element IDs --------------------------------------------------------

  describe('generated element IDs', () => {
    it('generates unique IDs for created elements', () => {
      const createdElements: IRElement[] = [];
      const onElementCreated = (el: IRElement) => createdElements.push(el);

      const { container, rerender } = render(
        <CreationHarness
          options={{ tool: 'rect', onElementCreated }}
        />,
      );
      const canvas = getCanvas(container);

      simulateDrag(canvas, 0, 0, 100, 100);
      simulateDrag(canvas, 0, 0, 100, 100);

      expect(createdElements).toHaveLength(2);
      expect(createdElements[0].id).not.toBe(createdElements[1].id);
    });
  });
});
