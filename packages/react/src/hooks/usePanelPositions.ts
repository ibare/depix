/**
 * usePanelPositions
 *
 * A React hook for managing the positions of multiple floating panels.
 * Provides a central store for panel coordinates with methods to update
 * individual panel positions and reset all panels to their defaults.
 *
 * @module @depix/react/hooks/usePanelPositions
 */

import { useState, useCallback, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PanelPosition {
  x: number;
  y: number;
}

export interface UsePanelPositionsOptions {
  /** Array of panel IDs to manage. */
  panels: string[];
  /** Default positions keyed by panel ID. */
  defaults?: Record<string, PanelPosition>;
}

export interface UsePanelPositionsReturn {
  /** Current positions keyed by panel ID. */
  positions: Record<string, PanelPosition>;
  /** Set the position of a specific panel. */
  setPosition: (panelId: string, pos: PanelPosition) => void;
  /** Reset all panels to their default positions. */
  resetPositions: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Default position for panels with no explicit default. */
const FALLBACK_POSITION: PanelPosition = { x: 0, y: 0 };

/**
 * Build the initial positions map from the panel list and defaults.
 */
function buildInitialPositions(
  panels: string[],
  defaults?: Record<string, PanelPosition>,
): Record<string, PanelPosition> {
  const positions: Record<string, PanelPosition> = {};
  for (const id of panels) {
    positions[id] = defaults?.[id]
      ? { ...defaults[id] }
      : { ...FALLBACK_POSITION };
  }
  return positions;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePanelPositions(
  options: UsePanelPositionsOptions,
): UsePanelPositionsReturn {
  const { panels, defaults } = options;

  const initialPositions = useMemo(
    () => buildInitialPositions(panels, defaults),
    // Only compute on first render; changes to panels/defaults after mount
    // are handled by resetPositions if needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [positions, setPositions] = useState<Record<string, PanelPosition>>(
    initialPositions,
  );

  const setPosition = useCallback(
    (panelId: string, pos: PanelPosition) => {
      setPositions(prev => ({
        ...prev,
        [panelId]: { ...pos },
      }));
    },
    [],
  );

  const resetPositions = useCallback(() => {
    setPositions(buildInitialPositions(panels, defaults));
  }, [panels, defaults]);

  return { positions, setPosition, resetPositions };
}
