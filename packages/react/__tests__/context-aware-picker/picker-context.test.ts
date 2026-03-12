import { describe, it, expect } from 'vitest';
import { resolvePickerContext } from '../../src/components/editor/context-aware-picker/picker-context.js';
import type { DepixIR, IRElement } from '@depix/core';
import type { ResolvePickerInput } from '../../src/components/editor/context-aware-picker/picker-context.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIR(elements: IRElement[] = []): DepixIR {
  return {
    meta: { width: 1920, height: 1080, unit: 'px' as const },
    scenes: [{ id: 'scene-0', elements }],
    transitions: [],
  };
}

function makeTextElement(id: string): IRElement {
  return {
    id,
    type: 'text',
    bounds: { x: 10, y: 10, w: 30, h: 10 },
    style: {},
    content: 'Hello',
    fontSize: 14,
  } as IRElement;
}

function makeShapeElement(id: string): IRElement {
  return {
    id,
    type: 'shape',
    bounds: { x: 20, y: 20, w: 20, h: 20 },
    style: {},
    shape: 'rect',
  } as IRElement;
}

function makeContainerElement(id: string, children: IRElement[]): IRElement {
  return {
    id,
    type: 'container',
    bounds: { x: 0, y: 0, w: 100, h: 100 },
    style: {},
    children,
    metadata: { dslType: 'flow' },
  } as unknown as IRElement;
}

