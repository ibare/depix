import { describe, it, expect } from 'vitest';
import {
  tokenize,
  type Token,
  type TokenType,
  BLOCK_TYPES,
  ELEMENT_TYPES,
  FLAGS,
} from '../../src/compiler/tokenizer.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract token types (excluding EOF) */
function types(input: string): TokenType[] {
  return tokenize(input)
    .tokens.filter((t) => t.type !== 'EOF')
    .map((t) => t.type);
}

/** Extract token [type, value] pairs (excluding EOF and NEWLINE) */
function pairs(input: string): [TokenType, string][] {
  return tokenize(input)
    .tokens.filter((t) => t.type !== 'EOF' && t.type !== 'NEWLINE')
    .map((t) => [t.type, t.value]);
}

/** Get tokens excluding EOF */
function tokens(input: string): Token[] {
  return tokenize(input).tokens.filter((t) => t.type !== 'EOF');
}

// ===========================================================================
// Directives
// ===========================================================================

describe('Directives', () => {
  it.each(['page', 'style', 'transition', 'lane'])(
    'tokenizes @%s',
    (name) => {
      const result = tokenize(`@${name}`);
      const tok = result.tokens[0];
      expect(tok.type).toBe('DIRECTIVE');
      expect(tok.value).toBe(name);
      expect(result.errors).toHaveLength(0);
    },
  );

  it('tokenizes @page 16:9', () => {
    expect(pairs('@page 16:9')).toEqual([
      ['DIRECTIVE', 'page'],
      ['NUMBER', '16'],
      ['COLON', ':'],
      ['NUMBER', '9'],
    ]);
  });

  it('accepts @theme as a valid directive', () => {
    const result = tokenize('@theme dark');
    expect(result.errors.length).toBe(0);
    expect(pairs('@theme dark')).toEqual([
      ['DIRECTIVE', 'theme'],
      ['IDENTIFIER', 'dark'],
    ]);
  });

  it('tokenizes @style sketch', () => {
    expect(pairs('@style sketch')).toEqual([
      ['DIRECTIVE', 'style'],
      ['IDENTIFIER', 'sketch'],
    ]);
  });

  it('tokenizes @transition fade', () => {
    expect(pairs('@transition fade')).toEqual([
      ['DIRECTIVE', 'transition'],
      ['IDENTIFIER', 'fade'],
    ]);
  });

  it('reports error for unknown directive', () => {
    const result = tokenize('@unknown');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Unknown directive: @unknown');
    // Still emits token for error recovery
    expect(result.tokens[0].type).toBe('DIRECTIVE');
  });

  it('reports error for bare @', () => {
    const result = tokenize('@ ');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Expected directive name');
  });
});

// ===========================================================================
// Block types
// ===========================================================================

describe('Block types', () => {
  it.each([...BLOCK_TYPES])('tokenizes %s as BLOCK_TYPE', (keyword) => {
    const result = tokenize(keyword);
    expect(result.tokens[0].type).toBe('BLOCK_TYPE');
    expect(result.tokens[0].value).toBe(keyword);
  });
});

// ===========================================================================
// Element types
// ===========================================================================

describe('Element types', () => {
  it.each([...ELEMENT_TYPES])('tokenizes %s as ELEMENT_TYPE', (keyword) => {
    const result = tokenize(keyword);
    expect(result.tokens[0].type).toBe('ELEMENT_TYPE');
    expect(result.tokens[0].value).toBe(keyword);
  });
});

// ===========================================================================
// Flags
// ===========================================================================

describe('Flags', () => {
  it.each([...FLAGS])('tokenizes %s as FLAG', (keyword) => {
    const result = tokenize(keyword);
    expect(result.tokens[0].type).toBe('FLAG');
    expect(result.tokens[0].value).toBe(keyword);
  });
});

// ===========================================================================
// Scene keyword
// ===========================================================================

describe('Scene keyword', () => {
  it('tokenizes scene as BLOCK_TYPE', () => {
    const result = tokenize('scene');
    expect(result.tokens[0].type).toBe('BLOCK_TYPE');
    expect(result.tokens[0].value).toBe('scene');
  });

  it('tokenizes scene "name" {', () => {
    expect(pairs('scene "타이틀" {')).toEqual([
      ['BLOCK_TYPE', 'scene'],
      ['STRING', '타이틀'],
      ['BRACE_OPEN', '{'],
    ]);
  });
});

