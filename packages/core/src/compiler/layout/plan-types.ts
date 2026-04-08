/**
 * Plan 트리 타입 정의 — 단일 PlanNode 구조.
 *
 * 현재 (옛 파이프라인, PR-1 이전):
 *   - `plan-layout.ts::LayoutPlanNode` (diagram 전용)
 *   - `scene/plan-scene.ts::ScenePlan` (scene 전용)
 *   두 개의 별도 타입이 병렬로 존재한다.
 *
 * PR-1 (단일 PlanNode 트리):
 *   - scene / layout slot / container / element를 모두 `PlanNode` 한 타입으로 표현.
 *   - blockType(16종)으로 노드 종류를 구분.
 *   - leaf 판정: `blockType.startsWith('element-')` (S-pipeline PREFER).
 *

 * 
 * 
 */

import type { IRBounds } from '../../ir/types.js';
import type { SceneLayoutType } from './scene-layout.js';

// ---------------------------------------------------------------------------
// PlanBlockType — 16종
// ---------------------------------------------------------------------------

/**
 * Plan 노드의 블록 종류. 16종.
 *
 * 옛 `PlanNodeType`(block-flow/block-visual/...)의 접두사 `block-`/`element-`를
 * 정리하여 의미 단위로 재분류했다.
 *
 * 주요 변경:
 *   - `block-canvas` 제거 (canvas 토큰 자체가 삭제됨, §3.4.4).
 *   - `block-visual` → `box` / `layer`로 분리 (§3.4.2).
 *   - `column` → `stack`에 흡수 (§3.4.2).
 *   - `element-row`는 독립 추가하지 않고 `element-text`로 흡수 (ISSUE G — BASE_WEIGHT 0.6 유지).
 */
export type PlanBlockType =
  // 구조 컨테이너 (11종)
  | 'scene'
  | 'flow'
  | 'tree'
  | 'stack'
  | 'grid'
  | 'group'
  | 'layers'
  | 'layer'
  | 'box'
  | 'table'
  | 'chart'
  // 리프 노드 — element kind 분화 (5종, element-type-registry의 classify 값과 일치)
  | 'element-shape'
  | 'element-text'
  | 'element-list'
  | 'element-divider'
  | 'element-image';

// ---------------------------------------------------------------------------
// PlanMetrics — 구조 메트릭 (computeWeight의 입력)
// ---------------------------------------------------------------------------

/**
 * 노드의 구조 메트릭. `planAll`이 bottom-up으로 채운다.
 * `computeWeight(blockType, metrics)`의 입력이 되며 공간 배분 가중치를 결정한다.
 */
export interface PlanMetrics {
  /** 모든 자손 노드 수 (재귀 합). */
  descendantCount: number;
  /** 직계 자식 수. */
  childCount: number;
  /** 서브트리 최대 깊이. */
  maxDepth: number;
  /** 직계 자식 중 블록 타입 수. */
  blockChildCount: number;
  /** 직계 자식 중 leaf 수. */
  leafChildCount: number;
}

// ---------------------------------------------------------------------------
// PlanEdge — flow/tree의 엣지
// ---------------------------------------------------------------------------

/**
 * Plan 트리 내의 엣지. 옛 `ASTEdge`에서 `loc`/`label` 중 label만 유지.
 *
 * 현재 `edgeStyle`은 4종:
 *   - `->` : 구조적 방향 엣지 (레이어 할당 참여)
 *   - `-->` : 구조적 방향 + 대시 시각
 *   - `<->` : 양방향 (fromId→toId 방향으로 레이어 할당)
 *   - `--` : 연관 엣지 (레이어 할당 불참, 렌더링만)
 */
export interface PlanEdge {
  fromId: string;
  toId: string;
  edgeStyle: '->' | '-->' | '<->' | '--';
  label?: string;
}

// ---------------------------------------------------------------------------
// SceneLayoutSpec — scene 블록 전용 슬롯 레이아웃 스펙
// ---------------------------------------------------------------------------

/**
 * scene 블록의 슬롯 분할 규칙. `blockType === 'scene'`인 PlanNode만 갖는다.
 *
 * `preset`은 `scene-layout.ts::SceneLayoutType`(14 union)을 그대로 사용.
 * `options`는 preset별 추가 파라미터(`grid`의 cols/rows, `custom`의 slots 등).
 */
