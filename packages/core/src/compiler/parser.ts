/**
 * DSL v2 Parser
 *
 * Converts a token stream into an AST (Abstract Syntax Tree).
 * Handles layout blocks, visual elements, edges, directives, scenes,
 * inline styles, and nested structures.
 */

import type { Token, TokenType } from './tokenizer.js';
import { tokenize } from './tokenizer.js';
import type {
  ASTDocument,
  ASTScene,
  ASTDirective,
  ASTNode,
  ASTBlock,
  ASTElement,
  ASTEdge,
  ParseError,
  ParseResult,
} from './ast.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parse(input: string): ParseResult {
  const { tokens, errors: tokenErrors } = tokenize(input);
  const parser = new Parser(tokens);
  const result = parser.parse();
  result.errors = [...tokenErrors.map(e => ({ message: e.message, line: e.line, column: e.column })), ...result.errors];
  return result;
}

// ---------------------------------------------------------------------------
// Style property names (keys that go into style rather than props)
// ---------------------------------------------------------------------------

const STYLE_KEYS = new Set([
  'background',
  'color',
  'border',
  'border-width',
  'border-style',
  'shadow',
  'radius',
  'opacity',
  'font-size',
  'font-weight',
]);

// ---------------------------------------------------------------------------
// Parser implementation
// ---------------------------------------------------------------------------

class Parser {
  private tokens: Token[];
  private pos = 0;
  private errors: ParseError[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): ParseResult {
    const doc = this.parseDocument();
    return { ast: doc, errors: this.errors };
  }

  // ---- Document -----------------------------------------------------------

  private parseDocument(): ASTDocument {
    const directives: ASTDirective[] = [];
    const scenes: ASTScene[] = [];
    const implicitChildren: ASTNode[] = [];

    this.skipNewlines();

    while (!this.isAtEnd()) {
      const tok = this.current();

      if (tok.type === 'DIRECTIVE') {
        directives.push(this.parseDirective());
        this.skipNewlines();
        continue;
      }

      if (tok.type === 'SCENE') {
        scenes.push(this.parseScene());
        this.skipNewlines();
        continue;
      }

      // Everything else is an implicit scene child
      const node = this.parseNode();
      if (node) {
        if (Array.isArray(node)) {
          implicitChildren.push(...node);
        } else {
          implicitChildren.push(node);
        }
      }
      this.skipNewlines();
    }

    // If there are no explicit scenes, wrap implicit children in one
    if (scenes.length === 0 && implicitChildren.length > 0) {
      scenes.push({
        name: null,
        children: implicitChildren,
        loc: { line: 1, column: 1 },
      });
    }

    return { directives, scenes };
  }

  // ---- Directive ----------------------------------------------------------

  private parseDirective(): ASTDirective {
    const tok = this.expect('DIRECTIVE');
    const loc = { line: tok.line, column: tok.column };
    const key = tok.value;

    // Collect value tokens until newline or EOF
    const valueParts: string[] = [];
    while (!this.isAtEnd() && !this.check('NEWLINE') && !this.check('EOF')) {
      const vt = this.current();
      if (vt.type === 'COLON') {
        valueParts.push(':');
      } else {
        valueParts.push(vt.value);
      }
      this.advance();
    }

    return { key, value: valueParts.join(''), loc };
  }

  // ---- Scene --------------------------------------------------------------

  private parseScene(): ASTScene {
    const sceneTok = this.expect('SCENE');
    const loc = { line: sceneTok.line, column: sceneTok.column };

    let name: string | null = null;
    if (this.check('STRING')) {
      name = this.advance().value;
    }

    this.skipNewlines();
    const children = this.parseBraceBlock();

    return { name, children, loc };
  }

  // ---- Node dispatcher ----------------------------------------------------

  /**
   * Parse one or more AST nodes at the current position.
   * Returns a single node, an array (for chained edges), or null if nothing parseable.
   */
  private parseNode(): ASTNode | ASTNode[] | null {
    this.skipNewlines();
    if (this.isAtEnd()) return null;

    const tok = this.current();

    if (tok.type === 'BLOCK_TYPE') {
      return this.parseBlock();
    }

    if (tok.type === 'ELEMENT_TYPE') {
      return this.parseElement();
    }

    // Edge declaration: #id -> #id ...
    if (tok.type === 'HASH') {
      return this.parseEdgeChain();
    }

    // Unknown token — skip and report
    this.error(`Unexpected token: ${tok.type} '${tok.value}'`, tok);
    this.advance();
    return null;
  }

  // ---- Block (layout primitive) -------------------------------------------

  private parseBlock(): ASTBlock {
    const tok = this.expect('BLOCK_TYPE');
    const loc = { line: tok.line, column: tok.column };
    const blockType = tok.value;

    // Inline label
    let label: string | undefined;
    if (this.check('STRING')) {
      label = this.advance().value;
    }

    // Optional #id
    let id: string | undefined;
    if (this.check('HASH')) {
      id = this.advance().value;
    }

    // Inline properties (before brace): direction:right gap:md
    const { props, style } = this.parseInlineProps();

    this.skipNewlines();

    // Brace block
    const children = this.parseBraceBlock();

    return { kind: 'block', blockType, props, children, label, id, style, loc };
  }

