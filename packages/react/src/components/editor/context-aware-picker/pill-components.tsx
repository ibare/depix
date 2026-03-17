/**
 * pill-components — Two-zone pill variants for the context-aware picker.
 *
 * TwoZonePill: block containers ([ → Flow ▾ ][ + ])
 * ElementTwoZonePill: leaf elements   ([ ↔ Heading ][ ⟶ ])
 */

import React from 'react';
import { CaretDown, Plus, Swap, ArrowRight } from '@phosphor-icons/react';
import { TYPE_ICONS, ICON_SIZE } from './PickerUI.js';
import { EDITOR_COLORS } from '../editor-colors.js';

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// TwoZonePill — for block containers
// ---------------------------------------------------------------------------

export function TwoZonePill({
  currentType,
  canChangeType,
  onTypeClick,
  onAddClick,
}: {
  currentType: string;
  canChangeType: boolean;
  onTypeClick: () => void;
  onAddClick: () => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 0, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }}>
      <button
        onClick={canChangeType ? onTypeClick : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 10px',
          background: EDITOR_COLORS.bg,
          border: `1px solid ${EDITOR_COLORS.border}`,
          borderRadius: '16px 0 0 16px',
          borderRight: 'none',
          color: EDITOR_COLORS.text,
          fontSize: 11,
          fontWeight: 500,
          cursor: canChangeType ? 'pointer' : 'default',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center' }}>{TYPE_ICONS[currentType] ?? null}</span>
        <span>{capitalize(currentType)}</span>
        {canChangeType && <CaretDown size={10} />}
      </button>
      <button
        onClick={onAddClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 8px',
          background: EDITOR_COLORS.bg,
          border: `1px solid ${EDITOR_COLORS.border}`,
          borderRadius: '0 16px 16px 0',
          color: EDITOR_COLORS.text,
          cursor: 'pointer',
        }}
      >
        <Plus size={12} weight="bold" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ElementTwoZonePill — for leaf elements
// ---------------------------------------------------------------------------

export function ElementTwoZonePill({
  elementType,
  parentContainerType,
  onElementClick,
  onShapeClick,
}: {
  elementType: string;
  parentContainerType?: string;
  onElementClick: () => void;
  onShapeClick: () => void;
}) {
  const shapeType = parentContainerType ?? 'flow';
  return (
    <div style={{ display: 'flex', gap: 0, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }}>
      <button
        onClick={onElementClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 10px',
          background: EDITOR_COLORS.bg,
          border: `1px solid ${EDITOR_COLORS.border}`,
          borderRadius: '16px 0 0 16px',
          borderRight: 'none',
          color: EDITOR_COLORS.text,
          fontSize: 11,
          fontWeight: 500,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center' }}>{TYPE_ICONS[elementType] ?? null}</span>
        <span>{capitalize(elementType)}</span>
        <Swap size={10} />
      </button>
      <button
        onClick={onShapeClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 8px',
          background: EDITOR_COLORS.bg,
          border: `1px solid ${EDITOR_COLORS.border}`,
          borderRadius: '0 16px 16px 0',
          color: EDITOR_COLORS.text,
          cursor: 'pointer',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center' }}>
          {TYPE_ICONS[shapeType] ?? <ArrowRight size={ICON_SIZE} />}
        </span>
      </button>
    </div>
  );
}
