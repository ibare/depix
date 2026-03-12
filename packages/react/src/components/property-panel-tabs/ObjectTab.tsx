/**
 * ObjectTab
 *
 * Property panel tab for editing the selected element's properties.
 * Shows common properties (position, size, opacity) plus type-specific
 * editors based on the IRElement type.
 */

import React from 'react';
import type { IRElement, IRStyle, IRBounds } from '@depix/core';
import {
  CommonPropertiesSection,
  ShapeSection,
  TextSection,
  LineSection,
  EdgeSection,
  ContainerSection,
  ImageSection,
  MultiSelectionSection,
  emptyStyle,
} from './sections/index.js';

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
    return <MultiSelectionSection elements={elements} onStyleChange={onStyleChange} />;
  }

  const el = elements[0];

  return (
    <div data-tab="object">
      <CommonPropertiesSection element={el} onStyleChange={onStyleChange} onBoundsChange={onBoundsChange} />

      {el.type === 'shape' && <ShapeSection element={el} onStyleChange={onStyleChange} onTextChange={onTextChange} />}
      {el.type === 'text' && <TextSection element={el} onTextChange={onTextChange} onStyleChange={onStyleChange} />}
      {el.type === 'line' && <LineSection element={el} onStyleChange={onStyleChange} />}
      {el.type === 'edge' && <EdgeSection element={el} onTextChange={onTextChange} />}
      {el.type === 'container' && <ContainerSection element={el} onStyleChange={onStyleChange} />}
      {el.type === 'image' && <ImageSection element={el} onTextChange={onTextChange} />}
    </div>
  );
};
