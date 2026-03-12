/**
 * useDSLInspectorCallbacks
 *
 * Adapter hook that bridges IR-based tab component callbacks
 * to DSL text mutations. Builds an IR element.id → DSL element index
 * mapping so that property changes can be routed to the correct
 * DSL mutation function.
 */

import { useCallback, useMemo } from 'react';
import { parse } from '@depix/core';
import type { DepixIR, IRElement, IRStyle, IRBounds, IRScene } from '@depix/core';
import {
  addScene,
  removeScene,
  changeSceneTitle,
  changeLayout,
  changeElementLabel,
  changeElementStyle,
  upsertOverride,
} from '@depix/editor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseDSLInspectorCallbacksInput {
  dsl: string;
  onDSLChange: (dsl: string) => void;
  activeSceneIndex: number;
  onActiveSceneIndexChange: (index: number) => void;
  ir: DepixIR | null;
}

export interface UseDSLInspectorCallbacksReturn {
  // ObjectTab callbacks
  onStyleChange: (id: string, style: Partial<IRStyle>) => void;
  onTextChange: (id: string, text: string) => void;
  onBoundsChange: (id: string, bounds: Partial<IRBounds>) => void;

  // SceneTab callbacks
  scenes: IRScene[];
  onSceneChange: (index: number) => void;
  onAddScene: () => void;
  onDeleteScene: (index: number) => void;
  onRenameScene: (index: number, name: string) => void;

  // CanvasTab (no-op for now)
  onLayoutChange: (layout: string) => void;

  // Derived data
  sceneElements: IRElement[];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDSLInspectorCallbacks({
  dsl,
  onDSLChange,
  activeSceneIndex,
  onActiveSceneIndexChange,
  ir,
}: UseDSLInspectorCallbacksInput): UseDSLInspectorCallbacksReturn {
  // --- ID → element index mapping ------------------------------------------
  // DSL mutations use positional indices. IR elements have string IDs.
  // We build a map from IR element ID to its flattened index in the AST.
  const idToIndex = useMemo(() => {
    const map = new Map<string, number>();
    if (!ir || !dsl.trim()) return map;

    try {
      const { ast } = parse(dsl);
      const scene = ast.scenes[activeSceneIndex];
      if (!scene) return map;

      // Flatten AST elements (same algorithm as dsl-mutations collectElements)
      const astElements = collectASTElements(scene.children);

      // Flatten IR elements (skip containers, match leaf elements)
      const irScene = ir.scenes[activeSceneIndex];
      if (!irScene) return map;
      const irElements = flattenIRElements(irScene.elements);

      // Map by explicit ID match first
      for (let i = 0; i < astElements.length; i++) {
        const astEl = astElements[i];
        if (astEl.id) {
          map.set(astEl.id, i);
        }
      }

      // Positional fallback for auto-generated IDs
      const len = Math.min(astElements.length, irElements.length);
      for (let i = 0; i < len; i++) {
        const irEl = irElements[i];
        if (!map.has(irEl.id)) {
          map.set(irEl.id, i);
        }
      }
    } catch {
      // Parse failure — return empty map
    }

    return map;
  }, [dsl, ir, activeSceneIndex]);

  // --- ObjectTab callbacks -------------------------------------------------
  const onStyleChange = useCallback(
    (id: string, style: Partial<IRStyle>) => {
      const idx = idToIndex.get(id);
      if (idx === undefined) return;
      // Apply each style property individually
      let updated = dsl;
      for (const [key, value] of Object.entries(style)) {
        if (value !== undefined) {
          updated = changeElementStyle(updated, activeSceneIndex, idx, key, String(value));
        }
      }
      onDSLChange(updated);
    },
    [dsl, onDSLChange, activeSceneIndex, idToIndex],
  );

  const onTextChange = useCallback(
    (id: string, text: string) => {
      const idx = idToIndex.get(id);
      if (idx === undefined) return;
      const updated = changeElementLabel(dsl, activeSceneIndex, idx, text);
      onDSLChange(updated);
    },
    [dsl, onDSLChange, activeSceneIndex, idToIndex],
  );

  const onBoundsChange = useCallback(
    (id: string, bounds: Partial<IRBounds>) => {
      const updated = upsertOverride(dsl, id, bounds);
      onDSLChange(updated);
    },
    [dsl, onDSLChange],
  );

  // --- SceneTab callbacks --------------------------------------------------
  const scenes = ir?.scenes ?? [];

  const onSceneChange = useCallback(
    (index: number) => {
      onActiveSceneIndexChange(index);
    },
    [onActiveSceneIndexChange],
  );

  const onAddScene = useCallback(() => {
    const updated = addScene(dsl, `Scene ${scenes.length + 1}`);
    onDSLChange(updated);
    onActiveSceneIndexChange(scenes.length);
  }, [dsl, onDSLChange, scenes.length, onActiveSceneIndexChange]);

  const onDeleteScene = useCallback(
    (index: number) => {
      const updated = removeScene(dsl, index);
      onDSLChange(updated);
      if (activeSceneIndex >= index && activeSceneIndex > 0) {
        onActiveSceneIndexChange(activeSceneIndex - 1);
      }
    },
    [dsl, onDSLChange, activeSceneIndex, onActiveSceneIndexChange],
  );

  const onRenameScene = useCallback(
    (index: number, name: string) => {
      const updated = changeSceneTitle(dsl, index, name);
      onDSLChange(updated);
    },
    [dsl, onDSLChange],
  );

  // --- Layout callback (used in CanvasTab) ---------------------------------
  const onLayoutChange = useCallback(
    (layout: string) => {
      const updated = changeLayout(dsl, activeSceneIndex, layout);
      onDSLChange(updated);
    },
    [dsl, onDSLChange, activeSceneIndex],
  );

  // --- Scene elements for LayersTab ----------------------------------------
  const sceneElements = useMemo(() => {
    if (!ir) return [];
    const scene = ir.scenes[activeSceneIndex];
    return scene?.elements ?? [];
  }, [ir, activeSceneIndex]);

  return {
    onStyleChange,
    onTextChange,
    onBoundsChange,
    scenes,
    onSceneChange,
    onAddScene,
    onDeleteScene,
    onRenameScene,
    onLayoutChange,
    sceneElements,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface ASTNode {
  kind: string;
  id?: string;
  children?: ASTNode[];
}

/**
 * Flatten AST elements — same algorithm as dsl-mutations collectElements.
 * Skips blocks, recurses into their children, collects only elements.
 */
function collectASTElements(nodes: ASTNode[]): ASTNode[] {
  const result: ASTNode[] = [];
  for (const node of nodes) {
    if (node.kind === 'element') {
      result.push(node);
    } else if (node.kind === 'block' && node.children) {
      result.push(...collectASTElements(node.children));
    }
  }
  return result;
}

/**
 * Flatten IR elements — skips containers, recurses into children.
 * Produces the same ordering as collectASTElements for positional matching.
 */
function flattenIRElements(elements: IRElement[]): IRElement[] {
  const result: IRElement[] = [];
  for (const el of elements) {
    if (el.type === 'container' && 'children' in el) {
      result.push(...flattenIRElements((el as IRElement & { children: IRElement[] }).children));
    } else {
      result.push(el);
    }
  }
  return result;
}
