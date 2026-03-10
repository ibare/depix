/**
 * Slide DSL Type Definitions
 *
 * Types and classification utilities for slide compilation.
 */

import type { ASTBlock, ASTElement, ASTNode } from '../ast.js';
import type { SlideLayoutType } from '../layout/slide-layout.js';

export type { SlideLayoutType } from '../layout/slide-layout.js';

// ---------------------------------------------------------------------------
// Slide content type
// ---------------------------------------------------------------------------

export type SlideContentType =
  | 'heading'
  | 'label'
  | 'bullet'
  | 'stat'
  | 'quote'
  | 'column'
  | 'item'
  | 'unknown';

// ---------------------------------------------------------------------------
// Layout classification
// ---------------------------------------------------------------------------

/**
 * Determine the slide layout type from a slide block's props.
 * Falls back to 'custom' if no layout is specified.
 */
export function classifySlideLayout(slideBlock: ASTBlock): SlideLayoutType {
  const layout = slideBlock.props.layout;
  if (typeof layout !== 'string') return 'custom';

  switch (layout) {
    case 'title': return 'title';
    case 'statement': return 'statement';
    case 'bullets': return 'bullets';
    case 'two-column': return 'two-column';
    case 'three-column': return 'three-column';
    case 'big-number': return 'big-number';
    case 'quote': return 'quote';
    case 'custom': return 'custom';
    default: return 'custom';
  }
}

// ---------------------------------------------------------------------------
// Content type classification
// ---------------------------------------------------------------------------

/**
 * Classify an AST node's content type for slide layout purposes.
 */
export function classifySlideContent(node: ASTNode): SlideContentType {
  if (node.kind === 'block') {
    if (node.blockType === 'column') return 'column';
    return 'unknown';
  }
  if (node.kind === 'element') {
    switch (node.elementType) {
      case 'heading': return 'heading';
      case 'label': return 'label';
      case 'text': return 'label';
      case 'bullet': return 'bullet';
      case 'stat': return 'stat';
      case 'quote': return 'quote';
      case 'item': return 'item';
      default: return 'unknown';
    }
  }
  return 'unknown';
}

/**
 * Extract heading level from an AST element.
 */
export function getHeadingLevel(node: ASTElement): number {
  const level = node.props.level;
  if (typeof level === 'number') return level;
  return 1;
}

/**
 * Count sub-items in a bullet or column node.
 */
export function countSubItems(node: ASTNode): number {
  if (node.kind === 'element') {
    // bullet with nested item children
    return node.children.filter(c => c.kind === 'element' && c.elementType === 'item').length;
  }
  if (node.kind === 'block') {
    return node.children.filter(c => c.kind !== 'edge').length;
  }
  return 0;
}
