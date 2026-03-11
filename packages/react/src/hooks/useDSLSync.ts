/**
 * useDSLSync — compiles DSL text into IR and derived state.
 *
 * Memoizes compilation so the IR is only recomputed when the DSL string changes.
 * Extracts scene metadata and slot information from the compiled result.
 */

import { useMemo } from 'react';
import type { DepixIR, IRBounds } from '@depix/core';
import type { DepixTheme } from '@depix/core';
import type { ParseError } from '@depix/core';
import { compile, parse } from '@depix/core';

export interface SlotInfo {
  name: string;
  bounds: IRBounds;
  isEmpty: boolean;
}

export interface SceneInfo {
  index: number;
  title: string;
}

export interface UseDSLSyncOptions {
  theme?: DepixTheme;
}

export interface UseDSLSyncReturn {
  ir: DepixIR | null;
  errors: ParseError[];
  scenes: SceneInfo[];
  currentSceneSlots: SlotInfo[];
}

export function useDSLSync(
  dsl: string,
  activeSceneIndex: number = 0,
  options?: UseDSLSyncOptions,
): UseDSLSyncReturn {
  const compiled = useMemo(() => {
    if (!dsl.trim()) {
      return { ir: null, errors: [] as ParseError[] };
    }
    try {
      const result = compile(dsl, { theme: options?.theme });
      return { ir: result.ir, errors: result.errors };
    } catch {
      return { ir: null, errors: [{ message: 'Compilation failed', line: 0, column: 0 }] };
    }
  }, [dsl, options?.theme]);

  const scenes = useMemo<SceneInfo[]>(() => {
    if (!compiled.ir) return [];
    // Parse AST to get scene titles
    const { ast } = parse(dsl);
    return ast.scenes.map((scene, index) => ({
      index,
      title: scene.label ?? `Scene ${index + 1}`,
    }));
  }, [dsl, compiled.ir]);

  const currentSceneSlots = useMemo<SlotInfo[]>(() => {
    // Slot info extraction from IR is a future enhancement.
    // For now, return empty array — slots will be populated
    // when scene layout integration is complete.
    return [];
  }, [compiled.ir, activeSceneIndex]);

  return {
    ir: compiled.ir,
    errors: compiled.errors,
    scenes,
    currentSceneSlots,
  };
}
