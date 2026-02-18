/**
 * DepixEngine
 *
 * Main entry point for rendering DepixIR to a Konva Stage.
 * All layout computation is already done in the IR; the engine
 * simply creates Konva nodes and manages the stage lifecycle.
 */

import Konva from 'konva';
import type { DepixIR, IRScene, IRBackground } from '@depix/core';
import { CoordinateTransform } from './coordinate-transform.js';
import { renderElements } from './ir-renderer.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Compute fitted dimensions that preserve the given aspect ratio
 * within the available width/height (contain strategy).
 */
export function fitToAspectRatio(
  availW: number,
  availH: number,
  aspectRatio: { width: number; height: number },
): { width: number; height: number } {
  const canvasAR = aspectRatio.width / aspectRatio.height;
  const viewAR = availW / availH;

  if (viewAR > canvasAR) {
    // Height-constrained: use full height, narrow width
    return { width: Math.round(availH * canvasAR), height: availH };
  } else {
    // Width-constrained: use full width, shorter height
    return { width: availW, height: Math.round(availW / canvasAR) };
  }
}

export interface DepixEngineOptions {
  /** DOM container element or CSS selector. */
  container: string | HTMLDivElement;
  /** Initial width in pixels. */
  width?: number;
  /** Initial height in pixels. */
  height?: number;
}

// ---------------------------------------------------------------------------
// DepixEngine
// ---------------------------------------------------------------------------

export class DepixEngine {
  private stage: Konva.Stage;
  private backgroundLayer: Konva.Layer;
  private contentLayer: Konva.Layer;
  private ir: DepixIR | null = null;
  private currentSceneIndex = 0;
  private transform: CoordinateTransform;
  private availableSize: { width: number; height: number } | null = null;

  constructor(options: DepixEngineOptions) {
    const container =
      typeof options.container === 'string'
        ? options.container
        : options.container.id || 'depix-container';

    const width = options.width ?? 800;
    const height = options.height ?? 450;

    this.stage = new Konva.Stage({
      container,
      width,
      height,
    });

    this.backgroundLayer = new Konva.Layer();
    this.contentLayer = new Konva.Layer();
    this.stage.add(this.backgroundLayer);
    this.stage.add(this.contentLayer);

    this.transform = new CoordinateTransform(
      { width, height },
      { width: 16, height: 9 },
    );
  }

  // ---- Loading --------------------------------------------------------------

  /** Load a pre-compiled DepixIR document. */
  load(ir: DepixIR): void {
    this.ir = ir;
    this.currentSceneIndex = 0;

    // Fit stage to IR's aspect ratio within the current available space
    const avail = this.availableSize ?? this.stage.size();
    const fitted = fitToAspectRatio(avail.width, avail.height, ir.meta.aspectRatio);
    this.stage.width(fitted.width);
    this.stage.height(fitted.height);

    this.transform = new CoordinateTransform(
      { width: fitted.width, height: fitted.height },
      ir.meta.aspectRatio,
    );

    this.renderCurrentScene();
  }

  /**
   * Update the IR in-place without resetting the scene index.
   * Use this for editable canvases where the user modifies the IR
   * and the current scene should be preserved.
   */
  update(ir: DepixIR): void {
    this.ir = ir;

    // Clamp scene index if scenes were removed
    if (this.currentSceneIndex >= ir.scenes.length) {
      this.currentSceneIndex = Math.max(0, ir.scenes.length - 1);
    }

    // Recompute fitted size (aspect ratio may have changed)
    const avail = this.availableSize ?? this.stage.size();
    const fitted = fitToAspectRatio(avail.width, avail.height, ir.meta.aspectRatio);
    this.stage.width(fitted.width);
    this.stage.height(fitted.height);

    this.transform = new CoordinateTransform(
      { width: fitted.width, height: fitted.height },
      ir.meta.aspectRatio,
    );

    this.renderCurrentScene();
  }

  // ---- Scene management -----------------------------------------------------

  /** Get the current scene index. */
  get sceneIndex(): number {
    return this.currentSceneIndex;
  }

  /** Get the total number of scenes. */
  get sceneCount(): number {
    return this.ir?.scenes.length ?? 0;
  }

  /** Navigate to the next scene. */
  nextScene(): void {
    if (!this.ir) return;
    if (this.currentSceneIndex < this.ir.scenes.length - 1) {
      this.currentSceneIndex++;
      this.renderCurrentScene();
    }
  }

  /** Navigate to the previous scene. */
  prevScene(): void {
    if (!this.ir) return;
    if (this.currentSceneIndex > 0) {
      this.currentSceneIndex--;
      this.renderCurrentScene();
    }
  }

  /** Navigate to a specific scene by index. */
  setScene(index: number): void {
    if (!this.ir) return;
    if (index >= 0 && index < this.ir.scenes.length) {
      this.currentSceneIndex = index;
      this.renderCurrentScene();
    }
  }

  // ---- Resize ---------------------------------------------------------------

  /**
   * Update with new available space.
   * The engine fits the stage to the IR's aspect ratio within this space.
   */
  resize(availableWidth: number, availableHeight: number): void {
    this.availableSize = { width: availableWidth, height: availableHeight };

    if (this.ir) {
      const fitted = fitToAspectRatio(availableWidth, availableHeight, this.ir.meta.aspectRatio);
      this.stage.width(fitted.width);
      this.stage.height(fitted.height);

      this.transform = new CoordinateTransform(
        { width: fitted.width, height: fitted.height },
        this.ir.meta.aspectRatio,
      );
      this.renderCurrentScene();
    } else {
      this.stage.width(availableWidth);
      this.stage.height(availableHeight);
    }
  }

  // ---- Access ---------------------------------------------------------------

  /** Get the underlying Konva Stage (for advanced usage). */
  getStage(): Konva.Stage {
    return this.stage;
  }

  /** Get the current coordinate transform. */
  getTransform(): CoordinateTransform {
    return this.transform;
  }

  /** Destroy the engine and its Konva stage. */
  destroy(): void {
    this.stage.destroy();
  }

  // ---- Private rendering ----------------------------------------------------

  private renderCurrentScene(): void {
    if (!this.ir) return;

    const scene = this.ir.scenes[this.currentSceneIndex];
    if (!scene) return;

    this.renderBackground(scene);
    this.renderContent(scene);
  }

  private renderBackground(scene: IRScene): void {
    this.backgroundLayer.destroyChildren();

    const bg = scene.background ?? this.ir?.meta.background;
    if (!bg) return;

    const { width, height } = this.stage.size();

    if (bg.type === 'solid' && bg.color) {
      this.backgroundLayer.add(
        new Konva.Rect({
          x: 0,
          y: 0,
          width,
          height,
          fill: bg.color,
        }),
      );
    }

    this.backgroundLayer.batchDraw();
  }

  private renderContent(scene: IRScene): void {
    this.contentLayer.destroyChildren();

    const group = renderElements(scene.elements, this.transform);
    this.contentLayer.add(group);
    this.contentLayer.batchDraw();
  }
}
