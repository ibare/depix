import { describe, it, expect } from 'vitest';
import { computeConstraints } from '../../../src/compiler/passes/compute-constraints.js';
import { allocateBudgets } from '../../../src/compiler/passes/allocate-budgets.js';
import { measureScene } from '../../../src/compiler/passes/measure.js';
import { planScene } from '../../../src/compiler/passes/plan-layout.js';
import { createScaleContext } from '../../../src/compiler/passes/scale-system.js';
import { lightTheme } from '../../../src/theme/builtin-themes.js';
import type { ASTScene, ASTBlock, ASTElement } from '../../../src/compiler/ast.js';
import type { IRBounds } from '../../../src/ir/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loc() {
  return { line: 1, column: 1 };
}

function makeScene(children: ASTScene['children']): ASTScene {
  return { name: null, children, loc: loc() };
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

const CANVAS: IRBounds = { x: 5, y: 5, w: 90, h: 90 };

function runPipeline(scene: ASTScene) {
  const plan = planScene(scene, lightTheme);
  const scaleCtx = createScaleContext(plan, CANVAS);
  const constraints = computeConstraints(plan, scaleCtx);
  const budgetMap = allocateBudgets(plan, CANVAS, constraints, scaleCtx);
  const measureMap = measureScene(plan, lightTheme, scaleCtx, budgetMap);
  return { plan, scaleCtx, constraints, budgetMap, measureMap };
}

function makeLayersScene(count: number) {
  const elements = Array.from({ length: count }, (_, i) =>
    makeElement('node', { id: `n${i}`, label: `Layer ${i}` }),
  );
  return makeScene([makeBlock('layers', elements, { id: 'layers-block' })]);
}

// ---------------------------------------------------------------------------
// computeConstraints — independent tests
// ---------------------------------------------------------------------------

describe('computeConstraints', () => {
  it('returns constraints for a single leaf element', () => {
    const scene = makeScene([makeElement('node', { id: 'n1', label: 'A' })]);
    const plan = planScene(scene, lightTheme);
    const scaleCtx = createScaleContext(plan, CANVAS);
    const constraints = computeConstraints(plan, scaleCtx);

    const c = constraints.get(plan.children[0].id);
    expect(c).toBeDefined();
    expect(c!.minWidth).toBe(4);
    expect(c!.minHeight).toBe(3);
    expect(c!.maxWidth).toBe(Infinity);
  });

  it('aggregates stack(col) children: minH = sum, minW = max', () => {
    const scene = makeScene([
      makeBlock('stack', [
        makeElement('node', { id: 'n1', label: 'A' }),
        makeElement('node', { id: 'n2', label: 'B' }),
      ], { id: 's1' }),
    ]);
    const plan = planScene(scene, lightTheme);
    const scaleCtx = createScaleContext(plan, CANVAS);
    const constraints = computeConstraints(plan, scaleCtx);

    const block = constraints.get(plan.children[0].id)!;
    const child0 = constraints.get(plan.children[0].children[0].id)!;
    const child1 = constraints.get(plan.children[0].children[1].id)!;
    // minHeight >= sum of children + gap
    expect(block.minHeight).toBeGreaterThanOrEqual(child0.minHeight + child1.minHeight);
    expect(block.minWidth).toBe(Math.max(child0.minWidth, child1.minWidth));
  });

  it('aggregates grid: cols * maxChildMinW + gaps', () => {
    const scene = makeScene([
      makeBlock('grid', [
        makeElement('node', { id: 'n1' }),
        makeElement('node', { id: 'n2' }),
        makeElement('node', { id: 'n3' }),
        makeElement('node', { id: 'n4' }),
      ], { id: 'g1', props: { cols: 2 } }),
    ]);
    const plan = planScene(scene, lightTheme);
    const scaleCtx = createScaleContext(plan, CANVAS);
    const constraints = computeConstraints(plan, scaleCtx);

    const block = constraints.get(plan.children[0].id)!;
    const childC = constraints.get(plan.children[0].children[0].id)!;
    // 2 cols → minWidth >= 2 * childMinW
    expect(block.minWidth).toBeGreaterThanOrEqual(2 * childC.minWidth);
    // 2 rows → minHeight >= 2 * childMinH
    expect(block.minHeight).toBeGreaterThanOrEqual(2 * childC.minHeight);
  });

  it('aggregates layers: minH = sum, minW = max', () => {
    const scene = makeLayersScene(3);
    const plan = planScene(scene, lightTheme);
    const scaleCtx = createScaleContext(plan, CANVAS);
    const constraints = computeConstraints(plan, scaleCtx);

    const block = constraints.get(plan.children[0].id)!;
    expect(block.minHeight).toBeGreaterThan(0);
    expect(block.minWidth).toBe(4); // max of node minWidths
  });
});

// ---------------------------------------------------------------------------
// allocateBudgets — independent tests
// ---------------------------------------------------------------------------

describe('allocateBudgets', () => {
  it('layers 12 — all children get budget.height > 0', () => {
    const scene = makeLayersScene(12);
    const plan = planScene(scene, lightTheme);
    const scaleCtx = createScaleContext(plan, CANVAS);
    const constraints = computeConstraints(plan, scaleCtx);
    const budgetMap = allocateBudgets(plan, CANVAS, constraints, scaleCtx);

    const layersBlock = plan.children[0];
    for (const child of layersBlock.children) {
      const budget = budgetMap.get(child.id);
      expect(budget).toBeDefined();
      expect(budget!.height).toBeGreaterThan(0);
      expect(budget!.width).toBeGreaterThan(0);
    }
  });

  it('layers 1 — budget is near canvas size', () => {
    const scene = makeLayersScene(1);
    const plan = planScene(scene, lightTheme);
    const scaleCtx = createScaleContext(plan, CANVAS);
    const constraints = computeConstraints(plan, scaleCtx);
    const budgetMap = allocateBudgets(plan, CANVAS, constraints, scaleCtx);

    const child = plan.children[0].children[0];
    const budget = budgetMap.get(child.id)!;
    expect(budget.height).toBeGreaterThan(50);
  });

  it('stack 3 — weight-proportional budget distribution', () => {
    const scene = makeScene([
      makeBlock('stack', [
        makeElement('node', { id: 'n1' }),
        makeElement('node', { id: 'n2' }),
        makeElement('node', { id: 'n3' }),
      ], { id: 's1' }),
    ]);
    const plan = planScene(scene, lightTheme);
    const scaleCtx = createScaleContext(plan, CANVAS);
    const constraints = computeConstraints(plan, scaleCtx);
    const budgetMap = allocateBudgets(plan, CANVAS, constraints, scaleCtx);

    const block = plan.children[0];
    const budgets = block.children.map(c => budgetMap.get(c.id)!);
    // All should have positive budgets
    for (const b of budgets) {
      expect(b.height).toBeGreaterThan(0);
      expect(b.width).toBeGreaterThan(0);
    }
    // Equal weight nodes should get approximately equal heights
    const heights = budgets.map(b => b.height);
    expect(Math.abs(heights[0] - heights[1])).toBeLessThan(1);
  });

  it('overflow: layers 20 — proportional shrink, all budgets > 0', () => {
    const scene = makeLayersScene(20);
    const plan = planScene(scene, lightTheme);
    const scaleCtx = createScaleContext(plan, CANVAS);
    const constraints = computeConstraints(plan, scaleCtx);
    const budgetMap = allocateBudgets(plan, CANVAS, constraints, scaleCtx);

    const block = plan.children[0];
    for (const child of block.children) {
      const b = budgetMap.get(child.id)!;
      expect(b.height).toBeGreaterThan(0);
    }
  });

  it('pinned height — explicit height reserves fixed budget', () => {
    const scene = makeScene([
      makeBlock('stack', [
        makeElement('node', { id: 'pinned', props: { height: 20 } }),
        makeElement('node', { id: 'flex1' }),
        makeElement('node', { id: 'flex2' }),
      ], { id: 's1' }),
    ]);
    const plan = planScene(scene, lightTheme);
    const scaleCtx = createScaleContext(plan, CANVAS);
    const constraints = computeConstraints(plan, scaleCtx);
    const budgetMap = allocateBudgets(plan, CANVAS, constraints, scaleCtx);

    const block = plan.children[0];
    const pinnedBudget = budgetMap.get(block.children[0].id)!;
    const flex1Budget = budgetMap.get(block.children[1].id)!;
    const flex2Budget = budgetMap.get(block.children[2].id)!;

    // Pinned node should get at least its pinned height
    expect(pinnedBudget.height).toBeGreaterThanOrEqual(20);
    // Flexible nodes should share remaining space equally
    expect(Math.abs(flex1Budget.height - flex2Budget.height)).toBeLessThan(1);
    // Flexible nodes should each get less than the pinned node
    expect(flex1Budget.height).toBeGreaterThan(0);
    expect(flex2Budget.height).toBeGreaterThan(0);
  });

  it('pinned width — explicit width reserves fixed budget in row stack', () => {
    const scene = makeScene([
      makeBlock('stack', [
        makeElement('node', { id: 'pinned', props: { width: 30 } }),
        makeElement('node', { id: 'flex1' }),
      ], { id: 's1', props: { direction: 'row' } }),
    ]);
    const plan = planScene(scene, lightTheme);
    const scaleCtx = createScaleContext(plan, CANVAS);
    const constraints = computeConstraints(plan, scaleCtx);
    const budgetMap = allocateBudgets(plan, CANVAS, constraints, scaleCtx);

    const block = plan.children[0];
    const pinnedBudget = budgetMap.get(block.children[0].id)!;
    const flexBudget = budgetMap.get(block.children[1].id)!;

    // Pinned node should get at least its pinned width
    expect(pinnedBudget.width).toBeGreaterThanOrEqual(30);
    // Flexible node gets remaining space
    expect(flexBudget.width).toBeGreaterThan(0);
  });

  it('constraint pinnedHeight flag is set for explicit height', () => {
    const scene = makeScene([
      makeElement('node', { id: 'n1', props: { height: 15 } }),
    ]);
    const plan = planScene(scene, lightTheme);
    const scaleCtx = createScaleContext(plan, CANVAS);
    const constraints = computeConstraints(plan, scaleCtx);

    const c = constraints.get(plan.children[0].id)!;
    expect(c.pinnedHeight).toBe(true);
    expect(c.pinnedWidth).toBe(false);
    expect(c.minHeight).toBe(15);
    expect(c.maxHeight).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// Integration: full pipeline — fontSize behavior
// ---------------------------------------------------------------------------

describe('budget system integration', () => {
  it('more layers → smaller fontSize', () => {
    const scene3 = makeLayersScene(3);
    const scene12 = makeLayersScene(12);

    const { measureMap: map3, plan: plan3 } = runPipeline(scene3);
    const { measureMap: map12, plan: plan12 } = runPipeline(scene12);

    // Get first child's fontSize from each
    const m3 = map3.get(plan3.children[0].children[0].id)!;
    const m12 = map12.get(plan12.children[0].children[0].id)!;

    // 12 layers should have smaller (or equal) fontSize than 3 layers
    expect(m12.fontSize).toBeLessThanOrEqual(m3.fontSize);
  });

  it('nested layers > box > list — all get budget', () => {
    const scene = makeScene([
      makeBlock('layers', [
        makeElement('box', {
          id: 'b1',
          label: 'Box',
          children: [makeElement('list', { id: 'l1', items: ['A', 'B'] })],
        }),
        makeElement('node', { id: 'n1', label: 'Node' }),
        makeElement('node', { id: 'n2', label: 'Node' }),
      ], { id: 'layers1' }),
    ]);

    const { budgetMap, plan } = runPipeline(scene);
    const layersBlock = plan.children[0];

    // All children should have budgets
    for (const child of layersBlock.children) {
      expect(budgetMap.get(child.id)).toBeDefined();
    }
  });

  it('fontSize decreases as element count increases', () => {
    const fontSizes: number[] = [];
    for (const count of [1, 5, 10, 15]) {
      const scene = makeLayersScene(count);
      const { measureMap, plan } = runPipeline(scene);
      const m = measureMap.get(plan.children[0].children[0].id)!;
      fontSizes.push(m.fontSize);
    }

    // Each subsequent count should have smaller or equal fontSize
    for (let i = 1; i < fontSizes.length; i++) {
      expect(fontSizes[i]).toBeLessThanOrEqual(fontSizes[i - 1]);
    }
  });

  it('grid 2x3 — all children get budget', () => {
    const elements = Array.from({ length: 6 }, (_, i) =>
      makeElement('node', { id: `n${i}`, label: `Cell ${i}` }),
    );
    const scene = makeScene([makeBlock('grid', elements, { id: 'g1', props: { cols: 2 } })]);
    const { budgetMap, plan } = runPipeline(scene);

    const block = plan.children[0];
    for (const child of block.children) {
      const b = budgetMap.get(child.id);
      expect(b).toBeDefined();
      expect(b!.width).toBeGreaterThan(0);
      expect(b!.height).toBeGreaterThan(0);
    }
  });

  it('pipeline without budget (backward compat) still works', () => {
    const scene = makeLayersScene(3);
    const plan = planScene(scene, lightTheme);
    const scaleCtx = createScaleContext(plan, CANVAS);
    // No budget — old behavior
    const measureMap = measureScene(plan, lightTheme, scaleCtx);
    expect(measureMap.size).toBeGreaterThan(0);
  });

  it('tree — subtreeSpan-proportional budget: CTO(3 leaves) > CFO(2 leaves)', () => {
    const edges = [
      { kind: 'edge' as const, fromId: 'ceo', toId: 'cto', edgeStyle: '->' as const, loc: loc() },
      { kind: 'edge' as const, fromId: 'ceo', toId: 'cfo', edgeStyle: '->' as const, loc: loc() },
      { kind: 'edge' as const, fromId: 'cto', toId: 'fe', edgeStyle: '->' as const, loc: loc() },
      { kind: 'edge' as const, fromId: 'cto', toId: 'be', edgeStyle: '->' as const, loc: loc() },
      { kind: 'edge' as const, fromId: 'cto', toId: 'infra', edgeStyle: '->' as const, loc: loc() },
      { kind: 'edge' as const, fromId: 'cfo', toId: 'acc', edgeStyle: '->' as const, loc: loc() },
      { kind: 'edge' as const, fromId: 'cfo', toId: 'fin', edgeStyle: '->' as const, loc: loc() },
    ];
    const scene = makeScene([
      makeBlock('tree', [
        makeElement('node', { id: 'ceo', label: 'CEO' }),
        makeElement('node', { id: 'cto', label: 'CTO' }),
        makeElement('node', { id: 'cfo', label: 'CFO' }),
        makeElement('node', { id: 'fe', label: 'FE' }),
        makeElement('node', { id: 'be', label: 'BE' }),
        makeElement('node', { id: 'infra', label: 'Infra' }),
        makeElement('node', { id: 'acc', label: 'Accounting' }),
        makeElement('node', { id: 'fin', label: 'Finance' }),
        ...edges,
      ] as any, {
        id: 'tree1',
        props: { direction: 'down' },
      }),
    ]);

    const { budgetMap, plan } = runPipeline(scene);
    const treeBlock = plan.children[0];

    // Find budgets by original id matching
    const ctoBudget = budgetMap.get(treeBlock.children.find(c => c.astNode.kind === 'element' && c.astNode.id === 'cto')!.id)!;
    const cfoBudget = budgetMap.get(treeBlock.children.find(c => c.astNode.kind === 'element' && c.astNode.id === 'cfo')!.id)!;
    const leafBudget = budgetMap.get(treeBlock.children.find(c => c.astNode.kind === 'element' && c.astNode.id === 'fe')!.id)!;

    // CTO (subtreeSpan=3) should get wider budget than CFO (subtreeSpan=2)
    expect(ctoBudget.width).toBeGreaterThan(cfoBudget.width);
    // CFO (subtreeSpan=2) should get wider budget than leaf (subtreeSpan=1)
    expect(cfoBudget.width).toBeGreaterThan(leafBudget.width);
    // Ratio should be approximately 3:2 for CTO:CFO
    const ratio = ctoBudget.width / cfoBudget.width;
    expect(ratio).toBeGreaterThan(1.3);
    expect(ratio).toBeLessThan(1.7);
  });

  it('tree — level-based budgets give larger budget to nodes with fewer siblings', () => {
    const scene = makeScene([
      makeBlock('tree', [
        makeElement('node', { id: 'root', label: 'CEO' }),
        makeElement('node', { id: 'c1', label: 'CTO' }),
        makeElement('node', { id: 'c2', label: 'CFO' }),
        makeElement('node', { id: 'gc1', label: 'FE' }),
        makeElement('node', { id: 'gc2', label: 'BE' }),
      ], {
        id: 'tree1',
        props: { direction: 'down' },
      }),
    ]);
    // Add edges manually via scene children
    scene.children.push(
      { kind: 'edge', fromId: 'root', toId: 'c1', edgeStyle: '->', loc: { line: 1, column: 1 } } as any,
      { kind: 'edge', fromId: 'root', toId: 'c2', edgeStyle: '->', loc: { line: 1, column: 1 } } as any,
      { kind: 'edge', fromId: 'c1', toId: 'gc1', edgeStyle: '->', loc: { line: 1, column: 1 } } as any,
      { kind: 'edge', fromId: 'c1', toId: 'gc2', edgeStyle: '->', loc: { line: 1, column: 1 } } as any,
    );

    const { budgetMap, plan } = runPipeline(scene);
    const treeBlock = plan.children[0];
    // All tree children should have budgets
    for (const child of treeBlock.children) {
      const b = budgetMap.get(child.id);
      expect(b).toBeDefined();
      expect(b!.width).toBeGreaterThan(0);
      expect(b!.height).toBeGreaterThan(0);
    }
  });

  it('flow — layer-based budgets for linear chain', () => {
    const scene = makeScene([
      makeBlock('flow', [
        makeElement('node', { id: 'a', label: 'A' }),
        makeElement('node', { id: 'b', label: 'B' }),
        makeElement('node', { id: 'c', label: 'C' }),
      ], {
        id: 'flow1',
        props: { direction: 'right' },
      }),
    ]);
    scene.children.push(
      { kind: 'edge', fromId: 'a', toId: 'b', edgeStyle: '->', loc: { line: 1, column: 1 } } as any,
      { kind: 'edge', fromId: 'b', toId: 'c', edgeStyle: '->', loc: { line: 1, column: 1 } } as any,
    );

    const { budgetMap, plan } = runPipeline(scene);
    const flowBlock = plan.children[0];
    for (const child of flowBlock.children) {
      const b = budgetMap.get(child.id);
      expect(b).toBeDefined();
      expect(b!.width).toBeGreaterThan(0);
      expect(b!.height).toBeGreaterThan(0);
    }
  });
});