// ===========================================================================
// Strings
// ===========================================================================

describe('Strings', () => {
  it('tokenizes a simple string', () => {
    const result = tokenize('"hello"');
    expect(result.tokens[0].type).toBe('STRING');
    expect(result.tokens[0].value).toBe('hello');
  });

  it('tokenizes an empty string', () => {
    const result = tokenize('""');
    expect(result.tokens[0].type).toBe('STRING');
    expect(result.tokens[0].value).toBe('');
  });

  it('handles escape sequences', () => {
    const result = tokenize('"hello\\nworld"');
    expect(result.tokens[0].value).toBe('hello\nworld');
  });

  it('handles escaped quotes', () => {
    const result = tokenize('"say \\"hi\\""');
    expect(result.tokens[0].value).toBe('say "hi"');
  });

  it('handles escaped backslash', () => {
    const result = tokenize('"a\\\\b"');
    expect(result.tokens[0].value).toBe('a\\b');
  });

  it('handles tab escape', () => {
    const result = tokenize('"a\\tb"');
    expect(result.tokens[0].value).toBe('a\tb');
  });

  it('handles unknown escape by keeping backslash', () => {
    const result = tokenize('"a\\xb"');
    expect(result.tokens[0].value).toBe('a\\xb');
  });

  it('handles unicode content', () => {
    const result = tokenize('"H₂O → O₂"');
    expect(result.tokens[0].value).toBe('H₂O → O₂');
  });

  it('handles actual newline in string', () => {
    const result = tokenize('"line1\nline2"');
    expect(result.tokens[0].value).toBe('line1\nline2');
  });

  it('reports error for unterminated string', () => {
    const result = tokenize('"unterminated');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe('Unterminated string');
    // Still emits the partial string token
    expect(result.tokens[0].type).toBe('STRING');
    expect(result.tokens[0].value).toBe('unterminated');
  });

  it('captures correct position for string', () => {
    const result = tokenize('  "hi"');
    expect(result.tokens[0].line).toBe(1);
    expect(result.tokens[0].column).toBe(3);
  });
});

// ===========================================================================
// Hash (ID / hex color)
// ===========================================================================

describe('Hash tokens', () => {
  it('tokenizes #simple', () => {
    const result = tokenize('#simple');
    expect(result.tokens[0]).toMatchObject({ type: 'HASH', value: 'simple' });
  });

  it('tokenizes #with-dash', () => {
    const result = tokenize('#with-dash');
    expect(result.tokens[0]).toMatchObject({
      type: 'HASH',
      value: 'with-dash',
    });
  });

  it('tokenizes #a123 (alphanumeric)', () => {
    const result = tokenize('#a123');
    expect(result.tokens[0]).toMatchObject({ type: 'HASH', value: 'a123' });
  });

  it('tokenizes #123 (digit-only)', () => {
    const result = tokenize('#123');
    expect(result.tokens[0]).toMatchObject({ type: 'HASH', value: '123' });
  });

  it('tokenizes hex-like #3b82f6', () => {
    const result = tokenize('#3b82f6');
    // Starts with digit — but readHash uses isIdentChar which includes digits
    // Wait: readHash does advance() for #, then reads identChar.
    // But '3' is identChar (isDigit returns true for isIdentChar).
    // However readHash starts reading with isIdentChar, and 3 is identChar.
    // So this should work.
    expect(result.tokens[0]).toMatchObject({ type: 'HASH', value: '3b82f6' });
  });

  it('tokenizes hex-like #fff', () => {
    const result = tokenize('#fff');
    expect(result.tokens[0]).toMatchObject({ type: 'HASH', value: 'fff' });
  });

  it('reports error for bare #', () => {
    const result = tokenize('# ');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Expected identifier after #');
  });
});

// ===========================================================================
// Arrows
// ===========================================================================

