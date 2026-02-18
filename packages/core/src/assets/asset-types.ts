/**
 * Asset type definitions for SymbolPicker and AssetRegistry.
 *
 * Assets represent reusable shapes, icons, arrows, connectors, and
 * decorations that can be placed onto the Depix canvas.
 */

// ---------------------------------------------------------------------------
// Category
// ---------------------------------------------------------------------------

export type AssetCategory = 'shapes' | 'icons' | 'arrows' | 'connectors' | 'decorations';

// ---------------------------------------------------------------------------
// Asset definition
// ---------------------------------------------------------------------------

export interface AssetDefinition {
  /** Unique identifier for the asset. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Category this asset belongs to. */
  category: AssetCategory;
  /** Whether this asset is a built-in shape or an SVG path. */
  type: 'shape' | 'path';
  /** For shape type: shape name (rect, circle, etc.) */
  shapeType?: string;
  /** For path type: SVG path data */
  pathData?: string;
  /** Keywords for search. */
  tags: string[];
}

// ---------------------------------------------------------------------------
// Registry interface
// ---------------------------------------------------------------------------

export interface AssetRegistry {
  /** Return all registered assets. */
  getAll(): AssetDefinition[];
  /** Return assets in the given category. */
  getByCategory(category: AssetCategory): AssetDefinition[];
  /** Search assets by name or tags (case-insensitive). */
  search(query: string): AssetDefinition[];
  /** Look up an asset by id. */
  getById(id: string): AssetDefinition | undefined;
  /** Register a new asset. */
  register(asset: AssetDefinition): void;
}
