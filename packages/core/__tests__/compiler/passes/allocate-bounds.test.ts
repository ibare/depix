import { describe, it, expect } from 'vitest';
import { allocateDiagram, runLayout, buildTreeNodes, computeLayoutChildren } from '../../../src/compiler/passes/allocate-bounds.js';
import type { LayoutPlanNode } from '../../../src/compiler/passes/plan-layout.js';
import { planDiagram, planNode } from '../../../src/compiler/passes/plan-layout.js';
import { lightTheme } from '../../../src/theme/builtin-themes.js';
import type { ASTBlock, ASTElement, ASTEdge } from '../../../src/compiler/ast.js';
import type { IRBounds } from '../../../src/ir/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loc() {
  return { line: 1, column: 1 };
}

function makeScene(children: ASTBlock['children'], label: string | null = null): ASTBlock {
  return { kind: 'block', blockType: 'scene', props: {}, children, label: label ?? undefined, style: {}, loc: loc() };
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

function makeEdge(fromId: string, toId: string): ASTEdge {
  return { kind: 'edge', fromId, toId, edgeStyle: '->', loc: loc() };
}

const CANVAS: IRBounds = { x: 5, y: 5, w: 90, h: 90 };

// ---------------------------------------------------------------------------
// allocateDiagram — empty
// ---------------------------------------------------------------------------

describe('allocateDiagram — empty', () => {
  it('returns empty map for empty scene', () => {
    const plan = planDiagram(makeScene([]), lightTheme);
    const map = allocateDiagram(plan, CANVAS, lightTheme);
    expect(map.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// allocateDiagram — single element
// ---------------------------------------------------------------------------

describe('allocateDiagram — single element', () => {
  it('allocates full canvas space to single element', () => {
    const plan = planDiagram(
      makeScene([makeElement('node', { id: 'n1' })]),
      lightTheme,
    );
    const map = allocateDiagram(plan, CANVAS, lightTheme);

    const bounds = map.get('n1');
    expect(bounds).toBeDefined();
    expect(bounds!.x).toBe(CANVAS.x);
    expect(bounds!.y).toBe(CANVAS.y);
    // Single element fills available canvas space
    expect(bounds!.w).toBe(CANVAS.w);
    expect(bounds!.h).toBe(CANVAS.h);
  });
});

// ---------------------------------------------------------------------------
// allocateDiagram — multiple elements
// ---------------------------------------------------------------------------

describe('allocateDiagram — multiple elements', () => {
  it('distributes height by weight ratio', () => {
    const plan = planDiagram(
      makeScene([
        makeElement('node', { id: 'n1' }),
        makeElement('node', { id: 'n2' }),
      ]),
      lightTheme,
    );
    const map = allocateDiagram(plan, CANVAS, lightTheme);

    const b1 = map.get('n1')!;
    const b2 = map.get('n2')!;

    // Both nodes have same weight → same height
    expect(b1.h).toBeCloseTo(b2.h, 1);
    // Second comes after first
    expect(b2.y).toBeGreaterThan(b1.y);
  });

  it('heavier element gets more space', () => {
    const plan = planDiagram(
      makeScene([
        makeBlock('stack', [
          makeElement('node', { id: 'a' }),
          makeElement('node', { id: 'b' }),
          makeElement('node', { id: 'c' }),
        ], { id: 'big-block' }),
        makeElement('node', { id: 'small' }),
      ]),
      lightTheme,
    );
    const map = allocateDiagram(plan, CANVAS, lightTheme);

    const blockBounds = map.get('big-block')!;
    const smallBounds = map.get('small')!;

    expect(blockBounds.h).toBeGreaterThan(smallBounds.h);
  });

  it('all allocations fit within canvas', () => {
    const plan = planDiagram(
      makeScene([
        makeElement('node', { id: 'n1' }),
        makeElement('label', { id: 'l1', label: 'Title' }),
        makeElement('divider', { id: 'd1' }),
      ]),
      lightTheme,
    );
    const map = allocateDiagram(plan, CANVAS, lightTheme);

    for (const [, bounds] of map) {
      expect(bounds.x).toBeGreaterThanOrEqual(CANVAS.x);
      expect(bounds.y).toBeGreaterThanOrEqual(CANVAS.y);
      expect(bounds.x + bounds.w).toBeLessThanOrEqual(CANVAS.x + CANVAS.w + 0.01);
    }
  });
});

// ---------------------------------------------------------------------------
// allocateDiagram — block children
// ---------------------------------------------------------------------------

describe('allocateDiagram — block allocation', () => {
  it('allocates bounds for block container', () => {
    const plan = planDiagram(
      makeScene([
        makeBlock('stack', [
          makeElement('node', { id: 'n1' }),
          makeElement('node', { id: 'n2' }),
        ], { id: 's1', props: { direction: 'col' } }),
      ]),
      lightTheme,
    );
    const map = allocateDiagram(plan, CANVAS, lightTheme);

    expect(map.has('s1')).toBe(true);
    expect(map.has('n1')).toBe(true);
    expect(map.has('n2')).toBe(true);
  });

  it('child bounds are within block bounds', () => {
    const plan = planDiagram(
      makeScene([
        makeBlock('stack', [
          makeElement('node', { id: 'n1' }),
          makeElement('node', { id: 'n2' }),
        ], { id: 's1', props: { direction: 'col' } }),
      ]),
      lightTheme,
    );
    const map = allocateDiagram(plan, CANVAS, lightTheme);

    const container = map.get('s1')!;
    const n1 = map.get('n1')!;
    const n2 = map.get('n2')!;

    expect(n1.x).toBeGreaterThanOrEqual(container.x);
    expect(n2.x).toBeGreaterThanOrEqual(container.x);
  });

  it('nested blocks recursively allocate', () => {
    const inner = makeBlock('stack', [
      makeElement('node', { id: 'inner-n' }),
    ], { id: 'inner-stack', props: { direction: 'col' } });

    const outer = makeBlock('stack', [
      inner,
      makeElement('node', { id: 'outer-n' }),
    ], { id: 'outer-stack', props: { direction: 'col' } });

    const plan = planDiagram(makeScene([outer]), lightTheme);
    const map = allocateDiagram(plan, CANVAS, lightTheme);

    expect(map.has('outer-stack')).toBe(true);
    expect(map.has('inner-stack')).toBe(true);
    expect(map.has('inner-n')).toBe(true);
    expect(map.has('outer-n')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runLayout
// ---------------------------------------------------------------------------

describe('runLayout', () => {
  it('dispatches stack layout', () => {
    const children = [
      { id: 'a', width: 10, height: 8 },
      { id: 'b', width: 10, height: 8 },
    ];
    const result = runLayout('stack', children, { direction: 'col', gap: 2 }, CANVAS, []);
    expect(result.childBounds).toHaveLength(2);
    expect(result.childBounds[0].y).toBeLessThan(result.childBounds[1].y);
  });

  it('dispatches grid layout', () => {
    const children = [
      { id: 'a', width: 10, height: 8 },
      { id: 'b', width: 10, height: 8 },
      { id: 'c', width: 10, height: 8 },
      { id: 'd', width: 10, height: 8 },
    ];
    const result = runLayout('grid', children, { cols: 2, gap: 2 }, CANVAS, []);
    expect(result.childBounds).toHaveLength(4);
  });

  it('dispatches flow layout', () => {
    const children = [
      { id: 'a', width: 10, height: 8 },
      { id: 'b', width: 10, height: 8 },
    ];
    const edges: ASTEdge[] = [makeEdge('a', 'b')];
    const result = runLayout('flow', children, { direction: 'right' }, CANVAS, edges);
    expect(result.childBounds).toHaveLength(2);
  });

  it('dispatches tree layout', () => {
    const children = [
      { id: 'root', width: 10, height: 8 },
      { id: 'c1', width: 10, height: 8 },
    ];
    const edges: ASTEdge[] = [makeEdge('root', 'c1')];
    const result = runLayout('tree', children, { direction: 'down' }, CANVAS, edges);
    expect(result.childBounds).toHaveLength(2);
  });

  it('dispatches group layout', () => {
    const children = [{ id: 'a', width: 10, height: 8 }];
    const result = runLayout('group', children, {}, CANVAS, []);
    expect(result.childBounds).toHaveLength(1);
  });

  it('dispatches layers layout', () => {
    const children = [
      { id: 'a', width: 10, height: 8 },
      { id: 'b', width: 10, height: 8 },
    ];
    const result = runLayout('layers', children, {}, CANVAS, []);
    expect(result.childBounds).toHaveLength(2);
  });

  it('defaults to stack layout for unknown type', () => {
    const children = [{ id: 'a', width: 10, height: 8 }];
    const result = runLayout('canvas', children, {}, CANVAS, []);
    expect(result.childBounds).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// buildTreeNodes
// ---------------------------------------------------------------------------

describe('buildTreeNodes', () => {
  it('returns empty for empty children', () => {
    const nodes = buildTreeNodes([], []);
    expect(nodes).toHaveLength(0);
  });

  it('builds tree from edges', () => {
    const children = [
      { id: 'root', width: 10, height: 8 },
      { id: 'c1', width: 10, height: 8 },
      { id: 'c2', width: 10, height: 8 },
    ];
    const edges: ASTEdge[] = [makeEdge('root', 'c1'), makeEdge('root', 'c2')];
    const nodes = buildTreeNodes(children, edges);

    expect(nodes).toHaveLength(3);
    expect(nodes[0].id).toBe('root');
    expect(nodes[0].children).toHaveLength(2);
  });

  it('swaps root to index 0', () => {
    const children = [
      { id: 'c1', width: 10, height: 8 },
      { id: 'root', width: 10, height: 8 },
    ];
    const edges: ASTEdge[] = [makeEdge('root', 'c1')];
    const nodes = buildTreeNodes(children, edges);

    expect(nodes[0].id).toBe('root');
    expect(nodes[0].children).toContain(1); // c1 is now at index 1
  });
});

// ---------------------------------------------------------------------------
// Edge-aware sizing in flow/tree
// ---------------------------------------------------------------------------

describe('edge-aware sizing in flow/tree', () => {
  function makePlanNode(blockType: string, childIds: string[], edges: ASTEdge[], props: Record<string, string | number> = {}): LayoutPlanNode {
    const children: (ASTElement | ASTEdge)[] = childIds.map(id =>
      makeElement('node', { id }),
    );
    edges.forEach(e => children.push(e));
    const block = makeBlock(blockType, children, { id: `${blockType}-block`, props });
    return planNode(block, lightTheme);
  }

  function totalNodeArea(children: { width: number; height: number }[]): number {
    return children.reduce((sum, c) => sum + c.width * c.height, 0);
  }

  describe('flow', () => {
    it('nodes are smaller when edges exist vs no edges', () => {
      const noEdges = makePlanNode('flow', ['a', 'b', 'c'], []);
      const withEdges = makePlanNode('flow', ['a', 'b', 'c'], [
        makeEdge('a', 'b'), makeEdge('b', 'c'),
      ]);

      const sizesNoEdge = computeLayoutChildren(noEdges, CANVAS);
      const sizesWithEdge = computeLayoutChildren(withEdges, CANVAS);

      const areaNoEdge = totalNodeArea(sizesNoEdge);
      const areaWithEdge = totalNodeArea(sizesWithEdge);

      expect(areaWithEdge).toBeLessThan(areaNoEdge);
    });

    it('more edges → smaller nodes', () => {
      const oneEdge = makePlanNode('flow', ['a', 'b', 'c'], [
        makeEdge('a', 'b'),
      ]);
      const twoEdges = makePlanNode('flow', ['a', 'b', 'c'], [
        makeEdge('a', 'b'), makeEdge('b', 'c'),
      ]);

      const sizes1 = computeLayoutChildren(oneEdge, CANVAS);
      const sizes2 = computeLayoutChildren(twoEdges, CANVAS);

      expect(totalNodeArea(sizes2)).toBeLessThan(totalNodeArea(sizes1));
    });

    it('vertical flow reduces height axis when edges exist', () => {
      const noEdges = makePlanNode('flow', ['a', 'b'], [], { direction: 'down' });
      const withEdges = makePlanNode('flow', ['a', 'b'], [
        makeEdge('a', 'b'),
      ], { direction: 'down' });

      const sizesNoEdge = computeLayoutChildren(noEdges, CANVAS);
      const sizesWithEdge = computeLayoutChildren(withEdges, CANVAS);

      // Height (main axis for vertical) should shrink when edges exist
      for (let i = 0; i < sizesWithEdge.length; i++) {
        expect(sizesWithEdge[i].height).toBeLessThan(sizesNoEdge[i].height);
      }
    });

    it('no edges → same behavior as before (no shrink)', () => {
      const noEdges = makePlanNode('flow', ['a', 'b'], []);
      const sizes = computeLayoutChildren(noEdges, CANVAS);

      // With no edges, gapCount=0, so reservedForEdges=0 → full area used
      const fullArea = CANVAS.w * CANVAS.h;
      const nodeArea = totalNodeArea(sizes);
      // Nodes should use a reasonable fraction of the full area
      expect(nodeArea).toBeGreaterThan(fullArea * 0.3);
    });
  });

  describe('tree', () => {
    it('edge structure creates distinct level sizes', () => {
      const noEdges = makePlanNode('tree', ['r', 'c1', 'c2'], []);
      const withEdges = makePlanNode('tree', ['r', 'c1', 'c2'], [
        makeEdge('r', 'c1'), makeEdge('r', 'c2'),
      ]);

      const sizesNoEdge = computeLayoutChildren(noEdges, CANVAS);
      const sizesWithEdge = computeLayoutChildren(withEdges, CANVAS);

      // Without edges: all in same level → same height
      expect(sizesNoEdge[0].height).toBeCloseTo(sizesNoEdge[1].height, 1);
      // With edges: root gets its own level → different height than children
      expect(sizesWithEdge[0].height).not.toBeCloseTo(sizesWithEdge[1].height, 0);
    });

    it('horizontal tree reduces width axis when edges exist', () => {
      const noEdges = makePlanNode('tree', ['r', 'c1'], [], { direction: 'right' });
      const withEdges = makePlanNode('tree', ['r', 'c1'], [
        makeEdge('r', 'c1'),
      ], { direction: 'right' });

      const sizesNoEdge = computeLayoutChildren(noEdges, CANVAS);
      const sizesWithEdge = computeLayoutChildren(withEdges, CANVAS);

      // Width (main axis for horizontal) should shrink when edges exist
      for (let i = 0; i < sizesWithEdge.length; i++) {
        expect(sizesWithEdge[i].width).toBeLessThan(sizesNoEdge[i].width);
      }
    });

    it('no edges → same behavior as before (no shrink)', () => {
      const noEdges = makePlanNode('tree', ['r', 'c1'], []);
      const sizes = computeLayoutChildren(noEdges, CANVAS);

      const fullArea = CANVAS.w * CANVAS.h;
      const nodeArea = totalNodeArea(sizes);
      expect(nodeArea).toBeGreaterThan(fullArea * 0.1);
    });
  });
});