export interface SceneLayoutSpec {
  preset: SceneLayoutType;
  options?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// PlanNode — 단일 트리 타입
// ---------------------------------------------------------------------------

/**
 * 컴파일러 내부의 통합 Plan 노드.
 *
 * 트리 구조:
 *   - 루트: `blockType === 'scene'` (항상), `layout`으로 슬롯 분할 규칙 지정.
 *   - 자식: scene의 slot 자식은 `slot` 필드로 어느 슬롯에 속하는지 표시.
 *   - 리프: `blockType.startsWith('element-')` (element-shape/text/list/divider/image).
 *
 * AST와의 독립성:
 *   PlanNode는 AST를 참조하지 않는다 (`astNode` 필드 없음). 옛 LayoutPlanNode는
 *   `astNode: ASTBlock | ASTElement`를 들고 있었으나, 이는 passes/에서 AST 직접 접근
 *   36+건을 만들어 플랫폼 경계를 흐렸다. PR-1에서는 PlanNode가 필요한 모든 정보를
 *   자체 필드로 갖는다 (blockType/elementType/label/props/style/items).
 */
export interface PlanNode {
  /** AST id 또는 자동 생성 id (Map 키로 사용). */
  id: string;

  /** 노드 종류. 16종 enum. */
  blockType: PlanBlockType;

  /**
   * `blockType`이 `element-*`일 때만 사용. 구체 element 종류.
   * 예: `element-shape` + `elementType: 'circle'`, `element-text` + `elementType: 'heading'`.
   */
  elementType?: string;

  /**
   * `blockType === 'scene'`일 때만 사용. 슬롯 분할 규칙.
   */
  layout?: SceneLayoutSpec;

  /**
   * 부모가 scene일 때 자기가 차지하는 슬롯 이름. 그 외에는 `undefined`.
   * 예: `'header'`, `'body'`, `'main'`, `'cell'`.
   */
  slot?: string;

  /**
   * flow/tree PlanNode에 부착되는 엣지 목록.
   * 자식(children)과 별도 관리 — edge는 두 자식 사이의 관계일 뿐 자식이 아니다.
   */
  edges?: PlanEdge[];

  /** 자식 노드. element-*는 항상 빈 배열. */
  children: PlanNode[];

  /**
   * 형제 사이의 상대 budget 가중치. `allocateBudgets`에서 부모 예산 분배에 사용.
   * `computeWeight(blockType, metrics)` 결과 (plan-weights.ts).
   */
  weight: number;

  /**
   * element-list 전용. 리스트 항목 원문.
   *
   * ASTElement.items와 동일 타입 (`string[]`). scale-system의 countNodeLeaves가
   * `items.length`로 시각 요소 수를 계산하므로 타입을 바꾸면 밀도 계산이 깨진다.
   */
  items?: string[];

  /**
   * element-row 전용. table/chart row의 셀 값 배열.
   * ASTElement.values와 동일 타입. compute-chart-positions 패스가 읽는다.
   */
  values?: (string | number)[];

  /**
   * AST props 얕은 복사 — width/height/subtitle/direction/ratio/gap 등 raw.
   * 레이아웃 알고리즘(flow-layout, tree-layout 등)이 직접 읽는다.
   */
  props: Record<string, unknown>;

  /**
   * DSL raw 스타일. `ASTElement.style` / `ASTBlock.style`과 동일 구조.
   *
   *   예: `{ 'font-size': 12, 'background-color': '#fff', 'radius': 3, 'color': 'red', 'align': 'center' }`
   *
   * 주의: `IRStyle`(fill/stroke/strokeWidth/dashPattern/shadow 5필드)과 **다른 구조**다.
   * measure.ts가 `element.style['font-size']`(하이픈 포함 raw key)를 직접 읽는 원천이므로
   * PlanNode도 동일 구조를 유지해야 한다. IRStyle로의 변환은 emit walker의 책임이며
   * (emit-helpers.ts::buildIRStyle), PlanNode 단계에서 변환하면 font-size/color/radius/align 등
   * IRStyle에 없는 키가 소실되어 measure가 깨진다.
   */
  style: Record<string, string | number>;

  /** 텍스트 라벨. structural-roles의 `label.length` 가중치 계산에 사용된다. */
  label?: string;

  /**
   * 리프 element의 고유 크기(0–100 상대 좌표). 블록 노드는 `{ width: 0, height: 0 }`.
   * `measureDiagram`이 budget 없는 경로에서 fontSize/padding을 내릴 때 참조한다.
   */
  intrinsicSize: { width: number; height: number };

  /** 구조 메트릭. bottom-up으로 채워진다. */
  metrics: PlanMetrics;
}

// ---------------------------------------------------------------------------
// Re-exports — PR-1 Step C에서 passes/가 이 파일만 import하도록 통일
// ---------------------------------------------------------------------------

export type { IRBounds };
