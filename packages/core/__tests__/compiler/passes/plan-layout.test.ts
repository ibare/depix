import { describe, it, expect } from 'vitest';
import {
  planDiagram,
  planNode,
  classifyNode,
  computeMetrics,
  computeWeight,
  computeIntrinsicSize,
} from '../../../src/compiler/passes/plan-layout.js';
import type { PlanNodeType, LayoutPlanNode } from '../../../src/compiler/passes/plan-layout.js';
import { lightTheme } from '../../../src/theme/builtin-themes.js';
import type { ASTBlock, ASTElement, ASTEdge } from '../../../src/compiler/ast.js';

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

// ---------------------------------------------------------------------------
// classifyNode
// ---------------------------------------------------------------------------

describe('classifyNode', () => {
  it('classifies block types', () => {
    expect(classifyNode(makeBlock('flow', []))).toBe('block-flow');
    expect(classifyNode(makeBlock('stack', []))).toBe('block-stack');
    expect(classifyNode(makeBlock('grid', []))).toBe('block-grid');
    expect(classifyNode(makeBlock('tree', []))).toBe('block-tree');
    expect(classifyNode(makeBlock('group', []))).toBe('block-group');
    expect(classifyNode(makeBlock('layers', []))).toBe('block-layers');
    expect(classifyNode(makeBlock('canvas', []))).toBe('block-canvas');
  });

  it('classifies unknown block as block-canvas', () => {
    expect(classifyNode(makeBlock('unknown', []))).toBe('block-canvas');
  });

  it('classifies element types', () => {
    expect(classifyNode(makeElement('node'))).toBe('element-shape');
    expect(classifyNode(makeElement('rect'))).toBe('element-shape');
    expect(classifyNode(makeElement('circle'))).toBe('element-shape');
    expect(classifyNode(makeElement('badge'))).toBe('element-shape');
    expect(classifyNode(makeElement('icon'))).toBe('element-shape');
    expect(classifyNode(makeElement('cell'))).toBe('element-shape');
    expect(classifyNode(makeElement('label'))).toBe('element-text');
    expect(classifyNode(makeElement('text'))).toBe('element-text');
    expect(classifyNode(makeElement('list'))).toBe('element-list');
    expect(classifyNode(makeElement('divider'))).toBe('element-divider');
    expect(classifyNode(makeElement('line'))).toBe('element-divider');
    expect(classifyNode(makeElement('image'))).toBe('element-image');
  });

  it('classifies box and layer as block-visual', () => {
    expect(classifyNode(makeBlock('box', []))).toBe('block-visual');
    expect(classifyNode(makeBlock('layer', []))).toBe('block-visual');
  });

  it('classifies unknown element as element-shape', () => {
    expect(classifyNode(makeElement('unknown'))).toBe('element-shape');
  });
});

// ---------------------------------------------------------------------------
// computeMetrics
// ---------------------------------------------------------------------------

