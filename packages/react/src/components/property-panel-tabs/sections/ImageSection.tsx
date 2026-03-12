/**
 * ImageSection
 *
 * Type-specific editor for IRImage elements.
 */

import React from 'react';
import type { IRImage } from '@depix/core';
import { PropertySection } from '../../property-controls/PropertySection.js';
import { TextInput } from '../../property-controls/TextInput.js';
import { SelectInput } from '../../property-controls/SelectInput.js';
import { sectionStyle } from './shared.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImageSectionProps {
  element: IRImage;
  onTextChange?: (id: string, text: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ImageSection: React.FC<ImageSectionProps> = ({
  element,
  onTextChange,
}) => {
  return (
    <div style={sectionStyle} data-section="image">
      <PropertySection title="Image">
        <TextInput label="Source" value={element.src} onChange={(text) => onTextChange?.(element.id, text)} />
        <SelectInput
          label="Fit"
          value={element.fit ?? 'contain'}
          options={[{ value: 'contain', label: 'Contain' }, { value: 'cover', label: 'Cover' }, { value: 'fill', label: 'Fill' }]}
          onChange={() => {}}
        />
      </PropertySection>
    </div>
  );
};
