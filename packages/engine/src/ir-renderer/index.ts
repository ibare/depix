/**
 * IR Renderer — Public API
 *
 * Renders DepixIR elements to Konva nodes. All layout is pre-computed
 * in the IR, so the renderer simply maps IR elements to Konva primitives
 * with coordinate transformation.
 *
 * File structure:
 *   renderers.ts — element type dispatchers (renderShape, renderText, …)
 *   style.ts     — style attribute resolution, font, transform helpers
 *   helpers.ts   — arrow marker and edge direction geometry
 */

export { renderElement, renderElements } from './renderers.js';
