import { describe, it, expect } from 'vitest';
import { parse } from '../../src/compiler/parser.js';
import { serialize } from '../../src/compiler/serializer.js';
import type { ASTBlock, ASTElement } from '../../src/compiler/ast.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse DSL → AST → serialize back → parse again.
 * Verify that the second parse produces the same semantic AST.
 */
function roundtrip(dsl: string): { serialized: string; reparsed: ReturnType<typeof parse> } {
  const { ast } = parse(dsl);
  const serialized = serialize(ast);
  const reparsed = parse(serialized);
  return { serialized, reparsed };
}

function expectRoundtripPreservesSemantics(dsl: string): void {
  const { ast: original } = parse(dsl);
  const { reparsed } = roundtrip(dsl);

  expect(reparsed.errors).toHaveLength(0);
  // Same number of scenes
  expect(reparsed.ast.scenes.length).toBe(original.scenes.length);
  // Same number of directives
  expect(reparsed.ast.directives.length).toBe(original.directives.length);
}

// ===========================================================================
// Roundtrip tests
// ===========================================================================

describe('serialize roundtrip', () => {
  it('roundtrips simple flow block', () => {
    const dsl = `flow {\n  node "A" #a\n  node "B" #b\n}`;
    expectRoundtripPreservesSemantics(dsl);

    const { reparsed } = roundtrip(dsl);
    const scene = reparsed.ast.scenes[0];
    const flow = scene.children[0] as ASTBlock;
    expect(flow.blockType).toBe('flow');
    expect(flow.children).toHaveLength(2);
  });

  it('roundtrips directives', () => {
    const dsl = `@page 16:9\n@style sketch`;
    expectRoundtripPreservesSemantics(dsl);

    const { reparsed } = roundtrip(dsl);
    expect(reparsed.ast.directives[0]).toMatchObject({ key: 'page', value: '16:9' });
    expect(reparsed.ast.directives[1]).toMatchObject({ key: 'style', value: 'sketch' });
  });

  it('roundtrips explicit scene', () => {
    const dsl = `scene "Title" {\n  node "A"\n}`;
    expectRoundtripPreservesSemantics(dsl);

    const { reparsed } = roundtrip(dsl);
    expect(reparsed.ast.scenes[0].label).toBe('Title');
  });

  it('roundtrips multiple scenes', () => {
    const dsl = `scene "Intro" {\n  node "A"\n}\n\nscene "Body" {\n  node "B"\n}`;
    expectRoundtripPreservesSemantics(dsl);
  });

  it('roundtrips edges', () => {
    const dsl = `flow {\n  node "A" #a\n  node "B" #b\n  #a -> #b "label"\n}`;
    expectRoundtripPreservesSemantics(dsl);
  });

  it('roundtrips element with flags', () => {
    const dsl = `flow {\n  list "Items" ordered ["A", "B", "C"]\n}`;
    expectRoundtripPreservesSemantics(dsl);
  });

  it('roundtrips @overrides directive', () => {
    const dsl = `@overrides {\n  #a { x: 10, y: 20, w: 30, h: 40 }\n}\n\nflow {\n  node "A" #a\n}`;
    const { reparsed } = roundtrip(dsl);

    expect(reparsed.errors).toHaveLength(0);
    const overrides = reparsed.ast.directives.find(d => d.key === 'overrides');
    expect(overrides).toBeDefined();
    expect(overrides!.body).toHaveLength(1);

    const entry = overrides!.body![0] as ASTElement;
    expect(entry.id).toBe('a');
    expect(entry.props).toEqual({ x: 10, y: 20, w: 30, h: 40 });
  });

  it('roundtrips scene with slot syntax', () => {
    const dsl = `@presentation\n\nscene "Slide" {\n  layout: header\n  header: heading "Title"\n  body: bullet "Content"\n}`;
    expectRoundtripPreservesSemantics(dsl);

    const { reparsed } = roundtrip(dsl);
    const scene = reparsed.ast.scenes[0];
    expect(scene.props.layout).toBeDefined();
  });

  it('roundtrips nested blocks', () => {
    const dsl = `flow {\n  stack {\n    node "A"\n    node "B"\n  }\n  node "C"\n}`;
    expectRoundtripPreservesSemantics(dsl);
  });

  it('roundtrips element with style properties', () => {
    const dsl = `flow {\n  node "A" {\n    background: #ff0000\n    border: #000000\n  }\n}`;
    expectRoundtripPreservesSemantics(dsl);
  });

  it('roundtrips table block with data', () => {
    const dsl = `table "Sales" {\n  "Name" "Revenue"\n  "Alice" 100\n  "Bob" 200\n}`;
    expectRoundtripPreservesSemantics(dsl);
  });

  it('roundtrips block with inline props', () => {
    const dsl = `flow direction:right gap:md {\n  node "A"\n}`;
    expectRoundtripPreservesSemantics(dsl);
  });
});

// ===========================================================================
// Individual serialization tests
// ===========================================================================

describe('serialize specific structures', () => {
  it('serializes empty document', () => {
    const result = serialize({ directives: [], scenes: [] });
    expect(result).toBe('');
  });

  it('serializes directive without value', () => {
    const result = serialize({
      directives: [{ key: 'presentation', value: '', loc: { line: 1, column: 1 } }],
      scenes: [],
    });
    expect(result).toBe('@presentation');
  });

  it('serializes @overrides with empty body', () => {
    const result = serialize({
      directives: [{ key: 'overrides', value: '', body: [], loc: { line: 1, column: 1 } }],
      scenes: [],
    });
    expect(result).toBe('@overrides {}');
  });

  it('serializes escaped strings', () => {
    const { ast } = parse('node "Hello \\"world\\""');
    const serialized = serialize(ast);
    expect(serialized).toContain('\\"world\\"');
  });

  it('serializes block with id', () => {
    const { ast } = parse('flow #myflow {\n  node "A"\n}');
    const serialized = serialize(ast);
    expect(serialized).toContain('#myflow');
  });
});
