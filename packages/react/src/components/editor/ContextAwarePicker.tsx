/**
 * ContextAwarePicker — Context-aware pill + dropdown picker overlay.
 *
 * Shows a pill attached above the selected element or slot, with
 * contextual suggestions and actions based on the current selection.
 */

import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import type { DepixIR } from '@depix/core';
import {
  CaretDown,
  CaretUp,
  Plus,
  TextHOne,
  ListBullets,
  Hash,
  Quotes,
  List,
  Image,
  Square,
  Minus,
  ArrowRight,
  TreeStructure,
  GridFour,
  Stack,
  Table,
  ChartBar,
  PencilSimple,
  Trash,
  Palette,
  Swap,
} from '@phosphor-icons/react';
import { useEditorStore, useEditorStoreApi } from '../../store/editor-store-context.js';
import { resolvePickerContext, type PickerContext, type SuggestionItem, type ActionItem } from './context-aware-picker/picker-context.js';
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

// ---------------------------------------------------------------------------
// Icon map
// ---------------------------------------------------------------------------

const ICON_SIZE = 14;

const TYPE_ICONS: Record<string, React.ReactNode> = {
  heading: <TextHOne size={ICON_SIZE} />,
  bullet: <ListBullets size={ICON_SIZE} />,
  stat: <Hash size={ICON_SIZE} />,
  quote: <Quotes size={ICON_SIZE} />,
  list: <List size={ICON_SIZE} />,
  image: <Image size={ICON_SIZE} />,
  node: <Square size={ICON_SIZE} />,
  divider: <Minus size={ICON_SIZE} />,
  flow: <ArrowRight size={ICON_SIZE} />,
  tree: <TreeStructure size={ICON_SIZE} />,
  grid: <GridFour size={ICON_SIZE} />,
  stack: <Stack size={ICON_SIZE} />,
  table: <Table size={ICON_SIZE} />,
  chart: <ChartBar size={ICON_SIZE} />,
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  'edit-text': <PencilSimple size={ICON_SIZE} />,
  'delete': <Trash size={ICON_SIZE} />,
  'style': <Palette size={ICON_SIZE} />,
  'add-child': <Plus size={ICON_SIZE} />,
  'change-type': <Swap size={ICON_SIZE} />,
};

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
  const pickerExpanded = useEditorStore((s) => s.pickerExpanded);
  const storeApi = useEditorStoreApi();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const ctx = useMemo<PickerContext>(
    () => resolvePickerContext({ selectedIds, pickerSlot, ir, activeSceneIndex }),
    [selectedIds, pickerSlot, ir, activeSceneIndex],
  );

  // Close on outside click
  useEffect(() => {
    if (!pickerExpanded) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        storeApi.getState().setPickerExpanded(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerExpanded, storeApi]);

  const toggleExpanded = useCallback(() => {
    storeApi.getState().setPickerExpanded(!pickerExpanded);
  }, [pickerExpanded, storeApi]);

  const handleSuggestionClick = useCallback(
    (item: SuggestionItem) => {
      onAction('add-content', { type: item.type, category: item.category });
      storeApi.getState().setPickerExpanded(false);
    },
    [onAction, storeApi],
  );

  const handleActionClick = useCallback(
    (item: ActionItem) => {
      onAction(item.action, { elementId: ctx.elementId, elementType: ctx.elementType });
      storeApi.getState().setPickerExpanded(false);
    },
    [onAction, ctx.elementId, ctx.elementType, storeApi],
  );

  // Don't render for 'none' or 'empty-canvas'
  if (ctx.kind === 'none' || ctx.kind === 'empty-canvas') return null;

  // Position: above the target bounds or at pickerSlot position
  const pos = computePosition(ctx, pickerSlot, width, height);

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
      <PickerPill
        label={ctx.label}
        kind={ctx.kind}
        expanded={pickerExpanded}
        onToggle={toggleExpanded}
      />

      {/* Dropdown */}
      {pickerExpanded && (
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
// PickerPill
// ---------------------------------------------------------------------------

function PickerPill({
  label,
  kind,
  expanded,
  onToggle,
}: {
  label: string;
  kind: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isSlot = kind === 'empty-slot';

  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px',
        background: EDITOR_COLORS.bg,
        border: `1px solid ${EDITOR_COLORS.border}`,
        borderRadius: 16,
        color: EDITOR_COLORS.text,
        fontSize: 11,
        fontWeight: 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      {isSlot && <Plus size={12} weight="bold" />}
      <span>{label}</span>
      {expanded ? <CaretUp size={10} /> : <CaretDown size={10} />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// PickerDropdown
// ---------------------------------------------------------------------------

function PickerDropdown({
  ctx,
  onSuggestionClick,
  onActionClick,
}: {
  ctx: PickerContext;
  onSuggestionClick: (item: SuggestionItem) => void;
  onActionClick: (item: ActionItem) => void;
}) {
  const elements = ctx.suggestions.filter((s) => s.category === 'element');
  const blocks = ctx.suggestions.filter((s) => s.category === 'block');
  const hasSuggestions = ctx.suggestions.length > 0;
  const hasActions = ctx.actions.length > 0;

  return (
    <div
      style={{
        marginTop: 4,
        background: EDITOR_COLORS.bg,
        border: `1px solid ${EDITOR_COLORS.border}`,
        borderRadius: 8,
        padding: 8,
        minWidth: 180,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      {/* Suggestions */}
      {hasSuggestions && (
        <>
          {elements.length > 0 && (
            <>
              <SectionLabel text="Elements" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                {elements.map((item) => (
                  <SuggestionButton key={item.type} item={item} onClick={() => onSuggestionClick(item)} />
                ))}
              </div>
            </>
          )}
          {blocks.length > 0 && (
            <>
              <SectionLabel text="Blocks" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                {blocks.map((item) => (
                  <SuggestionButton key={item.type} item={item} onClick={() => onSuggestionClick(item)} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Divider between suggestions and actions */}
      {hasSuggestions && hasActions && (
        <div style={{ borderTop: `1px solid ${EDITOR_COLORS.border}`, margin: '6px 0' }} />
      )}

      {/* Actions */}
      {hasActions && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {ctx.actions.map((item) => (
            <ActionButton key={item.action} item={item} onClick={() => onActionClick(item)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ text }: { text: string }) {
  return (
    <div
      style={{
        fontSize: 9,
        color: EDITOR_COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        padding: '4px 4px 2px',
      }}
    >
      {text}
    </div>
  );
}

function SuggestionButton({ item, onClick }: { item: SuggestionItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 6px',
        background: EDITOR_COLORS.bgLight,
        border: `1px solid ${EDITOR_COLORS.border}`,
        borderRadius: 4,
        color: EDITOR_COLORS.text,
        fontSize: 10,
        cursor: 'pointer',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center' }}>{TYPE_ICONS[item.type] ?? <Square size={ICON_SIZE} />}</span>
      <span>{item.label}</span>
    </button>
  );
}

function ActionButton({ item, onClick }: { item: ActionItem; onClick: () => void }) {
  const isDanger = item.variant === 'danger';
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        background: 'transparent',
        border: 'none',
        borderRadius: 4,
        color: isDanger ? EDITOR_COLORS.danger : EDITOR_COLORS.text,
        fontSize: 11,
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center' }}>{ACTION_ICONS[item.action] ?? null}</span>
      <span>{item.label}</span>
    </button>
  );
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
  // For slot picker, use the slot's stored position
  if (ctx.kind === 'empty-slot' && pickerSlot) {
    return { x: pickerSlot.position.x, y: pickerSlot.position.y - 20 };
  }

  // For element/block with bounds, position above the element
  if (ctx.elementBounds) {
    const b = ctx.elementBounds;
    const cx = ((b.x + b.w / 2) / 100) * width;
    const ty = (b.y / 100) * height - 8;
    return { x: cx, y: Math.max(0, ty) };
  }

  // Fallback: center of canvas
  return { x: width / 2, y: 40 };
}