describe('computeMetrics', () => {
  it('returns zero metrics for empty children', () => {
    const metrics = computeMetrics([]);
    expect(metrics.descendantCount).toBe(0);
    expect(metrics.childCount).toBe(0);
    expect(metrics.maxDepth).toBe(0);
    expect(metrics.blockChildCount).toBe(0);
    expect(metrics.leafChildCount).toBe(0);
  });

  it('counts leaf children', () => {
    const children: LayoutPlanNode[] = [
      planNode(makeElement('node', { id: 'n1' }), lightTheme),
      planNode(makeElement('node', { id: 'n2' }), lightTheme),
    ];
    const metrics = computeMetrics(children);
    expect(metrics.childCount).toBe(2);
    expect(metrics.leafChildCount).toBe(2);
    expect(metrics.blockChildCount).toBe(0);
    expect(metrics.descendantCount).toBe(2);
    expect(metrics.maxDepth).toBe(1);
  });

  it('counts block children and depth', () => {
    const innerBlock = makeBlock('stack', [
      makeElement('node', { id: 'n1' }),
    ], { id: 'inner' });

    const children: LayoutPlanNode[] = [
      planNode(innerBlock, lightTheme),
    ];
    const metrics = computeMetrics(children);
    expect(metrics.blockChildCount).toBe(1);
    expect(metrics.descendantCount).toBe(2); // block + node inside
    expect(metrics.maxDepth).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// computeWeight
// ---------------------------------------------------------------------------

describe('computeWeight', () => {
  it('returns base weight for leaf with no descendants', () => {
    const weight = computeWeight('element-shape', {
      descendantCount: 0,
      childCount: 0,
      maxDepth: 0,
      blockChildCount: 0,
      leafChildCount: 0,
    });
    // base=1.0, contentMul=(1+0)*(1+0)=1, depthMul=1+0=1 → 1.0
    expect(weight).toBe(1.0);
  });

  it('increases weight with descendants', () => {
    const w1 = computeWeight('block-stack', {
      descendantCount: 0, childCount: 0, maxDepth: 0,
      blockChildCount: 0, leafChildCount: 0,
    });
    const w2 = computeWeight('block-stack', {
      descendantCount: 4, childCount: 2, maxDepth: 1,
      blockChildCount: 0, leafChildCount: 2,
    });
    expect(w2).toBeGreaterThan(w1);
  });

  it('increases weight with block children', () => {
    const w1 = computeWeight('block-flow', {
      descendantCount: 2, childCount: 2, maxDepth: 1,
      blockChildCount: 0, leafChildCount: 2,
    });
    const w2 = computeWeight('block-flow', {
      descendantCount: 2, childCount: 2, maxDepth: 1,
      blockChildCount: 1, leafChildCount: 1,
    });
    expect(w2).toBeGreaterThan(w1);
  });

  it('increases weight with depth', () => {
    const w1 = computeWeight('block-tree', {
      descendantCount: 3, childCount: 3, maxDepth: 1,
      blockChildCount: 0, leafChildCount: 3,
    });
    const w2 = computeWeight('block-tree', {
      descendantCount: 3, childCount: 3, maxDepth: 3,
      blockChildCount: 0, leafChildCount: 3,
    });
    expect(w2).toBeGreaterThan(w1);
  });
});

// ---------------------------------------------------------------------------
// computeIntrinsicSize
// ---------------------------------------------------------------------------

describe('computeIntrinsicSize', () => {
  it('returns {0,0} for blocks', () => {
    const size = computeIntrinsicSize(makeBlock('stack', []), lightTheme);
    expect(size).toEqual({ width: 0, height: 0 });
  });

  it('uses theme defaults for node', () => {
    const size = computeIntrinsicSize(makeElement('node'), lightTheme);
    expect(size.width).toBe(lightTheme.node.minWidth);
    expect(size.height).toBe(lightTheme.node.minHeight);
  });

  it('uses square dimensions for circle', () => {
    const size = computeIntrinsicSize(makeElement('circle'), lightTheme);
    expect(size.width).toBe(size.height);
    expect(size.width).toBe(lightTheme.node.minHeight);
  });

  it('respects explicit size props', () => {
    const size = computeIntrinsicSize(
      makeElement('node', { props: { width: 25, height: 15 } }),
      lightTheme,
    );
    expect(size).toEqual({ width: 25, height: 15 });
  });

  it('uses defaults for badge', () => {
    const size = computeIntrinsicSize(makeElement('badge'), lightTheme);
    expect(size).toEqual({ width: 10, height: 4 });
  });

  it('uses defaults for label/text', () => {
    const size = computeIntrinsicSize(makeElement('label'), lightTheme);
    expect(size).toEqual({ width: 20, height: 4 });
  });

  it('uses defaults for divider', () => {
    const size = computeIntrinsicSize(makeElement('divider'), lightTheme);
    expect(size).toEqual({ width: 90, height: 1 });
  });

  it('uses defaults for image', () => {
    const size = computeIntrinsicSize(makeElement('image'), lightTheme);
    expect(size).toEqual({ width: 20, height: 15 });
  });

  it('returns {0,0} for box block', () => {
    const size = computeIntrinsicSize(makeBlock('box', []), lightTheme);
    expect(size).toEqual({ width: 0, height: 0 });
  });

  it('computes list size from items count', () => {
    const size = computeIntrinsicSize(
      makeElement('list', { items: ['a', 'b', 'c'] }),
      lightTheme,
    );
    expect(size).toEqual({ width: 20, height: 12 });
  });

  it('uses minimum list height for empty list', () => {
    const size = computeIntrinsicSize(makeElement('list'), lightTheme);
    expect(size).toEqual({ width: 20, height: 8 });
  });
});

// ---------------------------------------------------------------------------
// planDiagram
// ---------------------------------------------------------------------------

describe('planDiagram', () => {
  it('returns empty plan for empty scene', () => {
    const plan = planDiagram(makeScene([]), lightTheme);
    expect(plan.children).toHaveLength(0);
    expect(plan.totalWeight).toBe(0);
  });

  it('plans a single element', () => {
    const plan = planDiagram(
      makeScene([makeElement('node', { id: 'n1' })]),
      lightTheme,
    );
    expect(plan.children).toHaveLength(1);
    expect(plan.children[0].nodeType).toBe('element-shape');
    expect(plan.totalWeight).toBeGreaterThan(0);
  });

  it('skips edges at scene level', () => {
    const plan = planDiagram(
      makeScene([
        makeElement('node', { id: 'a' }),
        makeElement('node', { id: 'b' }),
        makeEdge('a', 'b'),
      ]),
      lightTheme,
    );
    expect(plan.children).toHaveLength(2);
  });

  it('plans nested block with children', () => {
    const block = makeBlock('stack', [
      makeElement('node', { id: 'n1' }),
      makeElement('node', { id: 'n2' }),
    ], { id: 's1' });

    const plan = planDiagram(makeScene([block]), lightTheme);
    expect(plan.children).toHaveLength(1);
    expect(plan.children[0].nodeType).toBe('block-stack');
    expect(plan.children[0].children).toHaveLength(2);
    expect(plan.children[0].edges).toHaveLength(0);
  });

  it('collects edges inside blocks', () => {
    const block = makeBlock('flow', [
      makeElement('node', { id: 'a' }),
      makeElement('node', { id: 'b' }),
      makeEdge('a', 'b'),
    ], { id: 'f1' });

    const plan = planDiagram(makeScene([block]), lightTheme);
    expect(plan.children[0].edges).toHaveLength(1);
    expect(plan.children[0].children).toHaveLength(2);
  });

  it('totalWeight sums all top-level weights', () => {
    const plan = planDiagram(
      makeScene([
        makeElement('node', { id: 'n1' }),
        makeElement('label', { id: 'l1' }),
      ]),
      lightTheme,
    );
    const sum = plan.children[0].weight + plan.children[1].weight;
    expect(plan.totalWeight).toBeCloseTo(sum, 5);
  });
});

// ---------------------------------------------------------------------------
// planNode
// ---------------------------------------------------------------------------

describe('planNode', () => {
  it('computes correct id from element', () => {
    const plan = planNode(makeElement('node', { id: 'my-id' }), lightTheme);
    expect(plan.id).toBe('my-id');
  });

  it('uses index-based id when no explicit id', () => {
    const plan = planNode(makeElement('node'), lightTheme, 3);
    expect(plan.id).toBe('el-3');
  });

  it('uses block id', () => {
    const plan = planNode(makeBlock('stack', [], { id: 'my-block' }), lightTheme);
    expect(plan.id).toBe('my-block');
  });

  it('computes weight > 0 for any node', () => {
    const plan = planNode(makeElement('node', { id: 'n1' }), lightTheme);
    expect(plan.weight).toBeGreaterThan(0);
  });

  it('block weight > element weight for same base', () => {
    const blockPlan = planNode(
      makeBlock('stack', [
        makeElement('node', { id: 'n1' }),
        makeElement('node', { id: 'n2' }),
      ], { id: 'b1' }),
      lightTheme,
    );
    const elemPlan = planNode(makeElement('node', { id: 'n3' }), lightTheme);
    expect(blockPlan.weight).toBeGreaterThan(elemPlan.weight);
  });

  it('deeply nested block has higher weight', () => {
    const shallow = makeBlock('stack', [
      makeElement('node', { id: 'n1' }),
    ], { id: 'shallow' });

    const deep = makeBlock('stack', [
      makeBlock('flow', [
        makeElement('node', { id: 'n1' }),
        makeElement('node', { id: 'n2' }),
      ], { id: 'inner' }),
    ], { id: 'deep' });

    const pShallow = planNode(shallow, lightTheme);
    const pDeep = planNode(deep, lightTheme);
    expect(pDeep.weight).toBeGreaterThan(pShallow.weight);
  });
});
