/**
 * Layout Algorithm Shared Types
 *
 * Pure geometry types for layout computation. Layout algorithms work
 * in the 0-100 relative coordinate space and are independent of AST types.
 * The emit-ir pass (T-13) bridges AST → layout → IR.
 */

import type { IRBounds } from '../../ir/types.js';

// ---------------------------------------------------------------------------
// Layout child input
// ---------------------------------------------------------------------------

/**
 * A child to be positioned by a layout algorithm.
 *
 * The layout algorithm receives pre-measured children with known sizes
 * and computes their positions within the available bounds.
 */
export interface LayoutChild {
  /** Identifier (for referencing in edges). */
  id: string;
  /** Minimum / desired width in 0-100 coordinates. */
  width: number;
  /** Minimum / desired height in 0-100 coordinates. */
  height: number;
}

// ---------------------------------------------------------------------------
// Layout result
// ---------------------------------------------------------------------------

/**
 * Result of a layout computation.
 *
 * Contains the computed bounds for the container itself and for each child.
 * `childBounds[i]` corresponds to the input `children[i]`.
 */
export interface LayoutResult {
  /** Bounds of the container that wraps the children. */
  containerBounds: IRBounds;
  /** Computed bounds for each child (same order as input). */
  childBounds: IRBounds[];
}

// ---------------------------------------------------------------------------
// Stack layout config
// ---------------------------------------------------------------------------

export interface StackLayoutConfig {
  /** Available space for the layout. */
  bounds: IRBounds;
  /** Main-axis direction. `row` = left-to-right, `col` = top-to-bottom. */
  direction: 'row' | 'col';
  /** Gap between children in 0-100 coordinates. */
  gap: number;
  /** Cross-axis alignment. */
  align: 'start' | 'center' | 'end' | 'stretch';
  /** Whether to wrap to the next line when exceeding available space. */
  wrap: boolean;
}

// ---------------------------------------------------------------------------
// Grid layout config
// ---------------------------------------------------------------------------

export interface GridLayoutConfig {
  /** Available space for the layout. */
  bounds: IRBounds;
  /** Number of columns. */
  cols: number;
  /** Gap between cells in 0-100 coordinates. */
  gap: number;
}

// ---------------------------------------------------------------------------
// Flow layout config
// ---------------------------------------------------------------------------

/** An edge in the flow graph for layout purposes. */
export interface FlowEdge {
  fromId: string;
  toId: string;
}

export interface FlowLayoutConfig {
  /** Available space for the layout. */
  bounds: IRBounds;
  /** Main flow direction. */
  direction: 'right' | 'left' | 'down' | 'up';
  /** Gap between layers and between nodes within a layer. */
  gap: number;
  /** Edges between children (for topological ordering). */
  edges: FlowEdge[];
}

// ---------------------------------------------------------------------------
// Tree layout config
// ---------------------------------------------------------------------------

/** A tree node with children indices for hierarchical layout. */
export interface TreeNode {
  id: string;
  width: number;
  height: number;
  children: number[]; // indices into the children array
}

export interface TreeLayoutConfig {
  /** Available space for the layout. */
  bounds: IRBounds;
  /** Direction the tree grows. */
  direction: 'down' | 'right' | 'up' | 'left';
  /** Gap between levels. */
  levelGap: number;
  /** Gap between siblings. */
  siblingGap: number;
}

// ---------------------------------------------------------------------------
// Group layout config
// ---------------------------------------------------------------------------

export interface GroupLayoutConfig {
  /** Available space for the layout. */
  bounds: IRBounds;
  /** Padding around the group content. */
  padding: number;
}

// ---------------------------------------------------------------------------
// Layers layout config
// ---------------------------------------------------------------------------

export interface LayersLayoutConfig {
  /** Available space for the layout. */
  bounds: IRBounds;
  /** Gap between layers. */
  gap: number;
}

// ---------------------------------------------------------------------------
// Slide layout types
// ---------------------------------------------------------------------------

/** Content type discriminator for slide layout children. */
export type SlideContentType =
  | 'heading'
  | 'label'
  | 'bullet'
  | 'stat'
  | 'quote'
  | 'column'
  | 'item'
  | 'image'
  | 'icon'
  | 'step';

/**
 * Extended layout child for slide content.
 * Extends LayoutChild with content type information needed by slide layouts.
 */
export interface SlideLayoutChild extends LayoutChild {
  /** Semantic content type for positioning decisions. */
  contentType: SlideContentType;
  /** Optional level (e.g., heading level 1 or 2). */
  level?: number;
  /** Number of sub-items (for bullet/column children). */
  itemCount?: number;
}

export interface SlideLayoutConfig {
  /** Available space for the slide content. */
  bounds: IRBounds;
  /** Padding from slide edges (%). */
  padding: number;
  /** Height reserved for heading area (%). */
  headingHeight: number;
  /** Gap between columns (%). */
  columnGap: number;
  /** Gap between list items (%). */
  itemGap: number;
}
