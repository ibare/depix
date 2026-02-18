import type { IRBounds } from '@depix/core';
import type { SnapResult, SnapGuideConfig, GuideLine } from './types.js';
import { DEFAULT_SNAP_CONFIG } from './types.js';
import { SnapCalculator } from './snap-calculator.js';

/**
 * Manages the snap guide system lifecycle during drag operations.
 *
 * Pure logic layer -- rendering is delegated to an external callback.
 */
export class SnapGuideManager {
  private config: SnapGuideConfig;
  private calculator: SnapCalculator;
  private cachedElements: Array<{ id: string; bounds: IRBounds }>;
  private currentGuides: GuideLine[];
  private guideRenderer: ((guides: GuideLine[]) => void) | null;

  constructor(config?: Partial<SnapGuideConfig>) {
    this.config = { ...DEFAULT_SNAP_CONFIG, ...config };
    this.calculator = new SnapCalculator(this.config.threshold);
    this.cachedElements = [];
    this.currentGuides = [];
    this.guideRenderer = null;
  }

  /** Set enabled state. */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /** Check if snapping is enabled. */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /** Update configuration. */
  updateConfig(config: Partial<SnapGuideConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.threshold !== undefined) {
      this.calculator.setThreshold(config.threshold);
    }
  }

  /** Get current config (returns a copy). */
  getConfig(): SnapGuideConfig {
    return { ...this.config };
  }

  /** Set a callback for rendering guides (called with guide lines array). */
  setGuideRenderer(renderer: ((guides: GuideLine[]) => void) | null): void {
    this.guideRenderer = renderer;
  }

  /**
   * Start a drag operation. Cache all non-dragging element bounds.
   * @param draggingId - The element being dragged
   * @param allElements - All elements with their bounds
   */
  onDragStart(draggingId: string, allElements: Array<{ id: string; bounds: IRBounds }>): void {
    this.cachedElements = allElements.filter((el) => el.id !== draggingId);
    this.currentGuides = [];
  }

  /**
   * Called during drag. Returns snap result with corrected position.
   * @param currentBounds - Current bounds of the dragging element
   * @returns SnapResult with delta to apply
   */
  onDragMove(currentBounds: IRBounds): SnapResult {
    if (!this.config.enabled) {
      const emptyResult: SnapResult = {
        deltaX: 0,
        deltaY: 0,
        guides: [],
      };
      this.currentGuides = [];
      this.guideRenderer?.(this.currentGuides);
      return emptyResult;
    }

    const result = this.calculator.calculateSnap(currentBounds, this.cachedElements);
    this.currentGuides = result.guides;
    this.guideRenderer?.(this.currentGuides);
    return result;
  }

  /** End drag operation. Clear cache and guides. */
  onDragEnd(): void {
    this.cachedElements = [];
    this.currentGuides = [];
    this.guideRenderer?.([]);
  }

  /** Clear all rendered guides. */
  clearGuides(): void {
    this.currentGuides = [];
    this.guideRenderer?.([]);
  }

  /** Get current guide lines. */
  getGuides(): GuideLine[] {
    return [...this.currentGuides];
  }
}
