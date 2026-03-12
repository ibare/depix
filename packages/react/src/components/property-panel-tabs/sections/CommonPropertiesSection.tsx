/**
 * CommonPropertiesSection
 *
 * Position/Size + Style properties shared by all element types.
 */

import React from 'react';
import type { IRElement, IRStyle, IRBounds } from '@depix/core';
import { PropertySection } from '../../property-controls/PropertySection.js';
import { FieldGrid } from '../../property-controls/FieldGrid.js';
import { NumberInput } from '../../property-controls/NumberInput.js';
import { ColorInput } from '../../property-controls/ColorInput.js';
import { SliderInput } from '../../property-controls/SliderInput.js';
import { resolveColor, sectionStyle } from './shared.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommonPropertiesSectionProps {
  element: IRElement;
  onStyleChange: (id: string, style: Partial<IRStyle>) => void;
  onBoundsChange?: (id: string, bounds: Partial<IRBounds>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CommonPropertiesSection: React.FC<CommonPropertiesSectionProps> = ({
  element,
  onStyleChange,
  onBoundsChange,
}) => {
  const { x, y, w, h } = element.bounds;
  const fill = resolveColor(element.style.fill);
  const stroke = resolveColor(element.style.stroke);
  const strokeWidth = element.style.strokeWidth ?? 1;
  const opacity = Math.round((element.transform?.opacity ?? 1) * 100);

  return (
    <>
      <div style={sectionStyle} data-section="bounds">
        <PropertySection title="Position & Size" sectionId="bounds-inner">
          <FieldGrid columns={2}>
            <NumberInput label="X" value={Math.round(x * 10) / 10} min={0} max={100} step={0.1} inlineLabel onChange={(val) => onBoundsChange?.(element.id, { x: val })} />
            <NumberInput label="Y" value={Math.round(y * 10) / 10} min={0} max={100} step={0.1} inlineLabel onChange={(val) => onBoundsChange?.(element.id, { y: val })} />
            <NumberInput label="W" value={Math.round(w * 10) / 10} min={0} max={100} step={0.1} inlineLabel onChange={(val) => onBoundsChange?.(element.id, { w: val })} />
            <NumberInput label="H" value={Math.round(h * 10) / 10} min={0} max={100} step={0.1} inlineLabel onChange={(val) => onBoundsChange?.(element.id, { h: val })} />
          </FieldGrid>
        </PropertySection>
      </div>

      <div style={sectionStyle} data-section="style">
        <PropertySection title="Style" sectionId="style-inner">
          <ColorInput label="Fill" value={fill} onChange={(color) => onStyleChange(element.id, { fill: color })} />
          <ColorInput label="Stroke" value={stroke} onChange={(color) => onStyleChange(element.id, { stroke: color })} />
          <NumberInput label="Stroke Width" value={strokeWidth} min={0} max={20} step={0.5} onChange={(val) => onStyleChange(element.id, { strokeWidth: val })} />
          <SliderInput label="Opacity" value={opacity} min={0} max={100} step={1} onChange={() => { /* opacity handled at parent level */ }} />
        </PropertySection>
      </div>
    </>
  );
};
