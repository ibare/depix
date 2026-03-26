/**
 * Emit IR — Shared Helpers
 *
 * Utility functions used by emit-ir-blocks and emit-ir-elements.
 * Extracted to avoid circular dependencies between the split modules.
 */

import type {
  IRBounds,
  IREdge as IREdgeType,
  IRInnerText,
  IRShapeType,
  IRStyle,
} from '../../ir/types.js';
import type { DepixTheme } from '../../theme/types.js';
import type { ASTEdge, ASTElement } from '../ast.js';
import { routeEdge, type RouteEdgeInput } from '../routing/edge-router.js';
import type { ScaleContext } from './scale-system.js';
import { computeFontSize } from './scale-system.js';
import type { MeasureResult } from './measure.js';

// ---------------------------------------------------------------------------
// Style conversion
// ---------------------------------------------------------------------------

export function buildStyle(astStyle: Record<string, string | number>): IRStyle {
  const style: IRStyle = {};

  if ('background' in astStyle) {
    style.fill = String(astStyle.background);
  }
  if ('border' in astStyle && typeof astStyle.border === 'string') {
    style.stroke = astStyle.border;
  }
  if ('border-width' in astStyle && typeof astStyle['border-width'] === 'number') {
    style.strokeWidth = astStyle['border-width'];
  }
  if ('stroke-width' in astStyle && typeof astStyle['stroke-width'] === 'number') {
    style.strokeWidth = astStyle['stroke-width'];
  }

  // Shadow from expanded tokens
  if (
    'shadow-offsetX' in astStyle &&
    'shadow-offsetY' in astStyle &&
    'shadow-blur' in astStyle &&
    'shadow-color' in astStyle
  ) {
    style.shadow = {
      offsetX: Number(astStyle['shadow-offsetX']),
      offsetY: Number(astStyle['shadow-offsetY']),
      blur: Number(astStyle['shadow-blur']),
      color: String(astStyle['shadow-color']),
    };
  }

  // Dash pattern
  if ('dash' in astStyle && typeof astStyle.dash === 'string') {
    style.dashPattern = astStyle.dash.split(',').map(Number).filter(n => !isNaN(n));
  }

  return style;
}

// ---------------------------------------------------------------------------
// Inner text for shapes
// ---------------------------------------------------------------------------

export function buildInnerText(
  element: ASTElement,
  theme: DepixTheme,
  bounds?: IRBounds,
  scaleCtx?: ScaleContext,
  measured?: MeasureResult,
): IRInnerText {
  const fontSize = measured
    ? measured.fontSize
    : (typeof element.style['font-size'] === 'number'
      ? element.style['font-size']
      : scaleCtx && bounds ? computeFontSize(Math.min(bounds.w, bounds.h), 'innerLabel') : theme.fontSize.md);
  const color = typeof element.style.color === 'string'
    ? element.style.color
    : theme.foreground;

  const innerText: IRInnerText = {
    content: element.label ?? '',
    color,
    fontSize,
    align: 'center',
    valign: 'middle',
  };

  if (element.flags.includes('bold')) innerText.fontWeight = 'bold';
  if (element.flags.includes('italic')) innerText.fontStyle = 'italic';

  return innerText;
}

// ---------------------------------------------------------------------------
// Corner radius extraction
// ---------------------------------------------------------------------------

export function extractCornerRadius(element: ASTElement): number | undefined {
  if ('radius' in element.style) {
    const r = element.style.radius;
    if (typeof r === 'number') return r;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Edge routing
// ---------------------------------------------------------------------------

export function routeASTEdge(
  edge: ASTEdge,
  boundsMap: Map<string, IRBounds>,
  shapeMap?: Map<string, IRShapeType>,
  isBackEdge = false,
): IREdgeType | null {
  const fromBounds = boundsMap.get(edge.fromId);
  const toBounds = boundsMap.get(edge.toId);

  if (!fromBounds || !toBounds) return null;

  const input: RouteEdgeInput = {
    fromId: edge.fromId,
    toId: edge.toId,
    fromBounds,
    toBounds,
    fromShape: shapeMap?.get(edge.fromId),
    toShape: shapeMap?.get(edge.toId),
    edgeStyle: edge.edgeStyle,
    label: edge.label,
    isBackEdge,
  };

  return routeEdge(input);
}