describe('Arrows', () => {
  it('tokenizes ->', () => {
    const result = tokenize('->');
    expect(result.tokens[0]).toMatchObject({ type: 'ARROW', value: '->' });
  });

  it('tokenizes -->', () => {
    const result = tokenize('-->');
    expect(result.tokens[0]).toMatchObject({ type: 'ARROW', value: '-->' });
  });

  it('tokenizes --', () => {
    const result = tokenize('-- ');
    expect(result.tokens[0]).toMatchObject({ type: 'ARROW', value: '--' });
  });

  it('tokenizes <->', () => {
    const result = tokenize('<->');
    expect(result.tokens[0]).toMatchObject({ type: 'ARROW', value: '<->' });
  });

  it('tokenizes edge declaration #a -> #b', () => {
    expect(pairs('#a -> #b')).toEqual([
      ['HASH', 'a'],
      ['ARROW', '->'],
      ['HASH', 'b'],
    ]);
  });

  it('tokenizes edge with label #a -> #b "label"', () => {
    expect(pairs('#a -> #b "label"')).toEqual([
      ['HASH', 'a'],
      ['ARROW', '->'],
      ['HASH', 'b'],
      ['STRING', 'label'],
    ]);
  });

  it('tokenizes chained edges #a -> #b -> #c', () => {
    expect(pairs('#a -> #b -> #c')).toEqual([
      ['HASH', 'a'],
      ['ARROW', '->'],
      ['HASH', 'b'],
      ['ARROW', '->'],
      ['HASH', 'c'],
    ]);
  });

  it('tokenizes all arrow styles in edge declarations', () => {
    expect(pairs('#a --> #b')).toEqual([
      ['HASH', 'a'],
      ['ARROW', '-->'],
      ['HASH', 'b'],
    ]);

    expect(pairs('#a -- #b')).toEqual([
      ['HASH', 'a'],
      ['ARROW', '--'],
      ['HASH', 'b'],
    ]);

    expect(pairs('#a <-> #b')).toEqual([
      ['HASH', 'a'],
      ['ARROW', '<->'],
      ['HASH', 'b'],
    ]);
  });

  it('-- requires trailing delimiter to match', () => {
    // --x should NOT be matched as -- + x
    const result = tokenize('--x');
    const nonEof = result.tokens.filter((t) => t.type !== 'EOF');
    // Should be two error chars or something, not an ARROW
    expect(nonEof.some((t) => t.type === 'ARROW')).toBe(false);
  });
});

// ===========================================================================
// Properties (as token sequences)
// ===========================================================================

describe('Property token sequences', () => {
  it('tokenizes direction:right', () => {
    expect(pairs('direction:right')).toEqual([
      ['IDENTIFIER', 'direction'],
      ['COLON', ':'],
      ['IDENTIFIER', 'right'],
    ]);
  });

  it('tokenizes gap:md', () => {
    expect(pairs('gap:md')).toEqual([
      ['IDENTIFIER', 'gap'],
      ['COLON', ':'],
      ['IDENTIFIER', 'md'],
    ]);
  });

  it('tokenizes cols:3', () => {
    expect(pairs('cols:3')).toEqual([
      ['IDENTIFIER', 'cols'],
      ['COLON', ':'],
      ['NUMBER', '3'],
    ]);
  });

  it('tokenizes background:#fff', () => {
    expect(pairs('background:#fff')).toEqual([
      ['IDENTIFIER', 'background'],
      ['COLON', ':'],
      ['HASH', 'fff'],
    ]);
  });

  it('tokenizes background: #fee2e2 (with space)', () => {
    expect(pairs('background: #fee2e2')).toEqual([
      ['IDENTIFIER', 'background'],
      ['COLON', ':'],
      ['HASH', 'fee2e2'],
    ]);
  });

  it('tokenizes font-size: 2xl (hyphenated key)', () => {
    // 2xl starts with a digit → NUMBER("2") + IDENTIFIER("xl")
    // The parser is responsible for combining these into the value "2xl"
    expect(pairs('font-size: 2xl')).toEqual([
      ['IDENTIFIER', 'font-size'],
      ['COLON', ':'],
      ['NUMBER', '2'],
      ['IDENTIFIER', 'xl'],
    ]);
  });

  it('tokenizes multiple comma-separated properties', () => {
    expect(pairs('font-size: sm, color: muted')).toEqual([
      ['IDENTIFIER', 'font-size'],
      ['COLON', ':'],
      ['IDENTIFIER', 'sm'],
      ['COMMA', ','],
      ['IDENTIFIER', 'color'],
      ['COLON', ':'],
      ['IDENTIFIER', 'muted'],
    ]);
  });

  it('tokenizes subtitle: "text"', () => {
    expect(pairs('subtitle: "text"')).toEqual([
      ['IDENTIFIER', 'subtitle'],
      ['COLON', ':'],
      ['STRING', 'text'],
    ]);
  });

  it('tokenizes shape: diamond', () => {
    expect(pairs('shape: diamond')).toEqual([
      ['IDENTIFIER', 'shape'],
      ['COLON', ':'],
      ['IDENTIFIER', 'diamond'],
    ]);
  });

  it('tokenizes opacity: 0.5', () => {
    expect(pairs('opacity: 0.5')).toEqual([
      ['IDENTIFIER', 'opacity'],
      ['COLON', ':'],
      ['NUMBER', '0.5'],
    ]);
  });
});

