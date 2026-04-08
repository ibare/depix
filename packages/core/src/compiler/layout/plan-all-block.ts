/**
 * `planAll`의 컨테이너 블록 변환 — `ASTBlock`(비-scene) → `PlanNode`.
 *
 * 책임:
 *   - blockType 정규화 (column → stack, 알 수 없는 블록 → scene 폴백)
 *   - 자식 재귀 변환 (children vs edges 분리)
 *   - PlanMetrics bottom-up 집계
 *   - weight 계산
 *
 * scene 블록은 `plan-all-scene.ts`가 처리한다. 여기서는 scene을 만나지 않는다
 * (scene은 정규화 단계에서 분리된 후 들어오지 않음).
 *

 */

import type { ASTBlock, ASTElement, ASTNode } from '../ast.js';
import { extractPlanEdges, filterNonEdges } from './plan-all-edges.js';
import { planLeaf } from './plan-all-element.js';
import type { PlanBlockType, PlanMetrics, PlanNode } from './plan-types.js';
import { computeWeight } from './plan-weights.js';

// ---------------------------------------------------------------------------
// planBlockLike — 진입점
// ---------------------------------------------------------------------------

/**
 * 비-scene 블록 또는 중첩 자식이 있는 element를 PlanNode로 변환.
 *
 * element 중첩 케이스:
 *   `box { label "x" }` — box는 elementType이지만 children이 있는 경우
 *   옛 파이프라인에서는 `element-shape`로 분류되면서 children이 붙어 있는 구조였다.
 *   PR-1에서는 box/layer를 `box`/`layer` PlanBlockType으로 승격시키는 것이 정석이지만,
 *   box/layer ELEMENT_TYPES → BLOCK_TYPES 재분류 작업은 별도 태스크로 분리되어 있어
 *   (메모리 §Deferred 참조) 이 단계에서는 element 채널로 처리한다.
 *
 * 현재 지원 블록 타입 (ASTBlock.blockType → PlanBlockType):
 *   flow → flow, tree → tree, stack → stack, column → stack(흡수),
 *   grid → grid, group → group, layers → layers, layer → layer,
 *   box → box, table → table, chart → chart.
 *
 * 알 수 없는 blockType은 scene으로 폴백 (§3.4.2 마지막 행).
 */
export function planBlockLike(
  block: ASTBlock | ASTElement,
  id: string,
  idFactory: (prefix: string, index: number) => string,
): PlanNode {
  if (block.kind === 'element') {
    return planElementWithChildren(block, id, idFactory);
  }
  return planBlock(block, id, idFactory);
}

// ---------------------------------------------------------------------------
// planBlock — ASTBlock → PlanNode
// ---------------------------------------------------------------------------

function planBlock(
  block: ASTBlock,
  id: string,
  idFactory: (prefix: string, index: number) => string,
): PlanNode {
  const blockType = mapBlockType(block.blockType);
  const rawChildren = block.children;

  // edges와 비-edges 분리
  const childNodes = filterNonEdges(rawChildren);
  const edges = extractPlanEdges(rawChildren);

  // 자식 재귀 변환
  const planChildren: PlanNode[] = [];
  childNodes.forEach((c, i) => {
    const childId = idFactory(id, i);
    planChildren.push(toChildPlan(c, childId, idFactory));
  });

  const metrics = computeContainerMetrics(planChildren);
  const node: PlanNode = {
    id: block.id ?? id,
    blockType,
    children: planChildren,
    weight: computeWeight(blockType, metrics),
    props: { ...block.props },
    style: { ...block.style },
    intrinsicSize: { width: 0, height: 0 }, // 컨테이너는 intrinsic 0 (measure가 채움)
    metrics,
  };

  if (block.label !== undefined) {
    node.label = block.label;
  }
  if (edges.length > 0 && supportsEdges(blockType)) {
    node.edges = edges;
  }
  return node;
}

/**
 * element가 children을 가질 때 (box/label with nested content).
 *
 * PR-1 현재 ELEMENT_TYPES에 속한 box/layer는 element 채널로 흐른다 (deferred).
 * 이 함수는 평범한 leaf element 변환 후 children을 재귀 attach한다.
 */
