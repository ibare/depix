/**
 * picker-context — Pure logic for determining picker context from editor state.
 *
 * No React dependency. Receives raw state and returns a PickerContext
 * describing what the picker should show.
 */

import type { DepixIR, IRElement, IRBounds } from '@depix/core';
import { findElement } from '@depix/core';
import { getSuggestionsForSlot, getActionsForElement, type SuggestionItem, type ActionItem } from './picker-suggestions.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PickerContextKind =
  | 'empty-canvas'
  | 'empty-slot'
  | 'existing-element'
  | 'existing-block'
  | 'multi-selection'
  | 'none';

export interface PickerContext {
  kind: PickerContextKind;
  slotName?: string;
  elementId?: string;
  elementType?: string;
  elementBounds?: IRBounds;
  suggestions: SuggestionItem[];
  actions: ActionItem[];
  label: string;
}

export type { SuggestionItem, ActionItem };

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface ResolvePickerInput {
  selectedIds: string[];
  pickerSlot: { name: string; position: { x: number; y: number } } | null;
  ir: DepixIR | null;
  activeSceneIndex: number;
}

// ---------------------------------------------------------------------------
// Helpers (placed before resolver to avoid hoisting issues with HMR)
// ---------------------------------------------------------------------------

const NONE: PickerContext = {
  kind: 'none',
  suggestions: [],
  actions: [],
  label: '',
};

/**
 * Infer DSL element type from IR element.
 * IR elements carry metadata.dslType when compiled from DSL.
 * Falls back to IR type if metadata is absent.
 */
function inferDSLType(element: IRElement): string {
  const meta = (element as IRElement & { metadata?: Record<string, unknown> }).metadata;
  if (meta && typeof meta.dslType === 'string') return meta.dslType;

  switch (element.type) {
    case 'text': return 'heading';
    case 'shape': return 'node';
    case 'image': return 'image';
    case 'container': return 'flow';
    default: return element.type;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

const BLOCK_TYPES = new Set(['flow', 'tree', 'grid', 'stack', 'table', 'chart']);

export function resolvePickerContext(input: ResolvePickerInput): PickerContext {
  const { selectedIds, pickerSlot, ir, activeSceneIndex } = input;
  const scene = ir?.scenes[activeSceneIndex] ?? null;

  // 1. pickerSlot open → empty-slot
  if (pickerSlot) {
    const suggestions = getSuggestionsForSlot(pickerSlot.name);
    return {
      kind: 'empty-slot',
      slotName: pickerSlot.name,
      suggestions,
      actions: [],
      label: `Add to ${pickerSlot.name}`,
    };
  }

  // 2. No selection, no scene elements → empty-canvas
  if (selectedIds.length === 0) {
    if (!scene || scene.elements.length === 0) {
      return {
        kind: 'empty-canvas',
        suggestions: [],
        actions: [],
        label: 'Empty canvas',
      };
    }
    return NONE;
  }

  // 3. Multi-selection
  if (selectedIds.length > 1) {
    return {
      kind: 'multi-selection',
      suggestions: [],
      actions: [{ action: 'delete', label: 'Delete all', variant: 'danger' }],
      label: `${selectedIds.length} selected`,
    };
  }

  // 4. Single selection — determine element or block
  const id = selectedIds[0];
  const element = ir ? findElement(ir, id) : undefined;

  if (!element) return NONE;

  const dslType = inferDSLType(element);
  const isBlock = BLOCK_TYPES.has(dslType);

  if (isBlock) {
    return {
      kind: 'existing-block',
      elementId: id,
      elementType: dslType,
      elementBounds: element.bounds,
      suggestions: [],
      actions: getActionsForElement(dslType),
      label: capitalize(dslType),
    };
  }

  return {
    kind: 'existing-element',
    elementId: id,
    elementType: dslType,
    elementBounds: element.bounds,
    suggestions: [],
    actions: getActionsForElement(dslType),
    label: capitalize(dslType),
  };
}