// ===========================================================================
// Lists
// ===========================================================================

describe('List syntax', () => {
  it('tokenizes ["a", "b"]', () => {
    expect(pairs('["a", "b"]')).toEqual([
      ['BRACKET_OPEN', '['],
      ['STRING', 'a'],
      ['COMMA', ','],
      ['STRING', 'b'],
      ['BRACKET_CLOSE', ']'],
    ]);
  });

  it('tokenizes single-item list ["a"]', () => {
    expect(pairs('["a"]')).toEqual([
      ['BRACKET_OPEN', '['],
      ['STRING', 'a'],
      ['BRACKET_CLOSE', ']'],
    ]);
  });

  it('tokenizes empty list []', () => {
    expect(pairs('[]')).toEqual([
      ['BRACKET_OPEN', '['],
      ['BRACKET_CLOSE', ']'],
    ]);
  });

  it('tokenizes multi-line list', () => {
    const result = pairs('[\n  "item1"\n  "item2"\n]');
    expect(result).toEqual([
      ['BRACKET_OPEN', '['],
      ['STRING', 'item1'],
      ['STRING', 'item2'],
      ['BRACKET_CLOSE', ']'],
    ]);
  });
});

// ===========================================================================
// Gradient function syntax
// ===========================================================================

describe('Gradient syntax', () => {
  it('tokenizes gradient(right, #f00, #00f)', () => {
    expect(pairs('gradient(right, #f00, #00f)')).toEqual([
      ['IDENTIFIER', 'gradient'],
      ['PAREN_OPEN', '('],
      ['IDENTIFIER', 'right'],
      ['COMMA', ','],
      ['HASH', 'f00'],
      ['COMMA', ','],
      ['HASH', '00f'],
      ['PAREN_CLOSE', ')'],
    ]);
  });
});

// ===========================================================================
// Comments
// ===========================================================================

describe('Comments', () => {
  it('skips line comment', () => {
    const result = tokenize('// this is a comment\nnode');
    const nonEof = result.tokens.filter(
      (t) => t.type !== 'EOF' && t.type !== 'NEWLINE',
    );
    expect(nonEof).toHaveLength(1);
    expect(nonEof[0]).toMatchObject({ type: 'ELEMENT_TYPE', value: 'node' });
  });

  it('skips end-of-line comment', () => {
    const result = pairs('node "A" // comment');
    expect(result).toEqual([
      ['ELEMENT_TYPE', 'node'],
      ['STRING', 'A'],
    ]);
  });

  it('comment at end of input', () => {
    const result = tokenize('node // end');
    expect(result.errors).toHaveLength(0);
    const nonEof = result.tokens.filter(
      (t) => t.type !== 'EOF' && t.type !== 'NEWLINE',
    );
    expect(nonEof).toHaveLength(1);
  });
});

// ===========================================================================
// Numbers
// ===========================================================================

describe('Numbers', () => {
  it('tokenizes integer', () => {
    const result = tokenize('42');
    expect(result.tokens[0]).toMatchObject({ type: 'NUMBER', value: '42' });
  });

  it('tokenizes decimal', () => {
    const result = tokenize('3.14');
    expect(result.tokens[0]).toMatchObject({ type: 'NUMBER', value: '3.14' });
  });

  it('tokenizes number 0', () => {
    const result = tokenize('0');
    expect(result.tokens[0]).toMatchObject({ type: 'NUMBER', value: '0' });
  });

  it('tokenizes 0.5', () => {
    const result = tokenize('0.5');
    expect(result.tokens[0]).toMatchObject({ type: 'NUMBER', value: '0.5' });
  });

  it('does not parse trailing dot as decimal', () => {
    // "42." — the dot is NOT followed by a digit
    const result = tokenize('42.');
    expect(result.tokens[0]).toMatchObject({ type: 'NUMBER', value: '42' });
  });
});

