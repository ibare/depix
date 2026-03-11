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
import type { SceneLayoutChild, SceneLayoutConfig, SceneLayoutConfigV2 } from '../layout/types.js';
import { layoutScene, layoutSceneV2 } from '../layout/scene-layout.js';
import {
  classifySceneContent,
  classifySceneLayout,
  countSubItems,
  getHeadingLevel,
  type SceneLayoutType,
} from './scene-types.js';

// ---------------------------------------------------------------------------
// V2 layout type set
// ---------------------------------------------------------------------------

const V2_LAYOUT_TYPES: ReadonlySet<string> = new Set([
  'full', 'center', 'split', 'rows', 'sidebar',
  'header', 'header-split', 'header-rows', 'header-sidebar',
  'grid', 'header-grid', 'focus', 'header-focus',
]);

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

  // Extract content nodes from AST (skip edges)
  const contentNodes: ASTNode[] = [];
  for (const child of sceneBlock.children) {
    if (child.kind === 'edge') continue;
    contentNodes.push(child);
  }

  // V2 slot-based layout
  if (V2_LAYOUT_TYPES.has(layoutType)) {
    return planSceneV2(sceneBlock, layoutType, contentNodes, canvasBounds, sceneTheme);
  }

  // V1 content-type-based layout (legacy)
  const layoutChildren = contentNodes.map((node, i) => astToLayoutChild(node, i));
  const config = buildSceneLayoutConfig(canvasBounds, sceneTheme);
  const result = layoutScene(layoutType, layoutChildren, config);

  const boundsMap = new Map<string, IRBounds>();
  const childIds: string[] = [];

  for (let i = 0; i < layoutChildren.length; i++) {
    const id = layoutChildren[i].id;
    boundsMap.set(id, result.childBounds[i]);
    childIds.push(id);
  }

  return { layoutType, boundsMap, sceneBounds: canvasBounds, childIds };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * V2 slot-based scene planning.
 *
 * Layout functions produce slot bounds (Map<slotName, IRBounds[]>).
 * This function maps each AST child to its slot's bounds via the
 * child's `slot` field.
 */
function planSceneV2(
  sceneBlock: ASTBlock,
  layoutType: SceneLayoutType,
  contentNodes: ASTNode[],
  canvasBounds: IRBounds,
  sceneTheme: SceneTheme,
): ScenePlan {
  // Count cell slots for grid layouts
  const cellCount = contentNodes.filter(
    n => n.kind !== 'edge' && 'slot' in n && n.slot === 'cell',
  ).length;

  const config: SceneLayoutConfigV2 = {
    bounds: canvasBounds,
    padding: sceneTheme.layout.scenePadding,
    headerHeight: sceneTheme.layout.headingHeight,
    gap: sceneTheme.layout.columnGap,
    ratio: typeof sceneBlock.props.ratio === 'number' ? sceneBlock.props.ratio : undefined,
    direction: typeof sceneBlock.props.direction === 'string' ? sceneBlock.props.direction : undefined,
  };

  const result = layoutSceneV2(layoutType, config, cellCount);

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

  return { layoutType, boundsMap, sceneBounds: canvasBounds, childIds };
}

// ---------------------------------------------------------------------------
// V1 helpers (legacy)
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