  // ---- Element (visual element) -------------------------------------------

  private parseElement(): ASTElement {
    const tok = this.expect('ELEMENT_TYPE');
    const loc = { line: tok.line, column: tok.column };
    const elementType = tok.value;

    // Optional label (string)
    let label: string | undefined;
    if (this.check('STRING')) {
      label = this.advance().value;
    }

    // Optional #id
    let id: string | undefined;
    if (this.check('HASH')) {
      id = this.advance().value;
    }

    // Optional flags before brace/bracket (e.g., `list ordered [...]`)
    const flags: string[] = [];
    while (this.check('FLAG')) {
      flags.push(this.advance().value);
    }

    // List items: [ "item1", "item2" ]
    let items: string[] | undefined;
    if (this.check('BRACKET_OPEN')) {
      items = this.parseListItems();
    }

    // Props/style/flags/children from brace block
    const props: Record<string, string | number> = {};
    const style: Record<string, string | number> = {};
    const children: ASTNode[] = [];

    if (this.check('BRACE_OPEN')) {
      this.parsePropBlock(props, style, flags, children);
    }

    return {
      kind: 'element',
      elementType,
      label,
      id,
      props,
      style,
      flags,
      children,
      items,
      loc,
    };
  }

  // ---- Edge chain (#a -> #b -> #c "label") --------------------------------

  private parseEdgeChain(): ASTEdge[] {
    const edges: ASTEdge[] = [];

    let fromTok = this.expect('HASH');
    const loc = { line: fromTok.line, column: fromTok.column };

    while (this.check('ARROW')) {
      const arrowTok = this.advance();
      const edgeStyle = arrowTok.value as ASTEdge['edgeStyle'];

      if (!this.check('HASH')) {
        this.error('Expected #id after arrow', this.current());
        break;
      }
      const toTok = this.advance();

      // Optional label
      let edgeLabel: string | undefined;
      if (this.check('STRING')) {
        edgeLabel = this.advance().value;
      }

      edges.push({
        kind: 'edge',
        fromId: fromTok.value,
        toId: toTok.value,
        edgeStyle,
        label: edgeLabel,
        loc: { line: fromTok.line, column: fromTok.column },
      });

      // For chaining: the `to` becomes `from` for the next edge
      fromTok = toTok;
    }

    if (edges.length === 0) {
      // Lone #id with no arrow — this is unusual, skip it
      this.error(`Unexpected lone #${fromTok.value} without arrow`, fromTok);
    }

    return edges;
  }

  // ---- Brace block { ... } ------------------------------------------------

  private parseBraceBlock(): ASTNode[] {
    const children: ASTNode[] = [];

    if (!this.check('BRACE_OPEN')) {
      this.error('Expected {', this.current());
      return children;
    }
    this.advance(); // {
    this.skipNewlines();

    while (!this.isAtEnd() && !this.check('BRACE_CLOSE')) {
      const node = this.parseNode();
      if (node) {
        if (Array.isArray(node)) {
          children.push(...node);
        } else {
          children.push(node);
        }
      }
      this.skipNewlines();
    }

    if (this.check('BRACE_CLOSE')) {
      this.advance(); // }
    } else {
      this.error('Unclosed brace block', this.current());
    }

    return children;
  }

  // ---- Property block { key: value, flag, ... } with nested elements ------

  private parsePropBlock(
    props: Record<string, string | number>,
    style: Record<string, string | number>,
    flags: string[],
    children: ASTNode[],
  ): void {
    this.advance(); // {
    this.skipNewlines();

    while (!this.isAtEnd() && !this.check('BRACE_CLOSE')) {
      const tok = this.current();

      // Flag
      if (tok.type === 'FLAG') {
        flags.push(this.advance().value);
        this.skipComma();
        this.skipNewlines();
        continue;
      }

      // Nested element
      if (tok.type === 'ELEMENT_TYPE') {
        children.push(this.parseElement());
        this.skipNewlines();
        continue;
      }

      // Nested block
      if (tok.type === 'BLOCK_TYPE') {
        children.push(this.parseBlock());
        this.skipNewlines();
        continue;
      }

      // Edge declaration inside block
      if (tok.type === 'HASH') {
        const edges = this.parseEdgeChain();
        children.push(...edges);
        this.skipNewlines();
        continue;
      }

      // Property: key: value
      if (tok.type === 'IDENTIFIER') {
        const key = this.advance().value;
        if (this.check('COLON')) {
          this.advance(); // :
          const value = this.parsePropertyValue();
          if (STYLE_KEYS.has(key)) {
            style[key] = value;
          } else {
            props[key] = value;
          }
        } else {
          // Bare identifier — treat as a flag-like prop
          props[key] = true as unknown as string;
        }
        this.skipComma();
        this.skipNewlines();
        continue;
      }

      // Unknown — skip
      this.error(`Unexpected token in property block: ${tok.type} '${tok.value}'`, tok);
      this.advance();
      this.skipNewlines();
    }

    if (this.check('BRACE_CLOSE')) {
      this.advance(); // }
    } else {
      this.error('Unclosed property block', this.current());
    }
  }

