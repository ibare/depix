/**
 * PluginLoader — fetches and registers shape packs from the shape registry.
 *
 * Flow:
 * 1. `loadRegistryIndex(url)` fetches the lightweight index (keys only, no SVG data)
 * 2. `collectShapeIds(ir)` scans an IR document for all IRShapeAsset elements
 * 3. `resolveShapes(neededKeys, index, registry)` fetches only the packs that
 *    contain needed keys, registers them, and pre-loads their SVG images
 *
 * The compiler never calls any of these — they run in the React/engine layer
 * to keep the compiler pure (P3).
 */

import type { DepixIR, IRElement } from '@depix/core';
import type { ShapeRegistry, ShapeDefinition } from './shape-registry.js';

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

// Pack data format (packs/xxx.json): key → full SVG string or ShapeDefinition object
type PackData = Record<string, string | { svg: string }>;

// ---------------------------------------------------------------------------
// IR scanner
// ---------------------------------------------------------------------------

/**
 * Walk all elements in an IR document and collect every `IRShapeAsset.shapeId`.
 * Used to determine which packs need to be fetched before rendering.
 */
export function collectShapeIds(ir: DepixIR): string[] {
  const ids = new Set<string>();
  for (const scene of ir.scenes) {
    walkElements(scene.elements, ids);
  }
  return [...ids];
}

function walkElements(elements: IRElement[], ids: Set<string>): void {
  for (const el of elements) {
    if (el.type === 'shape-asset') {
      if (el.shapeId) ids.add(el.shapeId);
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
// SVG image preloader
// ---------------------------------------------------------------------------

/**
 * Convert a full SVG string to an HTMLImageElement via a data URL.
 * Returns undefined in non-browser environments (Node.js, SSR).
 * Silently resolves on error so a missing image falls back to the outline box.
 */
function preloadSvgImage(svg: string): Promise<HTMLImageElement | undefined> {
  if (typeof window === 'undefined' || typeof window.Image === 'undefined') {
    return Promise.resolve(undefined);
  }
  return new Promise((resolve) => {
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(undefined);
    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// Shape resolver
// ---------------------------------------------------------------------------

const loadedPackUrls = new Set<string>();

/**
 * Fetch the minimum set of packs required to render `neededKeys`,
 * register all shapes, then pre-load their SVG images into HTMLImageElements.
 *
 * Only packs not already loaded are fetched (idempotent).
 * Resolves only after all image preloads complete so the caller can
 * trigger a re-render with fully loaded shapes.
 */
export async function resolveShapes(
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
        if (!res.ok) return;
        const data = await res.json() as PackData;

        // Register icons and collect definitions that need image preloading
        const defsToPreload: ShapeDefinition[] = [];
        for (const [key, value] of Object.entries(data)) {
          // Support both plain SVG string and { svg: string } object
          const svg = typeof value === 'string' ? value : value.svg;
          const def: ShapeDefinition = { svg };
          registry.register(key, def);
          defsToPreload.push(def);
        }

        loadedPackUrls.add(pack.url);

        // Pre-load all SVG images so the renderer can work synchronously
        await Promise.all(
          defsToPreload.map(async (def) => {
            def.image = await preloadSvgImage(def.svg);
          }),
        );
      } catch {
        // Network failure: skip silently, fallback rendering will be used
      }
    }),
  );
}
