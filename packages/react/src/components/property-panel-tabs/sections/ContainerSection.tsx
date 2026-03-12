/**
 * ContainerSection
 *
 * Type-specific editor for IRContainer elements.
 */

import React from 'react';
import type { IRContainer, IRStyle } from '@depix/core';
import { PropertySection } from '../../property-controls/PropertySection.js';
import { ColorInput } from '../../property-controls/ColorInput.js';
import { SelectInput } from '../../property-controls/SelectInput.js';
import { resolveColor, sectionStyle, typeTagStyle } from './shared.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContainerSectionProps {
  element: IRContainer;
  onStyleChange: (id: string, style: Partial<IRStyle>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ContainerSection: React.FC<ContainerSectionProps> = ({
  element,
  onStyleChange,
}) => {
  const fill = resolveColor(element.style.fill);
  const origin = element.origin;

  return (
    <div style={sectionStyle} data-section="container">
      <PropertySection title="Container">
        {origin && <div style={typeTagStyle}>Layout: {origin.sourceType}</div>}
        <ColorInput label="Background" value={fill} onChange={(color) => onStyleChange(element.id, { fill: color })} />
        <SelectInput
          label="Clip"
          value={element.clip ? 'true' : 'false'}
          options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]}
          onChange={() => {}}
        />
      </PropertySection>
    </div>
  );
};
