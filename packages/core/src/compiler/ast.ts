/**
 * DSL Abstract Syntax Tree (AST) types.
 *
 * The AST is the output of the parser and the input to compiler passes.
 * It preserves the semantic structure of the DSL source, including
 * layout primitives, visual elements, edges, and styling.
 */

// ---------------------------------------------------------------------------
// Source location for error reporting
// ---------------------------------------------------------------------------

export interface SourceLocation {
  line: number;
  column: number;
}

// ---------------------------------------------------------------------------
// Document-level types
// ---------------------------------------------------------------------------

export interface ASTDocument {
  directives: ASTDirective[];
  scenes: ASTBlock[];
}

export interface ASTDirective {
  key: string; // 'page', 'style', 'transition', 'data'
  value: string; // '16:9', 'dark', 'sketch', 'fade', dataset name
  body?: ASTNode[]; // @data block body (rows)
  loc: SourceLocation;
}

// ---------------------------------------------------------------------------
// AST Node — discriminated union
// ---------------------------------------------------------------------------

export type ASTNode = ASTBlock | ASTElement | ASTEdge;

// ---------------------------------------------------------------------------
// Layout blocks (flow, stack, grid, tree, group, layers, canvas)
// ---------------------------------------------------------------------------

export interface ASTBlock {
  kind: 'block';
  blockType: string; // 'flow', 'stack', 'grid', etc.
  props: Record<string, string | number>;
  children: ASTNode[];
  label?: string;
  id?: string; // #id
  style: Record<string, string | number>;
  slot?: string; // scene layout slot assignment ('header', 'body', 'main', etc.)
  loc: SourceLocation;
}

// ---------------------------------------------------------------------------
// Visual elements (node, box, label, list, badge, icon, divider, image, etc.)
// ---------------------------------------------------------------------------

export interface ASTElement {
  kind: 'element';
  elementType: string; // 'node', 'box', 'label', 'row', etc.
  label?: string; // primary text content
  id?: string; // #id
  props: Record<string, string | number>;
  style: Record<string, string | number>;
  flags: string[]; // 'bold', 'italic', 'header', etc.
  children: ASTNode[]; // nested elements (e.g., box can contain labels)
  items?: string[]; // list items for 'list' element
  values?: (string | number)[]; // row cell values (for table/data rows)
  slot?: string; // scene layout slot assignment ('header', 'body', 'main', etc.)
  loc: SourceLocation;
}

// ---------------------------------------------------------------------------
// Edge (connection between elements)
// ---------------------------------------------------------------------------

export interface ASTEdge {
  kind: 'edge';
  fromId: string;
  toId: string;
  edgeStyle: '->' | '-->' | '--' | '<->';
  label?: string;
  loc: SourceLocation;
}

// ---------------------------------------------------------------------------
// Parse error
// ---------------------------------------------------------------------------

export interface ParseError {
  message: string;
  line: number;
  column: number;
}

// ---------------------------------------------------------------------------
// Parse result
// ---------------------------------------------------------------------------

export interface ParseResult {
  ast: ASTDocument;
  errors: ParseError[];
}
