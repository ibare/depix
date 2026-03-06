/**
 * Compiler Pass — Theme Resolution
 *
 * Walks the AST and resolves all semantic tokens to concrete values
 * using the provided theme. This is a pure transformation:
 * AST in → AST out (with resolved values).
 *
 * Resolved properties:
 * - Colors (background, color, border) → HEX
 * - Spacing (gap) → number
 * - Font size (font-size) → number
 * - Shadow (shadow) → resolved or 'none'
 * - Radius (radius) → number or 'none'
 * - Border width (border-width) → number or as-is
 */

import type { DepixTheme } from '../../theme/types.js';
import {
  resolveColor,
  resolveSpacing,
  resolveFontSize,
  resolveShadow,
  resolveRadius,
  resolveBorderWidth,
  generateColorPalette,
} from '../../theme/resolver.js';
import type {
  ASTDocument,
  ASTScene,
  ASTNode,
  ASTBlock,
  ASTElement,
} from '../ast.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function resolveTheme(
  ast: ASTDocument,
  theme: DepixTheme,
): ASTDocument {
  return {
    directives: [...ast.directives],
    scenes: ast.scenes.map((scene) => resolveScene(scene, theme)),
  };
}

// ---------------------------------------------------------------------------
// Internal resolution
// ---------------------------------------------------------------------------

function resolveScene(scene: ASTScene, theme: DepixTheme): ASTScene {
  return {
    ...scene,
    children: scene.children.map((child) => resolveNode(child, theme)),
  };
}

function resolveNode(node: ASTNode, theme: DepixTheme): ASTNode {
  switch (node.kind) {
    case 'block':
      return resolveBlock(node, theme);
    case 'element':
      return resolveElement(node, theme);
    case 'edge':
      return node; // Edges don't have semantic tokens to resolve
  }
}

function resolveBlock(block: ASTBlock, theme: DepixTheme): ASTBlock {
  const props = { ...block.props };
  const style = resolveStyleProps({ ...block.style }, theme);

  // Resolve spacing props
  if (typeof props.gap === 'string') {
    const resolved = resolveSpacing(props.gap, theme);
    if (typeof resolved === 'number') {
      props.gap = resolved;
    }
  }

  return {
    ...block,
    props,
    style,
    children: block.children.map((child) => resolveNode(child, theme)),
  };
}

function resolveElement(element: ASTElement, theme: DepixTheme): ASTElement {
  const style = resolveStyleProps({ ...element.style }, theme);

  // Expand color → palette (background, border, color) for container elements
  if (isContainerLikeElement(element.elementType)) {
    expandColorPalette(style);
  }

  // Apply theme node defaults for unstyled nodes
  if (isNodeLikeElement(element.elementType)) {
    applyNodeDefaults(style, theme);
  }

  return {
    ...element,
    style,
    children: element.children.map((child) => resolveNode(child, theme)),
  };
}

// ---------------------------------------------------------------------------
// Style property resolution
// ---------------------------------------------------------------------------

function resolveStyleProps(
  style: Record<string, string | number>,
  theme: DepixTheme,
): Record<string, string | number> {
  // Color properties
  for (const key of ['background', 'color', 'border'] as const) {
    if (key in style && typeof style[key] === 'string') {
      const resolved = resolveColor(style[key] as string, theme);
      style[key] = resolved;
    }
  }

  // Font size
  if ('font-size' in style && typeof style['font-size'] === 'string') {
    const resolved = resolveFontSize(style['font-size'] as string, theme);
    if (typeof resolved === 'number') {
      style['font-size'] = resolved;
    }
  }

  // Shadow
  if ('shadow' in style && typeof style['shadow'] === 'string') {
    const resolved = resolveShadow(style['shadow'] as string, theme);
    if (resolved === undefined) {
      style['shadow'] = 'none';
    } else if (typeof resolved === 'object') {
      // Store serialized shadow info — the emit-ir pass will convert to IRShadow
      style['shadow-offsetX'] = resolved.offsetX;
      style['shadow-offsetY'] = resolved.offsetY;
      style['shadow-blur'] = resolved.blur;
      style['shadow-color'] = resolved.color;
      delete style['shadow'];
    }
  }

  // Radius
  if ('radius' in style && typeof style['radius'] === 'string') {
    const resolved = resolveRadius(style['radius'] as string, theme);
    if (typeof resolved === 'number') {
      style['radius'] = resolved;
    }
  }

  // Border width
  if ('border-width' in style && typeof style['border-width'] === 'string') {
    const resolved = resolveBorderWidth(
      style['border-width'] as string,
      theme,
    );
    if (typeof resolved === 'number') {
      style['border-width'] = resolved;
    }
  }

  return style;
}

// ---------------------------------------------------------------------------
// Theme defaults for unstyled elements
// ---------------------------------------------------------------------------

function isNodeLikeElement(type: string): boolean {
  return type === 'node' || type === 'box' || type === 'cell';
}

function isContainerLikeElement(type: string): boolean {
  return type === 'box' || type === 'cell';
}

function expandColorPalette(style: Record<string, string | number>): void {
  if (!('color' in style) || typeof style.color !== 'string') return;
  if ('background' in style) return; // user explicitly set background

  const hex = style.color as string;
  if (!hex.startsWith('#')) return; // only expand resolved HEX colors

  const palette = generateColorPalette(hex);
  style['background'] = palette.bg;
  if (!('border' in style)) {
    style['border'] = palette.border;
  }
  style['color'] = palette.fg;
}

function applyNodeDefaults(
  style: Record<string, string | number>,
  theme: DepixTheme,
): void {
  // ThemeNodeDefaults uses fill/stroke/cornerRadius;
  // map them to DSL style keys background/border/radius.
  if (!('background' in style) && theme.node?.fill) {
    style['background'] = theme.node.fill;
  }
  if (!('border' in style) && theme.node?.stroke) {
    style['border'] = theme.node.stroke;
  }
  if (!('radius' in style) && theme.node?.cornerRadius != null) {
    style['radius'] = theme.node.cornerRadius;
  }
}
