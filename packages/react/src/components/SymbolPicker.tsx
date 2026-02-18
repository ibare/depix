/**
 * SymbolPicker
 *
 * A panel that lets users browse and search for assets (shapes, icons,
 * arrows, connectors, decorations) and select one to place on the canvas.
 *
 * Layout:
 *  - Search input at the top
 *  - Category tabs (All + each AssetCategory)
 *  - Asset grid showing matching assets as buttons
 *  - Empty-state message when no results match
 */

import React, { useState, useMemo } from 'react';
import type { AssetCategory, AssetDefinition, AssetRegistry } from '@depix/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SymbolPickerProps {
  /** The asset registry to browse. */
  registry: AssetRegistry;
  /** Called when the user selects an asset. */
  onSelect: (asset: AssetDefinition) => void;
  /** CSS class name. */
  className?: string;
  /** CSS inline style. */
  style?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type TabValue = 'all' | AssetCategory;

interface TabDef {
  value: TabValue;
  label: string;
}

const TABS: TabDef[] = [
  { value: 'all', label: 'All' },
  { value: 'shapes', label: 'Shapes' },
  { value: 'icons', label: 'Icons' },
  { value: 'arrows', label: 'Arrows' },
  { value: 'connectors', label: 'Connectors' },
  { value: 'decorations', label: 'Decorations' },
];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  padding: '8px',
  borderRadius: '8px',
  backgroundColor: '#ffffff',
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  minWidth: '240px',
};

const searchInputStyle: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  fontSize: '13px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: '2px',
  flexWrap: 'wrap',
};

const tabStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'transparent',
  borderRadius: '4px',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  fontSize: '12px',
};

const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  backgroundColor: '#e8f0fe',
  borderColor: '#4A90D9',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
  gap: '4px',
};

const assetButtonStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px 4px',
  border: '1px solid #eee',
  borderRadius: '4px',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  fontSize: '11px',
  lineHeight: '1.2',
  textAlign: 'center',
  wordBreak: 'break-word',
};

const emptyStyle: React.CSSProperties = {
  padding: '16px',
  textAlign: 'center',
  color: '#999',
  fontSize: '13px',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SymbolPicker: React.FC<SymbolPickerProps> = ({
  registry,
  onSelect,
  className,
  style,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabValue>('all');

  const filteredAssets = useMemo(() => {
    // First: apply search
    let results: AssetDefinition[];
    if (searchQuery.trim() === '') {
      results = registry.getAll();
    } else {
      results = registry.search(searchQuery);
    }

    // Then: apply category filter
    if (activeTab !== 'all') {
      results = results.filter((a) => a.category === activeTab);
    }

    return results;
  }, [registry, searchQuery, activeTab]);

  return (
    <div
      data-testid="symbol-picker"
      className={className}
      style={{ ...containerStyle, ...style }}
    >
      {/* Search input */}
      <input
        type="text"
        placeholder="Search symbols..."
        aria-label="Search symbols"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={searchInputStyle}
      />

      {/* Category tabs */}
      <div role="tablist" aria-label="Asset categories" style={tabBarStyle}>
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.value}
            data-category={tab.value}
            style={activeTab === tab.value ? activeTabStyle : tabStyle}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Asset grid or empty state */}
      {filteredAssets.length > 0 ? (
        <div role="grid" aria-label="Assets" style={gridStyle}>
          {filteredAssets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              aria-label={asset.name}
              data-asset-id={asset.id}
              style={assetButtonStyle}
              onClick={() => onSelect(asset)}
            >
              {asset.name}
            </button>
          ))}
        </div>
      ) : (
        <div data-testid="empty-state" style={emptyStyle}>
          No symbols found
        </div>
      )}
    </div>
  );
};
