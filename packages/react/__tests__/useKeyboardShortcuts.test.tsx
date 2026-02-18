/**
 * useKeyboardShortcuts Tests
 *
 * Tests keyboard shortcut handling including undo/redo, clipboard operations,
 * tool switching, Mac/Windows compatibility, input element suppression,
 * enabled/disabled state, and cleanup.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

import {
  useKeyboardShortcuts,
  type UseKeyboardShortcutsOptions,
} from '../src/hooks/useKeyboardShortcuts.js';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

function ShortcutHarness(props: { options?: UseKeyboardShortcutsOptions }) {
  useKeyboardShortcuts(props.options);
  return <div data-testid="harness" />;
}

/**
 * Dispatch a keyboard event on the window.
 */
function pressKey(opts: {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  target?: EventTarget;
}) {
  const event = new KeyboardEvent('keydown', {
    key: opts.key,
    ctrlKey: opts.ctrlKey ?? false,
    metaKey: opts.metaKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    altKey: opts.altKey ?? false,
    bubbles: true,
    cancelable: true,
  });

  // Override target if specified
  if (opts.target) {
    Object.defineProperty(event, 'target', {
      value: opts.target,
      writable: false,
    });
  }

  act(() => {
    window.dispatchEvent(event);
  });

  return event;
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

describe('useKeyboardShortcuts', () => {
  // ---- Undo / Redo --------------------------------------------------------

  describe('undo/redo', () => {
    it('calls onUndo on Ctrl+Z', () => {
      const onUndo = vi.fn();
      render(<ShortcutHarness options={{ onUndo }} />);

      pressKey({ key: 'z', ctrlKey: true });

      expect(onUndo).toHaveBeenCalledOnce();
    });

    it('calls onUndo on Cmd+Z (Mac)', () => {
      const onUndo = vi.fn();
      render(<ShortcutHarness options={{ onUndo }} />);

      pressKey({ key: 'z', metaKey: true });

      expect(onUndo).toHaveBeenCalledOnce();
    });

    it('calls onRedo on Ctrl+Shift+Z', () => {
      const onRedo = vi.fn();
      render(<ShortcutHarness options={{ onRedo }} />);

      pressKey({ key: 'z', ctrlKey: true, shiftKey: true });

      expect(onRedo).toHaveBeenCalledOnce();
    });

    it('calls onRedo on Cmd+Shift+Z (Mac)', () => {
      const onRedo = vi.fn();
      render(<ShortcutHarness options={{ onRedo }} />);

      pressKey({ key: 'z', metaKey: true, shiftKey: true });

      expect(onRedo).toHaveBeenCalledOnce();
    });

    it('calls onRedo on Ctrl+Y', () => {
      const onRedo = vi.fn();
      render(<ShortcutHarness options={{ onRedo }} />);

      pressKey({ key: 'y', ctrlKey: true });

      expect(onRedo).toHaveBeenCalledOnce();
    });

    it('does not call onUndo when Ctrl+Shift+Z is pressed (calls onRedo instead)', () => {
      const onUndo = vi.fn();
      const onRedo = vi.fn();
      render(<ShortcutHarness options={{ onUndo, onRedo }} />);

      pressKey({ key: 'z', ctrlKey: true, shiftKey: true });

      expect(onUndo).not.toHaveBeenCalled();
      expect(onRedo).toHaveBeenCalledOnce();
    });
  });

  // ---- Delete -------------------------------------------------------------

  describe('delete', () => {
    it('calls onDelete on Delete key', () => {
      const onDelete = vi.fn();
      render(<ShortcutHarness options={{ onDelete }} />);

      pressKey({ key: 'Delete' });

      expect(onDelete).toHaveBeenCalledOnce();
    });

    it('calls onDelete on Backspace key', () => {
      const onDelete = vi.fn();
      render(<ShortcutHarness options={{ onDelete }} />);

      pressKey({ key: 'Backspace' });

      expect(onDelete).toHaveBeenCalledOnce();
    });
  });

  // ---- Select All ---------------------------------------------------------

  describe('select all', () => {
    it('calls onSelectAll on Ctrl+A', () => {
      const onSelectAll = vi.fn();
      render(<ShortcutHarness options={{ onSelectAll }} />);

      pressKey({ key: 'a', ctrlKey: true });

      expect(onSelectAll).toHaveBeenCalledOnce();
    });

    it('calls onSelectAll on Cmd+A (Mac)', () => {
      const onSelectAll = vi.fn();
      render(<ShortcutHarness options={{ onSelectAll }} />);

      pressKey({ key: 'a', metaKey: true });

      expect(onSelectAll).toHaveBeenCalledOnce();
    });
  });

  // ---- Clipboard ----------------------------------------------------------

  describe('clipboard operations', () => {
    it('calls onCopy on Ctrl+C', () => {
      const onCopy = vi.fn();
      render(<ShortcutHarness options={{ onCopy }} />);

      pressKey({ key: 'c', ctrlKey: true });

      expect(onCopy).toHaveBeenCalledOnce();
    });

    it('calls onPaste on Ctrl+V', () => {
      const onPaste = vi.fn();
      render(<ShortcutHarness options={{ onPaste }} />);

      pressKey({ key: 'v', ctrlKey: true });

      expect(onPaste).toHaveBeenCalledOnce();
    });

    it('calls onCut on Ctrl+X', () => {
      const onCut = vi.fn();
      render(<ShortcutHarness options={{ onCut }} />);

      pressKey({ key: 'x', ctrlKey: true });

      expect(onCut).toHaveBeenCalledOnce();
    });
  });

  // ---- Duplicate ----------------------------------------------------------

  describe('duplicate', () => {
    it('calls onDuplicate on Ctrl+D', () => {
      const onDuplicate = vi.fn();
      render(<ShortcutHarness options={{ onDuplicate }} />);

      pressKey({ key: 'd', ctrlKey: true });

      expect(onDuplicate).toHaveBeenCalledOnce();
    });

    it('calls onDuplicate on Cmd+D (Mac)', () => {
      const onDuplicate = vi.fn();
      render(<ShortcutHarness options={{ onDuplicate }} />);

      pressKey({ key: 'd', metaKey: true });

      expect(onDuplicate).toHaveBeenCalledOnce();
    });
  });

  // ---- Escape -------------------------------------------------------------

  describe('escape', () => {
    it('calls onEscape on Escape key', () => {
      const onEscape = vi.fn();
      render(<ShortcutHarness options={{ onEscape }} />);

      pressKey({ key: 'Escape' });

      expect(onEscape).toHaveBeenCalledOnce();
    });
  });

  // ---- Tool shortcuts -----------------------------------------------------

  describe('tool shortcuts', () => {
    const defaultToolShortcuts = {
      v: 'select' as const,
      r: 'rect' as const,
      c: 'circle' as const,
      t: 'text' as const,
      l: 'line' as const,
    };

    it('calls onToolChange with correct tool on key press', () => {
      const onToolChange = vi.fn();
      render(
        <ShortcutHarness
          options={{ toolShortcuts: defaultToolShortcuts, onToolChange }}
        />,
      );

      pressKey({ key: 'r' });

      expect(onToolChange).toHaveBeenCalledWith('rect');
    });

    it('switches to select tool on "v" key', () => {
      const onToolChange = vi.fn();
      render(
        <ShortcutHarness
          options={{ toolShortcuts: defaultToolShortcuts, onToolChange }}
        />,
      );

      pressKey({ key: 'v' });

      expect(onToolChange).toHaveBeenCalledWith('select');
    });

    it('does not trigger tool shortcut when modifier is held', () => {
      const onToolChange = vi.fn();
      render(
        <ShortcutHarness
          options={{ toolShortcuts: defaultToolShortcuts, onToolChange }}
        />,
      );

      pressKey({ key: 'c', ctrlKey: true });

      // Ctrl+C should trigger copy, not tool change
      expect(onToolChange).not.toHaveBeenCalled();
    });

    it('ignores unmapped keys', () => {
      const onToolChange = vi.fn();
      render(
        <ShortcutHarness
          options={{ toolShortcuts: defaultToolShortcuts, onToolChange }}
        />,
      );

      pressKey({ key: 'z' });

      expect(onToolChange).not.toHaveBeenCalled();
    });

    it('supports custom tool shortcuts', () => {
      const onToolChange = vi.fn();
      render(
        <ShortcutHarness
          options={{
            toolShortcuts: { h: 'hand' },
            onToolChange,
          }}
        />,
      );

      pressKey({ key: 'h' });

      expect(onToolChange).toHaveBeenCalledWith('hand');
    });
  });

  // ---- Input suppression --------------------------------------------------

  describe('input suppression', () => {
    it('ignores shortcuts when target is an input element', () => {
      const onDelete = vi.fn();
      render(<ShortcutHarness options={{ onDelete }} />);

      const input = document.createElement('input');
      document.body.appendChild(input);

      pressKey({ key: 'Delete', target: input });

      expect(onDelete).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });

    it('ignores shortcuts when target is a textarea element', () => {
      const onUndo = vi.fn();
      render(<ShortcutHarness options={{ onUndo }} />);

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);

      pressKey({ key: 'z', ctrlKey: true, target: textarea });

      expect(onUndo).not.toHaveBeenCalled();
      document.body.removeChild(textarea);
    });

    it('ignores shortcuts when target is contenteditable', () => {
      const onCopy = vi.fn();
      render(<ShortcutHarness options={{ onCopy }} />);

      const div = document.createElement('div');
      div.contentEditable = 'true';
      document.body.appendChild(div);

      pressKey({ key: 'c', ctrlKey: true, target: div });

      expect(onCopy).not.toHaveBeenCalled();
      document.body.removeChild(div);
    });
  });

  // ---- Enabled / Disabled -------------------------------------------------

  describe('enabled option', () => {
    it('does not register listeners when enabled=false', () => {
      const onUndo = vi.fn();
      render(<ShortcutHarness options={{ enabled: false, onUndo }} />);

      pressKey({ key: 'z', ctrlKey: true });

      expect(onUndo).not.toHaveBeenCalled();
    });

    it('defaults enabled to true', () => {
      const onUndo = vi.fn();
      render(<ShortcutHarness options={{ onUndo }} />);

      pressKey({ key: 'z', ctrlKey: true });

      expect(onUndo).toHaveBeenCalledOnce();
    });
  });

  // ---- Cleanup ------------------------------------------------------------

  describe('cleanup', () => {
    it('removes event listener on unmount', () => {
      const removeListenerSpy = vi.spyOn(window, 'removeEventListener');
      const onUndo = vi.fn();
      const { unmount } = render(<ShortcutHarness options={{ onUndo }} />);

      unmount();

      const removedEvents = removeListenerSpy.mock.calls.map(call => call[0]);
      expect(removedEvents).toContain('keydown');

      removeListenerSpy.mockRestore();
    });

    it('does not respond to keys after unmount', () => {
      const onUndo = vi.fn();
      const { unmount } = render(<ShortcutHarness options={{ onUndo }} />);

      unmount();

      pressKey({ key: 'z', ctrlKey: true });

      expect(onUndo).not.toHaveBeenCalled();
    });
  });

  // ---- No-callback safety -------------------------------------------------

  describe('missing callbacks', () => {
    it('does not throw when no callbacks are provided', () => {
      render(<ShortcutHarness options={{}} />);

      expect(() => {
        pressKey({ key: 'z', ctrlKey: true });
        pressKey({ key: 'Delete' });
        pressKey({ key: 'Escape' });
      }).not.toThrow();
    });
  });
});
