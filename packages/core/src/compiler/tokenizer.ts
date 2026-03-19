/**
 * DSL Tokenizer
 *
 * Converts DSL source text into a stream of tokens.
 * The tokenizer is context-free — it does not track brace depth or other state.
 * Contextual interpretation (e.g., HASH as ID vs. hex color) is left to the parser.
 */

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

export type TokenType =
  // Structural
  | 'BRACE_OPEN'
  | 'BRACE_CLOSE'
  | 'BRACKET_OPEN'
  | 'BRACKET_CLOSE'
  | 'PAREN_OPEN'
  | 'PAREN_CLOSE'
  | 'COLON'
  | 'COMMA'
  | 'NEWLINE'
  | 'EOF'
  // Keywords
  | 'BLOCK_TYPE'
  | 'ELEMENT_TYPE'
  | 'FLAG'
  // Directive
  | 'DIRECTIVE'
  // Literals
  | 'STRING'
  | 'NUMBER'
  | 'IDENTIFIER'
  // Special
  | 'HASH'
  | 'ARROW';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export interface TokenizerError {
  message: string;
  line: number;
  column: number;
}

export interface TokenizeResult {
  tokens: Token[];
  errors: TokenizerError[];
}

// ---------------------------------------------------------------------------
// Keyword sets
// ---------------------------------------------------------------------------

export const BLOCK_TYPES = new Set([
  'flow',
  'stack',
  'grid',
  'tree',
  'group',
  'layers',
  'canvas',
  'scene',
  'column',
  'table',
  'chart',
  'box',
  'layer',
]);

export const ELEMENT_TYPES = new Set([
  'node',
  'label',
  'list',
  'badge',
  'icon',
  'divider',
  'image',
  'cell',
  'rect',
  'circle',
  'line',
  'text',
  'heading',
  'bullet',
  'stat',
  'quote',
  'item',
  'step',
]);

export const FLAGS = new Set([
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'center',
  'outline',
  'header',
  'ordered',
]);

const DIRECTIVES = new Set(['page', 'style', 'transition', 'lane', 'presentation', 'theme', 'ratio', 'data', 'overrides']);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function tokenize(input: string): TokenizeResult {
  return new Tokenizer(input).tokenize();
}

// ---------------------------------------------------------------------------
// Tokenizer implementation
// ---------------------------------------------------------------------------

