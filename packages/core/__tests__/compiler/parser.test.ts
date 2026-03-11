import { describe, it, expect } from 'vitest';
import { parse } from '../../src/compiler/parser.js';
import type {
  ASTBlock,
  ASTElement,
  ASTEdge,
} from '../../src/compiler/ast.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function firstScene(input: string): ASTBlock {
  const { ast } = parse(input);
  return ast.scenes[0];
}

function firstChild(input: string): ASTBlock | ASTElement | ASTEdge {
  const scene = firstScene(input);
  return scene.children[0] as ASTBlock | ASTElement | ASTEdge;
}

function noErrors(input: string): void {
  const result = parse(input);
  if (result.errors.length > 0) {
    throw new Error(
      `Expected no errors, got:\n${result.errors.map((e) => `  [${e.line}:${e.column}] ${e.message}`).join('\n')}`,
    );
  }
}

// ===========================================================================
// Document structure
// ===========================================================================

describe('Document structure', () => {
  it('parses empty document', () => {
    const { ast, errors } = parse('');
    expect(ast.directives).toHaveLength(0);
    expect(ast.scenes).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it('parses directives only', () => {
    const { ast } = parse('@page 16:9\n@style sketch');
    expect(ast.directives).toHaveLength(2);
    expect(ast.directives[0]).toMatchObject({ key: 'page', value: '16:9' });
    expect(ast.directives[1]).toMatchObject({ key: 'style', value: 'sketch' });
  });

  it('parses single explicit scene', () => {
    const { ast } = parse('scene "Title" {\n  node "A"\n}');
    expect(ast.scenes).toHaveLength(1);
    expect(ast.scenes[0].label).toBe('Title');
    expect(ast.scenes[0].children).toHaveLength(1);
  });

  it('parses multiple scenes', () => {
    const input = `scene "Intro" {
  node "A"
}

scene "Body" {
  node "B"
}`;
    const { ast } = parse(input);
    expect(ast.scenes).toHaveLength(2);
    expect(ast.scenes[0].label).toBe('Intro');
    expect(ast.scenes[1].label).toBe('Body');
  });

  it('wraps sceneless content in implicit scene', () => {
    const { ast } = parse('node "A"\nnode "B"');
    expect(ast.scenes).toHaveLength(1);
    expect(ast.scenes[0].label).toBeUndefined();
    expect(ast.scenes[0].children).toHaveLength(2);
  });

  it('parses directives + scenes together', () => {
    const input = `@page 16:9
@style sketch

scene "Slide 1" {
  node "A"
}`;
    const { ast, errors } = parse(input);
    expect(errors).toHaveLength(0);
    expect(ast.directives).toHaveLength(2);
    expect(ast.scenes).toHaveLength(1);
  });
});

// ===========================================================================
// Directives
// ===========================================================================

describe('Directives', () => {
  it('parses @page 16:9', () => {
    const { ast } = parse('@page 16:9');
    expect(ast.directives[0]).toMatchObject({ key: 'page', value: '16:9' });
  });

  it('parses @style sketch', () => {
    const { ast } = parse('@style sketch');
    expect(ast.directives[0]).toMatchObject({ key: 'style', value: 'sketch' });
  });

  it('parses @transition fade', () => {
    const { ast } = parse('@transition fade');
    expect(ast.directives[0]).toMatchObject({
      key: 'transition',
      value: 'fade',
    });
  });

  it('parses @page with letter size', () => {
    const { ast } = parse('@page A4');
    expect(ast.directives[0]).toMatchObject({ key: 'page', value: 'A4' });
  });
});

// ===========================================================================
// Flow block
// ===========================================================================

describe('Flow block', () => {
  it('parses flow with direction', () => {
    const block = firstChild('flow direction:right {\n  node "A"\n}') as ASTBlock;
    expect(block.kind).toBe('block');
    expect(block.blockType).toBe('flow');
    expect(block.props.direction).toBe('right');
  });

  it('parses flow auto-connect (implicit edges from declaration order)', () => {
    const input = `flow {
  node "A"
  node "B"
  node "C"
}`;
    noErrors(input);
    const block = firstChild(input) as ASTBlock;
    expect(block.children).toHaveLength(3);
    expect(block.children.every((c) => (c as ASTElement).kind === 'element')).toBe(true);
  });

  it('parses flow with explicit edges', () => {
    const input = `flow direction:right {
  node "A" #a
  node "B" #b
  node "C" #c
  #a -> #b "label"
  #a -> #c
}`;
    noErrors(input);
    const block = firstChild(input) as ASTBlock;
    const edges = block.children.filter((c) => c.kind === 'edge') as ASTEdge[];
    expect(edges).toHaveLength(2);
    expect(edges[0]).toMatchObject({
      fromId: 'a',
      toId: 'b',
      edgeStyle: '->',
      label: 'label',
    });
    expect(edges[1]).toMatchObject({ fromId: 'a', toId: 'c', edgeStyle: '->' });
  });

  it('parses chained edges #a -> #b -> #c', () => {
    const input = `flow {
  node "A" #a
  node "B" #b
  node "C" #c
  #a -> #b -> #c
}`;
    noErrors(input);
    const block = firstChild(input) as ASTBlock;
    const edges = block.children.filter((c) => c.kind === 'edge') as ASTEdge[];
    expect(edges).toHaveLength(2);
    expect(edges[0]).toMatchObject({ fromId: 'a', toId: 'b' });
    expect(edges[1]).toMatchObject({ fromId: 'b', toId: 'c' });
  });

  it('parses edge with label on chain', () => {
    const input = `flow {
  node "A" #a
  node "B" #b
  #a -> #b "연결"
}`;
    noErrors(input);
    const block = firstChild(input) as ASTBlock;
    const edge = block.children.find((c) => c.kind === 'edge') as ASTEdge;
    expect(edge.label).toBe('연결');
  });
});

// ===========================================================================
// Stack block
// ===========================================================================

describe('Stack block', () => {
  it('parses stack with row direction and gap', () => {
    const input = `stack direction:row gap:md {
  box "A"
  box "B"
}`;
    noErrors(input);
    const block = firstChild(input) as ASTBlock;
    expect(block.blockType).toBe('stack');
    expect(block.props.direction).toBe('row');
    expect(block.props.gap).toBe('md');
    expect(block.children).toHaveLength(2);
  });

  it('parses stack with align', () => {
    const block = firstChild('stack align:center {\n  node "A"\n}') as ASTBlock;
    expect(block.props.align).toBe('center');
  });

  it('parses nested stack with children', () => {
    const input = `stack direction:row gap:lg {
  box "Card 1" {
    list ["a", "b"]
  }
  box "Card 2"
}`;
    noErrors(input);
    const block = firstChild(input) as ASTBlock;
    expect(block.children).toHaveLength(2);
    const box1 = block.children[0] as ASTElement;
    expect(box1.elementType).toBe('box');
    expect(box1.children).toHaveLength(1);
  });
});

// ===========================================================================
// Grid block
// ===========================================================================

describe('Grid block', () => {
  it('parses grid with cols', () => {
    const input = `grid cols:3 {
  cell "A"
  cell "B"
  cell "C"
}`;
    noErrors(input);
    const block = firstChild(input) as ASTBlock;
    expect(block.blockType).toBe('grid');
    expect(block.props.cols).toBe(3);
    expect(block.children).toHaveLength(3);
  });

  it('parses grid cells with header flag', () => {
    const input = `grid cols:2 {
  cell "H1" { header }
  cell "H2" { header }
  cell "D1"
  cell "D2"
}`;
    noErrors(input);
    const block = firstChild(input) as ASTBlock;
    const cells = block.children as ASTElement[];
    expect(cells[0].flags).toContain('header');
    expect(cells[2].flags).not.toContain('header');
  });
});

// ===========================================================================
// Tree block
// ===========================================================================

describe('Tree block', () => {
  it('parses tree with nested nodes', () => {
    const input = `tree direction:down {
  node "CEO" {
    node "CTO" {
      node "Dev"
      node "Infra"
    }
    node "CFO"
  }
}`;
    noErrors(input);
    const block = firstChild(input) as ASTBlock;
    expect(block.blockType).toBe('tree');
    expect(block.props.direction).toBe('down');

    // CEO is top-level child
    expect(block.children).toHaveLength(1);
    const ceo = block.children[0] as ASTElement;
    expect(ceo.label).toBe('CEO');
    expect(ceo.children).toHaveLength(2);

    // CTO has two children
    const cto = ceo.children[0] as ASTElement;
    expect(cto.label).toBe('CTO');
    expect(cto.children).toHaveLength(2);
  });
});

// ===========================================================================
// Group and layers blocks
// ===========================================================================

describe('Group and layers blocks', () => {
  it('parses group with label and children', () => {
    const input = `group "명반응" {
  label "틸라코이드"
  label "H₂O → O₂"
}`;
    noErrors(input);
    const block = firstChild(input) as ASTBlock;
    expect(block.blockType).toBe('group');
    expect(block.label).toBe('명반응');
    expect(block.children).toHaveLength(2);
  });

  it('parses layers block', () => {
    const input = `layers {
  layer "Frontend" { color: blue }
  layer "API"
  layer "DB" { color: orange }
}`;
    noErrors(input);
    const block = firstChild(input) as ASTBlock;
    expect(block.blockType).toBe('layers');
    expect(block.children).toHaveLength(3);
  });
});

// ===========================================================================
// Canvas fallback
// ===========================================================================

describe('Canvas fallback', () => {
  it('parses canvas with low-level elements', () => {
    const input = `canvas {
  rect { x:10 y:10 w:30 h:20 fill:#3b82f6 }
  circle { x:50 y:50 r:15 fill:#ef4444 }
}`;
    noErrors(input);
    const block = firstChild(input) as ASTBlock;
    expect(block.blockType).toBe('canvas');
    expect(block.children).toHaveLength(2);
    const rectEl = block.children[0] as ASTElement;
    expect(rectEl.elementType).toBe('rect');
    expect(rectEl.props.x).toBe(10);
  });
});

// ===========================================================================
// Visual elements
// ===========================================================================

describe('Visual elements', () => {
  it('parses node with id and props', () => {
    const input = 'node "처리" #proc { shape: diamond }';
    noErrors(input);
    const el = firstChild(input) as ASTElement;
    expect(el.kind).toBe('element');
    expect(el.elementType).toBe('node');
    expect(el.label).toBe('처리');
    expect(el.id).toBe('proc');
    expect(el.props.shape).toBe('diamond');
  });

  it('parses box with nested content', () => {
    const input = `box "Title" {
  subtitle: "Subtitle"
  list ["a", "b"]
}`;
    noErrors(input);
    const el = firstChild(input) as ASTElement;
    expect(el.elementType).toBe('box');
    expect(el.label).toBe('Title');
    expect(el.props.subtitle).toBe('Subtitle');
    expect(el.children).toHaveLength(1); // list element
  });

  it('parses label with bold flag', () => {
    const el = firstChild('label "Important" { bold }') as ASTElement;
    expect(el.elementType).toBe('label');
    expect(el.flags).toContain('bold');
  });

  it('parses list with items', () => {
    const input = 'list ["item1", "item2", "item3"]';
    noErrors(input);
    const el = firstChild(input) as ASTElement;
    expect(el.elementType).toBe('list');
    expect(el.items).toEqual(['item1', 'item2', 'item3']);
  });

  it('parses list with ordered flag', () => {
    const input = 'list ordered ["Step 1", "Step 2"]';
    noErrors(input);
    const el = firstChild(input) as ASTElement;
    expect(el.flags).toContain('ordered');
    expect(el.items).toEqual(['Step 1', 'Step 2']);
  });

  it('parses badge with color', () => {
    const el = firstChild('badge "ATP" { color: green }') as ASTElement;
    expect(el.elementType).toBe('badge');
    expect(el.style.color).toBe('green');
  });

  it('parses badge with outline flag', () => {
    const el = firstChild('badge "v2.0" { outline }') as ASTElement;
    expect(el.flags).toContain('outline');
  });

  it('parses icon with size', () => {
    const el = firstChild('icon "database" { size: lg }') as ASTElement;
    expect(el.elementType).toBe('icon');
    expect(el.props.size).toBe('lg');
  });

  it('parses divider without arguments', () => {
    const el = firstChild('divider') as ASTElement;
    expect(el.elementType).toBe('divider');
    expect(el.label).toBeUndefined();
  });

  it('parses divider with label', () => {
    const el = firstChild('divider "또는"') as ASTElement;
    expect(el.label).toBe('또는');
  });

  it('parses image with fit', () => {
    const el = firstChild(
      'image "https://example.com/photo.jpg" { fit: cover }',
    ) as ASTElement;
    expect(el.elementType).toBe('image');
    expect(el.label).toBe('https://example.com/photo.jpg');
    expect(el.props.fit).toBe('cover');
  });
});

// ===========================================================================
// Inline styles
// ===========================================================================

describe('Inline styles', () => {
  it('parses background color', () => {
    const el = firstChild(
      'node "A" { background: #fee2e2 }',
    ) as ASTElement;
    expect(el.style.background).toBe('#fee2e2');
  });

  it('parses multiple styles', () => {
    const el = firstChild(
      'node "A" { background: #fee2e2, border: #ef4444, color: #991b1b }',
    ) as ASTElement;
    expect(el.style.background).toBe('#fee2e2');
    expect(el.style.border).toBe('#ef4444');
    expect(el.style.color).toBe('#991b1b');
  });

  it('parses shadow and radius tokens', () => {
    const el = firstChild('box "Card" { shadow: md, radius: lg }') as ASTElement;
    expect(el.style.shadow).toBe('md');
    expect(el.style.radius).toBe('lg');
  });

  it('parses font-size and font-weight', () => {
    const el = firstChild(
      'label "Title" { font-size: 2xl, font-weight: bold }',
    ) as ASTElement;
    expect(el.style['font-size']).toBe('2xl');
    expect(el.style['font-weight']).toBe('bold');
  });

  it('parses opacity as number', () => {
    const el = firstChild('node "A" { opacity: 0.5 }') as ASTElement;
    expect(el.style.opacity).toBe(0.5);
  });

  it('parses semantic color names', () => {
    const el = firstChild('box "A" { background: primary }') as ASTElement;
    expect(el.style.background).toBe('primary');
  });

  it('parses gradient value', () => {
    const el = firstChild(
      'box "A" { background: gradient(right, #f00, #00f) }',
    ) as ASTElement;
    expect(el.style.background).toBe('gradient(right, #f00, #00f)');
  });
});

// ===========================================================================
// Edge declarations
// ===========================================================================

describe('Edge declarations', () => {
  it('parses all arrow styles', () => {
    const input = `flow {
  node "A" #a
  node "B" #b
  node "C" #c
  node "D" #d
  #a -> #b
  #a --> #c
  #a -- #d
  #b <-> #c
}`;
    noErrors(input);
    const block = firstChild(input) as ASTBlock;
    const edges = block.children.filter((c) => c.kind === 'edge') as ASTEdge[];
    expect(edges[0].edgeStyle).toBe('->');
    expect(edges[1].edgeStyle).toBe('-->');
    expect(edges[2].edgeStyle).toBe('--');
    expect(edges[3].edgeStyle).toBe('<->');
  });

  it('parses scene-level edges', () => {
    const input = `scene "Test" {
  node "A" #a
  node "B" #b
  #a -> #b
}`;
    noErrors(input);
    const scene = firstScene(input);
    const edges = scene.children.filter((c) => c.kind === 'edge');
    expect(edges).toHaveLength(1);
  });
});

// ===========================================================================
// Nested structures
// ===========================================================================

describe('Nesting', () => {
  it('parses flow inside stack', () => {
    const input = `stack direction:row {
  flow {
    node "A"
    node "B"
  }
  flow {
    node "C"
    node "D"
  }
}`;
    noErrors(input);
    const stack = firstChild(input) as ASTBlock;
    expect(stack.blockType).toBe('stack');
    expect(stack.children).toHaveLength(2);
    expect((stack.children[0] as ASTBlock).blockType).toBe('flow');
  });

  it('parses group inside flow', () => {
    const input = `flow direction:right {
  group "Phase 1" #p1 {
    label "Step A"
    label "Step B"
  }
  group "Phase 2" #p2 {
    label "Step C"
  }
  #p1 -> #p2
}`;
    noErrors(input);
    const flow = firstChild(input) as ASTBlock;
    const groups = flow.children.filter(
      (c) => c.kind === 'block' && (c as ASTBlock).blockType === 'group',
    );
    expect(groups).toHaveLength(2);
  });

  it('parses stack with box containing list', () => {
    const input = `stack direction:row {
  box "Card" {
    list ["a", "b", "c"]
  }
}`;
    noErrors(input);
    const stack = firstChild(input) as ASTBlock;
    const box = stack.children[0] as ASTElement;
    expect(box.elementType).toBe('box');
    expect(box.children).toHaveLength(1);
    const list = box.children[0] as ASTElement;
    expect(list.elementType).toBe('list');
    expect(list.items).toEqual(['a', 'b', 'c']);
  });
});

// ===========================================================================
// Error recovery
// ===========================================================================

describe('Error recovery', () => {
  it('reports error for unclosed brace', () => {
    const result = parse('flow {');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.message.includes('Unclosed'))).toBe(true);
  });

  it('reports error for missing id after arrow', () => {
    const result = parse('flow {\n  #a -> \n}');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('continues parsing after error', () => {
    const result = parse('~ node "A"');
    // Should have tokenizer error for ~ and still parse node
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.ast.scenes.length).toBeGreaterThanOrEqual(1);
  });

  it('error includes line and column', () => {
    const result = parse('flow {\n  ~ \n}');
    const err = result.errors.find((e) => e.message.includes('Unexpected'));
    expect(err).toBeDefined();
    expect(err!.line).toBe(2);
  });
});

// ===========================================================================
// Comprehensive examples from DSL v2 spec
// ===========================================================================

describe('Comprehensive spec examples', () => {
  it('parses photosynthesis diagram', () => {
    const input = `@page 16:9

flow direction:right {
  group "명반응" #light {
    icon "sun"
    label "틸라코이드"
    label "H₂O → O₂"
    badge "산소 방출" { color: blue }
  }

  group "암반응" #dark {
    label "캘빈 회로"
    label "CO₂ → C₆H₁₂O₆"
    badge "포도당 합성" { color: green }
  }

  #light -> #dark "ATP\\nNADPH"
}`;
    const result = parse(input);
    expect(result.errors).toHaveLength(0);
    expect(result.ast.directives).toHaveLength(1);
    expect(result.ast.scenes).toHaveLength(1);

    const flow = result.ast.scenes[0].children[0] as ASTBlock;
    expect(flow.blockType).toBe('flow');
    expect(flow.props.direction).toBe('right');

    const groups = flow.children.filter((c) => c.kind === 'block') as ASTBlock[];
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe('명반응');
    expect(groups[0].id).toBe('light');

    const edges = flow.children.filter((c) => c.kind === 'edge') as ASTEdge[];
    expect(edges).toHaveLength(1);
    expect(edges[0].label).toBe('ATP\nNADPH');
  });

  it('parses React lifecycle diagram', () => {
    const input = `@page 16:9

stack direction:row gap:lg {
  box "Mounting" {
    background: primary
    list [
      "constructor()"
      "render()"
      "componentDidMount()"
    ]
  }

  box "Updating" {
    background: info
    list [
      "shouldComponentUpdate()"
      "render()"
      "componentDidUpdate()"
    ]
  }

  box "Unmounting" {
    background: warning
    list [
      "componentWillUnmount()"
    ]
  }
}`;
    const result = parse(input);
    expect(result.errors).toHaveLength(0);

    const stack = result.ast.scenes[0].children[0] as ASTBlock;
    expect(stack.blockType).toBe('stack');
    expect(stack.props.direction).toBe('row');
    expect(stack.props.gap).toBe('lg');
    expect(stack.children).toHaveLength(3);

    const mounting = stack.children[0] as ASTElement;
    expect(mounting.label).toBe('Mounting');
    expect(mounting.style.background).toBe('primary');
    const mountList = mounting.children[0] as ASTElement;
    expect(mountList.items).toHaveLength(3);
  });

  it('parses comparison grid diagram', () => {
    const input = `@page 16:9

grid cols:3 {
  cell ""
  cell "React" { header }
  cell "Vue" { header }

  cell "학습 곡선" { header }
  cell "중간" { color: warning }
  cell "쉬움" { color: success }
}`;
    const result = parse(input);
    expect(result.errors).toHaveLength(0);

    const grid = result.ast.scenes[0].children[0] as ASTBlock;
    expect(grid.blockType).toBe('grid');
    expect(grid.props.cols).toBe(3);
    expect(grid.children).toHaveLength(6);
  });

  it('parses multi-scene presentation', () => {
    const input = `@page 16:9

scene "인트로" {
  box "Depix" {
    subtitle: "선언적 그래픽 DSL"
    font-size: 2xl
    center
  }
}

scene "기능 소개" {
  stack direction:row gap:lg {
    box "기능 1" {
      icon "zap"
      label "빠른 생성"
    }
    box "기능 2" {
      icon "edit"
      label "쉬운 편집"
    }
  }
}`;
    const result = parse(input);
    expect(result.errors).toHaveLength(0);
    expect(result.ast.scenes).toHaveLength(2);
    expect(result.ast.scenes[0].label).toBe('인트로');
    expect(result.ast.scenes[1].label).toBe('기능 소개');

    const intro = result.ast.scenes[0].children[0] as ASTElement;
    expect(intro.elementType).toBe('box');
    expect(intro.style['font-size']).toBe('2xl');
    expect(intro.flags).toContain('center');
  });
});

// ===========================================================================
// Snapshot tests (AST structure)
// ===========================================================================

describe('AST snapshots', () => {
  it('flow-basic matches snapshot', () => {
    const input = `flow direction:right {
  node "A" #a
  node "B" #b
  #a -> #b
}`;
    const { ast } = parse(input);
    expect(ast).toMatchSnapshot();
  });

  it('stack-row matches snapshot', () => {
    const input = `stack direction:row gap:md {
  box "Card 1"
  box "Card 2"
}`;
    const { ast } = parse(input);
    expect(ast).toMatchSnapshot();
  });

  it('grid-basic matches snapshot', () => {
    const input = `grid cols:2 {
  cell "H1" { header }
  cell "H2" { header }
  cell "A"
  cell "B"
}`;
    const { ast } = parse(input);
    expect(ast).toMatchSnapshot();
  });
});

// ===========================================================================
// Element with block child (content-flexible slots)
// ===========================================================================

describe('Element with block child', () => {
  it('parses heading with flow block child', () => {
    const input = `scene "S" {
  heading flow direction:right {
    node "A" #a
    node "B" #b
    #a -> #b
  }
}`;
    noErrors(input);
    const scene = firstScene(input);
    const heading = scene.children[0] as ASTElement;
    expect(heading.kind).toBe('element');
    expect(heading.elementType).toBe('heading');
    expect(heading.label).toBeUndefined();
    expect(heading.children).toHaveLength(1);

    const flowBlock = heading.children[0] as ASTBlock;
    expect(flowBlock.kind).toBe('block');
    expect(flowBlock.blockType).toBe('flow');
    expect(flowBlock.props.direction).toBe('right');
    expect(flowBlock.children.length).toBeGreaterThanOrEqual(2);
  });

  it('parses bullet with table block child', () => {
    const input = `scene "S" {
  bullet table {
    "Col1" "Col2"
    "A" "B"
  }
}`;
    noErrors(input);
    const scene = firstScene(input);
    const bullet = scene.children[0] as ASTElement;
    expect(bullet.kind).toBe('element');
    expect(bullet.elementType).toBe('bullet');
    expect(bullet.label).toBeUndefined();
    expect(bullet.children).toHaveLength(1);

    const tableBlock = bullet.children[0] as ASTBlock;
    expect(tableBlock.kind).toBe('block');
    expect(tableBlock.blockType).toBe('table');
  });

  it('parses stat with chart block child', () => {
    const input = `scene "S" {
  stat chart "revenue" type:bar x:"Q" y:"Rev"
}`;
    noErrors(input);
    const scene = firstScene(input);
    const stat = scene.children[0] as ASTElement;
    expect(stat.kind).toBe('element');
    expect(stat.elementType).toBe('stat');
    expect(stat.children).toHaveLength(1);

    const chartBlock = stat.children[0] as ASTBlock;
    expect(chartBlock.kind).toBe('block');
    expect(chartBlock.blockType).toBe('chart');
    expect(chartBlock.label).toBe('revenue');
    expect(chartBlock.props.type).toBe('bar');
  });

  it('still parses heading with string label normally', () => {
    const input = `scene "S" {
  heading "Normal Title"
}`;
    noErrors(input);
    const scene = firstScene(input);
    const heading = scene.children[0] as ASTElement;
    expect(heading.kind).toBe('element');
    expect(heading.elementType).toBe('heading');
    expect(heading.label).toBe('Normal Title');
    expect(heading.children).toHaveLength(0);
  });

  it('mixes string elements and block-child elements in same scene', () => {
    const input = `scene "S" {
  heading flow {
    node "X" #x
  }
  bullet "Normal bullet"
  bullet table {
    "A" "B"
  }
}`;
    noErrors(input);
    const scene = firstScene(input);
    expect(scene.children).toHaveLength(3);

    const heading = scene.children[0] as ASTElement;
    expect(heading.elementType).toBe('heading');
    expect(heading.children).toHaveLength(1);
    expect((heading.children[0] as ASTBlock).blockType).toBe('flow');

    const bullet1 = scene.children[1] as ASTElement;
    expect(bullet1.elementType).toBe('bullet');
    expect(bullet1.label).toBe('Normal bullet');
    expect(bullet1.children).toHaveLength(0);

    const bullet2 = scene.children[2] as ASTElement;
    expect(bullet2.elementType).toBe('bullet');
    expect(bullet2.children).toHaveLength(1);
    expect((bullet2.children[0] as ASTBlock).blockType).toBe('table');
  });
});
