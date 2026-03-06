import { describe, it, expect } from 'vitest';
import { resolveTheme } from '../../../src/compiler/passes/resolve-theme.js';
import { lightTheme, darkTheme } from '../../../src/theme/builtin-themes.js';
import type { ASTDocument, ASTBlock, ASTElement } from '../../../src/compiler/ast.js';
import type { DepixTheme } from '../../../src/theme/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const loc = { line: 1, column: 1 };

function makeDoc(...nodes: (ASTBlock | ASTElement)[]): ASTDocument {
  return {
    directives: [],
    scenes: [{ name: null, children: nodes, loc }],
  };
}

function makeBlock(
  overrides: Partial<ASTBlock> = {},
): ASTBlock {
  return {
    kind: 'block',
    blockType: 'stack',
    props: {},
    style: {},
    children: [],
    loc,
    ...overrides,
  };
}

function makeElement(
  overrides: Partial<ASTElement> = {},
): ASTElement {
  return {
    kind: 'element',
    elementType: 'node',
    props: {},
    style: {},
    flags: [],
    children: [],
    loc,
    ...overrides,
  };
}

function firstChild(doc: ASTDocument): ASTBlock | ASTElement {
  return doc.scenes[0].children[0] as ASTBlock | ASTElement;
}

// ---------------------------------------------------------------------------
// Color resolution
// ---------------------------------------------------------------------------

describe('resolveTheme — color resolution', () => {
  it('resolves semantic color in background', () => {
    const ast = makeDoc(makeElement({ style: { background: 'primary' } }));
    const resolved = resolveTheme(ast, lightTheme);
    expect((firstChild(resolved) as ASTElement).style.background).toBe('#3b82f6');
  });

  it('resolves semantic color in color', () => {
    const ast = makeDoc(makeElement({ style: { color: 'danger' } }));
    const resolved = resolveTheme(ast, lightTheme);
    expect((firstChild(resolved) as ASTElement).style.color).toBe('#ef4444');
  });

  it('resolves semantic color in border', () => {
    const ast = makeDoc(makeElement({ style: { border: 'success' } }));
    const resolved = resolveTheme(ast, lightTheme);
    expect((firstChild(resolved) as ASTElement).style.border).toBe('#10b981');
  });

  it('resolves named colors (e.g. "red" → HEX)', () => {
    const ast = makeDoc(makeElement({ style: { background: 'red' } }));
    const resolved = resolveTheme(ast, lightTheme);
    expect((firstChild(resolved) as ASTElement).style.background).toBe('#ef4444');
  });

  it('passes through HEX values as-is', () => {
    const ast = makeDoc(makeElement({ style: { background: '#abc123' } }));
    const resolved = resolveTheme(ast, lightTheme);
    expect((firstChild(resolved) as ASTElement).style.background).toBe('#abc123');
  });

  it('passes through gradient values as-is', () => {
    const ast = makeDoc(makeElement({ style: { background: 'gradient(to-right, #ff0000, #0000ff)' } }));
    const resolved = resolveTheme(ast, lightTheme);
    expect((firstChild(resolved) as ASTElement).style.background).toBe('gradient(to-right, #ff0000, #0000ff)');
  });

  it('resolves multiple color properties at once', () => {
    const ast = makeDoc(makeElement({
      style: { background: 'primary', color: 'warning', border: 'accent' },
    }));
    const resolved = resolveTheme(ast, lightTheme);
    const style = (firstChild(resolved) as ASTElement).style;
    expect(style.background).toBe('#3b82f6');
    expect(style.color).toBe('#f59e0b');
    expect(style.border).toBe('#8b5cf6');
  });

  it('resolves colors differently for dark theme', () => {
    const ast = makeDoc(makeElement({ style: { background: 'primary' } }));
    const resolved = resolveTheme(ast, darkTheme);
    expect((firstChild(resolved) as ASTElement).style.background).toBe('#60a5fa');
  });
});

// ---------------------------------------------------------------------------
// Spacing (gap) resolution
// ---------------------------------------------------------------------------

