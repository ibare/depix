/**
 * Scene Layout Pass
 *
 * Analyses a scene AST block, extracts layout children, dispatches to
 * the appropriate scene layout function, and returns a BoundsMap.
 *
 * This is the layout pass — it computes geometry only, no IR emission.
 */

import type { IRBounds } from '../../ir/types.js';
import type { SceneTheme } from '../../theme/scene-theme.js';
import type { ASTBlock, ASTNode } from '../ast.js';
import type { SceneLayoutChild, SceneLayoutConfig } from '../layout/types.js';
import { layoutScene } from '../layout/scene-layout.js';
import {
  classifySceneContent,
  classifySceneLayout,
  countSubItems,
  getHeadingLevel,
  type SceneLayoutType,
} from './scene-types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScenePlan {
  layoutType: SceneLayoutType;
  boundsMap: Map<string, IRBounds>;
  sceneBounds: IRBounds;
  /** Ordered child node IDs matching their AST order. */
  childIds: string[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute layout for a single scene block.
 *
 * @param sceneBlock - The AST block with blockType='scene'
 * @param canvasBounds - Available bounds for the scene
 * @param sceneTheme - Scene theme configuration
 * @returns ScenePlan with BoundsMap for all scene content nodes
 */
export function planScene(
  sceneBlock: ASTBlock,
  canvasBounds: IRBounds,
  sceneTheme: SceneTheme,
): ScenePlan {
  const layoutType = classifySceneLayout(sceneBlock);

  // Extract layout children from AST (skip edges)
  const contentNodes: ASTNode[] = [];
  for (const child of sceneBlock.children) {
    if (child.kind === 'edge') continue;
    contentNodes.push(child);
  }

  // Convert AST nodes to SceneLayoutChild[]
  const layoutChildren = contentNodes.map((node, i) => astToLayoutChild(node, i));

  // Build layout config from theme
  const config = buildSceneLayoutConfig(canvasBounds, sceneTheme);

  // Dispatch to layout function
  const result = layoutScene(layoutType, layoutChildren, config);

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
    sceneBounds: canvasBounds,
    childIds,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function astToLayoutChild(node: ASTNode, index: number): SceneLayoutChild {
  const contentType = classifySceneContent(node);
  let id: string;

  if (node.kind === 'element') {
    id = node.id ?? `scene-el-${index}`;
  } else if (node.kind === 'block') {
    id = node.id ?? `scene-block-${index}`;
  } else {
    id = `scene-node-${index}`;
  }

  const itemCount = countSubItems(node);
  const level = node.kind === 'element' ? getHeadingLevel(node) : undefined;

  return {
    id,
    width: 0,  // scene layouts use percentage-based sizing, not intrinsic
    height: 0,
    contentType: contentType === 'unknown' ? 'label' : contentType,
    level,
    itemCount: itemCount > 0 ? itemCount : undefined,
  };
}

function buildSceneLayoutConfig(
  canvasBounds: IRBounds,
  theme: SceneTheme,
): SceneLayoutConfig {
  return {
    bounds: canvasBounds,
    padding: theme.layout.scenePadding,
    headingHeight: theme.layout.headingHeight,
    columnGap: theme.layout.columnGap,
    itemGap: theme.layout.itemGap,
  };
}
