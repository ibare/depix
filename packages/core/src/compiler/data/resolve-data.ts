/**
 * Compiler Pass — Resolve Data
 *
 * Processes @data directives and resolves data references in table/chart blocks.
 *
 * Pipeline position: parse → **resolveData** → flattenHierarchy → resolveTheme → emit
 *
 * 1. Extracts DataMap from @data directives (name → { columns, rows })
 * 2. Walks AST: table/chart blocks with a label matching a DataMap key
 *    get their row children injected from the referenced DataSet.
 * 3. Inline table/chart blocks (with their own row children) pass through unchanged.
 * 4. @data directives are removed from the output (no longer needed downstream).
 */

import type {
  ASTDocument,
  ASTDirective,
  ASTBlock,
  ASTNode,
  ASTElement,
} from '../ast.js';
import type { DataMap, DataSet } from './data-types.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve @data directives and inject row children into referencing
 * table/chart blocks. Returns a new ASTDocument (original is not mutated).
 */
export function resolveData(ast: ASTDocument): ASTDocument {
  const dataMap = buildDataMap(ast.directives);
  const hasRefs = hasDataBlocks(ast.scenes);

  // Fast path: nothing to resolve
  if (dataMap.size === 0 && !hasRefs) return ast;

  const resolvedScenes = ast.scenes.map(scene => resolveBlockData(scene, dataMap));
  const remainingDirectives = ast.directives.filter(d => d.key !== 'data');

  return { directives: remainingDirectives, scenes: resolvedScenes };
}

// ---------------------------------------------------------------------------
// DataMap construction
// ---------------------------------------------------------------------------

function buildDataMap(directives: ASTDirective[]): DataMap {
  const map: DataMap = new Map();

  for (const d of directives) {
    if (d.key !== 'data' || !d.body || d.body.length === 0) continue;

    const id = d.value;
    if (!id) continue;

    const rows = d.body.filter(
      (n): n is ASTElement => n.kind === 'element' && n.elementType === 'row',
    );
    if (rows.length === 0) continue;

    // First row with header prop = column headers
    const headerRow = rows[0];
    const columns = (headerRow.values ?? []).map(v => String(v));

    const dataRows = rows.slice(1).map(r => ({
      values: r.values ?? [],
    }));

    map.set(id, { id, columns, rows: dataRows });
  }

  return map;
}

// ---------------------------------------------------------------------------
// AST walking — resolve data references
// ---------------------------------------------------------------------------

function resolveBlockData(block: ASTBlock, dataMap: DataMap): ASTBlock {
  const isDataBlock = block.blockType === 'table' || block.blockType === 'chart';

  // Reference mode: block has a label matching a DataMap key and no inline children
  if (isDataBlock && block.label && block.children.length === 0 && dataMap.has(block.label)) {
    const dataSet = dataMap.get(block.label)!;
    return { ...block, children: dataSetToRows(dataSet, block.loc) };
  }

  // Recurse into children
  const newChildren = block.children.map(child => {
    if (child.kind === 'block') return resolveBlockData(child, dataMap);
    return child;
  });

  if (newChildren === block.children) return block;
  return { ...block, children: newChildren };
}

/**
 * Convert a DataSet into ASTElement[] row nodes (header + data rows).
 */
function dataSetToRows(
  dataSet: DataSet,
  loc: { line: number; column: number },
): ASTNode[] {
  const rows: ASTNode[] = [];

  // Header row
  rows.push({
    kind: 'element',
    elementType: 'row',
    props: { header: 1 },
    style: {},
    flags: [],
    children: [],
    values: dataSet.columns,
    loc,
  } as ASTElement);

  // Data rows
  for (const row of dataSet.rows) {
    rows.push({
      kind: 'element',
      elementType: 'row',
      props: {},
      style: {},
      flags: [],
      children: [],
      values: row.values,
      loc,
    } as ASTElement);
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if any scenes contain table/chart blocks. */
function hasDataBlocks(scenes: ASTBlock[]): boolean {
  for (const scene of scenes) {
    if (hasDataBlocksInNode(scene)) return true;
  }
  return false;
}

function hasDataBlocksInNode(node: ASTNode): boolean {
  if (node.kind === 'block') {
    if (node.blockType === 'table' || node.blockType === 'chart') return true;
    return node.children.some(hasDataBlocksInNode);
  }
  return false;
}
