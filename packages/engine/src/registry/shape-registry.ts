/**
 * ShapeRegistry — runtime storage for external icon/shape definitions.
 *
 * Icons are registered by key (e.g. "server") at startup after fetching
 * the pack data. The renderer looks up the registry at render time:
 * - Match found  → render SVG path
 * - No match     → render fallback (outline rect + icon name text)
 */

/** A single icon definition loaded from a pack. */
export interface IconDefinition {
  /** SVG path data (the `d` attribute of a `<path>` element). */
  svgPath: string;
  /** ViewBox string, e.g. "0 0 24 24". */
  viewBox: string;
}

/** Runtime registry of icon definitions keyed by semantic name. */
export class ShapeRegistry {
  private readonly icons = new Map<string, IconDefinition>();

  /** Register an icon definition under the given key. */
  register(key: string, def: IconDefinition): void {
    this.icons.set(key, def);
  }

  /** Look up an icon by key. Returns undefined if not registered. */
  get(key: string): IconDefinition | undefined {
    return this.icons.get(key);
  }

  /** Returns true if the key has a registered definition. */
  has(key: string): boolean {
    return this.icons.has(key);
  }

  /** Returns all registered keys. */
  keys(): string[] {
    return [...this.icons.keys()];
  }

  /** Number of registered icons. */
  get size(): number {
    return this.icons.size;
  }
}
