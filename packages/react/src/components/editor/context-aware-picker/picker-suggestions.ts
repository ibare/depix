/**
 * picker-suggestions — Slot-based suggestion mappings and element action mappings.
 *
 * Pure data + lookup functions. No React dependency.
 */

import { ATOMIC_COMPOUND_TYPES } from '@depix/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SuggestionItem {
  type: string;
  label: string;
  category: 'element' | 'block';
}

export interface ActionItem {
  action: string;
  label: string;
  variant?: 'default' | 'danger';
}

// ---------------------------------------------------------------------------
// All available options
// ---------------------------------------------------------------------------

export const ALL_ELEMENTS: SuggestionItem[] = [
  { type: 'heading', label: 'Heading', category: 'element' },
  { type: 'text', label: 'Text', category: 'element' },
  { type: 'label', label: 'Label', category: 'element' },
  { type: 'bullet', label: 'Bullet', category: 'element' },
  { type: 'stat', label: 'Stat', category: 'element' },
  { type: 'quote', label: 'Quote', category: 'element' },
  { type: 'step', label: 'Step', category: 'element' },
  { type: 'list', label: 'List', category: 'element' },
  { type: 'icon', label: 'Icon', category: 'element' },
  { type: 'image', label: 'Image', category: 'element' },
  { type: 'node', label: 'Node', category: 'element' },
  { type: 'divider', label: 'Divider', category: 'element' },
];

export const ALL_BLOCKS: SuggestionItem[] = [
  { type: 'flow', label: 'Flow', category: 'block' },
  { type: 'tree', label: 'Tree', category: 'block' },
  { type: 'grid', label: 'Grid', category: 'block' },
  { type: 'stack', label: 'Stack', category: 'block' },
  { type: 'table', label: 'Table', category: 'block' },
  { type: 'chart', label: 'Chart', category: 'block' },
];

// ---------------------------------------------------------------------------
// Slot → suggestion mapping
// ---------------------------------------------------------------------------

function pick(types: string[], source: SuggestionItem[]): SuggestionItem[] {
  return types.map((t) => source.find((s) => s.type === t)!).filter(Boolean);
}

const SLOT_SUGGESTIONS: Record<string, SuggestionItem[]> = {
  header: [...ALL_ELEMENTS],
  body: [...ALL_ELEMENTS, ...ALL_BLOCKS],
  main: [...ALL_ELEMENTS, ...ALL_BLOCKS],
  side: [...ALL_ELEMENTS, ...pick(['stack'], ALL_BLOCKS)],
  cell: [...ALL_ELEMENTS],
  focus: [...ALL_ELEMENTS, ...pick(['flow'], ALL_BLOCKS)],
};

export function getSuggestionsForSlot(slotName: string): SuggestionItem[] {
  return SLOT_SUGGESTIONS[slotName] ?? [...ALL_ELEMENTS, ...ALL_BLOCKS];
}

// ---------------------------------------------------------------------------
// Element type → action mapping
// ---------------------------------------------------------------------------

const TEXT_ACTIONS: ActionItem[] = [
  { action: 'edit-text', label: 'Edit text' },
  { action: 'delete', label: 'Delete', variant: 'danger' },
];

const NODE_ACTIONS: ActionItem[] = [
  { action: 'edit-text', label: 'Edit text' },
  { action: 'style', label: 'Style' },
  { action: 'delete', label: 'Delete', variant: 'danger' },
];

const BLOCK_ACTIONS: ActionItem[] = [
  { action: 'add-child', label: 'Add child' },
  { action: 'change-type', label: 'Change type' },
  { action: 'delete', label: 'Delete', variant: 'danger' },
];

const CONTENT_BLOCK_ACTIONS: ActionItem[] = [
  { action: 'add-child', label: 'Add child' },
  { action: 'delete', label: 'Delete', variant: 'danger' },
];

const ELEMENT_ACTIONS: Record<string, ActionItem[]> = {
  heading: TEXT_ACTIONS,
  bullet: CONTENT_BLOCK_ACTIONS,
  stat: TEXT_ACTIONS,
  quote: TEXT_ACTIONS,
  list: CONTENT_BLOCK_ACTIONS,
  image: [{ action: 'delete', label: 'Delete', variant: 'danger' }],
  divider: [{ action: 'delete', label: 'Delete', variant: 'danger' }],
  node: NODE_ACTIONS,
  flow: BLOCK_ACTIONS,
  tree: BLOCK_ACTIONS,
  grid: BLOCK_ACTIONS,
  stack: BLOCK_ACTIONS,
  table: BLOCK_ACTIONS,
  chart: BLOCK_ACTIONS,
};

export function getActionsForElement(elementType: string): ActionItem[] {
  return ELEMENT_ACTIONS[elementType] ?? TEXT_ACTIONS;
}

// ---------------------------------------------------------------------------
// Block child suggestions (per block type)
// ---------------------------------------------------------------------------

const BLOCK_CHILD_ITEMS: SuggestionItem[] = [
  { type: 'item', label: 'Item', category: 'element' },
];

const CONTENT_BLOCK_CHILDREN: Record<string, SuggestionItem[]> = {
  bullet: BLOCK_CHILD_ITEMS,
  list: BLOCK_CHILD_ITEMS,
};

/**
 * Get valid child suggestions for a specific block container type.
 * Content blocks (bullet, list) only accept their specific children.
 * Layout blocks accept all elements and blocks.
 */
export function getSuggestionsForBlock(blockType: string): SuggestionItem[] {
  return CONTENT_BLOCK_CHILDREN[blockType] ?? [...ALL_ELEMENTS, ...ALL_BLOCKS];
}

export function getSuggestionsForElementSwitch(currentType: string): SuggestionItem[] {
  const isCompound = (ATOMIC_COMPOUND_TYPES as Set<string>).has(currentType);
  return ALL_ELEMENTS.filter((s) => {
    if (s.type === currentType) return false;
    return (ATOMIC_COMPOUND_TYPES as Set<string>).has(s.type) === isCompound;
  });
}
