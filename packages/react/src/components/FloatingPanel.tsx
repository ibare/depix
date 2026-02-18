/**
 * FloatingPanel
 *
 * Base floating panel component with portal rendering, drag support,
 * collapse/expand, and dark theme styling.
 *
 * All editor floating UI (toolbar, property panel) is built on top of this.
 * Renders via createPortal to document.body for z-stacking independence.
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useDraggable } from '../hooks/useDraggable.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FloatingPanelProps {
  /** Panel title shown in header. */
  title?: string;
  /** Initial drag position. */
  initialPosition?: { x: number; y: number };
  /** Panel width. Default: 240 */
  width?: number | string;
  /** Whether the panel can be collapsed. Default: false */
  collapsible?: boolean;
  /** Whether to show a close button. Default: false */
  showClose?: boolean;
  /** Callback when close button is clicked. */
  onClose?: () => void;
  /** Extra elements rendered in the header (e.g. action buttons). */
  headerActions?: React.ReactNode;
  /** Panel content. */
  children: React.ReactNode;
  /** CSS class name. */
  className?: string;
  /** CSS inline style (merged onto panel root). */
  style?: React.CSSProperties;
  /** z-index override. Default: 1000 */
  zIndex?: number;
  /** Whether to render via portal. Default: true */
  portal?: boolean;
}

// ---------------------------------------------------------------------------
// Dark theme tokens
// ---------------------------------------------------------------------------

const COLORS = {
  bg: '#1e1e1e',
  headerBg: '#2a2a2a',
  border: '#333',
  text: '#ddd',
  textMuted: '#999',
  accent: '#3b82f6',
  hover: '#363636',
} as const;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const panelRootStyle: React.CSSProperties = {
  position: 'fixed',
  borderRadius: '8px',
  backgroundColor: COLORS.bg,
  border: `1px solid ${COLORS.border}`,
  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  color: COLORS.text,
  fontSize: '12px',
  userSelect: 'none',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const headerBaseStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '6px 8px',
  backgroundColor: COLORS.headerBg,
  borderBottom: `1px solid ${COLORS.border}`,
  cursor: 'grab',
  minHeight: '32px',
};

const headerTitleStyle: React.CSSProperties = {
  flex: 1,
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: COLORS.text,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const headerBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '20px',
  height: '20px',
  padding: 0,
  border: 'none',
  borderRadius: '4px',
  backgroundColor: 'transparent',
  color: COLORS.textMuted,
  cursor: 'pointer',
  fontSize: '14px',
  lineHeight: 1,
};

const bodyStyle: React.CSSProperties = {
  overflow: 'auto',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

export interface PanelSectionProps {
  title?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const PanelSection: React.FC<PanelSectionProps> = ({
  title,
  children,
  style: customStyle,
}) => (
  <div style={{ padding: '8px', ...customStyle }}>
    {title && (
      <div
        style={{
          fontSize: '10px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: COLORS.textMuted,
          marginBottom: '6px',
        }}
      >
        {title}
      </div>
    )}
    {children}
  </div>
);

export const PanelDivider: React.FC = () => (
  <div
    style={{
      height: '1px',
      backgroundColor: COLORS.border,
      margin: '0',
    }}
  />
);

export interface PanelButtonProps {
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const PanelButton: React.FC<PanelButtonProps> = ({
  onClick,
  active,
  disabled,
  title,
  children,
  style: customStyle,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '32px',
      height: '32px',
      padding: 0,
      border: 'none',
      borderRadius: '4px',
      backgroundColor: active ? COLORS.accent : 'transparent',
      color: active ? '#fff' : disabled ? '#555' : COLORS.text,
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      ...customStyle,
    }}
  >
    {children}
  </button>
);

// ---------------------------------------------------------------------------
// Chevron SVG
// ---------------------------------------------------------------------------

const ChevronIcon: React.FC<{ collapsed: boolean }> = ({ collapsed }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    style={{
      transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
      transition: 'transform 0.15s',
    }}
  >
    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FloatingPanel: React.FC<FloatingPanelProps> = ({
  title,
  initialPosition = { x: 16, y: 16 },
  width = 240,
  collapsible = false,
  showClose = false,
  onClose,
  headerActions,
  children,
  className,
  style,
  zIndex = 1000,
  portal = true,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const { position, dragHandleProps, isDragging } = useDraggable({
    initialPosition,
  });

  const hasHeader = !!(title || collapsible || showClose || headerActions);

  const panel = (
    <div
      data-floating-panel
      className={className}
      style={{
        ...panelRootStyle,
        width,
        zIndex,
        left: position.x,
        top: position.y,
        ...(isDragging ? { cursor: 'grabbing' } : {}),
        ...style,
      }}
    >
      {hasHeader && (
        <div
          style={{
            ...headerBaseStyle,
            ...(isDragging ? { cursor: 'grabbing' } : {}),
          }}
          {...dragHandleProps}
        >
          {collapsible && (
            <button
              type="button"
              style={headerBtnStyle}
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? 'Expand' : 'Collapse'}
            >
              <ChevronIcon collapsed={collapsed} />
            </button>
          )}
          {title && <div style={headerTitleStyle}>{title}</div>}
          {headerActions}
          {showClose && (
            <button
              type="button"
              style={headerBtnStyle}
              onClick={onClose}
              aria-label="Close panel"
            >
              ×
            </button>
          )}
        </div>
      )}

      {!collapsed && <div style={bodyStyle}>{children}</div>}
    </div>
  );

  if (portal && typeof document !== 'undefined') {
    return createPortal(panel, document.body);
  }

  return panel;
};
