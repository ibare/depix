/**
 * LayersTab
 *
 * Property panel tab for viewing and interacting with the element
 * hierarchy. Shows elements in reverse z-order, with container
 * children indented. Supports click selection, lock toggle, and
 * type-based icons.
 */

import React from 'react';
import { Lock, LockOpen } from '@phosphor-icons/react';
import type { IRElement, IRContainer } from '@depix/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LayersTabProps {
  /** All elements in the current scene (top-level). */
  elements: IRElement[];
  /** Currently selected element IDs. */
  selectedIds: string[];
  /** Locked element IDs. */
  lockedIds?: Set<string>;
  /** Callback when an element is clicked for selection. */
  onSelectElement?: (id: string, append?: boolean) => void;
  /** Callback when an element is double-clicked (opens property panel). */
  onDoubleClickElement?: (id: string) => void;
  /** Callback when an element's lock state is toggled. */
  onToggleLock?: (id: string) => void;
  /** Callback when element order changes. */
  onReorderElements?: (elementIds: string[]) => void;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const listStyle: React.CSSProperties = {
  padding: '4px 0',
  listStyle: 'none',
  margin: 0,
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 8px',
  cursor: 'pointer',
  fontSize: '11px',
  borderRadius: '3px',
  margin: '1px 4px',
};

const selectedItemStyle: React.CSSProperties = {
  ...itemStyle,
  backgroundColor: 'rgba(59, 130, 246, 0.2)',
};

const typeIconStyle: React.CSSProperties = {
  width: '14px',
  height: '14px',
  opacity: 0.6,
  flexShrink: 0,
};

const labelStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: '#ccc',
};

const lockBtnStyle: React.CSSProperties = {
  width: '18px',
  height: '18px',
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  color: '#666',
  fontSize: '12px',
  flexShrink: 0,
};

const emptyStyle: React.CSSProperties = {
  color: '#666',
  fontSize: '11px',
  textAlign: 'center',
  padding: '16px 8px',
};

// ---------------------------------------------------------------------------
// Type icon SVGs
// ---------------------------------------------------------------------------

function TypeIcon({ type }: { type: string }) {
  const common: React.SVGProps<SVGSVGElement> = {
    width: 14,
    height: 14,
    viewBox: '0 0 14 14',
    fill: 'none',
    style: typeIconStyle,
  };

  switch (type) {
    case 'shape':
      return <svg {...common}><rect x="2" y="3" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" /></svg>;
    case 'text':
      return <svg {...common}><path d="M4 3H10M7 3V11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>;
    case 'line':
      return <svg {...common}><path d="M2 12L12 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>;
    case 'edge':
      return <svg {...common}><path d="M2 7H12M9 4L12 7L9 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case 'container':
      return <svg {...common}><rect x="2" y="2" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1" /></svg>;
    case 'image':
      return <svg {...common}><rect x="2" y="3" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" /><circle cx="5" cy="5.5" r="1" fill="currentColor" /></svg>;
    case 'path':
      return <svg {...common}><path d="M2 10C4 4 10 4 12 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>;
    default:
      return <svg {...common}><circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="1.2" /></svg>;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getElementLabel(el: IRElement): string {
  switch (el.type) {
    case 'text':
      return el.content.slice(0, 20) || 'Text';
    case 'shape':
      return el.innerText?.content?.slice(0, 20) || el.shape;
    case 'edge':
      return el.labels?.[0]?.text?.slice(0, 20) || 'Edge';
    case 'image':
      return 'Image';
    case 'container': {
      const container = el as IRContainer;
      if (container.origin?.sourceType === 'scene-slot' && container.origin.slotName) {
        return container.origin.slotName;
      }
      return `Container (${container.children.length})`;
    }
    case 'line':
      return 'Line';
    case 'path':
      return 'Path';
    default:
      return (el as IRElement).type;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function LayerItem({
  element,
  depth,
  selectedIds,
  lockedIds,
  onSelectElement,
  onDoubleClickElement,
  onToggleLock,
}: {
  element: IRElement;
  depth: number;
  selectedIds: string[];
  lockedIds: Set<string>;
  onSelectElement?: (id: string, append?: boolean) => void;
  onDoubleClickElement?: (id: string) => void;
  onToggleLock?: (id: string) => void;
}) {
  const isSelected = selectedIds.includes(element.id);
  const isLocked = lockedIds.has(element.id);

  return (
    <>
      <li
        data-layer-id={element.id}
        style={{
          ...(isSelected ? selectedItemStyle : itemStyle),
          paddingLeft: `${8 + depth * 16}px`,
        }}
        onClick={(e) => onSelectElement?.(element.id, e.shiftKey)}
        onDoubleClick={() => onDoubleClickElement?.(element.id)}
      >
        <TypeIcon type={element.type} />
        <span style={labelStyle}>{getElementLabel(element)}</span>
        <button
          type="button"
          style={{
            ...lockBtnStyle,
            color: isLocked ? '#f59e0b' : '#555',
          }}
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock?.(element.id);
          }}
          title={isLocked ? 'Unlock' : 'Lock'}
          aria-label={isLocked ? 'Unlock' : 'Lock'}
        >
          {isLocked ? <Lock size={14} weight="fill" /> : <LockOpen size={14} />}
        </button>
      </li>
      {element.type === 'container' &&
        (element as IRContainer).children.map((child) => (
          <LayerItem
            key={child.id}
            element={child}
            depth={depth + 1}
            selectedIds={selectedIds}
            lockedIds={lockedIds}
            onSelectElement={onSelectElement}
            onDoubleClickElement={onDoubleClickElement}
            onToggleLock={onToggleLock}
          />
        ))}
    </>
  );
}

export const LayersTab: React.FC<LayersTabProps> = ({
  elements,
  selectedIds,
  lockedIds = new Set(),
  onSelectElement,
  onDoubleClickElement,
  onToggleLock,
}) => {
  if (elements.length === 0) {
    return <div style={emptyStyle}>No elements</div>;
  }

  // scene-slot layouts are ordered by visual position (top→bottom in DSL),
  // so preserve original order. Diagram mode: reverse to show highest z-order first.
  const hasSlotLayout = elements.some((el) => el.origin?.sourceType === 'scene-slot');
  const displayElements = hasSlotLayout ? elements : [...elements].reverse();

  return (
    <ul style={listStyle} data-tab="layers">
      {displayElements.map((el) => (
        <LayerItem
          key={el.id}
          element={el}
          depth={0}
          selectedIds={selectedIds}
          lockedIds={lockedIds}
          onSelectElement={onSelectElement}
          onDoubleClickElement={onDoubleClickElement}
          onToggleLock={onToggleLock}
        />
      ))}
    </ul>
  );
};