function planElementWithChildren(
  element: ASTElement,
  id: string,
  idFactory: (prefix: string, index: number) => string,
): PlanNode {
  const leaf = planLeaf(element, id);

  if (element.children.length === 0) {
    return leaf;
  }

  const childNodes = filterNonEdges(element.children);
  const planChildren: PlanNode[] = childNodes.map((c, i) =>
    toChildPlan(c, idFactory(id, i), idFactory),
  );

  const metrics = computeContainerMetrics(planChildren);
  // leaf의 blockType/weight를 유지하되 children/metrics만 채운다.
  // (ELEMENT_TYPES 재분류 전까지의 과도기 구조)
  return {
    ...leaf,
    children: planChildren,
    metrics,
    weight: computeWeight(leaf.blockType, metrics),
  };
}

// ---------------------------------------------------------------------------
// toChildPlan — 재귀 dispatcher
// ---------------------------------------------------------------------------

/**
 * 자식 노드를 재귀적으로 PlanNode로 변환. scene은 다루지 않는다.
 * 엣지는 이 경로로 들어오지 않는다 (상위에서 이미 filterNonEdges됨).
 */
function toChildPlan(
  node: Exclude<ASTNode, { kind: 'edge' }>,
  id: string,
  idFactory: (prefix: string, index: number) => string,
): PlanNode {
  if (node.kind === 'element') {
    // element가 children을 갖고 있으면 planBlockLike, 아니면 planLeaf
    if (node.children.length > 0) {
      return planElementWithChildren(node, id, idFactory);
    }
    return planLeaf(node, id);
  }
  // ASTBlock
  return planBlock(node, id, idFactory);
}

// ---------------------------------------------------------------------------
// mapBlockType — ASTBlock.blockType → PlanBlockType
// ---------------------------------------------------------------------------

/**
 * AST의 raw blockType 문자열을 16종 PlanBlockType enum으로 매핑.
 *
 * 매핑 규칙 (§3.4.2):
 *   - column → stack (흡수)
 *   - canvas → 이 함수에 도달하지 않음 (tokenizer에서 제거됨, Step C에서 완료)
 *     만약 예상치 못하게 들어오면 scene 폴백.
 *   - 알 수 없는 블록 → scene 폴백
 */
export function mapBlockType(raw: string): PlanBlockType {
  switch (raw) {
    case 'flow':
      return 'flow';
    case 'tree':
      return 'tree';
    case 'stack':
    case 'column': // 흡수
      return 'stack';
    case 'grid':
      return 'grid';
    case 'group':
      return 'group';
    case 'layers':
      return 'layers';
    case 'layer':
      return 'layer';
    case 'box':
      return 'box';
    case 'table':
      return 'table';
    case 'chart':
      return 'chart';
    case 'scene':
      return 'scene';
    default:
      // 알 수 없는 블록은 scene으로 흡수. canvas도 여기로 와서 scene이 된다.
      return 'scene';
  }
}

/**
 * 엣지가 의미 있는 블록 타입만 `edges` 필드를 갖는다. flow/tree가 대표적.
 * stack/grid 등에서는 엣지가 와도 무시되지 않도록 fallback으로 보존할 수 있으나,
 * 옛 로직에서는 flow/tree 외에는 엣지를 사용하지 않았다.
 */
function supportsEdges(blockType: PlanBlockType): boolean {
  return blockType === 'flow' || blockType === 'tree';
}

// ---------------------------------------------------------------------------
// computeContainerMetrics — 자식들로부터 bottom-up 집계
// ---------------------------------------------------------------------------

/**
 * 컨테이너 노드의 PlanMetrics. 자식 배열로부터 재귀 합산.
 *
 * 공식:
 *   descendantCount = Σ(child.metrics.descendantCount + 1)
 *   childCount      = children.length
 *   maxDepth        = 1 + max(child.metrics.maxDepth, 0)
 *   blockChildCount = children 중 blockType이 element-*가 아닌 것의 수
 *   leafChildCount  = children 중 blockType이 element-*인 것의 수
 */
export function computeContainerMetrics(children: PlanNode[]): PlanMetrics {
  let descendantCount = 0;
  let maxChildDepth = 0;
  let blockChildCount = 0;
  let leafChildCount = 0;

  for (const c of children) {
    descendantCount += c.metrics.descendantCount + 1;
    if (c.metrics.maxDepth > maxChildDepth) {
      maxChildDepth = c.metrics.maxDepth;
    }
    if (c.blockType.startsWith('element-')) {
      leafChildCount += 1;
    } else {
      blockChildCount += 1;
    }
  }

  return {
    descendantCount,
    childCount: children.length,
    maxDepth: children.length > 0 ? maxChildDepth + 1 : 0,
    blockChildCount,
    leafChildCount,
  };
}
