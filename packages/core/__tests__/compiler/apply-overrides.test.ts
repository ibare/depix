import { describe, it, expect, beforeEach } from 'vitest';
import { parse } from '../../src/compiler/parser.js';
import { compile } from '../../src/compiler/compiler.js';
import { extractOverrides, applyOverridesToIR } from '../../src/compiler/passes/apply-overrides.js';
import type { ASTDocument, ASTElement } from '../../src/compiler/ast.js';
import type { IRContainer } from '../../src/ir/types.js';
import { shape, container, scene, ir, resetTestIds } from '../helpers/ir-builders.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetTestIds();
});

function findElementById(elements: ReturnType<typeof ir>['scenes'][0]['elements'], id: string): ReturnType<typeof ir>['scenes'][0]['elements'][0] | undefined {
  for (const el of elements) {
    if (el.id === id) return el;
    if (el.type === 'container') {
      const found = findElementById((el as IRContainer).children, id);
      if (found) return found;
    }
  }
  return undefined;
}

// ===========================================================================
// Parser: @overrides directive
// ===========================================================================

describe('@overrides parsing', () => {
  it('parses @overrides with single entry', () => {
    const input = `@overrides {
  #a { x: 10, y: 20, w: 30, h: 40 }
}
node "A" #a`;
    const { ast, errors } = parse(input);
    expect(errors).toHaveLength(0);

    const directive = ast.directives.find(d => d.key === 'overrides');
    expect(directive).toBeDefined();
    expect(directive!.body).toHaveLength(1);

    const entry = directive!.body![0] as ASTElement;
    expect(entry.kind).toBe('element');
    expect(entry.elementType).toBe('override');
    expect(entry.id).toBe('a');
    expect(entry.props).toEqual({ x: 10, y: 20, w: 30, h: 40 });
  });

  it('parses @overrides with multiple entries', () => {
    const input = `@overrides {
  #a { x: 10, y: 20 }
  #b { w: 50, h: 60 }
}
node "A" #a
node "B" #b`;
    const { ast, errors } = parse(input);
    expect(errors).toHaveLength(0);

    const directive = ast.directives.find(d => d.key === 'overrides');
    expect(directive!.body).toHaveLength(2);

    const entryA = directive!.body![0] as ASTElement;
    expect(entryA.id).toBe('a');
    expect(entryA.props).toEqual({ x: 10, y: 20 });

    const entryB = directive!.body![1] as ASTElement;
    expect(entryB.id).toBe('b');
    expect(entryB.props).toEqual({ w: 50, h: 60 });
  });

  it('parses @overrides with no entries (empty block)', () => {
    const input = `@overrides {}
node "A" #a`;
    const { ast, errors } = parse(input);
    expect(errors).toHaveLength(0);

    const directive = ast.directives.find(d => d.key === 'overrides');
    expect(directive).toBeDefined();
    expect(directive!.body).toHaveLength(0);
  });

  it('parses @overrides without brace block', () => {
    const input = `@overrides
node "A" #a`;
    const { ast, errors } = parse(input);
    expect(errors).toHaveLength(0);

    const directive = ast.directives.find(d => d.key === 'overrides');
    expect(directive).toBeDefined();
    expect(directive!.body).toBeUndefined();
  });

  it('reports error for non-hash token in overrides block', () => {
    const input = `@overrides {
  foo { x: 10 }
}`;
    const { errors } = parse(input);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('#id');
  });
});

// ===========================================================================
// extractOverrides
// ===========================================================================

describe('extractOverrides', () => {
  it('returns empty map for AST without @overrides', () => {
    const ast: ASTDocument = { directives: [], scenes: [] };
    const map = extractOverrides(ast);
    expect(map.size).toBe(0);
  });

  it('extracts override entries from AST', () => {
    const input = `@overrides {
  #a { x: 10, y: 20, w: 30, h: 40 }
  #b { x: 50 }
}
node "A" #a
node "B" #b`;
    const { ast } = parse(input);
    const map = extractOverrides(ast);

    expect(map.size).toBe(2);
    expect(map.get('a')).toEqual({ x: 10, y: 20, w: 30, h: 40 });
    expect(map.get('b')).toEqual({ x: 50 });
  });

  it('merges multiple @overrides directives (later wins)', () => {
    const input = `@overrides {
  #a { x: 10, y: 20 }
}
@overrides {
  #a { y: 99, w: 50 }
}
node "A" #a`;
    const { ast } = parse(input);
    const map = extractOverrides(ast);

    expect(map.get('a')).toEqual({ x: 10, y: 99, w: 50 });
  });

  it('skips entries without id', () => {
    const ast: ASTDocument = {
      directives: [{
        key: 'overrides',
        value: '',
        body: [{
          kind: 'element',
          elementType: 'override',
          props: { x: 10 },
          style: {},
          flags: [],
          children: [],
          loc: { line: 1, column: 1 },
        } as ASTElement],
        loc: { line: 1, column: 1 },
      }],
      scenes: [],
    };
    const map = extractOverrides(ast);
    expect(map.size).toBe(0);
  });
});

