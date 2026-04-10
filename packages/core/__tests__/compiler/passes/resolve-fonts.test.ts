import { describe, it, expect } from 'vitest';
import { resolveFonts } from '../../../src/compiler/passes/resolve-fonts.js';
import { planAll } from '../../../src/compiler/layout/plan-all.js';
import { createScaleContext } from '../../../src/compiler/passes/scale-system.js';
import { measureDiagram } from '../../../src/compiler/passes/measure.js';
import { allocateBounds } from '../../../src/compiler/passes/allocate-bounds.js';
import { computeConstraints } from '../../../src/compiler/passes/compute-constraints.js';
import { allocateBudgets } from '../../../src/compiler/passes/allocate-budgets.js';
import { lightTheme } from '../../../src/theme/builtin-themes.js';
import { defaultSceneTheme } from '../../../src/theme/scene-theme.js';
import type { ASTBlock, ASTElement } from '../../../src/compiler/ast.js';
import type { IRBounds } from '../../../src/ir/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loc() {
  return { line: 1, column: 1 };
}

function makeScene(children: ASTBlock['children']): ASTBlock {
  return { kind: 'block', blockType: 'scene', props: {}, children, style: {}, loc: loc() };
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

const CANVAS: IRBounds = { x: 0, y: 0, w: 100, h: 100 };

function runPipeline(scene: ASTBlock) {
  const plan = planAll(scene, lightTheme);
  const scaleCtx = createScaleContext(plan, CANVAS);
  const constraints = computeConstraints(plan, scaleCtx);
  const budgets = allocateBudgets(plan, CANVAS, constraints, scaleCtx);
  const measureMap = measureDiagram(plan, lightTheme, scaleCtx, budgets);
  const boundsMap = allocateBounds(plan, CANVAS, defaultSceneTheme, scaleCtx, measureMap, constraints);
  return { plan, scaleCtx, measureMap, boundsMap };
}

// ---------------------------------------------------------------------------
// resolveFonts basic
// ---------------------------------------------------------------------------

describe('resolveFonts', () => {
  it('assigns positive fontSize to shape elements', () => {
    const scene = makeScene([
      makeElement('rect', { id: 'r1', label: 'Hello' }),
    ]);
    const { plan, measureMap, boundsMap } = runPipeline(scene);

    // Before resolve: auto fontSize = 0
    const before = measureMap.get(plan.children[0].id);
    expect(before!.fontSize).toBe(0);

    const resolved = resolveFonts([plan], boundsMap, measureMap);
    const after = resolved.get(plan.children[0].id);
    expect(after!.fontSize).toBeGreaterThan(0);
  });

  it('assigns positive fontSize to text elements', () => {
    const scene = makeScene([
      makeElement('text', { id: 't1', label: 'World' }),
    ]);
    const { plan, measureMap, boundsMap } = runPipeline(scene);

    const resolved = resolveFonts([plan], boundsMap, measureMap);
    const m = resolved.get(plan.children[0].id);
    expect(m!.fontSize).toBeGreaterThan(0);
  });

  it('preserves user-specified font-size', () => {
    const scene = makeScene([
      makeElement('rect', { id: 'r1', label: 'Custom', style: { 'font-size': 5.0 } }),
    ]);
    const { plan, measureMap, boundsMap } = runPipeline(scene);

    const resolved = resolveFonts([plan], boundsMap, measureMap);
    const m = resolved.get(plan.children[0].id);
    expect(m!.fontSize).toBe(5.0);
  });

  it('returns a new Map (does not mutate input)', () => {
    const scene = makeScene([
      makeElement('rect', { id: 'r1', label: 'Test' }),
    ]);
    const { plan, measureMap, boundsMap } = runPipeline(scene);

    const originalFontSize = measureMap.get(plan.children[0].id)!.fontSize;
    const resolved = resolveFonts([plan], boundsMap, measureMap);

    // Input map unchanged
    expect(measureMap.get(plan.children[0].id)!.fontSize).toBe(originalFontSize);
    // Output is a different Map
    expect(resolved).not.toBe(measureMap);
  });

  it('same-sized shapes get same fontSize', () => {
    const scene = makeScene([
      makeBlock('stack', [
        makeElement('rect', { id: 'r1', label: 'Alpha' }),
        makeElement('rect', { id: 'r2', label: 'Bravo' }),
      ], { props: { direction: 'row' } }),
    ]);
    const { plan, measureMap, boundsMap } = runPipeline(scene);
    const resolved = resolveFonts([plan], boundsMap, measureMap);

    const block = plan.children[0];
    const m1 = resolved.get(block.children[0].id);
    const m2 = resolved.get(block.children[1].id);
    expect(m1!.fontSize).toBeGreaterThan(0);
    // Same-length labels in same-sized boxes → same fontSize
    expect(m1!.fontSize).toBe(m2!.fontSize);
  });

  it('does not process block nodes', () => {
    const scene = makeScene([
      makeBlock('stack', [
        makeElement('rect', { id: 'r1', label: 'A' }),
      ], { id: 's1' }),
    ]);
    const { plan, measureMap, boundsMap } = runPipeline(scene);
    const resolved = resolveFonts([plan], boundsMap, measureMap);

    // Block node's fontSize should remain unchanged (theme default from measureBlock)
    const blockM = resolved.get(plan.children[0].id);
    const origBlockM = measureMap.get(plan.children[0].id);
    expect(blockM!.fontSize).toBe(origBlockM!.fontSize);
  });
});
