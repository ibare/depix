/**
 * PR-4 (L5) — Slot ↔ Container 역류 채널 회귀 테스트
 *
 * 검증 원칙:
 *   1. Flow/Group/Tree의 containerBounds가 실제 children 사용 공간을 정확히 반영한다
 *      (이전의 cross-axis hardcoding이 제거되어 slot 전체가 아닌 actual usage).
 *   2. Container는 slot 내부에서 center/center로 정렬된다.
 *   3. Binary Search 스타일 flowchart에서 수직 공백이 더 이상 container를 부풀리지 않는다.
 *
 * 좌표 하드코딩을 피하고 `toBeLessThan` / `toBeCloseTo` 같은 불변식 단언을 사용한다.
 */

import { describe, it, expect } from 'vitest';
import { compile } from '../../../src/compiler/compiler.js';
import { layoutFlow } from '../../../src/compiler/layout/flow-layout.js';
import { layoutGroup } from '../../../src/compiler/layout/group-layout.js';
import { layoutTree } from '../../../src/compiler/layout/tree-layout.js';
import type {
  FlowLayoutConfig,
  GroupLayoutConfig,
  LayoutChild,
  TreeLayoutConfig,
  TreeNode,
} from '../../../src/compiler/layout/types.js';
import type { IRBounds, IRContainer } from '../../../src/ir/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SLOT: IRBounds = { x: 20, y: 30, w: 80, h: 60 };

function assertCentered(container: IRBounds, slot: IRBounds, tol = 0.5): void {
  const containerCx = container.x + container.w / 2;
  const containerCy = container.y + container.h / 2;
  const slotCx = slot.x + slot.w / 2;
  const slotCy = slot.y + slot.h / 2;
  expect(containerCx).toBeCloseTo(slotCx, tol);
  expect(containerCy).toBeCloseTo(slotCy, tol);
}

function assertWithinSlot(container: IRBounds, slot: IRBounds): void {
  expect(container.w).toBeLessThanOrEqual(slot.w + 0.01);
  expect(container.h).toBeLessThanOrEqual(slot.h + 0.01);
  expect(container.x).toBeGreaterThanOrEqual(slot.x - 0.01);
  expect(container.y).toBeGreaterThanOrEqual(slot.y - 0.01);
}

function assertEnclosesChildren(container: IRBounds, children: IRBounds[]): void {
  for (const c of children) {
    expect(c.x).toBeGreaterThanOrEqual(container.x - 0.01);
    expect(c.y).toBeGreaterThanOrEqual(container.y - 0.01);
    expect(c.x + c.w).toBeLessThanOrEqual(container.x + container.w + 0.01);
    expect(c.y + c.h).toBeLessThanOrEqual(container.y + container.h + 0.01);
  }
}

function flowChild(id: string, w = 12, h = 8): LayoutChild {
  return { id, width: w, height: h };
}

function flowConfig(
  direction: FlowLayoutConfig['direction'],
  edges: { fromId: string; toId: string }[] = [],
): FlowLayoutConfig {
  return { bounds: SLOT, direction, gap: 4, edges };
}

// ---------------------------------------------------------------------------
// 1. Flow — horizontal cross-axis shrink
// ---------------------------------------------------------------------------

describe('layoutFlow — horizontal container shrinks on the cross axis', () => {
  it('container.h reflects actual layer cross usage, not slot.h', () => {
    const children = [flowChild('a'), flowChild('b'), flowChild('c')];
    const edges = [
      { fromId: 'a', toId: 'b' },
      { fromId: 'b', toId: 'c' },
    ];

    const { containerBounds, childBounds } = layoutFlow(children, flowConfig('right', edges));

    // Container should shrink on the cross axis below slot.h (previous hardcoding = slot.h).
    expect(containerBounds.h).toBeLessThan(SLOT.h);
    assertWithinSlot(containerBounds, SLOT);
    assertCentered(containerBounds, SLOT);
    assertEnclosesChildren(containerBounds, childBounds);
  });
});

describe('layoutFlow — vertical container shrinks on the cross axis', () => {
  it('container.w reflects actual layer cross usage, not slot.w', () => {
    const children = [flowChild('a'), flowChild('b')];
    const edges = [{ fromId: 'a', toId: 'b' }];

    const { containerBounds, childBounds } = layoutFlow(children, flowConfig('down', edges));

    expect(containerBounds.w).toBeLessThan(SLOT.w);
    assertWithinSlot(containerBounds, SLOT);
    assertCentered(containerBounds, SLOT);
    assertEnclosesChildren(containerBounds, childBounds);
  });
});

// ---------------------------------------------------------------------------
// 2. Group — width shrinks to fit widest child + padding
// ---------------------------------------------------------------------------