// ===========================================================================
// applyOverridesToIR
// ===========================================================================

describe('applyOverridesToIR', () => {
  it('returns same IR when overrides map is empty', () => {
    const testIR = ir([scene([shape({ id: 'a', bounds: { x: 0, y: 0, w: 10, h: 10 } })])]);
    const result = applyOverridesToIR(testIR, new Map());
    expect(result).toBe(testIR);
  });

  it('applies override to matching element bounds', () => {
    const testIR = ir([scene([shape({ id: 'a', bounds: { x: 0, y: 0, w: 10, h: 10 } })])]);
    const overrides = new Map([['a', { x: 50, y: 60 }]]);
    const result = applyOverridesToIR(testIR, overrides);

    expect(result.scenes[0].elements[0].bounds).toEqual({
      x: 50, y: 60, w: 10, h: 10,
    });
  });

  it('applies partial override (only w and h)', () => {
    const testIR = ir([scene([shape({ id: 'a', bounds: { x: 5, y: 5, w: 10, h: 10 } })])]);
    const overrides = new Map([['a', { w: 30, h: 40 }]]);
    const result = applyOverridesToIR(testIR, overrides);

    expect(result.scenes[0].elements[0].bounds).toEqual({
      x: 5, y: 5, w: 30, h: 40,
    });
  });

  it('leaves non-matching elements untouched', () => {
    const testIR = ir([scene([
      shape({ id: 'a', bounds: { x: 0, y: 0, w: 10, h: 10 } }),
      shape({ id: 'b', bounds: { x: 20, y: 20, w: 15, h: 15 } }),
    ])]);
    const overrides = new Map([['a', { x: 50 }]]);
    const result = applyOverridesToIR(testIR, overrides);

    expect(result.scenes[0].elements[0].bounds.x).toBe(50);
    expect(result.scenes[0].elements[1].bounds).toEqual({ x: 20, y: 20, w: 15, h: 15 });
  });

  it('applies overrides to nested container children', () => {
    const testIR = ir([scene([
      container([shape({ id: 'nested', bounds: { x: 10, y: 10, w: 20, h: 20 } })]),
    ])]);
    const overrides = new Map([['nested', { x: 80, y: 80 }]]);
    const result = applyOverridesToIR(testIR, overrides);

    const c = result.scenes[0].elements[0] as IRContainer;
    expect(c.children[0].bounds).toEqual({ x: 80, y: 80, w: 20, h: 20 });
  });

  it('applies overrides across multiple scenes', () => {
    const testIR = ir([
      scene([shape({ id: 'a', bounds: { x: 0, y: 0, w: 10, h: 10 } })]),
      scene([shape({ id: 'b', bounds: { x: 0, y: 0, w: 10, h: 10 } })]),
    ]);
    const overrides = new Map([['a', { x: 99 }], ['b', { y: 88 }]]);
    const result = applyOverridesToIR(testIR, overrides);

    expect(result.scenes[0].elements[0].bounds.x).toBe(99);
    expect(result.scenes[1].elements[0].bounds.y).toBe(88);
  });
});

// ===========================================================================
// Compiler integration
// ===========================================================================

describe('compile with @overrides', () => {
  it('applies overrides to compiled IR', () => {
    const dsl = `@overrides {
  #a { x: 50, y: 60 }
}
flow {
  node "A" #a
  node "B" #b
}`;
    const { ir: compiledIR, errors } = compile(dsl);
    expect(errors).toHaveLength(0);

    const elA = findElementById(compiledIR.scenes[0].elements, 'a');
    expect(elA).toBeDefined();
    expect(elA!.bounds.x).toBe(50);
    expect(elA!.bounds.y).toBe(60);
  });

  it('does not affect IR when no @overrides present', () => {
    const dsl = `flow {
  node "A" #a
}`;
    const { ir: compiledIR } = compile(dsl);

    const elA = findElementById(compiledIR.scenes[0].elements, 'a');
    expect(elA).toBeDefined();
    expect(elA!.bounds.w).toBeGreaterThan(0);
    expect(elA!.bounds.h).toBeGreaterThan(0);
  });
});
