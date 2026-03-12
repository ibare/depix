/**
 * LineSection
 *
 * Type-specific editor for IRLine elements.
 */

import React from 'react';
import type { IRLine, IRStyle } from '@depix/core';
import { PropertySection } from '../../property-controls/PropertySection.js';
import { NumberInput } from '../../property-controls/NumberInput.js';
import { SelectInput } from '../../property-controls/SelectInput.js';
import { sectionStyle } from './shared.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const arrowOptions = [
  { value: 'none', label: 'None' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'circle', label: 'Circle' },
  { value: 'open-triangle', label: 'Open Triangle' },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LineSectionProps {
  element: IRLine;
  onStyleChange: (id: string, style: Partial<IRStyle>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const LineSection: React.FC<LineSectionProps> = ({
  element,
  onStyleChange,
}) => {
  return (
    <div style={sectionStyle} data-section="line">
      <PropertySection title="Line">
        <NumberInput label="Stroke Width" value={element.style.strokeWidth ?? 1} min={0.5} max={20} step={0.5} onChange={(val) => onStyleChange(element.id, { strokeWidth: val })} />
        <SelectInput label="Arrow Start" value={element.arrowStart ?? 'none'} options={arrowOptions} onChange={() => {}} />
        <SelectInput label="Arrow End" value={element.arrowEnd ?? 'none'} options={arrowOptions} onChange={() => {}} />
      </PropertySection>
    </div>
  );
};
