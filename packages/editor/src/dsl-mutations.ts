/**
 * DSL Mutation Functions
 *
 * Pure functions that transform DSL text through AST manipulation.
 * Each function follows the pattern: parse(dsl) → mutate AST → serialize(ast).
 * This guarantees the output is always valid DSL.
 */

import { parse, serialize, getLayoutDef, findSlotByRole, findRoleForSlot, resolveTargetSlot, PROMOTE_RULES } from '@depix/core';
import type { ASTDocument, ASTBlock, ASTElement, ASTNode, LayoutDef, DepixIR, IRScene, IRElement, IRContainer } from '@depix/core';

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
 * Change the layout property of a scene and redistribute children across new slots.
 *
 * Uses role-based mapping from layout-slots.ts:
 * 1. Group children by current slot
 * 2. Map each old slot's role → best matching slot in new layout
 * 3. Promote heading/stat to header when header role is newly introduced
 */
export function changeLayout(dsl: string, sceneIndex: number, newLayout: string): string {
  const { ast } = parse(dsl);
  const scene = ast.scenes[sceneIndex];
  if (!scene) return dsl;

  const oldLayout = typeof scene.props.layout === 'string' ? scene.props.layout : 'full';
  distributeSlots(scene, oldLayout, newLayout);
  scene.props.layout = newLayout;

  return serialize(ast);
}

// ---------------------------------------------------------------------------
// Slot distribution helpers
// ---------------------------------------------------------------------------

function setSlot(node: ASTNode, slotName: string): void {
  if (node.kind === 'element') (node as ASTElement).slot = slotName;
  else if (node.kind === 'block') (node as ASTBlock).slot = slotName;
}

function groupBySlot(scene: ASTBlock): Map<string, ASTNode[]> {
  const groups = new Map<string, ASTNode[]>();
  for (const child of scene.children) {
    if (child.kind === 'edge') continue;
    const slot = (child as { slot?: string }).slot ?? '__unslotted__';
    if (!groups.has(slot)) groups.set(slot, []);
    groups.get(slot)!.push(child);
  }
  return groups;
}

function mergeInto(map: Map<string, ASTNode[]>, key: string, nodes: ASTNode[]): void {
  if (!map.has(key)) map.set(key, []);
  map.get(key)!.push(...nodes);
}

function promoteToHeader(
  assignments: Map<string, ASTNode[]>,
  newDef: LayoutDef,
  headerSlotName: string,
): void {
  const promoteTypes = PROMOTE_RULES['header'];
  if (!promoteTypes) return;

  // Find the primary content slot to promote from
  const primarySlot = newDef.slots.find(s => s.role !== 'header');
  if (!primarySlot) return;

  const fromChildren = assignments.get(primarySlot.name);
  if (!fromChildren || fromChildren.length === 0) return;

  const promoteIdx = fromChildren.findIndex(
    c => c.kind === 'element' && promoteTypes.includes((c as ASTElement).elementType),
  );
  if (promoteIdx < 0) return;

  const [promoted] = fromChildren.splice(promoteIdx, 1);
  mergeInto(assignments, headerSlotName, [promoted]);
}

