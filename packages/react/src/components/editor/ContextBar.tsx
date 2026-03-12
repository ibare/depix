/**
 * ContextBar — floating action bar above selected element.
 * Shows element-type-specific actions.
 */

import React from 'react';
import { PencilSimple, Trash, Palette } from '@phosphor-icons/react';
import { EDITOR_COLORS } from './editor-colors.js';

export interface ContextBarProps {
  elementType: string;
  position: { x: number; y: number };
  onAction: (action: string) => void;
}

const ACTIONS_BY_TYPE: Record<string, Array<{ action: string; label: string; icon: React.ReactNode }>> = {
  heading: [
    { action: 'edit-text', label: 'Edit', icon: <PencilSimple size={14} /> },
    { action: 'delete', label: 'Delete', icon: <Trash size={14} /> },
  ],
  bullet: [
    { action: 'edit-text', label: 'Edit', icon: <PencilSimple size={14} /> },
    { action: 'delete', label: 'Delete', icon: <Trash size={14} /> },
  ],
  node: [
    { action: 'edit-text', label: 'Edit', icon: <PencilSimple size={14} /> },
    { action: 'style', label: 'Style', icon: <Palette size={14} /> },
    { action: 'delete', label: 'Delete', icon: <Trash size={14} /> },
  ],
  stat: [
    { action: 'edit-text', label: 'Edit', icon: <PencilSimple size={14} /> },
    { action: 'delete', label: 'Delete', icon: <Trash size={14} /> },
  ],
  _default: [
    { action: 'edit-text', label: 'Edit', icon: <PencilSimple size={14} /> },
    { action: 'delete', label: 'Delete', icon: <Trash size={14} /> },
  ],
};

export function ContextBar({ elementType, position, onAction }: ContextBarProps) {
  const actions = ACTIONS_BY_TYPE[elementType] ?? ACTIONS_BY_TYPE._default;

  return (
    <div
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y - 36,
        transform: 'translateX(-50%)',
        background: EDITOR_COLORS.bg,
        border: `1px solid ${EDITOR_COLORS.border}`,
        borderRadius: 6,
        padding: '2px 4px',
        display: 'flex',
        gap: 2,
        zIndex: 15,
      }}
    >
      {actions.map(({ action, label, icon }) => (
        <button
          key={action}
          onClick={() => onAction(action)}
          title={label}
          style={{
            background: 'transparent',
            border: 'none',
            borderRadius: 4,
            padding: '4px 8px',
            cursor: 'pointer',
            color: action === 'delete' ? EDITOR_COLORS.danger : EDITOR_COLORS.text,
            fontSize: 12,
          }}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
