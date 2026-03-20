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
import { useEditorStore, useEditorStoreApi } from '../../store/editor-store-context.js';
import { resolvePickerContext, type PickerContext, type SuggestionItem, type ActionItem } from './context-aware-picker/picker-context.js';
import { getSuggestionsForBlock } from './context-aware-picker/picker-suggestions.js';
import { PickerPill, PickerDropdown, computePosition } from './context-aware-picker/PickerUI.js';
import { TwoZonePill, ElementTwoZonePill } from './context-aware-picker/pill-components.js';
import { TypeGridDropdown } from './context-aware-picker/TypeGridDropdown.js';
import { ElementTypeDropdown } from './context-aware-picker/ElementTypeDropdown.js';

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

type DropdownMode = 'suggestions' | 'type-grid' | 'add-child' | 'element-type' | null;

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

  // --- Two-zone pill handlers (existing-element) ---
  const handleElementZoneClick = useCallback(() => {
    setDropdownMode((prev) => (prev === 'element-type' ? null : 'element-type'));
  }, []);

  const handleElementShapeZoneClick = useCallback(() => {
    setDropdownMode((prev) => (prev === 'type-grid' ? null : 'type-grid'));
  }, []);

  const handleElementTypeSelect = useCallback(
    (newType: string) => {
      onAction('change-element-type', { elementId: ctx.elementId, newType });
      setDropdownMode(null);
    },
    [onAction, ctx.elementId],
  );

  const handleParentShapeSelect = useCallback(
    (newType: string) => {
      if (ctx.parentIsSlot) {
        onAction('wrap-in-block', { slotName: ctx.slotName, blockType: newType });
      } else {
        onAction('change-type', { elementId: ctx.elementId, slotName: ctx.slotName, newType });
      }
      setDropdownMode(null);
    },
    [onAction, ctx.parentIsSlot, ctx.elementId, ctx.slotName],
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
      onAction('add-child', { elementId: ctx.elementId, type: item.type, category: item.category });
      setDropdownMode(null);
    },
    [onAction, ctx.elementId],
  );

  // Don't render for 'none' or 'empty-canvas'
  if (ctx.kind === 'none' || ctx.kind === 'empty-canvas') return null;

  const pos = computePosition(ctx, pickerSlot, width, height);
  const isBlock = ctx.kind === 'existing-block';
  const isElement = ctx.kind === 'existing-element';

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
      {isElement ? (
        <ElementTwoZonePill
          elementType={ctx.elementType!}
          parentContainerType={ctx.parentContainerType}
          onElementClick={handleElementZoneClick}
          onShapeClick={handleElementShapeZoneClick}
        />
      ) : isBlock ? (
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
      {dropdownMode === 'element-type' && isElement && (
        <ElementTypeDropdown currentType={ctx.elementType!} onSelect={handleElementTypeSelect} />
      )}
      {dropdownMode === 'type-grid' && isElement && (
        <TypeGridDropdown
          currentType={ctx.parentContainerType ?? 'flow'}
          onSelect={handleParentShapeSelect}
        />
      )}
      {dropdownMode === 'type-grid' && isBlock && (
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
