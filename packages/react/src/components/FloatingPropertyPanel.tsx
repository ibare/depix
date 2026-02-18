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
 * - data-section attributes on inner sections
 */

import React, { useState, useCallback } from 'react';
import type {
  IRElement,
  IRStyle,
  IRBounds,
  IRShape,
  IRText,
  IRLine,
  IREdge,
  IRContainer,
  IRImage,
  DepixIR,
  IRBackground,
} from '@depix/core';
import { useDraggable } from '../hooks/useDraggable.js';
import { ColorInput } from './property-controls/ColorInput.js';
import { NumberInput } from './property-controls/NumberInput.js';
import { SliderInput } from './property-controls/SliderInput.js';
import { SelectInput } from './property-controls/SelectInput.js';
import { TextInput } from './property-controls/TextInput.js';
import { ObjectTab } from './property-panel-tabs/ObjectTab.js';
import { LayersTab } from './property-panel-tabs/LayersTab.js';
import { CanvasTab } from './property-panel-tabs/CanvasTab.js';
import { SceneTab } from './property-panel-tabs/SceneTab.js';

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
// Dark theme tokens
// ---------------------------------------------------------------------------

const COLORS = {
  bg: '#1e1e1e',
  headerBg: '#2a2a2a',
  border: '#333',
  text: '#ddd',
  textMuted: '#999',
  accent: '#3b82f6',
  tabActive: '#3b82f6',
  tabInactive: '#666',
} as const;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const panelStyle: React.CSSProperties = {
  width: '280px',
  borderRadius: '8px',
  backgroundColor: COLORS.bg,
  border: `1px solid ${COLORS.border}`,
  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  color: COLORS.text,
  userSelect: 'none',
  fontSize: '12px',
  display: 'flex',
  flexDirection: 'column',
  maxHeight: '500px',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '4px 8px',
  backgroundColor: COLORS.headerBg,
  borderBottom: `1px solid ${COLORS.border}`,
};

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: `1px solid ${COLORS.border}`,
  backgroundColor: COLORS.headerBg,
};

const tabBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '6px 4px',
  border: 'none',
  backgroundColor: 'transparent',
  color: COLORS.tabInactive,
  cursor: 'pointer',
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
  borderBottom: '2px solid transparent',
  position: 'relative',
};

const activeTabBtnStyle: React.CSSProperties = {
  ...tabBtnStyle,
  color: COLORS.text,
  borderBottomColor: COLORS.tabActive,
};

const badgeStyle: React.CSSProperties = {
  display: 'inline-block',
  marginLeft: '3px',
  padding: '0 4px',
  borderRadius: '8px',
  backgroundColor: '#333',
  color: '#aaa',
  fontSize: '9px',
  fontWeight: 600,
  lineHeight: '14px',
};

const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
};

const headerActionBtnStyle: React.CSSProperties = {
  padding: '3px 8px',
  border: '1px solid #444',
  borderRadius: '4px',
  backgroundColor: 'transparent',
  color: '#ccc',
  cursor: 'pointer',
  fontSize: '10px',
  fontWeight: 600,
};

const confirmBtnStyle: React.CSSProperties = {
  ...headerActionBtnStyle,
  borderColor: COLORS.accent,
  backgroundColor: COLORS.accent,
  color: '#fff',
};

// ---------------------------------------------------------------------------
// Legacy styles (for backward-compat mode)
// ---------------------------------------------------------------------------

const legacyPanelStyle: React.CSSProperties = {
  minWidth: '220px',
  maxWidth: '280px',
  padding: '12px',
  borderRadius: '8px',
  backgroundColor: '#ffffff',
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  userSelect: 'none',
  fontSize: '13px',
};

const legacyHeaderStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 'bold',
  color: '#333',
  marginBottom: '8px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const legacySectionStyle: React.CSSProperties = {
  marginBottom: '8px',
  paddingBottom: '8px',
  borderBottom: '1px solid #eee',
};

const legacySectionTitleStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 'bold',
  color: '#888',
  marginBottom: '4px',
  textTransform: 'uppercase',
};

