/**
 * DSL Mutation Functions
 *
 * Pure functions that transform DSL text through AST manipulation.
 * Each function follows the pattern: parse(dsl) → mutate AST → serialize(ast).
 * This guarantees the output is always valid DSL.
 */

import { parse, serialize } from '@depix/core';
import type { ASTDocument, ASTBlock, ASTElement, ASTNode } from '@depix/core';

// ---------------------------------------------------------------------------
// Scene mutations
// ---------------------------------------------------------------------------

/**
 * Add a new scene to the DSL.
 */
export function addScene(dsl: string, title: string): string {
  const { ast } = parse(dsl);
  const newScene: ASTBlock = {
    kind: 'block',
    blockType: 'scene',
    props: {},
    children: [],
    label: title,
    style: {},
    loc: { line: 0, column: 0 },
  };
  ast.scenes.push(newScene);
  return serialize(ast);
}

/**
 * Change a scene's title.
 */
export function changeSceneTitle(dsl: string, sceneIndex: number, newTitle: string): string {
  const { ast } = parse(dsl);
  const scene = ast.scenes[sceneIndex];
  if (!scene) return dsl;
  scene.label = newTitle;
  return serialize(ast);
}

/**
 * Remove a scene by index.
 */
export function removeScene(dsl: string, sceneIndex: number): string {
  const { ast } = parse(dsl);
  if (sceneIndex < 0 || sceneIndex >= ast.scenes.length) return dsl;
  ast.scenes.splice(sceneIndex, 1);
  return serialize(ast);
}

/**
 * Reorder scenes by moving one from `fromIndex` to `toIndex`.
 */
export function reorderScenes(dsl: string, fromIndex: number, toIndex: number): string {
  const { ast } = parse(dsl);
  if (
    fromIndex < 0 || fromIndex >= ast.scenes.length ||
    toIndex < 0 || toIndex >= ast.scenes.length ||
    fromIndex === toIndex
  ) return dsl;

  const [scene] = ast.scenes.splice(fromIndex, 1);
  ast.scenes.splice(toIndex, 0, scene);
  return serialize(ast);
}

// ---------------------------------------------------------------------------
// Layout mutations
// ---------------------------------------------------------------------------

/**
 * Change the layout property of a scene.
 */
export function changeLayout(dsl: string, sceneIndex: number, newLayout: string): string {
  const { ast } = parse(dsl);
  const scene = ast.scenes[sceneIndex];
  if (!scene) return dsl;
  scene.props.layout = newLayout;
  return serialize(ast);
}

// ---------------------------------------------------------------------------
// Slot mutations
// ---------------------------------------------------------------------------

/**
 * Add content to a named slot in a scene.
 * The content string is parsed as a DSL fragment.
 */
export function addSlotContent(dsl: string, sceneIndex: number, slotName: string, content: string): string {
  const { ast } = parse(dsl);
  const scene = ast.scenes[sceneIndex];
  if (!scene) return dsl;

  // Parse the content fragment to get AST nodes
  const fragment = parse(content);
  const nodes = fragment.ast.scenes.length > 0 ? fragment.ast.scenes[0].children : [];

  // Assign the slot to each node
  for (const node of nodes) {
    if (node.kind === 'element') {
      (node as ASTElement).slot = slotName;
    } else if (node.kind === 'block') {
      (node as ASTBlock).slot = slotName;
    }
    scene.children.push(node);
  }

  return serialize(ast);
}

// ---------------------------------------------------------------------------
// Element mutations
// ---------------------------------------------------------------------------

/**
 * Change an element's text label.
 */
export function changeElementLabel(dsl: string, sceneIndex: number, elementIndex: number, newLabel: string): string {
  const { ast } = parse(dsl);
  const el = findElementByIndex(ast, sceneIndex, elementIndex);
  if (!el) return dsl;
  el.label = newLabel;
  return serialize(ast);
}

/**
 * Remove an element by its index within a scene's flattened element list.
 */
export function removeElement(dsl: string, sceneIndex: number, elementIndex: number): string {
  const { ast } = parse(dsl);
  const scene = ast.scenes[sceneIndex];
  if (!scene) return dsl;

  const elements = collectElements(scene.children);
  if (elementIndex < 0 || elementIndex >= elements.length) return dsl;

  const target = elements[elementIndex];
  removeNodeFromParent(scene.children, target);
  return serialize(ast);
}

/**
 * Change a style property on an element.
 */
export function changeElementStyle(dsl: string, sceneIndex: number, elementIndex: number, key: string, value: string): string {
  const { ast } = parse(dsl);
  const el = findElementByIndex(ast, sceneIndex, elementIndex);
  if (!el) return dsl;
  el.style[key] = value;
  return serialize(ast);
}

// ---------------------------------------------------------------------------
// Override mutations
// ---------------------------------------------------------------------------

/**
 * Add or update an @overrides entry for an element.
 */
export function upsertOverride(dsl: string, elementId: string, bounds: Partial<{ x: number; y: number; w: number; h: number }>): string {
  const { ast } = parse(dsl);

  // Find or create @overrides directive
  let directive = ast.directives.find(d => d.key === 'overrides');
  if (!directive) {
    directive = { key: 'overrides', value: '', body: [], loc: { line: 0, column: 0 } };
    ast.directives.push(directive);
  }
  if (!directive.body) {
    directive.body = [];
  }

  // Find existing entry for this element
  const existing = directive.body.find(
    n => n.kind === 'element' && (n as ASTElement).elementType === 'override' && (n as ASTElement).id === elementId,
  ) as ASTElement | undefined;

  if (existing) {
    // Update existing entry
    if (bounds.x !== undefined) existing.props.x = bounds.x;
    if (bounds.y !== undefined) existing.props.y = bounds.y;
    if (bounds.w !== undefined) existing.props.w = bounds.w;
    if (bounds.h !== undefined) existing.props.h = bounds.h;
  } else {
    // Create new entry
    const props: Record<string, string | number> = {};
    if (bounds.x !== undefined) props.x = bounds.x;
    if (bounds.y !== undefined) props.y = bounds.y;
    if (bounds.w !== undefined) props.w = bounds.w;
    if (bounds.h !== undefined) props.h = bounds.h;

    directive.body.push({
      kind: 'element',
      elementType: 'override',
      id: elementId,
      label: undefined,
      props,
      style: {},
      flags: [],
      children: [],
      loc: { line: 0, column: 0 },
    } as ASTElement);
  }

  return serialize(ast);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function collectElements(nodes: ASTNode[]): ASTElement[] {
  const result: ASTElement[] = [];
  for (const node of nodes) {
    if (node.kind === 'element') {
      result.push(node as ASTElement);
    } else if (node.kind === 'block') {
      result.push(...collectElements((node as ASTBlock).children));
    }
  }
  return result;
}

function findElementByIndex(ast: ASTDocument, sceneIndex: number, elementIndex: number): ASTElement | undefined {
  const scene = ast.scenes[sceneIndex];
  if (!scene) return undefined;
  const elements = collectElements(scene.children);
  return elements[elementIndex];
}

function removeNodeFromParent(children: ASTNode[], target: ASTNode): boolean {
  const idx = children.indexOf(target);
  if (idx >= 0) {
    children.splice(idx, 1);
    return true;
  }
  for (const child of children) {
    if (child.kind === 'block') {
      if (removeNodeFromParent((child as ASTBlock).children, target)) return true;
    }
  }
  return false;
}
