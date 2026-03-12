/**
 * FloatingPropertyPanel
 *
 * A floating property panel with 4-tab structure:
 * - Object: element properties (position, style, type-specific)
 * - Layers: element hierarchy
 * - Canvas: aspect ratio, background
 * - Scene: scene management
 *
 * Backward compatible: works with old props (elements + onStyleChange only)
 * and also supports the new extended props for full editor integration.
 *
 * Maintains test compatibility:
 * - role="region", aria-label="Property panel"
 * - data-draggable on root
 * - data-section attributes on inner sections (via ObjectTab → sections/)
 */

import React, { useState } from 'react';
import type {
  IRElement,
  IRStyle,
  IRBounds,
  DepixIR,
  IRBackground,
} from '@depix/core';
import { useDraggable } from '../hooks/useDraggable.js';
import { ObjectTab } from './property-panel-tabs/ObjectTab.js';
import { LayersTab } from './property-panel-tabs/LayersTab.js';
import { CanvasTab } from './property-panel-tabs/CanvasTab.js';
import { SceneTab } from './property-panel-tabs/SceneTab.js';
import { EDITOR_COLORS } from './editor/editor-colors.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FloatingPropertyPanelProps {
  // ---- Legacy (backward compatible) ----
  /** Currently selected elements. */
  elements: IRElement[];
  /** Callback when a style property changes. */
  onStyleChange: (id: string, style: Partial<IRStyle>) => void;
  /** Callback when text content changes. */
  onTextChange?: (id: string, text: string) => void;
  /** Callback when bounds (position/size) change. */
  onBoundsChange?: (id: string, bounds: Partial<IRBounds>) => void;
  /** CSS class name. */
  className?: string;
  /** CSS inline style. */
  style?: React.CSSProperties;
  /** Whether the panel can be dragged. Default: true */
  draggable?: boolean;

  // ---- New (extended editor) ----
  /** The full IR document (enables tabs). */
  ir?: DepixIR;
  /** Current scene index. */
  currentSceneIndex?: number;
  /** Selected element IDs. */
  selectedIds?: string[];
  /** Locked element IDs. */
  lockedIds?: Set<string>;
  /** Cancel editing callback. */
  onCancel?: () => void;
  /** Confirm editing callback. */
  onConfirm?: () => void;
  /** Scene change callback. */
  onSceneChange?: (index: number) => void;
  /** Add scene callback. */
  onAddScene?: () => void;
  /** Delete scene callback. */
  onDeleteScene?: (index: number) => void;
  /** Rename scene callback. */
  onRenameScene?: (index: number, name: string) => void;
  /** Reorder elements callback. */
  onReorderElements?: (sceneIndex: number, elementIds: string[]) => void;
  /** Select element callback. */
  onSelectElement?: (id: string, append?: boolean) => void;
  /** Toggle lock callback. */
  onToggleLock?: (id: string) => void;
  /** Aspect ratio change callback. */
  onAspectRatioChange?: (ratio: { width: number; height: number }) => void;
  /** Background change callback. */
  onBackgroundChange?: (bg: IRBackground) => void;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const panelStyle: React.CSSProperties = {
  width: 280,
  borderRadius: 8,
  backgroundColor: EDITOR_COLORS.bg,
  border: `1px solid ${EDITOR_COLORS.border}`,
  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  color: EDITOR_COLORS.text,
  userSelect: 'none',
  fontSize: 12,
  display: 'flex',
  flexDirection: 'column',
  maxHeight: 500,
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 8px',
  backgroundColor: EDITOR_COLORS.bgLight,
  borderBottom: `1px solid ${EDITOR_COLORS.border}`,
};

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: `1px solid ${EDITOR_COLORS.border}`,
  backgroundColor: EDITOR_COLORS.bgLight,
};

const tabBtnStyle: React.CSSProperties = {
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
  borderBottom: '2px solid transparent',
  position: 'relative',
};

