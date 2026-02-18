import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  IRShape,
  IRText,
  IRLine,
  IREdge,
  IRContainer,
  IRImage,
  IRPath,
  IRElement,
} from '@depix/core';
import { HandleManager } from '../../src/handles/handle-manager.js';
import { ALL_ANCHORS, CORNER_ANCHORS } from '../../src/handles/types.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const rectShape: IRShape = {
  id: 's1',
  type: 'shape',
  shape: 'rect',
  bounds: { x: 10, y: 10, w: 20, h: 15 },
  style: {},
};

const circleShape: IRShape = {
  id: 's2',
  type: 'shape',
  shape: 'circle',
  bounds: { x: 40, y: 40, w: 20, h: 20 },
  style: {},
};

const textEl: IRText = {
  id: 't1',
  type: 'text',
  bounds: { x: 5, y: 5, w: 30, h: 10 },
  style: {},
  content: 'Hello',
  fontSize: 3,
  color: '#000',
};

const lineEl: IRLine = {
  id: 'l1',
  type: 'line',
  bounds: { x: 0, y: 0, w: 50, h: 50 },
  style: {},
  from: { x: 0, y: 0 },
  to: { x: 50, y: 50 },
};

const edgeEl: IREdge = {
  id: 'e1',
  type: 'edge',
  bounds: { x: 0, y: 0, w: 100, h: 100 },
  style: {},
  fromId: 'a',
  toId: 'b',
  fromAnchor: { x: 10, y: 10 },
  toAnchor: { x: 90, y: 90 },
  path: { type: 'straight' },
};

const containerEl: IRContainer = {
  id: 'c1',
  type: 'container',
  bounds: { x: 0, y: 0, w: 60, h: 40 },
  style: {},
  children: [],
};

const imageEl: IRImage = {
  id: 'i1',
  type: 'image',
  bounds: { x: 0, y: 0, w: 40, h: 30 },
  style: {},
  src: 'https://example.com/photo.png',
};

