/**
 * Scene Emission — Measurement & Sizing Utilities
 *
 * Content height estimation and adaptive font sizing for scene layout.
 * Used by element emitters (fit-scale), block emitters (compact stacking),
 * and the main emit-scene orchestrator (auto-height).
 */

import type { SceneTheme } from '../../theme/scene-theme.js';
import type { ASTBlock, ASTElement, ASTNode } from '../ast.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const LINE_HEIGHT_MULTIPLIER = 2.0;

// Proportional-font average character width as a fraction of fontSize (em units).
// Derived from typical sans-serif glyph metrics; 0.55 ~ width/fontSize for Latin text.
// Units: dimensionless ratio (applies equally to 0-100 relative-coordinate fontSize values).
export const CHAR_WIDTH_RATIO = 0.55;

// Minimum scale factor applied to baseFontSize when content overflows available space.
// 0.3 ~ 30% of original -- chosen to keep text legible at extreme overflow; below this
// threshold content becomes unreadable regardless of size. Units: dimensionless ratio.
export const MIN_FONT_SCALE = 0.3;

// ---------------------------------------------------------------------------
// Text measurement
// ---------------------------------------------------------------------------

/**
 * Estimate the rendered width of a text string at a given fontSize.
 * Uses a conservative average-character-width heuristic (CHAR_WIDTH_RATIO).
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * CHAR_WIDTH_RATIO;
}

// ---------------------------------------------------------------------------
// Fit scaling
// ---------------------------------------------------------------------------

/**
 * Compute a uniform scale factor [MIN_FONT_SCALE, 1.0] so that content of
 * (naturalH x naturalW) fits within (boundsH x boundsW).
 * Both height and width constraints are considered; the tighter one wins.
 */
export function computeFitScale(
  boundsH: number,
  boundsW: number,
  naturalH: number,
  naturalW: number,
  minScale: number = MIN_FONT_SCALE,
): number {
  const scaleH = naturalH > 0 ? Math.min(1, boundsH / naturalH) : 1;
  const scaleW = naturalW > 0 ? Math.min(1, boundsW / naturalW) : 1;
  return Math.max(minScale, Math.min(scaleH, scaleW));
}

/**
 * Adaptive padding for box containers (step 1 of overflow adaptation).
 * Returns the default padding when content fits; reduces it toward 0 when
 * content natural height exceeds available space.
 */
export function adaptBoxPadding(
  boundsH: number,
  contentNaturalH: number,
  defaultRatio: number = 0.05,
): number {
  const def = boundsH * defaultRatio;
  if (contentNaturalH <= boundsH - 2 * def) return def;
  return Math.max(0, (boundsH - contentNaturalH) / 2);
}

// ---------------------------------------------------------------------------
// Content height estimators — one entry per element type.
// Returns height in 0-100 relative coordinates.
// Blocks always return 0 (flex: use remaining space).
// ---------------------------------------------------------------------------

type ContentHeightEstimator = (node: ASTElement, baseFontSize: number, sceneTheme: SceneTheme) => number;

const defaultContentHeight: ContentHeightEstimator = (_, base, theme) =>
  base * theme.typography.bodySize * LINE_HEIGHT_MULTIPLIER;

const CONTENT_HEIGHT_ESTIMATORS: Record<string, ContentHeightEstimator> = {
  heading: (node, base, theme) => {
    const level = typeof node.props.level === 'number' ? node.props.level : 1;
    const mult = level === 1 ? theme.typography.headingSize : theme.typography.headingSize * 0.7;
    return base * mult * LINE_HEIGHT_MULTIPLIER;
  },
  stat: (_, base, theme) =>
    base * (theme.typography.statSize + theme.typography.bodySize) * LINE_HEIGHT_MULTIPLIER,
  quote: (_, base, theme) =>
    base * theme.typography.bodySize * LINE_HEIGHT_MULTIPLIER * 2,
  bullet: (node, base, theme) => {
    const n = Math.max(node.children.filter(
      (c): c is ASTElement => c.kind === 'element' && c.elementType === 'item',
    ).length, 1);
    return n * base * theme.typography.bodySize * LINE_HEIGHT_MULTIPLIER
      + (n - 1) * theme.layout.itemGap;
  },
  list: (node, base, theme) => {
    const n = Math.max(node.items?.length ?? 1, 1);
    return n * base * theme.typography.bodySize * LINE_HEIGHT_MULTIPLIER
      + (n - 1) * theme.layout.itemGap;
  },
  divider: () => 1,
  line: () => 1,
  image: (_, base) => base * 6,
};

/**
 * Estimate the content height of a scene element based on its type and font size.
 * Used by emitColumn/emitBoxBlock for compact vertical stacking instead of
 * equal-height distribution.
 * Blocks return 0, meaning they are flex items that share remaining space.
 */
