/**
 * picker-context — Pure logic for determining picker context from editor state.
 *
 * No React dependency. Receives raw state and returns a PickerContext
 * describing what the picker should show.
 */

import type { DepixIR, IRElement, IRBounds, IRContainer } from '@depix/core';
import { findElement, getElementParent, PICKER_BLOCK_TYPES, LAYOUT_TYPES } from '@depix/core';
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
  containerCategory?: 'layout' | 'content';
  /** Parent container layout type for existing-element ('flow','grid',...). Undefined = defaults to flow. */
  parentContainerType?: string;
  /** True when element is a direct scene-slot child with no block wrapper. */
  parentIsSlot?: boolean;
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
  if (element.origin?.dslType) return element.origin.dslType;
  const meta = (element as IRElement & { metadata?: Record<string, unknown> }).metadata;
  if (meta && typeof meta.dslType === 'string') return meta.dslType;

  if (element.type === 'container') {
    const origin = element.origin;
    // scene-slot containers carry the inner block type in sourceProps.blockType
    if (origin?.sourceProps?.blockType && typeof origin.sourceProps.blockType === 'string') {
      return origin.sourceProps.blockType;
    }
    // Direct layout/content containers (not scene-slot wrapped)
    if (origin?.sourceType && PICKER_BLOCK_TYPES.has(origin.sourceType)) {
      return origin.sourceType;
    }
    return 'flow';
  }

  switch (element.type) {
    case 'text': return 'heading';
    case 'shape': return 'node';
    case 'image': return 'image';
    default: return element.type;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

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
  const isBlock = PICKER_BLOCK_TYPES.has(dslType);
  const isBoxContainer = dslType === 'box' || dslType === 'layer';
  const slotName = element.origin?.sourceType === 'scene-slot'
    ? element.origin.slotName
    : undefined;

  if (isBlock || isBoxContainer) {
    return {
      kind: 'existing-block',
      slotName,
      elementId: id,
      elementType: dslType,
      elementBounds: element.bounds,
      containerCategory: LAYOUT_TYPES.has(dslType) ? 'layout' : 'content',
      suggestions: [],
      actions: getActionsForElement(dslType),
      label: capitalize(dslType),
    };
  }

  // Detect parent container to surface element type change and parent layout change
  let parentContainerType: string | undefined;
  let parentIsSlot = false;
  let elementSlotName: string | undefined;

  if (scene) {
    const parent = getElementParent(scene, id);
    if (parent && !('elements' in parent)) {
      // parent is IRContainer (IRScene has 'elements', IRContainer has 'children')
      const pc = parent as IRContainer;
      if (pc.origin?.sourceType === 'scene-slot') {
        const blockType = pc.origin.sourceProps?.blockType;
        if (typeof blockType === 'string' && PICKER_BLOCK_TYPES.has(blockType)) {
          parentContainerType = blockType;
        } else {
          parentIsSlot = true;
        }
        elementSlotName = pc.origin.slotName;
      }
    }
  }

  return {
    kind: 'existing-element',
    elementId: id,
    elementType: dslType,
    elementBounds: element.bounds,
    slotName: elementSlotName,
    parentContainerType,
    parentIsSlot,
    suggestions: [],
    actions: getActionsForElement(dslType),
    label: capitalize(dslType),
  };
}
