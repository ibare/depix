/**
 * FloatingToolbar
 *
 * A floating, optionally draggable toolbar for selecting editing tools,
 * undo/redo actions, and element deletion in a Depix editor.
 *
 * The toolbar renders tool buttons (select, rect, circle, text, line,
 * connector, image), a separator, and action buttons (undo, redo, delete).
 *
 * Active tool is indicated via `data-active="true"` on the button element.
 * Disabled buttons (undo/redo when unavailable, delete when no selection)
 * use the standard HTML `disabled` attribute.
 *
 * Minimal inline styles are provided; external theming is supported via
 * className, style props, and data attributes.
 */

import React from 'react';
import type { ToolType } from '../types.js';
import { useDraggable } from '../hooks/useDraggable.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FloatingToolbarProps {
  /** Currently active tool. */
  tool: ToolType;
  /** Callback when a tool is selected. */
  onToolChange: (tool: ToolType) => void;
  /** Undo callback. */
  onUndo?: () => void;
  /** Redo callback. */
  onRedo?: () => void;
  /** Delete callback. */
  onDelete?: () => void;
  /** Whether undo is available. */
  canUndo?: boolean;
  /** Whether redo is available. */
  canRedo?: boolean;
  /** Whether there is a current selection. */
  hasSelection?: boolean;
  /** CSS class name. */
  className?: string;
  /** CSS inline style. */
  style?: React.CSSProperties;
  /** Whether the toolbar can be dragged. Default: true */
  draggable?: boolean;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

interface ToolDef {
  type: ToolType;
  label: string;
}

const TOOLS: ToolDef[] = [
  { type: 'select', label: 'Select' },
  { type: 'rect', label: 'Rectangle' },
  { type: 'circle', label: 'Circle' },
  { type: 'text', label: 'Text' },
  { type: 'line', label: 'Line' },
  { type: 'connector', label: 'Connector' },
  { type: 'image', label: 'Image' },
];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '6px 8px',
  borderRadius: '8px',
  backgroundColor: '#ffffff',
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  userSelect: 'none',
};

const buttonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'transparent',
  borderRadius: '4px',
  padding: '4px 8px',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  fontSize: '13px',
  lineHeight: '1',
};

const activeButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#e8f0fe',
  borderColor: '#4A90D9',
};

const disabledButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  opacity: 0.4,
  cursor: 'default',
};

const separatorStyle: React.CSSProperties = {
  width: '1px',
  height: '20px',
  backgroundColor: '#ddd',
  margin: '0 4px',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  tool,
  onToolChange,
  onUndo,
  onRedo,
  onDelete,
  canUndo = false,
  canRedo = false,
  hasSelection = false,
  className,
  style,
  draggable = true,
}) => {
  const { position, dragHandleProps, isDragging } = useDraggable({
    enabled: draggable,
  });

  const wrapperStyle: React.CSSProperties = {
    position: 'absolute' as const,
    ...(draggable
      ? { transform: `translate(${position.x}px, ${position.y}px)` }
      : {}),
    ...(isDragging ? { cursor: 'grabbing' } : {}),
  };

  return (
    <div
      role="toolbar"
      aria-label="Depix tools"
      className={className}
      style={{ ...wrapperStyle, ...toolbarStyle, ...style }}
      data-draggable={draggable}
      {...(draggable ? dragHandleProps : {})}
    >
      {/* Tool buttons */}
      {TOOLS.map((t) => {
        const isActive = tool === t.type;
        return (
          <button
            key={t.type}
            type="button"
            aria-label={t.label}
            data-tool={t.type}
            data-active={isActive ? 'true' : undefined}
            style={isActive ? activeButtonStyle : buttonStyle}
            onClick={() => onToolChange(t.type)}
          >
            {t.label}
          </button>
        );
      })}

      {/* Separator */}
      <div role="separator" style={separatorStyle} />

      {/* Undo */}
      <button
        type="button"
        aria-label="Undo"
        data-action="undo"
        disabled={!canUndo}
        style={canUndo ? buttonStyle : disabledButtonStyle}
        onClick={onUndo}
      >
        Undo
      </button>

      {/* Redo */}
      <button
        type="button"
        aria-label="Redo"
        data-action="redo"
        disabled={!canRedo}
        style={canRedo ? buttonStyle : disabledButtonStyle}
        onClick={onRedo}
      >
        Redo
      </button>

      {/* Delete */}
      <button
        type="button"
        aria-label="Delete"
        data-action="delete"
        disabled={!hasSelection}
        style={hasSelection ? buttonStyle : disabledButtonStyle}
        onClick={onDelete}
      >
        Delete
      </button>
    </div>
  );
};
