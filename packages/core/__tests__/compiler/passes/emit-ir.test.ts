import { describe, it, expect } from 'vitest';
import { emitIR } from '../../../src/compiler/passes/emit-ir.js';
import { lightTheme, darkTheme } from '../../../src/theme/builtin-themes.js';
import type { ASTDocument, ASTBlock, ASTElement, ASTEdge } from '../../../src/compiler/ast.js';
import type { DepixIR, IRContainer, IRShape, IRText, IRLine, IRImage, IREdge as IREdgeType } from '../../../src/ir/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loc() {
  return { line: 1, column: 1 };
}

function makeDoc(scenes: ASTBlock[], directives: ASTDocument['directives'] = []): ASTDocument {
  return { directives, scenes };
}

function makeScene(children: ASTBlock['children'], label: string | undefined = undefined): ASTBlock {
  return { kind: 'block', blockType: 'scene', props: {}, children, label, style: {}, loc: loc() };
}

function makeElement(type: string, overrides: Partial<ASTElement> = {}): ASTElement {
  return {
    kind: 'element',
    elementType: type,
    label: overrides.label,
    id: overrides.id,
    props: overrides.props ?? {},
    style: overrides.style ?? {},
    flags: overrides.flags ?? [],
    children: overrides.children ?? [],
    items: overrides.items,
    loc: loc(),
  };
}

function makeBlock(type: string, children: ASTBlock['children'], overrides: Partial<ASTBlock> = {}): ASTBlock {
  return {
    kind: 'block',
    blockType: type,
    props: overrides.props ?? {},
    children,
    label: overrides.label,
    id: overrides.id,
    style: overrides.style ?? {},
    loc: loc(),
  };
}

