/**
 * PNG Renderer
 *
 * Renders a DepixIR document (or a single scene) to a PNG image
 * using an offscreen Konva Stage. The resulting data URL can be
 * used directly in an <img> tag or downloaded as a file.
 *
 * @module @depix/engine/export
 */

import Konva from 'konva';
import type { DepixIR, IRScene, IRBackground } from '@depix/core';
import { CoordinateTransform } from '../coordinate-transform.js';
import { renderElements } from '../ir-renderer.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PNGOptions {
  /** Pixel scale factor for high-DPI rendering. Default: 2 */
  scale?: number;
  /** Override width in pixels. If not set, calculated from aspectRatio * scale * baseSize. */
  width?: number;
  /** Override height in pixels. If not set, calculated from aspectRatio * scale * baseSize. */
  height?: number;
  /** Base size for calculation (default: 400). Final size = baseSize * scale. */
  baseSize?: number;
  /** Override background color. */
  backgroundColor?: string;
}

export interface PNGResult {
  /** PNG image as data URL (base64). */
  dataUrl: string;
  /** Display width in CSS pixels. */
  displayWidth: number;
  /** Display height in CSS pixels. */
  displayHeight: number;
  /** Actual pixel width of the image. */
  pixelWidth: number;
  /** Actual pixel height of the image. */
  pixelHeight: number;
}

// ---------------------------------------------------------------------------
// Main Export Functions
// ---------------------------------------------------------------------------

/**
 * Render a DepixIR document to PNG.
 *
 * @param ir - The IR document to render
 * @param sceneIndex - Scene to render (default: 0, first scene)
 * @param options - PNG rendering options
 * @returns PNGResult with data URL and dimensions
 * @throws {Error} If the scene index is out of range or there are no scenes
 */
export function renderIRToPNG(
  ir: DepixIR,
  sceneIndex: number = 0,
  options?: PNGOptions,
): PNGResult {
  if (ir.scenes.length === 0) {
    throw new Error('Cannot render PNG: IR document has no scenes');
  }

  if (sceneIndex < 0 || sceneIndex >= ir.scenes.length) {
    throw new Error(
      `Scene index ${sceneIndex} is out of range (0-${ir.scenes.length - 1})`,
    );
  }

  const scene = ir.scenes[sceneIndex];
  return renderSceneToPNG(scene, ir.meta, options);
}

/**
 * Render a single scene to PNG.
 *
 * @param scene - The scene to render
 * @param meta - Document meta (for aspect ratio and background)
 * @param options - PNG rendering options
 * @returns PNGResult with data URL and dimensions
 */
export function renderSceneToPNG(
  scene: IRScene,
  meta: { aspectRatio: { width: number; height: number }; background: IRBackground },
  options?: PNGOptions,
): PNGResult {
  // 1. Calculate dimensions
  const scale = options?.scale ?? 2;
  const baseSize = options?.baseSize ?? 400;
  const { width: aw, height: ah } = meta.aspectRatio;
  const ratio = aw / ah;

  let pixelWidth: number;
  let pixelHeight: number;

  if (options?.width && options?.height) {
    pixelWidth = options.width;
    pixelHeight = options.height;
  } else {
    // Calculate from aspect ratio
    pixelWidth = Math.round(baseSize * scale * (ratio >= 1 ? 1 : ratio));
    pixelHeight = Math.round(baseSize * scale * (ratio >= 1 ? 1 / ratio : 1));
  }

  const displayWidth = pixelWidth / scale;
  const displayHeight = pixelHeight / scale;

  // 2. Create offscreen Konva Stage
  //
  // Temporarily disable Konva's browser mode so that Stage._buildDOM()
  // and Stage.add() skip real DOM manipulation (appendChild of node-canvas
  // elements to happy-dom divs is not supported). The canvas-level
  // rendering itself works fine regardless of this flag.
  const wasBrowser = (Konva as Record<string, unknown>).isBrowser;
  (Konva as Record<string, unknown>).isBrowser = false;
  let stage: Konva.Stage;
  try {
    const container = document.createElement('div');
    stage = new Konva.Stage({
      container,
      width: pixelWidth,
      height: pixelHeight,
    });

    // 3. Create background layer
    const bgLayer = new Konva.Layer();
    stage.add(bgLayer);

    const bg = scene.background ?? meta.background;
    const bgColor =
      options?.backgroundColor ??
      (bg?.type === 'solid' ? bg.color : '#ffffff') ??
      '#ffffff';

    bgLayer.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: pixelWidth,
        height: pixelHeight,
        fill: bgColor,
      }),
    );

    // 4. Create content layer
    const contentLayer = new Konva.Layer();
    stage.add(contentLayer);

    const transform = new CoordinateTransform(
      { width: pixelWidth, height: pixelHeight },
      meta.aspectRatio,
    );

    const group = renderElements(scene.elements, transform);
    contentLayer.add(group);
  } finally {
    (Konva as Record<string, unknown>).isBrowser = wasBrowser;
  }

  // 5. Draw and export
  stage.draw();

  const dataUrl = stage.toDataURL({
    pixelRatio: 1, // Already scaled via dimensions
    mimeType: 'image/png',
  });

  // 6. Clean up
  stage.destroy();

  return { dataUrl, displayWidth, displayHeight, pixelWidth, pixelHeight };
}
