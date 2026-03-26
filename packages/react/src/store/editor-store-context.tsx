import React, { createContext, useContext, useRef } from 'react';
import { useStore } from 'zustand';
import type { DepixEditorStore } from './types.js';
import { createEditorStore } from './create-editor-store.js';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export type EditorStore = ReturnType<typeof createEditorStore>;

const EditorStoreContext = createContext<EditorStore | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function EditorStoreProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<EditorStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createEditorStore();
  }
  return (
    <EditorStoreContext.Provider value={storeRef.current}>
      {children}
    </EditorStoreContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useEditorStore<T>(selector: (state: DepixEditorStore) => T): T {
  const store = useContext(EditorStoreContext);
  if (!store) throw new Error('useEditorStore must be used within EditorStoreProvider');
  return useStore(store, selector);
}

export function useEditorStoreApi(): EditorStore {
  const store = useContext(EditorStoreContext);
  if (!store) throw new Error('useEditorStoreApi must be used within EditorStoreProvider');
  return store;
}
