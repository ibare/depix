/**
 * ShapeSection
 *
 * Type-specific editor for IRShape elements.
 */

import React from 'react';
import type { IRShape, IRStyle } from '@depix/core';
import { PropertySection } from '../../property-controls/PropertySection.js';
import { NumberInput } from '../../property-controls/NumberInput.js';
import { TextInput } from '../../property-controls/TextInput.js';
import { sectionStyle, typeTagStyle } from './shared.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShapeSectionProps {
  element: IRShape;
  onStyleChange: (id: string, style: Partial<IRStyle>) => void;
  onTextChange?: (id: string, text: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ShapeSection: React.FC<ShapeSectionProps> = ({
  element,
  onStyleChange,
  onTextChange,
}) => {
  const cornerRadius = typeof element.cornerRadius === 'number' ? element.cornerRadius : 0;
  const innerText = element.innerText?.content ?? '';

  return (
    <div style={sectionStyle} data-section="shape">
      <PropertySection title="Shape">
        <div style={typeTagStyle}>{element.shape}</div>
        <NumberInput
          label="Corner Radius"
          value={cornerRadius}
          min={0}
          max={50}
          step={1}
          onChange={(val) => onStyleChange(element.id, { cornerRadius: val } as Partial<IRStyle>)}
        />
        <TextInput label="Inner Text" value={innerText} onChange={(text) => onTextChange?.(element.id, text)} />
      </PropertySection>
    </div>
  );
};
