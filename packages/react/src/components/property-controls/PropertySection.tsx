/**
 * PropertySection
 *
 * A collapsible section container for grouping property controls.
 * Click the header row to toggle collapse/expand.
 */

import React, { useState } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import { EDITOR_COLORS } from '../editor/editor-colors.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PropertySectionProps {
  /** Section title displayed in the header. */
  title: string;
  /** Optional data-section attribute for testing. */
  sectionId?: string;
  /** Whether the section starts collapsed. Default: false */
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '7px 10px',
  cursor: 'pointer',
  userSelect: 'none',
  marginBottom: 6,
  backgroundColor: EDITOR_COLORS.bgLight,
  borderRadius: 6,
};

const titleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: EDITOR_COLORS.text,
};

const chevronStyle: React.CSSProperties = {
  fontSize: 12,
  color: EDITOR_COLORS.textMuted,
  transition: 'transform 150ms ease',
  lineHeight: 1,
};

const bodyStyle: React.CSSProperties = {
  paddingBottom: 8,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PropertySection: React.FC<PropertySectionProps> = ({
  title,
  sectionId,
  defaultCollapsed = false,
  children,
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div data-section={sectionId}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        aria-label={`${title} section`}
        style={headerStyle}
        onClick={() => setCollapsed((c) => !c)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setCollapsed((c) => !c);
          }
        }}
      >
        <span style={titleStyle}>{title}</span>
        <CaretDown
          size={14}
          weight="bold"
          style={{
            ...chevronStyle,
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          }}
        />
      </div>
      {!collapsed && <div style={bodyStyle}>{children}</div>}
    </div>
  );
};
