/**
 * plan-all.test.ts — planAll PlanNode 트리 변환 검증
 *
 * planAll이 다양한 AST 구조를 단일 PlanNode 트리로 올바르게 변환하는지
 * 블랙박스로 검증한다. 내부 헬퍼(mapBlockType, classifyElementKind 등)는
 * plan-layout.test.ts에서 개별 검증하므로 여기서는 planAll 단일 진입점만 테스트.
 */

import { describe, it, expect } from 'vitest';
import { planAll } from '../../../src/compiler/layout/plan-all.js';
import { lightTheme } from '../../../src/theme/builtin-themes.js';
import type { ASTBlock, ASTElement } from '../../../src/compiler/ast.js';

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

function loc() {
  return { line: 1, column: 1 };
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

function makeScene(children: ASTBlock['children'], label?: string, layout?: string): ASTBlock {
  const props: Record<string, unknown> = layout ? { layout } : {};
  return {
    kind: 'block',
    blockType: 'scene',
    props,
    children,
    label,
    style: {},
    loc: loc(),
  };
}

// ---------------------------------------------------------------------------
// implicit scene wrapping
// ---------------------------------------------------------------------------

describe('planAll — implicit scene wrapping', () => {
  it('비-scene 블록은 layout:full + body 슬롯으로 감싸진다', () => {
    const flow = makeBlock('flow', [makeElement('node', { id: 'n1' })]);
    const plan = planAll(flow, lightTheme);

    expect(plan.blockType).toBe('scene');
    expect(plan.layout?.preset).toBe('full');
    expect(plan.children).toHaveLength(1);
    expect(plan.children[0].slot).toBe('body');
    expect(plan.children[0].blockType).toBe('flow');
  });

  it('element 단독도 implicit scene으로 감싸진다', () => {
    const el = makeElement('node', { id: 'n1', label: 'Node' });
    const plan = planAll(el as unknown as ASTBlock, lightTheme);

    expect(plan.blockType).toBe('scene');
    expect(plan.children).toHaveLength(1);
    expect(plan.children[0].slot).toBe('body');
  });

  it('scene 블록은 그대로 scene으로 변환된다', () => {
    const flow = makeBlock('flow', [makeElement('node', { id: 'n1' })]);
    const scene = makeScene([flow]);
    const plan = planAll(scene, lightTheme);

    expect(plan.blockType).toBe('scene');
    expect(plan.children).toHaveLength(1);
    expect(plan.children[0].blockType).toBe('flow');
  });
});

// ---------------------------------------------------------------------------
// PlanBlockType 매핑
// ---------------------------------------------------------------------------

describe('planAll — PlanBlockType 매핑', () => {
  it('flow/stack/grid/tree → 해당 blockType 그대로', () => {
    for (const type of ['flow', 'stack', 'grid', 'tree'] as const) {
      const block = makeBlock(type, [makeElement('node')]);
      const plan = planAll(makeScene([block]), lightTheme);
      expect(plan.children[0].blockType).toBe(type);
    }
  });

  it('node/circle/diamond → element-shape', () => {
    for (const type of ['node', 'circle', 'diamond']) {
      const stack = makeBlock('stack', [makeElement(type)]);
      const plan = planAll(makeScene([stack]), lightTheme);
      expect(plan.children[0].children[0].blockType).toBe('element-shape');
    }
  });

  it('label/heading/text → element-text', () => {
    for (const type of ['label', 'heading', 'text']) {
      const stack = makeBlock('stack', [makeElement(type)]);
      const plan = planAll(makeScene([stack]), lightTheme);
      expect(plan.children[0].children[0].blockType).toBe('element-text');
    }
  });

  it('list → element-list', () => {
    const stack = makeBlock('stack', [makeElement('list', { items: ['a', 'b'] })]);
    const plan = planAll(makeScene([stack]), lightTheme);
    expect(plan.children[0].children[0].blockType).toBe('element-list');
  });

  it('divider → element-divider', () => {
    const stack = makeBlock('stack', [makeElement('divider')]);
    const plan = planAll(makeScene([stack]), lightTheme);
    expect(plan.children[0].children[0].blockType).toBe('element-divider');
  });

  it('image → element-image', () => {
    const stack = makeBlock('stack', [makeElement('image')]);
    const plan = planAll(makeScene([stack]), lightTheme);
    expect(plan.children[0].children[0].blockType).toBe('element-image');
  });
});

// ---------------------------------------------------------------------------
// 구조 보존
// ---------------------------------------------------------------------------

describe('planAll — 구조 보존', () => {
  it('깊은 중첩 — flow > stack > node', () => {
    const inner = makeBlock('stack', [makeElement('node', { id: 'n1' }), makeElement('node', { id: 'n2' })]);
    const outer = makeBlock('flow', [inner]);
    const plan = planAll(makeScene([outer]), lightTheme);

    const flow = plan.children[0];
    expect(flow.blockType).toBe('flow');
    expect(flow.children).toHaveLength(1);
    expect(flow.children[0].blockType).toBe('stack');
    expect(flow.children[0].children).toHaveLength(2);
    expect(flow.children[0].children[0].blockType).toBe('element-shape');
  });

  it('label/elementType은 PlanNode top-level에 노출됨', () => {
    const el = makeElement('node', { id: 'n1', label: 'Hello' });
    const stack = makeBlock('stack', [el]);
    const plan = planAll(makeScene([stack]), lightTheme);

    const node = plan.children[0].children[0];
    expect(node.label).toBe('Hello');
    expect(node.elementType).toBe('node');
  });

  it('element id가 PlanNode id에 반영됨', () => {
    const el = makeElement('node', { id: 'myId' });
    const stack = makeBlock('stack', [el]);
    const plan = planAll(makeScene([stack]), lightTheme);

    const node = plan.children[0].children[0];
    expect(node.id).toBe('myId');
  });

  it('props가 PlanNode.props에 얕은 복사됨', () => {
    const flow = makeBlock('flow', [], { props: { direction: 'right', gap: 5 } });
    const plan = planAll(makeScene([flow]), lightTheme);

    const flowNode = plan.children[0];
    expect(flowNode.props.direction).toBe('right');
    expect(flowNode.props.gap).toBe(5);
  });

  it('자식이 없는 leaf element는 children이 빈 배열', () => {
    const el = makeElement('node', { id: 'n1' });
    const stack = makeBlock('stack', [el]);
    const plan = planAll(makeScene([stack]), lightTheme);

    const node = plan.children[0].children[0];
    expect(node.children).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// weight
// ---------------------------------------------------------------------------

describe('planAll — weight', () => {
  it('모든 노드는 양수 weight를 갖는다', () => {
    const flow = makeBlock('flow', [
      makeElement('node', { id: 'n1' }),
      makeElement('label', { id: 'l1' }),
    ]);
    const plan = planAll(makeScene([flow]), lightTheme);

    function checkWeights(node: ReturnType<typeof planAll>): void {
      expect(node.weight).toBeGreaterThan(0);
      for (const child of node.children) checkWeights(child);
    }
    checkWeights(plan);
  });

  it('element-text weight < element-shape weight (BASE_WEIGHT 차이 반영)', () => {
    const stack = makeBlock('stack', [
      makeElement('label', { id: 'l1' }),
      makeElement('node', { id: 'n1' }),
    ]);
    const plan = planAll(makeScene([stack]), lightTheme);

    const stackNode = plan.children[0];
    const textWeight = stackNode.children[0].weight;  // element-text (label)
    const shapeWeight = stackNode.children[1].weight; // element-shape (node)
    expect(textWeight).toBeLessThan(shapeWeight);
  });
});

// ---------------------------------------------------------------------------
// 불변성
// ---------------------------------------------------------------------------

describe('planAll — 불변성', () => {
  it('입력 ASTBlock을 변경하지 않는다', () => {
    const flow = makeBlock('flow', [makeElement('node', { id: 'n1', label: 'A' })]);
    const original = structuredClone(flow);

    planAll(flow, lightTheme);

    expect(flow).toEqual(original);
  });
});
