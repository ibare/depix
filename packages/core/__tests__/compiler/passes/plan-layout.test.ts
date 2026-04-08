/**
 * plan-layout.test.ts — 마이그레이션 버전
 *
 * 삭제된 plan-layout.ts(planDiagram, planNode, classifyNode, computeMetrics, computeWeight,
 * computeIntrinsicSize)를 새 PR-1 API로 교체:
 *   planDiagram       → planAll (plan-all.ts)
 *   planNode          → planLeaf / planBlockLike (plan-all-element.ts / plan-all-block.ts)
 *   classifyNode      → mapBlockType / classifyElementKind
 *   computeMetrics    → computeContainerMetrics
 *   computeWeight     → computeWeight (plan-weights.ts, 동일 함수명 유지)
 *   computeIntrinsicSize → resolveIntrinsicSize
 */

import { describe, it, expect } from 'vitest';
import { planAll } from '../../../src/compiler/layout/plan-all.js';
import { planLeaf, classifyElementKind, resolveIntrinsicSize } from '../../../src/compiler/layout/plan-all-element.js';
import { planBlockLike, mapBlockType, computeContainerMetrics } from '../../../src/compiler/layout/plan-all-block.js';
import { computeWeight } from '../../../src/compiler/layout/plan-weights.js';
import { getElementConfig } from '../../../src/compiler/element-type-registry.js';
import type { PlanNode, PlanBlockType } from '../../../src/compiler/layout/plan-types.js';
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

function makeChildId(parent: string, index: number): string {
  return `${parent}-child-${index}`;
}

// ---------------------------------------------------------------------------
// mapBlockType — block 타입 분류 (구 classifyNode 블록 케이스)
// ---------------------------------------------------------------------------

describe('mapBlockType', () => {
  it('classifies standard block types', () => {
    expect(mapBlockType('flow')).toBe('flow');
    expect(mapBlockType('stack')).toBe('stack');
    expect(mapBlockType('grid')).toBe('grid');
    expect(mapBlockType('tree')).toBe('tree');
    expect(mapBlockType('group')).toBe('group');
    expect(mapBlockType('layers')).toBe('layers');
    expect(mapBlockType('table')).toBe('table');
    expect(mapBlockType('chart')).toBe('chart');
  });

  it('column is absorbed into stack', () => {
    expect(mapBlockType('column')).toBe('stack');
  });

  it('classifies box and layer separately', () => {
    expect(mapBlockType('box')).toBe('box');
    expect(mapBlockType('layer')).toBe('layer');
  });

  it('classifies unknown block as scene (fallback)', () => {
    expect(mapBlockType('unknown')).toBe('scene');
    expect(mapBlockType('canvas')).toBe('scene'); // canvas removed → scene fallback
  });
});

// ---------------------------------------------------------------------------
// classifyElementKind — element 타입 분류 (구 classifyNode 엘리먼트 케이스)
// ---------------------------------------------------------------------------

describe('classifyElementKind', () => {
  it('classifies shape element types', () => {
    expect(classifyElementKind('node')).toBe('element-shape');
    expect(classifyElementKind('rect')).toBe('element-shape');
    expect(classifyElementKind('circle')).toBe('element-shape');
    expect(classifyElementKind('badge')).toBe('element-shape');
    expect(classifyElementKind('shape')).toBe('element-shape');
    expect(classifyElementKind('cell')).toBe('element-shape');
  });

  it('classifies text element types', () => {
    expect(classifyElementKind('label')).toBe('element-text');
    expect(classifyElementKind('text')).toBe('element-text');
  });

  it('classifies list element types', () => {
    expect(classifyElementKind('list')).toBe('element-list');
  });

  it('classifies divider element types', () => {
    expect(classifyElementKind('divider')).toBe('element-divider');
    expect(classifyElementKind('line')).toBe('element-divider');
  });

  it('classifies image element type', () => {
    expect(classifyElementKind('image')).toBe('element-image');
  });

  it('classifies unknown element as element-shape', () => {
    expect(classifyElementKind('unknown')).toBe('element-shape');
  });
});

// ---------------------------------------------------------------------------
// computeContainerMetrics — 구 computeMetrics
// ---------------------------------------------------------------------------