  // ---- Inline properties (before brace) -----------------------------------

  private parseInlineProps(): {
    props: Record<string, string | number>;
    style: Record<string, string | number>;
  } {
    const props: Record<string, string | number> = {};
    const style: Record<string, string | number> = {};

    // Parse key:value pairs appearing before { or newline
    while (
      !this.isAtEnd() &&
      !this.check('BRACE_OPEN') &&
      !this.check('NEWLINE') &&
      !this.check('EOF')
    ) {
      if (this.check('IDENTIFIER')) {
        const key = this.advance().value;
        if (this.check('COLON')) {
          this.advance(); // :
          const value = this.parsePropertyValue();
          if (STYLE_KEYS.has(key)) {
            style[key] = value;
          } else {
            props[key] = value;
          }
        } else {
          // Bare identifier as prop
          props[key] = true as unknown as string;
          break;
        }
      } else {
        break;
      }
    }

    return { props, style };
  }

  // ---- Property value parsing ---------------------------------------------

  private parsePropertyValue(): string | number {
    const tok = this.current();

    // String value
    if (tok.type === 'STRING') {
      this.advance();
      return tok.value;
    }

    // Number value
    if (tok.type === 'NUMBER') {
      this.advance();
      // Check for compound like 2xl (number + identifier with no space between)
      if (this.check('IDENTIFIER')) {
        const next = this.current();
        // Only combine if tokens are adjacent (e.g., "2xl", not "10 y")
        const tokEnd = tok.column + tok.value.length;
        if (next.column === tokEnd) {
          this.advance();
          return tok.value + next.value;
        }
      }
      const num = Number(tok.value);
      return isNaN(num) ? tok.value : num;
    }

    // Hash value (hex color)
    if (tok.type === 'HASH') {
      this.advance();
      return '#' + tok.value;
    }

    // Identifier value (semantic color, keyword, etc.)
    if (
      tok.type === 'IDENTIFIER' ||
      tok.type === 'ELEMENT_TYPE' ||
      tok.type === 'BLOCK_TYPE' ||
      tok.type === 'FLAG'
    ) {
      this.advance();

      // Check for gradient(...)
      if (this.check('PAREN_OPEN')) {
        return this.parseGradientValue(tok.value);
      }

      return tok.value;
    }

    // Fallback
    this.advance();
    return tok.value;
  }

  // ---- Gradient value: gradient(direction, color1, color2) ----------------

  private parseGradientValue(funcName: string): string {
    this.advance(); // (
    const parts: string[] = [funcName + '('];

    while (!this.isAtEnd() && !this.check('PAREN_CLOSE')) {
      const tok = this.current();
      if (tok.type === 'COMMA') {
        parts.push(', ');
        this.advance();
      } else if (tok.type === 'HASH') {
        parts.push('#' + tok.value);
        this.advance();
      } else {
        parts.push(tok.value);
        this.advance();
      }
    }

    if (this.check('PAREN_CLOSE')) {
      this.advance(); // )
    }
    parts.push(')');

    return parts.join('');
  }

  // ---- List items [ "a", "b", "c" ] ---------------------------------------

  private parseListItems(): string[] {
    const items: string[] = [];
    this.advance(); // [
    this.skipNewlines();

    while (!this.isAtEnd() && !this.check('BRACKET_CLOSE')) {
      if (this.check('STRING')) {
        items.push(this.advance().value);
      } else {
        // Non-string item — include as-is
        items.push(this.advance().value);
      }
      this.skipComma();
      this.skipNewlines();
    }

    if (this.check('BRACKET_CLOSE')) {
      this.advance(); // ]
    } else {
      this.error('Unclosed list bracket', this.current());
    }

    return items;
  }

  // ---- Token helpers ------------------------------------------------------

  private current(): Token {
    return this.tokens[this.pos] ?? { type: 'EOF', value: '', line: 0, column: 0 };
  }

  private check(type: TokenType): boolean {
    return this.current().type === type;
  }

  private advance(): Token {
    const tok = this.current();
    if (this.pos < this.tokens.length) {
      this.pos++;
    }
    return tok;
  }

  private expect(type: TokenType): Token {
    const tok = this.current();
    if (tok.type !== type) {
      this.error(`Expected ${type}, got ${tok.type} '${tok.value}'`, tok);
    }
    return this.advance();
  }

  private isAtEnd(): boolean {
    return this.current().type === 'EOF';
  }

  private skipNewlines(): void {
    while (this.check('NEWLINE')) {
      this.advance();
    }
  }

  private skipComma(): void {
    if (this.check('COMMA')) {
      this.advance();
    }
  }

  private error(message: string, tok: Token): void {
    this.errors.push({ message, line: tok.line, column: tok.column });
  }
}
