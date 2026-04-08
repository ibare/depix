/**
 * `allocate-bounds-measure-map.test.ts`에서 사용하는 AST/PlanNode/MeasureMap 빌더.
 *
 * 별도 파일로 분리한 이유: C1 module-structure 300줄 한계 준수.
 * 본 파일은 `.test.ts`가 아니므로 vitest 수집 대상이 아니다.
 */

import { planBlockLike } from '../../../src/compiler/layout/plan-all-block.js';
import type { ASTBlock, ASTElement, ASTEdge } from '../../../src/compiler/ast.js';
import type { PlanNode } from '../../../src/compiler/layout/plan-types.js';
import type { MeasureMap, MeasureResult } from '../../../src/compiler/passes/measure.js';
import type { IRBounds } from '../../../src/ir/types.js';

function loc() {
  return { line: 1, column: 1 };
}

export function makeElement(id: string, type = 'node'): ASTElement {
  return {
    kind: 'element',
    elementType: type,
    id,
    props: {},
    style: {},
    flags: [],
    children: [],
    loc: loc(),
  };
}

export function makeEdge(fromId: string, toId: string): ASTEdge {
  return { kind: 'edge', fromId, toId, edgeStyle: '->', loc: loc() };
}

export function makeBlock(
  blockType: string,
  children: Array<ASTElement | ASTEdge>,
  props: Record<string, string | number> = {},
  blockId = `${blockType}-block`,
): ASTBlock {
  return {
    kind: 'block',
    blockType,
    props,
    children,
    id: blockId,
    style: {},
    loc: loc(),
  };
}

function childIdOf(parent: string, index: number): string {
  return `${parent}-child-${index}`;
}

export function makeBlockPlan(
  blockType: string,
  childIds: string[],
  edges: ASTEdge[] = [],
  props: Record<string, string | number> = {},
): PlanNode {
  const elements = childIds.map(id => makeElement(id));
  const block = makeBlock(blockType, [...elements, ...edges], props);
  return planBlockLike(block, block.id!, childIdOf);
}

export function defaultMeasure(over: Partial<MeasureResult> = {}): MeasureResult {
  return {
    fontSize: 2,
    lineHeight: 1.4,
    padding: 0,
    childGap: 0,
    minWidth: 0,
    minHeight: 0,
    ...over,
  };
}

export function buildMeasureMap(
  plan: PlanNode,
  builder: (childId: string, idx: number) => MeasureResult,
): MeasureMap {
  const map: MeasureMap = new Map();
  plan.children.forEach((c, i) => {
    map.set(c.id, builder(c.id, i));
  });
  return map;
}

export const CANVAS: IRBounds = { x: 0, y: 0, w: 100, h: 100 };