export function estimateContentHeight(node: ASTNode, baseFontSize: number, sceneTheme: SceneTheme): number {
  if (node.kind === 'block') return 0; // flex -- use remaining space
  if (node.kind === 'element') {
    return (CONTENT_HEIGHT_ESTIMATORS[node.elementType] ?? defaultContentHeight)(node, baseFontSize, sceneTheme);
  }
  return defaultContentHeight(node as ASTElement, baseFontSize, sceneTheme);
}

/**
 * Compute compact stacking heights for a list of nodes.
 * Elements get their content height; remaining space is distributed to blocks
 * or left as bottom padding.
 */
export function computeCompactHeights(
  nodes: ASTNode[],
  availableH: number,
  gap: number,
  baseFontSize: number,
  sceneTheme: SceneTheme,
): number[] {
  const n = nodes.length;
  if (n === 0) return [];

  const totalGap = gap * Math.max(n - 1, 0);
  const usable = Math.max(availableH - totalGap, 0);

  const contentHeights = nodes.map(node => estimateContentHeight(node, baseFontSize, sceneTheme));
  const fixedTotal = contentHeights.reduce((s, h) => s + (h > 0 ? h : 0), 0);
  const flexCount = contentHeights.filter(h => h === 0).length;
  const remaining = Math.max(usable - fixedTotal, 0);

  return contentHeights.map(h => {
    if (h > 0) return Math.min(h, usable); // content-sized
    return flexCount > 0 ? remaining / flexCount : 0; // flex items share remaining
  });
}

/**
 * Adapt baseFontSize so that all content fits within the available height.
 * If total estimated content height exceeds availableH, shrinks baseFontSize proportionally.
 * Minimum: 30% of original baseFontSize.
 */
export function adaptBaseFontSize(
  availableH: number,
  contentNodes: ASTNode[],
  baseFontSize: number,
  gap: number,
  sceneTheme: SceneTheme,
): number {
  if (contentNodes.length === 0 || availableH <= 0) return baseFontSize;

  const totalGap = gap * Math.max(contentNodes.length - 1, 0);
  const totalContentH = contentNodes.reduce(
    (sum, node) => sum + estimateContentHeight(node, baseFontSize, sceneTheme), 0,
  ) + totalGap;

  if (totalContentH > availableH && totalContentH > 0) {
    const usable = Math.max(availableH - totalGap, 0);
    const totalEstimates = totalContentH - totalGap;
    const scale = totalEstimates > 0 ? usable / totalEstimates : 1;
    return Math.max(baseFontSize * scale, baseFontSize * 0.3);
  }

  return baseFontSize;
}

/**
 * Recursively estimate the natural height of a block node (box, layer, etc.)
 * for use in auto-height calculations. Block children are not flex items here --
 * their content drives the scene height.
 */
export function estimateBlockNaturalHeight(
  block: ASTBlock,
  baseFontSize: number,
  sceneTheme: SceneTheme,
): number {
  const gap = sceneTheme.layout.itemGap;
  // Use scenePadding as a proxy for box inner padding (0-100 relative coords)
  const padding = sceneTheme.layout.scenePadding;
  const children = block.children.filter(c => c.kind !== 'edge');
  if (children.length === 0) return padding * 2;
  const childH = children.reduce((s, n) => {
    if (n.kind === 'block') return s + estimateBlockNaturalHeight(n as ASTBlock, baseFontSize, sceneTheme);
    return s + estimateContentHeight(n, baseFontSize, sceneTheme);
  }, 0) + gap * Math.max(children.length - 1, 0);
  return childH + padding * 2;
}

/**
 * Estimate the total height a scene requires for its content.
 * Used in @page * (auto-height) mode to derive the canvas h before planning.
 */
export function computeSceneNaturalHeight(
  sceneBlock: ASTBlock,
  sceneTheme: SceneTheme,
): number {
  // 7 = 100 (canvas width) * 0.07; width-anchored baseline (0-100 relative coords)
  const baseFontSize = 7;
  const padding = sceneTheme.layout.scenePadding;
  const gap = sceneTheme.layout.itemGap;
  const nodes = sceneBlock.children.filter(c => c.kind !== 'edge');
  if (nodes.length === 0) return 100;
  const totalH = nodes.reduce((s, n) => {
    if (n.kind === 'block') return s + estimateBlockNaturalHeight(n as ASTBlock, baseFontSize, sceneTheme);
    return s + estimateContentHeight(n, baseFontSize, sceneTheme);
  }, 0) + gap * Math.max(nodes.length - 1, 0);
  // 100 = full canvas height (0-100 relative coords); minimum scene height
  return Math.max(totalH + padding * 2, 100);
}
