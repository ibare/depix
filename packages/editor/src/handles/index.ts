/**
 * Handle system barrel exports.
 *
 * Provides handle definitions and strategies for the editor.
 *
 * @module @depix/editor/handles
 */

export { HandleManager } from './handle-manager.js';
export type { HandleManagerOptions } from './handle-manager.js';
export { getHandleDefinition, isKeepRatioShape } from './handle-strategies.js';
export type { HandleType, HandleDefinition, AnchorName } from './types.js';
export { ALL_ANCHORS, CORNER_ANCHORS } from './types.js';