// ===========================================================================
// Identifiers
// ===========================================================================

describe('Identifiers', () => {
  it('tokenizes simple identifier', () => {
    const result = tokenize('direction');
    expect(result.tokens[0]).toMatchObject({
      type: 'IDENTIFIER',
      value: 'direction',
    });
  });

  it('tokenizes hyphenated identifier', () => {
    const result = tokenize('font-size');
    expect(result.tokens[0]).toMatchObject({
      type: 'IDENTIFIER',
      value: 'font-size',
    });
  });

  it('tokenizes identifier with numbers', () => {
    const result = tokenize('2xl');
    // Starts with digit — this is NUMBER, not IDENTIFIER
    expect(result.tokens[0].type).toBe('NUMBER');
  });

  it('tokenizes identifier starting with letter', () => {
    const result = tokenize('md');
    expect(result.tokens[0]).toMatchObject({
      type: 'IDENTIFIER',
      value: 'md',
    });
  });

  it('tokenizes identifier with underscore', () => {
    const result = tokenize('my_var');
    expect(result.tokens[0]).toMatchObject({
      type: 'IDENTIFIER',
      value: 'my_var',
    });
  });
});

// ===========================================================================
// Structural tokens
// ===========================================================================

describe('Structural tokens', () => {
  it('tokenizes braces', () => {
    expect(types('{}')).toEqual(['BRACE_OPEN', 'BRACE_CLOSE']);
  });

  it('tokenizes brackets', () => {
    expect(types('[]')).toEqual(['BRACKET_OPEN', 'BRACKET_CLOSE']);
  });

  it('tokenizes parens', () => {
    expect(types('()')).toEqual(['PAREN_OPEN', 'PAREN_CLOSE']);
  });

  it('tokenizes colon', () => {
    expect(types(':')).toEqual(['COLON']);
  });

  it('tokenizes comma', () => {
    expect(types(',')).toEqual(['COMMA']);
  });
});

// ===========================================================================
// Newlines
// ===========================================================================

describe('Newlines', () => {
  it('emits NEWLINE tokens', () => {
    const result = tokenize('a\nb');
    expect(types('a\nb')).toEqual([
      'IDENTIFIER',
      'NEWLINE',
      'IDENTIFIER',
    ]);
  });

  it('handles \\r\\n', () => {
    // \r is silently consumed, \n becomes NEWLINE
    expect(types('a\r\nb')).toEqual([
      'IDENTIFIER',
      'NEWLINE',
      'IDENTIFIER',
    ]);
  });

  it('handles multiple blank lines', () => {
    const result = tokenize('a\n\n\nb');
    const toks = result.tokens.filter((t) => t.type !== 'EOF');
    expect(toks.map((t) => t.type)).toEqual([
      'IDENTIFIER',
      'NEWLINE',
      'NEWLINE',
      'NEWLINE',
      'IDENTIFIER',
    ]);
  });
});

// ===========================================================================
// Error handling
// ===========================================================================

describe('Error handling', () => {
  it('reports unexpected character', () => {
    const result = tokenize('~');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("Unexpected character: '~'");
  });

  it('error has correct line and column', () => {
    const result = tokenize('node\n  ~');
    expect(result.errors[0].line).toBe(2);
    expect(result.errors[0].column).toBe(3);
  });

  it('unterminated string has correct position', () => {
    const result = tokenize('  "unterminated');
    expect(result.errors[0].line).toBe(1);
    expect(result.errors[0].column).toBe(3);
  });

  it('continues tokenizing after error', () => {
    const result = tokenize('~ node');
    expect(result.errors).toHaveLength(1);
    const nonEof = result.tokens.filter((t) => t.type !== 'EOF');
    expect(nonEof).toHaveLength(1);
    expect(nonEof[0].type).toBe('ELEMENT_TYPE');
  });
});

// ===========================================================================
// Position tracking
// ===========================================================================

