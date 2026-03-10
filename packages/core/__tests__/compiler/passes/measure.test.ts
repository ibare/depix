import { describe, it, expect } from 'vitest';
import { measureDiagram } from '../../../src/compiler/passes/measure.js';
import { planDiagram } from '../../../src/compiler/passes/plan-layout.js';
import { createScaleContext } from '../../../src/compiler/passes/scale-system.js';
import { lightTheme } from '../../../src/theme/builtin-themes.js';
import type { ASTBlock, ASTElement } from '../../../src/compiler/ast.js';
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

function measureWithDefaults(scene: ASTBlock) {
  const plan = planDiagram(scene, lightTheme);
  const scaleCtx = createScaleContext(plan, CANVAS);
  const measureMap = measureDiagram(plan, lightTheme, scaleCtx);
  return { plan, scaleCtx, measureMap };
}

// ---------------------------------------------------------------------------
// measureDiagram basic
// ---------------------------------------------------------------------------

describe('measureDiagram', () => {
  it('returns empty map for empty scene', () => {
    const { measureMap } = measureWithDefaults(makeScene([]));
    expect(measureMap.size).toBe(0);
  });

  it('measures single text element', () => {
    const scene = makeScene([
      makeElement('text', { id: 't1', label: 'Hello' }),
    ]);
    const { measureMap, plan } = measureWithDefaults(scene);
    const m = measureMap.get(plan.children[0].id);
    expect(m).toBeDefined();
    expect(m!.fontSize).toBeGreaterThan(0);
    expect(m!.minHeight).toBeGreaterThan(0);
    expect(m!.minWidth).toBeGreaterThan(0);
  });

  it('measures single node element', () => {
    const scene = makeScene([
      makeElement('node', { id: 'n1', label: 'Server' }),
    ]);
    const { measureMap, plan } = measureWithDefaults(scene);
    const m = measureMap.get(plan.children[0].id);
    expect(m).toBeDefined();
    expect(m!.minWidth).toBe(lightTheme.node.minWidth);
  });

  it('measures list element with items', () => {
    const scene = makeScene([
      makeElement('list', { id: 'l1', items: ['A', 'B', 'C'] }),
    ]);
    const { measureMap, plan } = measureWithDefaults(scene);
    const m = measureMap.get(plan.children[0].id);
    expect(m).toBeDefined();
    expect(m!.minHeight).toBeGreaterThan(0);
    expect(m!.childGap).toBeGreaterThan(0);
  });

  it('measures divider element', () => {
    const scene = makeScene([
      makeElement('divider', { id: 'd1' }),
    ]);
    const { measureMap, plan } = measureWithDefaults(scene);
    const m = measureMap.get(plan.children[0].id);
    expect(m).toBeDefined();
    expect(m!.fontSize).toBe(0);
    expect(m!.minHeight).toBe(0.5);
  });

  it('measures image element', () => {
    const scene = makeScene([
      makeElement('image', { id: 'i1', props: { width: 30, height: 20 } }),
    ]);
    const { measureMap, plan } = measureWithDefaults(scene);
    const m = measureMap.get(plan.children[0].id);
    expect(m).toBeDefined();
    expect(m!.minWidth).toBe(30);
    expect(m!.minHeight).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// Font size resolution priority
// ---------------------------------------------------------------------------

describe('fontSize resolution priority', () => {
  it('uses inline font-size when specified', () => {
    const scene = makeScene([
      makeElement('text', { id: 't1', label: 'Big', style: { 'font-size': 5.0 } }),
    ]);
    const { measureMap, plan } = measureWithDefaults(scene);
    const m = measureMap.get(plan.children[0].id);
    expect(m!.fontSize).toBe(5.0);
  });

  it('uses scale system when no inline font-size', () => {
    const scene = makeScene([
      makeElement('text', { id: 't1', label: 'Normal' }),
    ]);
    const { measureMap, plan } = measureWithDefaults(scene);
    const m = measureMap.get(plan.children[0].id);
    // ScaleSystem should produce a value different from theme fallback
    expect(m!.fontSize).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Box measurement with title + subtitle
// ---------------------------------------------------------------------------

describe('box measurement', () => {
  it('includes titleFontSize and titleHeight for labeled box', () => {
    const scene = makeScene([
      makeElement('box', { id: 'b1', label: 'My Box' }),
    ]);
    const { measureMap, plan } = measureWithDefaults(scene);
    const m = measureMap.get(plan.children[0].id);
    expect(m).toBeDefined();
    expect(m!.titleFontSize).toBeGreaterThan(0);
    expect(m!.titleHeight).toBeGreaterThan(0);
    expect(m!.padding).toBeGreaterThan(0);
  });

  it('includes subtitleFontSize and subtitleHeight when subtitle is present', () => {
    const scene = makeScene([
      makeElement('box', { id: 'b1', label: 'Title', props: { subtitle: 'Sub' } }),
    ]);
    const { measureMap, plan } = measureWithDefaults(scene);
    const m = measureMap.get(plan.children[0].id);
    expect(m!.subtitleFontSize).toBeGreaterThan(0);
    expect(m!.subtitleHeight).toBeGreaterThan(0);
  });

  it('does not include subtitle fields when no subtitle', () => {
    const scene = makeScene([
      makeElement('box', { id: 'b1', label: 'Title' }),
    ]);
    const { measureMap, plan } = measureWithDefaults(scene);
    const m = measureMap.get(plan.children[0].id);
    expect(m!.subtitleFontSize).toBeUndefined();
    expect(m!.subtitleHeight).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Block measurement (bottom-up)
// ---------------------------------------------------------------------------

describe('block measurement', () => {
  it('minHeight includes children minHeights + gaps + padding', () => {
    const scene = makeScene([
      makeBlock('stack', [
        makeElement('node', { id: 'n1', label: 'A' }),
        makeElement('node', { id: 'n2', label: 'B' }),
      ], { id: 's1' }),
    ]);
    const { measureMap, plan } = measureWithDefaults(scene);
    const blockM = measureMap.get(plan.children[0].id);
    const child0M = measureMap.get(plan.children[0].children[0].id);
    const child1M = measureMap.get(plan.children[0].children[1].id);
    expect(blockM).toBeDefined();
    expect(child0M).toBeDefined();
    expect(child1M).toBeDefined();
    // Block minHeight >= children minHeights + gap + padding*2
    expect(blockM!.minHeight).toBeGreaterThanOrEqual(
      child0M!.minHeight + child1M!.minHeight + blockM!.padding * 2,
    );
  });

  it('minWidth includes max child minWidth + padding', () => {
    const scene = makeScene([
      makeBlock('stack', [
        makeElement('node', { id: 'n1', label: 'Wide Node' }),
        makeElement('text', { id: 't1', label: 'Short' }),
      ], { id: 's1' }),
    ]);
    const { measureMap, plan } = measureWithDefaults(scene);
    const blockM = measureMap.get(plan.children[0].id);
    const child0M = measureMap.get(plan.children[0].children[0].id);
    const child1M = measureMap.get(plan.children[0].children[1].id);
    const maxChildW = Math.max(child0M!.minWidth, child1M!.minWidth);
    expect(blockM!.minWidth).toBe(maxChildW + blockM!.padding * 2);
  });
});

// ---------------------------------------------------------------------------
// Large font-size impact
// ---------------------------------------------------------------------------

describe('large font-size impact', () => {
  it('larger font-size produces larger minHeight for text', () => {
    const sceneSmall = makeScene([
      makeElement('text', { id: 't1', label: 'Hi', style: { 'font-size': 1.0 } }),
    ]);
    const sceneLarge = makeScene([
      makeElement('text', { id: 't1', label: 'Hi', style: { 'font-size': 8.0 } }),
    ]);
    const { measureMap: mapSmall, plan: planSmall } = measureWithDefaults(sceneSmall);
    const { measureMap: mapLarge, plan: planLarge } = measureWithDefaults(sceneLarge);

    const mSmall = mapSmall.get(planSmall.children[0].id)!;
    const mLarge = mapLarge.get(planLarge.children[0].id)!;
    expect(mLarge.minHeight).toBeGreaterThan(mSmall.minHeight);
  });

  it('box with large font-size has larger titleHeight', () => {
    const sceneSmall = makeScene([
      makeElement('box', { id: 'b1', label: 'Box', style: { 'font-size': 1.0 } }),
    ]);
    const sceneLarge = makeScene([
      makeElement('box', { id: 'b1', label: 'Box', style: { 'font-size': 8.0 } }),
    ]);
    const { measureMap: mapSmall, plan: planSmall } = measureWithDefaults(sceneSmall);
    const { measureMap: mapLarge, plan: planLarge } = measureWithDefaults(sceneLarge);

    const mSmall = mapSmall.get(planSmall.children[0].id)!;
    const mLarge = mapLarge.get(planLarge.children[0].id)!;
    expect(mLarge.titleHeight!).toBeGreaterThan(mSmall.titleHeight!);
    expect(mLarge.minHeight).toBeGreaterThan(mSmall.minHeight);
  });
});
