/**
 * ObjectTab
 *
 * Property panel tab for editing the selected element's properties.
 * Shows common properties (position, size, opacity) plus type-specific
 * editors based on the IRElement type.
 */

import React from 'react';
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
} from '@depix/core';
import { ColorInput } from '../property-controls/ColorInput.js';
import { NumberInput } from '../property-controls/NumberInput.js';
import { SliderInput } from '../property-controls/SliderInput.js';
import { SelectInput } from '../property-controls/SelectInput.js';
import { TextInput } from '../property-controls/TextInput.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ObjectTabProps {
  /** Currently selected elements. */
  elements: IRElement[];
  /** Callback when a style property changes. */
  onStyleChange: (id: string, style: Partial<IRStyle>) => void;
  /** Callback when text content changes. */
  onTextChange?: (id: string, text: string) => void;
  /** Callback when bounds (position/size) change. */
  onBoundsChange?: (id: string, bounds: Partial<IRBounds>) => void;
}

// ---------------------------------------------------------------------------
// Dark theme styles
// ---------------------------------------------------------------------------

const sectionStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid #333',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  color: '#888',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const emptyStyle: React.CSSProperties = {
  color: '#666',
  fontSize: '11px',
  textAlign: 'center',
  padding: '16px 8px',
};

const typeTagStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 6px',
  borderRadius: '3px',
  backgroundColor: '#333',
  color: '#aaa',
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  marginBottom: '8px',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveColor(value: string | { type: string } | undefined): string {
  if (!value) return '#000000';
  if (typeof value === 'string') return value;
  return '#000000';
}

// ---------------------------------------------------------------------------
// Common properties section
// ---------------------------------------------------------------------------

