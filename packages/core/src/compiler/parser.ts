/**
 * DSL Parser
 *
 * Converts a token stream into an AST (Abstract Syntax Tree).
 * Handles layout blocks, visual elements, edges, directives, scenes,
 * inline styles, and nested structures.
 */

import type { Token, TokenType } from './tokenizer.js';
import { tokenize } from './tokenizer.js';
import type {
  ASTDocument,
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
    const scenes: ASTBlock[] = [];
    const implicitChildren: ASTNode[] = [];

    this.skipNewlines();

    while (!this.isAtEnd()) {
      const tok = this.current();

      if (tok.type === 'DIRECTIVE') {
        directives.push(this.parseDirective());
        this.skipNewlines();
        continue;
      }

      // Explicit scene block at top level
      if (tok.type === 'BLOCK_TYPE' && tok.value === 'scene') {
        const block = this.parseBlock();
        scenes.push(block);
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
        kind: 'block',
        blockType: 'scene',
        props: {},
        children: implicitChildren,
        style: {},
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

    // @data "name" { ... } — block-body directive
    if (key === 'data') {
      let value = '';
      if (this.check('STRING')) {
        value = this.advance().value;
      }
      this.skipNewlines();
      let body: ASTNode[] | undefined;
      if (this.check('BRACE_OPEN')) {
        body = this.parseDataBody();
      }
      return { key, value, body, loc };
    }

    // @overrides { #id { x:10, y:20, w:30, h:40 } ... }
    if (key === 'overrides') {
      this.skipNewlines();
      let body: ASTNode[] | undefined;
      if (this.check('BRACE_OPEN')) {
        body = this.parseOverridesBody();
      }
      return { key, value: '', body, loc };
    }

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

    // Dispatch block body parsing based on block type
    let children: ASTNode[];
    if (blockType === 'table' || blockType === 'chart') {
      // table/chart: brace block parsed as data rows
      if (this.check('BRACE_OPEN')) {
        children = this.parseDataBody();
      } else {
        children = []; // reference mode: table "sales" (no brace block)
      }
    } else if (blockType === 'scene' || blockType === 'box' || blockType === 'layer') {
      children = [];
      if (this.check('BRACE_OPEN')) {
        this.parsePropBlock(props, style, [], children);
      } else if (blockType === 'scene') {
        this.error('Expected {', this.current());
      }
    } else {
      children = this.parseBraceBlock();
    }

    return { kind: 'block', blockType, props, children, label, id, style, loc };
  }

  // ---- Element (visual element) -------------------------------------------

  private parseElement(): ASTElement {
    const tok = this.expect('ELEMENT_TYPE');
    const loc = { line: tok.line, column: tok.column };
    const elementType = tok.value;

    // Block as child content: e.g., `heading flow { ... }`, `bullet table { ... }`
    if (this.check('BLOCK_TYPE')) {
      const childBlock = this.parseBlock();
      return {
        kind: 'element',
        elementType,
        label: undefined,
        id: undefined,
        props: {},
        style: {},
        flags: [],
        children: [childBlock],
        items: undefined,
        loc,
      };
    }

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

  // ---- Data body { "col1" "col2" \n val1 val2 \n ... } --------------------

  /**
   * Parse a data body block: { ... } containing rows of STRING/NUMBER values.
   * Each line becomes an ASTElement with elementType 'row' and values[].
   * The first row is automatically marked with props.header = 1.
   */
  private parseDataBody(): ASTNode[] {
    this.advance(); // {
    this.skipNewlines();
    const rows: ASTNode[] = [];
    let isFirstRow = true;

    while (!this.isAtEnd() && !this.check('BRACE_CLOSE')) {
      const rowValues: (string | number)[] = [];
      const rowLoc = { line: this.current().line, column: this.current().column };

      // Collect STRING/NUMBER tokens until newline or block end
      while (
        !this.isAtEnd() &&
        !this.check('NEWLINE') &&
        !this.check('BRACE_CLOSE') &&
        !this.check('EOF')
      ) {
        const t = this.current();
        if (t.type === 'STRING') {
          rowValues.push(t.value);
          this.advance();
        } else if (t.type === 'NUMBER') {
          rowValues.push(Number(t.value));
          this.advance();
        } else {
          break;
        }
      }

      if (rowValues.length > 0) {
        const rowProps: Record<string, string | number> = {};
        if (isFirstRow) {
          rowProps.header = 1;
          isFirstRow = false;
        }
        rows.push({
          kind: 'element',
          elementType: 'row',
          props: rowProps,
          style: {},
          flags: [],
          children: [],
          values: rowValues,
          loc: rowLoc,
        } as ASTElement);
      }

      this.skipNewlines();
    }

    if (this.check('BRACE_CLOSE')) {
      this.advance();
    } else {
      this.error('Unclosed data block', this.current());
    }

    return rows;
  }

  // ---- Overrides body { #id { x:10, y:20 } ... } -------------------------

  /**
   * Parse an @overrides block body: { #id { key: value, ... } ... }
   * Each override entry becomes an ASTElement with elementType 'override',
   * id from the hash, and override values stored in props.
   */
  private parseOverridesBody(): ASTNode[] {
    this.advance(); // {
    this.skipNewlines();
    const entries: ASTNode[] = [];

    while (!this.isAtEnd() && !this.check('BRACE_CLOSE')) {
      if (this.check('HASH')) {
        const hashTok = this.advance();
        const id = hashTok.value;
        const loc = { line: hashTok.line, column: hashTok.column };

        const props: Record<string, string | number> = {};
        this.skipNewlines();

        if (this.check('BRACE_OPEN')) {
          this.advance(); // {
          this.skipNewlines();

          while (!this.isAtEnd() && !this.check('BRACE_CLOSE')) {
            if (
              this.check('IDENTIFIER') ||
              this.check('ELEMENT_TYPE') ||
              this.check('BLOCK_TYPE') ||
              this.check('FLAG')
            ) {
              const key = this.advance().value;
              if (this.check('COLON')) {
                this.advance(); // :
                const value = this.parsePropertyValue();
                props[key] = value;
              }
            } else {
              this.error(`Unexpected token in override block: ${this.current().type}`, this.current());
              this.advance();
            }
            this.skipComma();
            this.skipNewlines();
          }

          if (this.check('BRACE_CLOSE')) {
            this.advance(); // }
          } else {
            this.error('Unclosed override entry block', this.current());
          }
        }

        entries.push({
          kind: 'element',
          elementType: 'override',
          id,
          label: undefined,
          props,
          style: {},
          flags: [],
          children: [],
          loc,
        } as ASTElement);
      } else {
        this.error(`Expected #id in @overrides block, got ${this.current().type}`, this.current());
        this.advance();
      }
      this.skipNewlines();
    }

    if (this.check('BRACE_CLOSE')) {
      this.advance(); // }
    } else {
      this.error('Unclosed @overrides block', this.current());
    }

    return entries;
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

      // Flag — or slot syntax: header: heading "Title"
      if (tok.type === 'FLAG') {
        const nextTok = this.tokens[this.pos + 1];
        if (nextTok && nextTok.type === 'COLON') {
          const key = this.advance().value;
          this.advance(); // :
          if (this.parseSlotChild(key, children)) {
            this.skipNewlines();
            continue;
          }
          // Not a slot — parse as property value
          const value = this.parsePropertyValue();
          if (STYLE_KEYS.has(key)) {
            style[key] = value;
          } else {
            props[key] = value;
          }
          this.skipComma();
          this.skipNewlines();
          continue;
        }
        flags.push(this.advance().value);
        this.skipComma();
        this.skipNewlines();
        continue;
      }

      // Nested element (or property with element-type name, e.g. `label: "value"`)
      // Also handles slot syntax: cell: heading "Title"
      if (tok.type === 'ELEMENT_TYPE') {
        // Look ahead: if followed by COLON, parse as property key or slot
        const nextTok = this.tokens[this.pos + 1];
        if (nextTok && nextTok.type === 'COLON') {
          const key = this.advance().value;
          this.advance(); // :
          if (this.parseSlotChild(key, children)) {
            this.skipNewlines();
            continue;
          }
          const value = this.parsePropertyValue();
          if (STYLE_KEYS.has(key)) {
            style[key] = value;
          } else {
            props[key] = value;
          }
          this.skipComma();
          this.skipNewlines();
          continue;
        }
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

      // Property: key: value — OR slot assignment: slotName: element/block
      if (tok.type === 'IDENTIFIER') {
        const key = this.advance().value;
        if (this.check('COLON')) {
          this.advance(); // :
          if (this.parseSlotChild(key, children)) {
            this.skipNewlines();
            continue;
          }
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

  // ---- Slot child parsing (shared by IDENTIFIER, ELEMENT_TYPE, FLAG) ------

  /**
   * After consuming `key:`, try to parse a slot-assigned element or block.
   * Returns true if a slot child was parsed, false if the caller should
   * fall through to property-value parsing.
   *
   * ELEMENT_TYPE → always a slot (elements don't need `{}`).
   * BLOCK_TYPE   → slot only if followed by a token that starts a block
   *                declaration (STRING, HASH, IDENTIFIER, BRACE_OPEN, etc.),
   *                not a line-ending token (NEWLINE, COMMA, BRACE_CLOSE, EOF)
   *                which would indicate a bare property value like `layout: grid`.
   */
  private parseSlotChild(slotName: string, children: ASTNode[]): boolean {
    if (this.check('ELEMENT_TYPE')) {
      const el = this.parseElement();
      el.slot = slotName;
      children.push(el);
      return true;
    }
    if (this.check('BLOCK_TYPE')) {
      const afterBlock = this.tokens[this.pos + 1];
      const isPropertyValue =
        !afterBlock ||
        afterBlock.type === 'NEWLINE' ||
        afterBlock.type === 'COMMA' ||
        afterBlock.type === 'BRACE_CLOSE' ||
        afterBlock.type === 'EOF';
      if (!isPropertyValue) {
        const block = this.parseBlock();
        block.slot = slotName;
        children.push(block);
        return true;
      }
    }
    return false;
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
