import { describe, it, expect } from 'vitest';
import { createEditorStore } from '../../../src/store/create-editor-store.js';

describe('UISlice', () => {
  it('has correct defaults', () => {
    const store = createEditorStore();
    const s = store.getState();
    expect(s.isEditing).toBe(false);
    expect(s.isHovered).toBe(false);
    expect(s.isFullscreen).toBe(false);
    expect(s.activeTool).toBe('select');
    expect(s.inspectorTab).toBe('layers');
    expect(s.objectPanelOpen).toBe(false);
    expect(s.pickerSlot).toBeNull();
    expect(s.panelPositions).toBeNull();
    expect(s.editDims).toBeNull();
  });

  it('setActiveTool updates tool', () => {
    const store = createEditorStore();
    store.getState().setActiveTool('rect');
    expect(store.getState().activeTool).toBe('rect');
  });

  it('setInspectorTab switches tab', () => {
    const store = createEditorStore();
    store.getState().setInspectorTab('canvas');
    expect(store.getState().inspectorTab).toBe('canvas');
  });

  it('setPickerSlot sets and clears picker', () => {
    const store = createEditorStore();
    const slot = { name: 'main', position: { x: 100, y: 200 } };
    store.getState().setPickerSlot(slot);
    expect(store.getState().pickerSlot).toEqual(slot);

    store.getState().setPickerSlot(null);
    expect(store.getState().pickerSlot).toBeNull();
  });

  it('enterEditMode sets editing + dims + resets tool', () => {
    const store = createEditorStore();
    store.getState().setActiveTool('rect');
    store.getState().enterEditMode({ width: 1000, height: 600 });

    const s = store.getState();
    expect(s.isEditing).toBe(true);
    expect(s.activeTool).toBe('select');
    expect(s.editDims).toEqual({ width: 1000, height: 600 });
  });

  it('exitEditMode resets all editing state', () => {
    const store = createEditorStore();
    store.getState().enterEditMode({ width: 1000, height: 600 });
    store.getState().setInspectorTab('scenes');
    store.getState().setObjectPanelOpen(true);
    store.getState().setPickerSlot({ name: 'main', position: { x: 0, y: 0 } });
    store.getState().setPanelPositions({
      toolbar: { top: 10, left: 10 },
      panel: { top: 10, left: 100 },
    });

    store.getState().exitEditMode();

    const s = store.getState();
    expect(s.isEditing).toBe(false);
    expect(s.editDims).toBeNull();
    expect(s.panelPositions).toBeNull();
    expect(s.pickerSlot).toBeNull();
    expect(s.objectPanelOpen).toBe(false);
    expect(s.inspectorTab).toBe('layers');
  });

  it('setIsHovered toggles hover', () => {
    const store = createEditorStore();
    store.getState().setIsHovered(true);
    expect(store.getState().isHovered).toBe(true);
    store.getState().setIsHovered(false);
    expect(store.getState().isHovered).toBe(false);
  });

  it('setIsFullscreen toggles fullscreen', () => {
    const store = createEditorStore();
    store.getState().setIsFullscreen(true);
    expect(store.getState().isFullscreen).toBe(true);
  });
});