describe('Position tracking', () => {
  it('tracks line and column for single line', () => {
    const result = tokenize('flow {');
    expect(result.tokens[0]).toMatchObject({ line: 1, column: 1 });
    expect(result.tokens[1]).toMatchObject({ line: 1, column: 6 });
  });

  it('tracks position across lines', () => {
    const result = tokenize('flow {\n  node');
    const nodeTok = result.tokens.find((t) => t.value === 'node');
    expect(nodeTok).toMatchObject({ line: 2, column: 3 });
  });

  it('tracks position for string token at its opening quote', () => {
    const result = tokenize('node "hello"');
    const strTok = result.tokens.find((t) => t.type === 'STRING');
    expect(strTok).toMatchObject({ line: 1, column: 6 });
  });

  it('tracks position after multi-line string', () => {
    const result = tokenize('"line1\nline2"\nnode');
    const nodeTok = result.tokens.find((t) => t.value === 'node');
    expect(nodeTok).toMatchObject({ line: 3, column: 1 });
  });
});

// ===========================================================================
// Comprehensive examples from DSL spec
// ===========================================================================

describe('Comprehensive examples', () => {
  it('tokenizes flow block with properties', () => {
    expect(pairs('flow direction:right {')).toEqual([
      ['BLOCK_TYPE', 'flow'],
      ['IDENTIFIER', 'direction'],
      ['COLON', ':'],
      ['IDENTIFIER', 'right'],
      ['BRACE_OPEN', '{'],
    ]);
  });

  it('tokenizes stack with multiple properties', () => {
    expect(pairs('stack direction:row gap:md {')).toEqual([
      ['BLOCK_TYPE', 'stack'],
      ['IDENTIFIER', 'direction'],
      ['COLON', ':'],
      ['IDENTIFIER', 'row'],
      ['IDENTIFIER', 'gap'],
      ['COLON', ':'],
      ['IDENTIFIER', 'md'],
      ['BRACE_OPEN', '{'],
    ]);
  });

  it('tokenizes grid with number property', () => {
    expect(pairs('grid cols:3 {')).toEqual([
      ['BLOCK_TYPE', 'grid'],
      ['IDENTIFIER', 'cols'],
      ['COLON', ':'],
      ['NUMBER', '3'],
      ['BRACE_OPEN', '{'],
    ]);
  });

  it('tokenizes node with id', () => {
    expect(pairs('node "처리" #id')).toEqual([
      ['ELEMENT_TYPE', 'node'],
      ['STRING', '처리'],
      ['HASH', 'id'],
    ]);
  });

  it('tokenizes node with props block', () => {
    expect(pairs('node "DB" { shape: circle }')).toEqual([
      ['ELEMENT_TYPE', 'node'],
      ['STRING', 'DB'],
      ['BRACE_OPEN', '{'],
      ['IDENTIFIER', 'shape'],
      ['COLON', ':'],
      ['ELEMENT_TYPE', 'circle'],
      ['BRACE_CLOSE', '}'],
    ]);
  });

  it('tokenizes badge with flags', () => {
    expect(pairs('badge "1.0" { outline }')).toEqual([
      ['ELEMENT_TYPE', 'badge'],
      ['STRING', '1.0'],
      ['BRACE_OPEN', '{'],
      ['FLAG', 'outline'],
      ['BRACE_CLOSE', '}'],
    ]);
  });

  it('tokenizes label with multiple flags', () => {
    expect(pairs('label "important" { bold center }')).toEqual([
      ['ELEMENT_TYPE', 'label'],
      ['STRING', 'important'],
      ['BRACE_OPEN', '{'],
      ['FLAG', 'bold'],
      ['FLAG', 'center'],
      ['BRACE_CLOSE', '}'],
    ]);
  });

  it('tokenizes list with ordered flag', () => {
    expect(pairs('list ordered ["a", "b"]')).toEqual([
      ['ELEMENT_TYPE', 'list'],
      ['FLAG', 'ordered'],
      ['BRACKET_OPEN', '['],
      ['STRING', 'a'],
      ['COMMA', ','],
      ['STRING', 'b'],
      ['BRACKET_CLOSE', ']'],
    ]);
  });

  it('tokenizes divider without arguments', () => {
    expect(pairs('divider')).toEqual([['ELEMENT_TYPE', 'divider']]);
  });

  it('tokenizes divider with label', () => {
    expect(pairs('divider "또는"')).toEqual([
      ['ELEMENT_TYPE', 'divider'],
      ['STRING', '또는'],
    ]);
  });

  it('tokenizes canvas fallback', () => {
    expect(
      pairs('rect { x:10 y:10 w:30 h:20 fill:#3b82f6 }'),
    ).toEqual([
      ['ELEMENT_TYPE', 'rect'],
      ['BRACE_OPEN', '{'],
      ['IDENTIFIER', 'x'],
      ['COLON', ':'],
      ['NUMBER', '10'],
      ['IDENTIFIER', 'y'],
      ['COLON', ':'],
      ['NUMBER', '10'],
      ['IDENTIFIER', 'w'],
      ['COLON', ':'],
      ['NUMBER', '30'],
      ['IDENTIFIER', 'h'],
      ['COLON', ':'],
      ['NUMBER', '20'],
      ['IDENTIFIER', 'fill'],
      ['COLON', ':'],
      ['HASH', '3b82f6'],
      ['BRACE_CLOSE', '}'],
    ]);
  });

  it('tokenizes @lane directive', () => {
    expect(pairs('@lane "main": #m1 #m2 #m3')).toEqual([
      ['DIRECTIVE', 'lane'],
      ['STRING', 'main'],
      ['COLON', ':'],
      ['HASH', 'm1'],
      ['HASH', 'm2'],
      ['HASH', 'm3'],
    ]);
  });

  it('tokenizes full minimal example', () => {
    const input = `@page 16:9

scene "타이틀" {
  flow direction:right {
    node "A" #a
    node "B" #b
    #a -> #b "연결"
  }
}`;

    const result = tokenize(input);
    expect(result.errors).toHaveLength(0);

    const meaningful = result.tokens.filter(
      (t) => t.type !== 'EOF' && t.type !== 'NEWLINE',
    );

    expect(meaningful.map((t) => [t.type, t.value])).toEqual([
      ['DIRECTIVE', 'page'],
      ['NUMBER', '16'],
      ['COLON', ':'],
      ['NUMBER', '9'],
      ['BLOCK_TYPE', 'scene'],
      ['STRING', '타이틀'],
      ['BRACE_OPEN', '{'],
      ['BLOCK_TYPE', 'flow'],
      ['IDENTIFIER', 'direction'],
      ['COLON', ':'],
      ['IDENTIFIER', 'right'],
      ['BRACE_OPEN', '{'],
      ['ELEMENT_TYPE', 'node'],
      ['STRING', 'A'],
      ['HASH', 'a'],
      ['ELEMENT_TYPE', 'node'],
      ['STRING', 'B'],
      ['HASH', 'b'],
      ['HASH', 'a'],
      ['ARROW', '->'],
      ['HASH', 'b'],
      ['STRING', '연결'],
      ['BRACE_CLOSE', '}'],
      ['BRACE_CLOSE', '}'],
    ]);
  });
});

