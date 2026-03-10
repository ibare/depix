import { describe, it, expect } from 'vitest';
import { parse } from '../../../src/compiler/parser.js';
import { resolveData } from '../../../src/compiler/data/resolve-data.js';
import type { ASTBlock, ASTElement } from '../../../src/compiler/ast.js';

describe('resolveData', () => {
  it('returns AST unchanged when no @data directives exist', () => {
    const { ast } = parse('flow {\n  node "A" #a\n  node "B" #b\n  #a -> #b\n}');
    const result = resolveData(ast);
    expect(result).toBe(ast); // same reference
  });

  it('builds DataMap from @data and injects rows into table reference', () => {
    const { ast } = parse(`
@data "sales" {
  "Quarter" "Revenue"
  "Q1" 120
  "Q2" 185
}

table "sales"
`);
    const result = resolveData(ast);

    // @data directive should be removed
    expect(result.directives.filter(d => d.key === 'data')).toHaveLength(0);

    // Table should now have rows
    const table = result.scenes[0].children[0] as ASTBlock;
    expect(table.blockType).toBe('table');
    expect(table.children).toHaveLength(3); // header + 2 data rows

    const headerRow = table.children[0] as ASTElement;
    expect(headerRow.values).toEqual(['Quarter', 'Revenue']);
    expect(headerRow.props.header).toBe(1);

    const dataRow1 = table.children[1] as ASTElement;
    expect(dataRow1.values).toEqual(['Q1', 120]);
  });

  it('injects rows into chart reference', () => {
    const { ast } = parse(`
@data "metrics" {
  "Month" "Users"
  "Jan" 100
  "Feb" 200
}

chart "metrics"
`);
    const result = resolveData(ast);
    const chart = result.scenes[0].children[0] as ASTBlock;
    expect(chart.children).toHaveLength(3);
  });

  it('does not modify inline table (already has rows)', () => {
    const { ast } = parse(`
table {
  "Name" "Score"
  "Alice" 95
}
`);
    const result = resolveData(ast);
    const table = result.scenes[0].children[0] as ASTBlock;
    expect(table.children).toHaveLength(2);
  });

  it('resolves multiple @data references', () => {
    const { ast } = parse(`
@data "a" {
  "X"
  "1"
}
@data "b" {
  "Y"
  "2"
}

table "a"
table "b"
`);
    const result = resolveData(ast);
    const table1 = result.scenes[0].children[0] as ASTBlock;
    const table2 = result.scenes[0].children[1] as ASTBlock;
    expect(table1.children).toHaveLength(2);
    expect(table2.children).toHaveLength(2);
  });

  it('handles reference to non-existent @data gracefully', () => {
    const { ast } = parse('table "nonexistent"');
    const result = resolveData(ast);
    const table = result.scenes[0].children[0] as ASTBlock;
    expect(table.children).toHaveLength(0); // unchanged
  });

  it('resolves data inside nested scene blocks', () => {
    const { ast } = parse(`
@data "d" {
  "Col"
  "val"
}

@presentation
scene "slide1" {
  heading "Title"
  table "d"
}
`);
    const result = resolveData(ast);
    const scene = result.scenes[0];
    const table = scene.children.find(c => c.kind === 'block' && c.blockType === 'table') as ASTBlock;
    expect(table.children).toHaveLength(2);
  });

  it('preserves other directives', () => {
    const { ast } = parse(`
@theme dark
@data "d" {
  "A"
  "1"
}
@ratio 16:9

table "d"
`);
    const result = resolveData(ast);
    expect(result.directives.map(d => d.key)).toEqual(['theme', 'ratio']);
  });
});
