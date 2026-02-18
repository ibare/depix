/**
 * Test setup for Konva in happy-dom environment.
 *
 * Patches the global document.createElement to use the `canvas`
 * package for canvas elements, enabling proper Konva.Text measurement.
 */

import { createCanvas } from 'canvas';

const originalCreateElement = document.createElement.bind(document);

// @ts-expect-error -- patching for Konva compatibility
document.createElement = function (tagName: string, options?: ElementCreationOptions) {
  if (tagName === 'canvas') {
    return createCanvas(300, 150) as unknown as HTMLCanvasElement;
  }
  return originalCreateElement(tagName, options);
};
