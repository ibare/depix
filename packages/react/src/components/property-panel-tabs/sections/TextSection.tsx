/**
 * TextSection
 *
 * Type-specific editor for IRText elements.
 * Bug fix: onChange handlers now pass correct style keys instead of strokeWidth.
 */

import React from 'react';
import type { IRText, IRStyle } from '@depix/core';
import { PropertySection } from '../../property-controls/PropertySection.js';
import { TextInput } from '../../property-controls/TextInput.js';
import { NumberInput } from '../../property-controls/NumberInput.js';
import { ColorInput } from '../../property-controls/ColorInput.js';
import { SelectInput } from '../../property-controls/SelectInput.js';
import { sectionStyle } from './shared.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TextSectionProps {
  element: IRText;
  onStyleChange: (id: string, style: Partial<IRStyle>) => void;
  onTextChange?: (id: string, text: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const TextSection: React.FC<TextSectionProps> = ({
  element,
  onStyleChange,
  onTextChange,
}) => {
  return (
    <div style={sectionStyle} data-section="text">
      <PropertySection title="Text">
        <TextInput label="Content" value={element.content} multiline onChange={(text) => onTextChange?.(element.id, text)} />
        <NumberInput
          label="Font Size"
          value={element.fontSize}
          min={1}
          max={200}
          step={1}
          onChange={(val) => onStyleChange(element.id, { fontSize: val } as Partial<IRStyle>)}
        />
        <ColorInput
          label="Color"
          value={element.color}
          onChange={(color) => onStyleChange(element.id, { color } as Partial<IRStyle>)}
        />
        <SelectInput
          label="Font Weight"
          value={element.fontWeight ?? 'normal'}
          options={[{ value: 'normal', label: 'Normal' }, { value: 'bold', label: 'Bold' }]}
          onChange={(val) => onStyleChange(element.id, { fontWeight: val } as Partial<IRStyle>)}
        />
        <SelectInput
          label="Text Align"
          value={element.align ?? 'left'}
          options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]}
          onChange={(val) => onStyleChange(element.id, { align: val } as Partial<IRStyle>)}
        />
      </PropertySection>
    </div>
  );
};
