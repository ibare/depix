/**
 * TipTap Node extension types for Depix blocks.
 *
 * These types define the attributes and configuration for embedding
 * Depix diagrams within a TipTap rich text editor. No TipTap or
 * ProseMirror dependencies are required.
 *
 * @module @depix/react/tiptap
 */

/**
 * Attributes stored on a Depix block node in the TipTap document.
 */
export interface DepixBlockAttrs {
  /** The DepixIR document data (JSON-serialized). */
  ir: string;
  /** Optional DSL source text. */
  dsl?: string;
  /** Display width in pixels. */
  width?: number;
  /** Display height in pixels. */
  height?: number;
}

/**
 * Configuration options for the Depix block extension.
 */
export interface DepixBlockConfig {
  /** Default width for new blocks (pixels). */
  defaultWidth?: number;
  /** Default height for new blocks (pixels). */
  defaultHeight?: number;
  /** Whether blocks are editable inline. */
  editable?: boolean;
}
