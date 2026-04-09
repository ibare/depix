/**
 * `planAll`의 leaf element 변환 — `ASTElement` → `PlanNode`(element-*).
 *
 * 책임:
 *   - element kind 분류 (`element-shape|text|list|divider|image`)
 *   - intrinsicSize 결정 (prop override > registry default)
 *   - leaf용 PlanMetrics 생성
 *   - weight 계산 (`plan-weights.ts::computeWeight`)
 *   - compound element(stat/quote/bullet/list) 원자화 — 내부 구성요소를
 *     자식 PlanNode로 합성하여 allocate-bounds가 BoundsMap에 bounds를
 *     채우도록 한다. walker는 bounds 조회만으로 IR을 생성할 수 있다.
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

  // Compound element atomization: stat/quote/bullet의 내부 구성요소를 자식 PlanNode로 합성.
  // S-pipeline MUST "walker는 bounds 조회만" 준수를 위해, walker 내부의 비율 분배를
  // allocate-bounds가 BoundsMap에 미리 채우는 방식으로 대체한다.
  synthesizeCompoundChildren(node, element);

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

// ---------------------------------------------------------------------------
// Compound element atomization — stat/quote/bullet 자식 합성
// ---------------------------------------------------------------------------

/** stat/quote/bullet에 해당하는 compound elementType 집합. */
const COMPOUND_TYPES = new Set(['stat', 'quote', 'bullet', 'list']);

/**
 * Compound element(stat, quote, bullet, list)의 내부 구성요소를
 * 자식 PlanNode로 합성한다.
 *
 * 왜: S-pipeline MUST "walker는 bounds 조회만" — walker 내부에서
 * `bounds.h * 0.65` 같은 비율 분배를 제거하고, allocate-bounds가
 * 자식 PlanNode의 bounds를 미리 BoundsMap에 채우도록 한다.
 *
 * 비율 근거 (모두 0–100 상대 좌표):
 *   - stat  value/label = 0.65/0.35: 기존 walkStat `valueH = bounds.h * 0.65` 재현.
 *     value 텍스트가 시각적 중심이므로 약 2:1 비율.
 *   - quote text/attr   = 0.75/0.25: 기존 walkQuote `quoteH = bounds.h * 0.75` 재현.
 *     인용문이 주요 콘텐츠이므로 약 3:1 비율.
 *   - bullet/list items = 균등(weight 1): 모든 항목이 동일 크기.
 */
function synthesizeCompoundChildren(
  parentNode: PlanNode,
  element: ASTElement,
): void {
  const et = element.elementType;
  if (!COMPOUND_TYPES.has(et)) return;

  const parentId = parentNode.id;
  const children: PlanNode[] = [];

  if (et === 'stat') {
    // value 자식 — 부모의 label(value 텍스트)을 이전
    children.push(makeSynthChild(`${parentId}-value`, 'element-text', parentNode.label, 0.65));
    // optional label 자식
    const labelProp = element.props.label;
    if (typeof labelProp === 'string') {
      children.push(makeSynthChild(`${parentId}-label`, 'element-text', labelProp, 0.35));
    }
    parentNode.label = undefined;
  } else if (et === 'quote') {
    // text 자식 — 부모의 label(인용 텍스트)을 이전
    children.push(makeSynthChild(`${parentId}-text`, 'element-text', parentNode.label, 0.75));
    // optional attribution 자식
    const attr = element.props.attribution;
    if (typeof attr === 'string') {
      children.push(makeSynthChild(`${parentId}-attribution`, 'element-text', attr, 0.25));
    }
    parentNode.label = undefined;
  } else if (et === 'bullet' || et === 'list') {
    // items 배열에서 자식 합성 (bracket 구문: `bullet ["A","B"]`)
    const items = element.items ?? [];
    for (let i = 0; i < items.length; i++) {
      children.push(makeSynthChild(`${parentId}-item-${i}`, 'element-text', items[i], 1));
    }
    // block 구문 `bullet { item "A" }`는 plan-all-block.ts::planElementWithChildren이 처리.
    // items가 없으면 children 비어 있음 → 부모는 기존 leaf 동작 유지.
  }

  if (children.length === 0) return;

  parentNode.children = children;
  parentNode.metrics = makeCompoundMetrics(children.length);
  parentNode.weight = computeWeight(parentNode.blockType, parentNode.metrics);
}

/**
 * 합성 자식 PlanNode 생성.
 * 자식은 bounds 결정 전용 — blockType 'element-text', leaf metrics.
 */
function makeSynthChild(
  id: string,
  blockType: PlanBlockType,
  label: string | undefined,
  weight: number,
): PlanNode {
  return {
    id,
    blockType,
    children: [],
    weight,
    props: {},
    style: {},
    // element-text registry 기본 intrinsicSize (0–100 상대 좌표).
    intrinsicSize: { width: 20, height: 4 },
    metrics: makeLeafMetrics(),
    ...(label !== undefined ? { label } : {}),
  };
}

/**
 * compound 부모용 메트릭. 자식이 항상 leaf이므로 간단 계산.
 */
function makeCompoundMetrics(childCount: number): PlanMetrics {
  return {
    descendantCount: childCount,
    childCount,
    maxDepth: 1,
    blockChildCount: 0,
    leafChildCount: childCount,
  };
}
