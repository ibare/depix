/**
 * InspectorPanel — tabbed property inspector for DSL editor.
 *
 * Structure: two overlapping cards.
 *
 * - Object card sits BEHIND the main panel (lower z-index).
 *   It slides left to reveal itself when an element is selected
 *   or the edge handle is clicked, and slides right to hide.
 * - Main panel sits on top (higher z-index) and never moves.
 * - A small edge handle protrudes from the main panel's left edge,
 *   hinting that the Object card is behind.
 *
 * DOM (all children of a single fixed-position wrapper):
 *   wrapper
 *   ├── object card  (z-index: 0, translateX animated)
 *   ├── main panel   (z-index: 1, static)
 *   └── edge handle  (z-index: 2, always visible, top-left)
 */

import React, { useState, useMemo, useCallback } from 'react';
import { parse } from '@depix/core';
import type { DepixIR } from '@depix/core';
import { useDraggable } from '../../hooks/useDraggable.js';
import { useDSLInspectorCallbacks } from '../../hooks/useDSLInspectorCallbacks.js';
import { ObjectTab } from '../property-panel-tabs/ObjectTab.js';
import { LayersTab } from '../property-panel-tabs/LayersTab.js';
import { CanvasTab } from '../property-panel-tabs/CanvasTab.js';
import { SceneTab } from '../property-panel-tabs/SceneTab.js';
import { LayoutPicker } from './LayoutPicker.js';
import { EDITOR_COLORS } from './editor-colors.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAIN_WIDTH = 280;
const OBJECT_WIDTH = 260;
const SLIDE_DURATION = 220; // ms

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'layers' | 'canvas' | 'scenes';

