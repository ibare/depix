/**
 * PluginLoader — fetches and registers icon packs from the shape registry.
 *
 * Flow:
 * 1. `loadRegistryIndex(url)` fetches the lightweight index (keys only, no SVG data)
 * 2. `collectIconIds(ir)` scans an IR document for all IRIcon elements
 * 3. `resolveIcons(neededKeys, index, registry)` fetches only the packs that
 *    contain needed keys and registers them in the ShapeRegistry
 *
 * The compiler never calls any of these — they run in the React/engine layer
 * to keep the compiler pure (P3).
 */

import type { DepixIR, IRElement } from '@depix/core';
import type { ShapeRegistry, IconDefinition } from './shape-registry.js';

// ---------------------------------------------------------------------------
// Registry index format (registry.json)
// ---------------------------------------------------------------------------

export interface RegistryPackEntry {
  /** Unique pack identifier. */
  id: string;
  /** All icon keys provided by this pack. */
  keys: string[];
  /** URL to fetch the full pack data (JSON). */
  url: string;
}

export interface RegistryIndex {
  version: string;
  packs: RegistryPackEntry[];
}

// Pack data format (packs/xxx.json)
type PackData = Record<string, IconDefinition>;

// ---------------------------------------------------------------------------
// IR scanner
// ---------------------------------------------------------------------------

/**
 * Walk all elements in an IR document and collect every `IRIcon.iconId`.
 * Used to determine which packs need to be fetched before rendering.
 */
export function collectIconIds(ir: DepixIR): string[] {
  const ids = new Set<string>();
  for (const scene of ir.scenes) {
    walkElements(scene.elements, ids);
  }
  return [...ids];
}

function walkElements(elements: IRElement[], ids: Set<string>): void {
  for (const el of elements) {
    if (el.type === 'icon') {
      if (el.iconId) ids.add(el.iconId);
    } else if (el.type === 'container') {
      walkElements(el.children, ids);
    }
  }
}

// ---------------------------------------------------------------------------
// Registry index loader
// ---------------------------------------------------------------------------

let cachedIndex: RegistryIndex | null = null;
let cachedIndexUrl = '';

/**
 * Fetch the registry index JSON (keys only, lightweight).
 * Result is cached for the lifetime of the page.
 */
export async function loadRegistryIndex(url: string): Promise<RegistryIndex> {
  if (cachedIndex && cachedIndexUrl === url) return cachedIndex;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch registry index: ${res.status}`);
  const data = await res.json() as RegistryIndex;
  cachedIndex = data;
  cachedIndexUrl = url;
  return data;
}

// ---------------------------------------------------------------------------
// Icon resolver
// ---------------------------------------------------------------------------

const loadedPackUrls = new Set<string>();

/**
 * Fetch the minimum set of packs required to render `neededKeys`,
 * then register all icons from those packs into `registry`.
 *
 * Only packs not already loaded are fetched (idempotent).
 */
export async function resolveIcons(
  neededKeys: string[],
  index: RegistryIndex,
  registry: ShapeRegistry,
): Promise<void> {
  if (neededKeys.length === 0) return;

  const needed = new Set(neededKeys);

  // Find packs that contain at least one needed key and haven't been loaded yet
  const packsToLoad = index.packs.filter(
    (pack) => !loadedPackUrls.has(pack.url) && pack.keys.some((k) => needed.has(k)),
  );

  if (packsToLoad.length === 0) return;

  await Promise.all(
    packsToLoad.map(async (pack) => {
      try {
        const res = await fetch(pack.url);
        if (!res.ok) return; // silently skip unavailable packs
        const data = await res.json() as PackData;
        for (const [key, def] of Object.entries(data)) {
          registry.register(key, def);
        }
        loadedPackUrls.add(pack.url);
      } catch {
        // Network failure: skip silently, fallback rendering will be used
      }
    }),
  );
}