class Tokenizer {
  private readonly input: string;
  private pos = 0;
  private line = 1;
  private column = 1;
  private tokens: Token[] = [];
  private errors: TokenizerError[] = [];

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): TokenizeResult {
    while (!this.isAtEnd()) {
      this.skipInlineWhitespace();
      if (this.isAtEnd()) break;

      const ch = this.peek();

      // Line comment
      if (ch === '/' && this.peekAt(1) === '/') {
        this.skipLineComment();
        continue;
      }

      // Newline
      if (ch === '\n') {
        this.emit('NEWLINE', '\n');
        this.advance();
        continue;
      }

      // Carriage return (silently consumed; \r\n emits one NEWLINE via \n)
      if (ch === '\r') {
        this.advance();
        continue;
      }

      // String literal
      if (ch === '"') {
        this.readString();
        continue;
      }

      // Directive
      if (ch === '@') {
        this.readDirective();
        continue;
      }

      // Hash (ID reference or hex color — parser decides)
      if (ch === '#') {
        this.readHash();
        continue;
      }

      // Single-character structural tokens
      if (ch === '{') {
        this.emit('BRACE_OPEN', '{');
        this.advance();
        continue;
      }
      if (ch === '}') {
        this.emit('BRACE_CLOSE', '}');
        this.advance();
        continue;
      }
      if (ch === '[') {
        this.emit('BRACKET_OPEN', '[');
        this.advance();
        continue;
      }
      if (ch === ']') {
        this.emit('BRACKET_CLOSE', ']');
        this.advance();
        continue;
      }
      if (ch === '(') {
        this.emit('PAREN_OPEN', '(');
        this.advance();
        continue;
      }
      if (ch === ')') {
        this.emit('PAREN_CLOSE', ')');
        this.advance();
        continue;
      }
      if (ch === ':') {
        this.emit('COLON', ':');
        this.advance();
        continue;
      }
      if (ch === ',') {
        this.emit('COMMA', ',');
        this.advance();
        continue;
      }

      // Arrow operators ( -> --> -- <-> )
      if (ch === '<' || ch === '-') {
        if (this.tryReadArrow()) continue;
      }

      // Number literal
      if (this.isDigit(ch)) {
        this.readNumber();
        continue;
      }

      // Word (identifier or keyword)
      if (this.isIdentStart(ch)) {
        this.readWord();
        continue;
      }

      // Unknown character — report and skip
      this.errors.push({
        message: `Unexpected character: '${ch}'`,
        line: this.line,
        column: this.column,
      });
      this.advance();
    }

    this.emit('EOF', '');
    return { tokens: this.tokens, errors: this.errors };
  }

  // ---- Character helpers ------------------------------------------------

  private peek(): string {
    return this.input[this.pos] ?? '';
  }

  private peekAt(offset: number): string {
    return this.input[this.pos + offset] ?? '';
  }

  private advance(): string {
    const ch = this.input[this.pos] ?? '';
    this.pos++;
    if (ch === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return ch;
  }

  private isAtEnd(): boolean {
    return this.pos >= this.input.length;
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isIdentStart(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
  }

  private isIdentChar(ch: string): boolean {
    return this.isIdentStart(ch) || this.isDigit(ch) || ch === '-';
  }

  // ---- Token emission ---------------------------------------------------

  private emit(type: TokenType, value: string): void {
    this.tokens.push({
      type,
      value,
      line: this.line,
      column: this.column,
    });
  }

  // ---- Whitespace / comments --------------------------------------------

  private skipInlineWhitespace(): void {
    while (!this.isAtEnd()) {
      const ch = this.peek();
      if (ch === ' ' || ch === '\t') {
        this.advance();
      } else {
        break;
      }
    }
  }

  private skipLineComment(): void {
    // skip the two slashes
    this.advance();
    this.advance();
    // consume until newline (but leave the newline for the main loop)
    while (!this.isAtEnd() && this.peek() !== '\n') {
      this.advance();
    }
  }

  // ---- Multi-character token readers ------------------------------------

  private readString(): void {
    const startLine = this.line;
    const startCol = this.column;
    this.advance(); // opening "

    let value = '';
    while (!this.isAtEnd() && this.peek() !== '"') {
      if (this.peek() === '\\') {
        this.advance(); // consume backslash
        if (this.isAtEnd()) {
          value += '\\';
          break;
        }
        switch (this.peek()) {
          case '"':
            value += '"';
            this.advance();
            break;
          case '\\':
            value += '\\';
            this.advance();
            break;
          case 'n':
            value += '\n';
            this.advance();
            break;
          case 't':
            value += '\t';
            this.advance();
            break;
          default:
            // Unknown escape — keep backslash + char
            value += '\\' + this.advance();
            break;
        }
      } else {
        value += this.advance();
      }
    }

    if (this.isAtEnd()) {
      this.errors.push({
        message: 'Unterminated string',
        line: startLine,
        column: startCol,
      });
    } else {
      this.advance(); // closing "
    }

    this.tokens.push({
      type: 'STRING',
      value,
      line: startLine,
      column: startCol,
    });
  }

  private readDirective(): void {
    const startLine = this.line;
    const startCol = this.column;
    this.advance(); // @

    let name = '';
    while (!this.isAtEnd() && this.isIdentChar(this.peek())) {
      name += this.advance();
    }

    if (!name) {
      this.errors.push({
        message: 'Expected directive name after @',
        line: startLine,
        column: startCol,
      });
      return;
    }

    if (!DIRECTIVES.has(name)) {
      this.errors.push({
        message: `Unknown directive: @${name}`,
        line: startLine,
        column: startCol,
      });
    }

    this.tokens.push({
      type: 'DIRECTIVE',
      value: name,
      line: startLine,
      column: startCol,
    });
  }

  private readHash(): void {
    const startLine = this.line;
    const startCol = this.column;
    this.advance(); // #

    let value = '';
    while (!this.isAtEnd() && this.isIdentChar(this.peek())) {
      value += this.advance();
    }

    if (!value) {
      this.errors.push({
        message: 'Expected identifier after #',
        line: startLine,
        column: startCol,
      });
      return;
    }

    this.tokens.push({
      type: 'HASH',
      value,
      line: startLine,
      column: startCol,
    });
  }

  /**
   * Attempts to read an arrow operator. Returns true if successful.
   * Arrow precedence: <-> > --> > -> > --
   */
  private tryReadArrow(): boolean {
    const startLine = this.line;
    const startCol = this.column;

    // <->
    if (
      this.peek() === '<' &&
      this.peekAt(1) === '-' &&
      this.peekAt(2) === '>'
    ) {
      this.tokens.push({
        type: 'ARROW',
        value: '<->',
        line: startLine,
        column: startCol,
      });
      this.advance();
      this.advance();
      this.advance();
      return true;
    }

    // -->
    if (
      this.peek() === '-' &&
      this.peekAt(1) === '-' &&
      this.peekAt(2) === '>'
    ) {
      this.tokens.push({
        type: 'ARROW',
        value: '-->',
        line: startLine,
        column: startCol,
      });
      this.advance();
      this.advance();
      this.advance();
      return true;
    }

    // ->
    if (this.peek() === '-' && this.peekAt(1) === '>') {
      this.tokens.push({
        type: 'ARROW',
        value: '->',
        line: startLine,
        column: startCol,
      });
      this.advance();
      this.advance();
      return true;
    }

    // -- (must be followed by whitespace, #, newline, or EOF)
    if (this.peek() === '-' && this.peekAt(1) === '-') {
      const after = this.peekAt(2);
      if (
        !after ||
        after === ' ' ||
        after === '\t' ||
        after === '\n' ||
        after === '\r' ||
        after === '#'
      ) {
        this.tokens.push({
          type: 'ARROW',
          value: '--',
          line: startLine,
          column: startCol,
        });
        this.advance();
        this.advance();
        return true;
      }
    }

    return false;
  }

  private readNumber(): void {
    const startLine = this.line;
    const startCol = this.column;
    let value = '';

    while (!this.isAtEnd() && this.isDigit(this.peek())) {
      value += this.advance();
    }

    // Decimal part
    if (
      !this.isAtEnd() &&
      this.peek() === '.' &&
      this.isDigit(this.peekAt(1))
    ) {
      value += this.advance(); // .
      while (!this.isAtEnd() && this.isDigit(this.peek())) {
        value += this.advance();
      }
    }

    this.tokens.push({
      type: 'NUMBER',
      value,
      line: startLine,
      column: startCol,
    });
  }

  private readWord(): void {
    const startLine = this.line;
    const startCol = this.column;
    let value = '';

    while (!this.isAtEnd() && this.isIdentChar(this.peek())) {
      value += this.advance();
    }

    // Classify the word
    let type: TokenType;
    if (BLOCK_TYPES.has(value)) {
      type = 'BLOCK_TYPE';
    } else if (ELEMENT_TYPES.has(value)) {
      type = 'ELEMENT_TYPE';
    } else if (FLAGS.has(value)) {
      type = 'FLAG';
    } else {
      type = 'IDENTIFIER';
    }

    this.tokens.push({ type, value, line: startLine, column: startCol });
  }
}