const emptyStyle: React.CSSProperties = {
  color: '#999',
  fontSize: '12px',
  textAlign: 'center',
  padding: '8px',
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function resolveColor(value: string | { type: string } | undefined): string {
  if (!value) return '#000000';
  if (typeof value === 'string') return value;
  return '#000000';
}

// ---------------------------------------------------------------------------
// Legacy section renderers (for backward compat when ir is not provided)
// ---------------------------------------------------------------------------

function CommonStyleSection({
  element,
  onStyleChange,
}: {
  element: IRElement;
  onStyleChange: (id: string, style: Partial<IRStyle>) => void;
}) {
  const fill = resolveColor(element.style.fill);
  const stroke = resolveColor(element.style.stroke);
  const strokeWidth = element.style.strokeWidth ?? 1;
  const opacity = (element.transform?.opacity ?? 1) * 100;

  return (
    <div style={legacySectionStyle} data-section="style">
      <div style={legacySectionTitleStyle}>Style</div>
      <ColorInput label="Fill" value={fill} onChange={(color) => onStyleChange(element.id, { fill: color })} />
      <ColorInput label="Stroke" value={stroke} onChange={(color) => onStyleChange(element.id, { stroke: color })} />
      <NumberInput label="Stroke Width" value={strokeWidth} min={0} max={20} step={0.5} onChange={(val) => onStyleChange(element.id, { strokeWidth: val })} />
      <SliderInput label="Opacity" value={Math.round(opacity)} min={0} max={100} step={1} onChange={(val) => onStyleChange(element.id, { fill: element.style.fill as string })} />
    </div>
  );
}

function MultiSelectionSection({
  elements,
  onStyleChange,
}: {
  elements: IRElement[];
  onStyleChange: (id: string, style: Partial<IRStyle>) => void;
}) {
  const first = elements[0];
  const fill = resolveColor(first.style.fill);
  const stroke = resolveColor(first.style.stroke);
  const opacity = (first.transform?.opacity ?? 1) * 100;

  const applyToAll = useCallback(
    (style: Partial<IRStyle>) => {
      for (const el of elements) {
        onStyleChange(el.id, style);
      }
    },
    [elements, onStyleChange],
  );

  return (
    <div style={legacySectionStyle} data-section="multi-style">
      <div style={legacySectionTitleStyle}>Common Style</div>
      <ColorInput label="Fill" value={fill} onChange={(color) => applyToAll({ fill: color })} />
      <ColorInput label="Stroke" value={stroke} onChange={(color) => applyToAll({ stroke: color })} />
      <SliderInput label="Opacity" value={Math.round(opacity)} min={0} max={100} step={1} onChange={() => {}} />
    </div>
  );
}

function ShapeSection({
  element,
  onStyleChange,
  onTextChange,
}: {
  element: IRShape;
  onStyleChange: (id: string, style: Partial<IRStyle>) => void;
  onTextChange?: (id: string, text: string) => void;
}) {
  const cornerRadius = typeof element.cornerRadius === 'number' ? element.cornerRadius : 0;
  const innerText = element.innerText?.content ?? '';

  return (
    <div style={legacySectionStyle} data-section="shape">
      <div style={legacySectionTitleStyle}>Shape</div>
      <NumberInput label="Corner Radius" value={cornerRadius} min={0} max={50} step={1} onChange={() => onStyleChange(element.id, { strokeWidth: element.style.strokeWidth })} />
      <TextInput label="Inner Text" value={innerText} onChange={(text) => onTextChange?.(element.id, text)} />
    </div>
  );
}

function TextSection({
  element,
  onTextChange,
  onStyleChange,
}: {
  element: IRText;
  onTextChange?: (id: string, text: string) => void;
  onStyleChange: (id: string, style: Partial<IRStyle>) => void;
}) {
  return (
    <div style={legacySectionStyle} data-section="text">
      <div style={legacySectionTitleStyle}>Text</div>
      <TextInput label="Content" value={element.content} multiline onChange={(text) => onTextChange?.(element.id, text)} />
      <NumberInput label="Font Size" value={element.fontSize} min={1} max={200} step={1} onChange={() => onStyleChange(element.id, { strokeWidth: element.style.strokeWidth })} />
      <SelectInput
        label="Font Weight"
        value={element.fontWeight ?? 'normal'}
        options={[{ value: 'normal', label: 'Normal' }, { value: 'bold', label: 'Bold' }]}
        onChange={() => onStyleChange(element.id, { strokeWidth: element.style.strokeWidth })}
      />
      <SelectInput
        label="Text Align"
        value={element.align ?? 'left'}
        options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]}
        onChange={() => onStyleChange(element.id, { strokeWidth: element.style.strokeWidth })}
      />
    </div>
  );
}

function LineSection({
  element,
  onStyleChange,
}: {
  element: IRLine;
  onStyleChange: (id: string, style: Partial<IRStyle>) => void;
}) {
  const arrowOptions = [
    { value: 'none', label: 'None' },
    { value: 'triangle', label: 'Triangle' },
    { value: 'diamond', label: 'Diamond' },
    { value: 'circle', label: 'Circle' },
    { value: 'open-triangle', label: 'Open Triangle' },
  ];

  return (
    <div style={legacySectionStyle} data-section="line">
      <div style={legacySectionTitleStyle}>Line</div>
      <NumberInput label="Stroke Width" value={element.style.strokeWidth ?? 1} min={0.5} max={20} step={0.5} onChange={(val) => onStyleChange(element.id, { strokeWidth: val })} />
      <SelectInput label="Arrow Start" value={element.arrowStart ?? 'none'} options={arrowOptions} onChange={() => {}} />
      <SelectInput label="Arrow End" value={element.arrowEnd ?? 'none'} options={arrowOptions} onChange={() => {}} />
    </div>
  );
}

