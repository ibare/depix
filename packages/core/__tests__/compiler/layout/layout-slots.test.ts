/**
 * Tests for Layout Slot Definitions — data-driven slot-role mappings and
 * cross-layout resolution helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  LAYOUT_DEFS,
  SLOT_ROLES,
  getLayoutDef,
  findSlotByRole,
  findRoleForSlot,
  resolveTargetSlot,
} from '../../../src/compiler/layout/layout-slots.js';

// ---------------------------------------------------------------------------
// LAYOUT_DEFS completeness
// ---------------------------------------------------------------------------

describe('LAYOUT_DEFS completeness', () => {
  const EXPECTED_PRESETS = [
    'full', 'center', 'split', 'rows', 'sidebar',
    'header', 'header-split', 'header-rows', 'header-sidebar',
    'grid', 'header-grid', 'focus', 'header-focus',
  ];

  it.each(EXPECTED_PRESETS)('has preset "%s"', (preset) => {
    expect(LAYOUT_DEFS[preset]).toBeDefined();
    expect(LAYOUT_DEFS[preset].slots.length).toBeGreaterThan(0);
  });

  it('contains exactly 13 presets (no "custom")', () => {
    expect(Object.keys(LAYOUT_DEFS)).toHaveLength(13);
    expect(LAYOUT_DEFS['custom']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Role validity
// ---------------------------------------------------------------------------

describe('Role validity', () => {
  it('every slot role in every layout exists in SLOT_ROLES', () => {
    for (const [layout, def] of Object.entries(LAYOUT_DEFS)) {
      for (const slot of def.slots) {
        expect(SLOT_ROLES[slot.role], `${layout}.${slot.name} role="${slot.role}"`).toBeDefined();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// getLayoutDef
// ---------------------------------------------------------------------------

describe('getLayoutDef', () => {
  it('returns definition for known presets', () => {
    const def = getLayoutDef('split');
    expect(def).toBeDefined();
    expect(def!.slots).toHaveLength(2);
  });

  it('returns undefined for "custom"', () => {
    expect(getLayoutDef('custom')).toBeUndefined();
  });

  it('returns undefined for unknown strings', () => {
    expect(getLayoutDef('nonexistent')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// findSlotByRole
// ---------------------------------------------------------------------------

describe('findSlotByRole', () => {
  it('finds the slot with matching role', () => {
    const def = getLayoutDef('header-split')!;
    expect(findSlotByRole(def, 'header')?.name).toBe('header');
    expect(findSlotByRole(def, 'splitA')?.name).toBe('left');
    expect(findSlotByRole(def, 'splitB')?.name).toBe('right');
  });

  it('returns undefined for missing role', () => {
    const def = getLayoutDef('full')!;
    expect(findSlotByRole(def, 'header')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// findRoleForSlot
// ---------------------------------------------------------------------------

describe('findRoleForSlot', () => {
  it('returns role for existing slot name', () => {
    const def = getLayoutDef('sidebar')!;
    expect(findRoleForSlot(def, 'main')).toBe('primary');
    expect(findRoleForSlot(def, 'side')).toBe('secondary');
  });

  it('returns undefined for unknown slot name', () => {
    const def = getLayoutDef('full')!;
    expect(findRoleForSlot(def, 'header')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveTargetSlot
// ---------------------------------------------------------------------------

describe('resolveTargetSlot', () => {
  it('header role → split layout → "left" (fallback: primary→splitA)', () => {
    expect(resolveTargetSlot('header', getLayoutDef('split')!)).toBe('left');
  });

  it('primary role → split layout → "left" (splitA)', () => {
    expect(resolveTargetSlot('primary', getLayoutDef('split')!)).toBe('left');
  });

  it('primary role → header layout → "body" (direct match)', () => {
    expect(resolveTargetSlot('primary', getLayoutDef('header')!)).toBe('body');
  });

  it('splitA role → full layout → "body" (fallback: primary)', () => {
    expect(resolveTargetSlot('splitA', getLayoutDef('full')!)).toBe('body');
  });

  it('splitB role → full layout → "body" (fallback: secondary→primary)', () => {
    expect(resolveTargetSlot('splitB', getLayoutDef('full')!)).toBe('body');
  });

  it('repeat role → full layout → "body" (fallback: primary)', () => {
    expect(resolveTargetSlot('repeat', getLayoutDef('full')!)).toBe('body');
  });

  it('focus role → header layout → "body" (fallback: primary)', () => {
    expect(resolveTargetSlot('focus', getLayoutDef('header')!)).toBe('body');
  });

  it('header role → full layout → "body" (fallback: primary)', () => {
    expect(resolveTargetSlot('header', getLayoutDef('full')!)).toBe('body');
  });
});
