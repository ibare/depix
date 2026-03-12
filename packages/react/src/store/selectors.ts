import { useMemo } from 'react';
import type { DepixIR, IRElement } from '@depix/core';
import { findElement } from '@depix/core';
import { useEditorStore } from './editor-store-context.js';

export function useSelectedElements(ir: DepixIR | null): IRElement[] {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  return useMemo(() => {
    if (!ir) return [];
    return selectedIds
      .map((id) => findElement(ir, id))
      .filter((el): el is IRElement => el !== undefined);
  }, [ir, selectedIds]);
}

export function useSceneElements(ir: DepixIR | null): IRElement[] {
  const idx = useEditorStore((s) => s.activeSceneIndex);
  return useMemo(() => ir?.scenes[idx]?.elements ?? [], [ir, idx]);
}

export function useIsEditActive(): boolean {
  return useEditorStore((s) => s.isEditing);
}