const activeTabBtnStyle: React.CSSProperties = {
  ...tabBtnStyle,
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

const headerActionBtnStyle: React.CSSProperties = {
  padding: '3px 8px',
  border: `1px solid ${EDITOR_COLORS.border}`,
  borderRadius: 4,
  backgroundColor: 'transparent',
  color: EDITOR_COLORS.text,
  cursor: 'pointer',
  fontSize: 10,
  fontWeight: 600,
};

const confirmBtnStyle: React.CSSProperties = {
  ...headerActionBtnStyle,
  borderColor: EDITOR_COLORS.accent,
  backgroundColor: EDITOR_COLORS.accent,
  color: '#fff',
};

const legacyHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: EDITOR_COLORS.textMuted,
  padding: '8px 10px 4px',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

// ---------------------------------------------------------------------------
// Tab types
// ---------------------------------------------------------------------------

type TabId = 'object' | 'layers' | 'canvas' | 'scenes';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FloatingPropertyPanel: React.FC<FloatingPropertyPanelProps> = ({
  elements,
  onStyleChange,
  onTextChange,
  onBoundsChange,
  className,
  style,
  draggable = true,
  // New props
  ir,
  currentSceneIndex = 0,
  selectedIds = [],
  lockedIds,
  onCancel,
  onConfirm,
  onSceneChange,
  onAddScene,
  onDeleteScene,
  onRenameScene,
  onReorderElements,
  onSelectElement,
  onToggleLock,
  onAspectRatioChange,
  onBackgroundChange,
}) => {
  const { position, dragHandleProps, isDragging } = useDraggable({
    enabled: draggable,
  });

  const [activeTab, setActiveTab] = useState<TabId>('object');

  const wrapperStyle: React.CSSProperties = {
    position: 'absolute' as const,
    ...(draggable
      ? { transform: `translate(${position.x}px, ${position.y}px)` }
      : {}),
    ...(isDragging ? { cursor: 'grabbing' } : {}),
  };

  // ---- Legacy mode (no ir provided): render ObjectTab directly ----

  if (!ir) {
    return (
      <div
        role="region"
        aria-label="Property panel"
        className={className}
        style={{ ...wrapperStyle, ...panelStyle, ...style }}
        data-draggable={draggable}
        {...(draggable ? dragHandleProps : {})}
      >
        {elements.length === 1 && (
          <div style={legacyHeaderStyle}>
            {elements[0].type.charAt(0).toUpperCase() + elements[0].type.slice(1)}
          </div>
        )}
        {elements.length > 1 && (
          <div style={legacyHeaderStyle}>
            {elements.length} elements selected
          </div>
        )}
        <ObjectTab
          elements={elements}
          onStyleChange={onStyleChange}
          onTextChange={onTextChange}
          onBoundsChange={onBoundsChange}
        />
      </div>
    );
  }

  // ---- New tabbed mode (ir provided) ----

  const currentScene = ir.scenes[currentSceneIndex];
  const sceneElements = currentScene?.elements ?? [];

  const tabs: { id: TabId; label: string; badge?: number }[] = [
    { id: 'object', label: 'Object' },
    { id: 'layers', label: 'Layers', badge: sceneElements.length },
    { id: 'canvas', label: 'Canvas' },
    { id: 'scenes', label: 'Scenes', badge: ir.scenes.length },
  ];

  return (
    <div
      role="region"
      aria-label="Property panel"
      className={className}
      style={{ ...wrapperStyle, ...panelStyle, ...style }}
      data-draggable={draggable}
    >
      {/* Header with cancel/confirm */}
      <div style={headerStyle} {...(draggable ? dragHandleProps : {})}>
        <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: EDITOR_COLORS.text }}>
          Properties
        </div>
        {onCancel && (
          <button type="button" style={headerActionBtnStyle} onClick={onCancel}>
            Cancel
          </button>
        )}
        {onConfirm && (
          <button type="button" style={confirmBtnStyle} onClick={onConfirm}>
            Done
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div style={tabBarStyle}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            data-panel-tab={tab.id}
            style={activeTab === tab.id ? activeTabBtnStyle : tabBtnStyle}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span style={badgeStyle}>{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div style={bodyStyle}>
        {activeTab === 'object' && (
          <ObjectTab
            elements={elements}
            onStyleChange={onStyleChange}
            onTextChange={onTextChange}
            onBoundsChange={onBoundsChange}
          />
        )}

        {activeTab === 'layers' && (
          <LayersTab
            elements={sceneElements}
            selectedIds={selectedIds}
            lockedIds={lockedIds}
            onSelectElement={onSelectElement}
            onToggleLock={onToggleLock}
            onReorderElements={onReorderElements ? (ids) => onReorderElements(currentSceneIndex, ids) : undefined}
          />
        )}

        {activeTab === 'canvas' && (
          <CanvasTab
            aspectRatio={ir.meta.aspectRatio}
            background={ir.meta.background}
            onAspectRatioChange={onAspectRatioChange}
            onBackgroundChange={onBackgroundChange}
          />
        )}

        {activeTab === 'scenes' && (
          <SceneTab
            scenes={ir.scenes}
            currentSceneIndex={currentSceneIndex}
            onSceneChange={onSceneChange}
            onAddScene={onAddScene}
            onDeleteScene={onDeleteScene}
            onRenameScene={onRenameScene}
          />
        )}
      </div>
    </div>
  );
};
