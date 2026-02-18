/**
 * AssetRegistry implementation.
 *
 * Stores AssetDefinition instances and provides lookup helpers
 * (by id, by category, full-text search across name & tags).
 */

import type { AssetCategory, AssetDefinition, AssetRegistry } from './asset-types.js';

/**
 * Create a new AssetRegistry, optionally pre-populated with `initial` assets.
 */
export function createAssetRegistry(initial?: AssetDefinition[]): AssetRegistry {
  const assets: AssetDefinition[] = [];
  const byId = new Map<string, AssetDefinition>();

  function register(asset: AssetDefinition): void {
    if (byId.has(asset.id)) {
      // Replace existing asset with same id
      const idx = assets.findIndex((a) => a.id === asset.id);
      if (idx !== -1) {
        assets[idx] = asset;
      }
    } else {
      assets.push(asset);
    }
    byId.set(asset.id, asset);
  }

  // Seed with initial assets
  if (initial) {
    for (const a of initial) {
      register(a);
    }
  }

  return {
    getAll(): AssetDefinition[] {
      return [...assets];
    },

    getByCategory(category: AssetCategory): AssetDefinition[] {
      return assets.filter((a) => a.category === category);
    },

    search(query: string): AssetDefinition[] {
      const q = query.toLowerCase().trim();
      if (q === '') return [...assets];
      return assets.filter((a) => {
        if (a.name.toLowerCase().includes(q)) return true;
        return a.tags.some((tag) => tag.toLowerCase().includes(q));
      });
    },

    getById(id: string): AssetDefinition | undefined {
      return byId.get(id);
    },

    register,
  };
}
