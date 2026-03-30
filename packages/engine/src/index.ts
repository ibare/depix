// @depix/engine — Konva renderer

export { DepixEngine, fitToAspectRatio } from './depix-engine.js';
export type { DepixEngineOptions } from './depix-engine.js';

export type {
  NodeHandle,
  StageHandle,
  StageEventObject,
  LayerHandle,
  TransformerHandle,
} from './handles.js';

export { renderElement, renderElements } from './ir-renderer/index.js';

export { CoordinateTransform } from './coordinate-transform.js';
export type { ViewportSize, AspectRatio } from './coordinate-transform.js';

export * from './export/index.js';

export { ShapeRegistry } from './registry/shape-registry.js';
export type { IconDefinition } from './registry/shape-registry.js';
export { collectIconIds, loadRegistryIndex, resolveIcons } from './registry/plugin-loader.js';
export type { RegistryIndex, RegistryPackEntry } from './registry/plugin-loader.js';
