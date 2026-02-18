import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DepixIR, IRShape } from '@depix/core';
import {
  SelectionManager,
  type SelectionState,
} from '../src/selection-manager.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal IRShape element for testing.
 */
function makeShape(id: string): IRShape {
  return {
    id,
    type: 'shape',
    shape: 'rect',
    bounds: { x: 0, y: 0, w: 10, h: 10 },
    style: { fill: '#000000' },
  };
}

/**
 * Create a minimal DepixIR document with the given elements in a single scene.
 */
function makeIR(elements: IRShape[]): DepixIR {
  return {
    meta: {
      aspectRatio: { width: 16, height: 9 },
      background: { type: 'solid', color: '#ffffff' },
      drawingStyle: 'default',
    },
    scenes: [
      {
        id: 'scene-1',
        elements,
      },
    ],
    transitions: [],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SelectionManager', () => {
  let manager: SelectionManager;

  beforeEach(() => {
    manager = new SelectionManager();
  });

  // -----------------------------------------------------------------------
  // Single selection
  // -----------------------------------------------------------------------

  describe('single selection', () => {
    it('should select a single element', () => {
      manager.select('el-1');
      expect(manager.getSelectedIds()).toEqual(['el-1']);
    });

    it('should replace the previous selection when selecting without append', () => {
      manager.select('el-1');
      manager.select('el-2');
      expect(manager.getSelectedIds()).toEqual(['el-2']);
    });

    it('should report isSelected correctly', () => {
      manager.select('el-1');
      expect(manager.isSelected('el-1')).toBe(true);
      expect(manager.isSelected('el-2')).toBe(false);
    });

    it('should return selected IDs as an array', () => {
      manager.select('el-1');
      const ids = manager.getSelectedIds();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids).toEqual(['el-1']);
    });

    it('should return the primary selection', () => {
      manager.select('el-1');
      expect(manager.getPrimarySelection()).toBe('el-1');
    });

    it('should return null for primary selection when nothing is selected', () => {
      expect(manager.getPrimarySelection()).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Multi-selection
  // -----------------------------------------------------------------------

  describe('multi-selection', () => {
    it('should add to selection with append=true', () => {
      manager.select('el-1');
      manager.select('el-2', true);
      expect(manager.getSelectedIds()).toEqual(['el-1', 'el-2']);
    });

    it('should set all IDs with selectMultiple', () => {
      manager.selectMultiple(['el-1', 'el-2', 'el-3']);
      expect(manager.getSelectedIds()).toEqual(['el-1', 'el-2', 'el-3']);
    });

    it('should replace current selection with selectMultiple', () => {
      manager.select('el-0');
      manager.selectMultiple(['el-1', 'el-2']);
      expect(manager.getSelectedIds()).toEqual(['el-1', 'el-2']);
      expect(manager.isSelected('el-0')).toBe(false);
    });

    it('should toggle selection: add when not selected', () => {
      manager.toggleSelection('el-1');
      expect(manager.isSelected('el-1')).toBe(true);
    });

    it('should toggle selection: remove when already selected', () => {
      manager.select('el-1');
      manager.toggleSelection('el-1');
      expect(manager.isSelected('el-1')).toBe(false);
    });

    it('should report correct selection count', () => {
      expect(manager.getSelectionCount()).toBe(0);
      manager.selectMultiple(['el-1', 'el-2', 'el-3']);
      expect(manager.getSelectionCount()).toBe(3);
    });

    it('should preserve insertion order with append selects', () => {
      manager.select('el-3');
      manager.select('el-1', true);
      manager.select('el-2', true);
      expect(manager.getSelectedIds()).toEqual(['el-3', 'el-1', 'el-2']);
      expect(manager.getPrimarySelection()).toBe('el-3');
    });
  });

  // -----------------------------------------------------------------------
  // Deselect
  // -----------------------------------------------------------------------

  describe('deselect', () => {
    it('should remove an element from the selection', () => {
      manager.selectMultiple(['el-1', 'el-2', 'el-3']);
      manager.deselect('el-2');
      expect(manager.getSelectedIds()).toEqual(['el-1', 'el-3']);
    });

    it('should be a no-op when deselecting a non-selected element', () => {
      const handler = vi.fn();
      manager.onChange(handler);
      manager.select('el-1');
      handler.mockClear();

      manager.deselect('el-99');
      expect(handler).not.toHaveBeenCalled();
      expect(manager.getSelectedIds()).toEqual(['el-1']);
    });

    it('should clear all selections with clearSelection', () => {
      manager.selectMultiple(['el-1', 'el-2']);
      manager.clearSelection();
      expect(manager.getSelectedIds()).toEqual([]);
      expect(manager.getSelectionCount()).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Hover
  // -----------------------------------------------------------------------

  describe('hover', () => {
    it('should set the hovered element', () => {
      manager.setHovered('el-1');
      expect(manager.getHoveredId()).toBe('el-1');
    });

    it('should return null when no element is hovered', () => {
      expect(manager.getHoveredId()).toBeNull();
    });

    it('should clear hover with null', () => {
      manager.setHovered('el-1');
      manager.setHovered(null);
      expect(manager.getHoveredId()).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Change events
  // -----------------------------------------------------------------------

  describe('change events', () => {
    it('should fire onChange on select', () => {
      const handler = vi.fn();
      manager.onChange(handler);

      manager.select('el-1');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith<[SelectionState]>({
        selectedIds: ['el-1'],
        hoveredId: null,
      });
    });

    it('should fire onChange on deselect', () => {
      manager.select('el-1');
      const handler = vi.fn();
      manager.onChange(handler);

      manager.deselect('el-1');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith<[SelectionState]>({
        selectedIds: [],
        hoveredId: null,
      });
    });

    it('should fire onChange on clearSelection', () => {
      manager.selectMultiple(['el-1', 'el-2']);
      const handler = vi.fn();
      manager.onChange(handler);

      manager.clearSelection();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith<[SelectionState]>({
        selectedIds: [],
        hoveredId: null,
      });
    });

    it('should fire onChange on hover change', () => {
      const handler = vi.fn();
      manager.onChange(handler);

      manager.setHovered('el-1');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith<[SelectionState]>({
        selectedIds: [],
        hoveredId: 'el-1',
      });
    });

    it('should stop notifications after unsubscribe', () => {
      const handler = vi.fn();
      const unsubscribe = manager.onChange(handler);

      manager.select('el-1');
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      manager.select('el-2');
      expect(handler).toHaveBeenCalledTimes(1); // not called again
    });

    it('should support multiple change handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      manager.onChange(handler1);
      manager.onChange(handler2);

      manager.select('el-1');

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should fire onChange on toggleSelection', () => {
      const handler = vi.fn();
      manager.onChange(handler);

      manager.toggleSelection('el-1');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith<[SelectionState]>({
        selectedIds: ['el-1'],
        hoveredId: null,
      });
    });
  });

  // -----------------------------------------------------------------------
  // Drag/Transform events
  // -----------------------------------------------------------------------

  describe('drag/transform events', () => {
    it('should register and fire drag end handlers', () => {
      const handler = vi.fn();
      manager.onDragEnd(handler);

      manager.emitDragEnd('el-1', 5, 10);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith('el-1', 5, 10);
    });

    it('should unsubscribe drag end handler', () => {
      const handler = vi.fn();
      const unsubscribe = manager.onDragEnd(handler);

      unsubscribe();
      manager.emitDragEnd('el-1', 5, 10);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should register and fire transform end handlers', () => {
      const handler = vi.fn();
      manager.onTransformEnd(handler);

      const newBounds = { x: 10, y: 20, w: 30, h: 40 };
      manager.emitTransformEnd('el-1', newBounds);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith('el-1', newBounds);
    });

    it('should unsubscribe transform end handler', () => {
      const handler = vi.fn();
      const unsubscribe = manager.onTransformEnd(handler);

      unsubscribe();
      manager.emitTransformEnd('el-1', { x: 0, y: 0, w: 10, h: 10 });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should support multiple drag end handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      manager.onDragEnd(handler1);
      manager.onDragEnd(handler2);

      manager.emitDragEnd('el-1', 3, 7);

      expect(handler1).toHaveBeenCalledWith('el-1', 3, 7);
      expect(handler2).toHaveBeenCalledWith('el-1', 3, 7);
    });
  });

  // -----------------------------------------------------------------------
  // Element lookup
  // -----------------------------------------------------------------------

  describe('element lookup', () => {
    it('should return selected IR elements from the document', () => {
      const shape1 = makeShape('el-1');
      const shape2 = makeShape('el-2');
      const ir = makeIR([shape1, shape2]);

      manager.selectMultiple(['el-1', 'el-2']);

      const elements = manager.getSelectedElements(ir);
      expect(elements).toHaveLength(2);
      expect(elements[0]).toBe(shape1);
      expect(elements[1]).toBe(shape2);
    });

    it('should filter out elements that are not found in the IR', () => {
      const shape1 = makeShape('el-1');
      const ir = makeIR([shape1]);

      manager.selectMultiple(['el-1', 'el-missing']);

      const elements = manager.getSelectedElements(ir);
      expect(elements).toHaveLength(1);
      expect(elements[0]).toBe(shape1);
    });

    it('should return an empty array when nothing is selected', () => {
      const ir = makeIR([makeShape('el-1')]);
      expect(manager.getSelectedElements(ir)).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // State snapshot
  // -----------------------------------------------------------------------

  describe('getState', () => {
    it('should return a state snapshot with selectedIds and hoveredId', () => {
      manager.select('el-1');
      manager.select('el-2', true);
      manager.setHovered('el-3');

      const state = manager.getState();
      expect(state).toEqual({
        selectedIds: ['el-1', 'el-2'],
        hoveredId: 'el-3',
      });
    });

    it('should return independent copies of the selectedIds array', () => {
      manager.select('el-1');
      const state1 = manager.getState();
      const state2 = manager.getState();
      expect(state1.selectedIds).not.toBe(state2.selectedIds);
      expect(state1.selectedIds).toEqual(state2.selectedIds);
    });
  });

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  describe('lifecycle', () => {
    it('should clear all state and handlers on destroy', () => {
      const changeHandler = vi.fn();
      const dragHandler = vi.fn();
      const transformHandler = vi.fn();

      manager.onChange(changeHandler);
      manager.onDragEnd(dragHandler);
      manager.onTransformEnd(transformHandler);
      manager.select('el-1');
      manager.setHovered('el-2');

      changeHandler.mockClear();

      manager.destroy();

      // State is cleared
      expect(manager.getSelectedIds()).toEqual([]);
      expect(manager.getHoveredId()).toBeNull();
      expect(manager.getSelectionCount()).toBe(0);

      // Handlers are removed — no notifications after destroy
      manager.select('el-3');
      expect(changeHandler).not.toHaveBeenCalled();

      manager.emitDragEnd('el-1', 1, 1);
      expect(dragHandler).not.toHaveBeenCalled();

      manager.emitTransformEnd('el-1', { x: 0, y: 0, w: 1, h: 1 });
      expect(transformHandler).not.toHaveBeenCalled();
    });

    it('should accept an onChange option in the constructor', () => {
      const handler = vi.fn();
      const mgr = new SelectionManager({ onChange: handler });

      mgr.select('el-1');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith<[SelectionState]>({
        selectedIds: ['el-1'],
        hoveredId: null,
      });
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('should not duplicate when selecting the same element twice', () => {
      manager.select('el-1');
      manager.select('el-1', true);
      expect(manager.getSelectedIds()).toEqual(['el-1']);
      expect(manager.getSelectionCount()).toBe(1);
    });

    it('should not fire change event when deselecting from empty selection', () => {
      const handler = vi.fn();
      manager.onChange(handler);

      manager.deselect('el-1');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should not fire change event when clearing an empty selection', () => {
      const handler = vi.fn();
      manager.onChange(handler);

      manager.clearSelection();

      expect(handler).not.toHaveBeenCalled();
    });

    it('should not fire change event when setting hover to the same value', () => {
      manager.setHovered('el-1');
      const handler = vi.fn();
      manager.onChange(handler);

      manager.setHovered('el-1');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should not fire change event when setting hover to null when already null', () => {
      const handler = vi.fn();
      manager.onChange(handler);

      manager.setHovered(null);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle selectMultiple with empty array', () => {
      manager.select('el-1');
      const handler = vi.fn();
      manager.onChange(handler);

      manager.selectMultiple([]);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(manager.getSelectedIds()).toEqual([]);
    });

    it('should handle selectMultiple with duplicate IDs', () => {
      manager.selectMultiple(['el-1', 'el-1', 'el-2']);
      expect(manager.getSelectedIds()).toEqual(['el-1', 'el-2']);
      expect(manager.getSelectionCount()).toBe(2);
    });
  });
});
