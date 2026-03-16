/**
 * ContextAwarePicker — Context-aware pill + dropdown picker overlay.
 *
 * Shows a pill attached above the selected element or slot, with
 * contextual suggestions and actions based on the current selection.
 *
 * For block containers, renders a 2-zone pill:
 *   [ → Flow ▾ ][ + ]
 * Left zone opens a type-change grid, right zone opens an add-child dropdown.
 */

import React, { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import type { DepixIR } from '@depix/core';
import { CaretDown, Plus } from '@phosphor-icons/react';
import { useEditorStore, useEditorStoreApi } from '../../store/editor-store-context.js';
import { resolvePickerContext, type PickerContext, type SuggestionItem, type ActionItem } from './context-aware-picker/picker-context.js';
import { getSuggestionsForBlock } from './context-aware-picker/picker-suggestions.js';
import { PickerPill, PickerDropdown, TYPE_ICONS } from './context-aware-picker/PickerUI.js';
import { TypeGridDropdown } from './context-aware-picker/TypeGridDropdown.js';
import { EDITOR_COLORS } from './editor-colors.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContextAwarePickerProps {
  ir: DepixIR | null;
  dsl: string;
  activeSceneIndex: number;
  width: number;
  height: number;
  onAction: (action: string, payload?: unknown) => void;
}

type DropdownMode = 'suggestions' | 'type-grid' | 'add-child' | null;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContextAwarePicker({
  ir,
  dsl,
  activeSceneIndex,
  width,
  height,
  onAction,
}: ContextAwarePickerProps) {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const pickerSlot = useEditorStore((s) => s.pickerSlot);
  const storeApi = useEditorStoreApi();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownMode, setDropdownMode] = useState<DropdownMode>(null);

  const ctx = useMemo<PickerContext>(
    () => resolvePickerContext({ selectedIds, pickerSlot, ir, activeSceneIndex }),
    [selectedIds, pickerSlot, ir, activeSceneIndex],
  );

  // Reset dropdown mode when selection changes
  useEffect(() => setDropdownMode(null), [selectedIds, pickerSlot]);

  // Auto-open suggestions for empty-slot (triggered by slot click)
  useEffect(() => {
    if (ctx.kind === 'empty-slot') setDropdownMode('suggestions');
  }, [ctx.kind]);

  // Close on outside click
  useEffect(() => {
    if (dropdownMode === null) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownMode(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownMode]);

  // --- Non-block pill toggle ---
  const toggleExpanded = useCallback(() => {
    setDropdownMode((prev) => (prev === 'suggestions' ? null : 'suggestions'));
  }, []);

  const handleSuggestionClick = useCallback(
    (item: SuggestionItem) => {
      onAction('add-content', { type: item.type, category: item.category });
      setDropdownMode(null);
      storeApi.getState().setPickerExpanded(false);
    },
    [onAction, storeApi],
  );

  const handleActionClick = useCallback(
    (item: ActionItem) => {
      onAction(item.action, {
        elementId: ctx.elementId,
        elementType: ctx.elementType,
        slotName: ctx.slotName,
      });
      setDropdownMode(null);
    },
    [onAction, ctx.elementId, ctx.elementType, ctx.slotName],
  );

  // --- Two-zone pill handlers (existing-block) ---
  const handleTypeZoneClick = useCallback(() => {
    setDropdownMode((prev) => (prev === 'type-grid' ? null : 'type-grid'));
  }, []);

  const handleAddZoneClick = useCallback(() => {
    setDropdownMode((prev) => (prev === 'add-child' ? null : 'add-child'));
  }, []);

  const handleTypeSelect = useCallback(
    (newType: string) => {
      onAction('change-type', { elementId: ctx.elementId, slotName: ctx.slotName, newType });
      setDropdownMode(null);
    },
    [onAction, ctx.elementId, ctx.slotName],
  );

  const handleAddChildSuggestion = useCallback(
    (item: SuggestionItem) => {
      onAction('add-child', { slotName: ctx.slotName, type: item.type, category: item.category, parentType: ctx.elementType });
      setDropdownMode(null);
    },
    [onAction, ctx.slotName],
  );

  // Don't render for 'none' or 'empty-canvas'
  if (ctx.kind === 'none' || ctx.kind === 'empty-canvas') return null;

  const pos = computePosition(ctx, pickerSlot, width, height);
  const isBlock = ctx.kind === 'existing-block';

  // For add-child dropdown: show block-type-specific children + delete action only
  const addChildCtx: PickerContext | null = isBlock
    ? {
        ...ctx,
        suggestions: getSuggestionsForBlock(ctx.elementType!),
        actions: ctx.actions.filter((a) => a.action !== 'add-child' && a.action !== 'change-type'),
      }
    : null;

  return (
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        transform: 'translateX(-50%)',
        zIndex: 20,
        pointerEvents: 'auto',
      }}
    >
      {/* Pill */}
      {isBlock ? (
        <TwoZonePill
          currentType={ctx.elementType!}
          canChangeType={ctx.containerCategory === 'layout'}
          onTypeClick={handleTypeZoneClick}
          onAddClick={handleAddZoneClick}
        />
      ) : (
        <PickerPill
          label={ctx.label}
          kind={ctx.kind}
          expanded={dropdownMode === 'suggestions'}
          onToggle={toggleExpanded}
        />
      )}

      {/* Dropdowns */}
      {dropdownMode === 'type-grid' && (
        <TypeGridDropdown currentType={ctx.elementType!} onSelect={handleTypeSelect} />
      )}
      {dropdownMode === 'add-child' && addChildCtx && (
        <PickerDropdown
          ctx={addChildCtx}
          onSuggestionClick={handleAddChildSuggestion}
          onActionClick={handleActionClick}
        />
      )}
      {dropdownMode === 'suggestions' && (
        <PickerDropdown
          ctx={ctx}
          onSuggestionClick={handleSuggestionClick}
          onActionClick={handleActionClick}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TwoZonePill
// ---------------------------------------------------------------------------

function TwoZonePill({
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Position computation
// ---------------------------------------------------------------------------

function computePosition(
  ctx: PickerContext,
  pickerSlot: { name: string; position: { x: number; y: number } } | null,
  width: number,
  height: number,
): { x: number; y: number } {
  if (ctx.kind === 'empty-slot' && pickerSlot) {
    return { x: pickerSlot.position.x, y: pickerSlot.position.y - 20 };
  }
  if (ctx.elementBounds) {
    const b = ctx.elementBounds;
    const cx = ((b.x + b.w / 2) / 100) * width;
    const ty = (b.y / 100) * height - 8;
    return { x: cx, y: Math.max(0, ty) };
  }
  return { x: width / 2, y: 40 };
}
