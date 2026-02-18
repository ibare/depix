/**
 * useKeyboardShortcuts
 *
 * A React hook that registers global keyboard shortcuts for the Depix editor.
 * Handles undo/redo, clipboard operations, element deletion, tool switching,
 * and more. Supports both Mac (Cmd) and Windows/Linux (Ctrl) modifier keys.
 *
 * Shortcuts are automatically disabled when the focus is inside an input,
 * textarea, or contenteditable element to avoid interfering with text editing.
 *
 * @module @depix/react/hooks/useKeyboardShortcuts
 */

import { useEffect, useCallback } from 'react';
import type { ToolType } from '../types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseKeyboardShortcutsOptions {
  /** Whether keyboard shortcuts are enabled. Default: true */
  enabled?: boolean;
  /** Called on Ctrl/Cmd+Z. */
  onUndo?: () => void;
  /** Called on Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y. */
  onRedo?: () => void;
  /** Called on Delete or Backspace. */
  onDelete?: () => void;
  /** Called on Ctrl/Cmd+A. */
  onSelectAll?: () => void;
  /** Called on Ctrl/Cmd+C. */
  onCopy?: () => void;
  /** Called on Ctrl/Cmd+V. */
  onPaste?: () => void;
  /** Called on Ctrl/Cmd+X. */
  onCut?: () => void;
  /** Called on Ctrl/Cmd+D. */
  onDuplicate?: () => void;
  /** Called on Escape. */
  onEscape?: () => void;
  /** Key-to-tool mapping (e.g. { v: 'select', r: 'rect' }). */
  toolShortcuts?: Record<string, ToolType>;
  /** Called when a tool shortcut is pressed. */
  onToolChange?: (tool: ToolType) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check whether the event target is an input-like element where
 * keyboard shortcuts should be suppressed.
 */
function isInputTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea') return true;
  if (target.isContentEditable) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useKeyboardShortcuts(options?: UseKeyboardShortcutsOptions): void {
  const enabled = options?.enabled ?? true;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip if target is an input element
      if (isInputTarget(e.target)) return;

      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // --- Modifier combos ---
      if (mod) {
        // Redo: Ctrl/Cmd+Shift+Z
        if (key === 'z' && e.shiftKey) {
          e.preventDefault();
          options?.onRedo?.();
          return;
        }

        // Undo: Ctrl/Cmd+Z
        if (key === 'z' && !e.shiftKey) {
          e.preventDefault();
          options?.onUndo?.();
          return;
        }

        // Redo: Ctrl/Cmd+Y
        if (key === 'y') {
          e.preventDefault();
          options?.onRedo?.();
          return;
        }

        // Select All: Ctrl/Cmd+A
        if (key === 'a') {
          e.preventDefault();
          options?.onSelectAll?.();
          return;
        }

        // Copy: Ctrl/Cmd+C
        if (key === 'c' && !e.shiftKey) {
          options?.onCopy?.();
          return;
        }

        // Paste: Ctrl/Cmd+V
        if (key === 'v' && !e.shiftKey) {
          options?.onPaste?.();
          return;
        }

        // Cut: Ctrl/Cmd+X
        if (key === 'x') {
          options?.onCut?.();
          return;
        }

        // Duplicate: Ctrl/Cmd+D
        if (key === 'd') {
          e.preventDefault();
          options?.onDuplicate?.();
          return;
        }

        return;
      }

      // --- Non-modifier keys ---

      // Delete / Backspace
      if (key === 'delete' || key === 'backspace') {
        options?.onDelete?.();
        return;
      }

      // Escape
      if (key === 'escape') {
        options?.onEscape?.();
        return;
      }

      // Tool shortcuts (single key, no modifier)
      if (!e.shiftKey && !e.altKey && options?.toolShortcuts) {
        const tool = options.toolShortcuts[key];
        if (tool) {
          options?.onToolChange?.(tool);
          return;
        }
      }
    },
    [options],
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}
