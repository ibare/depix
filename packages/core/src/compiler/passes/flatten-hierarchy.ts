/**
 * Compiler Pass — Flatten Hierarchy
 *
 * Normalizes nested element structures within connection-based layout blocks
 * (tree, flow) into flat children lists with implicit edges.
 *
 * This pass runs before resolveTheme and transforms the AST in-place
 * semantics (returns a new AST). It is a no-op for containment-based
 * layouts (stack, grid, group, layers, canvas).
 *
 * Example transformation for tree:
 *   tree { node "A" { node "B", node "C" } }
 *   → tree { node "A" #_t0, node "B" #_t1, node "C" #_t2,
 *            #_t0 -> #_t1, #_t0 -> #_t2 }
 */

import type {
  ASTDocument,
  ASTNode,
  ASTBlock,
  ASTElement,
  ASTEdge,
  SourceLocation,
} from '../ast.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function flattenHierarchy(ast: ASTDocument): ASTDocument {
  return {
    directives: ast.directives,
    scenes: ast.scenes.map(flattenDiagram),
  };
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function flattenDiagram(scene: ASTBlock): ASTBlock {
  return {
    ...scene,
    children: scene.children.map(flattenNode),
  };
}

function flattenNode(node: ASTNode): ASTNode {
  if (node.kind === 'block') {
    return flattenBlock(node);
  }
  return node;
}

function flattenBlock(block: ASTBlock): ASTBlock {
  if (isConnectionLayout(block.blockType) && hasNestedElements(block)) {
    return flattenConnectionBlock(block);
  }

  // For non-connection blocks, recurse into children (they may contain
  // nested connection blocks)
  return {
    ...block,
    children: block.children.map(flattenNode),
  };
}

// ---------------------------------------------------------------------------
// Connection layout detection
// ---------------------------------------------------------------------------

/**
 * Returns true for layout types where nesting implies edge connections
 * rather than visual containment.
 */
function isConnectionLayout(blockType: string): boolean {
  return blockType === 'tree' || blockType === 'flow';
}

/**
 * Returns true if the block has any element children with their own
 * element children (nested hierarchy). If all elements are leaves
 * or edges already exist, no flattening is needed.
 */
function hasNestedElements(block: ASTBlock): boolean {
  for (const child of block.children) {
    if (child.kind === 'element' && hasElementChildren(child)) {
      return true;
    }
  }
  return false;
}

function hasElementChildren(element: ASTElement): boolean {
  return element.children.some(c => c.kind === 'element');
}

// ---------------------------------------------------------------------------
// Flatten connection block
// ---------------------------------------------------------------------------

function flattenConnectionBlock(block: ASTBlock): ASTBlock {
  const flatNodes: ASTElement[] = [];
  const implicitEdges: ASTEdge[] = [];
  const existingEdges: ASTEdge[] = [];
  let autoIdCounter = 0;

  // Collect existing edges (explicit declarations)
  for (const child of block.children) {
    if (child.kind === 'edge') {
      existingEdges.push(child);
    }
  }

  // Recursively flatten element hierarchy
  function collectElements(element: ASTElement, parentId: string | null): void {
    // Ensure the element has an id
    const id = element.id ?? `_t${autoIdCounter++}`;

    // Create a flattened copy without nested element children
    const flatElement: ASTElement = {
      ...element,
      id,
      children: element.children.filter(c => c.kind !== 'element'),
    };
    flatNodes.push(flatElement);

    // Create implicit edge from parent
    if (parentId !== null) {
      implicitEdges.push({
        kind: 'edge',
        fromId: parentId,
        toId: id,
        edgeStyle: '->',
        loc: element.loc,
      });
    }

    // Recurse into element children
    for (const child of element.children) {
      if (child.kind === 'element') {
        collectElements(child, id);
      }
    }
  }

  // Process each top-level child
  for (const child of block.children) {
    if (child.kind === 'element') {
      collectElements(child, null);
    }
    // Blocks nested inside connection blocks are kept as-is (edge case)
    // Edges are collected separately above
  }

  // Preserve any nested blocks as-is
  const nestedBlocks: ASTNode[] = block.children
    .filter(c => c.kind === 'block')
    .map(flattenNode);

  return {
    ...block,
    children: [
      ...flatNodes,
      ...nestedBlocks,
      ...existingEdges,
      ...implicitEdges,
    ],
  };
}
