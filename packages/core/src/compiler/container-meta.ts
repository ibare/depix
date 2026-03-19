/**
 * Container type metadata — Single source of truth for container classification.
 *
 * Four categories:
 * - layout: user-facing, interchangeable via TypeGrid (flow, tree, grid, ...)
 * - content: user-facing, specific child structure (bullet, list)
 * - visual: styled containers with background/border/shadow (box, layer)
 * - internal: structural, not shown in picker (group, layers, canvas, scene)
 */

/** Layout block types — interchangeable, shown in TypeGrid. */
export const LAYOUT_TYPES = new Set([
  'flow', 'tree', 'grid', 'stack', 'table', 'chart',
] as const);

/** Content block types — specific child structure, no type switching. */
export const CONTENT_TYPES = new Set([
  'bullet', 'list',
] as const);

/** Visual container types — styled containers (background, border, shadow). */
export const VISUAL_CONTAINER_TYPES = new Set([
  'box', 'layer',
] as const);

/** Internal/structural container types — not shown in picker. */
export const INTERNAL_TYPES = new Set([
  'group', 'layers', 'canvas', 'scene',
] as const);

/** Whether a type should carry IROrigin.sourceType in emitted IR. */
export function isOriginSourceType(type: string): boolean {
  return (LAYOUT_TYPES as Set<string>).has(type)
    || (CONTENT_TYPES as Set<string>).has(type)
    || (VISUAL_CONTAINER_TYPES as Set<string>).has(type)
    || (INTERNAL_TYPES as Set<string>).has(type);
}

/** User-facing container types recognized by the picker as existing-block. */
export const PICKER_BLOCK_TYPES = new Set([
  ...LAYOUT_TYPES, ...CONTENT_TYPES, ...VISUAL_CONTAINER_TYPES,
] as const);

/** Atomic compound element types — editor treats them as single units (no internal selection). */
export const ATOMIC_COMPOUND_TYPES = new Set([
  'stat', 'quote', 'bullet', 'step',
] as const);