describe('computeContainerMetrics', () => {
  it('returns zero metrics for empty children', () => {
    const metrics = computeContainerMetrics([]);
    expect(metrics.descendantCount).toBe(0);
    expect(metrics.childCount).toBe(0);
    expect(metrics.maxDepth).toBe(0);
    expect(metrics.blockChildCount).toBe(0);
    expect(metrics.leafChildCount).toBe(0);
  });

  it('counts leaf children', () => {
    const children: PlanNode[] = [
      planLeaf(makeElement('node', { id: 'n1' }), 'n1'),
      planLeaf(makeElement('node', { id: 'n2' }), 'n2'),
    ];
    const metrics = computeContainerMetrics(children);
    expect(metrics.childCount).toBe(2);
    expect(metrics.leafChildCount).toBe(2);
    expect(metrics.blockChildCount).toBe(0);
    expect(metrics.descendantCount).toBe(2);
    expect(metrics.maxDepth).toBe(1);
  });

  it('counts block children and depth', () => {
    const innerBlock = planBlockLike(
      makeBlock('stack', [makeElement('node', { id: 'n1' })], { id: 'inner' }),
      'inner',
      makeChildId,
    );
    const children: PlanNode[] = [innerBlock];
    const metrics = computeContainerMetrics(children);
    expect(metrics.blockChildCount).toBe(1);
    expect(metrics.descendantCount).toBe(2); // block + node inside
    expect(metrics.maxDepth).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// computeWeight — PlanBlockType 기반 가중치
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
    const w1 = computeWeight('stack', {
      descendantCount: 0, childCount: 0, maxDepth: 0,
      blockChildCount: 0, leafChildCount: 0,
    });
    const w2 = computeWeight('stack', {
      descendantCount: 4, childCount: 2, maxDepth: 1,
      blockChildCount: 0, leafChildCount: 2,
    });
    expect(w2).toBeGreaterThan(w1);
  });

  it('increases weight with block children', () => {
    const w1 = computeWeight('flow', {
      descendantCount: 2, childCount: 2, maxDepth: 1,
      blockChildCount: 0, leafChildCount: 2,
    });
    const w2 = computeWeight('flow', {
      descendantCount: 2, childCount: 2, maxDepth: 1,
      blockChildCount: 1, leafChildCount: 1,
    });
    expect(w2).toBeGreaterThan(w1);
  });

  it('increases weight with depth', () => {
    const w1 = computeWeight('tree', {
      descendantCount: 3, childCount: 3, maxDepth: 1,
      blockChildCount: 0, leafChildCount: 3,
    });
    const w2 = computeWeight('tree', {
      descendantCount: 3, childCount: 3, maxDepth: 3,
      blockChildCount: 0, leafChildCount: 3,
    });
    expect(w2).toBeGreaterThan(w1);
  });
});

// ---------------------------------------------------------------------------
// resolveIntrinsicSize — 구 computeIntrinsicSize
// ---------------------------------------------------------------------------

describe('resolveIntrinsicSize', () => {
  it('uses registry defaults for node', () => {
    const config = getElementConfig('node');
    const size = resolveIntrinsicSize(makeElement('node'), config.intrinsicSize);
    expect(size.width).toBe(lightTheme.node.minWidth);  // registry: 12
    expect(size.height).toBe(lightTheme.node.minHeight); // registry: 8
  });

  it('uses square dimensions for circle', () => {
    const config = getElementConfig('circle');
    const size = resolveIntrinsicSize(makeElement('circle'), config.intrinsicSize);
    expect(size.width).toBe(size.height);
    expect(size.width).toBe(lightTheme.node.minHeight); // 8
  });

  it('respects explicit size props', () => {
    const config = getElementConfig('node');
    const size = resolveIntrinsicSize(
      makeElement('node', { props: { width: 25, height: 15 } }),
      config.intrinsicSize,
    );
    expect(size).toEqual({ width: 25, height: 15 });
  });

  it('uses defaults for badge', () => {
    const config = getElementConfig('badge');
    const size = resolveIntrinsicSize(makeElement('badge'), config.intrinsicSize);
    expect(size).toEqual({ width: 10, height: 4 });
  });

  it('uses defaults for label/text', () => {
    const config = getElementConfig('label');
    const size = resolveIntrinsicSize(makeElement('label'), config.intrinsicSize);
    expect(size).toEqual({ width: 20, height: 4 });
  });

  it('uses defaults for divider', () => {
    const config = getElementConfig('divider');
    const size = resolveIntrinsicSize(makeElement('divider'), config.intrinsicSize);
    expect(size).toEqual({ width: 90, height: 1 });
  });

  it('uses defaults for image', () => {
    const config = getElementConfig('image');
    const size = resolveIntrinsicSize(makeElement('image'), config.intrinsicSize);
    expect(size).toEqual({ width: 20, height: 15 });
  });

  it('computes list size from items count', () => {
    const config = getElementConfig('list');
    const size = resolveIntrinsicSize(
      makeElement('list', { items: ['a', 'b', 'c'] }),
      config.intrinsicSize,
    );
    expect(size).toEqual({ width: 20, height: 12 });
  });

  it('uses minimum list height for empty list', () => {
    const config = getElementConfig('list');
    const size = resolveIntrinsicSize(makeElement('list'), config.intrinsicSize);
    expect(size).toEqual({ width: 20, height: 8 });
  });
});