function distributeSlots(scene: ASTBlock, oldLayout: string, newLayout: string): void {
  const oldDef = getLayoutDef(oldLayout);
  const newDef = getLayoutDef(newLayout);

  if (!newDef) {
    // Unknown new layout → assign all to body
    for (const child of scene.children) {
      if (child.kind !== 'edge') setSlot(child, 'body');
    }
    return;
  }

  // 1. Group children by current slot
  const slotGroups = groupBySlot(scene);

  // 2. Role-based mapping: old slot → new slot
  const assignments = new Map<string, ASTNode[]>();
  for (const [oldSlotName, children] of slotGroups) {
    const effectiveSlotName = oldSlotName === '__unslotted__' ? undefined : oldSlotName;
    const oldRole = (effectiveSlotName && oldDef)
      ? (findRoleForSlot(oldDef, effectiveSlotName) ?? 'primary')
      : 'primary';
    const targetSlot = resolveTargetSlot(oldRole, newDef);
    const target = targetSlot ?? newDef.slots[0]?.name ?? 'body';
    mergeInto(assignments, target, children);
  }

  // 3. Promote heading/stat to header if header role is newly introduced
  const oldHasHeader = oldDef?.slots.some(s => s.role === 'header') ?? false;
  const newHeaderSlot = findSlotByRole(newDef, 'header');
  if (!oldHasHeader && newHeaderSlot) {
    promoteToHeader(assignments, newDef, newHeaderSlot.name);
  }

  // 4. Apply slot assignments to AST nodes
  for (const [slotName, children] of assignments) {
    for (const child of children) {
      setSlot(child, slotName);
    }
  }
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

/**
 * Change the block type of a slotted block container.
 * Finds the block child assigned to the given slot and changes its blockType.
 * Children are preserved; only the container type keyword changes.
 */
export function changeSlotBlockType(
  dsl: string,
  sceneIndex: number,
  slotName: string,
  newBlockType: string,
): string {
  const { ast } = parse(dsl);
  const scene = ast.scenes[sceneIndex];
  if (!scene) return dsl;

  const target = scene.children.find(
    (c) => c.kind === 'block' && (c as ASTBlock).slot === slotName,
  ) as ASTBlock | undefined;

  if (!target) return dsl;
  target.blockType = newBlockType;
  return serialize(ast);
}

/**
 * Add a child to a block or element container within a slot.
 * Unlike addSlotContent (slot-level), this adds inside the container's children.
 */
export function addBlockChild(
  dsl: string,
  sceneIndex: number,
  slotName: string,
  content: string,
): string {
  const { ast } = parse(dsl);
  const scene = ast.scenes[sceneIndex];
  if (!scene) return dsl;

  const target = scene.children.find((c) => {
    if (c.kind === 'block') return (c as ASTBlock).slot === slotName;
    if (c.kind === 'element') return (c as ASTElement).slot === slotName;
    return false;
  });
  if (!target) return dsl;

  const fragment = parse(`scene { ${content} }`);
  const nodes = fragment.ast.scenes[0]?.children ?? [];

  if (target.kind === 'block') {
    (target as ASTBlock).children.push(...nodes);
  } else if (target.kind === 'element') {
    (target as ASTElement).children.push(...nodes);
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
// Element type mutations
// ---------------------------------------------------------------------------

/**
 * Change an element's DSL type (e.g. heading → stat).
 * The element's label and other properties are preserved.
 */
export function changeElementType(dsl: string, sceneIndex: number, elementIndex: number, newType: string): string {
  const { ast } = parse(dsl);
  const el = findElementByIndex(ast, sceneIndex, elementIndex);
  if (!el) return dsl;
  el.elementType = newType;
  return serialize(ast);
}

/**
 * Wrap a slot's direct children in a new block container.
 * e.g. `header: heading "A"` → `header: flow { heading "A" }`
 */
export function wrapSlotInBlock(dsl: string, sceneIndex: number, slotName: string, blockType: string): string {
  const { ast } = parse(dsl);
  const scene = ast.scenes[sceneIndex];
  if (!scene) return dsl;

  const slotChildren = scene.children.filter((c) => {
    if (c.kind === 'element') return (c as ASTElement).slot === slotName;
    if (c.kind === 'block') return (c as ASTBlock).slot === slotName;
    return false;
  });
  if (slotChildren.length === 0) return dsl;

  // Remove slot assignment from children (moves to the wrapper block)
  for (const child of slotChildren) {
    if (child.kind === 'element') delete (child as ASTElement).slot;
    else if (child.kind === 'block') delete (child as ASTBlock).slot;
  }

  // Remove slot children from scene
  scene.children = scene.children.filter((c) => !slotChildren.includes(c));

  // Wrap in new block
  const newBlock: ASTBlock = {
    kind: 'block',
    blockType,
    slot: slotName,
    props: {},
    children: slotChildren as ASTNode[],
    label: undefined,
    style: {},
    loc: { line: 0, column: 0 },
  };
  scene.children.push(newBlock);
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

// ---------------------------------------------------------------------------
// IR→AST target resolution (elementId-based)
// ---------------------------------------------------------------------------

interface ASTTarget {
  node: ASTNode;
  parent: ASTBlock;
  childIndex: number;
}

/**
 * Resolve an IR element ID to its corresponding AST node + parent.
 *
 * Walks the IR tree and AST tree in parallel using positional matching.
 * The raw AST (from parse) may not have slot assignments, so we match
 * IR scene-slot containers to AST children by order, not by slot name.
 */
function resolveASTTarget(
  scene: ASTBlock,
  irScene: IRScene,
  elementId: string,
): ASTTarget | undefined {
  // IR scene.elements: scene-background (skip) + scene-slot containers
  // AST scene.children: blocks/elements in order (edges excluded)
  const astChildren = scene.children.filter(c => c.kind !== 'edge');
  const irSlots = irScene.elements.filter(
    e => e.type === 'container' && e.origin?.sourceType === 'scene-slot',
  ) as IRContainer[];

  // Positional matching: IR slot[i] ↔ AST child[i]
  const len = Math.min(irSlots.length, astChildren.length);
  for (let i = 0; i < len; i++) {
    const irSlot = irSlots[i];
    const astChild = astChildren[i];

    // Check if the slot container itself matches
    if (irSlot.id === elementId) {
      const idx = scene.children.indexOf(astChild);
      return { node: astChild, parent: scene, childIndex: idx };
    }

    // Search inside: IR slot children ↔ AST block/element children
    const astInner = astChild.kind === 'block'
      ? (astChild as ASTBlock).children.filter(c => c.kind !== 'edge')
      : [];
    const result = matchIRToAST(irSlot.children, astInner, elementId, astChild as ASTBlock);
    if (result) return result;
  }

  return undefined;
}

function matchIRToAST(
  irElements: IRElement[],
  astNodes: ASTNode[],
  elementId: string,
  parent: ASTBlock,
): ASTTarget | undefined {
  // Filter IR elements: skip scene-background, edges
  const irFiltered = irElements.filter(
    e => e.origin?.sourceType !== 'scene-background' && e.type !== 'edge',
  );

  let astIdx = 0;
  for (const irEl of irFiltered) {
    const astNode = astNodes[astIdx];
    if (!astNode) break;

    if (irEl.id === elementId) {
      const childIndex = parent.children.indexOf(astNode);
      return { node: astNode, parent, childIndex: childIndex >= 0 ? childIndex : astIdx };
    }

    // Recurse into containers
    if (irEl.type === 'container' && astNode.kind === 'block') {
      const irChildren = (irEl as IRContainer).children;
      const astChildren = (astNode as ASTBlock).children.filter(c => c.kind !== 'edge');
      const result = matchIRToAST(irChildren, astChildren, elementId, astNode as ASTBlock);
      if (result) return result;
    }

    astIdx++;
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// ElementId-based mutations
// ---------------------------------------------------------------------------

/**
 * Add a child element/block to a container identified by IR element ID.
 * Works at any depth in the AST tree.
 */
export function addChild(
  dsl: string,
  sceneIndex: number,
  parentId: string,
  content: string,
  ir: DepixIR,
): string {
  const { ast } = parse(dsl);
  const scene = ast.scenes[sceneIndex];
  if (!scene) return dsl;

  const irScene = ir.scenes[sceneIndex];
  if (!irScene) return dsl;

  const target = resolveASTTarget(scene, irScene, parentId);
  if (!target) return dsl;

  const parentNode = target.node;
  if (parentNode.kind !== 'block') return dsl;

  const fragment = parse(`scene { ${content} }`);
  const nodes = fragment.ast.scenes[0]?.children ?? [];
  (parentNode as ASTBlock).children.push(...nodes);

  return serialize(ast);
}

/**
 * Add a sibling element/block after the element identified by IR element ID.
 * Works at any depth in the AST tree.
 */
export function addSibling(
  dsl: string,
  sceneIndex: number,
  targetId: string,
  content: string,
  ir: DepixIR,
): string {
  const { ast } = parse(dsl);
  const scene = ast.scenes[sceneIndex];
  if (!scene) return dsl;

  const irScene = ir.scenes[sceneIndex];
  if (!irScene) return dsl;

  const target = resolveASTTarget(scene, irScene, targetId);
  if (!target) return dsl;

  const fragment = parse(`scene { ${content} }`);
  const nodes = fragment.ast.scenes[0]?.children ?? [];
  target.parent.children.splice(target.childIndex + 1, 0, ...nodes);

  return serialize(ast);
}
