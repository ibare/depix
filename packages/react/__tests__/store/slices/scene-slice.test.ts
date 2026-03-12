import { describe, it, expect } from 'vitest';
import { createEditorStore } from '../../../src/store/create-editor-store.js';

describe('SceneSlice', () => {
  it('defaults to scene index 0', () => {
    const store = createEditorStore();
    expect(store.getState().activeSceneIndex).toBe(0);
  });

  it('setActiveSceneIndex changes scene', () => {
    const store = createEditorStore();
    store.getState().setActiveSceneIndex(2);
    expect(store.getState().activeSceneIndex).toBe(2);
  });

  it('setActiveSceneIndex back to 0', () => {
    const store = createEditorStore();
    store.getState().setActiveSceneIndex(5);
    store.getState().setActiveSceneIndex(0);
    expect(store.getState().activeSceneIndex).toBe(0);
  });
});
