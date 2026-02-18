/**
 * TipTap integration module for Depix.
 *
 * Provides types and serialization utilities for embedding Depix
 * diagrams as blocks within a TipTap rich text editor. This module
 * is dependency-free (no TipTap or ProseMirror required).
 *
 * @module @depix/react/tiptap
 */

// Types
export type { DepixBlockAttrs, DepixBlockConfig } from './depix-block-types.js';

// Serialization
export {
  hasDepixBlocks,
  parseAllDepixBlocks,
  parseDepixBlock,
  serializeDepixBlock,
} from './depix-block-serializer.js';
