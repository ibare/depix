/**
 * `planAll`의 엣지 변환 helper.
 *
 * flow/tree 등 컨테이너가 직계 자식으로 엣지를 가질 때, 해당 `ASTEdge[]`를
 * `PlanEdge[]`로 변환한다. plan-all-block.ts가 호출한다.
 *

 */

import type { ASTEdge, ASTNode } from '../ast.js';
import type { PlanEdge } from './plan-types.js';

/**
 * 자식 리스트에서 엣지만 골라 `PlanEdge[]`로 변환.
 *
 * 순수 함수 — 원본 배열 불변. `children.filter`와 달리 반환 타입이 좁혀진다.
 */
export function extractPlanEdges(children: ASTNode[]): PlanEdge[] {
  const out: PlanEdge[] = [];
  for (const c of children) {
    if (c.kind === 'edge') {
      out.push(astEdgeToPlanEdge(c));
    }
  }
  return out;
}

/**
 * 단일 `ASTEdge` → `PlanEdge` 변환.
 *
 * 변환 규칙:
 *   - fromId/toId/edgeStyle은 그대로 복사.
 *   - label은 있을 때만 복사 (undefined는 생략).
 *   - loc은 `PlanEdge`에서 제거 — plan 단계에서는 소스 위치가 필요 없다.
 */
export function astEdgeToPlanEdge(edge: ASTEdge): PlanEdge {
  const out: PlanEdge = {
    fromId: edge.fromId,
    toId: edge.toId,
    edgeStyle: edge.edgeStyle,
  };
  if (edge.label !== undefined) {
    out.label = edge.label;
  }
  return out;
}

/**
 * 자식 리스트에서 비-엣지(블록/엘리먼트)만 남긴다.
 *
 * `extractPlanEdges`와 쌍으로 사용되어 컨테이너 노드의 children/edges를 분리한다.
 */
export function filterNonEdges(children: ASTNode[]): Exclude<ASTNode, ASTEdge>[] {
  const out: Exclude<ASTNode, ASTEdge>[] = [];
  for (const c of children) {
    if (c.kind !== 'edge') {
      out.push(c);
    }
  }
  return out;
}