function EdgeSection({
  element,
  onTextChange,
}: {
  element: IREdge;
  onTextChange?: (id: string, text: string) => void;
}) {
  return (
    <div style={legacySectionStyle} data-section="edge">
      <div style={legacySectionTitleStyle}>Edge</div>
      <SelectInput
        label="Path Type"
        value={element.path.type}
        options={[{ value: 'straight', label: 'Straight' }, { value: 'polyline', label: 'Orthogonal' }, { value: 'bezier', label: 'Bezier' }]}
        onChange={() => {}}
      />
      <TextInput label="Label" value={element.labels?.[0]?.text ?? ''} onChange={(text) => onTextChange?.(element.id, text)} />
    </div>
  );
}

function ContainerSection({
  element,
  onStyleChange,
}: {
  element: IRContainer;
  onStyleChange: (id: string, style: Partial<IRStyle>) => void;
}) {
  const fill = resolveColor(element.style.fill);

  return (
    <div style={legacySectionStyle} data-section="container">
      <div style={legacySectionTitleStyle}>Container</div>
      <ColorInput label="Background" value={fill} onChange={(color) => onStyleChange(element.id, { fill: color })} />
      <SelectInput
        label="Clip"
        value={element.clip ? 'true' : 'false'}
        options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]}
        onChange={() => {}}
      />
    </div>
  );
}

function ImageSection({
  element,
  onTextChange,
}: {
  element: IRImage;
  onTextChange?: (id: string, text: string) => void;
}) {
  return (
    <div style={legacySectionStyle} data-section="image">
      <div style={legacySectionTitleStyle}>Image</div>
      <TextInput label="Source" value={element.src} onChange={(text) => onTextChange?.(element.id, text)} />
      <SelectInput
        label="Fit"
        value={element.fit ?? 'contain'}
        options={[{ value: 'contain', label: 'Contain' }, { value: 'cover', label: 'Cover' }, { value: 'fill', label: 'Fill' }]}
        onChange={() => {}}
      />
    </div>
  );
}

function BoundsSection({
  element,
  onBoundsChange,
}: {
  element: IRElement;
  onBoundsChange?: (id: string, bounds: Partial<IRBounds>) => void;
}) {
  const { x, y, w, h } = element.bounds;

  return (
    <div style={legacySectionStyle} data-section="bounds">
      <div style={legacySectionTitleStyle}>Position & Size</div>
      <NumberInput label="X" value={Math.round(x * 10) / 10} min={0} max={100} step={0.1} onChange={(val) => onBoundsChange?.(element.id, { x: val })} />
      <NumberInput label="Y" value={Math.round(y * 10) / 10} min={0} max={100} step={0.1} onChange={(val) => onBoundsChange?.(element.id, { y: val })} />
      <NumberInput label="W" value={Math.round(w * 10) / 10} min={0} max={100} step={0.1} onChange={(val) => onBoundsChange?.(element.id, { w: val })} />
      <NumberInput label="H" value={Math.round(h * 10) / 10} min={0} max={100} step={0.1} onChange={(val) => onBoundsChange?.(element.id, { h: val })} />
    </div>
  );
}

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

  // ---- Legacy mode (no ir provided): render old-style panel ----

  if (!ir) {
    if (elements.length === 0) {
      return (
        <div
          role="region"
          aria-label="Property panel"
          className={className}
          style={{ ...wrapperStyle, ...legacyPanelStyle, ...style }}
          data-draggable={draggable}
          {...(draggable ? dragHandleProps : {})}
        >
          <div style={emptyStyle}>No selection</div>
        </div>
      );
    }

    if (elements.length > 1) {
      return (
        <div
          role="region"
          aria-label="Property panel"
          className={className}
          style={{ ...wrapperStyle, ...legacyPanelStyle, ...style }}
          data-draggable={draggable}
          {...(draggable ? dragHandleProps : {})}
        >
          <div style={legacyHeaderStyle}>{elements.length} elements selected</div>
          <MultiSelectionSection elements={elements} onStyleChange={onStyleChange} />
        </div>
      );
    }

    const el = elements[0];
    const typeLabel = el.type.charAt(0).toUpperCase() + el.type.slice(1);

    return (
      <div
        role="region"
        aria-label="Property panel"
        className={className}
        style={{ ...wrapperStyle, ...legacyPanelStyle, ...style }}
        data-draggable={draggable}
        {...(draggable ? dragHandleProps : {})}
      >
        <div style={legacyHeaderStyle}>{typeLabel}</div>
        <CommonStyleSection element={el} onStyleChange={onStyleChange} />
        <BoundsSection element={el} onBoundsChange={onBoundsChange} />
        {el.type === 'shape' && <ShapeSection element={el} onStyleChange={onStyleChange} onTextChange={onTextChange} />}
        {el.type === 'text' && <TextSection element={el} onTextChange={onTextChange} onStyleChange={onStyleChange} />}
        {el.type === 'line' && <LineSection element={el} onStyleChange={onStyleChange} />}
        {el.type === 'edge' && <EdgeSection element={el} onTextChange={onTextChange} />}
        {el.type === 'container' && <ContainerSection element={el} onStyleChange={onStyleChange} />}
        {el.type === 'image' && <ImageSection element={el} onTextChange={onTextChange} />}
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
        <div style={{ flex: 1, fontSize: '11px', fontWeight: 600, color: COLORS.text }}>
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
