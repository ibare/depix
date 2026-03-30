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

// Global cache: pack URL → already-fetched & preloaded definitions.
// Prevents redundant network requests while allowing each ShapeRegistry
// instance to receive its own registrations.
const packDataCache = new Map<string, Map<string, ShapeDefinition>>();

/**
 * Fetch the minimum set of packs required to render `neededKeys`,
 * register all shapes, then pre-load their SVG images into HTMLImageElements.
 *
 * Pack fetch results are cached globally so the network request happens at
 * most once per URL. However, shapes are registered into the provided
 * `registry` instance every time — this ensures that each DepixEngine
 * receives the definitions it needs even when multiple engines exist on
 * the same page.
 */
export async function resolveShapes(
  neededKeys: string[],
  index: RegistryIndex,
  registry: ShapeRegistry,
): Promise<void> {
  if (neededKeys.length === 0) return;

  const needed = new Set(neededKeys);

  // Find packs that contain at least one needed key missing from THIS registry
  const packsToProcess = index.packs.filter(
    (pack) => pack.keys.some((k) => needed.has(k) && !registry.has(k)),
  );

  if (packsToProcess.length === 0) return;

  await Promise.all(
    packsToProcess.map(async (pack) => {
      try {
        // Use cached pack data if available; otherwise fetch & cache
        let defs = packDataCache.get(pack.url);
        if (!defs) {
          const res = await fetch(pack.url);
          if (!res.ok) return;
          const data = await res.json() as PackData;

          defs = new Map<string, ShapeDefinition>();
          for (const [key, value] of Object.entries(data)) {
            const svg = typeof value === 'string' ? value : value.svg;
            defs.set(key, { svg });
          }

          // Pre-load all SVG images so the renderer can work synchronously
          await Promise.all(
            [...defs.values()].map(async (def) => {
              def.image = await preloadSvgImage(def.svg);
            }),
          );

          packDataCache.set(pack.url, defs);
        }

        // Register into THIS engine's registry
        for (const [key, def] of defs) {
          registry.register(key, def);
        }
      } catch {
        // Network failure: skip silently, fallback rendering will be used
      }
    }),
  );
}
