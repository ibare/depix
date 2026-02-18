/**
 * FloatingToolbar Tests
 *
 * Tests the floating toolbar component for tool selection, undo/redo,
 * delete, and draggable behavior.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { FloatingToolbar } from '../src/components/FloatingToolbar.js';
import type { FloatingToolbarProps } from '../src/components/FloatingToolbar.js';
import type { ToolType } from '../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderToolbar(overrides: Partial<FloatingToolbarProps> = {}) {
  const defaultProps: FloatingToolbarProps = {
    tool: 'select',
    onToolChange: vi.fn(),
    ...overrides,
  };
  return {
    ...render(<FloatingToolbar {...defaultProps} />),
    props: defaultProps,
  };
}

function getToolButton(container: HTMLElement, toolType: string): HTMLButtonElement {
  const btn = container.querySelector(`button[data-tool="${toolType}"]`);
  if (!btn) throw new Error(`Button for tool "${toolType}" not found`);
  return btn as HTMLButtonElement;
}

function getActionButton(container: HTMLElement, action: string): HTMLButtonElement {
  const btn = container.querySelector(`button[data-action="${action}"]`);
  if (!btn) throw new Error(`Button for action "${action}" not found`);
  return btn as HTMLButtonElement;
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

describe('FloatingToolbar', () => {
  // ---- Rendering -----------------------------------------------------------

  describe('rendering', () => {
    it('renders with role="toolbar"', () => {
      const { container } = renderToolbar();
      const toolbar = container.querySelector('[role="toolbar"]');

      expect(toolbar).not.toBeNull();
    });

    it('renders aria-label on the toolbar', () => {
      const { container } = renderToolbar();
      const toolbar = container.querySelector('[role="toolbar"]');

      expect(toolbar!.getAttribute('aria-label')).toBe('Depix tools');
    });

    it('renders all tool buttons', () => {
      const { container } = renderToolbar();
      const tools: ToolType[] = ['select', 'rect', 'circle', 'text', 'line', 'connector', 'image'];

      for (const tool of tools) {
        const btn = container.querySelector(`button[data-tool="${tool}"]`);
        expect(btn).not.toBeNull();
      }
    });

    it('renders undo button', () => {
      const { container } = renderToolbar();
      const btn = getActionButton(container, 'undo');

      expect(btn).not.toBeNull();
      expect(btn.getAttribute('aria-label')).toBe('Undo');
    });

    it('renders redo button', () => {
      const { container } = renderToolbar();
      const btn = getActionButton(container, 'redo');

      expect(btn).not.toBeNull();
      expect(btn.getAttribute('aria-label')).toBe('Redo');
    });

    it('renders delete button', () => {
      const { container } = renderToolbar();
      const btn = getActionButton(container, 'delete');

      expect(btn).not.toBeNull();
      expect(btn.getAttribute('aria-label')).toBe('Delete');
    });

    it('renders a separator between tools and actions', () => {
      const { container } = renderToolbar();
      const separator = container.querySelector('[role="separator"]');

      expect(separator).not.toBeNull();
    });

    it('renders tool buttons with aria-label', () => {
      const { container } = renderToolbar();
      const selectBtn = getToolButton(container, 'select');

      expect(selectBtn.getAttribute('aria-label')).toBe('Select');
    });
  });

  // ---- Tool selection ------------------------------------------------------

  describe('tool selection', () => {
    it('calls onToolChange when a tool button is clicked', () => {
      const onToolChange = vi.fn();
      const { container } = renderToolbar({ onToolChange });

      const rectBtn = getToolButton(container, 'rect');
      fireEvent.click(rectBtn);

      expect(onToolChange).toHaveBeenCalledWith('rect');
    });

    it('calls onToolChange with correct tool type for each tool', () => {
      const onToolChange = vi.fn();
      const { container } = renderToolbar({ onToolChange });
      const tools: ToolType[] = ['select', 'rect', 'circle', 'text', 'line', 'connector', 'image'];

      for (const tool of tools) {
        const btn = getToolButton(container, tool);
        fireEvent.click(btn);
      }

      expect(onToolChange).toHaveBeenCalledTimes(tools.length);
      for (const tool of tools) {
        expect(onToolChange).toHaveBeenCalledWith(tool);
      }
    });

    it('does not call onToolChange when clicking action buttons', () => {
      const onToolChange = vi.fn();
      const { container } = renderToolbar({ onToolChange, canUndo: true });

      const undoBtn = getActionButton(container, 'undo');
      fireEvent.click(undoBtn);

      expect(onToolChange).not.toHaveBeenCalled();
    });
  });

  // ---- Active state --------------------------------------------------------

  describe('active state', () => {
    it('marks the active tool with data-active="true"', () => {
      const { container } = renderToolbar({ tool: 'rect' });
      const rectBtn = getToolButton(container, 'rect');

      expect(rectBtn.getAttribute('data-active')).toBe('true');
    });

    it('does not mark inactive tools with data-active', () => {
      const { container } = renderToolbar({ tool: 'rect' });
      const selectBtn = getToolButton(container, 'select');

      expect(selectBtn.getAttribute('data-active')).toBeNull();
    });

    it('updates active state when tool prop changes', () => {
      const { container, rerender } = render(
        <FloatingToolbar tool="select" onToolChange={vi.fn()} />,
      );

      expect(getToolButton(container, 'select').getAttribute('data-active')).toBe('true');
      expect(getToolButton(container, 'circle').getAttribute('data-active')).toBeNull();

      rerender(<FloatingToolbar tool="circle" onToolChange={vi.fn()} />);

      expect(getToolButton(container, 'select').getAttribute('data-active')).toBeNull();
      expect(getToolButton(container, 'circle').getAttribute('data-active')).toBe('true');
    });

    it('only one tool has data-active at a time', () => {
      const { container } = renderToolbar({ tool: 'text' });
      const activeButtons = container.querySelectorAll('button[data-active="true"]');

      expect(activeButtons.length).toBe(1);
      expect((activeButtons[0] as HTMLElement).getAttribute('data-tool')).toBe('text');
    });
  });

  // ---- Undo / Redo ---------------------------------------------------------

  describe('undo/redo', () => {
    it('calls onUndo when undo button is clicked', () => {
      const onUndo = vi.fn();
      const { container } = renderToolbar({ onUndo, canUndo: true });

      const undoBtn = getActionButton(container, 'undo');
      fireEvent.click(undoBtn);

      expect(onUndo).toHaveBeenCalledTimes(1);
    });

    it('calls onRedo when redo button is clicked', () => {
      const onRedo = vi.fn();
      const { container } = renderToolbar({ onRedo, canRedo: true });

      const redoBtn = getActionButton(container, 'redo');
      fireEvent.click(redoBtn);

      expect(onRedo).toHaveBeenCalledTimes(1);
    });

    it('disables undo button when canUndo is false', () => {
      const { container } = renderToolbar({ canUndo: false });
      const undoBtn = getActionButton(container, 'undo');

      expect(undoBtn.disabled).toBe(true);
    });

    it('disables redo button when canRedo is false', () => {
      const { container } = renderToolbar({ canRedo: false });
      const redoBtn = getActionButton(container, 'redo');

      expect(redoBtn.disabled).toBe(true);
    });

    it('enables undo button when canUndo is true', () => {
      const { container } = renderToolbar({ canUndo: true });
      const undoBtn = getActionButton(container, 'undo');

      expect(undoBtn.disabled).toBe(false);
    });

    it('enables redo button when canRedo is true', () => {
      const { container } = renderToolbar({ canRedo: true });
      const redoBtn = getActionButton(container, 'redo');

      expect(redoBtn.disabled).toBe(false);
    });

    it('defaults undo to disabled when canUndo is not provided', () => {
      const { container } = renderToolbar();
      const undoBtn = getActionButton(container, 'undo');

      expect(undoBtn.disabled).toBe(true);
    });

    it('defaults redo to disabled when canRedo is not provided', () => {
      const { container } = renderToolbar();
      const redoBtn = getActionButton(container, 'redo');

      expect(redoBtn.disabled).toBe(true);
    });
  });

  // ---- Delete ---------------------------------------------------------------

  describe('delete', () => {
    it('calls onDelete when delete button is clicked', () => {
      const onDelete = vi.fn();
      const { container } = renderToolbar({ onDelete, hasSelection: true });

      const deleteBtn = getActionButton(container, 'delete');
      fireEvent.click(deleteBtn);

      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('disables delete button when hasSelection is false', () => {
      const { container } = renderToolbar({ hasSelection: false });
      const deleteBtn = getActionButton(container, 'delete');

      expect(deleteBtn.disabled).toBe(true);
    });

    it('enables delete button when hasSelection is true', () => {
      const { container } = renderToolbar({ hasSelection: true });
      const deleteBtn = getActionButton(container, 'delete');

      expect(deleteBtn.disabled).toBe(false);
    });

    it('defaults delete to disabled when hasSelection is not provided', () => {
      const { container } = renderToolbar();
      const deleteBtn = getActionButton(container, 'delete');

      expect(deleteBtn.disabled).toBe(true);
    });
  });

  // ---- className / style ---------------------------------------------------

  describe('className and style', () => {
    it('passes className to the toolbar element', () => {
      const { container } = renderToolbar({ className: 'my-toolbar' });
      const toolbar = container.querySelector('[role="toolbar"]') as HTMLElement;

      expect(toolbar.className).toBe('my-toolbar');
    });

    it('passes style to the toolbar element', () => {
      const { container } = renderToolbar({
        style: { top: '100px', left: '200px' },
      });
      const toolbar = container.querySelector('[role="toolbar"]') as HTMLElement;

      expect(toolbar.style.top).toBe('100px');
      expect(toolbar.style.left).toBe('200px');
    });
  });

  // ---- Draggable -----------------------------------------------------------

  describe('draggable', () => {
    it('has data-draggable="true" by default', () => {
      const { container } = renderToolbar();
      const toolbar = container.querySelector('[role="toolbar"]') as HTMLElement;

      expect(toolbar.getAttribute('data-draggable')).toBe('true');
    });

    it('has data-draggable="false" when draggable=false', () => {
      const { container } = renderToolbar({ draggable: false });
      const toolbar = container.querySelector('[role="toolbar"]') as HTMLElement;

      expect(toolbar.getAttribute('data-draggable')).toBe('false');
    });

    it('applies transform style when draggable is true', () => {
      const { container } = renderToolbar({ draggable: true });
      const toolbar = container.querySelector('[role="toolbar"]') as HTMLElement;

      // Initial position is 0,0 so transform should include translate(0px, 0px)
      expect(toolbar.style.transform).toContain('translate(0px, 0px)');
    });

    it('does not apply transform style when draggable is false', () => {
      const { container } = renderToolbar({ draggable: false });
      const toolbar = container.querySelector('[role="toolbar"]') as HTMLElement;

      expect(toolbar.style.transform).toBe('');
    });
  });
});
