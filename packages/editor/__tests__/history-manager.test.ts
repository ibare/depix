import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  HistoryManager,
  HistoryAction,
  createPropertyAction,
  createAddAction,
  createDeleteAction,
} from '../src/history-manager.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a simple action whose execute/undo call the given spies. */
function makeAction(
  overrides: Partial<HistoryAction> = {},
): HistoryAction & { executeSpy: ReturnType<typeof vi.fn>; undoSpy: ReturnType<typeof vi.fn> } {
  const executeSpy = vi.fn();
  const undoSpy = vi.fn();
  return {
    label: overrides.label ?? 'test action',
    execute: overrides.execute ?? executeSpy,
    undo: overrides.undo ?? undoSpy,
    mergeKey: overrides.mergeKey,
    executeSpy,
    undoSpy,
  };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('HistoryManager', () => {
  // -------------------------------------------------------------------------
  // Basic undo/redo
  // -------------------------------------------------------------------------
  describe('basic undo/redo', () => {
    let hm: HistoryManager;

    beforeEach(() => {
      hm = new HistoryManager();
    });

    it('executes the action immediately on push', () => {
      const action = makeAction();
      hm.push(action);
      expect(action.executeSpy).toHaveBeenCalledTimes(1);
    });

    it('can undo a pushed action', () => {
      const action = makeAction();
      hm.push(action);
      const result = hm.undo();
      expect(result).toBe(true);
      expect(action.undoSpy).toHaveBeenCalledTimes(1);
    });

    it('can redo an undone action', () => {
      const action = makeAction();
      hm.push(action);
      hm.undo();
      const result = hm.redo();
      expect(result).toBe(true);
      // execute called once on push + once on redo
      expect(action.executeSpy).toHaveBeenCalledTimes(2);
    });

    it('tracks canUndo correctly after push and undo', () => {
      expect(hm.canUndo()).toBe(false);
      const action = makeAction();
      hm.push(action);
      expect(hm.canUndo()).toBe(true);
      hm.undo();
      expect(hm.canUndo()).toBe(false);
    });

    it('tracks canRedo correctly after undo and redo', () => {
      expect(hm.canRedo()).toBe(false);
      const action = makeAction();
      hm.push(action);
      expect(hm.canRedo()).toBe(false);
      hm.undo();
      expect(hm.canRedo()).toBe(true);
      hm.redo();
      expect(hm.canRedo()).toBe(false);
    });

    it('returns correct state after push', () => {
      hm.push(makeAction());
      const state = hm.getState();
      expect(state).toEqual({
        undoCount: 1,
        redoCount: 0,
        canUndo: true,
        canRedo: false,
      });
    });

    it('returns correct state after undo', () => {
      hm.push(makeAction());
      hm.undo();
      const state = hm.getState();
      expect(state).toEqual({
        undoCount: 0,
        redoCount: 1,
        canUndo: false,
        canRedo: true,
      });
    });

    it('handles multiple pushes, undos, and redos', () => {
      const a1 = makeAction({ label: 'a1' });
      const a2 = makeAction({ label: 'a2' });
      const a3 = makeAction({ label: 'a3' });

      hm.push(a1);
      hm.push(a2);
      hm.push(a3);

      expect(hm.getState().undoCount).toBe(3);

      hm.undo(); // undo a3
      hm.undo(); // undo a2
      expect(a3.undoSpy).toHaveBeenCalledTimes(1);
      expect(a2.undoSpy).toHaveBeenCalledTimes(1);
      expect(hm.getState().undoCount).toBe(1);
      expect(hm.getState().redoCount).toBe(2);

      hm.redo(); // redo a2
      expect(a2.executeSpy).toHaveBeenCalledTimes(2);
      expect(hm.getState().undoCount).toBe(2);
      expect(hm.getState().redoCount).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Stack management
  // -------------------------------------------------------------------------
  describe('stack management', () => {
    it('enforces maxHistory limit', () => {
      const hm = new HistoryManager({ maxHistory: 3 });
      for (let i = 0; i < 5; i++) {
        hm.push(makeAction({ label: `action-${i}` }));
      }
      expect(hm.getState().undoCount).toBe(3);
    });

    it('clears redo stack on new push', () => {
      const hm = new HistoryManager();
      hm.push(makeAction());
      hm.push(makeAction());
      hm.undo();
      expect(hm.canRedo()).toBe(true);
      hm.push(makeAction());
      expect(hm.canRedo()).toBe(false);
      expect(hm.getState().redoCount).toBe(0);
    });

    it('clear() empties both stacks', () => {
      const hm = new HistoryManager();
      hm.push(makeAction());
      hm.push(makeAction());
      hm.undo();
      hm.clear();
      expect(hm.getState()).toEqual({
        undoCount: 0,
        redoCount: 0,
        canUndo: false,
        canRedo: false,
      });
    });

    it('empty undo stack returns false on undo', () => {
      const hm = new HistoryManager();
      expect(hm.undo()).toBe(false);
    });

    it('empty redo stack returns false on redo', () => {
      const hm = new HistoryManager();
      expect(hm.redo()).toBe(false);
    });

    it('maxHistory discards oldest entries first', () => {
      const hm = new HistoryManager({ maxHistory: 2 });

      let counter = 0;
      const a1 = makeAction({
        label: 'a1',
        undo: () => { counter = 1; },
      });
      const a2 = makeAction({
        label: 'a2',
        undo: () => { counter = 2; },
      });
      const a3 = makeAction({
        label: 'a3',
        undo: () => { counter = 3; },
      });

      hm.push(a1);
      hm.push(a2);
      hm.push(a3); // a1 should be discarded

      // Undo twice — should only reach a2, not a1
      hm.undo(); // undo a3
      expect(counter).toBe(3);
      hm.undo(); // undo a2
      expect(counter).toBe(2);
      expect(hm.undo()).toBe(false); // no more
    });
  });

  // -------------------------------------------------------------------------
  // Action merging
  // -------------------------------------------------------------------------
  describe('action merging', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('merges actions with the same mergeKey within timeout', () => {
      const hm = new HistoryManager({ mergeTimeout: 300 });
      let value = 0;

      hm.push({
        label: 'set 1',
        execute: () => { value = 1; },
        undo: () => { value = 0; },
        mergeKey: 'color',
      });
      expect(value).toBe(1);

      vi.advanceTimersByTime(100); // 100ms < 300ms

      hm.push({
        label: 'set 2',
        execute: () => { value = 2; },
        undo: () => { value = 999; }, // this undo should NOT be kept
        mergeKey: 'color',
      });
      expect(value).toBe(2);

      // Only one entry in the undo stack
      expect(hm.getState().undoCount).toBe(1);

      // Undo should call the ORIGINAL undo (value → 0)
      hm.undo();
      expect(value).toBe(0);
    });

    it('does not merge actions with different mergeKeys', () => {
      const hm = new HistoryManager({ mergeTimeout: 300 });

      hm.push({
        label: 'color change',
        execute: () => {},
        undo: () => {},
        mergeKey: 'color',
      });

      hm.push({
        label: 'size change',
        execute: () => {},
        undo: () => {},
        mergeKey: 'size',
      });

      expect(hm.getState().undoCount).toBe(2);
    });

    it('does not merge actions after timeout expires', () => {
      const hm = new HistoryManager({ mergeTimeout: 300 });

      hm.push({
        label: 'set 1',
        execute: () => {},
        undo: () => {},
        mergeKey: 'color',
      });

      vi.advanceTimersByTime(500); // 500ms > 300ms

      hm.push({
        label: 'set 2',
        execute: () => {},
        undo: () => {},
        mergeKey: 'color',
      });

      expect(hm.getState().undoCount).toBe(2);
    });

    it('preserves original undo through multiple merges', () => {
      const hm = new HistoryManager({ mergeTimeout: 300 });
      let value = 'initial';

      hm.push({
        label: 'set A',
        execute: () => { value = 'A'; },
        undo: () => { value = 'initial'; },
        mergeKey: 'text',
      });

      vi.advanceTimersByTime(100);

      hm.push({
        label: 'set B',
        execute: () => { value = 'B'; },
        undo: () => { value = 'A'; }, // should NOT be used
        mergeKey: 'text',
      });

      vi.advanceTimersByTime(100);

      hm.push({
        label: 'set C',
        execute: () => { value = 'C'; },
        undo: () => { value = 'B'; }, // should NOT be used
        mergeKey: 'text',
      });

      expect(value).toBe('C');
      expect(hm.getState().undoCount).toBe(1);

      hm.undo();
      expect(value).toBe('initial'); // original undo
    });

    it('does not merge when the previous action has no mergeKey', () => {
      const hm = new HistoryManager({ mergeTimeout: 300 });

      hm.push({
        label: 'no key',
        execute: () => {},
        undo: () => {},
      });

      hm.push({
        label: 'has key',
        execute: () => {},
        undo: () => {},
        mergeKey: 'color',
      });

      expect(hm.getState().undoCount).toBe(2);
    });

    it('clears redo stack even when merging', () => {
      const hm = new HistoryManager({ mergeTimeout: 300 });

      hm.push({
        label: 'a1',
        execute: () => {},
        undo: () => {},
        mergeKey: 'color',
      });

      // Create a redo entry via pushing something else, then undoing
      hm.push({
        label: 'other',
        execute: () => {},
        undo: () => {},
      });
      hm.undo();
      expect(hm.canRedo()).toBe(true);

      // Now push with the same mergeKey — should still clear redo
      // (won't actually merge because last undo entry has no matching mergeKey)
      hm.push({
        label: 'a2',
        execute: () => {},
        undo: () => {},
        mergeKey: 'color',
      });
      expect(hm.canRedo()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Change listeners
  // -------------------------------------------------------------------------
  describe('change listeners', () => {
    it('fires onChange on push', () => {
      const hm = new HistoryManager();
      const handler = vi.fn();
      hm.onChange(handler);
      hm.push(makeAction());
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        undoCount: 1,
        redoCount: 0,
        canUndo: true,
        canRedo: false,
      });
    });

    it('fires onChange on undo and redo', () => {
      const hm = new HistoryManager();
      const handler = vi.fn();
      hm.push(makeAction());
      hm.onChange(handler);

      hm.undo();
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenLastCalledWith({
        undoCount: 0,
        redoCount: 1,
        canUndo: false,
        canRedo: true,
      });

      hm.redo();
      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenLastCalledWith({
        undoCount: 1,
        redoCount: 0,
        canUndo: true,
        canRedo: false,
      });
    });

    it('fires onChange on clear', () => {
      const hm = new HistoryManager();
      hm.push(makeAction());
      const handler = vi.fn();
      hm.onChange(handler);
      hm.clear();
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        undoCount: 0,
        redoCount: 0,
        canUndo: false,
        canRedo: false,
      });
    });

    it('unsubscribe removes the listener', () => {
      const hm = new HistoryManager();
      const handler = vi.fn();
      const unsub = hm.onChange(handler);
      unsub();
      hm.push(makeAction());
      expect(handler).not.toHaveBeenCalled();
    });

    it('supports multiple listeners', () => {
      const hm = new HistoryManager();
      const h1 = vi.fn();
      const h2 = vi.fn();
      hm.onChange(h1);
      hm.onChange(h2);
      hm.push(makeAction());
      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Helper: createPropertyAction
  // -------------------------------------------------------------------------
  describe('createPropertyAction', () => {
    it('changes the target property on execute', () => {
      const obj = { color: 'red', size: 10 };
      const action = createPropertyAction(obj, 'color', 'blue');
      action.execute();
      expect(obj.color).toBe('blue');
    });

    it('restores the target property on undo', () => {
      const obj = { color: 'red', size: 10 };
      const action = createPropertyAction(obj, 'color', 'blue');
      action.execute();
      action.undo();
      expect(obj.color).toBe('red');
    });

    it('uses a default label when none provided', () => {
      const obj = { x: 0 };
      const action = createPropertyAction(obj, 'x', 42);
      expect(action.label).toBe('Change x');
    });

    it('uses a custom label when provided', () => {
      const obj = { x: 0 };
      const action = createPropertyAction(obj, 'x', 42, 'Move element');
      expect(action.label).toBe('Move element');
    });
  });

  // -------------------------------------------------------------------------
  // Helper: createAddAction
  // -------------------------------------------------------------------------
  describe('createAddAction', () => {
    it('appends an item to the end when no index given', () => {
      const arr = ['a', 'b'];
      const action = createAddAction(arr, 'c');
      action.execute();
      expect(arr).toEqual(['a', 'b', 'c']);
    });

    it('inserts an item at the specified index', () => {
      const arr = ['a', 'c'];
      const action = createAddAction(arr, 'b', 1);
      action.execute();
      expect(arr).toEqual(['a', 'b', 'c']);
    });

    it('removes the item on undo', () => {
      const arr = ['a', 'b'];
      const action = createAddAction(arr, 'c');
      action.execute();
      action.undo();
      expect(arr).toEqual(['a', 'b']);
    });

    it('uses a default label', () => {
      const action = createAddAction([], 'x');
      expect(action.label).toBe('Add item');
    });

    it('uses a custom label', () => {
      const action = createAddAction([], 'x', undefined, 'Add node');
      expect(action.label).toBe('Add node');
    });
  });

  // -------------------------------------------------------------------------
  // Helper: createDeleteAction
  // -------------------------------------------------------------------------
  describe('createDeleteAction', () => {
    it('removes the item at the specified index', () => {
      const arr = ['a', 'b', 'c'];
      const action = createDeleteAction(arr, 1);
      action.execute();
      expect(arr).toEqual(['a', 'c']);
    });

    it('restores the item at the same index on undo', () => {
      const arr = ['a', 'b', 'c'];
      const action = createDeleteAction(arr, 1);
      action.execute();
      action.undo();
      expect(arr).toEqual(['a', 'b', 'c']);
    });

    it('uses a default label', () => {
      const action = createDeleteAction(['x'], 0);
      expect(action.label).toBe('Delete item');
    });

    it('uses a custom label', () => {
      const action = createDeleteAction(['x'], 0, 'Remove element');
      expect(action.label).toBe('Remove element');
    });
  });

  // -------------------------------------------------------------------------
  // Integration with HistoryManager + helpers
  // -------------------------------------------------------------------------
  describe('helpers integrated with HistoryManager', () => {
    it('property action round-trips through push/undo/redo', () => {
      const hm = new HistoryManager();
      const obj = { x: 10 };
      hm.push(createPropertyAction(obj, 'x', 50));
      expect(obj.x).toBe(50);
      hm.undo();
      expect(obj.x).toBe(10);
      hm.redo();
      expect(obj.x).toBe(50);
    });

    it('add action round-trips through push/undo/redo', () => {
      const hm = new HistoryManager();
      const arr = [1, 2];
      hm.push(createAddAction(arr, 3));
      expect(arr).toEqual([1, 2, 3]);
      hm.undo();
      expect(arr).toEqual([1, 2]);
      hm.redo();
      expect(arr).toEqual([1, 2, 3]);
    });

    it('delete action round-trips through push/undo/redo', () => {
      const hm = new HistoryManager();
      const arr = ['a', 'b', 'c'];
      hm.push(createDeleteAction(arr, 1));
      expect(arr).toEqual(['a', 'c']);
      hm.undo();
      expect(arr).toEqual(['a', 'b', 'c']);
      hm.redo();
      expect(arr).toEqual(['a', 'c']);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('undo on empty stack returns false and calls no callbacks', () => {
      const hm = new HistoryManager();
      const handler = vi.fn();
      hm.onChange(handler);
      const result = hm.undo();
      expect(result).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });

    it('redo on empty stack returns false and calls no callbacks', () => {
      const hm = new HistoryManager();
      const handler = vi.fn();
      hm.onChange(handler);
      const result = hm.redo();
      expect(result).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });

    it('destroy clears everything and prevents further notifications', () => {
      const hm = new HistoryManager();
      const handler = vi.fn();
      hm.onChange(handler);
      hm.push(makeAction());
      handler.mockClear();

      hm.destroy();

      expect(hm.getState()).toEqual({
        undoCount: 0,
        redoCount: 0,
        canUndo: false,
        canRedo: false,
      });

      // Listener should have been removed — push after destroy should not notify
      hm.push(makeAction());
      expect(handler).not.toHaveBeenCalled();
    });

    it('defaults are maxHistory=100 and mergeTimeout=300', () => {
      vi.useFakeTimers();
      const hm = new HistoryManager();

      // Push 110 actions — only 100 should remain
      for (let i = 0; i < 110; i++) {
        hm.push(makeAction({ label: `action-${i}` }));
      }
      expect(hm.getState().undoCount).toBe(100);

      vi.useRealTimers();
    });
  });
});
