/**
 * Slide Layout Pass
 *
 * Analyses a slide AST block, extracts layout children, dispatches to
 * the appropriate slide layout function, and returns a BoundsMap.
 *
 * This is the layout pass — it computes geometry only, no IR emission.
 */

import type { IRBounds } from '../../ir/types.js';
import type { SlideTheme } from '../../theme/slide-theme.js';
import type { ASTBlock, ASTNode } from '../ast.js';
import type { SlideLayoutChild, SlideLayoutConfig } from '../layout/types.js';
import { layoutSlide } from '../layout/slide-layout.js';
import {
  classifySlideContent,
  classifySlideLayout,
  countSubItems,
  getHeadingLevel,
  type SlideLayoutType,
} from './slide-types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlidePlan {
  layoutType: SlideLayoutType;
  boundsMap: Map<string, IRBounds>;
  slideBounds: IRBounds;
  /** Ordered child node IDs matching their AST order. */
  childIds: string[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute layout for a single slide block.
 *
 * @param slideBlock - The AST block with blockType='slide'
 * @param canvasBounds - Available bounds for the slide
 * @param slideTheme - Slide theme configuration
 * @returns SlidePlan with BoundsMap for all slide content nodes
 */
export function planSlide(
  slideBlock: ASTBlock,
  canvasBounds: IRBounds,
  slideTheme: SlideTheme,
): SlidePlan {
  const layoutType = classifySlideLayout(slideBlock);

  // Extract layout children from AST (skip edges)
  const contentNodes: ASTNode[] = [];
  for (const child of slideBlock.children) {
    if (child.kind === 'edge') continue;
    contentNodes.push(child);
  }

  // Convert AST nodes to SlideLayoutChild[]
  const layoutChildren = contentNodes.map((node, i) => astToLayoutChild(node, i));

  // Build layout config from theme
  const config = buildSlideLayoutConfig(canvasBounds, slideTheme);

  // Dispatch to layout function
  const result = layoutSlide(layoutType, layoutChildren, config);

  // Build BoundsMap
  const boundsMap = new Map<string, IRBounds>();
  const childIds: string[] = [];

  for (let i = 0; i < layoutChildren.length; i++) {
    const id = layoutChildren[i].id;
    boundsMap.set(id, result.childBounds[i]);
    childIds.push(id);
  }

  return {
    layoutType,
    boundsMap,
    slideBounds: canvasBounds,
    childIds,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function astToLayoutChild(node: ASTNode, index: number): SlideLayoutChild {
  const contentType = classifySlideContent(node);
  let id: string;

  if (node.kind === 'element') {
    id = node.id ?? `slide-el-${index}`;
  } else if (node.kind === 'block') {
    id = node.id ?? `slide-block-${index}`;
  } else {
    id = `slide-node-${index}`;
  }

  const itemCount = countSubItems(node);
  const level = node.kind === 'element' ? getHeadingLevel(node) : undefined;

  return {
    id,
    width: 0,  // slide layouts use percentage-based sizing, not intrinsic
    height: 0,
    contentType: contentType === 'unknown' ? 'label' : contentType,
    level,
    itemCount: itemCount > 0 ? itemCount : undefined,
  };
}

function buildSlideLayoutConfig(
  canvasBounds: IRBounds,
  theme: SlideTheme,
): SlideLayoutConfig {
  return {
    bounds: canvasBounds,
    padding: theme.layout.slidePadding,
    headingHeight: theme.layout.headingHeight,
    columnGap: theme.layout.columnGap,
    itemGap: theme.layout.itemGap,
  };
}
