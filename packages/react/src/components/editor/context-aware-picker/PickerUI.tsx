/**
 * PickerUI — Shared UI primitives for the context-aware picker.
 *
 * Extracted from ContextAwarePicker to satisfy the 300-line limit (C1).
 * Contains icon maps, atomic UI components, compound dropdown, and position helper.
 */

import React from 'react';
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
import type { PickerContext, SuggestionItem, ActionItem } from './picker-context.js';
import { EDITOR_COLORS } from '../editor-colors.js';

// ---------------------------------------------------------------------------
// Icon maps
// ---------------------------------------------------------------------------

export const ICON_SIZE = 14;

export const TYPE_ICONS: Record<string, React.ReactNode> = {
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

export const ACTION_ICONS: Record<string, React.ReactNode> = {
  'edit-text': <PencilSimple size={ICON_SIZE} />,
  'delete': <Trash size={ICON_SIZE} />,
  'style': <Palette size={ICON_SIZE} />,
  'add-child': <Plus size={ICON_SIZE} />,
  'change-type': <Swap size={ICON_SIZE} />,
};

// ---------------------------------------------------------------------------
// SectionLabel
// ---------------------------------------------------------------------------

export function SectionLabel({ text }: { text: string }) {
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

// ---------------------------------------------------------------------------
// SuggestionButton
// ---------------------------------------------------------------------------

export function SuggestionButton({ item, onClick }: { item: SuggestionItem; onClick: () => void }) {
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

// ---------------------------------------------------------------------------
// ActionButton
// ---------------------------------------------------------------------------

export function ActionButton({ item, onClick }: { item: ActionItem; onClick: () => void }) {
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
// PickerPill
// ---------------------------------------------------------------------------

export function PickerPill({
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
// computePosition
// ---------------------------------------------------------------------------

export function computePosition(
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

// ---------------------------------------------------------------------------
// PickerDropdown
// ---------------------------------------------------------------------------

export function PickerDropdown({
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

      {hasSuggestions && hasActions && (
        <div style={{ borderTop: `1px solid ${EDITOR_COLORS.border}`, margin: '6px 0' }} />
      )}

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
