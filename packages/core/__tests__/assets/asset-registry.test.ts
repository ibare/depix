/**
 * AssetRegistry Tests
 *
 * Tests the asset registry for CRUD operations, search, and
 * integration with built-in assets.
 */

import { describe, it, expect } from 'vitest';
import { createAssetRegistry } from '../../src/assets/asset-registry.js';
import { BUILTIN_ASSETS } from '../../src/assets/builtin-assets.js';
import type { AssetDefinition } from '../../src/assets/asset-types.js';

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

// ===========================================================================
// Tests
// ===========================================================================

describe('AssetRegistry', () => {
  // ---- Construction -------------------------------------------------------

  describe('construction', () => {
    it('creates an empty registry when no initial assets are provided', () => {
      const registry = createAssetRegistry();

      expect(registry.getAll()).toEqual([]);
    });

    it('creates a registry pre-populated with initial assets', () => {
      const assets = [makeAsset({ id: 'a' }), makeAsset({ id: 'b' })];
      const registry = createAssetRegistry(assets);

      expect(registry.getAll()).toHaveLength(2);
    });
  });

  // ---- getAll -------------------------------------------------------------

  describe('getAll', () => {
    it('returns a copy of the internal array (mutations do not leak)', () => {
      const registry = createAssetRegistry([makeAsset()]);
      const all = registry.getAll();

      all.push(makeAsset({ id: 'mutated' }));

      expect(registry.getAll()).toHaveLength(1);
    });
  });

  // ---- getByCategory ------------------------------------------------------

  describe('getByCategory', () => {
    it('returns only assets in the requested category', () => {
      const registry = createAssetRegistry([
        makeAsset({ id: 's1', category: 'shapes' }),
        makeAsset({ id: 'i1', category: 'icons' }),
        makeAsset({ id: 's2', category: 'shapes' }),
      ]);

      const shapes = registry.getByCategory('shapes');

      expect(shapes).toHaveLength(2);
      expect(shapes.every((a) => a.category === 'shapes')).toBe(true);
    });

    it('returns an empty array for a category with no assets', () => {
      const registry = createAssetRegistry([makeAsset({ category: 'shapes' })]);

      expect(registry.getByCategory('decorations')).toEqual([]);
    });
  });

  // ---- getById ------------------------------------------------------------

  describe('getById', () => {
    it('returns the asset with the matching id', () => {
      const asset = makeAsset({ id: 'unique-1', name: 'Unique' });
      const registry = createAssetRegistry([asset]);

      expect(registry.getById('unique-1')).toEqual(asset);
    });

    it('returns undefined for an unknown id', () => {
      const registry = createAssetRegistry([makeAsset()]);

      expect(registry.getById('nonexistent')).toBeUndefined();
    });
  });

  // ---- register -----------------------------------------------------------

  describe('register', () => {
    it('adds a new asset to the registry', () => {
      const registry = createAssetRegistry();
      const asset = makeAsset({ id: 'new-1' });

      registry.register(asset);

      expect(registry.getAll()).toHaveLength(1);
      expect(registry.getById('new-1')).toEqual(asset);
    });

    it('replaces an existing asset with the same id', () => {
      const registry = createAssetRegistry([makeAsset({ id: 'dup', name: 'Old' })]);

      registry.register(makeAsset({ id: 'dup', name: 'New' }));

      expect(registry.getAll()).toHaveLength(1);
      expect(registry.getById('dup')!.name).toBe('New');
    });

    it('preserves insertion order for new assets', () => {
      const registry = createAssetRegistry();

      registry.register(makeAsset({ id: 'a', name: 'A' }));
      registry.register(makeAsset({ id: 'b', name: 'B' }));
      registry.register(makeAsset({ id: 'c', name: 'C' }));

      const names = registry.getAll().map((a) => a.name);
      expect(names).toEqual(['A', 'B', 'C']);
    });
  });

  // ---- search -------------------------------------------------------------

  describe('search', () => {
    it('returns all assets when the query is empty', () => {
      const registry = createAssetRegistry([makeAsset({ id: 'a' }), makeAsset({ id: 'b' })]);

      expect(registry.search('')).toHaveLength(2);
    });

    it('matches by asset name (case-insensitive)', () => {
      const registry = createAssetRegistry([
        makeAsset({ id: '1', name: 'Rectangle' }),
        makeAsset({ id: '2', name: 'Circle' }),
      ]);

      const results = registry.search('rectangle');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Rectangle');
    });

    it('matches by tag (case-insensitive)', () => {
      const registry = createAssetRegistry([
        makeAsset({ id: '1', name: 'Star', tags: ['star', 'favorite'] }),
        makeAsset({ id: '2', name: 'Circle', tags: ['round'] }),
      ]);

      const results = registry.search('FAVORITE');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('1');
    });

    it('matches partial strings in name', () => {
      const registry = createAssetRegistry([
        makeAsset({ id: '1', name: 'Arrow Right' }),
        makeAsset({ id: '2', name: 'Arrow Left' }),
        makeAsset({ id: '3', name: 'Circle' }),
      ]);

      const results = registry.search('Arrow');

      expect(results).toHaveLength(2);
    });

    it('matches partial strings in tags', () => {
      const registry = createAssetRegistry([
        makeAsset({ id: '1', name: 'Diamond', tags: ['decision', 'rhombus'] }),
        makeAsset({ id: '2', name: 'Circle', tags: ['round'] }),
      ]);

      const results = registry.search('dec');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('1');
    });

    it('returns empty array when nothing matches', () => {
      const registry = createAssetRegistry([makeAsset()]);

      expect(registry.search('nonexistent-query-xyz')).toEqual([]);
    });

    it('trims whitespace from the query', () => {
      const registry = createAssetRegistry([makeAsset({ id: '1', name: 'Star' })]);

      expect(registry.search('  Star  ')).toHaveLength(1);
    });
  });

  // ---- Built-in assets integration ----------------------------------------

  describe('built-in assets', () => {
    it('loads all built-in assets', () => {
      const registry = createAssetRegistry(BUILTIN_ASSETS);

      expect(registry.getAll()).toHaveLength(BUILTIN_ASSETS.length);
    });

    it('has at least 15 built-in assets', () => {
      expect(BUILTIN_ASSETS.length).toBeGreaterThanOrEqual(15);
    });

    it('can look up built-in assets by id', () => {
      const registry = createAssetRegistry(BUILTIN_ASSETS);

      expect(registry.getById('shape-rect')).toBeDefined();
      expect(registry.getById('arrow-right')).toBeDefined();
      expect(registry.getById('icon-check')).toBeDefined();
    });

    it('can filter built-in assets by category', () => {
      const registry = createAssetRegistry(BUILTIN_ASSETS);
      const shapes = registry.getByCategory('shapes');
      const arrows = registry.getByCategory('arrows');
      const icons = registry.getByCategory('icons');

      expect(shapes.length).toBeGreaterThan(0);
      expect(arrows.length).toBeGreaterThan(0);
      expect(icons.length).toBeGreaterThan(0);
    });

    it('can search built-in assets', () => {
      const registry = createAssetRegistry(BUILTIN_ASSETS);

      const results = registry.search('arrow');

      expect(results.length).toBeGreaterThanOrEqual(4);
    });
  });
});
