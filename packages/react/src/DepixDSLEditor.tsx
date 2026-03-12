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
import type { DepixTheme } from '@depix/core';
import { addSlotContent as addSlotContentMutation } from '@depix/editor';
import { SlotOverlay } from './components/editor/SlotOverlay.js';
import { ContentTypePicker } from './components/editor/ContentTypePicker.js';
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
  const pickerSlot = useEditorStore((s) => s.pickerSlot);
  const storeApi = useEditorStoreApi();

  // --- Derived state from DSL ----------------------------------------------
  const { ir, currentSceneSlots } = useDSLSync(dsl, activeSceneIndex, { theme });

  // --- DSL mutation callbacks ----------------------------------------------
  const handleSlotClick = useCallback(
    (slotName: string) => {
      const x = width / 2;
      const y = height / 2;
      storeApi.getState().setPickerSlot({ name: slotName, position: { x, y } });
    },
    [width, height, storeApi],
  );

  const handleContentSelect = useCallback(
    (type: string) => {
      const slot = storeApi.getState().pickerSlot;
      if (!slot) return;
      const content = `${type} "New ${type}"`;
      const idx = storeApi.getState().activeSceneIndex;
      const newDsl = addSlotContentMutation(dsl, idx, slot.name, content);
      onDSLChange(newDsl);
      storeApi.getState().setPickerSlot(null);
    },
    [dsl, onDSLChange, storeApi],
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

      {/* ── Slot overlay (absolute within canvas, rendered by parent) ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 5,
        }}
      >
        <SlotOverlay
          slots={currentSceneSlots}
          transform={transform}
          onSlotClick={handleSlotClick}
        />
      </div>

      {/* ── Content type picker (popover) ── */}
      {pickerSlot && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 15,
            pointerEvents: 'none',
          }}
        >
          <ContentTypePicker
            position={pickerSlot.position}
            onSelect={handleContentSelect}
            onClose={() => storeApi.getState().setPickerSlot(null)}
          />
        </div>
      )}
    </>
  );
}