function CommonProperties({
  element,
  onStyleChange,
  onBoundsChange,
}: {
  element: IRElement;
  onStyleChange: (id: string, style: Partial<IRStyle>) => void;
  onBoundsChange?: (id: string, bounds: Partial<IRBounds>) => void;
}) {
  const { x, y, w, h } = element.bounds;
  const fill = resolveColor(element.style.fill);
  const stroke = resolveColor(element.style.stroke);
  const strokeWidth = element.style.strokeWidth ?? 1;
  const opacity = Math.round((element.transform?.opacity ?? 1) * 100);

  return (
    <>
      {/* Position & Size */}
      <div style={sectionStyle} data-section="bounds">
        <div style={sectionTitleStyle}>Position & Size</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          <NumberInput label="X" value={Math.round(x * 10) / 10} min={0} max={100} step={0.1} onChange={(val) => onBoundsChange?.(element.id, { x: val })} />
          <NumberInput label="Y" value={Math.round(y * 10) / 10} min={0} max={100} step={0.1} onChange={(val) => onBoundsChange?.(element.id, { y: val })} />
          <NumberInput label="W" value={Math.round(w * 10) / 10} min={0} max={100} step={0.1} onChange={(val) => onBoundsChange?.(element.id, { w: val })} />
          <NumberInput label="H" value={Math.round(h * 10) / 10} min={0} max={100} step={0.1} onChange={(val) => onBoundsChange?.(element.id, { h: val })} />
        </div>
      </div>

      {/* Style */}
      <div style={sectionStyle} data-section="style">
        <div style={sectionTitleStyle}>Style</div>
        <ColorInput label="Fill" value={fill} onChange={(color) => onStyleChange(element.id, { fill: color })} />
        <ColorInput label="Stroke" value={stroke} onChange={(color) => onStyleChange(element.id, { stroke: color })} />
        <NumberInput label="Stroke Width" value={strokeWidth} min={0} max={20} step={0.5} onChange={(val) => onStyleChange(element.id, { strokeWidth: val })} />
        <SliderInput label="Opacity" value={opacity} min={0} max={100} step={1} onChange={() => { /* opacity handled at parent level */ }} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Multi-selection section
// ---------------------------------------------------------------------------

function MultiSelectionProperties({
  elements,
  onStyleChange,
}: {
  elements: IRElement[];
  onStyleChange: (id: string, style: Partial<IRStyle>) => void;
}) {
  const first = elements[0];
  const fill = resolveColor(first.style.fill);
  const stroke = resolveColor(first.style.stroke);

  const applyToAll = (style: Partial<IRStyle>) => {
    for (const el of elements) {
      onStyleChange(el.id, style);
    }
  };

  return (
    <div style={sectionStyle} data-section="multi-style">
      <div style={sectionTitleStyle}>{elements.length} elements — Common Style</div>
      <ColorInput label="Fill" value={fill} onChange={(color) => applyToAll({ fill: color })} />
      <ColorInput label="Stroke" value={stroke} onChange={(color) => applyToAll({ stroke: color })} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Type-specific editors
// ---------------------------------------------------------------------------

function ShapeEditor({
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
    <div style={sectionStyle} data-section="shape">
      <div style={sectionTitleStyle}>Shape</div>
      <div style={typeTagStyle}>{element.shape}</div>
      <NumberInput label="Corner Radius" value={cornerRadius} min={0} max={50} step={1} onChange={() => onStyleChange(element.id, { strokeWidth: element.style.strokeWidth })} />
      <TextInput label="Inner Text" value={innerText} onChange={(text) => onTextChange?.(element.id, text)} />
    </div>
  );
}

function TextEditor({
  element,
  onTextChange,
  onStyleChange,
}: {
  element: IRText;
  onTextChange?: (id: string, text: string) => void;
  onStyleChange: (id: string, style: Partial<IRStyle>) => void;
}) {
  return (
    <div style={sectionStyle} data-section="text">
      <div style={sectionTitleStyle}>Text</div>
      <TextInput label="Content" value={element.content} multiline onChange={(text) => onTextChange?.(element.id, text)} />
      <NumberInput label="Font Size" value={element.fontSize} min={1} max={200} step={1} onChange={() => onStyleChange(element.id, { strokeWidth: element.style.strokeWidth })} />
      <ColorInput label="Color" value={element.color} onChange={() => onStyleChange(element.id, { strokeWidth: element.style.strokeWidth })} />
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

function LineEditor({
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
    <div style={sectionStyle} data-section="line">
      <div style={sectionTitleStyle}>Line</div>
      <NumberInput label="Stroke Width" value={element.style.strokeWidth ?? 1} min={0.5} max={20} step={0.5} onChange={(val) => onStyleChange(element.id, { strokeWidth: val })} />
      <SelectInput label="Arrow Start" value={element.arrowStart ?? 'none'} options={arrowOptions} onChange={() => {}} />
      <SelectInput label="Arrow End" value={element.arrowEnd ?? 'none'} options={arrowOptions} onChange={() => {}} />
    </div>
  );
}

function EdgeEditor({
  element,
  onTextChange,
}: {
  element: IREdge;
  onTextChange?: (id: string, text: string) => void;
}) {
  return (
    <div style={sectionStyle} data-section="edge">
      <div style={sectionTitleStyle}>Edge</div>
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

function ContainerEditor({
  element,
  onStyleChange,
}: {
  element: IRContainer;
  onStyleChange: (id: string, style: Partial<IRStyle>) => void;
}) {
  const fill = resolveColor(element.style.fill);
  const origin = element.origin;

  return (
    <div style={sectionStyle} data-section="container">
      <div style={sectionTitleStyle}>Container</div>
      {origin && <div style={typeTagStyle}>Layout: {origin.sourceType}</div>}
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

function ImageEditor({
  element,
  onTextChange,
}: {
  element: IRImage;
  onTextChange?: (id: string, text: string) => void;
}) {
  return (
    <div style={sectionStyle} data-section="image">
      <div style={sectionTitleStyle}>Image</div>
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ObjectTab: React.FC<ObjectTabProps> = ({
  elements,
  onStyleChange,
  onTextChange,
  onBoundsChange,
}) => {
  if (elements.length === 0) {
    return <div style={emptyStyle}>No selection</div>;
  }

  if (elements.length > 1) {
    return <MultiSelectionProperties elements={elements} onStyleChange={onStyleChange} />;
  }

  const el = elements[0];

  return (
    <div data-tab="object">
      <CommonProperties element={el} onStyleChange={onStyleChange} onBoundsChange={onBoundsChange} />

      {el.type === 'shape' && <ShapeEditor element={el} onStyleChange={onStyleChange} onTextChange={onTextChange} />}
      {el.type === 'text' && <TextEditor element={el} onTextChange={onTextChange} onStyleChange={onStyleChange} />}
      {el.type === 'line' && <LineEditor element={el} onStyleChange={onStyleChange} />}
      {el.type === 'edge' && <EdgeEditor element={el} onTextChange={onTextChange} />}
      {el.type === 'container' && <ContainerEditor element={el} onStyleChange={onStyleChange} />}
      {el.type === 'image' && <ImageEditor element={el} onTextChange={onTextChange} />}
    </div>
  );
};
