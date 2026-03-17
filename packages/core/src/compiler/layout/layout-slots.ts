/**
 * Layout Slot Definitions — Data-driven slot-role mappings for all layout presets.
 *
 * When a new layout preset is added, only this file needs to be updated.
 * The distribution algorithm in @depix/editor reads these definitions
 * to redistribute children across slots during layout changes.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlotRole {
  /** Lower = higher precedence when resolving fallbacks. */
  priority: number;
  /** Role names to try when the target layout lacks this role. */
  fallback: string[];
}

export interface SlotDef {
  /** Slot name as used in DSL (e.g. 'header', 'body', 'left'). */
  name: string;
  /** Semantic role for cross-layout mapping. */
  role: string;
}

export interface LayoutDef {
  /** Ordered slot definitions for this layout preset. */
  slots: SlotDef[];
}

// ---------------------------------------------------------------------------
// Role definitions
// ---------------------------------------------------------------------------

export const SLOT_ROLES: Record<string, SlotRole> = {
  header:    { priority: 0, fallback: ['primary', 'splitA', 'focus'] },
  primary:   { priority: 1, fallback: ['splitA', 'focus', 'repeat'] },
  secondary: { priority: 2, fallback: ['splitB', 'primary'] },
  splitA:    { priority: 1, fallback: ['primary', 'focus'] },
  splitB:    { priority: 2, fallback: ['secondary', 'primary'] },
  focus:     { priority: 1, fallback: ['primary', 'splitA'] },
  repeat:    { priority: 3, fallback: ['primary', 'splitA'] },
};

// ---------------------------------------------------------------------------
// Layout preset → slot mappings
// ---------------------------------------------------------------------------

export const LAYOUT_DEFS: Record<string, LayoutDef> = {
  full:              { slots: [{ name: 'body',   role: 'primary' }] },
  center:            { slots: [{ name: 'body',   role: 'primary' }] },
  split:             { slots: [{ name: 'left',   role: 'splitA' },  { name: 'right',  role: 'splitB' }] },
  rows:              { slots: [{ name: 'top',    role: 'splitA' },  { name: 'bottom', role: 'splitB' }] },
  sidebar:           { slots: [{ name: 'main',   role: 'primary' }, { name: 'side',   role: 'secondary' }] },
  header:            { slots: [{ name: 'header', role: 'header' },  { name: 'body',   role: 'primary' }] },
  'header-split':    { slots: [{ name: 'header', role: 'header' },  { name: 'left',   role: 'splitA' },  { name: 'right',  role: 'splitB' }] },
  'header-rows':     { slots: [{ name: 'header', role: 'header' },  { name: 'top',    role: 'splitA' },  { name: 'bottom', role: 'splitB' }] },
  'header-sidebar':  { slots: [{ name: 'header', role: 'header' },  { name: 'main',   role: 'primary' }, { name: 'side',   role: 'secondary' }] },
  grid:              { slots: [{ name: 'cell',   role: 'repeat' }] },
  'header-grid':     { slots: [{ name: 'header', role: 'header' },  { name: 'cell',   role: 'repeat' }] },
  focus:             { slots: [{ name: 'focus',  role: 'focus' },   { name: 'cell',   role: 'repeat' }] },
  'header-focus':    { slots: [{ name: 'header', role: 'header' },  { name: 'focus',  role: 'focus' },   { name: 'cell',   role: 'repeat' }] },
};

// ---------------------------------------------------------------------------
// Promotion rules — element types promoted to a role when it newly appears
// ---------------------------------------------------------------------------

export const PROMOTE_RULES: Record<string, string[]> = {
  header: ['heading', 'stat'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Look up a layout definition by preset name. Returns undefined for 'custom' or unknown. */
export function getLayoutDef(layoutType: string): LayoutDef | undefined {
  return LAYOUT_DEFS[layoutType];
}

/** Find the first slot with a given role in a layout definition. */
export function findSlotByRole(def: LayoutDef, role: string): SlotDef | undefined {
  return def.slots.find(s => s.role === role);
}

/** Find the role assigned to a named slot in a layout definition. */
export function findRoleForSlot(def: LayoutDef, slotName: string): string | undefined {
  return def.slots.find(s => s.name === slotName)?.role;
}

/**
 * Resolve the best target slot name in newDef for a child that was in a slot with oldRole.
 *
 * Resolution order:
 * 1. Same role in new layout (direct match)
 * 2. Fallback chain from SLOT_ROLES
 * 3. First non-header slot in new layout
 */
export function resolveTargetSlot(oldRole: string, newDef: LayoutDef): string | null {
  // 1. Direct role match
  const direct = findSlotByRole(newDef, oldRole);
  if (direct) return direct.name;

  // 2. Fallback chain
  const roleInfo = SLOT_ROLES[oldRole];
  if (roleInfo) {
    for (const fb of roleInfo.fallback) {
      const match = findSlotByRole(newDef, fb);
      if (match) return match.name;
    }
  }

  // 3. First non-header slot
  const nonHeader = newDef.slots.find(s => s.role !== 'header');
  return nonHeader?.name ?? newDef.slots[0]?.name ?? null;
}
