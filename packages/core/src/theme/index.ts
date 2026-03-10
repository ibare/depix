/**
 * Theme System -- types, built-in themes, and resolvers.
 *
 * @module @depix/core/theme
 */

// Re-export all theme type definitions
export type {
  DepixTheme,
  NamedColor,
  SemanticBorderWidth,
  SemanticColor,
  SemanticFontSize,
  SemanticRadius,
  SemanticShadow,
  SemanticSpacing,
  ThemeEdgeDefaults,
  ThemeNodeDefaults,
} from './types.js';

// Re-export built-in themes
export { darkTheme, lightTheme } from './builtin-themes.js';

// Re-export scene theme
export type { SceneTheme } from './scene-theme.js';
export { defaultSceneTheme } from './scene-theme.js';

// Re-export resolver functions
export {
  isNamedColor,
  isSemanticColor,
  resolveBorderWidth,
  resolveColor,
  resolveFontSize,
  resolveRadius,
  resolveShadow,
  resolveSpacing,
} from './resolver.js';
