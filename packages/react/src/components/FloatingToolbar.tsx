/**
 * FloatingToolbar
 *
 * A vertical floating toolbar built on FloatingPanel.
 * Provides tool selection (select, shapes, lines, content) and
 * editing actions (undo, redo, delete) with SVG icons.
 *
 * Maintains backward compatibility with existing test selectors:
 * - role="toolbar", aria-label="Depix tools"
 * - data-tool, data-active, data-action on buttons
 * - data-draggable on the root
 */

import React from 'react';
import type { ToolType } from '../types.js';
import { useDraggable } from '../hooks/useDraggable.js';
import {
  SelectIcon,
  RectIcon,
  CircleIcon,
  TextIcon,
  LineIcon,
  ConnectorIcon,
  ImageIcon,
  UndoIcon,
  RedoIcon,
  DeleteIcon,
} from '../icons/ToolIcons.js';

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
  Icon: React.FC;
  group: number;
}

const TOOLS: ToolDef[] = [
  { type: 'select', label: 'Select', Icon: SelectIcon, group: 0 },
  { type: 'rect', label: 'Rectangle', Icon: RectIcon, group: 1 },
  { type: 'circle', label: 'Circle', Icon: CircleIcon, group: 1 },
  { type: 'line', label: 'Line', Icon: LineIcon, group: 2 },
  { type: 'connector', label: 'Connector', Icon: ConnectorIcon, group: 2 },
  { type: 'text', label: 'Text', Icon: TextIcon, group: 3 },
  { type: 'image', label: 'Image', Icon: ImageIcon, group: 3 },
];

// ---------------------------------------------------------------------------
// Dark theme tokens
// ---------------------------------------------------------------------------

const COLORS = {
  bg: '#1e1e1e',
  border: '#333',
  text: '#ddd',
  active: '#3b82f6',
  separator: '#333',
} as const;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2px',
  padding: '6px',
  borderRadius: '8px',
  backgroundColor: COLORS.bg,
  border: `1px solid ${COLORS.border}`,
  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  userSelect: 'none',
  width: '40px',
};

const btnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '30px',
  height: '30px',
  padding: 0,
  border: 'none',
  borderRadius: '4px',
  backgroundColor: 'transparent',
  color: COLORS.text,
  cursor: 'pointer',
  fontSize: '13px',
  lineHeight: '1',
};

const activeBtnStyle: React.CSSProperties = {
  ...btnStyle,
  backgroundColor: COLORS.active,
  color: '#fff',
};

const disabledBtnStyle: React.CSSProperties = {
  ...btnStyle,
  opacity: 0.3,
  cursor: 'default',
};

const separatorStyle: React.CSSProperties = {
  width: '24px',
  height: '1px',
  backgroundColor: COLORS.separator,
  margin: '3px 0',
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

  // Group tools by group number and insert separators between groups
  let lastGroup = -1;
  const toolElements: React.ReactNode[] = [];
  for (const t of TOOLS) {
    if (t.group !== lastGroup && lastGroup !== -1) {
      toolElements.push(
        <div key={`sep-${t.group}`} role="separator" style={separatorStyle} />,
      );
    }
    lastGroup = t.group;

    const isActive = tool === t.type;
    toolElements.push(
      <button
        key={t.type}
        type="button"
        aria-label={t.label}
        data-tool={t.type}
        data-active={isActive ? 'true' : undefined}
        style={isActive ? activeBtnStyle : btnStyle}
        onClick={() => onToolChange(t.type)}
        title={t.label}
      >
        <t.Icon />
      </button>,
    );
  }

  return (
    <div
      role="toolbar"
      aria-label="Depix tools"
      className={className}
      style={{ ...wrapperStyle, ...toolbarStyle, ...style }}
      data-draggable={draggable}
      {...(draggable ? dragHandleProps : {})}
    >
      {toolElements}

      {/* Separator before actions */}
      <div role="separator" style={separatorStyle} />

      {/* Undo */}
      <button
        type="button"
        aria-label="Undo"
        data-action="undo"
        disabled={!canUndo}
        style={canUndo ? btnStyle : disabledBtnStyle}
        onClick={onUndo}
        title="Undo"
      >
        <UndoIcon />
      </button>

      {/* Redo */}
      <button
        type="button"
        aria-label="Redo"
        data-action="redo"
        disabled={!canRedo}
        style={canRedo ? btnStyle : disabledBtnStyle}
        onClick={onRedo}
        title="Redo"
      >
        <RedoIcon />
      </button>

      {/* Delete */}
      <button
        type="button"
        aria-label="Delete"
        data-action="delete"
        disabled={!hasSelection}
        style={hasSelection ? btnStyle : disabledBtnStyle}
        onClick={onDelete}
        title="Delete"
      >
        <DeleteIcon />
      </button>
    </div>
  );
};
