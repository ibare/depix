/**
 * Scene Layout Pass
 *
 * Analyses a scene AST block, computes slot-based layout bounds,
 * and maps each child to its slot's bounds via the `slot` field.
 *
 * This is the layout pass — it computes geometry only, no IR emission.
 */

import type { IRBounds } from '../../ir/types.js';
import type { SceneTheme } from '../../theme/scene-theme.js';
import type { ASTBlock, ASTNode } from '../ast.js';
import type { SceneLayoutConfig } from '../layout/types.js';
import { layoutScene } from '../layout/scene-layout.js';
import {
  classifySceneLayout,
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
  /** All slot bounds from layout computation (including empty slots). */
  slotBounds: Map<string, IRBounds[]>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute slot-based layout for a single scene block.
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

  // Extract content nodes from AST (skip edges)
  const contentNodes: ASTNode[] = [];
  for (const child of sceneBlock.children) {
    if (child.kind === 'edge') continue;
    contentNodes.push(child);
  }

  // Count cell slots for grid layouts
  const cellCount = contentNodes.filter(
    n => n.kind !== 'edge' && 'slot' in n && n.slot === 'cell',
  ).length;

  const config: SceneLayoutConfig = {
    bounds: canvasBounds,
    padding: sceneTheme.layout.scenePadding,
    headerHeight: sceneTheme.layout.headingHeight,
    gap: sceneTheme.layout.columnGap,
    ratio: typeof sceneBlock.props.ratio === 'number' ? sceneBlock.props.ratio : undefined,
    direction: typeof sceneBlock.props.direction === 'string' ? sceneBlock.props.direction : undefined,
  };

  const result = layoutScene(layoutType, config, cellCount);

  // Map children to slot bounds
  const boundsMap = new Map<string, IRBounds>();
  const childIds: string[] = [];
  let cellIdx = 0;

  for (let i = 0; i < contentNodes.length; i++) {
    const node = contentNodes[i];
    const id =
      node.kind === 'element'
        ? (node.id ?? `scene-el-${i}`)
        : node.kind === 'block'
          ? (node.id ?? `scene-block-${i}`)
          : `scene-node-${i}`;
    childIds.push(id);

    const slot = (node.kind === 'element' || node.kind === 'block') ? node.slot : undefined;
    if (!slot) continue;

    const slotBoundsArr = result.slotBounds.get(slot);
    if (!slotBoundsArr || slotBoundsArr.length === 0) continue;

    if (slot === 'cell') {
      if (cellIdx < slotBoundsArr.length) {
        boundsMap.set(id, slotBoundsArr[cellIdx]);
        cellIdx++;
      }
    } else {
      // Unique slot — take first bounds
      boundsMap.set(id, slotBoundsArr[0]);
    }
  }

  return { layoutType, boundsMap, sceneBounds: canvasBounds, childIds, slotBounds: result.slotBounds };
}