export interface InspectorPanelProps {
  ir: DepixIR | null;
  dsl: string;
  onDSLChange: (dsl: string) => void;
  activeSceneIndex: number;
  onActiveSceneIndexChange: (index: number) => void;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onConfirm: () => void;
  onCancel: () => void;
  style?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InspectorPanel({
  ir,
  dsl,
  onDSLChange,
  activeSceneIndex,
  onActiveSceneIndexChange,
  selectedElementId,
  onSelectElement,
  onConfirm,
  onCancel,
  style,
}: InspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('layers');
  const [objectOpen, setObjectOpen] = useState(false);

  const { position, dragHandleProps, isDragging } = useDraggable();

  const callbacks = useDSLInspectorCallbacks({
    dsl,
    onDSLChange,
    activeSceneIndex,
    onActiveSceneIndexChange,
    ir,
  });

  const selectedElements = useMemo(() => {
    if (!selectedElementId || !ir) return [];
    const scene = ir.scenes[activeSceneIndex];
    if (!scene) return [];
    const found = scene.elements.find((el) => el.id === selectedElementId);
    return found ? [found] : [];
  }, [ir, activeSceneIndex, selectedElementId]);

  const currentLayout = useMemo(() => {
    try {
      const { ast } = parse(dsl);
      const scene = ast.scenes[activeSceneIndex];
      return scene?.props?.layout ?? 'full';
    } catch {
      return 'full';
    }
  }, [dsl, activeSceneIndex]);

  const elementCount = callbacks.sceneElements.length;
  const sceneCount = callbacks.scenes.length;

  const tabs: { id: TabId; label: string; badge?: number }[] = [
    { id: 'layers', label: 'Layers', badge: elementCount },
    { id: 'canvas', label: 'Canvas' },
    { id: 'scenes', label: 'Scenes', badge: sceneCount },
  ];

  // Object card opens when element selected on Layers tab, or manually toggled
  const isOnLayersTab = activeTab === 'layers';
  const objectVisible = isOnLayersTab && (objectOpen || !!selectedElementId);

  const handleEdgeHandleClick = useCallback(() => {
    if (selectedElementId) {
      // Deselect to close
      onSelectElement(null);
      setObjectOpen(false);
    } else {
      // Toggle manually
      setObjectOpen((o) => !o);
    }
  }, [selectedElementId, onSelectElement]);

  return (
    <div
      role="region"
      aria-label="Inspector panel"
      style={{
        ...wrapperStyle,
        transform: `translate(${position.x}px, ${position.y}px)`,
        ...(isDragging ? { cursor: 'grabbing' } : {}),
        ...style,
      }}
    >
      {/* ── Object card (behind main panel, slides left) ── */}
      <div
        data-testid="object-card"
        style={{
          ...objectCardStyle,
          transform: objectVisible
            ? `translateX(${-OBJECT_WIDTH}px)`
            : 'translateX(0)',
        }}
      >
        <div style={objectHeaderStyle}>Object</div>
        <div style={objectBodyStyle}>
          <ObjectTab
            elements={selectedElements}
            onStyleChange={callbacks.onStyleChange}
            onTextChange={callbacks.onTextChange}
            onBoundsChange={callbacks.onBoundsChange}
          />
        </div>
      </div>

      {/* ── Main panel (on top, never moves) ── */}
      <div style={mainPanelStyle}>
        <div style={headerStyle} {...dragHandleProps} data-testid="inspector-drag-handle">
          <div style={dragIndicatorStyle}>⋮⋮</div>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            style={cancelBtnStyle}
            onClick={onCancel}
            data-testid="inspector-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            style={doneBtnStyle}
            onClick={onConfirm}
            data-testid="inspector-done"
          >
            Done
          </button>
        </div>

        <div style={tabBarStyle}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-panel-tab={tab.id}
              style={activeTab === tab.id ? activeTabStyle : tabStyle}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.badge !== undefined && (
                <span style={badgeStyle}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        <div style={bodyStyle} data-testid={`tab-content-${activeTab}`}>
          {activeTab === 'layers' && (
            <LayersTab
              elements={callbacks.sceneElements}
              selectedIds={selectedElementId ? [selectedElementId] : []}
              onSelectElement={(id) => onSelectElement(id)}
            />
          )}

          {activeTab === 'canvas' && (
            <>
              <div style={layoutSectionStyle}>
                <LayoutPicker
                  currentLayout={String(currentLayout)}
                  onLayoutChange={callbacks.onLayoutChange}
                />
              </div>
              <CanvasTab
                aspectRatio={ir?.meta?.aspectRatio ?? { width: 16, height: 9 }}
                background={ir?.meta?.background ?? { type: 'solid', color: '#ffffff' }}
              />
            </>
          )}

          {activeTab === 'scenes' && (
            <SceneTab
              scenes={callbacks.scenes}
              currentSceneIndex={activeSceneIndex}
              onSceneChange={callbacks.onSceneChange}
              onAddScene={callbacks.onAddScene}
              onDeleteScene={callbacks.onDeleteScene}
              onRenameScene={callbacks.onRenameScene}
            />
          )}
        </div>
      </div>

      {/* ── Edge handle (always visible on Layers tab, top-left of main panel) ── */}
      {isOnLayersTab && (
        <button
          type="button"
          style={edgeHandleStyle}
          onClick={handleEdgeHandleClick}
          data-testid="object-edge-handle"
          title={objectVisible ? 'Hide properties' : 'Show properties'}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="2" width="10" height="2" rx="0.5" fill={EDITOR_COLORS.textMuted} />
            <rect x="1" y="5" width="10" height="2" rx="0.5" fill={EDITOR_COLORS.textMuted} />
            <rect x="1" y="8" width="10" height="2" rx="0.5" fill={EDITOR_COLORS.textMuted} />
          </svg>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const wrapperStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 10001,
};

/** Object card: sits behind main panel, slides via translateX. */
const objectCardStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: OBJECT_WIDTH,
  maxHeight: 500,
  zIndex: 0,
  borderRadius: 8,
  backgroundColor: EDITOR_COLORS.bg,
  border: `1px solid ${EDITOR_COLORS.border}`,
  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
  color: EDITOR_COLORS.text,
  userSelect: 'none',
  fontSize: 12,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  transition: `transform ${SLIDE_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`,
};

const objectHeaderStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 10,
  fontWeight: 600,
  color: EDITOR_COLORS.textMuted,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  borderBottom: `1px solid ${EDITOR_COLORS.border}`,
  backgroundColor: EDITOR_COLORS.bgLight,
};

const objectBodyStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
};

/** Main panel: on top, never moves. */
const mainPanelStyle: React.CSSProperties = {
  position: 'relative',
  width: MAIN_WIDTH,
  maxHeight: 500,
  zIndex: 1,
  borderRadius: 8,
  backgroundColor: EDITOR_COLORS.bg,
  border: `1px solid ${EDITOR_COLORS.border}`,
  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  color: EDITOR_COLORS.text,
  userSelect: 'none',
  fontSize: 12,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

/** Edge handle: small protruding tab, top-left of main panel. */
const edgeHandleStyle: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  left: -20,
  zIndex: 2,
  width: 24,
  height: 28,
  border: `1px solid ${EDITOR_COLORS.border}`,
  borderRight: 'none',
  borderRadius: '6px 0 0 6px',
  backgroundColor: EDITOR_COLORS.bgLight,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  boxShadow: '-2px 2px 6px rgba(0,0,0,0.2)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '6px 8px',
  backgroundColor: EDITOR_COLORS.bgLight,
  borderBottom: `1px solid ${EDITOR_COLORS.border}`,
  cursor: 'grab',
};

const dragIndicatorStyle: React.CSSProperties = {
  color: EDITOR_COLORS.textDim,
  fontSize: 10,
  letterSpacing: 2,
  cursor: 'grab',
  padding: '0 4px',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '3px 10px',
  border: `1px solid ${EDITOR_COLORS.border}`,
  borderRadius: 4,
  backgroundColor: 'transparent',
  color: EDITOR_COLORS.textMuted,
  cursor: 'pointer',
  fontSize: 10,
  fontWeight: 600,
};

const doneBtnStyle: React.CSSProperties = {
  padding: '3px 10px',
  border: 'none',
  borderRadius: 4,
  backgroundColor: EDITOR_COLORS.accent,
  color: '#fff',
  cursor: 'pointer',
  fontSize: 10,
  fontWeight: 600,
};

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: `1px solid ${EDITOR_COLORS.border}`,
  backgroundColor: EDITOR_COLORS.bgLight,
};

const tabStyle: React.CSSProperties = {
  flex: 1,
  padding: '6px 4px',
  border: 'none',
  backgroundColor: 'transparent',
  color: EDITOR_COLORS.textDim,
  cursor: 'pointer',
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.3,
  borderBottomWidth: 2,
  borderBottomStyle: 'solid',
  borderBottomColor: 'transparent',
};

const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  color: EDITOR_COLORS.text,
  borderBottomColor: EDITOR_COLORS.accent,
};

const badgeStyle: React.CSSProperties = {
  display: 'inline-block',
  marginLeft: 3,
  padding: '0 4px',
  borderRadius: 8,
  backgroundColor: EDITOR_COLORS.bgLighter,
  color: EDITOR_COLORS.textMuted,
  fontSize: 9,
  fontWeight: 600,
  lineHeight: '14px',
};

const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
};

const layoutSectionStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: `1px solid ${EDITOR_COLORS.border}`,
};