describe('layoutGroup — container width shrinks to fit widest child', () => {
  it('container.w ≈ maxChildDrawnW + padding*2 and is horizontally centered', () => {
    const padding = 5;
    const config: GroupLayoutConfig = { bounds: SLOT, padding };
    const children: LayoutChild[] = [
      { id: 'a', width: 20, height: 8 },
      { id: 'b', width: 15, height: 8 },
      { id: 'c', width: 25, height: 8 }, // widest
    ];

    const { containerBounds, childBounds } = layoutGroup(children, config);

    const expectedW = 25 + padding * 2;
    expect(containerBounds.w).toBeCloseTo(expectedW, 1);
    expect(containerBounds.w).toBeLessThan(SLOT.w);
    // Horizontal center invariance: container cx == slot cx
    const containerCx = containerBounds.x + containerBounds.w / 2;
    const slotCx = SLOT.x + SLOT.w / 2;
    expect(containerCx).toBeCloseTo(slotCx, 1);
    assertEnclosesChildren(containerBounds, childBounds);
  });
});

// ---------------------------------------------------------------------------
// 3. Tree — containerBounds origin reflects center offsets
// ---------------------------------------------------------------------------

describe('layoutTree — container origin encloses the actual children', () => {
  it('container wraps children on both axes instead of sitting at slot origin', () => {
    const nodes: TreeNode[] = [
      { id: 'root', width: 10, height: 8, children: [1, 2] },
      { id: 'a', width: 10, height: 8, children: [] },
      { id: 'b', width: 10, height: 8, children: [] },
    ];
    const config: TreeLayoutConfig = {
      bounds: SLOT,
      direction: 'down',
      levelGap: 6,
      siblingGap: 4,
    };

    const { containerBounds, childBounds } = layoutTree(nodes, config);

    // Children must lie fully inside the reported containerBounds
    // (previously container sat at bounds.x/y while children were center-offset).
    assertEnclosesChildren(containerBounds, childBounds);
    assertWithinSlot(containerBounds, SLOT);
  });
});

// ---------------------------------------------------------------------------
// 4. E2E — Binary Search flowchart vertical whitespace regression
// ---------------------------------------------------------------------------

function findContainersDeep(el: IRContainer | { type: string }, acc: IRContainer[] = []): IRContainer[] {
  if ((el as { type: string }).type === 'container') {
    const c = el as IRContainer;
    acc.push(c);
    for (const child of c.children) {
      if ((child as { type: string }).type === 'container') {
        findContainersDeep(child as IRContainer, acc);
      }
    }
  }
  return acc;
}

describe('E2E — slot↔container feedback in compiled IR', () => {
  it('Binary-Search style flowchart does not inflate its container to the full slot height', () => {
    const { ir, errors } = compile(`
@presentation
scene "BinarySearch" {
  layout: header
  header: heading "Binary Search"
  body: flow direction:down {
    node "Start" #start
    node "Low <= High?" #cond
    node "Return -1" #fail
    #start -> #cond
    #cond -> #fail "No"
  }
}
`);
    expect(errors).toEqual([]);
    const scene = ir.scenes[0];
    const allContainers: IRContainer[] = [];
    for (const el of scene.elements) {
      if (el.type === 'container') findContainersDeep(el, allContainers);
    }
    // At least one container (the flow) should have at least 3 node children
    const flowContainer = allContainers.find(c => c.children.filter(ch => (ch as { type: string }).type === 'container' || (ch as { type: string }).type === 'node' || (ch as { type: string }).type === 'shape').length >= 3);
    expect(flowContainer).toBeDefined();

    // The flow container should report a height strictly smaller than the full
    // scene canvas (canvas is 0–100 relative space, header takes a top slice).
    // With the cross-axis fix the container tightly wraps its nodes.
    const CANVAS_H = 100;
    expect(flowContainer!.bounds.h).toBeLessThan(CANVAS_H);
    // And the children should lie within the container bounds
    for (const child of flowContainer!.children) {
      const cb = (child as { bounds?: IRBounds }).bounds;
      if (!cb) continue;
      expect(cb.x + cb.w).toBeLessThanOrEqual(flowContainer!.bounds.x + flowContainer!.bounds.w + 0.5);
      expect(cb.y + cb.h).toBeLessThanOrEqual(flowContainer!.bounds.y + flowContainer!.bounds.h + 0.5);
    }
  });

  it('group inside a split slot shrinks its container width', () => {
    const { ir, errors } = compile(`
@presentation
scene "S" {
  layout: split
  left: group {
    label "Item A"
    label "Item B"
  }
  right: heading "Right"
}
`);
    expect(errors).toEqual([]);
    const scene = ir.scenes[0];
    const allContainers: IRContainer[] = [];
    for (const el of scene.elements) {
      if (el.type === 'container') findContainersDeep(el, allContainers);
    }
    // The left-slot group container should exist.
    // Its width should be strictly smaller than half the canvas (canvas = 0–100)
    // because the split slot occupies at most half the canvas and the group
    // shrinks further to fit its widest label.
    const CANVAS_W = 100;
    const groupLike = allContainers.find(c => c.bounds.w < CANVAS_W / 2);
    expect(groupLike).toBeDefined();
  });
});
