/**
 * Apply Overrides Pass (post-processing)
 *
 * Extracts @overrides directives from the AST and applies them to the
 * compiled IR. This is a post-processing step that runs after the full
 * compile pipeline (parse → flatten → theme → emit) has completed.
 *
 * Override values are absolute positions in the 0-100 coordinate space.
 */

import type { ASTDocument, ASTElement } from '../ast.js';
import type { DepixIR, IRElement, IRContainer } from '../../ir/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OverrideEntry {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export type OverrideMap = Map<string, OverrideEntry>;

// ---------------------------------------------------------------------------
// Extract overrides from AST
// ---------------------------------------------------------------------------

/**
 * Extract override entries from @overrides directives in the AST.
 *
 * Each @overrides directive body contains ASTElements with elementType 'override',
 * id as the target element ID, and x/y/w/h values in props.
 */
export function extractOverrides(ast: ASTDocument): OverrideMap {
  const map: OverrideMap = new Map();

  for (const directive of ast.directives) {
    if (directive.key !== 'overrides' || !directive.body) continue;

    for (const node of directive.body) {
      if (node.kind !== 'element' || (node as ASTElement).elementType !== 'override') continue;
      const el = node as ASTElement;
      if (!el.id) continue;

      const entry: OverrideEntry = {};
      if (typeof el.props.x === 'number') entry.x = el.props.x;
      if (typeof el.props.y === 'number') entry.y = el.props.y;
      if (typeof el.props.w === 'number') entry.w = el.props.w;
      if (typeof el.props.h === 'number') entry.h = el.props.h;

      // Merge with existing entry (later @overrides blocks win for same keys)
      const existing = map.get(el.id);
      if (existing) {
        map.set(el.id, { ...existing, ...entry });
      } else {
        map.set(el.id, entry);
      }
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Apply overrides to IR
// ---------------------------------------------------------------------------

/**
 * Apply override values to IR element bounds.
 *
 * Walks all elements (including nested container children) and updates
 * bounds for elements whose ID matches an override entry.
 * Returns a new IR object (shallow copy of scenes).
 */
export function applyOverridesToIR(ir: DepixIR, overrides: OverrideMap): DepixIR {
  if (overrides.size === 0) return ir;

  return {
    ...ir,
    scenes: ir.scenes.map(scene => ({
      ...scene,
      elements: scene.elements.map(el => applyToElement(el, overrides)),
    })),
  };
}

function applyToElement(element: IRElement, overrides: OverrideMap): IRElement {
  const override = overrides.get(element.id);

  let result = element;
  if (override) {
    result = {
      ...element,
      bounds: {
        x: override.x ?? element.bounds.x,
        y: override.y ?? element.bounds.y,
        w: override.w ?? element.bounds.w,
        h: override.h ?? element.bounds.h,
      },
    };
  }

  // Recurse into container children
  if (result.type === 'container') {
    const container = result as IRContainer;
    return {
      ...container,
      children: container.children.map(child => applyToElement(child, overrides)),
    };
  }

  return result;
}
