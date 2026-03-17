/**
 * ElementTypeDropdown — Grid for switching the selected element's DSL type.
 */

import React from 'react';
import { getSuggestionsForElementSwitch } from './picker-suggestions.js';
import { SuggestionButton, SectionLabel } from './PickerUI.js';
import { EDITOR_COLORS } from '../editor-colors.js';

export function ElementTypeDropdown({
  currentType,
  onSelect,
}: {
  currentType: string;
  onSelect: (newType: string) => void;
}) {
  const suggestions = getSuggestionsForElementSwitch(currentType);
  return (
    <div
      style={{
        marginTop: 4,
        background: EDITOR_COLORS.bg,
        border: `1px solid ${EDITOR_COLORS.border}`,
        borderRadius: 8,
        padding: 8,
        minWidth: 160,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      <SectionLabel text="Change to" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
        {suggestions.map((item) => (
          <SuggestionButton key={item.type} item={item} onClick={() => onSelect(item.type)} />
        ))}
      </div>
    </div>
  );
}
