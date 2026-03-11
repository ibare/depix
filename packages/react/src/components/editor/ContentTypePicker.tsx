/**
 * ContentTypePicker — popover to select element or block type for a slot.
 * Shows elements and blocks in a 2-column grid.
 */

import React, { useRef, useEffect } from 'react';
import { EDITOR_COLORS } from './editor-colors.js';

const ELEMENT_OPTIONS = [
  { type: 'heading', label: 'Heading', icon: 'H' },
  { type: 'bullet', label: 'Bullet', icon: '•' },
  { type: 'stat', label: 'Stat', icon: '#' },
  { type: 'quote', label: 'Quote', icon: '"' },
  { type: 'list', label: 'List', icon: '≡' },
  { type: 'image', label: 'Image', icon: '▣' },
  { type: 'node', label: 'Node', icon: '□' },
  { type: 'divider', label: 'Divider', icon: '—' },
] as const;

const BLOCK_OPTIONS = [
  { type: 'flow', label: 'Flow', icon: '→' },
  { type: 'tree', label: 'Tree', icon: '⌐' },
  { type: 'grid', label: 'Grid', icon: '⊞' },
  { type: 'stack', label: 'Stack', icon: '▤' },
  { type: 'table', label: 'Table', icon: '⊟' },
  { type: 'chart', label: 'Chart', icon: '📊' },
] as const;

export interface ContentTypePickerProps {
  position: { x: number; y: number };
  onSelect: (type: string) => void;
  onClose: () => void;
}

export function ContentTypePicker({ position, onSelect, onClose }: ContentTypePickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        background: EDITOR_COLORS.bg,
        border: `1px solid ${EDITOR_COLORS.border}`,
        borderRadius: 8,
        padding: 8,
        zIndex: 20,
        minWidth: 200,
      }}
    >
      <div style={{ fontSize: 10, color: EDITOR_COLORS.textMuted, marginBottom: 6, paddingLeft: 4 }}>
        Elements
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
        {ELEMENT_OPTIONS.map(({ type, label, icon }) => (
          <PickerButton key={type} icon={icon} label={label} onClick={() => onSelect(type)} />
        ))}
      </div>
      <div style={{ fontSize: 10, color: EDITOR_COLORS.textMuted, marginBottom: 6, paddingLeft: 4 }}>
        Blocks
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        {BLOCK_OPTIONS.map(({ type, label, icon }) => (
          <PickerButton key={type} icon={icon} label={label} onClick={() => onSelect(type)} />
        ))}
      </div>
    </div>
  );
}

function PickerButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: EDITOR_COLORS.bgLight,
        border: `1px solid ${EDITOR_COLORS.border}`,
        borderRadius: 4,
        padding: '4px 8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        color: EDITOR_COLORS.text,
        fontSize: 11,
      }}
    >
      <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
