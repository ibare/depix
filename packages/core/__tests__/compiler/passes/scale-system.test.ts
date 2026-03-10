import { describe, it, expect } from 'vitest';
import {
  computeBaseUnit,
  computeGap,
  computeFontSize,
  computePadding,
  countElements,
  createScaleContext,
} from '../../../src/compiler/passes/scale-system.js';
import type { GapType, TextRole } from '../../../src/compiler/passes/scale-system.js';
import { planDiagram } from '../../../src/compiler/passes/plan-layout.js';
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

const CANVAS: IRBounds = { x: 5, y: 5, w: 90, h: 90 };

// ---------------------------------------------------------------------------
// computeBaseUnit
// ---------------------------------------------------------------------------

describe('computeBaseUnit', () => {
  it('returns positive value for typical inputs', () => {
    const bu = computeBaseUnit(8100, 4);
    expect(bu).toBeGreaterThan(0);
  });

  it('baseUnit decreases as element count increases', () => {
    const area = 90 * 90; // 8100
    const bu2 = computeBaseUnit(area, 2);
    const bu10 = computeBaseUnit(area, 10);
    const bu50 = computeBaseUnit(area, 50);

    expect(bu2).toBeGreaterThan(bu10);
    expect(bu10).toBeGreaterThan(bu50);
  });

  it('baseUnit increases with canvas area', () => {
    const buSmall = computeBaseUnit(1000, 5);
    const buLarge = computeBaseUnit(10000, 5);

    expect(buLarge).toBeGreaterThan(buSmall);
  });

  it('treats zero elements as 1', () => {
    const bu = computeBaseUnit(8100, 0);
    expect(bu).toBeGreaterThan(0);
    expect(bu).toBe(computeBaseUnit(8100, 1));
  });

  it('respects custom density factor', () => {
    const buDefault = computeBaseUnit(8100, 4, 0.55);
    const buHigh = computeBaseUnit(8100, 4, 0.8);

    expect(buHigh).toBeGreaterThan(buDefault);
  });
});

// ---------------------------------------------------------------------------
// computeGap
// ---------------------------------------------------------------------------

describe('computeGap', () => {
  it('returns a value within clamp bounds', () => {
    const gapTypes: GapType[] = ['innerPadding', 'childGap', 'siblingGap', 'connectorGap', 'sectionGap'];
    const baseUnit = 20;

    for (const type of gapTypes) {
      const gap = computeGap(baseUnit, type);
      expect(gap).toBeGreaterThan(0);
    }
  });

  it('hierarchy order: innerPadding > childGap, siblingGap > innerPadding, connector > sibling', () => {
    const baseUnit = 30; // Medium baseUnit to be in range

    const inner = computeGap(baseUnit, 'innerPadding');
    const child = computeGap(baseUnit, 'childGap');
    const sibling = computeGap(baseUnit, 'siblingGap');
    const connector = computeGap(baseUnit, 'connectorGap');
    const section = computeGap(baseUnit, 'sectionGap');

    expect(child).toBeLessThan(inner);
    expect(inner).toBeLessThan(sibling);
    expect(sibling).toBeLessThan(connector);
    expect(section).toBeLessThan(connector);
  });

  it('clamps to minimum for very small baseUnit', () => {
    const baseUnit = 0.1;

    const inner = computeGap(baseUnit, 'innerPadding');
    expect(inner).toBe(1.0); // min for innerPadding

    const child = computeGap(baseUnit, 'childGap');
    expect(child).toBe(0.5); // min for childGap

    const sibling = computeGap(baseUnit, 'siblingGap');
    expect(sibling).toBe(1.5); // min for siblingGap

    const connector = computeGap(baseUnit, 'connectorGap');
    expect(connector).toBe(2.5); // min for connectorGap

    const section = computeGap(baseUnit, 'sectionGap');
    expect(section).toBe(2.0); // min for sectionGap
  });

  it('clamps to maximum for very large baseUnit', () => {
    const baseUnit = 1000;

    const inner = computeGap(baseUnit, 'innerPadding');
    expect(inner).toBe(5.0); // max for innerPadding

    const child = computeGap(baseUnit, 'childGap');
    expect(child).toBe(3.0); // max for childGap

    const sibling = computeGap(baseUnit, 'siblingGap');
    expect(sibling).toBe(6.0); // max for siblingGap

    const connector = computeGap(baseUnit, 'connectorGap');
    expect(connector).toBe(8.0); // max for connectorGap

    const section = computeGap(baseUnit, 'sectionGap');
    expect(section).toBe(7.0); // max for sectionGap
  });
});

// ---------------------------------------------------------------------------
// computeFontSize
// ---------------------------------------------------------------------------

