/**
 * MultiSelectionSection
 *
 * Shared style editor for multiple selected elements.
 */

import React from 'react';
import type { IRElement, IRStyle } from '@depix/core';
import { PropertySection } from '../../property-controls/PropertySection.js';
import { ColorInput } from '../../property-controls/ColorInput.js';
import { resolveColor, sectionStyle } from './shared.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MultiSelectionSectionProps {
  elements: IRElement[];
  onStyleChange: (id: string, style: Partial<IRStyle>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MultiSelectionSection: React.FC<MultiSelectionSectionProps> = ({
  elements,
  onStyleChange,
}) => {
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
      <PropertySection title={`${elements.length} elements — Common Style`}>
        <ColorInput label="Fill" value={fill} onChange={(color) => applyToAll({ fill: color })} />
        <ColorInput label="Stroke" value={stroke} onChange={(color) => applyToAll({ stroke: color })} />
      </PropertySection>
    </div>
  );
};