function makeEdge(fromId: string, toId: string, style: ASTEdge['edgeStyle'] = '->'): ASTEdge {
  return { kind: 'edge', fromId, toId, edgeStyle: style, loc: loc() };
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

describe('emitIR — meta', () => {
  it('uses default 16:9 aspect ratio', () => {
    const doc = makeDoc([makeScene([])]);
    const ir = emitIR(doc, lightTheme);
    expect(ir.meta.aspectRatio).toEqual({ width: 16, height: 9 });
  });

  it('parses page directive for aspect ratio', () => {
    const doc = makeDoc([makeScene([])], [
      { key: 'page', value: '4:3', loc: loc() },
    ]);
    const ir = emitIR(doc, lightTheme);
    expect(ir.meta.aspectRatio).toEqual({ width: 4, height: 3 });
  });

  it('sets background from theme', () => {
    const ir = emitIR(makeDoc([makeScene([])]), lightTheme);
    expect(ir.meta.background).toEqual({ type: 'solid', color: '#ffffff' });
  });

  it('sets dark theme background', () => {
    const ir = emitIR(makeDoc([makeScene([])]), darkTheme);
    expect(ir.meta.background).toEqual({ type: 'solid', color: '#1a1a2e' });
  });

  it('defaults drawingStyle to default', () => {
    const ir = emitIR(makeDoc([makeScene([])]), lightTheme);
    expect(ir.meta.drawingStyle).toBe('default');
  });

  it('parses sketch style directive', () => {
    const doc = makeDoc([makeScene([])], [
      { key: 'style', value: 'sketch', loc: loc() },
    ]);
    const ir = emitIR(doc, lightTheme);
    expect(ir.meta.drawingStyle).toBe('sketch');
  });

  it('ignores invalid page directive', () => {
    const doc = makeDoc([makeScene([])], [
      { key: 'page', value: 'invalid', loc: loc() },
    ]);
    const ir = emitIR(doc, lightTheme);
    expect(ir.meta.aspectRatio).toEqual({ width: 16, height: 9 });
  });
});

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

describe('emitIR — scenes', () => {
  it('creates a single scene from empty AST', () => {
    const ir = emitIR(makeDoc([makeScene([])]), lightTheme);
    expect(ir.scenes).toHaveLength(1);
    expect(ir.scenes[0].id).toBe('scene-0');
    expect(ir.scenes[0].elements).toHaveLength(0);
  });

  it('uses scene name when provided', () => {
    const ir = emitIR(makeDoc([makeScene([], 'intro')]), lightTheme);
    expect(ir.scenes[0].id).toBe('scene-intro');
  });

  it('creates multiple scenes', () => {
    const doc = makeDoc([
      makeScene([], 'first'),
      makeScene([], 'second'),
    ]);
    const ir = emitIR(doc, lightTheme);
    expect(ir.scenes).toHaveLength(2);
    expect(ir.scenes[0].id).toBe('scene-first');
    expect(ir.scenes[1].id).toBe('scene-second');
  });
});

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

describe('emitIR — transitions', () => {
  it('returns no transitions for single scene', () => {
    const ir = emitIR(makeDoc([makeScene([])]), lightTheme);
    expect(ir.transitions).toHaveLength(0);
  });

  it('creates fade transitions between scenes', () => {
    const doc = makeDoc([makeScene([]), makeScene([])]);
    const ir = emitIR(doc, lightTheme);
    expect(ir.transitions).toHaveLength(1);
    expect(ir.transitions[0].type).toBe('fade');
    expect(ir.transitions[0].from).toBe('scene-0');
    expect(ir.transitions[0].to).toBe('scene-1');
  });

  it('applies transition directive', () => {
    const doc = makeDoc(
      [makeScene([]), makeScene([])],
      [{ key: 'transition', value: 'slide-left', loc: loc() }],
    );
    const ir = emitIR(doc, lightTheme);
    expect(ir.transitions[0].type).toBe('slide-left');
  });

  it('ignores invalid transition type', () => {
    const doc = makeDoc(
      [makeScene([]), makeScene([])],
      [{ key: 'transition', value: 'warp', loc: loc() }],
    );
    const ir = emitIR(doc, lightTheme);
    expect(ir.transitions[0].type).toBe('fade');
  });

  it('creates transitions for 3 scenes', () => {
    const doc = makeDoc([makeScene([]), makeScene([]), makeScene([])]);
    const ir = emitIR(doc, lightTheme);
    expect(ir.transitions).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Element emission — nodes
// ---------------------------------------------------------------------------

describe('emitIR — node elements', () => {
  it('emits node as IRShape', () => {
    const node = makeElement('node', { id: 'n1', label: 'Hello' });
    const scene = makeScene([node]);
    const ir = emitIR(makeDoc([scene]), lightTheme);

    const el = ir.scenes[0].elements[0] as IRShape;
    expect(el.type).toBe('shape');
    expect(el.shape).toBe('rect');
    expect(el.id).toBe('n1');
  });

  it('sets innerText from label', () => {
    const node = makeElement('node', { id: 'n1', label: 'Hello' });
    const ir = emitIR(makeDoc([makeScene([node])]), lightTheme);

    const el = ir.scenes[0].elements[0] as IRShape;
    expect(el.innerText).toBeDefined();
    expect(el.innerText!.content).toBe('Hello');
    expect(el.innerText!.align).toBe('center');
    expect(el.innerText!.valign).toBe('middle');
  });

  it('uses custom shape from props', () => {
    const node = makeElement('node', { id: 'n1', props: { shape: 'diamond' } });
    const ir = emitIR(makeDoc([makeScene([node])]), lightTheme);

    const el = ir.scenes[0].elements[0] as IRShape;
    expect(el.shape).toBe('diamond');
  });

  it('applies bold/italic flags to innerText', () => {
    const node = makeElement('node', { id: 'n1', label: 'Hi', flags: ['bold', 'italic'] });
    const ir = emitIR(makeDoc([makeScene([node])]), lightTheme);

    const el = ir.scenes[0].elements[0] as IRShape;
    expect(el.innerText!.fontWeight).toBe('bold');
    expect(el.innerText!.fontStyle).toBe('italic');
  });

  it('applies corner radius from style', () => {
    const node = makeElement('node', { id: 'n1', style: { radius: 2 } });
    const ir = emitIR(makeDoc([makeScene([node])]), lightTheme);

    const el = ir.scenes[0].elements[0] as IRShape;
    expect(el.cornerRadius).toBe(2);
  });

  it('assigns bounds to standalone node', () => {
    const node = makeElement('node', { id: 'n1' });
    const ir = emitIR(makeDoc([makeScene([node])]), lightTheme);

    const el = ir.scenes[0].elements[0];
    expect(el.bounds.w).toBeGreaterThan(0);
    expect(el.bounds.h).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Element emission — text / label
// ---------------------------------------------------------------------------

describe('emitIR — text elements', () => {
  it('emits label as IRText', () => {
    const label = makeElement('label', { id: 'l1', label: 'Title' });
    const ir = emitIR(makeDoc([makeScene([label])]), lightTheme);

    const el = ir.scenes[0].elements[0] as IRText;
    expect(el.type).toBe('text');
    expect(el.content).toBe('Title');
  });

  it('uses theme foreground color', () => {
    const text = makeElement('text', { id: 't1', label: 'Body' });
    const ir = emitIR(makeDoc([makeScene([text])]), lightTheme);

    const el = ir.scenes[0].elements[0] as IRText;
    expect(el.color).toBe(lightTheme.foreground);
  });

  it('applies explicit color from style', () => {
    const text = makeElement('text', { id: 't1', label: 'Red', style: { color: '#ff0000' } });
    const ir = emitIR(makeDoc([makeScene([text])]), lightTheme);

    const el = ir.scenes[0].elements[0] as IRText;
    expect(el.color).toBe('#ff0000');
  });

  it('applies font-size from style', () => {
    const text = makeElement('text', { id: 't1', label: 'Big', style: { 'font-size': 2.4 } });
    const ir = emitIR(makeDoc([makeScene([text])]), lightTheme);

    const el = ir.scenes[0].elements[0] as IRText;
    expect(el.fontSize).toBe(2.4);
  });

  it('applies bold flag', () => {
    const label = makeElement('label', { id: 'l1', label: 'Bold', flags: ['bold'] });
    const ir = emitIR(makeDoc([makeScene([label])]), lightTheme);

    const el = ir.scenes[0].elements[0] as IRText;
    expect(el.fontWeight).toBe('bold');
  });
});

// ---------------------------------------------------------------------------
// Element emission — circle, badge, icon
// ---------------------------------------------------------------------------

describe('emitIR — shape variants', () => {
  it('emits circle as IRShape(circle)', () => {
    const circle = makeElement('circle', { id: 'c1' });
    const ir = emitIR(makeDoc([makeScene([circle])]), lightTheme);

    const el = ir.scenes[0].elements[0] as IRShape;
    expect(el.type).toBe('shape');
    expect(el.shape).toBe('circle');
  });

  it('emits badge as IRShape(pill)', () => {
    const badge = makeElement('badge', { id: 'b1', label: 'NEW' });
    const ir = emitIR(makeDoc([makeScene([badge])]), lightTheme);

    const el = ir.scenes[0].elements[0] as IRShape;
    expect(el.shape).toBe('pill');
    expect(el.innerText!.content).toBe('NEW');
  });

  it('emits icon as IRShape(circle)', () => {
    const icon = makeElement('icon', { id: 'i1' });
    const ir = emitIR(makeDoc([makeScene([icon])]), lightTheme);

    const el = ir.scenes[0].elements[0] as IRShape;
    expect(el.shape).toBe('circle');
  });

  it('emits rect as IRShape(rect)', () => {
    const rect = makeElement('rect', { id: 'r1' });
    const ir = emitIR(makeDoc([makeScene([rect])]), lightTheme);

    const el = ir.scenes[0].elements[0] as IRShape;
    expect(el.shape).toBe('rect');
  });

  it('emits cell as IRShape(rect)', () => {
    const cell = makeElement('cell', { id: 'c1' });
    const ir = emitIR(makeDoc([makeScene([cell])]), lightTheme);

    const el = ir.scenes[0].elements[0] as IRShape;
    expect(el.shape).toBe('rect');
  });
});

// ---------------------------------------------------------------------------
// Element emission — divider, image, list
// ---------------------------------------------------------------------------

describe('emitIR — other element types', () => {
  it('emits divider as IRLine', () => {
    const div = makeElement('divider', { id: 'd1' });
    const ir = emitIR(makeDoc([makeScene([div])]), lightTheme);

    const el = ir.scenes[0].elements[0] as IRLine;
    expect(el.type).toBe('line');
    expect(el.from.x).toBeLessThan(el.to.x);
  });

  it('emits image as IRImage', () => {
    const img = makeElement('image', { id: 'img1', props: { src: 'https://example.com/img.png' } });
    const ir = emitIR(makeDoc([makeScene([img])]), lightTheme);

    const el = ir.scenes[0].elements[0] as IRImage;
    expect(el.type).toBe('image');
    expect(el.src).toBe('https://example.com/img.png');
  });

  it('emits list as IRContainer with text items', () => {
    const list = makeElement('list', { id: 'lst1', items: ['Item A', 'Item B', 'Item C'] });
    const ir = emitIR(makeDoc([makeScene([list])]), lightTheme);

    const el = ir.scenes[0].elements[0] as IRContainer;
    expect(el.type).toBe('container');
    expect(el.children).toHaveLength(3);
    expect((el.children[0] as IRText).content).toContain('Item A');
    expect((el.children[2] as IRText).content).toContain('Item C');
  });
});

// ---------------------------------------------------------------------------
// Box / container elements
// ---------------------------------------------------------------------------

describe('emitIR — box element', () => {
  it('emits box as IRContainer', () => {
    const box = makeElement('box', {
      id: 'box1',
      children: [makeElement('label', { id: 'l1', label: 'Inside' })],
    });
    const ir = emitIR(makeDoc([makeScene([box])]), lightTheme);

    const el = ir.scenes[0].elements[0] as IRContainer;
    expect(el.type).toBe('container');
    expect(el.id).toBe('box1');
    expect(el.children.length).toBeGreaterThanOrEqual(1);
  });

  it('emits title text from box label (P1)', () => {
    const box = makeElement('box', {
      id: 'box1',
      label: 'Hello Depix',
    });
    const ir = emitIR(makeDoc([makeScene([box])]), lightTheme);

    const el = ir.scenes[0].elements[0] as IRContainer;
    expect(el.type).toBe('container');
    const titleChild = el.children.find(c => c.type === 'text' && (c as IRText).content === 'Hello Depix') as IRText;
    expect(titleChild).toBeDefined();
    expect(titleChild.fontWeight).toBe('bold');
    expect(titleChild.fontSize).toBeGreaterThan(0);
  });

  it('emits subtitle text from box props.subtitle (P2)', () => {
    const box = makeElement('box', {
      id: 'box2',
      label: 'Title',
      props: { subtitle: 'A subtitle' },
    });
    const ir = emitIR(makeDoc([makeScene([box])]), lightTheme);

    const el = ir.scenes[0].elements[0] as IRContainer;
    const texts = el.children.filter(c => c.type === 'text') as IRText[];
    expect(texts.length).toBeGreaterThanOrEqual(2);
    expect(texts[0].content).toBe('Title');
    expect(texts[1].content).toBe('A subtitle');
    expect(texts[1].fontSize).toBeLessThanOrEqual(texts[0].fontSize);
  });

  it('emits box with only subtitle (no label)', () => {
    const box = makeElement('box', {
      id: 'box3',
      props: { subtitle: 'Just subtitle' },
    });
    const ir = emitIR(makeDoc([makeScene([box])]), lightTheme);

    const el = ir.scenes[0].elements[0] as IRContainer;
    const texts = el.children.filter(c => c.type === 'text') as IRText[];
    expect(texts).toHaveLength(1);
    expect(texts[0].content).toBe('Just subtitle');
  });

  it('emits title before other children', () => {
    const box = makeElement('box', {
      id: 'box4',
      label: 'Box Title',
      children: [makeElement('label', { id: 'l1', label: 'Child' })],
    });
    const ir = emitIR(makeDoc([makeScene([box])]), lightTheme);

    const el = ir.scenes[0].elements[0] as IRContainer;
    expect(el.children.length).toBeGreaterThanOrEqual(2);
    expect((el.children[0] as IRText).content).toBe('Box Title');
  });
});

// ---------------------------------------------------------------------------
// Style conversion
// ---------------------------------------------------------------------------

describe('emitIR — style conversion', () => {
  it('maps background to fill', () => {
    const node = makeElement('node', { id: 'n1', style: { background: '#ff0000' } });
    const ir = emitIR(makeDoc([makeScene([node])]), lightTheme);

    const el = ir.scenes[0].elements[0];
    expect(el.style.fill).toBe('#ff0000');
  });

  it('maps border to stroke', () => {
    const node = makeElement('node', { id: 'n1', style: { border: '#00ff00' } });
    const ir = emitIR(makeDoc([makeScene([node])]), lightTheme);

    const el = ir.scenes[0].elements[0];
    expect(el.style.stroke).toBe('#00ff00');
  });

  it('maps border-width to strokeWidth', () => {
    const node = makeElement('node', { id: 'n1', style: { 'border-width': 0.5 } });
    const ir = emitIR(makeDoc([makeScene([node])]), lightTheme);

    const el = ir.scenes[0].elements[0];
    expect(el.style.strokeWidth).toBe(0.5);
  });

  it('maps shadow- expanded props to IRShadow', () => {
    const node = makeElement('node', {
      id: 'n1',
      style: {
        'shadow-offsetX': 0,
        'shadow-offsetY': 2,
        'shadow-blur': 6,
        'shadow-color': 'rgba(0,0,0,0.1)',
      },
    });
    const ir = emitIR(makeDoc([makeScene([node])]), lightTheme);

    const el = ir.scenes[0].elements[0];
    expect(el.style.shadow).toEqual({
      offsetX: 0,
      offsetY: 2,
      blur: 6,
      color: 'rgba(0,0,0,0.1)',
    });
  });
});

// ---------------------------------------------------------------------------
// Layout blocks
// ---------------------------------------------------------------------------

describe('emitIR — layout blocks', () => {
  it('emits stack block as IRContainer', () => {
    const block = makeBlock('stack', [
      makeElement('node', { id: 'n1', label: 'A' }),
      makeElement('node', { id: 'n2', label: 'B' }),
    ], { id: 'stack1', props: { direction: 'col', gap: 3 } });

    const ir = emitIR(makeDoc([makeScene([block])]), lightTheme);
    const container = ir.scenes[0].elements[0] as IRContainer;

    expect(container.type).toBe('container');
    expect(container.id).toBe('stack1');
    expect(container.children.length).toBeGreaterThanOrEqual(2);
    expect(container.origin?.sourceType).toBe('stack');
  });

  it('positions stack children vertically', () => {
    const block = makeBlock('stack', [
      makeElement('node', { id: 'n1' }),
      makeElement('node', { id: 'n2' }),
    ], { props: { direction: 'col', gap: 2 } });

    const ir = emitIR(makeDoc([makeScene([block])]), lightTheme);
    const container = ir.scenes[0].elements[0] as IRContainer;
    const shapes = container.children.filter(c => c.type === 'shape');

    expect(shapes[0].bounds.y).toBeLessThan(shapes[1].bounds.y);
  });

  it('positions stack children horizontally in row mode', () => {
    const block = makeBlock('stack', [
      makeElement('node', { id: 'n1' }),
      makeElement('node', { id: 'n2' }),
    ], { props: { direction: 'row', gap: 2 } });

    const ir = emitIR(makeDoc([makeScene([block])]), lightTheme);
    const container = ir.scenes[0].elements[0] as IRContainer;
    const shapes = container.children.filter(c => c.type === 'shape');

    expect(shapes[0].bounds.x).toBeLessThan(shapes[1].bounds.x);
  });

  it('emits grid block with correct number of children', () => {
    const block = makeBlock('grid', [
      makeElement('node', { id: 'n1' }),
      makeElement('node', { id: 'n2' }),
      makeElement('node', { id: 'n3' }),
      makeElement('node', { id: 'n4' }),
    ], { props: { cols: 2, gap: 2 } });

    const ir = emitIR(makeDoc([makeScene([block])]), lightTheme);
    const container = ir.scenes[0].elements[0] as IRContainer;
    const shapes = container.children.filter(c => c.type === 'shape');

    expect(shapes).toHaveLength(4);
  });

  it('emits flow block with origin', () => {
    const block = makeBlock('flow', [
      makeElement('node', { id: 'a' }),
      makeElement('node', { id: 'b' }),
      makeEdge('a', 'b'),
    ], { props: { direction: 'right' } });

    const ir = emitIR(makeDoc([makeScene([block])]), lightTheme);
    const container = ir.scenes[0].elements[0] as IRContainer;

    expect(container.origin?.sourceType).toBe('flow');
  });

  it('emits group block', () => {
    const block = makeBlock('group', [
      makeElement('node', { id: 'n1' }),
      makeElement('node', { id: 'n2' }),
    ]);

    const ir = emitIR(makeDoc([makeScene([block])]), lightTheme);
    const container = ir.scenes[0].elements[0] as IRContainer;

    expect(container.type).toBe('container');
    expect(container.origin?.sourceType).toBe('group');
  });

  it('emits layers block', () => {
    const block = makeBlock('layers', [
      makeElement('layer', { id: 'l1' }),
      makeElement('layer', { id: 'l2' }),
    ]);

    const ir = emitIR(makeDoc([makeScene([block])]), lightTheme);
    const container = ir.scenes[0].elements[0] as IRContainer;

    expect(container.type).toBe('container');
    expect(container.origin?.sourceType).toBe('layers');
  });

  it('emits canvas block (default layout)', () => {
    const block = makeBlock('canvas', [
      makeElement('node', { id: 'n1' }),
    ]);

    const ir = emitIR(makeDoc([makeScene([block])]), lightTheme);
    const container = ir.scenes[0].elements[0] as IRContainer;

    expect(container.type).toBe('container');
    expect(container.origin?.sourceType).toBe('canvas');
  });
});

// ---------------------------------------------------------------------------
// Edge routing
// ---------------------------------------------------------------------------

describe('emitIR — edges', () => {
  it('routes top-level edges between elements', () => {
    const scene = makeScene([
      makeElement('node', { id: 'a', label: 'A' }),
      makeElement('node', { id: 'b', label: 'B' }),
      makeEdge('a', 'b'),
    ]);
    const ir = emitIR(makeDoc([scene]), lightTheme);

    const edges = ir.scenes[0].elements.filter(e => e.type === 'edge') as IREdgeType[];
    expect(edges).toHaveLength(1);
    expect(edges[0].fromId).toBe('a');
    expect(edges[0].toId).toBe('b');
  });

  it('applies arrow from edge style ->', () => {
    const scene = makeScene([
      makeElement('node', { id: 'a' }),
      makeElement('node', { id: 'b' }),
      makeEdge('a', 'b', '->'),
    ]);
    const ir = emitIR(makeDoc([scene]), lightTheme);

    const edge = ir.scenes[0].elements.find(e => e.type === 'edge') as IREdgeType;
    expect(edge.arrowEnd).toBe('triangle');
  });

  it('applies bidirectional arrows from <->', () => {
    const scene = makeScene([
      makeElement('node', { id: 'a' }),
      makeElement('node', { id: 'b' }),
      makeEdge('a', 'b', '<->'),
    ]);
    const ir = emitIR(makeDoc([scene]), lightTheme);

    const edge = ir.scenes[0].elements.find(e => e.type === 'edge') as IREdgeType;
    expect(edge.arrowStart).toBe('triangle');
    expect(edge.arrowEnd).toBe('triangle');
  });

  it('skips edges with missing element IDs', () => {
    const scene = makeScene([
      makeElement('node', { id: 'a' }),
      makeEdge('a', 'missing'),
    ]);
    const ir = emitIR(makeDoc([scene]), lightTheme);

    const edges = ir.scenes[0].elements.filter(e => e.type === 'edge');
    expect(edges).toHaveLength(0);
  });

  it('routes edges inside blocks', () => {
    const block = makeBlock('flow', [
      makeElement('node', { id: 'x' }),
      makeElement('node', { id: 'y' }),
      makeEdge('x', 'y'),
    ]);
    const ir = emitIR(makeDoc([makeScene([block])]), lightTheme);

    const container = ir.scenes[0].elements[0] as IRContainer;
    const edges = container.children.filter(c => c.type === 'edge') as IREdgeType[];
    expect(edges).toHaveLength(1);
    expect(edges[0].fromId).toBe('x');
    expect(edges[0].toId).toBe('y');
  });

  it('routes edge with label', () => {
    const scene = makeScene([
      makeElement('node', { id: 'a' }),
      makeElement('node', { id: 'b' }),
      { kind: 'edge' as const, fromId: 'a', toId: 'b', edgeStyle: '->' as const, label: 'connects', loc: loc() },
    ]);
    const ir = emitIR(makeDoc([scene]), lightTheme);

    const edge = ir.scenes[0].elements.find(e => e.type === 'edge') as IREdgeType;
    expect(edge.labels).toBeDefined();
    expect(edge.labels![0].text).toBe('connects');
  });
});

// ---------------------------------------------------------------------------
// Nested blocks
// ---------------------------------------------------------------------------

describe('emitIR — nested blocks', () => {
  it('handles block inside block', () => {
    const innerBlock = makeBlock('stack', [
      makeElement('node', { id: 'inner1' }),
      makeElement('node', { id: 'inner2' }),
    ], { id: 'inner-stack', props: { direction: 'row' } });

    const outerBlock = makeBlock('stack', [
      innerBlock,
      makeElement('node', { id: 'outer1' }),
    ], { id: 'outer-stack', props: { direction: 'col' } });

    const ir = emitIR(makeDoc([makeScene([outerBlock])]), lightTheme);
    const outer = ir.scenes[0].elements[0] as IRContainer;

    expect(outer.type).toBe('container');
    expect(outer.id).toBe('outer-stack');

    const innerContainer = outer.children.find(c => c.type === 'container') as IRContainer;
    expect(innerContainer).toBeDefined();
    expect(innerContainer.id).toBe('inner-stack');
  });
});

// ---------------------------------------------------------------------------
// Element measurement
// ---------------------------------------------------------------------------

describe('emitIR — element sizing', () => {
  it('standalone node fills available canvas space', () => {
    const node = makeElement('node', { id: 'n1' });
    const ir = emitIR(makeDoc([makeScene([node])]), lightTheme);

    const el = ir.scenes[0].elements[0];
    // Single standalone node fills the full canvas allocation (90×90 within 5-unit margin)
    expect(el.bounds.w).toBe(90);
    expect(el.bounds.h).toBe(90);
  });

  it('uses explicit size props', () => {
    const node = makeElement('node', { id: 'n1', props: { width: 25, height: 15 } });
    const ir = emitIR(makeDoc([makeScene([node])]), lightTheme);

    const el = ir.scenes[0].elements[0];
    expect(el.bounds.w).toBe(25);
    expect(el.bounds.h).toBe(15);
  });

  it('uses square size for circle', () => {
    const circle = makeElement('circle', { id: 'c1' });
    const ir = emitIR(makeDoc([makeScene([circle])]), lightTheme);

    const el = ir.scenes[0].elements[0];
    expect(el.bounds.w).toBe(el.bounds.h);
  });
});

// ---------------------------------------------------------------------------
// Tree layout
// ---------------------------------------------------------------------------

describe('emitIR — tree block', () => {
  it('creates tree layout from edges', () => {
    const block = makeBlock('tree', [
      makeElement('node', { id: 'root', label: 'Root' }),
      makeElement('node', { id: 'child1', label: 'C1' }),
      makeElement('node', { id: 'child2', label: 'C2' }),
      makeEdge('root', 'child1'),
      makeEdge('root', 'child2'),
    ], { props: { direction: 'down' } });

    const ir = emitIR(makeDoc([makeScene([block])]), lightTheme);
    const container = ir.scenes[0].elements[0] as IRContainer;

    // Should have 3 shapes + 2 edges
    const shapes = container.children.filter(c => c.type === 'shape');
    const edges = container.children.filter(c => c.type === 'edge');
    expect(shapes).toHaveLength(3);
    expect(edges).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Full pipeline (multiple elements in scene)
// ---------------------------------------------------------------------------

describe('emitIR — full scene composition', () => {
  it('renders mixed elements in order', () => {
    const scene = makeScene([
      makeElement('label', { id: 'title', label: 'Title' }),
      makeBlock('stack', [
        makeElement('node', { id: 'n1', label: 'Node 1' }),
        makeElement('node', { id: 'n2', label: 'Node 2' }),
      ], { id: 's1', props: { direction: 'row' } }),
      makeElement('divider', { id: 'div1' }),
    ]);

    const ir = emitIR(makeDoc([scene]), lightTheme);
    expect(ir.scenes[0].elements).toHaveLength(3);
    expect(ir.scenes[0].elements[0].type).toBe('text');
    expect(ir.scenes[0].elements[1].type).toBe('container');
    expect(ir.scenes[0].elements[2].type).toBe('line');
  });

  it('auto-stacks top-level elements vertically', () => {
    const scene = makeScene([
      makeElement('node', { id: 'n1' }),
      makeElement('node', { id: 'n2' }),
      makeElement('node', { id: 'n3' }),
    ]);

    const ir = emitIR(makeDoc([scene]), lightTheme);
    const elements = ir.scenes[0].elements;

    // Each element should have increasing Y
    expect(elements[0].bounds.y).toBeLessThan(elements[1].bounds.y);
    expect(elements[1].bounds.y).toBeLessThan(elements[2].bounds.y);
  });
});

// ---------------------------------------------------------------------------
// ID assignment
// ---------------------------------------------------------------------------

describe('emitIR — ID assignment', () => {
  it('uses explicit ID from AST', () => {
    const node = makeElement('node', { id: 'my-node' });
    const ir = emitIR(makeDoc([makeScene([node])]), lightTheme);

    expect(ir.scenes[0].elements[0].id).toBe('my-node');
  });

  it('generates ID when none provided', () => {
    const node = makeElement('node', {});
    const ir = emitIR(makeDoc([makeScene([node])]), lightTheme);

    expect(ir.scenes[0].elements[0].id).toBeTruthy();
    expect(typeof ir.scenes[0].elements[0].id).toBe('string');
  });

  it('uses block ID for container', () => {
    const block = makeBlock('stack', [
      makeElement('node', { id: 'n1' }),
    ], { id: 'my-stack' });

    const ir = emitIR(makeDoc([makeScene([block])]), lightTheme);
    expect(ir.scenes[0].elements[0].id).toBe('my-stack');
  });
});
