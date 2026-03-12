/**
 * Editor store factory.
 *
 * Creates a per-instance Zustand store with immer + devtools middleware.
 * Each DepixCanvasEditable mounts its own store via EditorStoreProvider.
 */

import { createStore } from 'zustand/vanilla';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { DepixEditorStore } from './types.js';
import { createUISlice } from './slices/ui-slice.js';
import { createSelectionSlice } from './slices/selection-slice.js';
import { createSceneSlice } from './slices/scene-slice.js';
import { createHistorySlice } from './slices/history-slice.js';
import { createManagerSlice } from './slices/manager-slice.js';

export function createEditorStore() {
  return createStore<DepixEditorStore>()(
    devtools(
      immer((...a) => ({
        ...createUISlice(...a),
        ...createSelectionSlice(...a),
        ...createSceneSlice(...a),
        ...createHistorySlice(...a),
        ...createManagerSlice(...a),
      })),
      { name: 'depix-editor', enabled: typeof window !== 'undefined' && (window as any).__DEV__ },
    ),
  );
}
