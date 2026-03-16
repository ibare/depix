import { describe, it, expect } from 'vitest';
import {
  getSuggestionsForSlot,
  getActionsForElement,
} from '../../src/components/editor/context-aware-picker/picker-suggestions.js';

// ---------------------------------------------------------------------------
// getSuggestionsForSlot
// ---------------------------------------------------------------------------

describe('getSuggestionsForSlot', () => {
  it('returns all elements for header slot', () => {
    const suggestions = getSuggestionsForSlot('header');
    const types = suggestions.map((s) => s.type);
    expect(types).toContain('heading');
    expect(types).toContain('stat');
    expect(types).toContain('quote');
    expect(types).toHaveLength(8);
    expect(suggestions.every((s) => s.category === 'element')).toBe(true);
  });

  it('returns elements and blocks for body slot', () => {
    const suggestions = getSuggestionsForSlot('body');
    const elements = suggestions.filter((s) => s.category === 'element');
    const blocks = suggestions.filter((s) => s.category === 'block');
    expect(elements.length).toBeGreaterThan(0);
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('returns same suggestions for main and body slots', () => {
    const body = getSuggestionsForSlot('body');
    const main = getSuggestionsForSlot('main');
    expect(body).toEqual(main);
  });

  it('returns elements only for cell slot', () => {
    const suggestions = getSuggestionsForSlot('cell');
    const types = suggestions.map((s) => s.type);
    expect(types).toContain('stat');
    expect(types).toContain('node');
    expect(types).toContain('image');
    expect(suggestions.every((s) => s.category === 'element')).toBe(true);
  });

  it('returns heading, image, quote + flow for focus slot', () => {
    const suggestions = getSuggestionsForSlot('focus');
    const types = suggestions.map((s) => s.type);
    expect(types).toContain('heading');
    expect(types).toContain('image');
    expect(types).toContain('quote');
    expect(types).toContain('flow');
  });

  it('returns side-specific suggestions', () => {
    const suggestions = getSuggestionsForSlot('side');
    const types = suggestions.map((s) => s.type);
    expect(types).toContain('list');
    expect(types).toContain('bullet');
    expect(types).toContain('stat');
    expect(types).toContain('stack');
  });

  it('returns all options for unknown slot', () => {
    const suggestions = getSuggestionsForSlot('unknown-slot');
    expect(suggestions.length).toBe(14); // 8 elements + 6 blocks
  });

  it('returns all options for empty string slot', () => {
    const suggestions = getSuggestionsForSlot('');
    expect(suggestions.length).toBe(14);
  });

  it('all suggestions have type, label, and category', () => {
    const suggestions = getSuggestionsForSlot('header');
    for (const s of suggestions) {
      expect(typeof s.type).toBe('string');
      expect(typeof s.label).toBe('string');
      expect(['element', 'block']).toContain(s.category);
    }
  });
});

// ---------------------------------------------------------------------------
// getActionsForElement
// ---------------------------------------------------------------------------

describe('getActionsForElement', () => {
  it('returns edit-text and delete for heading', () => {
    const actions = getActionsForElement('heading');
    const actionNames = actions.map((a) => a.action);
    expect(actionNames).toContain('edit-text');
    expect(actionNames).toContain('delete');
  });

  it('returns edit-text and delete for bullet', () => {
    const actions = getActionsForElement('bullet');
    expect(actions.map((a) => a.action)).toContain('edit-text');
  });

  it('returns edit-text and delete for stat', () => {
    const actions = getActionsForElement('stat');
    expect(actions.map((a) => a.action)).toEqual(['edit-text', 'delete']);
  });

  it('returns edit-text, style, delete for node', () => {
    const actions = getActionsForElement('node');
    const actionNames = actions.map((a) => a.action);
    expect(actionNames).toEqual(['edit-text', 'style', 'delete']);
  });

  it('returns add-child, change-type, delete for flow block', () => {
    const actions = getActionsForElement('flow');
    const actionNames = actions.map((a) => a.action);
    expect(actionNames).toContain('add-child');
    expect(actionNames).toContain('change-type');
    expect(actionNames).toContain('delete');
  });

  it('returns block actions for all block types', () => {
    const blockTypes = ['flow', 'tree', 'grid', 'stack', 'table', 'chart'];
    for (const type of blockTypes) {
      const actions = getActionsForElement(type);
      expect(actions.map((a) => a.action)).toContain('add-child');
    }
  });

  it('returns delete-only for image', () => {
    const actions = getActionsForElement('image');
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe('delete');
    expect(actions[0].variant).toBe('danger');
  });

  it('returns delete-only for divider', () => {
    const actions = getActionsForElement('divider');
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe('delete');
  });

  it('returns default text actions for unknown type', () => {
    const actions = getActionsForElement('unknown-type');
    const actionNames = actions.map((a) => a.action);
    expect(actionNames).toContain('edit-text');
    expect(actionNames).toContain('delete');
  });

  it('delete action always has danger variant', () => {
    const types = ['heading', 'node', 'flow', 'image'];
    for (const type of types) {
      const actions = getActionsForElement(type);
      const deleteAction = actions.find((a) => a.action === 'delete');
      expect(deleteAction?.variant).toBe('danger');
    }
  });

  it('all actions have action and label fields', () => {
    const actions = getActionsForElement('heading');
    for (const a of actions) {
      expect(typeof a.action).toBe('string');
      expect(typeof a.label).toBe('string');
    }
  });
});
