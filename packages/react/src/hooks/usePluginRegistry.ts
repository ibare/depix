/**
 * usePluginRegistry — loads the shape registry index and resolves icon packs
 * needed to render the current IR document.
 *
 * Flow:
 * 1. On first call: fetch the registry index (key list, no SVG data)
 * 2. Whenever `ir` changes: collect icon IDs → match against index keys
 * 3. Fetch only missing packs → register in engine's ShapeRegistry
 * 4. Trigger a re-render by calling engine.update(ir)
 *
 * Registry index is cached for the page lifetime.
 * Pack fetches are idempotent (already-loaded packs are skipped).
 */

import { useEffect, useRef } from 'react';
import type { DepixIR } from '@depix/core';
import type { DepixEngine } from '@depix/engine';
import { collectIconIds, loadRegistryIndex, resolveIcons } from '@depix/engine';

export const DEFAULT_REGISTRY_URL =
  'https://cdn.jsdelivr.net/gh/ibare/depix-registry@main/registry.json';

export function usePluginRegistry(
  engineRef: React.MutableRefObject<DepixEngine | null>,
  ir: DepixIR | null,
  registryUrl = DEFAULT_REGISTRY_URL,
): void {
  // Keep the latest ir/registryUrl in a ref to avoid stale closures
  const irRef = useRef(ir);
  irRef.current = ir;
  const urlRef = useRef(registryUrl);
  urlRef.current = registryUrl;

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !ir) return;

    const iconIds = collectIconIds(ir);
    if (iconIds.length === 0) return;

    let cancelled = false;

    loadRegistryIndex(urlRef.current)
      .then((index) => {
        if (cancelled) return;
        return resolveIcons(iconIds, index, engine.getRegistry());
      })
      .then(() => {
        if (cancelled) return;
        const currentEngine = engineRef.current;
        const latestIr = irRef.current;
        if (currentEngine && latestIr) currentEngine.update(latestIr);
      })
      .catch(() => {
        // Registry unavailable — fallback rendering is used automatically
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ir, registryUrl]);
}
