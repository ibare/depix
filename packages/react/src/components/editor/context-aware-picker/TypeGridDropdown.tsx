/**
 * TypeGridDropdown — 2x3 grid for selecting block container type.
 */

import React from 'react';
import { Check } from '@phosphor-icons/react';
import { ALL_BLOCKS } from './picker-suggestions.js';
import { TYPE_ICONS } from './PickerUI.js';
import { EDITOR_COLORS } from '../editor-colors.js';

export function TypeGridDropdown({
  currentType,
  onSelect,
}: {
  currentType: string;
  onSelect: (type: string) => void;
}) {
  return (
    <div
      style={{
        marginTop: 4,
        background: EDITOR_COLORS.bg,
        border: `1px solid ${EDITOR_COLORS.border}`,
        borderRadius: 8,
        padding: 6,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 3,
        minWidth: 180,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      {ALL_BLOCKS.map((block) => {
        const isActive = block.type === currentType;
        return (
          <button
            key={block.type}
            onClick={() => onSelect(block.type)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 8px',
              background: isActive ? EDITOR_COLORS.accent + '22' : EDITOR_COLORS.bgLight,
              border: `1px solid ${isActive ? EDITOR_COLORS.accent : EDITOR_COLORS.border}`,
              borderRadius: 4,
              color: isActive ? EDITOR_COLORS.accent : EDITOR_COLORS.text,
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center' }}>
              {TYPE_ICONS[block.type] ?? null}
            </span>
            <span style={{ flex: 1 }}>{block.label}</span>
            {isActive && <Check size={10} />}
          </button>
        );
      })}
    </div>
  );
}
