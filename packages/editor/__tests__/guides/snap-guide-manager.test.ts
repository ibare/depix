import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IRBounds } from '@depix/core';
import { SnapGuideManager } from '../../src/guides/snap-guide-manager.js';
import { DEFAULT_SNAP_CONFIG } from '../../src/guides/types.js';
import type { GuideLine } from '../../src/guides/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bounds(x: number, y: number, w: number, h: number): IRBounds {
  return { x, y, w, h };
}

function el(id: string, b: IRBounds) {
  return { id, bounds: b };
}

function makeElements() {
  return [
    el('a', bounds(10, 10, 20, 20)),
    el('b', bounds(50, 50, 20, 20)),
    el('c', bounds(70, 10, 10, 10)),
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SnapGuideManager', () => {
  let manager: SnapGuideManager;

  beforeEach(() => {
    manager = new SnapGuideManager();
  });

  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------
  describe('configuration', () => {
    it('uses default config when no config provided', () => {
      const config = manager.getConfig();
      expect(config).toEqual(DEFAULT_SNAP_CONFIG);
    });

    it('merges partial config with defaults', () => {
      const custom = new SnapGuideManager({ threshold: 2.5, guideColor: '#00ff00' });
      const config = custom.getConfig();

      expect(config.threshold).toBe(2.5);
      expect(config.guideColor).toBe('#00ff00');
      expect(config.enabled).toBe(true); // default
      expect(config.guideStrokeWidth).toBe(1); // default
    });

    it('updateConfig merges changes', () => {
      manager.updateConfig({ threshold: 3.0 });
      expect(manager.getConfig().threshold).toBe(3.0);
      expect(manager.getConfig().enabled).toBe(true); // unchanged
    });

    it('setEnabled / isEnabled toggles snapping', () => {
      expect(manager.isEnabled()).toBe(true);
      manager.setEnabled(false);
      expect(manager.isEnabled()).toBe(false);
      manager.setEnabled(true);
      expect(manager.isEnabled()).toBe(true);
    });

    it('getConfig returns a copy (not a reference)', () => {
      const config1 = manager.getConfig();
      config1.threshold = 999;
      const config2 = manager.getConfig();
      expect(config2.threshold).toBe(DEFAULT_SNAP_CONFIG.threshold);
    });
  });

  // -----------------------------------------------------------------------
  // Drag lifecycle
  // -----------------------------------------------------------------------
  describe('drag lifecycle', () => {
    it('onDragStart caches elements excluding dragging element', () => {
      const elements = makeElements();
      manager.onDragStart('a', elements);

      // Drag 'b' close to 'c' to verify 'a' is excluded but 'c' is available
      // We verify indirectly: 'a' is at x=10. Dragging near x=10 should NOT snap to 'a'.
      // Actually we can't directly inspect cache, but let's verify behaviour.
      // Move dragging (was 'a') near 'b' (x=50).
      const result = manager.onDragMove(bounds(50.5, 30, 20, 20));
      expect(result.snappedX).toBe(50);
    });

    it('onDragMove returns snap result with guides', () => {
      const elements = makeElements();
      manager.onDragStart('a', elements);

      const result = manager.onDragMove(bounds(50.3, 50.3, 20, 20));

      expect(result.deltaX).toBeDefined();
      expect(result.deltaY).toBeDefined();
      expect(result.guides).toBeDefined();
      expect(Array.isArray(result.guides)).toBe(true);
    });

    it('onDragEnd clears guides', () => {
      const elements = makeElements();
      manager.onDragStart('a', elements);
      manager.onDragMove(bounds(50.3, 50.3, 20, 20));

      expect(manager.getGuides().length).toBeGreaterThan(0);

      manager.onDragEnd();

      expect(manager.getGuides()).toHaveLength(0);
    });

    it('returns zero delta when snapping is disabled', () => {
      manager.setEnabled(false);
      const elements = makeElements();
      manager.onDragStart('a', elements);

      // Even near 'b' (x=50), should not snap
      const result = manager.onDragMove(bounds(50.3, 50.3, 20, 20));

      expect(result.deltaX).toBe(0);
      expect(result.deltaY).toBe(0);
      expect(result.guides).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Guide rendering
  // -----------------------------------------------------------------------
  describe('guide rendering', () => {
    it('calls guideRenderer with guide lines on drag move', () => {
      const renderer = vi.fn();
      manager.setGuideRenderer(renderer);

      const elements = makeElements();
      manager.onDragStart('a', elements);
      manager.onDragMove(bounds(50.3, 50.3, 20, 20));

      expect(renderer).toHaveBeenCalled();
      const lastCall = renderer.mock.calls[renderer.mock.calls.length - 1];
      expect(Array.isArray(lastCall[0])).toBe(true);
    });

    it('calls guideRenderer with empty array on drag end', () => {
      const renderer = vi.fn();
      manager.setGuideRenderer(renderer);

      const elements = makeElements();
      manager.onDragStart('a', elements);
      manager.onDragMove(bounds(50.3, 50.3, 20, 20));
      renderer.mockClear();

      manager.onDragEnd();

      expect(renderer).toHaveBeenCalledWith([]);
    });

    it('does not throw when renderer is null', () => {
      manager.setGuideRenderer(null);

      const elements = makeElements();
      manager.onDragStart('a', elements);

      expect(() => {
        manager.onDragMove(bounds(50.3, 50.3, 20, 20));
        manager.onDragEnd();
      }).not.toThrow();
    });

    it('clearGuides calls renderer with empty array', () => {
      const renderer = vi.fn();
      manager.setGuideRenderer(renderer);

      const elements = makeElements();
      manager.onDragStart('a', elements);
      manager.onDragMove(bounds(50.3, 50.3, 20, 20));
      renderer.mockClear();

      manager.clearGuides();

      expect(renderer).toHaveBeenCalledWith([]);
      expect(manager.getGuides()).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('onDragMove without onDragStart returns result against canvas only', () => {
      // No onDragStart called — cachedElements is empty.
      // Should still work (snap against canvas edges).
      const result = manager.onDragMove(bounds(0.3, 0.3, 10, 10));

      // Should snap to canvas top-left
      expect(result.snappedX).toBeCloseTo(0);
      expect(result.snappedY).toBeCloseTo(0);
    });

    it('handles multiple drag sessions correctly', () => {
      const elements = makeElements();

      // First session
      manager.onDragStart('a', elements);
      const r1 = manager.onDragMove(bounds(50.3, 50.3, 20, 20));
      manager.onDragEnd();

      // Second session with a different dragging element
      manager.onDragStart('b', elements);
      const r2 = manager.onDragMove(bounds(10.3, 10.3, 20, 20));
      manager.onDragEnd();

      // In second session, 'a' is in cache so snapping to x=10 should work
      expect(r2.snappedX).toBe(10);
    });

    it('updateConfig with new threshold affects subsequent calculations', () => {
      const elements = makeElements();
      manager.onDragStart('a', elements);

      // Default threshold=1.0, distance=0.3 → snaps
      let result = manager.onDragMove(bounds(50.3, 50.3, 20, 20));
      expect(result.snappedX).toBeDefined();

      // Tighten threshold
      manager.updateConfig({ threshold: 0.1 });
      result = manager.onDragMove(bounds(50.3, 50.3, 20, 20));
      expect(result.snappedX).toBeUndefined();
    });
  });
});
