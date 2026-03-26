/**
 * Scene Emission — Meta & Transitions
 *
 * Builds the IRMeta (aspect ratio, background, style) and IRTransition[]
 * from AST directives.
 */

import type {
  IRMeta,
  IRScene,
  IRTransition,
} from '../../ir/types.js';
import type { DepixTheme } from '../../theme/types.js';
import type { SceneTheme } from '../../theme/scene-theme.js';
import type { ASTDirective } from '../ast.js';

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export function buildSceneMeta(
  directives: ASTDirective[],
  theme: DepixTheme,
  sceneTheme: SceneTheme,
): IRMeta {
  let aspectRatio = { width: 16, height: 9 };
  let drawingStyle: 'default' | 'sketch' = 'default';

  let autoHeight = false;

  for (const d of directives) {
    // @ratio and @page are both valid aspect ratio directives
    if (d.key === 'ratio' || d.key === 'page') {
      if (d.value === '*') {
        // @page * — content-driven height; scene h computed per scene
        autoHeight = true;
        continue;
      }
      const parts = d.value.split(':');
      if (parts.length === 2) {
        const w = parseInt(parts[0], 10);
        const h = parseInt(parts[1], 10);
        if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
          aspectRatio = { width: w, height: h };
        }
      }
    }
    if (d.key === 'style' && (d.value === 'default' || d.value === 'sketch')) {
      drawingStyle = d.value;
    }
  }

  return {
    aspectRatio,
    background: { type: 'solid', color: theme.background ?? sceneTheme.colors.background },
    drawingStyle,
    ...(autoHeight && { autoHeight: true }),
  };
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

const VALID_TRANSITION_TYPES: readonly string[] = [
  'fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down',
  'zoom-in', 'zoom-out',
];

export function buildSceneTransitions(
  directives: ASTDirective[],
  scenes: IRScene[],
): IRTransition[] {
  if (scenes.length < 2) return [];

  let transitionType: IRTransition['type'] = 'fade';
  for (const d of directives) {
    if (d.key === 'transition' && VALID_TRANSITION_TYPES.includes(d.value)) {
      transitionType = d.value as IRTransition['type'];
    }
  }

  const transitions: IRTransition[] = [];
  for (let i = 0; i < scenes.length - 1; i++) {
    transitions.push({
      from: scenes[i].id,
      to: scenes[i + 1].id,
      type: transitionType,
      duration: 300,
      easing: 'ease-in-out',
    });
  }
  return transitions;
}
