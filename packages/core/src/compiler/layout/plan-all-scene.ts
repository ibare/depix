/**
 * `planAll`의 scene 변환 — `ASTBlock`(scene) → `PlanNode`(blockType: 'scene').
 *
 * 책임:
 *   - implicit scene 래핑 (비-scene 블록 → `scene { layout: full; body: <block> }`)
 *   - 슬롯 기반 자식 정규화 (slot 미지정 시 body로 이동, 다중 자식은 stack으로 감싸기)
 *   - `SceneLayoutSpec` 추출 (`props.layout` → `preset`)
 *
 * 옛 파이프라인의 `compiler.ts::normalizeScenes`/`normalizeScene` 로직을 그대로
 * 이식하되, 결과물은 AST가 아닌 PlanNode다.
 *

 */

import type { ASTBlock, ASTNode } from '../ast.js';
import { planBlockLike } from './plan-all-block.js';
import { extractPlanEdges, filterNonEdges } from './plan-all-edges.js';
import { computeContainerMetrics } from './plan-all-block.js';
import type { PlanNode, SceneLayoutSpec } from './plan-types.js';
import { computeWeight } from './plan-weights.js';
import type { SceneLayoutType } from './scene-layout.js';

// ---------------------------------------------------------------------------
// planSceneBlock — 진입점
// ---------------------------------------------------------------------------

/**
 * 최상위 블록 하나를 scene PlanNode로 변환. 비-scene 블록은 implicit scene으로 래핑.
 *
 * 세 가지 케이스 (옛 `normalizeScene`과 동일):
 *   A) `blockType === 'scene'` + 슬롯 있는 자식 존재 → 그대로 사용
 *   B) 비-scene 블록 → `scene { layout: full, body: <block> }` 래핑
 *   C) scene 블록이지만 슬롯 미지정 → 단일 자식은 body 슬롯, 다중 자식은 stack으로 감싸기
 */
export function planSceneBlock(
  block: ASTBlock,
  id: string,
  idFactory: (prefix: string, index: number) => string,
): PlanNode {
  if (block.blockType === 'scene' && hasSlottedContent(block)) {
    return buildSceneFromSlotted(block, id, idFactory);
  }
  if (block.blockType !== 'scene') {
    return buildImplicitScene(block, id, idFactory);
  }
  return buildSceneFromUnslotted(block, id, idFactory);
}

// ---------------------------------------------------------------------------
// Case A: 이미 슬롯이 있는 scene
// ---------------------------------------------------------------------------

function buildSceneFromSlotted(
  block: ASTBlock,
  id: string,
  idFactory: (prefix: string, index: number) => string,
): PlanNode {
  const layoutSpec = extractSceneLayoutSpec(block);
  const childNodes = filterNonEdges(block.children);
  const edges = extractPlanEdges(block.children);

  const planChildren: PlanNode[] = childNodes.map((c, i) => {
    const childId = idFactory(id, i);
    const child = planBlockLike(c, childId, idFactory);
    // slot 정보 전파 — AST 자식의 `slot` 필드를 PlanNode로 옮긴다.
    const slot = readSlot(c);
    if (slot !== undefined) {
      child.slot = slot;
    }
    return child;
  });

  const metrics = computeContainerMetrics(planChildren);
  const node: PlanNode = {
    id,
    blockType: 'scene',
    layout: layoutSpec,
    children: planChildren,
    weight: computeWeight('scene', metrics),
    props: { ...block.props },
    style: { ...block.style },
    intrinsicSize: { width: 0, height: 0 },
    metrics,
  };
  if (block.label !== undefined) node.label = block.label;
  if (edges.length > 0) node.edges = edges;
  return node;
}

// ---------------------------------------------------------------------------
// Case B: 비-scene 블록 → implicit scene으로 래핑
// ---------------------------------------------------------------------------

