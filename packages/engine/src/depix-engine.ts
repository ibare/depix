/**
 * DepixEngine
 *
 * Main entry point for rendering DepixIR to a Konva Stage.
 * All layout computation is already done in the IR; the engine
 * simply creates Konva nodes and manages the stage lifecycle.
 */

import Konva from 'konva';
import type { DepixIR, IRScene, IRBackground, IRElement, IRContainer } from '@depix/core';
import type { StageHandle, LayerHandle, TransformerHandle } from './handles.js';
import { CoordinateTransform } from './coordinate-transform.js';
import { renderElements } from './ir-renderer/index.js';

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

// Debug overlay colors by IR element type
const DEBUG_COLORS: Record<string, string> = {
  container: '#3b82f6', // blue
  shape: '#22c55e',     // green
  text: '#f59e0b',      // amber
  line: '#a855f7',      // purple
  edge: '#a855f7',      // purple
  path: '#ef4444',      // red
  image: '#06b6d4',     // cyan
};

export class DepixEngine {
  private stage: Konva.Stage;
  private backgroundLayer: Konva.Layer;
  private contentLayer: Konva.Layer;
  private debugLayer: Konva.Layer;
  private ir: DepixIR | null = null;
  private currentSceneIndex = 0;
  private transform: CoordinateTransform;
  private availableSize: { width: number; height: number } | null = null;
  private _debugMode = false;
  private overlayLayer: Konva.Layer | null = null;
  private editTransformer: Konva.Transformer | null = null;

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
    this.debugLayer = new Konva.Layer({ listening: false });
    this.stage.add(this.backgroundLayer);
    this.stage.add(this.contentLayer);
    this.stage.add(this.debugLayer);

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
      ir.meta.irHeight ?? 100,
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
      ir.meta.irHeight ?? 100,
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
        this.ir.meta.irHeight ?? 100,
      );
      this.renderCurrentScene();
    } else {
      this.stage.width(availableWidth);
      this.stage.height(availableHeight);
    }
  }

  // ---- Access ---------------------------------------------------------------

  // ---- Debug mode -----------------------------------------------------------

  /** Enable or disable debug overlay that shows element bounding boxes. */
  setDebugMode(enabled: boolean): void {
    this._debugMode = enabled;
    if (this.ir) {
      const scene = this.ir.scenes[this.currentSceneIndex];
      if (scene) this.renderDebug(scene);
    }
  }

  /** Whether debug mode is currently active. */
  get debugMode(): boolean {
    return this._debugMode;
  }

  /** Get the underlying Konva Stage (for advanced usage). */
  getStage(): StageHandle {
    return this.stage;
  }

  /** Get the current coordinate transform. */
  getTransform(): CoordinateTransform {
    return this.transform;
  }

  // ---- Edit overlay ---------------------------------------------------------

  /**
   * Create an overlay Layer and Transformer for edit mode.
   * Destroys any existing overlay first.
   * isDSLMode=true → border-only indicator; false → full handle UI.
   */
  createEditOverlay(isDSLMode: boolean): void {
    this.destroyEditOverlay();
    const layer = new Konva.Layer();
    this.stage.add(layer);
    const transformer = new Konva.Transformer(isDSLMode ? {
      borderStroke: '#3b82f6',
      borderStrokeWidth: 1.5,
      borderDash: [4, 4],
      enabledAnchors: [],
      rotateEnabled: false,
      resizeEnabled: false,
    } : {
      borderStroke: '#3b82f6',
      borderStrokeWidth: 1,
      anchorFill: '#ffffff',
      anchorStroke: '#3b82f6',
      anchorStrokeWidth: 2,
      anchorSize: 8,
      anchorCornerRadius: 2,
      keepRatio: false,
      rotateEnabled: true,
      rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
      rotationSnapTolerance: 5,
    });
    layer.add(transformer);
    this.overlayLayer = layer;
    this.editTransformer = transformer;
    layer.batchDraw();
  }

  /** Destroy the overlay Layer and Transformer, releasing Konva resources. */
  destroyEditOverlay(): void {
    if (this.editTransformer) {
      this.editTransformer.nodes([]);
      this.editTransformer.destroy();
      this.editTransformer = null;
    }
    if (this.overlayLayer) {
      this.overlayLayer.destroy();
      this.overlayLayer = null;
    }
  }

  /** Get the Transformer created by createEditOverlay, or null if not in edit mode. */
  getEditTransformer(): TransformerHandle | null {
    return this.editTransformer;
  }

  /** Get the overlay Layer created by createEditOverlay, or null if not in edit mode. */
  getOverlayLayer(): LayerHandle | null {
    return this.overlayLayer;
  }

  /** Destroy the engine and its Konva stage. */
  destroy(): void {
    this.destroyEditOverlay();
    this.stage.destroy();
  }

  // ---- Private rendering ----------------------------------------------------

  private renderCurrentScene(): void {
    if (!this.ir) return;

    const scene = this.ir.scenes[this.currentSceneIndex];
    if (!scene) return;

    this.renderBackground(scene);
    this.renderContent(scene);
    this.renderDebug(scene);
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

  private renderDebug(scene: IRScene): void {
    // Destroy the entire layer (not just children) to ensure Konva internal
    // event listeners are fully released — destroyChildren() leaks ~32
    // listeners per call.
    this.debugLayer.destroy();
    this.debugLayer = new Konva.Layer({ listening: false });
    this.stage.add(this.debugLayer);

    if (!this._debugMode) return;

    this.renderDebugElements(scene.elements);
    this.debugLayer.moveToTop();
    this.debugLayer.batchDraw();
  }

  private renderDebugElements(elements: IRElement[]): void {
    for (const el of elements) {
      this.renderDebugRect(el);
      if (el.type === 'container') {
        this.renderDebugElements((el as IRContainer).children);
      }
    }
  }

  private renderDebugRect(el: IRElement): void {
    const abs = this.transform.toAbsoluteBounds(el.bounds);
    const color = DEBUG_COLORS[el.type] ?? '#999999';
    const fontSize = Math.max(Math.min(abs.width, abs.height) * 0.08, 7);

    this.debugLayer.add(
      new Konva.Rect({
        x: abs.x,
        y: abs.y,
        width: abs.width,
        height: abs.height,
        stroke: color,
        strokeWidth: 1,
        fill: color + '11',
        dash: [4, 2],
        listening: false,
      }),
    );

    this.debugLayer.add(
      new Konva.Text({
        x: abs.x + 2,
        y: abs.y + 1,
        text: `${el.type}:${el.id}`,
        fontSize,
        fill: color,
        listening: false,
      }),
    );
  }
}
