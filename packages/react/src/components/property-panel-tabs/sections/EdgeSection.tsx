/**
 * EdgeSection
 *
 * Type-specific editor for IREdge elements.
 */

import React from 'react';
import type { IREdge } from '@depix/core';
import { PropertySection } from '../../property-controls/PropertySection.js';
import { SelectInput } from '../../property-controls/SelectInput.js';
import { TextInput } from '../../property-controls/TextInput.js';
import { sectionStyle } from './shared.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EdgeSectionProps {
  element: IREdge;
  onTextChange?: (id: string, text: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const EdgeSection: React.FC<EdgeSectionProps> = ({
  element,
  onTextChange,
}) => {
  return (
    <div style={sectionStyle} data-section="edge">
      <PropertySection title="Edge">
        <SelectInput
          label="Path Type"
          value={element.path.type}
          options={[{ value: 'straight', label: 'Straight' }, { value: 'polyline', label: 'Orthogonal' }, { value: 'bezier', label: 'Bezier' }]}
          onChange={() => {}}
        />
        <TextInput label="Label" value={element.labels?.[0]?.text ?? ''} onChange={(text) => onTextChange?.(element.id, text)} />
      </PropertySection>
    </div>
  );
};