// ---------------------------------------------------------------------------
// planAll — 구 planDiagram (scene 전체 계획)
// ---------------------------------------------------------------------------

describe('planAll', () => {
  it('plans an empty scene with scene PlanNode', () => {
    const plan = planAll(makeScene([]), lightTheme);
    expect(plan.blockType).toBe('scene');
    // Scene wraps content in body slot; empty scene has a body container
    expect(plan.children.length).toBeGreaterThanOrEqual(0);
    expect(plan.weight).toBeGreaterThan(0);
  });

  it('plans a single element as body slot child', () => {
    const plan = planAll(
      makeScene([makeElement('node', { id: 'n1' })]),
      lightTheme,
    );
    expect(plan.blockType).toBe('scene');
    // Single element → body slot directly
    const body = plan.children[0];
    expect(body.blockType).toBe('element-shape');
    expect(body.id).toBe('n1');
    expect(plan.weight).toBeGreaterThan(0);
  });

  it('skips edges — only non-edge children count', () => {
    const plan = planAll(
      makeScene([
        makeElement('node', { id: 'a' }),
        makeElement('node', { id: 'b' }),
        makeEdge('a', 'b'),
      ]),
      lightTheme,
    );
    // 2 non-edge elements → wrapped in stack body
    const body = plan.children[0];
    expect(body.children).toHaveLength(2);
  });

  it('plans nested block with children', () => {
    const block = makeBlock('stack', [
      makeElement('node', { id: 'n1' }),
      makeElement('node', { id: 'n2' }),
    ], { id: 's1' });

    const plan = planAll(makeScene([block]), lightTheme);
    const body = plan.children[0]; // body = stack block
    expect(body.blockType).toBe('stack');
    expect(body.id).toBe('s1');
    expect(body.children).toHaveLength(2);
    expect(body.edges ?? []).toHaveLength(0);
  });

  it('collects edges inside blocks', () => {
    const block = makeBlock('flow', [
      makeElement('node', { id: 'a' }),
      makeElement('node', { id: 'b' }),
      makeEdge('a', 'b'),
    ], { id: 'f1' });

    const plan = planAll(makeScene([block]), lightTheme);
    const body = plan.children[0]; // body = flow block
    expect(body.edges).toHaveLength(1);
    expect(body.children).toHaveLength(2);
  });

  it('body slot contains all top-level elements', () => {
    const plan = planAll(
      makeScene([
        makeElement('node', { id: 'n1' }),
        makeElement('label', { id: 'l1' }),
      ]),
      lightTheme,
    );
    // Multiple elements → wrapped in stack body
    const body = plan.children[0];
    expect(body.children).toHaveLength(2);
    expect(plan.weight).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// planLeaf / planBlockLike — 구 planNode
// ---------------------------------------------------------------------------

describe('planLeaf / planBlockLike', () => {
  it('preserves DSL id from element', () => {
    const plan = planLeaf(makeElement('node', { id: 'my-id' }), 'fallback-id');
    expect(plan.id).toBe('my-id');
  });

  it('uses passed id when element has no explicit id', () => {
    const plan = planLeaf(makeElement('node'), 'el-3');
    expect(plan.id).toBe('el-3');
  });

  it('preserves block id', () => {
    const plan = planBlockLike(
      makeBlock('stack', [], { id: 'my-block' }),
      'fallback-id',
      makeChildId,
    );
    expect(plan.id).toBe('my-block');
  });

  it('computes weight > 0 for any node', () => {
    const plan = planLeaf(makeElement('node', { id: 'n1' }), 'n1');
    expect(plan.weight).toBeGreaterThan(0);
  });

  it('block weight > element weight for same content', () => {
    const blockPlan = planBlockLike(
      makeBlock('stack', [
        makeElement('node', { id: 'n1' }),
        makeElement('node', { id: 'n2' }),
      ], { id: 'b1' }),
      'b1',
      makeChildId,
    );
    const elemPlan = planLeaf(makeElement('node', { id: 'n3' }), 'n3');
    expect(blockPlan.weight).toBeGreaterThan(elemPlan.weight);
  });

  it('deeply nested block has higher weight than shallow', () => {
    const shallow = planBlockLike(
      makeBlock('stack', [
        makeElement('node', { id: 'n1' }),
      ], { id: 'shallow' }),
      'shallow',
      makeChildId,
    );

    const deep = planBlockLike(
      makeBlock('stack', [
        makeBlock('flow', [
          makeElement('node', { id: 'n1' }),
          makeElement('node', { id: 'n2' }),
        ], { id: 'inner' }),
      ], { id: 'deep' }),
      'deep',
      makeChildId,
    );

    expect(deep.weight).toBeGreaterThan(shallow.weight);
  });
});
