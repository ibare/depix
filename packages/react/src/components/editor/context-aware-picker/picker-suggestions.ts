/**
 * picker-suggestions — Slot-based suggestion mappings and element action mappings.
 *
 * Pure data + lookup functions. No React dependency.
 */

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

const ALL_ELEMENTS: SuggestionItem[] = [
  { type: 'heading', label: 'Heading', category: 'element' },
  { type: 'bullet', label: 'Bullet', category: 'element' },
  { type: 'stat', label: 'Stat', category: 'element' },
  { type: 'quote', label: 'Quote', category: 'element' },
  { type: 'list', label: 'List', category: 'element' },
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
  header: pick(['heading', 'stat', 'quote'], ALL_ELEMENTS),
  body: [
    ...pick(['heading', 'bullet', 'list'], ALL_ELEMENTS),
    ...pick(['flow', 'tree', 'grid', 'stack'], ALL_BLOCKS),
  ],
  main: [
    ...pick(['heading', 'bullet', 'list'], ALL_ELEMENTS),
    ...pick(['flow', 'tree', 'grid', 'stack'], ALL_BLOCKS),
  ],
  side: [
    ...pick(['list', 'bullet', 'stat'], ALL_ELEMENTS),
    ...pick(['stack'], ALL_BLOCKS),
  ],
  cell: pick(['stat', 'node', 'image'], ALL_ELEMENTS),
  focus: [
    ...pick(['heading', 'image', 'quote'], ALL_ELEMENTS),
    ...pick(['flow'], ALL_BLOCKS),
  ],
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

const ELEMENT_ACTIONS: Record<string, ActionItem[]> = {
  heading: TEXT_ACTIONS,
  bullet: TEXT_ACTIONS,
  stat: TEXT_ACTIONS,
  quote: TEXT_ACTIONS,
  list: TEXT_ACTIONS,
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
