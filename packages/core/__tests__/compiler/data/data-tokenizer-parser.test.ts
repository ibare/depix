import { describe, it, expect } from 'vitest';
import { tokenize } from '../../../src/compiler/tokenizer.js';
import { parse } from '../../../src/compiler/parser.js';
import type { ASTBlock, ASTElement, ASTDirective } from '../../../src/compiler/ast.js';

// ---------------------------------------------------------------------------
// Tokenizer tests
// ---------------------------------------------------------------------------

describe('Tokenizer — data/table/chart keywords', () => {
  it('tokenizes @data as DIRECTIVE', () => {
    const { tokens, errors } = tokenize('@data "sales" {}');
    expect(errors).toHaveLength(0);
    expect(tokens[0]).toMatchObject({ type: 'DIRECTIVE', value: 'data' });
  });

  it('tokenizes table as BLOCK_TYPE', () => {
    const { tokens, errors } = tokenize('table "sales"');
    expect(errors).toHaveLength(0);
    expect(tokens[0]).toMatchObject({ type: 'BLOCK_TYPE', value: 'table' });
  });

  it('tokenizes chart as BLOCK_TYPE', () => {
    const { tokens, errors } = tokenize('chart "sales"');
    expect(errors).toHaveLength(0);
    expect(tokens[0]).toMatchObject({ type: 'BLOCK_TYPE', value: 'chart' });
  });

  it('tokenizes @data body with strings and numbers', () => {
    const { tokens, errors } = tokenize('@data "test" {\n  "A" "B"\n  "x" 42\n}');
    expect(errors).toHaveLength(0);
    const types = tokens.map(t => t.type);
    expect(types).toContain('DIRECTIVE');
    expect(types).toContain('STRING');
    expect(types).toContain('NUMBER');
    expect(types).toContain('BRACE_OPEN');
    expect(types).toContain('BRACE_CLOSE');
  });
});

// ---------------------------------------------------------------------------
// Parser tests — @data directive
// ---------------------------------------------------------------------------

describe('Parser — @data directive', () => {
  it('parses @data with name and body', () => {
    const { ast, errors } = parse('@data "sales" {\n  "Q" "Rev"\n  "Q1" 120\n  "Q2" 185\n}');
    expect(errors).toHaveLength(0);

    const dataDirective = ast.directives.find(d => d.key === 'data');
    expect(dataDirective).toBeDefined();
    expect(dataDirective!.value).toBe('sales');
    expect(dataDirective!.body).toHaveLength(3);
  });

  it('marks the first row as header', () => {
    const { ast } = parse('@data "test" {\n  "A" "B"\n  "x" 1\n}');
    const body = ast.directives[0].body!;
    const firstRow = body[0] as ASTElement;
    expect(firstRow.props.header).toBe(1);
    expect(firstRow.elementType).toBe('row');
    expect(firstRow.values).toEqual(['A', 'B']);
  });

  it('data rows have no header prop', () => {
    const { ast } = parse('@data "test" {\n  "A" "B"\n  "x" 1\n}');
    const body = ast.directives[0].body!;
    const secondRow = body[1] as ASTElement;
    expect(secondRow.props.header).toBeUndefined();
    expect(secondRow.values).toEqual(['x', 1]);
  });

  it('handles @data with empty body', () => {
    const { ast, errors } = parse('@data "empty" {}');
    expect(errors).toHaveLength(0);
    const dataDirective = ast.directives.find(d => d.key === 'data');
    expect(dataDirective).toBeDefined();
    expect(dataDirective!.body).toHaveLength(0);
  });

  it('does not affect other directives', () => {
    const { ast, errors } = parse('@theme dark\n@data "d" {\n  "A"\n}\n@ratio 16:9');
    expect(errors).toHaveLength(0);
    expect(ast.directives).toHaveLength(3);
    expect(ast.directives[0]).toMatchObject({ key: 'theme', value: 'dark' });
    expect(ast.directives[1]).toMatchObject({ key: 'data', value: 'd' });
    expect(ast.directives[2]).toMatchObject({ key: 'ratio', value: '16:9' });
  });
});

// ---------------------------------------------------------------------------
// Parser tests — table block
// ---------------------------------------------------------------------------

describe('Parser — table block', () => {
  it('parses inline table with data rows', () => {
    const { ast, errors } = parse('table {\n  "Name" "Score"\n  "Alice" 95\n  "Bob" 88\n}');
    expect(errors).toHaveLength(0);

    const scene = ast.scenes[0];
    const table = scene.children[0] as ASTBlock;
    expect(table.kind).toBe('block');
    expect(table.blockType).toBe('table');
    expect(table.children).toHaveLength(3);
  });

  it('parses table with label (reference mode)', () => {
    const { ast, errors } = parse('table "sales"');
    expect(errors).toHaveLength(0);

    const scene = ast.scenes[0];
    const table = scene.children[0] as ASTBlock;
    expect(table.blockType).toBe('table');
    expect(table.label).toBe('sales');
    expect(table.children).toHaveLength(0);
  });

  it('inline table first row is header', () => {
    const { ast } = parse('table {\n  "A" "B"\n  "1" "2"\n}');
    const table = ast.scenes[0].children[0] as ASTBlock;
    const firstRow = table.children[0] as ASTElement;
    expect(firstRow.props.header).toBe(1);
  });

  it('parses table inside scene block', () => {
    const { ast, errors } = parse('@presentation\nscene "data" {\n  heading "Results"\n  table {\n    "X" "Y"\n    "a" 1\n  }\n}');
    expect(errors).toHaveLength(0);
    const scene = ast.scenes[0];
    expect(scene.children.some(c => c.kind === 'block' && c.blockType === 'table')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Parser tests — chart block
// ---------------------------------------------------------------------------

describe('Parser — chart block', () => {
  it('parses chart with label (reference mode)', () => {
    const { ast, errors } = parse('chart "sales"');
    expect(errors).toHaveLength(0);

    const scene = ast.scenes[0];
    const chart = scene.children[0] as ASTBlock;
    expect(chart.blockType).toBe('chart');
    expect(chart.label).toBe('sales');
    expect(chart.children).toHaveLength(0);
  });

  it('parses chart with inline props', () => {
    const { ast, errors } = parse('chart "sales" type:bar x:"Quarter" y:"Revenue"');
    expect(errors).toHaveLength(0);

    const chart = ast.scenes[0].children[0] as ASTBlock;
    expect(chart.blockType).toBe('chart');
    expect(chart.label).toBe('sales');
    expect(chart.props.type).toBe('bar');
    expect(chart.props.x).toBe('Quarter');
    expect(chart.props.y).toBe('Revenue');
  });

  it('parses chart with inline data', () => {
    const { ast, errors } = parse('chart {\n  "Category" "Value"\n  "A" 10\n  "B" 20\n}');
    expect(errors).toHaveLength(0);

    const chart = ast.scenes[0].children[0] as ASTBlock;
    expect(chart.blockType).toBe('chart');
    expect(chart.children).toHaveLength(3);
  });
});
