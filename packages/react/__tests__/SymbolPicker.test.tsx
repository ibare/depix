/**
 * SymbolPicker Tests
 *
 * Tests the symbol picker component for rendering, search filtering,
 * category selection, asset click callbacks, and empty state display.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { SymbolPicker } from '../src/components/SymbolPicker.js';
import type { SymbolPickerProps } from '../src/components/SymbolPicker.js';
import { createAssetRegistry, BUILTIN_ASSETS } from '@depix/core';
import type { AssetRegistry, AssetDefinition } from '@depix/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAsset(overrides: Partial<AssetDefinition> = {}): AssetDefinition {
  return {
    id: 'test-asset',
    name: 'Test Asset',
    category: 'shapes',
    type: 'shape',
    shapeType: 'rect',
    tags: ['test'],
    ...overrides,
  };
}

function createTestRegistry(assets?: AssetDefinition[]): AssetRegistry {
  return createAssetRegistry(
    assets ?? [
      makeAsset({ id: 'shape-rect', name: 'Rectangle', category: 'shapes', tags: ['rectangle', 'box'] }),
      makeAsset({ id: 'shape-circle', name: 'Circle', category: 'shapes', tags: ['circle', 'round'] }),
      makeAsset({ id: 'arrow-right', name: 'Arrow Right', category: 'arrows', tags: ['arrow', 'right'] }),
      makeAsset({ id: 'icon-check', name: 'Check', category: 'icons', tags: ['check', 'done'] }),
    ],
  );
}

function renderPicker(overrides: Partial<SymbolPickerProps> = {}) {
  const defaultProps: SymbolPickerProps = {
    registry: createTestRegistry(),
    onSelect: vi.fn(),
    ...overrides,
  };
  return {
    ...render(<SymbolPicker {...defaultProps} />),
    props: defaultProps,
  };
}

function getSearchInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[aria-label="Search symbols"]');
  if (!input) throw new Error('Search input not found');
  return input as HTMLInputElement;
}

function getAssetButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button[data-asset-id]'));
}

function getCategoryTab(container: HTMLElement, category: string): HTMLButtonElement {
  const tab = container.querySelector(`button[data-category="${category}"]`);
  if (!tab) throw new Error(`Category tab "${category}" not found`);
  return tab as HTMLButtonElement;
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

// ===========================================================================
// Tests
// ===========================================================================

describe('SymbolPicker', () => {
  // ---- Rendering ----------------------------------------------------------

  describe('rendering', () => {
    it('renders the symbol picker container', () => {
      const { container } = renderPicker();
      const picker = container.querySelector('[data-testid="symbol-picker"]');

      expect(picker).not.toBeNull();
    });

    it('renders a search input', () => {
      const { container } = renderPicker();
      const input = getSearchInput(container);

      expect(input).not.toBeNull();
      expect(input.placeholder).toBe('Search symbols...');
    });

    it('renders category tabs', () => {
      const { container } = renderPicker();
      const tablist = container.querySelector('[role="tablist"]');

      expect(tablist).not.toBeNull();

      const tabs = tablist!.querySelectorAll('[role="tab"]');
      expect(tabs.length).toBe(6); // all + 5 categories
    });

    it('renders all category tab labels', () => {
      const { container } = renderPicker();
      const labels = ['All', 'Shapes', 'Icons', 'Arrows', 'Connectors', 'Decorations'];

      for (const label of labels) {
        const tab = Array.from(container.querySelectorAll('[role="tab"]')).find(
          (el) => el.textContent === label,
        );
        expect(tab).toBeDefined();
      }
    });

    it('renders asset buttons in a grid', () => {
      const { container } = renderPicker();
      const grid = container.querySelector('[role="grid"]');

      expect(grid).not.toBeNull();

      const buttons = getAssetButtons(container);
      expect(buttons.length).toBe(4); // 4 test assets
    });

    it('renders asset names on buttons', () => {
      const { container } = renderPicker();
      const buttons = getAssetButtons(container);
      const names = buttons.map((b) => b.textContent);

      expect(names).toContain('Rectangle');
      expect(names).toContain('Circle');
    });
  });

  // ---- Search filtering ---------------------------------------------------

  describe('search filtering', () => {
    it('filters assets by search query matching name', () => {
      const { container } = renderPicker();
      const input = getSearchInput(container);

      fireEvent.change(input, { target: { value: 'Rectangle' } });

      const buttons = getAssetButtons(container);
      expect(buttons).toHaveLength(1);
      expect(buttons[0].textContent).toBe('Rectangle');
    });

    it('filters assets by search query matching tag', () => {
      const { container } = renderPicker();
      const input = getSearchInput(container);

      fireEvent.change(input, { target: { value: 'done' } });

      const buttons = getAssetButtons(container);
      expect(buttons).toHaveLength(1);
      expect(buttons[0].getAttribute('data-asset-id')).toBe('icon-check');
    });

    it('search is case-insensitive', () => {
      const { container } = renderPicker();
      const input = getSearchInput(container);

      fireEvent.change(input, { target: { value: 'CIRCLE' } });

      const buttons = getAssetButtons(container);
      expect(buttons).toHaveLength(1);
      expect(buttons[0].textContent).toBe('Circle');
    });

    it('shows empty state when no assets match search', () => {
      const { container } = renderPicker();
      const input = getSearchInput(container);

      fireEvent.change(input, { target: { value: 'nonexistent-xyz' } });

      const emptyState = container.querySelector('[data-testid="empty-state"]');
      expect(emptyState).not.toBeNull();
      expect(emptyState!.textContent).toBe('No symbols found');
    });

    it('shows all assets when search is cleared', () => {
      const { container } = renderPicker();
      const input = getSearchInput(container);

      fireEvent.change(input, { target: { value: 'Rectangle' } });
      expect(getAssetButtons(container)).toHaveLength(1);

      fireEvent.change(input, { target: { value: '' } });
      expect(getAssetButtons(container)).toHaveLength(4);
    });
  });

  // ---- Category selection -------------------------------------------------

  describe('category selection', () => {
    it('defaults to "all" category (shows all assets)', () => {
      const { container } = renderPicker();
      const allTab = getCategoryTab(container, 'all');

      expect(allTab.getAttribute('aria-selected')).toBe('true');
      expect(getAssetButtons(container)).toHaveLength(4);
    });

    it('filters by shapes category', () => {
      const { container } = renderPicker();

      fireEvent.click(getCategoryTab(container, 'shapes'));

      const buttons = getAssetButtons(container);
      expect(buttons).toHaveLength(2); // rect + circle
    });

    it('filters by arrows category', () => {
      const { container } = renderPicker();

      fireEvent.click(getCategoryTab(container, 'arrows'));

      const buttons = getAssetButtons(container);
      expect(buttons).toHaveLength(1); // arrow-right
    });

    it('marks selected tab as aria-selected', () => {
      const { container } = renderPicker();

      fireEvent.click(getCategoryTab(container, 'icons'));

      const iconsTab = getCategoryTab(container, 'icons');
      expect(iconsTab.getAttribute('aria-selected')).toBe('true');

      const allTab = getCategoryTab(container, 'all');
      expect(allTab.getAttribute('aria-selected')).toBe('false');
    });

    it('shows empty state for category with no assets', () => {
      const { container } = renderPicker();

      fireEvent.click(getCategoryTab(container, 'decorations'));

      const emptyState = container.querySelector('[data-testid="empty-state"]');
      expect(emptyState).not.toBeNull();
    });

    it('combines search and category filters', () => {
      const { container } = renderPicker();
      const input = getSearchInput(container);

      // Search for "rect" (matches only Rectangle by name/tag)
      fireEvent.change(input, { target: { value: 'rect' } });
      // Then filter by shapes — should still show Rectangle
      fireEvent.click(getCategoryTab(container, 'shapes'));

      const buttons = getAssetButtons(container);
      expect(buttons).toHaveLength(1);
      expect(buttons[0].textContent).toBe('Rectangle');
    });
  });

  // ---- Asset click callback -----------------------------------------------

  describe('asset selection', () => {
    it('calls onSelect when an asset button is clicked', () => {
      const onSelect = vi.fn();
      const { container } = renderPicker({ onSelect });

      const buttons = getAssetButtons(container);
      fireEvent.click(buttons[0]);

      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('passes the correct asset definition to onSelect', () => {
      const onSelect = vi.fn();
      const { container } = renderPicker({ onSelect });

      const rectButton = container.querySelector('button[data-asset-id="shape-rect"]')!;
      fireEvent.click(rectButton);

      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'shape-rect', name: 'Rectangle' }),
      );
    });
  });

  // ---- className / style --------------------------------------------------

  describe('className and style', () => {
    it('passes className to the container', () => {
      const { container } = renderPicker({ className: 'my-picker' });
      const picker = container.querySelector('[data-testid="symbol-picker"]') as HTMLElement;

      expect(picker.className).toBe('my-picker');
    });

    it('passes style to the container', () => {
      const { container } = renderPicker({ style: { width: '300px' } });
      const picker = container.querySelector('[data-testid="symbol-picker"]') as HTMLElement;

      expect(picker.style.width).toBe('300px');
    });
  });

  // ---- Built-in assets integration ----------------------------------------

  describe('built-in assets integration', () => {
    it('renders all built-in assets', () => {
      const registry = createAssetRegistry(BUILTIN_ASSETS);
      const { container } = renderPicker({ registry });

      const buttons = getAssetButtons(container);
      expect(buttons.length).toBe(BUILTIN_ASSETS.length);
    });
  });
});
