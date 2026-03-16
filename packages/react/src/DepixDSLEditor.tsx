/**
 * DepixDSLEditor — DSL-first editor overlay.
 *
 * This component renders ONLY overlay UI elements (no canvas).
 * It is designed to be rendered inside DepixCanvasEditable when
 * DSL mode is active, replacing FloatingToolbar + FloatingPropertyPanel.
 *
 * All UI uses position: fixed (inspector panel) or
 * position: absolute (slot overlay, content picker) to overlay
 * the existing canvas without changing its size.
 */

import React, { useCallback, useMemo } from 'react';
import type { DepixIR, DepixTheme, IRContainer } from '@depix/core';
import { addSlotContent as addSlotContentMutation, changeSlotBlockType as changeSlotBlockTypeMutation, addBlockChild as addBlockChildMutation } from '@depix/editor';
import { SlotOverlay } from './components/editor/SlotOverlay.js';
import { LayoutAreaOverlay } from './components/editor/LayoutAreaOverlay.js';
import { ContextAwarePicker } from './components/editor/ContextAwarePicker.js';
import { InspectorPanel } from './components/editor/InspectorPanel.js';
import { useDSLSync } from './hooks/useDSLSync.js';
import { useEditorStore, useEditorStoreApi } from './store/editor-store-context.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DepixDSLEditorProps {
  /** Controlled DSL text */
  dsl: string;
  /** Called when DSL text changes due to editor actions */
  onDSLChange: (dsl: string) => void;
  /** Pre-compiled IR — when provided, used instead of internal compilation.
   *  Pass the same IR instance used for canvas rendering to ensure ID consistency. */
  ir?: DepixIR | null;
  /** Theme for compilation */
  theme?: DepixTheme;
  /** Canvas width in pixels (for coordinate transforms) */
  width: number;
  /** Canvas height in pixels (for coordinate transforms) */
  height: number;
  /** Fixed-position panel positions (from DepixCanvasEditable) */
  panelPositions: {
    toolbar: { top: number; left: number };
    panel: { top: number; left: number };
  };
  /** Confirm edit (Done) */
  onConfirm: () => void;
  /** Cancel edit */
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DepixDSLEditor({
  dsl,
  onDSLChange,
  ir: externalIR,
  theme,
  width,
  height,
  panelPositions,
  onConfirm,
  onCancel,
}: DepixDSLEditorProps) {
  // --- Store state ---------------------------------------------------------
  const activeSceneIndex = useEditorStore((s) => s.activeSceneIndex);
  const selectedElementId = useEditorStore((s) => s.selectedIds[0] ?? null);
  const showSlotAreas = useEditorStore((s) => s.showSlotAreas);
  const storeApi = useEditorStoreApi();

  // --- Derived state from DSL ----------------------------------------------
  const synced = useDSLSync(dsl, activeSceneIndex, { theme });
  // Use external IR (from parent's compilation) when available to ensure
  // element IDs match between canvas rendering and picker context.
  const ir = externalIR ?? synced.ir;
  const { currentSceneSlots } = synced;

  // --- DSL mutation callbacks ----------------------------------------------
  const handleSlotClick = useCallback(
    (slotName: string, bounds: { x: number; y: number; w: number; h: number }) => {
      const cx = ((bounds.x + bounds.w / 2) / 100) * width;
      const cy = (bounds.y / 100) * height;
      storeApi.getState().setPickerSlot({ name: slotName, position: { x: cx, y: cy } });
      storeApi.getState().setPickerExpanded(true);
    },
    [width, height, storeApi],
  );

  const handlePickerAction = useCallback(
    (action: string, payload?: unknown) => {
      const p = payload as Record<string, unknown> | undefined;
      if (action === 'add-content') {
        const slot = storeApi.getState().pickerSlot;
        if (!slot || !p) return;
        const type = p.type as string;
        const content = `${type} "New ${type}"`;
        const idx = storeApi.getState().activeSceneIndex;
        const newDsl = addSlotContentMutation(dsl, idx, slot.name, content);
        onDSLChange(newDsl);
        storeApi.getState().setPickerSlot(null);
      }
      if (action === 'change-type' && p) {
        const slotName = p.slotName as string;
        const newType = p.newType as string;
        if (!slotName || !newType) return;
        const idx = storeApi.getState().activeSceneIndex;
        const newDsl = changeSlotBlockTypeMutation(dsl, idx, slotName, newType);
        onDSLChange(newDsl);
      }

      if (action === 'add-child' && p) {
        const slotName = p.slotName as string;
        const type = p.type as string;
        if (!slotName || !type) return;
        const content = `${type} "New ${type}"`;
        const idx = storeApi.getState().activeSceneIndex;
        const newDsl = addBlockChildMutation(dsl, idx, slotName, content);
        onDSLChange(newDsl);
      }
      // Other actions (edit-text, delete, style, etc.) can be handled here
    },
    [dsl, onDSLChange, storeApi],
  );

  const handleSelectSlot = useCallback(
    (slotName: string) => {
      const scene = ir?.scenes[activeSceneIndex];
      if (!scene) return;
      const container = scene.elements.find(
        (el): el is IRContainer =>
          el.type === 'container' &&
          (el as IRContainer).origin?.sourceType === 'scene-slot' &&
          (el as IRContainer).origin?.slotName === slotName,
      );
      if (container) {
        storeApi.getState().setSelectedIds([container.id]);
      }
    },
    [ir, activeSceneIndex, storeApi],
  );

  const handleSelectElement = useCallback(
    (id: string | null) => {
      storeApi.getState().setSelectedIds(id ? [id] : []);
    },
    [storeApi],
  );

  // --- Coordinate transform for slot overlay -------------------------------
  const transform = useMemo(
    () => ({
      toPixelX: (relX: number) => (relX / 100) * width,
      toPixelY: (relY: number) => (relY / 100) * height,
      toPixelW: (relW: number) => (relW / 100) * width,
      toPixelH: (relH: number) => (relH / 100) * height,
    }),
    [width, height],
  );

  // --- Render (overlay elements only) ------------------------------------
  return (
    <>
      {/* ── Inspector panel (position: fixed, draggable) ── */}
      <InspectorPanel
        ir={ir}
        dsl={dsl}
        onDSLChange={onDSLChange}
        activeSceneIndex={activeSceneIndex}
        onActiveSceneIndexChange={storeApi.getState().setActiveSceneIndex}
        selectedElementId={selectedElementId}
        onSelectElement={handleSelectElement}
        onConfirm={onConfirm}
        onCancel={onCancel}
        style={{
          top: panelPositions.panel.top,
          left: panelPositions.panel.left,
        }}
      />

      {/* ── Slot overlay (fixed, mirrors canvas position) ── */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width,
          height,
          pointerEvents: 'none',
          zIndex: 10000,
        }}
      >
        {showSlotAreas && currentSceneSlots.length > 0 && (
          <LayoutAreaOverlay slots={currentSceneSlots} transform={transform} />
        )}
        <SlotOverlay
          slots={currentSceneSlots}
          transform={transform}
          onSlotClick={handleSlotClick}
          onSelectSlot={handleSelectSlot}
        />
      </div>

      {/* ── Context-aware picker (fixed, mirrors canvas position) ── */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width,
          height,
          pointerEvents: 'none',
          zIndex: 10001,
        }}
      >
        <ContextAwarePicker
          ir={ir}
          dsl={dsl}
          activeSceneIndex={activeSceneIndex}
          width={width}
          height={height}
          onAction={handlePickerAction}
        />
      </div>
    </>
  );
}
