/**
 * usePanelPositions Tests
 *
 * Tests panel position management including initial positions, position
 * updates, reset functionality, and edge cases.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

import {
  usePanelPositions,
  type UsePanelPositionsOptions,
} from '../src/hooks/usePanelPositions.js';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

let lastResult: ReturnType<typeof usePanelPositions> | null = null;

function PanelHarness(props: { options: UsePanelPositionsOptions }) {
  const result = usePanelPositions(props.options);
  lastResult = result;

  return (
    <div data-testid="panel-harness">
      {Object.entries(result.positions).map(([id, pos]) => (
        <div
          key={id}
          data-testid={`panel-${id}`}
          data-x={pos.x}
          data-y={pos.y}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  lastResult = null;
});

afterEach(() => {
  cleanup();
});

// ===========================================================================
// Tests
// ===========================================================================

describe('usePanelPositions', () => {
  // ---- Initial positions --------------------------------------------------

  describe('initial positions', () => {
    it('initializes all panels with default (0,0) when no defaults provided', () => {
      render(
        <PanelHarness options={{ panels: ['toolbar', 'inspector'] }} />,
      );

      expect(lastResult!.positions).toEqual({
        toolbar: { x: 0, y: 0 },
        inspector: { x: 0, y: 0 },
      });
    });

    it('initializes panels with provided defaults', () => {
      render(
        <PanelHarness
          options={{
            panels: ['toolbar', 'inspector'],
            defaults: {
              toolbar: { x: 10, y: 20 },
              inspector: { x: 300, y: 50 },
            },
          }}
        />,
      );

      expect(lastResult!.positions).toEqual({
        toolbar: { x: 10, y: 20 },
        inspector: { x: 300, y: 50 },
      });
    });

    it('uses default (0,0) for panels not in the defaults map', () => {
      render(
        <PanelHarness
          options={{
            panels: ['toolbar', 'inspector'],
            defaults: {
              toolbar: { x: 10, y: 20 },
            },
          }}
        />,
      );

      expect(lastResult!.positions.toolbar).toEqual({ x: 10, y: 20 });
      expect(lastResult!.positions.inspector).toEqual({ x: 0, y: 0 });
    });

    it('handles empty panels array', () => {
      render(<PanelHarness options={{ panels: [] }} />);

      expect(lastResult!.positions).toEqual({});
    });
  });

  // ---- Position updates ---------------------------------------------------

  describe('setPosition', () => {
    it('updates position for a specific panel', () => {
      render(
        <PanelHarness options={{ panels: ['toolbar', 'inspector'] }} />,
      );

      act(() => {
        lastResult!.setPosition('toolbar', { x: 50, y: 100 });
      });

      expect(lastResult!.positions.toolbar).toEqual({ x: 50, y: 100 });
    });

    it('does not affect other panels when updating one', () => {
      render(
        <PanelHarness
          options={{
            panels: ['toolbar', 'inspector'],
            defaults: {
              toolbar: { x: 10, y: 20 },
              inspector: { x: 300, y: 50 },
            },
          }}
        />,
      );

      act(() => {
        lastResult!.setPosition('toolbar', { x: 100, y: 200 });
      });

      expect(lastResult!.positions.toolbar).toEqual({ x: 100, y: 200 });
      expect(lastResult!.positions.inspector).toEqual({ x: 300, y: 50 });
    });

    it('can update the same panel multiple times', () => {
      render(
        <PanelHarness options={{ panels: ['toolbar'] }} />,
      );

      act(() => {
        lastResult!.setPosition('toolbar', { x: 10, y: 20 });
      });
      act(() => {
        lastResult!.setPosition('toolbar', { x: 50, y: 60 });
      });

      expect(lastResult!.positions.toolbar).toEqual({ x: 50, y: 60 });
    });

    it('can add a position for a panel not in the initial list', () => {
      render(
        <PanelHarness options={{ panels: ['toolbar'] }} />,
      );

      act(() => {
        lastResult!.setPosition('newpanel', { x: 99, y: 88 });
      });

      expect(lastResult!.positions.newpanel).toEqual({ x: 99, y: 88 });
    });
  });

  // ---- Reset --------------------------------------------------------------

  describe('resetPositions', () => {
    it('resets all panels to their default positions', () => {
      const defaults = {
        toolbar: { x: 10, y: 20 },
        inspector: { x: 300, y: 50 },
      };
      render(
        <PanelHarness
          options={{ panels: ['toolbar', 'inspector'], defaults }}
        />,
      );

      // Move panels
      act(() => {
        lastResult!.setPosition('toolbar', { x: 999, y: 999 });
        lastResult!.setPosition('inspector', { x: 111, y: 222 });
      });

      // Reset
      act(() => {
        lastResult!.resetPositions();
      });

      expect(lastResult!.positions).toEqual(defaults);
    });

    it('resets to (0,0) when no defaults were provided', () => {
      render(
        <PanelHarness options={{ panels: ['toolbar'] }} />,
      );

      act(() => {
        lastResult!.setPosition('toolbar', { x: 500, y: 500 });
      });

      act(() => {
        lastResult!.resetPositions();
      });

      expect(lastResult!.positions.toolbar).toEqual({ x: 0, y: 0 });
    });
  });

  // ---- Return type stability ----------------------------------------------

  describe('return value structure', () => {
    it('returns positions, setPosition, and resetPositions', () => {
      render(
        <PanelHarness options={{ panels: ['toolbar'] }} />,
      );

      expect(lastResult).toBeDefined();
      expect(typeof lastResult!.positions).toBe('object');
      expect(typeof lastResult!.setPosition).toBe('function');
      expect(typeof lastResult!.resetPositions).toBe('function');
    });
  });
});