describe('resolveTheme — spacing resolution', () => {
  it('resolves gap:md to number', () => {
    const ast = makeDoc(makeBlock({ props: { gap: 'md' } }));
    const resolved = resolveTheme(ast, lightTheme);
    expect((firstChild(resolved) as ASTBlock).props.gap).toBe(3);
  });

  it('resolves gap:xl to number', () => {
    const ast = makeDoc(makeBlock({ props: { gap: 'xl' } }));
    const resolved = resolveTheme(ast, lightTheme);
    expect((firstChild(resolved) as ASTBlock).props.gap).toBe(8);
  });

  it('preserves numeric gap as-is', () => {
    const ast = makeDoc(makeBlock({ props: { gap: 5 } }));
    const resolved = resolveTheme(ast, lightTheme);
    expect((firstChild(resolved) as ASTBlock).props.gap).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Font size resolution
// ---------------------------------------------------------------------------

describe('resolveTheme — font-size resolution', () => {
  it('resolves font-size:lg to number', () => {
    const ast = makeDoc(makeElement({ style: { 'font-size': 'lg' } }));
    const resolved = resolveTheme(ast, lightTheme);
    expect((firstChild(resolved) as ASTElement).style['font-size']).toBe(1.4);
  });

  it('resolves font-size:2xl to number', () => {
    const ast = makeDoc(makeElement({ style: { 'font-size': '2xl' } }));
    const resolved = resolveTheme(ast, lightTheme);
    expect((firstChild(resolved) as ASTElement).style['font-size']).toBe(2.4);
  });

  it('preserves numeric font-size as-is', () => {
    const ast = makeDoc(makeElement({ style: { 'font-size': 16 } }));
    const resolved = resolveTheme(ast, lightTheme);
    expect((firstChild(resolved) as ASTElement).style['font-size']).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// Shadow resolution
// ---------------------------------------------------------------------------

describe('resolveTheme — shadow resolution', () => {
  it('resolves shadow:md to expanded properties', () => {
    const ast = makeDoc(makeElement({ style: { shadow: 'md' } }));
    const resolved = resolveTheme(ast, lightTheme);
    const style = (firstChild(resolved) as ASTElement).style;

    expect(style['shadow']).toBeUndefined();
    expect(style['shadow-offsetX']).toBe(0);
    expect(style['shadow-offsetY']).toBe(2);
    expect(style['shadow-blur']).toBe(6);
    expect(style['shadow-color']).toBe('rgba(0,0,0,0.12)');
  });

  it('resolves shadow:sm to expanded properties', () => {
    const ast = makeDoc(makeElement({ style: { shadow: 'sm' } }));
    const resolved = resolveTheme(ast, lightTheme);
    const style = (firstChild(resolved) as ASTElement).style;

    expect(style['shadow-offsetX']).toBe(0);
    expect(style['shadow-offsetY']).toBe(1);
    expect(style['shadow-blur']).toBe(3);
    expect(style['shadow-color']).toBe('rgba(0,0,0,0.1)');
  });

  it('resolves shadow:none to style.shadow = "none"', () => {
    const ast = makeDoc(makeElement({ style: { shadow: 'none' } }));
    const resolved = resolveTheme(ast, lightTheme);
    const style = (firstChild(resolved) as ASTElement).style;
    expect(style['shadow']).toBe('none');
  });

  it('resolves unknown shadow token to "none"', () => {
    const ast = makeDoc(makeElement({ style: { shadow: 'unknown' } }));
    const resolved = resolveTheme(ast, lightTheme);
    const style = (firstChild(resolved) as ASTElement).style;
    expect(style['shadow']).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// Radius resolution
// ---------------------------------------------------------------------------

describe('resolveTheme — radius resolution', () => {
  it('resolves radius:md to number', () => {
    const ast = makeDoc(makeElement({ style: { radius: 'md' } }));
    const resolved = resolveTheme(ast, lightTheme);
    expect((firstChild(resolved) as ASTElement).style.radius).toBe(1);
  });

  it('resolves radius:full to 50', () => {
    const ast = makeDoc(makeElement({ style: { radius: 'full' } }));
    const resolved = resolveTheme(ast, lightTheme);
    expect((firstChild(resolved) as ASTElement).style.radius).toBe(50);
  });

  it('resolves radius:none to 0', () => {
    const ast = makeDoc(makeElement({ style: { radius: 'none' } }));
    const resolved = resolveTheme(ast, lightTheme);
    expect((firstChild(resolved) as ASTElement).style.radius).toBe(0);
  });

  it('preserves numeric radius', () => {
    const ast = makeDoc(makeElement({ style: { radius: 8 } }));
    const resolved = resolveTheme(ast, lightTheme);
    expect((firstChild(resolved) as ASTElement).style.radius).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Border width resolution
// ---------------------------------------------------------------------------

describe('resolveTheme — border-width resolution', () => {
  it('resolves border-width:thin to number', () => {
    const ast = makeDoc(makeElement({ style: { 'border-width': 'thin' } }));
    const resolved = resolveTheme(ast, lightTheme);
    expect((firstChild(resolved) as ASTElement).style['border-width']).toBe(0.3);
  });

  it('resolves border-width:medium to number', () => {
    const ast = makeDoc(makeElement({ style: { 'border-width': 'medium' } }));
    const resolved = resolveTheme(ast, lightTheme);
    expect((firstChild(resolved) as ASTElement).style['border-width']).toBe(0.6);
  });

  it('resolves border-width:thick to number', () => {
    const ast = makeDoc(makeElement({ style: { 'border-width': 'thick' } }));
    const resolved = resolveTheme(ast, lightTheme);
    expect((firstChild(resolved) as ASTElement).style['border-width']).toBe(1.0);
  });

  it('preserves numeric border-width', () => {
    const ast = makeDoc(makeElement({ style: { 'border-width': 2 } }));
    const resolved = resolveTheme(ast, lightTheme);
    expect((firstChild(resolved) as ASTElement).style['border-width']).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Theme node defaults for unstyled elements
// ---------------------------------------------------------------------------

describe('resolveTheme — node defaults', () => {
  it('applies default fill as background for unstyled node', () => {
    const ast = makeDoc(makeElement({ elementType: 'node', style: {} }));
    const resolved = resolveTheme(ast, lightTheme);
    const style = (firstChild(resolved) as ASTElement).style;
    expect(style.background).toBe('#ffffff');
  });

  it('applies default stroke as border for unstyled node', () => {
    const ast = makeDoc(makeElement({ elementType: 'node', style: {} }));
    const resolved = resolveTheme(ast, lightTheme);
    const style = (firstChild(resolved) as ASTElement).style;
    expect(style.border).toBe('#e5e7eb');
  });

  it('applies default cornerRadius as radius for unstyled node', () => {
    const ast = makeDoc(makeElement({ elementType: 'node', style: {} }));
    const resolved = resolveTheme(ast, lightTheme);
    const style = (firstChild(resolved) as ASTElement).style;
    expect(style.radius).toBe(1);
  });

  it('applies defaults for box elements', () => {
    const ast = makeDoc(makeElement({ elementType: 'box', style: {} }));
    const resolved = resolveTheme(ast, lightTheme);
    const style = (firstChild(resolved) as ASTElement).style;
    expect(style.background).toBe('#ffffff');
  });

  it('applies defaults for cell elements', () => {
    const ast = makeDoc(makeElement({ elementType: 'cell', style: {} }));
    const resolved = resolveTheme(ast, lightTheme);
    const style = (firstChild(resolved) as ASTElement).style;
    expect(style.background).toBe('#ffffff');
  });

  it('does NOT apply defaults for non-node elements (e.g. text)', () => {
    const ast = makeDoc(makeElement({ elementType: 'text', style: {} }));
    const resolved = resolveTheme(ast, lightTheme);
    const style = (firstChild(resolved) as ASTElement).style;
    expect(style.background).toBeUndefined();
  });

  it('does NOT overwrite explicit style with defaults', () => {
    const ast = makeDoc(makeElement({
      elementType: 'node',
      style: { background: 'primary', border: 'danger' },
    }));
    const resolved = resolveTheme(ast, lightTheme);
    const style = (firstChild(resolved) as ASTElement).style;
    // Explicit values should be resolved, not replaced with defaults
    expect(style.background).toBe('#3b82f6');
    expect(style.border).toBe('#ef4444');
  });

  it('applies dark theme defaults for nodes', () => {
    const ast = makeDoc(makeElement({ elementType: 'node', style: {} }));
    const resolved = resolveTheme(ast, darkTheme);
    const style = (firstChild(resolved) as ASTElement).style;
    expect(style.background).toBe('#1e293b');
    expect(style.border).toBe('#374151');
  });
});

// ---------------------------------------------------------------------------
// Nested structure resolution
// ---------------------------------------------------------------------------

describe('resolveTheme — nested structures', () => {
  it('resolves colors inside nested blocks', () => {
    const innerElement = makeElement({ style: { background: 'accent' } });
    const outerBlock = makeBlock({ children: [innerElement] });
    const ast = makeDoc(outerBlock);

    const resolved = resolveTheme(ast, lightTheme);
    const outerResolved = firstChild(resolved) as ASTBlock;
    const innerResolved = outerResolved.children[0] as ASTElement;
    expect(innerResolved.style.background).toBe('#8b5cf6');
  });

  it('resolves gap in block and colors in nested element', () => {
    const innerElement = makeElement({ style: { color: 'info' } });
    const outerBlock = makeBlock({ props: { gap: 'lg' }, children: [innerElement] });
    const ast = makeDoc(outerBlock);

    const resolved = resolveTheme(ast, lightTheme);
    const outerResolved = firstChild(resolved) as ASTBlock;
    expect(outerResolved.props.gap).toBe(5);

    const innerResolved = outerResolved.children[0] as ASTElement;
    expect(innerResolved.style.color).toBe('#06b6d4');
  });

  it('resolves deeply nested elements', () => {
    const deepElement = makeElement({ style: { background: 'warning' } });
    const innerBlock = makeBlock({ children: [deepElement] });
    const outerBlock = makeBlock({ children: [innerBlock] });
    const ast = makeDoc(outerBlock);

    const resolved = resolveTheme(ast, lightTheme);
    const outer = firstChild(resolved) as ASTBlock;
    const inner = outer.children[0] as ASTBlock;
    const deep = inner.children[0] as ASTElement;
    expect(deep.style.background).toBe('#f59e0b');
  });

  it('resolves children inside element (nested elements)', () => {
    const child = makeElement({ style: { background: 'muted' } });
    const parent = makeElement({
      elementType: 'node',
      style: { background: 'primary' },
      children: [child],
    });
    const ast = makeDoc(parent);

    const resolved = resolveTheme(ast, lightTheme);
    const parentResolved = firstChild(resolved) as ASTElement;
    expect(parentResolved.style.background).toBe('#3b82f6');

    const childResolved = parentResolved.children[0] as ASTElement;
    expect(childResolved.style.background).toBe('#9ca3af');
  });
});

// ---------------------------------------------------------------------------
// Edge passthrough
// ---------------------------------------------------------------------------

describe('resolveTheme — edges', () => {
  it('passes edges through unchanged', () => {
    const ast: ASTDocument = {
      directives: [],
      scenes: [{
        name: null,
        children: [{
          kind: 'edge',
          fromId: 'a',
          toId: 'b',
          edgeStyle: '->',
          loc,
        }],
        loc,
      }],
    };

    const resolved = resolveTheme(ast, lightTheme);
    const edge = resolved.scenes[0].children[0];
    expect(edge.kind).toBe('edge');
    expect(edge).toEqual(ast.scenes[0].children[0]);
  });
});

// ---------------------------------------------------------------------------
// Color palette expansion for container elements
// ---------------------------------------------------------------------------

describe('resolveTheme — color palette expansion', () => {
  it('expands color to background/border/color for box element', () => {
    const ast = makeDoc(makeElement({ elementType: 'box', style: { color: 'primary' } }));
    const resolved = resolveTheme(ast, lightTheme);
    const style = (firstChild(resolved) as ASTElement).style;
    // background should be set (palette.bg)
    expect(style.background).toBeDefined();
    expect(typeof style.background).toBe('string');
    expect((style.background as string).startsWith('#')).toBe(true);
    // border should be set (palette.border)
    expect(style.border).toBeDefined();
    // color should still be a HEX string (palette.fg)
    expect(typeof style.color).toBe('string');
    expect((style.color as string).startsWith('#')).toBe(true);
  });

  it('expands color for cell element', () => {
    const ast = makeDoc(makeElement({ elementType: 'cell', style: { color: 'accent' } }));
    const resolved = resolveTheme(ast, lightTheme);
    const style = (firstChild(resolved) as ASTElement).style;
    expect(style.background).toBeDefined();
    expect(style.border).toBeDefined();
  });

  it('does NOT expand color for node element', () => {
    const ast = makeDoc(makeElement({ elementType: 'node', style: { color: 'primary' } }));
    const resolved = resolveTheme(ast, lightTheme);
    const style = (firstChild(resolved) as ASTElement).style;
    // node gets default fill from applyNodeDefaults, not from palette
    expect(style.background).toBe(lightTheme.node.fill);
    // color should be the resolved HEX, not a palette fg
    expect(style.color).toBe(lightTheme.colors.primary);
  });

  it('does NOT expand when background is explicitly set', () => {
    const ast = makeDoc(makeElement({
      elementType: 'box',
      style: { color: 'primary', background: '#ff0000' },
    }));
    const resolved = resolveTheme(ast, lightTheme);
    const style = (firstChild(resolved) as ASTElement).style;
    // background keeps user value
    expect(style.background).toBe('#ff0000');
    // color stays as resolved semantic
    expect(style.color).toBe(lightTheme.colors.primary);
  });

  it('does NOT overwrite explicit border during expansion', () => {
    const ast = makeDoc(makeElement({
      elementType: 'box',
      style: { color: 'danger', border: '#000000' },
    }));
    const resolved = resolveTheme(ast, lightTheme);
    const style = (firstChild(resolved) as ASTElement).style;
    // border keeps user value
    expect(style.border).toBe('#000000');
    // background should be palette.bg
    expect(style.background).toBeDefined();
    expect(style.background).not.toBe('#ffffff');
  });

  it('palette bg is lighter than the original color', () => {
    const ast = makeDoc(makeElement({ elementType: 'box', style: { color: 'primary' } }));
    const resolved = resolveTheme(ast, lightTheme);
    const style = (firstChild(resolved) as ASTElement).style;
    const bgR = parseInt((style.background as string).slice(1, 3), 16);
    const primaryR = parseInt(lightTheme.colors.primary.slice(1, 3), 16);
    expect(bgR).toBeGreaterThan(primaryR);
  });
});

// ---------------------------------------------------------------------------
// Multiple scenes & directives
// ---------------------------------------------------------------------------

describe('resolveTheme — multi-scene', () => {
  it('resolves across multiple scenes', () => {
    const ast: ASTDocument = {
      directives: [{ key: 'page', value: '16:9', loc }],
      scenes: [
        {
          name: 'scene1',
          children: [makeElement({ style: { background: 'primary' } })],
          loc,
        },
        {
          name: 'scene2',
          children: [makeElement({ style: { background: 'danger' } })],
          loc,
        },
      ],
    };

    const resolved = resolveTheme(ast, lightTheme);

    expect(resolved.directives).toEqual(ast.directives);
    expect((resolved.scenes[0].children[0] as ASTElement).style.background).toBe('#3b82f6');
    expect((resolved.scenes[1].children[0] as ASTElement).style.background).toBe('#ef4444');
  });

  it('preserves directives unchanged', () => {
    const directives = [
      { key: 'page', value: '16:9', loc },
      { key: 'style', value: 'sketch', loc },
    ];
    const ast: ASTDocument = {
      directives,
      scenes: [{ name: null, children: [], loc }],
    };

    const resolved = resolveTheme(ast, lightTheme);
    expect(resolved.directives).toEqual(directives);
  });
});

// ---------------------------------------------------------------------------
// Mixed semantic + literal values
// ---------------------------------------------------------------------------

describe('resolveTheme — mixed values', () => {
  it('resolves semantic values while preserving literal values', () => {
    const ast = makeDoc(makeElement({
      style: {
        background: 'primary',
        color: '#ffffff',
        'font-size': 14,
        radius: 'lg',
        'border-width': 2,
      },
    }));

    const resolved = resolveTheme(ast, lightTheme);
    const style = (firstChild(resolved) as ASTElement).style;

    expect(style.background).toBe('#3b82f6');  // semantic → HEX
    expect(style.color).toBe('#ffffff');        // HEX passthrough
    expect(style['font-size']).toBe(14);        // numeric passthrough
    expect(style.radius).toBe(2);               // semantic → number
    expect(style['border-width']).toBe(2);      // numeric passthrough
  });

  it('handles block with both style and props resolution', () => {
    const ast = makeDoc(makeBlock({
      props: { gap: 'sm', direction: 'horizontal' },
      style: { background: 'secondary' },
    }));

    const resolved = resolveTheme(ast, lightTheme);
    const block = firstChild(resolved) as ASTBlock;

    expect(block.props.gap).toBe(2);
    expect(block.props.direction).toBe('horizontal');
    expect(block.style.background).toBe('#6b7280');
  });
});

// ---------------------------------------------------------------------------
// Immutability — original AST not mutated
// ---------------------------------------------------------------------------

describe('resolveTheme — immutability', () => {
  it('does not mutate the original element style', () => {
    const original = makeDoc(makeElement({
      style: { background: 'primary', shadow: 'md' },
    }));

    const originalStyle = { ...(original.scenes[0].children[0] as ASTElement).style };
    resolveTheme(original, lightTheme);
    const afterStyle = (original.scenes[0].children[0] as ASTElement).style;

    expect(afterStyle).toEqual(originalStyle);
  });

  it('does not mutate the original block props', () => {
    const original = makeDoc(makeBlock({ props: { gap: 'lg' } }));
    const originalProps = { ...(original.scenes[0].children[0] as ASTBlock).props };
    resolveTheme(original, lightTheme);
    const afterProps = (original.scenes[0].children[0] as ASTBlock).props;

    expect(afterProps).toEqual(originalProps);
  });

  it('returns a new directives array (not same reference)', () => {
    const directives = [{ key: 'page', value: '16:9', loc }];
    const ast: ASTDocument = {
      directives,
      scenes: [{ name: null, children: [], loc }],
    };
    const resolved = resolveTheme(ast, lightTheme);
    expect(resolved.directives).toEqual(directives);
    expect(resolved.directives).not.toBe(directives);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('resolveTheme — edge cases', () => {
  it('handles empty document (no scenes)', () => {
    const ast: ASTDocument = { directives: [], scenes: [] };
    const resolved = resolveTheme(ast, lightTheme);
    expect(resolved.scenes).toEqual([]);
    expect(resolved.directives).toEqual([]);
  });

  it('handles scene with no children', () => {
    const ast: ASTDocument = {
      directives: [],
      scenes: [{ name: 'empty', children: [], loc }],
    };
    const resolved = resolveTheme(ast, lightTheme);
    expect(resolved.scenes[0].children).toEqual([]);
  });

  it('applies cornerRadius:0 from theme as default', () => {
    const zeroRadiusTheme: DepixTheme = {
      ...lightTheme,
      node: { ...lightTheme.node, cornerRadius: 0 },
    };
    const ast = makeDoc(makeElement({ elementType: 'node', style: {} }));
    const resolved = resolveTheme(ast, zeroRadiusTheme);
    const style = (firstChild(resolved) as ASTElement).style;
    expect(style.radius).toBe(0);
  });
});