describe('computeFontSize', () => {
  it('returns proportional fontSize based on container size', () => {
    const small = computeFontSize(10, 'innerLabel');
    const large = computeFontSize(50, 'innerLabel');

    expect(large).toBeGreaterThan(small);
  });

  it('different roles have different ratios', () => {
    const containerSize = 10; // Small enough to stay below max clamp
    const inner = computeFontSize(containerSize, 'innerLabel');     // 10*0.30 = 3.0
    const standalone = computeFontSize(containerSize, 'standaloneText'); // 10*0.25 = 2.5
    const list = computeFontSize(containerSize, 'listItem');         // 10*0.20 = 2.0

    // innerLabel ratio (0.30) > standaloneText (0.25) > listItem (0.20)
    expect(inner).toBeGreaterThan(standalone);
    expect(standalone).toBeGreaterThan(list);
  });

  it('clamps to minimum for tiny container', () => {
    const fs = computeFontSize(0.5, 'innerLabel');
    expect(fs).toBe(0.6); // FONT_SIZE_MIN
  });

  it('clamps to maximum for huge container', () => {
    const fs = computeFontSize(100, 'innerLabel');
    expect(fs).toBe(4.0); // FONT_SIZE_MAX for innerLabel
  });

  it('edgeLabel has highest ratio', () => {
    const containerSize = 5;
    const edge = computeFontSize(containerSize, 'edgeLabel');
    const inner = computeFontSize(containerSize, 'innerLabel');

    expect(edge).toBeGreaterThan(inner);
  });
});

// ---------------------------------------------------------------------------
// computePadding
// ---------------------------------------------------------------------------

describe('computePadding', () => {
  it('equals computeGap with innerPadding', () => {
    const baseUnit = 25;
    expect(computePadding(baseUnit)).toBe(computeGap(baseUnit, 'innerPadding'));
  });

  it('varies with baseUnit', () => {
    const small = computePadding(5);
    const large = computePadding(50);

    // Both clamped within [1.0, 5.0]
    expect(small).toBeGreaterThanOrEqual(1.0);
    expect(large).toBeLessThanOrEqual(5.0);
  });
});

// ---------------------------------------------------------------------------
// countElements
// ---------------------------------------------------------------------------

describe('countElements', () => {
  it('returns 1 for empty plan', () => {
    const plan = planDiagram(makeScene([]), lightTheme);
    expect(countElements(plan)).toBe(1);
  });

  it('counts single leaf', () => {
    const plan = planDiagram(
      makeScene([makeElement('node', { id: 'n1' })]),
      lightTheme,
    );
    expect(countElements(plan)).toBe(1);
  });

  it('counts multiple leaves', () => {
    const plan = planDiagram(
      makeScene([
        makeElement('node', { id: 'n1' }),
        makeElement('node', { id: 'n2' }),
        makeElement('text', { id: 't1' }),
      ]),
      lightTheme,
    );
    expect(countElements(plan)).toBe(3);
  });

  it('counts only leaf elements in blocks (not the block itself)', () => {
    const plan = planDiagram(
      makeScene([
        makeBlock('stack', [
          makeElement('node', { id: 'n1' }),
          makeElement('node', { id: 'n2' }),
        ], { id: 's1' }),
      ]),
      lightTheme,
    );
    // block-stack has 2 leaf children
    expect(countElements(plan)).toBe(2);
  });

  it('counts nested leaves correctly', () => {
    const plan = planDiagram(
      makeScene([
        makeBlock('stack', [
          makeBlock('flow', [
            makeElement('node', { id: 'a' }),
            makeElement('node', { id: 'b' }),
          ], { id: 'f1' }),
          makeElement('node', { id: 'c' }),
        ], { id: 's1' }),
        makeElement('text', { id: 't1' }),
      ]),
      lightTheme,
    );
    // 3 nodes inside blocks + 1 text = 4
    expect(countElements(plan)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// createScaleContext
// ---------------------------------------------------------------------------

describe('createScaleContext', () => {
  it('creates context with correct canvasArea', () => {
    const plan = planDiagram(
      makeScene([makeElement('node', { id: 'n1' })]),
      lightTheme,
    );
    const ctx = createScaleContext(plan, CANVAS);

    expect(ctx.canvasArea).toBe(CANVAS.w * CANVAS.h);
  });

  it('creates context with correct elementCount', () => {
    const plan = planDiagram(
      makeScene([
        makeElement('node', { id: 'n1' }),
        makeElement('node', { id: 'n2' }),
      ]),
      lightTheme,
    );
    const ctx = createScaleContext(plan, CANVAS);

    expect(ctx.elementCount).toBe(2);
  });

  it('baseUnit is positive', () => {
    const plan = planDiagram(
      makeScene([makeElement('node', { id: 'n1' })]),
      lightTheme,
    );
    const ctx = createScaleContext(plan, CANVAS);

    expect(ctx.baseUnit).toBeGreaterThan(0);
  });

  it('more elements → smaller baseUnit', () => {
    const planFew = planDiagram(
      makeScene([makeElement('node', { id: 'n1' }), makeElement('node', { id: 'n2' })]),
      lightTheme,
    );
    const planMany = planDiagram(
      makeScene([
        makeBlock('stack', [
          makeElement('node', { id: 'a' }),
          makeElement('node', { id: 'b' }),
          makeElement('node', { id: 'c' }),
          makeElement('node', { id: 'd' }),
          makeElement('node', { id: 'e' }),
          makeElement('node', { id: 'f' }),
          makeElement('node', { id: 'g' }),
          makeElement('node', { id: 'h' }),
        ], { id: 's1' }),
      ]),
      lightTheme,
    );

    const ctxFew = createScaleContext(planFew, CANVAS);
    const ctxMany = createScaleContext(planMany, CANVAS);

    expect(ctxFew.baseUnit).toBeGreaterThan(ctxMany.baseUnit);
  });
});