function buildImplicitScene(
  block: ASTBlock,
  id: string,
  idFactory: (prefix: string, index: number) => string,
): PlanNode {
  // 단일 자식: 원본 블록을 body 슬롯에 배치.
  const bodyChildId = idFactory(id, 0);
  const bodyChild = planBlockLike(block, bodyChildId, idFactory);
  bodyChild.slot = 'body';

  const metrics = computeContainerMetrics([bodyChild]);
  return {
    id,
    blockType: 'scene',
    layout: { preset: 'full' },
    children: [bodyChild],
    weight: computeWeight('scene', metrics),
    props: { layout: 'full' },
    style: {},
    intrinsicSize: { width: 0, height: 0 },
    metrics,
  };
}

// ---------------------------------------------------------------------------
// Case C: scene 블록이지만 슬롯 미지정
// ---------------------------------------------------------------------------

function buildSceneFromUnslotted(
  block: ASTBlock,
  id: string,
  idFactory: (prefix: string, index: number) => string,
): PlanNode {
  const nonEdge = filterNonEdges(block.children);
  const edges = extractPlanEdges(block.children);
  const layoutSpec = extractSceneLayoutSpec(block);

  if (nonEdge.length === 1) {
    // 단일 자식 → body 슬롯에 직접 할당
    const bodyChildId = idFactory(id, 0);
    const bodyChild = planBlockLike(nonEdge[0], bodyChildId, idFactory);
    bodyChild.slot = 'body';
    const metrics = computeContainerMetrics([bodyChild]);
    const node: PlanNode = {
      id,
      blockType: 'scene',
      layout: layoutSpec,
      children: [bodyChild],
      weight: computeWeight('scene', metrics),
      props: { ...block.props, layout: block.props.layout ?? 'full' },
      style: { ...block.style },
      intrinsicSize: { width: 0, height: 0 },
      metrics,
    };
    if (block.label !== undefined) node.label = block.label;
    if (edges.length > 0) node.edges = edges;
    return node;
  }

  // 다중 자식 → stack으로 감싼 후 body 슬롯에 배치
  const bodyChildId = idFactory(id, 0);
  const bodyChild: PlanNode = planBlockLike(
    makeStackWrapper(nonEdge, block),
    bodyChildId,
    idFactory,
  );
  bodyChild.slot = 'body';

  const metrics = computeContainerMetrics([bodyChild]);
  const node: PlanNode = {
    id,
    blockType: 'scene',
    layout: layoutSpec,
    children: [bodyChild],
    weight: computeWeight('scene', metrics),
    props: { ...block.props, layout: block.props.layout ?? 'full' },
    style: { ...block.style },
    intrinsicSize: { width: 0, height: 0 },
    metrics,
  };
  if (block.label !== undefined) node.label = block.label;
  if (edges.length > 0) node.edges = edges;
  return node;
}

/**
 * 여러 자식을 임시 `stack` 블록으로 감싼다. 옛 `normalizeScene`의 stack 래핑과 동일.
 * 원본 edges는 bodyChild 내부에서 stack의 자식으로 재배치된다.
 */
function makeStackWrapper(children: ASTNode[], source: ASTBlock): ASTBlock {
  return {
    kind: 'block',
    blockType: 'stack',
    props: { align: 'center' },
    children: [...children],
    style: {},
    loc: source.loc,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasSlottedContent(block: ASTBlock): boolean {
  return block.children.some(
    (c) => (c.kind === 'element' || c.kind === 'block') && c.slot !== undefined,
  );
}

function readSlot(node: ASTNode): string | undefined {
  if (node.kind === 'edge') return undefined;
  return node.slot;
}

/**
 * ASTBlock의 `props.layout` 문자열을 `SceneLayoutSpec`으로 변환.
 *
 * 기본값은 `'full'`. 알 수 없는 preset 문자열도 그대로 통과시키되,
 * 런타임에서 `SceneLayoutType`의 유효 값만 허용되도록 type cast한다.
 * (`scene-layout.ts::layoutScene`의 switch가 unknown case를 default로 폴백한다.)
 */
export function extractSceneLayoutSpec(block: ASTBlock): SceneLayoutSpec {
  const raw = block.props.layout;
  const preset = typeof raw === 'string' ? (raw as SceneLayoutType) : 'full';
  return { preset };
}