function defaultInput(overrides: Partial<ResolvePickerInput> = {}): ResolvePickerInput {
  return {
    selectedIds: [],
    pickerSlot: null,
    ir: null,
    activeSceneIndex: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolvePickerContext', () => {
  // -- none -----------------------------------------------------------------

  describe('kind: none', () => {
    it('returns none when no selection and scene has elements', () => {
      const ir = makeIR([makeTextElement('el-1')]);
      const ctx = resolvePickerContext(defaultInput({ ir }));
      expect(ctx.kind).toBe('none');
      expect(ctx.label).toBe('');
    });

    it('returns none when ir is null and no selection', () => {
      const ctx = resolvePickerContext(defaultInput());
      // No scene → empty-canvas
      expect(ctx.kind).toBe('empty-canvas');
    });

    it('returns none when selected element not found in IR', () => {
      const ir = makeIR([makeTextElement('el-1')]);
      const ctx = resolvePickerContext(defaultInput({ ir, selectedIds: ['nonexistent'] }));
      expect(ctx.kind).toBe('none');
    });
  });

  // -- empty-canvas ---------------------------------------------------------

  describe('kind: empty-canvas', () => {
    it('returns empty-canvas when ir is null', () => {
      const ctx = resolvePickerContext(defaultInput({ ir: null }));
      expect(ctx.kind).toBe('empty-canvas');
      expect(ctx.label).toBe('Empty canvas');
    });

    it('returns empty-canvas when scene has no elements', () => {
      const ir = makeIR([]);
      const ctx = resolvePickerContext(defaultInput({ ir }));
      expect(ctx.kind).toBe('empty-canvas');
    });

    it('returns empty-canvas when activeSceneIndex is out of range', () => {
      const ir = makeIR([makeTextElement('el-1')]);
      const ctx = resolvePickerContext(defaultInput({ ir, activeSceneIndex: 5 }));
      expect(ctx.kind).toBe('empty-canvas');
    });
  });

  // -- empty-slot -----------------------------------------------------------

  describe('kind: empty-slot', () => {
    it('returns empty-slot when pickerSlot is set', () => {
      const ctx = resolvePickerContext(
        defaultInput({ pickerSlot: { name: 'header', position: { x: 100, y: 50 } } }),
      );
      expect(ctx.kind).toBe('empty-slot');
      expect(ctx.slotName).toBe('header');
      expect(ctx.label).toBe('Add to header');
    });

    it('provides slot-specific suggestions for header', () => {
      const ctx = resolvePickerContext(
        defaultInput({ pickerSlot: { name: 'header', position: { x: 0, y: 0 } } }),
      );
      const types = ctx.suggestions.map((s) => s.type);
      expect(types).toContain('heading');
      expect(types).toContain('stat');
      expect(types).not.toContain('flow'); // blocks not recommended for header
    });

    it('provides default suggestions for unknown slot', () => {
      const ctx = resolvePickerContext(
        defaultInput({ pickerSlot: { name: 'custom-slot', position: { x: 0, y: 0 } } }),
      );
      expect(ctx.suggestions.length).toBeGreaterThan(8); // all elements + all blocks
    });

    it('pickerSlot takes priority over selectedIds', () => {
      const ir = makeIR([makeTextElement('el-1')]);
      const ctx = resolvePickerContext(
        defaultInput({
          ir,
          selectedIds: ['el-1'],
          pickerSlot: { name: 'body', position: { x: 0, y: 0 } },
        }),
      );
      expect(ctx.kind).toBe('empty-slot');
    });
  });

  // -- multi-selection ------------------------------------------------------

  describe('kind: multi-selection', () => {
    it('returns multi-selection when multiple ids selected', () => {
      const ir = makeIR([makeTextElement('el-1'), makeTextElement('el-2')]);
      const ctx = resolvePickerContext(defaultInput({ ir, selectedIds: ['el-1', 'el-2'] }));
      expect(ctx.kind).toBe('multi-selection');
      expect(ctx.label).toBe('2 selected');
    });

    it('provides delete action for multi-selection', () => {
      const ir = makeIR([makeTextElement('el-1'), makeTextElement('el-2')]);
      const ctx = resolvePickerContext(defaultInput({ ir, selectedIds: ['el-1', 'el-2'] }));
      expect(ctx.actions).toHaveLength(1);
      expect(ctx.actions[0].action).toBe('delete');
      expect(ctx.actions[0].variant).toBe('danger');
    });

    it('shows correct count for 3 selections', () => {
      const ir = makeIR([
        makeTextElement('el-1'),
        makeTextElement('el-2'),
        makeTextElement('el-3'),
      ]);
      const ctx = resolvePickerContext(
        defaultInput({ ir, selectedIds: ['el-1', 'el-2', 'el-3'] }),
      );
      expect(ctx.label).toBe('3 selected');
    });
  });

  // -- existing-element -----------------------------------------------------

  describe('kind: existing-element', () => {
    it('returns existing-element for a text element', () => {
      const ir = makeIR([makeTextElement('el-1')]);
      const ctx = resolvePickerContext(defaultInput({ ir, selectedIds: ['el-1'] }));
      expect(ctx.kind).toBe('existing-element');
      expect(ctx.elementId).toBe('el-1');
      expect(ctx.elementBounds).toEqual({ x: 10, y: 10, w: 30, h: 10 });
    });

    it('returns existing-element for a shape element', () => {
      const ir = makeIR([makeShapeElement('shape-1')]);
      const ctx = resolvePickerContext(defaultInput({ ir, selectedIds: ['shape-1'] }));
      expect(ctx.kind).toBe('existing-element');
      expect(ctx.elementId).toBe('shape-1');
    });

    it('provides actions for element type', () => {
      const ir = makeIR([makeTextElement('el-1')]);
      const ctx = resolvePickerContext(defaultInput({ ir, selectedIds: ['el-1'] }));
      const actions = ctx.actions.map((a) => a.action);
      expect(actions).toContain('edit-text');
      expect(actions).toContain('delete');
    });

    it('capitalizes label from element type', () => {
      const ir = makeIR([makeTextElement('el-1')]);
      const ctx = resolvePickerContext(defaultInput({ ir, selectedIds: ['el-1'] }));
      expect(ctx.label.charAt(0)).toBe(ctx.label.charAt(0).toUpperCase());
    });
  });

  // -- existing-block -------------------------------------------------------

  describe('kind: existing-block', () => {
    it('returns existing-block for a container with dslType flow', () => {
      const child = makeTextElement('child-1');
      const container = makeContainerElement('block-1', [child]);
      const ir = makeIR([container]);
      const ctx = resolvePickerContext(defaultInput({ ir, selectedIds: ['block-1'] }));
      expect(ctx.kind).toBe('existing-block');
      expect(ctx.elementId).toBe('block-1');
      expect(ctx.elementType).toBe('flow');
      expect(ctx.label).toBe('Flow');
    });

    it('provides block actions (add-child, change-type, delete)', () => {
      const container = makeContainerElement('block-2', [makeTextElement('c-1')]);
      const ir = makeIR([container]);
      const ctx = resolvePickerContext(defaultInput({ ir, selectedIds: ['block-2'] }));
      const actionNames = ctx.actions.map((a) => a.action);
      expect(actionNames).toContain('add-child');
      expect(actionNames).toContain('change-type');
      expect(actionNames).toContain('delete');
    });

    it('also finds child elements within containers', () => {
      const child = makeTextElement('child-1');
      const container = makeContainerElement('block-1', [child]);
      const ir = makeIR([container]);
      const ctx = resolvePickerContext(defaultInput({ ir, selectedIds: ['child-1'] }));
      expect(ctx.kind).toBe('existing-element');
      expect(ctx.elementId).toBe('child-1');
    });
  });

  // -- edge cases -----------------------------------------------------------

  describe('edge cases', () => {
    it('handles empty selectedIds array', () => {
      const ir = makeIR([makeTextElement('el-1')]);
      const ctx = resolvePickerContext(defaultInput({ ir, selectedIds: [] }));
      expect(ctx.kind).toBe('none');
    });

    it('handles ir with empty scenes array', () => {
      const ir: DepixIR = {
        meta: { width: 1920, height: 1080, unit: 'px' as const },
        scenes: [],
        transitions: [],
      };
      const ctx = resolvePickerContext(defaultInput({ ir }));
      expect(ctx.kind).toBe('empty-canvas');
    });

    it('suggestions and actions are always arrays', () => {
      const ctx = resolvePickerContext(defaultInput());
      expect(Array.isArray(ctx.suggestions)).toBe(true);
      expect(Array.isArray(ctx.actions)).toBe(true);
    });
  });
});