// ===========================================================================
// Edge cases
// ===========================================================================

describe('Edge cases', () => {
  it('empty input', () => {
    const result = tokenize('');
    expect(result.tokens).toHaveLength(1); // just EOF
    expect(result.tokens[0].type).toBe('EOF');
    expect(result.errors).toHaveLength(0);
  });

  it('whitespace only', () => {
    const result = tokenize('   \t  ');
    expect(result.tokens).toHaveLength(1); // just EOF
  });

  it('EOF token always present', () => {
    const result = tokenize('node');
    expect(result.tokens[result.tokens.length - 1].type).toBe('EOF');
  });

  it('handles mixed content correctly', () => {
    const input = 'group "명반응" #light {\n  icon "sun"\n}';
    const result = tokenize(input);
    expect(result.errors).toHaveLength(0);
  });

  it('keyword as property value is still a keyword token', () => {
    // shape: circle — circle is ELEMENT_TYPE
    const result = tokenize('circle');
    expect(result.tokens[0].type).toBe('ELEMENT_TYPE');
  });

  it('does not tokenize -- when followed by identifier char', () => {
    // --x should not produce ARROW
    const result = tokenize('--x');
    expect(result.tokens.filter((t) => t.type === 'ARROW')).toHaveLength(0);
  });

  it('single < is an error', () => {
    const result = tokenize('<');
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
