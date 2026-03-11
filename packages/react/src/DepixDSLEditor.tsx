/**
 * DepixDSLEditor — DSL-first editor overlay.
 *
 * This component renders ONLY overlay UI elements (no canvas).
 * It is designed to be rendered inside DepixCanvasEditable when
 * DSL mode is active, replacing FloatingToolbar + FloatingPropertyPanel.
 *
 * All UI uses position: fixed (toolbar, property panel) or
 * position: absolute (slot overlay, content picker) to overlay
 * the existing canvas without changing its size.
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { DepixTheme } from '@depix/core';
import { parse as parseDSL } from '@depix/core';
import {
  addScene as addSceneMutation,
  removeScene as removeSceneMutation,
  changeLayout as changeLayoutMutation,
  addSlotContent as addSlotContentMutation,
} from '@depix/editor';
import { LayoutPicker } from './components/editor/LayoutPicker.js';
import { SlotOverlay } from './components/editor/SlotOverlay.js';
import { ContentTypePicker } from './components/editor/ContentTypePicker.js';
import { EditorPropertyPanel } from './components/editor/EditorPropertyPanel.js';
import { EDITOR_COLORS } from './components/editor/editor-colors.js';
import { useDSLSync } from './hooks/useDSLSync.js';

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
  // --- State ---------------------------------------------------------------
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [pickerSlot, setPickerSlot] = useState<{
    name: string;
    position: { x: number; y: number };
  } | null>(null);

  // --- Derived state from DSL ----------------------------------------------
  const { scenes, currentSceneSlots } = useDSLSync(dsl, activeSceneIndex, { theme });

  const currentLayout = useMemo(() => {
    try {
      const { ast } = parseDSL(dsl);
      const scene = ast.scenes[activeSceneIndex];
      return scene?.props?.layout ?? 'full';
    } catch {
      return 'full';
    }
  }, [dsl, activeSceneIndex]);

  // --- DSL mutation callbacks ----------------------------------------------
  const handleLayoutChange = useCallback(
    (layout: string) => {
      const newDsl = changeLayoutMutation(dsl, activeSceneIndex, layout);
      onDSLChange(newDsl);
    },
    [dsl, onDSLChange, activeSceneIndex],
  );

  const handleSlotClick = useCallback(
    (slotName: string) => {
      // Position picker at center of canvas area
      const x = width / 2;
      const y = height / 2;
      setPickerSlot({ name: slotName, position: { x, y } });
    },
    [width, height],
  );

  const handleContentSelect = useCallback(
    (type: string) => {
      if (!pickerSlot) return;
      const content = `${type} "New ${type}"`;
      const newDsl = addSlotContentMutation(dsl, activeSceneIndex, pickerSlot.name, content);
      onDSLChange(newDsl);
      setPickerSlot(null);
    },
    [dsl, onDSLChange, activeSceneIndex, pickerSlot],
  );

  const handlePropertyChange = useCallback(
    (key: string, value: unknown) => {
      if (key === 'layout' && typeof value === 'string') {
        handleLayoutChange(value);
      }
    },
    [handleLayoutChange],
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

  // --- Scene navigation in toolbar ----------------------------------------
  const sceneLabel = scenes[activeSceneIndex]?.title ?? `Scene ${activeSceneIndex + 1}`;
  const hasMultiScenes = scenes.length > 1;

  const goPrevScene = useCallback(() => {
    setActiveSceneIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNextScene = useCallback(() => {
    setActiveSceneIndex((i) => Math.min(scenes.length - 1, i + 1));
  }, [scenes.length]);

  // --- Render (overlay elements only) ------------------------------------
  return (
    <>
      {/* ── Toolbar (position: fixed, left side of canvas) ── */}
      <div
        style={{
          position: 'fixed',
          top: panelPositions.toolbar.top,
          left: panelPositions.toolbar.left,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          pointerEvents: 'auto',
        }}
      >
        {/* Layout picker */}
        <LayoutPicker
          currentLayout={String(currentLayout)}
          onLayoutChange={handleLayoutChange}
        />

        {/* Scene nav (only when multi-scene) */}
        {hasMultiScenes && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: EDITOR_COLORS.bgLight,
              border: `1px solid ${EDITOR_COLORS.border}`,
              borderRadius: 6,
              padding: '2px 6px',
            }}
          >
            <button
              onClick={goPrevScene}
              disabled={activeSceneIndex === 0}
              style={navBtnStyle}
              title="Previous scene"
            >
              ‹
            </button>
            <span
              style={{
                fontSize: 11,
                color: EDITOR_COLORS.text,
                minWidth: 40,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 100,
              }}
            >
              {sceneLabel}
            </span>
            <button
              onClick={goNextScene}
              disabled={activeSceneIndex >= scenes.length - 1}
              style={navBtnStyle}
              title="Next scene"
            >
              ›
            </button>
          </div>
        )}

        {/* Add scene button */}
        <button
          onClick={() => {
            const newDsl = addSceneMutation(dsl, `Scene ${scenes.length + 1}`);
            onDSLChange(newDsl);
            setActiveSceneIndex(scenes.length);
          }}
          style={{
            background: EDITOR_COLORS.bgLight,
            border: `1px solid ${EDITOR_COLORS.border}`,
            borderRadius: 6,
            color: EDITOR_COLORS.textMuted,
            padding: '4px 10px',
            fontSize: 11,
            cursor: 'pointer',
          }}
          title="Add scene"
        >
          + Scene
        </button>

        {/* Done / Cancel */}
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              background: EDITOR_COLORS.bgLight,
              border: `1px solid ${EDITOR_COLORS.border}`,
              borderRadius: 6,
              color: EDITOR_COLORS.textMuted,
              padding: '5px 0',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              background: EDITOR_COLORS.accent,
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              padding: '5px 0',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>

      {/* ── Property panel (position: fixed, right side of canvas) ── */}
      <EditorPropertyPanel
        context={scenes.length > 0 ? 'scene' : 'none'}
        sceneTitle={sceneLabel}
        layout={String(currentLayout)}
        onChange={handlePropertyChange}
        style={{
          position: 'fixed',
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
            onClose={() => setPickerSlot(null)}
          />
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Internal styles
// ---------------------------------------------------------------------------

const navBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: EDITOR_COLORS.textMuted,
  cursor: 'pointer',
  fontSize: 14,
  padding: '0 2px',
  lineHeight: 1,
};
