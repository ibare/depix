/**
 * Scene DSL Type Definitions
 *
 * Types and classification utilities for scene compilation.
 */

import type { ASTBlock } from '../ast.js';
import type { SceneLayoutType } from '../layout/scene-layout.js';

export type { SceneLayoutType } from '../layout/scene-layout.js';

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
    case 'full': case 'center': case 'split': case 'rows':
    case 'sidebar': case 'header': case 'header-split':
    case 'header-rows': case 'header-sidebar': case 'grid':
    case 'header-grid': case 'focus': case 'header-focus':
    case 'custom':
      return layout;
    default: return 'custom';
  }
}
