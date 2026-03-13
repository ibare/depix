/**
 * useDSLSync — compiles DSL text into IR and derived state.
 *
 * Memoizes compilation so the IR is only recomputed when the DSL string changes.
 * Extracts scene metadata and slot information from the compiled result.
 */

import { useMemo } from 'react';
import type { DepixIR, IRBounds, SceneLayoutConfig, SceneLayoutType } from '@depix/core';
import type { DepixTheme } from '@depix/core';
import type { ParseError } from '@depix/core';
import { compile, parse, layoutScene, defaultSceneTheme } from '@depix/core';

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

  const parsedAst = useMemo(() => {
    if (!dsl.trim() || !compiled.ir) return null;
    try { return parse(dsl).ast; } catch { return null; }
  }, [dsl, compiled.ir]);

  const scenes = useMemo<SceneInfo[]>(() => {
    if (!parsedAst) return [];
    return parsedAst.scenes.map((scene, index) => ({
      index,
      title: scene.label ?? `Scene ${index + 1}`,
    }));
  }, [parsedAst]);

  const currentSceneSlots = useMemo<SlotInfo[]>(() => {
    if (!compiled.ir || !parsedAst) return [];
    const scene = compiled.ir.scenes[activeSceneIndex];
    if (!scene?.layout) return [];

    const layoutType = scene.layout.type as SceneLayoutType;
    const sceneBlock = parsedAst.scenes[activeSceneIndex];
    const cellCount = sceneBlock
      ? sceneBlock.children.filter(
          (n) => n.kind !== 'edge' && 'slot' in n && (n as { slot?: string }).slot === 'cell',
        ).length
      : 0;

    const config: SceneLayoutConfig = {
      bounds: { x: 0, y: 0, w: 100, h: 100 },
      padding: defaultSceneTheme.layout.scenePadding,
      headerHeight: defaultSceneTheme.layout.headingHeight,
      gap: defaultSceneTheme.layout.columnGap,
      ratio: scene.layout.ratio,
      direction: scene.layout.direction,
    };

    const result = layoutScene(layoutType, config, cellCount);
    const slots: SlotInfo[] = [];
    for (const [slotName, boundsArr] of result.slotBounds) {
      for (const bounds of boundsArr) {
        slots.push({ name: slotName, bounds, isEmpty: false });
      }
    }
    return slots;
  }, [compiled.ir, parsedAst, activeSceneIndex]);

  return {
    ir: compiled.ir,
    errors: compiled.errors,
    scenes,
    currentSceneSlots,
  };
}
