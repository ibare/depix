/**
 * `planAll`의 leaf element 변환 — `ASTElement` → `PlanNode`(element-*).
 *
 * 책임:
 *   - element kind 분류 (`element-shape|text|list|divider|image`)
 *   - intrinsicSize 결정 (prop override > registry default)
 *   - leaf용 PlanMetrics 생성
 *   - weight 계산 (`plan-weights.ts::computeWeight`)
 *

 */

import type { ASTElement } from '../ast.js';
import { getElementConfig } from '../element-type-registry.js';
import type { PlanBlockType, PlanMetrics, PlanNode } from './plan-types.js';
import { computeWeight } from './plan-weights.js';

// ---------------------------------------------------------------------------
// planLeaf — 진입점
// ---------------------------------------------------------------------------

/**
 * 단일 ASTElement를 leaf PlanNode로 변환.
 *
 * 주의:
 *   - 이 함수는 leaf만 다룬다. `element.children`에 중첩 요소가 있는 경우
 *     (예: `box { label "x" }`)는 `plan-all-block.ts::planBlockLike`가 처리한다.
 *     여기서는 single leaf element의 변환에만 집중.
 *   - style은 ASTElement.style 얕은 복사. IRStyle로 변환하지 않는다 (emit walker 책임).
 */
export function planLeaf(element: ASTElement, id: string): PlanNode {
  const config = getElementConfig(element.elementType);
  const blockType = classifyElementKind(element.elementType);
  const intrinsic = resolveIntrinsicSize(element, config.intrinsicSize);
  const metrics = makeLeafMetrics();

  const style: Record<string, string | number> = { ...element.style };
  if (element.flags?.includes('bold')) {
    style['font-weight'] = 'bold';
  }

  const node: PlanNode = {
    id: element.id ?? id,
    blockType,
    elementType: element.elementType,
    children: [],
    weight: computeWeight(blockType, metrics),
    props: { ...element.props },
    style,
    intrinsicSize: intrinsic,
    metrics,
  };

  if (element.label !== undefined) {
    node.label = element.label;
  }
  // element-list는 items를 top-level로 복사 (scale-system이 items.length 사용).
  if (element.elementType === 'list' || element.elementType === 'bullet') {
    node.items = element.items ? [...element.items] : [];
  }
  // element-row는 values를 top-level로 복사 (compute-chart-positions가 사용).
  if (element.elementType === 'row' && element.values) {
    node.values = [...element.values];
  }

  return node;
}

// ---------------------------------------------------------------------------
// classifyElementKind — elementType → PlanBlockType (element-*)
// ---------------------------------------------------------------------------

/**
 * elementType(문자열) → `element-*` PlanBlockType.
 *
 * element-type-registry의 `classify` 필드를 그대로 사용한다. 현재 registry의
 * `classify` 타입은 옛 `PlanNodeType`(30종)이지만, 리프 요소에서 실제로 사용되는
 * 값은 `element-shape|text|list|divider|image` 5종뿐이며 이들은 모두 `PlanBlockType`의
 * 리프 5종과 동일 문자열이다.
 *
 * Step C에서 element-type-registry의 `classify` 타입이 `PlanBlockType`으로 교체되면
 * 이 함수의 type cast는 제거될 수 있다.
 *
 * 알 수 없는 elementType은 registry가 `node` config로 폴백하므로 항상 `element-shape`가 된다.
 */
export function classifyElementKind(elementType: string): PlanBlockType {
  const classify = getElementConfig(elementType).classify;
  // 방어: classify 값이 element-* 리프 5종 중 하나인지 런타임 검사.
  if (
    classify === 'element-shape' ||
    classify === 'element-text' ||
    classify === 'element-list' ||
    classify === 'element-divider' ||
    classify === 'element-image'
  ) {
    return classify;
  }
  // registry가 블록 타입을 반환했다면 이 함수의 선조건(leaf element) 위반.
  // Step C 완료 시점에서는 registry.classify의 타입이 element-* 5종으로 제한되어
  // 이 분기에 진입할 수 없게 된다.
  return 'element-shape';
}

// ---------------------------------------------------------------------------
// resolveIntrinsicSize — prop override > registry default
// ---------------------------------------------------------------------------

/**
 * element의 고유 크기(0–100 상대 좌표) 결정.
 *
 * 우선순위:
 *   1. element.props.width/height에 숫자 값이 있으면 그 값을 사용.
 *   2. 아니면 registry의 기본 intrinsicSize.
 *
 * `list` 요소는 항목 수에 비례한 높이 보정이 필요하지만, 그 로직은 옛
 * `plan-layout.ts::computeIntrinsicSize`에서도 `list` 전용 분기로 처리되었다.
 * PR-1에서는 measureDiagram이 budgetMap 기반으로 크기를 재결정하므로 이 함수의
 * intrinsicSize는 budget 부재 시의 폴백으로만 사용된다.
 */
export function resolveIntrinsicSize(
  element: ASTElement,
  defaultSize: { width: number; height: number },
): { width: number; height: number } {
  const w = numericProp(element.props.width, defaultSize.width);
  const h = numericProp(element.props.height, defaultSize.height);

  // list 요소는 항목 수에 비례한 높이 — 옛 computeIntrinsicSize 로직 이식.
  if (element.elementType === 'list' || element.elementType === 'bullet') {
    const itemCount = element.items?.length ?? 0;
    if (itemCount > 0) {
      const itemH = 4; // 항목당 기본 높이 (0–100 단위).
      return { width: w, height: Math.max(h, itemCount * itemH) };
    }
  }

  return { width: w, height: h };
}

/**
 * ASTElement.props는 `Record<string, string | number>`이므로 문자열도 올 수 있다.
 * 숫자 변환 실패 시 fallback 사용.
 */
function numericProp(value: string | number | undefined, fallback: number): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// makeLeafMetrics — leaf용 고정 메트릭
// ---------------------------------------------------------------------------

/**
 * leaf element의 `PlanMetrics`. 자식이 없으므로 모두 0.
 *
 * `computeWeight`는 leafCount로부터 영향을 받지 않지만(다항식에 등장하지 않음)
 * 부모의 computeMetrics가 `leafChildCount`를 집계하므로 일관성을 위해 0 채움.
 */
export function makeLeafMetrics(): PlanMetrics {
  return {
    descendantCount: 0,
    childCount: 0,
    maxDepth: 0,
    blockChildCount: 0,
    leafChildCount: 0,
  };
}