const pathEl: IRPath = {
  id: 'p1',
  type: 'path',
  bounds: { x: 10, y: 10, w: 30, h: 30 },
  style: {},
  d: 'M 10 10 L 40 40',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HandleManager', () => {
  let manager: HandleManager;

  beforeEach(() => {
    manager = new HandleManager();
  });

  // -----------------------------------------------------------------------
  // Single selection
  // -----------------------------------------------------------------------

  describe('single selection', () => {
    it('updates definition for a shape element', () => {
      manager.updateForElements([rectShape]);
      const def = manager.getDefinition();
      expect(def).not.toBeNull();
      expect(def!.handleType).toBe('bounding-box');
      expect(def!.rotateEnabled).toBe(true);
      expect(def!.enabledAnchors).toEqual(ALL_ANCHORS);
    });

    it('updates definition for a circle shape with keepRatio', () => {
      manager.updateForElements([circleShape]);
      const def = manager.getDefinition();
      expect(def).not.toBeNull();
      expect(def!.keepRatio).toBe(true);
      expect(def!.enabledAnchors).toEqual(CORNER_ANCHORS);
    });

    it('updates definition for a text element', () => {
      manager.updateForElements([textEl]);
      const def = manager.getDefinition();
      expect(def).not.toBeNull();
      expect(def!.handleType).toBe('bounding-box');
      expect(def!.rotateEnabled).toBe(false);
    });

    it('updates definition for a line element', () => {
      manager.updateForElements([lineEl]);
      const def = manager.getDefinition();
      expect(def).not.toBeNull();
      expect(def!.handleType).toBe('endpoint');
      expect(def!.enabledAnchors).toEqual([]);
    });

    it('updates definition for an edge element', () => {
      manager.updateForElements([edgeEl]);
      const def = manager.getDefinition();
      expect(def).not.toBeNull();
      expect(def!.handleType).toBe('connector');
      expect(def!.enabledAnchors).toEqual([]);
    });

    it('updates definition for a container element', () => {
      manager.updateForElements([containerEl]);
      const def = manager.getDefinition();
      expect(def).not.toBeNull();
      expect(def!.handleType).toBe('bounding-box');
      expect(def!.rotateEnabled).toBe(false);
      expect(def!.enabledAnchors).toEqual(ALL_ANCHORS);
    });

    it('updates definition for an image element', () => {
      manager.updateForElements([imageEl]);
      const def = manager.getDefinition();
      expect(def).not.toBeNull();
      expect(def!.keepRatio).toBe(true);
      expect(def!.enabledAnchors).toEqual(CORNER_ANCHORS);
    });
  });

  // -----------------------------------------------------------------------
  // Multi-selection
  // -----------------------------------------------------------------------

  describe('multi-selection', () => {
    it('uses merged definition for two shapes', () => {
      manager.updateForElements([rectShape, circleShape]);
      const def = manager.getDefinition();
      expect(def).not.toBeNull();
      expect(def!.handleType).toBe('bounding-box');
      expect(def!.keepRatio).toBe(false);
      expect(def!.rotateEnabled).toBe(false);
      expect(def!.enabledAnchors).toEqual(ALL_ANCHORS);
    });

    it('uses merged definition for mixed element types', () => {
      manager.updateForElements([rectShape, textEl, lineEl]);
      const def = manager.getDefinition();
      expect(def).not.toBeNull();
      expect(def!.handleType).toBe('bounding-box');
      expect(def!.keepRatio).toBe(false);
      expect(def!.rotateEnabled).toBe(false);
      expect(def!.enabledAnchors).toEqual(ALL_ANCHORS);
    });

    it('uses merged definition for shape + edge', () => {
      manager.updateForElements([rectShape, edgeEl]);
      const def = manager.getDefinition();
      expect(def).not.toBeNull();
      expect(def!.handleType).toBe('bounding-box');
      expect(def!.rotateEnabled).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // No selection
  // -----------------------------------------------------------------------

  describe('no selection', () => {
    it('returns null definition for empty array', () => {
      manager.updateForElements([]);
      expect(manager.getDefinition()).toBeNull();
    });

    it('returns "none" for getActiveHandleType when nothing is selected', () => {
      manager.updateForElements([]);
      expect(manager.getActiveHandleType()).toBe('none');
    });
  });

  // -----------------------------------------------------------------------
  // Handle change events
  // -----------------------------------------------------------------------

  describe('handle change events', () => {
    it('fires onHandleChange on updateForElements', () => {
      const handler = vi.fn();
      manager.onHandleChange(handler);
      manager.updateForElements([rectShape]);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        handleType: 'bounding-box',
      }));
    });

    it('fires onHandleChange with null on hideHandles', () => {
      const handler = vi.fn();
      manager.onHandleChange(handler);
      manager.updateForElements([rectShape]);
      handler.mockClear();
      manager.hideHandles();
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(null);
    });

    it('unsubscribe stops notifications', () => {
      const handler = vi.fn();
      const unsub = manager.onHandleChange(handler);
      unsub();
      manager.updateForElements([rectShape]);
      expect(handler).not.toHaveBeenCalled();
    });

    it('constructor option receives change events', () => {
      const handler = vi.fn();
      const mgr = new HandleManager({ onHandleChange: handler });
      mgr.updateForElements([textEl]);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        handleType: 'bounding-box',
        rotateEnabled: false,
      }));
    });

    it('fires on transition from single to multi-select', () => {
      const handler = vi.fn();
      manager.onHandleChange(handler);

      manager.updateForElements([rectShape]);
      expect(handler).toHaveBeenCalledTimes(1);

      manager.updateForElements([rectShape, circleShape]);
      expect(handler).toHaveBeenCalledTimes(2);
      const secondCall = handler.mock.calls[1][0];
      expect(secondCall.rotateEnabled).toBe(false);
      expect(secondCall.keepRatio).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // hideHandles
  // -----------------------------------------------------------------------

  describe('hideHandles', () => {
    it('sets definition to null', () => {
      manager.updateForElements([rectShape]);
      expect(manager.getDefinition()).not.toBeNull();
      manager.hideHandles();
      expect(manager.getDefinition()).toBeNull();
    });

    it('returns "none" for getActiveHandleType after hide', () => {
      manager.updateForElements([rectShape]);
      expect(manager.getActiveHandleType()).toBe('bounding-box');
      manager.hideHandles();
      expect(manager.getActiveHandleType()).toBe('none');
    });
  });

  // -----------------------------------------------------------------------
  // getElements
  // -----------------------------------------------------------------------

  describe('getElements', () => {
    it('returns the current elements after update', () => {
      manager.updateForElements([rectShape, textEl]);
      const elements = manager.getElements();
      expect(elements).toHaveLength(2);
      expect(elements[0].id).toBe('s1');
      expect(elements[1].id).toBe('t1');
    });

    it('returns empty array after hideHandles', () => {
      manager.updateForElements([rectShape]);
      manager.hideHandles();
      expect(manager.getElements()).toEqual([]);
    });

    it('returns a copy, not the internal array', () => {
      manager.updateForElements([rectShape]);
      const elements1 = manager.getElements();
      const elements2 = manager.getElements();
      expect(elements1).toEqual(elements2);
      expect(elements1).not.toBe(elements2);
    });
  });

  // -----------------------------------------------------------------------
  // getActiveHandleType
  // -----------------------------------------------------------------------

  describe('getActiveHandleType', () => {
    it('returns correct type for single shape', () => {
      manager.updateForElements([rectShape]);
      expect(manager.getActiveHandleType()).toBe('bounding-box');
    });

    it('returns correct type for line', () => {
      manager.updateForElements([lineEl]);
      expect(manager.getActiveHandleType()).toBe('endpoint');
    });

    it('returns correct type for edge', () => {
      manager.updateForElements([edgeEl]);
      expect(manager.getActiveHandleType()).toBe('connector');
    });

    it('returns "none" when no selection', () => {
      expect(manager.getActiveHandleType()).toBe('none');
    });
  });

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  describe('lifecycle', () => {
    it('destroy clears state', () => {
      manager.updateForElements([rectShape]);
      manager.destroy();
      expect(manager.getDefinition()).toBeNull();
      expect(manager.getElements()).toEqual([]);
      expect(manager.getActiveHandleType()).toBe('none');
    });

    it('destroy prevents further notifications', () => {
      const handler = vi.fn();
      manager.onHandleChange(handler);
      manager.destroy();

      // After destroy, updating should not fire the handler
      // because handlers were cleared by destroy.
      // We need to manually call notify — but since it's private,
      // we test indirectly by checking no handlers fire.
      // Note: updateForElements still works but no listeners remain.
      manager.updateForElements([rectShape]);
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
