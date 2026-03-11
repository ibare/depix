/**
 * AST → DSL Serializer
 *
 * Converts an ASTDocument back into DSL source text.
 * This is the inverse of parse(): parse(serialize(ast)) ≈ ast (semantic equivalence).
 *
 * Formatting rules:
 * - 2-space indentation
 * - Directives first, then scenes
 * - Scene/block order preserved
 * - Properties on separate lines inside braces
 */

import type {
  ASTDocument,
  ASTDirective,
  ASTNode,
  ASTBlock,
  ASTElement,
  ASTEdge,
} from './ast.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Serialize an ASTDocument into DSL source text.
 */
export function serialize(ast: ASTDocument): string {
  const lines: string[] = [];

  // Directives
  for (const directive of ast.directives) {
    lines.push(serializeDirective(directive));
  }

  // Blank line between directives and scenes
  if (ast.directives.length > 0 && ast.scenes.length > 0) {
    lines.push('');
  }

  // Scenes
  for (let i = 0; i < ast.scenes.length; i++) {
    if (i > 0) lines.push('');
    const scene = ast.scenes[i];
    lines.push(serializeBlock(scene, 0));
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Directive serialization
// ---------------------------------------------------------------------------

function serializeDirective(d: ASTDirective): string {
  if (d.key === 'overrides' && d.body) {
    return serializeOverridesDirective(d);
  }

  if (d.key === 'data' && d.body) {
    const header = d.value ? `@data "${escapeString(d.value)}"` : '@data';
    const bodyLines = d.body.map(node => {
      if (node.kind === 'element') {
        const el = node as ASTElement;
        if (el.values) {
          return '  ' + el.values.map(v => typeof v === 'string' ? `"${escapeString(v)}"` : String(v)).join(' ');
        }
      }
      return '';
    }).filter(Boolean);
    return `${header} {\n${bodyLines.join('\n')}\n}`;
  }

  if (d.value) {
    return `@${d.key} ${d.value}`;
  }
  return `@${d.key}`;
}

function serializeOverridesDirective(d: ASTDirective): string {
  if (!d.body || d.body.length === 0) {
    return '@overrides {}';
  }

  const entries = d.body.map(node => {
    if (node.kind !== 'element') return '';
    const el = node as ASTElement;
    if (!el.id) return '';
    const props = serializePropsInline(el.props);
    return `  #${el.id} { ${props} }`;
  }).filter(Boolean);

  return `@overrides {\n${entries.join('\n')}\n}`;
}

// ---------------------------------------------------------------------------
// Block serialization
// ---------------------------------------------------------------------------

function serializeBlock(block: ASTBlock, depth: number): string {
  const indent = '  '.repeat(depth);
  const parts: string[] = [block.blockType];

  if (block.label) {
    parts.push(`"${escapeString(block.label)}"`);
  }
  if (block.id) {
    parts.push(`#${block.id}`);
  }

  // Inline props (before brace)
  const inlineProps = serializeInlineProps(block.props, block.style);
  if (inlineProps) {
    parts.push(inlineProps);
  }

  let header = parts.join(' ');
  if (block.slot) {
    header = `${block.slot}: ${header}`;
  }

  // Block body
  if (block.blockType === 'table' || block.blockType === 'chart') {
    return serializeDataBlock(block, depth, header);
  }

  const bodyLines = serializeBlockBody(block, depth + 1);

  if (bodyLines.length === 0) {
    return `${indent}${header} {}`;
  }

  return `${indent}${header} {\n${bodyLines.join('\n')}\n${indent}}`;
}

function serializeDataBlock(block: ASTBlock, depth: number, header: string): string {
  const indent = '  '.repeat(depth);
  if (block.children.length === 0) {
    if (block.label) return `${indent}${header}`;
    return `${indent}${header} {}`;
  }

  const rows = block.children.map(node => {
    if (node.kind === 'element' && (node as ASTElement).values) {
      const el = node as ASTElement;
      const cells = el.values!.map(v => typeof v === 'string' ? `"${escapeString(v)}"` : String(v));
      return `${'  '.repeat(depth + 1)}${cells.join(' ')}`;
    }
    return '';
  }).filter(Boolean);

  return `${indent}${header} {\n${rows.join('\n')}\n${indent}}`;
}

function serializeBlockBody(block: ASTBlock, depth: number): string[] {
  const lines: string[] = [];
  const indent = '  '.repeat(depth);

  // Scene-level props (layout, title, etc.)
  if (block.blockType === 'scene') {
    for (const [key, value] of Object.entries(block.props)) {
      lines.push(`${indent}${key}: ${serializePropValue(value)}`);
    }
    for (const [key, value] of Object.entries(block.style)) {
      lines.push(`${indent}${key}: ${serializePropValue(value)}`);
    }
  }

  for (const child of block.children) {
    lines.push(serializeNode(child, depth));
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Node serialization (dispatcher)
// ---------------------------------------------------------------------------

function serializeNode(node: ASTNode, depth: number): string {
  switch (node.kind) {
    case 'block':
      return serializeBlock(node as ASTBlock, depth);
    case 'element':
      return serializeElement(node as ASTElement, depth);
    case 'edge':
      return serializeEdge(node as ASTEdge, depth);
  }
}

// ---------------------------------------------------------------------------
// Element serialization
// ---------------------------------------------------------------------------

function serializeElement(el: ASTElement, depth: number): string {
  const indent = '  '.repeat(depth);
  const parts: string[] = [el.elementType];

  // Block child (e.g., heading flow { ... })
  if (el.children.length === 1 && el.children[0].kind === 'block' && !el.label && !el.id) {
    return `${indent}${el.elementType} ${serializeBlock(el.children[0] as ASTBlock, 0).trim()}`;
  }

  if (el.label !== undefined) {
    parts.push(`"${escapeString(el.label)}"`);
  }
  if (el.id) {
    parts.push(`#${el.id}`);
  }

  // Flags (before brace)
  for (const flag of el.flags) {
    parts.push(flag);
  }

  // List items
  if (el.items && el.items.length > 0) {
    const items = el.items.map(i => `"${escapeString(i)}"`).join(', ');
    parts.push(`[${items}]`);
  }

  // Props/style/children in brace block
  const hasProps = Object.keys(el.props).length > 0;
  const hasStyle = Object.keys(el.style).length > 0;
  const hasChildren = el.children.length > 0;
  const hasBraceContent = hasProps || hasStyle || hasChildren;

  const slot = el.slot;
  let header = parts.join(' ');
  if (slot) {
    header = `${slot}: ${header}`;
  }

  if (!hasBraceContent) {
    return `${indent}${header}`;
  }

  const innerLines: string[] = [];
  const innerIndent = '  '.repeat(depth + 1);

  for (const [key, value] of Object.entries(el.props)) {
    innerLines.push(`${innerIndent}${key}: ${serializePropValue(value)}`);
  }
  for (const [key, value] of Object.entries(el.style)) {
    innerLines.push(`${innerIndent}${key}: ${serializePropValue(value)}`);
  }
  for (const child of el.children) {
    innerLines.push(serializeNode(child, depth + 1));
  }

  return `${indent}${header} {\n${innerLines.join('\n')}\n${indent}}`;
}

// ---------------------------------------------------------------------------
// Edge serialization
// ---------------------------------------------------------------------------

function serializeEdge(edge: ASTEdge, depth: number): string {
  const indent = '  '.repeat(depth);
  let result = `${indent}#${edge.fromId} ${edge.edgeStyle} #${edge.toId}`;
  if (edge.label) {
    result += ` "${escapeString(edge.label)}"`;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Property helpers
// ---------------------------------------------------------------------------

function serializeInlineProps(
  props: Record<string, string | number>,
  style: Record<string, string | number>,
): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(props)) {
    parts.push(`${key}:${serializePropValue(value)}`);
  }
  for (const [key, value] of Object.entries(style)) {
    parts.push(`${key}:${serializePropValue(value)}`);
  }
  return parts.join(' ');
}

function serializePropsInline(props: Record<string, string | number>): string {
  return Object.entries(props)
    .map(([key, value]) => `${key}: ${serializePropValue(value)}`)
    .join(', ');
}

function serializePropValue(value: string | number): string {
  if (typeof value === 'number') return String(value);
  // If value looks like a keyword (no spaces, no special chars), emit bare
  if (/^[a-zA-Z_][a-zA-Z0-9_-]*(\(.*\))?$/.test(value)) return value;
  // Hex colors
  if (/^#[0-9a-fA-F]+$/.test(value)) return value;
  // Numeric strings
  if (/^[0-9]+(\.[0-9]+)?$/.test(value)) return value;
  // Compound like "2xl"
  if (/^[0-9]+[a-zA-Z]+$/.test(value)) return value;
  // Otherwise quote it
  return `"${escapeString(value)}"`;
}

function escapeString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}
