/**
 * Scene DSL Type Definitions
 *
 * Types and classification utilities for scene compilation.
 */

import type { ASTBlock, ASTElement, ASTNode } from '../ast.js';
import type { SceneLayoutType } from '../layout/scene-layout.js';

export type { SceneLayoutType } from '../layout/scene-layout.js';

// ---------------------------------------------------------------------------
// Scene content type
// ---------------------------------------------------------------------------

export type SceneContentType =
  | 'heading'
  | 'label'
  | 'bullet'
  | 'stat'
  | 'quote'
  | 'column'
  | 'item'
  | 'image'
  | 'icon'
  | 'step'
  | 'unknown';

// ---------------------------------------------------------------------------
// Layout classification
// ---------------------------------------------------------------------------

/**
 * Determine the scene layout type from a scene block's props.
 * Falls back to 'custom' if no layout is specified.
 */
export function classifySceneLayout(sceneBlock: ASTBlock): SceneLayoutType {
  const layout = sceneBlock.props.layout;
  if (typeof layout !== 'string') return 'custom';

  switch (layout) {
    case 'title': return 'title';
    case 'statement': return 'statement';
    case 'bullets': return 'bullets';
    case 'two-column': return 'two-column';
    case 'three-column': return 'three-column';
    case 'big-number': return 'big-number';
    case 'quote': return 'quote';
    case 'image-text': return 'image-text';
    case 'icon-grid': return 'icon-grid';
    case 'timeline': return 'timeline';
    case 'custom': return 'custom';
    default: return 'custom';
  }
}

// ---------------------------------------------------------------------------
// Content type classification
// ---------------------------------------------------------------------------

/**
 * Classify an AST node's content type for scene layout purposes.
 */
export function classifySceneContent(node: ASTNode): SceneContentType {
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
      case 'image': return 'image';
      case 'icon': return 'icon';
      case 'step': return 'step';
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
