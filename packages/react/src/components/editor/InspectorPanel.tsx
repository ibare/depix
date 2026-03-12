/**
 * InspectorPanel — tabbed property inspector for DSL editor.
 *
 * Replaces EditorPropertyPanel with a full inspector:
 * - Header: drag handle + Cancel / Done buttons
 * - Tab bar: Object | Layers(N) | Canvas | Scenes(N)
 * - Tab content: scrollable, rendered per active tab
 */

import React, { useState, useMemo } from 'react';
import type { DepixIR } from '@depix/core';
import { useDraggable } from '../../hooks/useDraggable.js';
import { useDSLInspectorCallbacks } from '../../hooks/useDSLInspectorCallbacks.js';
import { ObjectTab } from '../property-panel-tabs/ObjectTab.js';
import { LayersTab } from '../property-panel-tabs/LayersTab.js';
import { CanvasTab } from '../property-panel-tabs/CanvasTab.js';
import { SceneTab } from '../property-panel-tabs/SceneTab.js';
import { EDITOR_COLORS } from './editor-colors.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'object' | 'layers' | 'canvas' | 'scenes';

export interface InspectorPanelProps {
  /** Compiled IR (for reading element/scene data). */
  ir: DepixIR | null;
  /** Current DSL text. */
  dsl: string;
  /** Called when DSL changes due to inspector actions. */
  onDSLChange: (dsl: string) => void;
  /** Active scene index. */
  activeSceneIndex: number;
  /** Change active scene index. */
  onActiveSceneIndexChange: (index: number) => void;
  /** Currently selected element ID. */
  selectedElementId: string | null;
  /** Select an element by ID. */
  onSelectElement: (id: string | null) => void;
  /** Confirm editing (Done). */
  onConfirm: () => void;
  /** Cancel editing. */
  onCancel: () => void;
  /** Inline style overrides (for initial position). */
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
  const [activeTab, setActiveTab] = useState<TabId>('object');
  const [companionOpen, setCompanionOpen] = useState(false);

  const { position, dragHandleProps, isDragging } = useDraggable();

  // --- DSL mutation callbacks via adapter hook ---
  const callbacks = useDSLInspectorCallbacks({
    dsl,
    onDSLChange,
    activeSceneIndex,
    onActiveSceneIndexChange,
    ir,
  });

  // --- Selected elements for ObjectTab ---
  const selectedElements = useMemo(() => {
    if (!selectedElementId || !ir) return [];
    const scene = ir.scenes[activeSceneIndex];
    if (!scene) return [];
    const found = scene.elements.find((el) => el.id === selectedElementId);
    return found ? [found] : [];
  }, [ir, activeSceneIndex, selectedElementId]);

  // Derived counts for tab badges
  const elementCount = callbacks.sceneElements.length;
  const sceneCount = callbacks.scenes.length;

  const tabs: { id: TabId; label: string; badge?: number }[] = [
    { id: 'object', label: 'Object' },
    { id: 'layers', label: 'Layers', badge: elementCount },
    { id: 'canvas', label: 'Canvas' },
    { id: 'scenes', label: 'Scenes', badge: sceneCount },
  ];

  // Companion panel is available only for object ↔ layers tabs
  const hasCompanion = activeTab === 'object' || activeTab === 'layers';
  const companionLabel = activeTab === 'object' ? 'Layers' : 'Object';

  return (
    <div
      role="region"
      aria-label="Inspector panel"
      style={{
        ...panelStyle,
        transform: `translate(${position.x}px, ${position.y}px)`,
        ...(isDragging ? { cursor: 'grabbing' } : {}),
        ...style,
      }}
    >
      {/* ── Side expansion area (left of main panel) ── */}
      {hasCompanion && (
        <div
          style={{
            position: 'absolute',
            right: '100%',
            top: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'row',
            pointerEvents: 'auto',
          }}
        >
          {/* Companion panel (when open) */}
          {companionOpen && (
            <div style={companionPanelStyle} data-testid="companion-panel">
              <div style={companionHeaderStyle}>
                {companionLabel}
              </div>
              <div style={companionBodyStyle}>
                {activeTab === 'object' && (
                  <LayersTab
                    elements={callbacks.sceneElements}
                    selectedIds={selectedElementId ? [selectedElementId] : []}
                    onSelectElement={(id) => onSelectElement(id)}
                  />
                )}
                {activeTab === 'layers' && (
                  <ObjectTab
                    elements={selectedElements}
                    onStyleChange={callbacks.onStyleChange}
                    onTextChange={callbacks.onTextChange}
                    onBoundsChange={callbacks.onBoundsChange}
                  />
                )}
              </div>
            </div>
          )}

          {/* Side tab (toggle button) */}
          <button
            type="button"
            style={sideTabStyle}
            onClick={() => setCompanionOpen((o) => !o)}
            data-testid="companion-toggle"
            title={companionOpen ? 'Close companion' : `Show ${companionLabel}`}
          >
            <span style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', fontSize: 9 }}>
              {companionLabel}
            </span>
          </button>
        </div>
      )}

      {/* ── Header (drag handle + actions) ── */}
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

      {/* ── Tab bar ── */}
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

      {/* ── Tab content ── */}
      <div style={bodyStyle} data-testid={`tab-content-${activeTab}`}>
        {activeTab === 'object' && (
          <ObjectTab
            elements={selectedElements}
            onStyleChange={callbacks.onStyleChange}
            onTextChange={callbacks.onTextChange}
            onBoundsChange={callbacks.onBoundsChange}
          />
        )}

        {activeTab === 'layers' && (
          <LayersTab
            elements={callbacks.sceneElements}
            selectedIds={selectedElementId ? [selectedElementId] : []}
            onSelectElement={(id) => onSelectElement(id)}
          />
        )}

        {activeTab === 'canvas' && (
          <CanvasTab
            aspectRatio={ir?.meta?.aspectRatio ?? { width: 16, height: 9 }}
            background={ir?.meta?.background ?? { type: 'solid', color: '#ffffff' }}
          />
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
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  width: 280,
  maxHeight: 500,
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
  zIndex: 10001,
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

const sideTabStyle: React.CSSProperties = {
  width: 24,
  border: 'none',
  borderRadius: '4px 0 0 4px',
  backgroundColor: EDITOR_COLORS.bgLight,
  borderRight: `1px solid ${EDITOR_COLORS.border}`,
  color: EDITOR_COLORS.textMuted,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px 0',
};

const companionPanelStyle: React.CSSProperties = {
  width: 240,
  backgroundColor: EDITOR_COLORS.bg,
  borderRight: `1px solid ${EDITOR_COLORS.border}`,
  borderRadius: '8px 0 0 8px',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '-4px 0 12px rgba(0,0,0,0.2)',
};

const companionHeaderStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 10,
  fontWeight: 600,
  color: EDITOR_COLORS.textMuted,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  borderBottom: `1px solid ${EDITOR_COLORS.border}`,
  backgroundColor: EDITOR_COLORS.bgLight,
};

const companionBodyStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
};
