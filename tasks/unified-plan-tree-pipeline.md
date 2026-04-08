# 단일 Plan 트리 + 루트 1회 핑퐁 — 컴파일러 파이프라인 완전 재설계

> **상태**: 계획 (PR-1 사전검토 중, 5차 rule-guard 대기)
> **대체**: `tasks/pingpong-pipeline-restoration.md`(응급 패치 A안)는 본 계획에 의해 **폐기**된다.
> **범위**: L1~L7 전 레이어. 단일 PR이 아니라 의존 순서가 있는 다중 PR.

## 0.0 Rule-Guard ISSUE 해결 이력

| ID | 내용 | 해결 |
|---|---|---|
| A | 36건 카운트가 measure.ts의 `element.*` 접근 13건 + alias 3건 누락 | §3.6 measure.ts 항목 신설, §3.6.4 "패턴 2/3" 추가 — 총 52+건 |
| B | canvas 제거 가능 여부 불명확 | apps/website 전수 grep 완료 (DSL 블록 0건) → **완전 제거 확정** |
| C | `allocate-bounds.ts`의 `case 'canvas':` 2곳 (line 601, 727) 미반영 | §3.7 Step C (d)에 명시 — `default:`가 흡수 |
| D | Step C 범위에 ir/types.ts / ir/validators.ts / container-meta.ts / semantic-editor.ts / tmLanguage.json 누락 | §3.7 Step C (d)에 6개 파일 추가 |
| E | §3.6.4의 grep 절차가 단일 패턴 (`astNode\.`)뿐 | **4-패턴 grep 절차**로 확장 (직접 접근 / ASTElement 파라미터 / element.* / alias) |
| F | `PlanNode.style?: IRStyle` 정의가 measure.ts의 raw-key 접근(`element.style['font-size']`)과 충돌 | **`style: Record<string, string\|number>`** (DSL-raw)로 확정 — IRStyle 변환은 emit walker 책임 |
| G | `element-row` 분리 시 BASE_WEIGHT 1.0 → 현재 0.6 대비 +66% 회귀 | element-row 제거, row는 element-text 카테고리로 흡수 — **17종 → 16종** |

---

## 0. 전제와 원칙

### 0.1 작업의 성격
- depix는 **미출시 제품**이다. 하위 호환을 위한 코드는 작성하지 않는다.
- **fallback 금지**, **deprecated 경로 금지**, **호환성 shim 금지**, **점진 마이그레이션 금지**.
- 옛 함수·옛 타입은 **삭제**한다. 호출부는 새 시그니처로 직접 교체한다.
- "옛 경로 + 새 경로 공존" 같은 중간 상태는 만들지 않는다 — 현재 이중 파이프라인 비극의 직접 원인이다.

### 0.2 목표
한 줄 정의:

> **Scene 루트부터 leaf element까지 단일 PlanNode 트리로 통합하고,
> `measure → allocateBudgets → computeConstraints → allocateBounds`를 루트에서 단 1회 호출한다.**

이 결과로 `passes/index.ts:5-7`의 JSDoc이 묘사하는 파이프라인이 코드와 정확히 일치하게 된다.

### 0.3 비목표
- DSL 문법 변경
- 새 layout preset 추가
- IR 스키마 확장
- 시각 출력 변경(회귀 0, 개선만 허용)

---

## 1. 현재 상태 (확정 사실)

### 1.1 이중 파이프라인의 형태
| 진입점 | 처리 영역 | 특이사항 |
|---|---|---|
| `scene/emit-scene.ts::emitSceneIR` | Scene/Layout/slot 분할 | `scene-measure.ts` naive estimate에 의존 |
| `passes/emit-ir.ts::emitInlineBlock` | Container 내부 분배 | 자체 핑퐁 — 현재 호출 누락(`measureMap = undefined`) |

두 경로가 공존하며, slot bounds가 결정된 _이후_ 에야 emitInlineBlock이 호출된다.
즉 **"자식 needs가 slot 크기까지 역류"** 하는 채널이 구조적으로 없다.

### 1.2 핵심 불일치
| # | 위치 | 내용 |
|---|---|---|
| 1 | `passes/emit-ir.ts:244-250` | `inlineConstraints`만 계산, `allocateBudgets/measureDiagram` 미호출 |
| 2 | `passes/allocate-bounds.ts:444-476` (flow) | `measureMap` 미사용 — PHI 휴리스틱 단독 |
| 3 | `passes/allocate-bounds.ts` (tree/grid/layers/group) | 동일 — 모두 `measureMap` 미사용. `stack`만 유일 |
| 4 | `scene/emit-scene.ts:222` | `emitInlineBlock` 호출 시 `scaleCtx` 누락 |
| 5 | `scene/scene-measure.ts::estimateBlockNaturalHeight` | flow layer 구조 무시한 naive sum |
| 6 | `engine/layout/flow-layout.ts:224` | `usedH = bounds.h` 하드코딩 — container 축소 불가 |
| 7 | `passes/measure.ts` ↔ `scene/scene-measure.ts` | 같은 "크기 추정"을 두 구현이 따로 함 |

### 1.3 사용자 의도 아키텍처
> Scene > Layout(슬롯) > Container(flow/tree/stack/...) > Element/Container 중첩

이 4계층은 _AST와 IR 레벨에서는_ 이미 강제되고 있다(`compiler.ts::normalizeScenes`, `parser.ts:107`).
하지만 _Plan 레벨에서는_ Scene과 Container가 다른 타입(`Scene*` vs `DiagramLayoutPlan`)으로 표현된다 — 본 작업의 출발점.

### 1.4 Dead Code 식별 (rule-guard 사전 검토에서 발견)

`packages/core/src/compiler/passes/` 아래 다음 4파일은 **현재 어디서도 import되지 않는 dead cluster**다 (서로만 import).

| 파일 | 정체 |
|---|---|
| `emit-ir-blocks.ts` | `emitInlineBlock`을 별도로 export하나 외부 사용처 0건 |
| `emit-ir-elements.ts` | emit-ir-blocks 전용 헬퍼 |
| `emit-ir-charts.ts` | emit-ir-blocks 전용 헬퍼 |
| `emit-ir-helpers.ts` | emit-ir-blocks/elements 전용 헬퍼 |

확인 방법:
```bash
$ grep -r "from.*emit-ir-blocks" packages/core   # → 0건
$ grep -r "from.*emit-ir-elements" packages/core # → emit-ir-blocks.ts만
$ grep -r "from.*emit-ir-charts" packages/core   # → emit-ir-blocks.ts만
$ grep -r "from.*emit-ir-helpers" packages/core  # → emit-ir-blocks.ts, emit-ir-elements.ts만
```

canonical 진입점은 `passes/emit-ir.ts`다 (`scene/emit-scene.ts:26`이 직접 import, `passes/index.ts:13`에서 re-export).
이 4파일은 과거 분리 시도의 잔재로 보이며, **PR-1에서 emit-ir.ts와 함께 무조건 삭제**한다.

---

## 2. 7개 작업 레이어 — 의존 순서

```
L1 ──► L2 ──► L3 ──► L4 ──► L5 ──► L6
 │                                   │
 └─────────► L7 (전 레이어 병렬) ◄────┘
```

| 레이어 | 의존 | PR 단위 |
|---|---|---|
| L1 Plan 트리 통합 | — | PR-1 |
| L2 루트 단일 파이프라인 | L1 | PR-1 (L1과 결합 권장) |
| L3 모든 블록 타입 measureMap | L2 | PR-2 |
| L4 `scene-measure.ts` 폐기 | L3 | PR-3 |
| L5 slot↔container 역류 | L4 | PR-4 |
| L6 Fixed-point 수렴 루프 | L5 | PR-5 |
| L7 테스트/문서/규칙 | 각 PR에 분산 | PR마다 동봉 |

L1과 L2는 같은 PR에 묶어야 한다. L1만 머지하면 _두 plan 타입이 공존_ 하는 중간 상태가 생기고, 이는 0.1 원칙 위반이다.

---

## 3. L1 — Plan 트리 통합

### 3.1 목표
Scene/slot/container/element를 단일 `PlanNode` 타입으로 표현. `DiagramLayoutPlan`, `SceneNode`, `Scene*` 관련 plan 타입을 **삭제**.

### 3.2 신규 타입 (`packages/core/src/compiler/layout/plan-types.ts`)

```ts
// 16종 — 사용자 확정 매핑 (canvas 토큰 제거 + element-row 통합 후)
export type PlanBlockType =
  // 구조 컨테이너
  | 'scene'    // 루트/중첩 scene + 구 'column' default 흡수 (canvas는 토큰 자체가 제거됨)
  | 'flow'
  | 'tree'
  | 'stack'    // 구 block-stack + column 흡수
  | 'grid'
  | 'group'
  | 'layers'   // 레이어 컨테이너
  | 'layer'    // layers의 자식 아이템 (box와 별개)
  | 'box'      // 제목 있는 박스 컨테이너
  | 'table'
  | 'chart'
  // leaf 노드 — element kind 분화 (element-type-registry/structural-roles와 직접 호환)
  | 'element-shape'
  | 'element-text'    // ← row는 element-type-registry.ts:79에서 이미 element-text로 classify
  | 'element-list'
  | 'element-divider'
  | 'element-image';

// NOTE: ISSUE G 해결 — element-row를 별도로 두면 BASE_WEIGHT 1.0이 되어
// 현재 element-type-registry가 부여한 0.6 (element-text 기본값) 대비 +66% 회귀.
// row 엘리먼트는 element-text 카테고리 안에 그대로 두어 BASE_WEIGHT 0.6 유지.

export interface PlanNode {
  /** AST id 또는 자동 생성 id */
  id: string;
  blockType: PlanBlockType;

  /** blockType이 element-*일 때 구체 element 종류 (rect/circle/diamond/text/row/...) */
  elementType?: string;

  /** blockType === 'scene'일 때 사용. 슬롯 분할 규칙 */
  layout?: SceneLayoutSpec;

  /**
   * 부모가 scene일 때 자기가 차지하는 슬롯 이름.
   * 그 외에는 undefined.
   */
  slot?: string;

  /** flow의 경우 edges도 plan에 포함 (layer 계산에 필요) */
  edges?: PlanEdge[];

  /** 자식. element-*는 빈 배열 */
  children: PlanNode[];

  /** 형제 사이의 가중치 (allocateBudgets에서 사용) */
  weight: number;

  /**
   * element-list 전용 — 리스트 항목. scale-system.countNodeLeaves가 length로 시각 요소 수를 계산한다.
   * AST list는 `items: string[]`(문자열 항목 배열)이므로 타입도 동일하게 `string[]`.
   */
  items?: string[];

  /** AST props 얕은 복사 — width/height/subtitle/direction 등 raw */
  props: Record<string, unknown>;

  /**
   * ISSUE F 해결: style은 DSL-raw 구조 (ASTElement.style와 동일).
   *
   *   ASTElement.style: Record<string, string | number>
   *   예: { 'font-size': 12, 'background-color': '#fff', 'radius': 3, 'color': 'red', 'align': 'center' }
   *
   * IRStyle (fill/stroke/strokeWidth/dashPattern/shadow 5필드)과 **절대 다른 구조**다.
   * measure.ts가 `element.style['font-size']` (하이픈 포함 raw key)를 읽는 원천이므로
   * PlanNode도 동일 구조를 유지해야 한다.
   *
   * IRStyle로의 변환은 emit walker의 책임 (§4.3) — PlanNode 단계에서 하면
   * font-size/color/radius/align 등 IRStyle에 없는 키가 소실되어 measure가 깨진다.
   */
  style: Record<string, string | number>;

  /** 텍스트 라벨 (measure 시 폰트 메트릭으로 환산) */
  label?: string;

  /** measure/intrinsic 결과 — LayoutPlanNode 호환 필드 */
  intrinsicSize: { width: number; height: number };
  metrics: PlanMetrics;
}

export interface PlanMetrics {
  descendantCount: number;
  childCount: number;
  maxDepth: number;
  blockChildCount: number;
  leafChildCount: number;
}

// NOTE: astNode 필드는 PlanNode에 존재하지 않는다.
// 사용자 §0.1 원칙("호환성 shim 금지")에 따라, passes/ 내 AST 직접 접근을 모두
// PlanNode 전용 필드(blockType/elementType/label/props.*/style/items)로 치환한다:
//   - 패턴 1: passes/*.ts의 `astNode.*` 직접 접근 36건 (5파일)
//   - 패턴 2: measure.ts의 `element: ASTElement` 파라미터 7개 함수 + `element.*` 접근 13건
//   - 패턴 3: allocate-bounds.ts의 `const ast = c.astNode` alias 3건
// PlanNode는 AST와 독립된 자족 트리다. 자세한 치환 규칙은 §3.6.4 참조.


export interface PlanEdge {
  fromId: string;
  toId: string;
  edgeStyle: '->' | '-->' | '<->' | '--';
}

export interface SceneLayoutSpec {
  preset: SceneLayoutPreset; // full | center | split | rows | sidebar | header | ... 14종
  /** preset별 추가 옵션 (cols, rows, gap 등) */
  options?: Record<string, unknown>;
}
```

> `weight`/`props`/`style` 필드는 기존 `DiagramLayoutPlan.children[*]`이 갖던 값과 동일 의미다.
> 즉 PlanNode는 "DiagramLayoutPlan 노드 + Scene 노드"의 합집합이다.

### 3.3 신규 함수 — `planAll`

```ts
// packages/core/src/compiler/layout/plan-all.ts
export function planAll(ast: ASTRoot, theme: DepixTheme): PlanNode {
  // 1. ast.children이 단일 scene이면 그대로 root
  // 2. 아니면 implicit scene { layout: full, body: ... }로 감싸기
  //    (현재 normalizeScenes 로직을 PlanNode 직접 생성으로 이전)
  // 3. 재귀적으로 ASTBlock/ASTElement → PlanNode 변환
  //    - scene 자식은 slot 이름과 함께 wrapper 없이 children에 직접
  //    - container 자식은 그대로 children
  //    - element는 leaf PlanNode
}
```

`planAll`은 다음 함수들을 흡수하여 _하나로 합친_ 결과다:
- `compiler.ts::normalizeScenes` — Scene 정규화
- `scene/plan-scene.ts::planScene` — Scene → SceneNode
- `layout/plan-layout.ts::planLayout` — Block → DiagramLayoutPlan
- `layout/plan-layout.ts::planNode` — leaf 노드 변환

### 3.4 삭제 대상

| 파일/타입 | 처리 |
|---|---|
| `compiler/layout/plan-layout.ts::DiagramLayoutPlan` | 삭제 |
| `compiler/layout/plan-layout.ts::LayoutPlanNode` | 삭제 (PlanNode로 통합) |
| `compiler/layout/plan-layout.ts::PlanNodeType` | 삭제 (PlanBlockType으로 통합) |
| `compiler/layout/plan-layout.ts::planLayout` | 삭제 |
| `compiler/layout/plan-layout.ts::planNode` | `planAll` 내부 헬퍼로 흡수 |
| `compiler/layout/plan-layout.ts::classifyNode` | `planAll` 내부 헬퍼로 흡수 (외부 export 제거) |
| `compiler/layout/plan-layout.ts::computeMetrics` | `planAll` 내부 헬퍼로 흡수 |
| `compiler/layout/plan-layout.ts::computeWeight` | `planAll` 내부 헬퍼로 흡수 |
| `compiler/layout/plan-layout.ts::computeIntrinsicSize` | `planAll` 내부 헬퍼로 흡수 |
| `compiler/scene/plan-scene.ts::SceneNode` | 삭제 |
| `compiler/scene/plan-scene.ts::planScene` | 삭제 |
| `compiler/compiler.ts::normalizeScenes` | `planAll` 내부 헬퍼로 흡수 |

#### 3.4.1 4개 helper 마이그레이션 전략 (`classifyNode`/`computeMetrics`/`computeWeight`/`computeIntrinsicSize`)

이들은 현재 `plan-layout.ts`의 export이며 `__tests__/compiler/passes/plan-layout.test.ts`(42 케이스)가 직접 호출한다.

마이그레이션 방향:
1. **함수 본문은 `plan-all.ts` 내부의 module-private 함수로 이전**한다 — `planAll`이 PlanNode를 만드는 과정에서 이미 호출하던 작업이므로 자연스럽다.
2. **테스트는 두 가지 중 하나로 처리**:
   - **(권장)** `plan-all.test.ts`에 통합 — `planAll(parse(dsl))` 결과 PlanNode의 `weight`/`intrinsicSize`/`metrics`를 검증하는 _블랙박스_ 테스트로 재작성. 4개 helper의 단위 검증 의도가 그대로 유지된다.
   - 단위 테스트 의미 보존이 필요하면, 해당 4개 함수만 `plan-all-internals.ts`로 분리하고 test-only export 패턴 사용 (`/** @internal */` JSDoc).
3. PR-1 Step D에서 `plan-layout.test.ts` 전체를 `plan-all.test.ts`로 _재작성_ 하는 것을 기본 방침으로 한다.

#### 3.4.2 PlanBlockType 16종 매핑표 (기존 → 신규)

| AST blockType | 기존 PlanNodeType | 신규 PlanBlockType | 비고 |
|---|---|---|---|
| `flow` | `block-flow` | `flow` | |
| `tree` | `block-tree` | `tree` | |
| `stack` | `block-stack` | `stack` | |
| `column` | `block-stack` | `stack` | column → stack에 흡수 |
| `grid` | `block-grid` | `grid` | |
| `group` | `block-group` | `group` | |
| `layers` | `block-layers` | `layers` | 컨테이너 |
| `layer` | `block-visual` | `layer` | **분리** — layers의 자식 아이템 |
| `box` | `block-visual` | `box` | **분리** — 독립 박스 컨테이너 |
| `table` | `block-table` | `table` | |
| `chart` | `block-chart` | `chart` | |
| `scene` | `block-canvas` | `scene` | 정상화 |
| ~~`canvas`~~ | ~~`block-canvas`~~ | **(제거)** | 사용자 결정 — apps/website 실사용 0건 확인 |
| (default) | `block-canvas` | `scene` | 알 수 없는 블록도 scene으로 흡수 |
| element: rect/circle/diamond/pill/... | `element-shape` | `element-shape` | |
| element: text/label/heading | `element-text` | `element-text` | |
| **element: row** | `element-text` | `element-text` | **ISSUE G — element-type-registry.ts:79 classify 유지** |
| element: list | `element-list` | `element-list` | |
| element: divider | `element-divider` | `element-divider` | |
| element: image | `element-image` | `element-image` | |

#### 3.4.3 BASE_WEIGHT 16종 테이블 + 튜닝 전용 파일 분리

사용자 요청: "weight는 언제든 조정하기 쉬운 구조로 구현해".

→ 가중치 상수를 **별도 파일 `compiler/layout/plan-weights.ts`**로 분리하여, 튜닝 시 한 파일만 보면 되게 한다.

```ts
// packages/core/src/compiler/layout/plan-weights.ts
import type { PlanBlockType } from './plan-types.js';

/**
 * 각 블록 타입의 기본 가중치.
 * 값은 언제든 조정 가능 — 이 파일만 수정하면 된다.
 * computeWeight(blockType, metrics) = BASE_WEIGHT[blockType] × contentMul × depthMul
 */
export const BASE_WEIGHT: Record<PlanBlockType, number> = {
  // 구조 컨테이너
  scene:    2.5,  // 구 block-canvas
  flow:     3.0,
  tree:     3.5,
  stack:    2.5,
  grid:     3.0,
  group:    2.0,
  layers:   3.0,
  layer:    2.0,  // 구 block-visual 값 유지 (회귀 0)
  box:      2.0,  // 구 block-visual 값 유지 (회귀 0)
  table:    2.5,
  chart:    3.0,
  // Leaf (row는 element-text 카테고리로 흡수 — ISSUE G)
  'element-shape':   1.0,
  'element-text':    0.6,  // row 포함
  'element-list':    1.2,
  'element-divider': 0.3,
  'element-image':   1.5,
};

// Content/depth 가중 계산도 여기 유지 — 튜닝 시 함께 조정
export const CONTENT_MUL_BASE = 1;
export const CONTENT_MUL_SQRT = 1;  // sqrt(descendantCount) 계수
export const CONTENT_MUL_BLOCK = 0.5;  // blockChildCount 계수
export const DEPTH_MUL_BASE = 1;
export const DEPTH_MUL_COEF = 0.2;  // maxDepth 계수

export function computeWeight(blockType: PlanBlockType, metrics: PlanMetrics): number {
  const base = BASE_WEIGHT[blockType];
  const contentMul =
    (CONTENT_MUL_BASE + Math.sqrt(metrics.descendantCount) * CONTENT_MUL_SQRT) *
    (CONTENT_MUL_BASE + metrics.blockChildCount * CONTENT_MUL_BLOCK);
  const depthMul = DEPTH_MUL_BASE + metrics.maxDepth * DEPTH_MUL_COEF;
  return base * contentMul * depthMul;
}
```

- `planAll`은 `computeWeight`를 이 파일에서 import하여 사용.
- 가중치 튜닝 PR은 이 파일 한 개만 수정하면 됨 (테스트는 weight 절댓값을 검증하지 않고 상대 순서만 검증하도록 작성 권장).

#### 3.4.4 `canvas` 토큰 제거 (사용자 결정 — ISSUE B 해결)

**사용자 지시 확정**: "apps/demo는 legacy, apps/website만 기준. 여기에 없으면 canvas는 제거대상."

**사전 검증 (apps/website 전수 grep 완료)**:
- `canvas\s*[\{\[]` (DSL 블록 패턴) → **0건**
- `canvas` 단어 전체 → tmLanguage.json syntax 정의 1건 + 영문 문서 텍스트("canvas aspect ratio", HTML `<canvas>` 등) 다수 (DSL 키워드 아님)

→ 사용자 기준 충족. **canvas 토큰 완전 제거 확정**.

**Step C에서 변경할 파일 (canvas 관련)**:

| 파일 | 변경 내용 |
|---|---|
| `packages/core/src/compiler/tokenizer.ts` | `BLOCK_TYPES` Set에서 `'canvas'` 제거 (line 69) |
| `packages/core/src/ir/types.ts` | `IRContainer.type` union 등에서 `'canvas'` 제거 (line 112 확인) |
| `packages/core/src/ir/validators.ts` | canvas 관련 검증 로직 제거 (line 169 확인) |
| `packages/core/src/compiler/container-meta.ts` | canvas 엔트리 제거 (line 28 확인) |
| `packages/editor/src/semantic-editor.ts` | canvas 분기 제거 (line 313 확인) |
| `apps/website/public/depix.tmLanguage.json` | syntax 키워드 배열에서 `canvas` 제거 (line 53) |
| `compiler/layout/plan-all*.ts` (신규) | classify 로직에 `case 'canvas'` 없음 (애초에 새 파일) |
| `__tests__/compiler/parser.test.ts` | `canvas` 블록 테스트 케이스 제거 또는 `scene` 으로 교체 (line 335-348) |
| `__tests__/compiler/passes/allocate-bounds.test.ts` | 동일 (line 277) |
| `__tests__/compiler/passes/plan-layout.test.ts` | 테스트 파일 자체가 plan-all.test.ts로 재작성될 예정 (§3.4.1) |
| `docs/DEPIX_DSL_DRAFT.md`, `docs/DEPIX_IR_SPEC.md` | canvas 언급 있으면 제거 |

**영향**: apps/website에 DSL 블록으로서 canvas 사용 0건 확인되었으므로 사용자 코드 회귀 0. apps/demo는 legacy이므로 고려하지 않는다.

### 3.5 신규 파일 분할 계획 (C1 — 300줄 제한)

C1.md 38행: "신규 파일은 300줄을 초과하지 않는다."

PR-1에서 신설하는 두 파일은 책임상 300줄 초과가 우려되므로 **사전 분할 계획**을 명시한다.

#### 3.5.1 `compiler/layout/plan-all.ts` — 분할 후보

| 분할 단위 | 책임 | 예상 라인 |
|---|---|---|
| `plan-all.ts` | `planAll(ast, theme): PlanNode` 진입점 + dispatch | ~80 |
| `plan-all-scene.ts` | scene block 정규화 (구 `normalizeScenes`) + slot wrapping | ~120 |
| `plan-all-block.ts` | container block(`flow/tree/stack/...`) → PlanNode 변환 | ~80 |
| `plan-all-element.ts` | leaf element → PlanNode 변환 + classifyNode/computeWeight 등 흡수 | ~150 |
| `plan-all-edges.ts` | flow/tree edge → PlanEdge 변환 | ~50 |

총 ~480줄을 5파일로 나눠 모두 300줄 미만 보장. 모듈 내부 import만 사용 (외부에는 `plan-all.ts::planAll`만 export).

#### 3.5.2 `compiler/emit.ts` — 분할 후보

| 분할 단위 | 책임 | 예상 라인 |
|---|---|---|
| `emit.ts` | `emit(plan, bounds, edges, theme): IRRoot` 진입점 + walker dispatch | ~80 |
| `emit-scene-walker.ts` | scene 노드 → IRScene 처리 | ~60 |
| `emit-block-walker.ts` | container 노드(flow/tree/stack/box/...) → IRContainer 처리 | ~150 |
| `emit-element-walker.ts` | leaf element → IRElement 처리 (구 `emitElement` body 이전) | ~200 |
| `emit-helpers.ts` | `applyOverridesTo`, `attachOriginToElement`, style 빌더 등 공유 헬퍼 | ~150 |

총 ~640줄. 5파일로 나누어 모두 300줄 미만 보장.

> **주의**: 위 라인 수는 _예상_ 이다. 실제 작성 중 어떤 파일이 300줄을 넘으면 즉시 추가 분할한다.

### 3.6 영향 파일 (L1만)

| 파일 | 변경 성격 |
|---|---|
| `compiler/layout/plan-types.ts` | **신규** (PlanNode/PlanEdge/SceneLayoutSpec) |
| `compiler/layout/plan-all.ts` | **신규** (3.5.1 분할 적용) |
| `compiler/layout/plan-all-scene.ts` | **신규** |
| `compiler/layout/plan-all-block.ts` | **신규** |
| `compiler/layout/plan-all-element.ts` | **신규** |
| `compiler/layout/plan-all-edges.ts` | **신규** |
| `compiler/layout/plan-layout.ts` | **삭제** |
| `compiler/scene/plan-scene.ts` | **삭제** |
| `compiler/compiler.ts` | `planAll` 호출로 교체, `normalizeScenes`/`normalizeScene` 삭제 |
| `compiler/passes/index.ts` | export 정리 + JSDoc 갱신 (구 파이프라인 표기 제거) |
| `compiler/passes/allocate-budgets.ts` | 시그니처 `(plan: PlanNode, ...)`로 교체 + `astNode.*` 13건 치환 |
| `compiler/passes/allocate-bounds.ts` | 시그니처 + `astNode.*` 7건 + `const ast = c.astNode` alias 3건 치환 |
| `compiler/passes/measure.ts` | **ISSUE A 해결**: 7개 함수의 `element: ASTElement` 파라미터를 `plan: PlanNode`로, 내부 `element.*` 접근 13건 → `plan.*` 치환 |
| `compiler/passes/compute-constraints.ts` | 시그니처 + `astNode.*` 13건 치환 |
| `compiler/passes/scale-context.ts` | 시그니처 교체 |
| `compiler/passes/scale-system.ts` | **시그니처 교체**: `DiagramLayoutPlan`/`LayoutPlanNode` → `PlanNode` (3.6.2) + `astNode.*` 2건 치환 |
| `compiler/passes/budget-types.ts` | `BudgetMap`/`ConstraintMap`/`MeasureMap`의 키는 `PlanNode.id` 그대로 사용 가능 |
| `compiler/passes/structural-roles.ts` | **시그니처 교체**: `LayoutPlanNode` → `PlanNode` (3.6.1) + `astNode.label` 1건 치환 |
| `compiler/element-type-registry.ts` | **타입 교체**: `PlanNodeType` → `PlanBlockType` (3.6.3) |
| `compiler/tokenizer.ts` | `BLOCK_TYPES`에서 `'canvas'` 제거 (§3.4.4) |
| `ir/types.ts` | canvas IR 컨테이너 타입 제거 (§3.4.4) |
| `ir/validators.ts` | canvas 검증 분기 제거 (§3.4.4) |
| `compiler/container-meta.ts` | canvas 엔트리 제거 (§3.4.4) |
| `packages/editor/src/semantic-editor.ts` | canvas 분기 제거 (§3.4.4) |
| `apps/website/public/depix.tmLanguage.json` | syntax 키워드 배열에서 `canvas` 제거 (§3.4.4) |

#### 3.6.1 `structural-roles.ts` 마이그레이션

이 파일은 `LayoutPlanNode`를 import하고 `roleWeight(role, node: LayoutPlanNode)` 등 시그니처에 노출한다.

```ts
// 현재 (line 12, 152, 155, 165)
import type { LayoutPlanNode } from './plan-layout.js';
export function roleWeight(role: StructuralRole, node: LayoutPlanNode): number {
  // ... node.astNode.label?.length ?? 0  ← astNode 직접 접근
}
function dfs(node: LayoutPlanNode, ...): void { ... children: LayoutPlanNode[] ... }
```

PR-1에서:
1. `import type { PlanNode } from '../layout/plan-types.js';`로 교체.
2. `LayoutPlanNode` → `PlanNode` 타입 전수 치환.
3. `nodeType` → `blockType` 필드명 전수 치환 (structural-roles 내 사용처는 `node.nodeType === 'element-text'` 등 dispatch 3-4건).
4. `node.astNode.label?.length` → `node.label?.length` 치환 (PlanNode가 label을 top-level로 보유).
5. `analyzeFlowRoles`/`analyzeTreeRoles`/`computeLevelWeights`/`distributeByWeights`/`applyAccentPattern` 모두 동일 치환.
6. `__tests__/compiler/passes/structural-roles.test.ts`도 `PlanNode`를 import하고 PlanNode 생성자(=`planAll` 결과 추출) 사용하도록 치환.

#### 3.6.2 `scale-system.ts` 마이그레이션

이 파일은 `createScaleContext(plan: DiagramLayoutPlan, ...)`와 `countElements(plan)`/`countNodeLeaves(node)`를 export하며, 내부에서 `node.astNode.kind === 'element'`, `node.astNode.elementType === 'list'`, `node.astNode.items?.length` 같은 AST 직접 접근을 한다.

마이그레이션 단계:
1. `DiagramLayoutPlan` → `PlanNode` (루트 노드 한 개를 받음)
2. `LayoutPlanNode` → `PlanNode`
3. `node.astNode.elementType` 접근을 `node.elementType`로 변경 (PlanNode가 직접 노출)
4. `node.astNode.items?.length` 접근 — **PlanNode 스키마 보강 필요**:
   - `items?: unknown[]` 필드를 PlanNode에 추가 (element list 한정 사용)
   - 또는 `props.items`로 통일 (`countNodeLeaves`도 그에 맞춰 변경)
5. `countElements(plan: PlanNode): number` — `plan.children`을 그대로 순회하므로 시그니처 외 변경 최소

`countNodeLeaves`는 _list 항목 수가 곧 시각 요소 수_ 라는 핵심 의미를 보존해야 하므로, items 정보가 PlanNode 어딘가에 반드시 살아있어야 한다 (`§3.2 PlanNode 정의 보강` 항목 참조).

> **PlanNode §3.2 보강 사항**: `items?: unknown[]` 필드 추가 (element list 전용). props로 흡수할 수도 있으나, scale-system이 빈번히 접근하므로 top-level이 권장.

#### 3.6.3 `element-type-registry.ts` 마이그레이션

이 파일은 `ElementTypeConfig.classify: PlanNodeType` 필드로 plan-layout의 fine-grained enum(`'element-shape'` 등)을 사용한다.

PR-1 단계의 두 가지 옵션:

| 옵션 | 처리 | 평가 |
|---|---|---|
| **A. enum 통합** | `PlanNodeType` 5개 element subkind('element-shape'/'element-text'/'element-list'/'element-divider'/'element-image') 모두 새 `PlanBlockType`에 흡수. 즉 `'element'` 단일 값에서 → 5개 `'element-*'` 다중 값으로 PlanBlockType이 분화 | classify를 그대로 사용 가능. PlanBlockType 상수가 약간 늘어남 |
| **B. enum 분리** | PlanBlockType은 거친 단위 그대로(`'element'`), element-type-registry는 자체 enum (`ElementCategory: 'shape' \| 'text' \| 'list' \| 'divider' \| 'image'`)로 독립 | plan과 element 분류가 의미적으로 분리됨 (clean) |

**채택: 옵션 A** — element-type-registry의 수정을 최소화하고, structural-roles의 dispatch와도 자연스럽게 통합된다. 16종 매핑은 §3.2/§3.4.2 참조.

element-type-registry.ts 구체 변경:
1. **import 경로**: `import type { PlanNodeType } from './passes/plan-layout.js';` → `import type { PlanBlockType } from './layout/plan-types.js';`
2. **필드 타입**: `classify: PlanNodeType` → `classify: PlanBlockType`
3. **값 불변**: `'element-shape'`/`'element-text'` 등 5개 문자열 값은 16종에 그대로 존재. row는 `element-text`로 유지(ISSUE G) — 레지스트리 내용 변경 없음.
4. **검증**: `ELEMENT_TYPE_REGISTRY`의 모든 `classify` 값이 16종 안에 있는지 build-time에 TypeScript가 자동 검증.

`element-*`로 시작하는 값은 leaf 노드를 뜻하므로 `children: []`이 강제된다 (walker convention).

#### 3.6.4 AST→PlanNode 치환 마이그레이션 (옵션 B 확정, ISSUE A/E 해결)

사용자 결정: **옵션 B 채택** — PlanNode에서 `astNode?` 필드를 완전히 제거하고, `passes/` 내 AST 직접 접근을 모두 PlanNode 전용 필드로 치환한다. §0.1 "호환성 shim 금지" 원칙 충실.

##### 실제 접근 지점 분포 (rule-guard 사후 재검증 결과)

**패턴 1 — `astNode.*` 직접 접근 (5파일 36건)**:

| 파일 | 건수 | 대표 접근 패턴 |
|---|:-:|---|
| `compute-constraints.ts` | 13 | `astNode.props.subtitle`, `astNode.blockType`, `astNode.props.direction` |
| `allocate-budgets.ts` | 13 | `astNode.props.*`, `astNode.blockType` |
| `allocate-bounds.ts` | 7 | `c.astNode.elementType`, `c.astNode.props.width`, `c.astNode.kind`, `c.astNode.blockType` |
| `scale-system.ts` | 2 | `astNode.elementType === 'list'`, `astNode.items?.length` |
| `structural-roles.ts` | 1 | `node.astNode.label?.length` |

**패턴 2 — `ASTElement` 파라미터 시그니처 + `element.*` 직접 접근 (`measure.ts`)**:

| 함수 | 라인 | element.* 접근 |
|---|:-:|---|
| (line 156~) | 156 | — |
| (line 185~) | 185 | — |
| (line 208~) | 208 | — |
| (line 231~) | 231 | `element.label`, `element.props.width`, `element.props.height`, `element.items` |
| (line 264~) | 264 | `element.style['font-size']` |
| `measureImage` | 303 | `element.props.width`, `element.props.height` |
| (line 364~) | 364 | `element.style['font-size']`, `element.label` (2회), `getElementConfig(element.elementType)` |

총 **13건** `element.*` 접근, **7개 함수 시그니처** 교체 필요.

**패턴 3 — 변수 alias 후 접근 (`allocate-bounds.ts`)**:

```ts
// line 580
const ast = c.astNode;
ast.values  // ← 실제 AST 접근
// line 869, 894
const ast = child.astNode;
```

총 **3건** alias 생성 + 각 alias 뒤의 `ast.X` 접근 (별도 확인 필요).

##### 총 치환 대상: 최소 52건 + 함수 시그니처 7개

- 패턴 1: 36건
- 패턴 2: 13건 (`element.*`) + 7개 함수 시그니처
- 패턴 3: 3건 alias + 그 뒤의 `ast.X` 접근

##### 치환 규칙 (Step C atomic commit 내)

| AST 접근 | PlanNode 접근 |
|---|---|
| `astNode.kind === 'block'` | `!blockType.startsWith('element-')` |
| `astNode.kind === 'element'` | `blockType.startsWith('element-')` |
| `astNode.blockType` | `blockType` (PlanBlockType 값으로 분기하도록 로직 수정) |
| `astNode.elementType` | `elementType` (PlanNode top-level) |
| `astNode.label` / `element.label` | `label` (PlanNode top-level) |
| `astNode.props.*` / `element.props.*` | `props.*` (PlanNode.props는 AST.props 얕은 복사) |
| `astNode.items` / `element.items` | `items` (element-list 전용, PlanNode top-level, `string[]`) |
| `astNode.style` / `element.style` | `style` (PlanNode top-level, raw `Record<string, string\|number>` — §3.2 ISSUE F) |
| `astNode.children` | `children` (이미 PlanNode 자체 children) |
| `element: ASTElement` 파라미터 | `plan: PlanNode` 파라미터 (measure.ts 7개 함수) |
| `const ast = c.astNode;` | 라인 자체 삭제, 이후 `ast.X` → `c.X` 직접 |

##### 특수 케이스

- `astNode.props.subtitle`, `astNode.props.direction` 등 **props 내부 필드**는 PlanNode의 `props: Record<string, unknown>`를 그대로 전달받아 `props.subtitle` 접근으로 치환. PlanNode를 만들 때 AST.props 객체를 _얕은 복사_ 로 통째 복사한다 (원본과 독립).
- `allocate-bounds.ts`의 `astNode.blockType` 접근은 AST의 원래 blockType(예: `'flow'`)을 비교하는데, PlanNode에서 `blockType` 비교 시 16종 매핑 값(`'flow'`)과 대체로 일치한다. 다만 `column → stack` 흡수 같은 경우 **원본 AST blockType이 필요한 분기는 로직 재설계 필요** — 이 경우 `planAll`이 해당 구분을 PlanNode.props나 PlanBlockType 자체에서 표현하도록 조정.
- `scale-system.ts`의 `astNode.items?.length`는 `items?.length`로 치환 — PlanNode.items는 `string[]`이며 AST list의 `items: string[]`와 동일 의미.

##### 사전 검증 방법 (4-패턴 grep, ISSUE E 해결)

Step C 작성 전에 **4개 패턴** 각각을 grep으로 전수 목록화한다:

```bash
# 패턴 1: 직접 astNode. 접근
grep -rn "astNode\." packages/core/src/compiler/passes/*.ts

# 패턴 2a: ASTElement 파라미터 시그니처
grep -rn "element:\s*ASTElement\|: ASTElement" packages/core/src/compiler/passes/*.ts

# 패턴 2b: measure.ts의 element.* 직접 접근
grep -n "element\." packages/core/src/compiler/passes/measure.ts

# 패턴 3: 변수 alias (const ast / const elt / const elem = ...)
grep -rn "const \(ast\|elt\|elem\)\s*=" packages/core/src/compiler/passes/*.ts
```

각 패턴의 결과를 1:1 매핑표로 만들고, 매핑 불가 또는 의미 보존 불가한 라인이 있으면 **Step C 작업 전에 개별 해결 전략 수립**. 매핑 완료된 후 Step C 단일 commit으로 일괄 적용.

### 3.7 PR-1 작업 단계 (Step A~E)

PR-1을 빌드 가능한 단위로 분할하되, **0.1 원칙(옛+새 공존 금지)** 을 위배하지 않는다.
PR-1은 _하나의 PR_ 이지만 _여러 commit_ 으로 구성된다. 각 commit은 review 단위이며, **commit 단위로는 빌드가 깨질 수 있다**(테스트 마이그레이션이 별도 commit이기 때문). _PR 단위로는_ 모든 commit이 머지된 상태에서 빌드/테스트 통과를 보장한다.

#### Step A — 규칙 갱신 (commit #1)
변경:
- `rules/specifics/S-compiler.md` line 14-23 재작성 (§9.4)
- `rules/specifics/S-pipeline.md` 신설 (§9.3)

빌드: 코드 변경 없음 → 항상 통과.

#### Step B — 신규 파일 12개 작성 (commit #2)
변경:
- `compiler/layout/plan-types.ts` 신설 (PlanNode 확정 정의 — 3.2 + 3.6.2/3.6.3 보강 반영, ISSUE F/G 반영)
- `compiler/layout/plan-weights.ts` 신설 (BASE_WEIGHT 16종 + computeWeight, §3.4.3)
- `compiler/layout/plan-all.ts` 신설 (진입점, §3.5.1)
- `compiler/layout/plan-all-scene.ts` 신설 (§3.5.1)
- `compiler/layout/plan-all-block.ts` 신설 (§3.5.1)
- `compiler/layout/plan-all-element.ts` 신설 (§3.5.1)
- `compiler/layout/plan-all-edges.ts` 신설 (§3.5.1)
- `compiler/emit.ts` 신설 (walker 진입점, §3.5.2)
- `compiler/emit-scene-walker.ts` 신설 (§3.5.2)
- `compiler/emit-block-walker.ts` 신설 (§3.5.2)
- `compiler/emit-element-walker.ts` 신설 (§3.5.2)
- `compiler/emit-helpers.ts` 신설 (§3.5.2)

이 step에서는 **기존 코드를 건드리지 않는다** — `compiler.ts`는 여전히 옛 경로를 호출. 신규 파일들은 어디서도 import되지 않은 상태로 먼저 추가.

빌드: 신규 파일이 자체 type-check만 통과하면 됨. 기존 코드 영향 없음 → 통과.

> 0.1 원칙 보호: 이 step 종료 시점에 _신규 코드는 존재하나 호출되지 않음_. 옛 경로가 단독으로 작동 중. 공존이 아니라 _신규는 dead_ 상태.

#### Step C — 시그니처 교체 + 옛 파일 삭제 + compile() 재작성 (commit #3, **단일 atomic commit**)

이 commit은 PR-1 전체에서 가장 크고 가장 위험하다. 실행 전 §3.6.4의 "사전 검증 방법"을 필수로 수행.

변경:

**(a) compile() 본문**
- `compiler.ts::compile()` 본문을 §4.2 의사코드로 재작성
- `normalizeScenes`/`normalizeScene` 삭제

**(b) passes/ 시그니처 교체 (LayoutPlanNode/DiagramLayoutPlan → PlanNode)**
- `compiler/passes/allocate-bounds.ts` — 시그니처 + `c.nodeType` → `c.blockType` 필드명 교체 + `c.astNode.*` 7건 + alias 3건 치환 (§3.6.4)
- `compiler/passes/allocate-budgets.ts` — 시그니처 + `astNode.*` 13건 치환
- `compiler/passes/measure.ts` — **7개 함수 시그니처 `element: ASTElement` → `plan: PlanNode` 교체, 내부 `element.*` 13건 → `plan.*` 치환 (ISSUE A)**
- `compiler/passes/compute-constraints.ts` — 시그니처 + `astNode.*` 13건 치환
- `compiler/passes/scale-context.ts` — 시그니처 교체
- `compiler/passes/scale-system.ts` — 시그니처 + `astNode.elementType`/`astNode.items` 2건 치환
- `compiler/passes/structural-roles.ts` — 시그니처 + `nodeType`→`blockType` + `astNode.label` 1건 치환
- `compiler/passes/budget-types.ts` — PlanNode.id 키 명시
- `compiler/passes/index.ts` — export 정리 + JSDoc 갱신

**(c) element-type-registry.ts**
- import 경로: `./passes/plan-layout.js::PlanNodeType` → `./layout/plan-types.js::PlanBlockType` (§3.6.3)
- `classify` 필드 타입 교체 (값 불변, row는 element-text로 유지 — ISSUE G)

**(d) canvas 토큰 완전 제거 (§3.4.4, ISSUE B/C/D 해결)**
- `compiler/tokenizer.ts` — `BLOCK_TYPES` Set에서 `'canvas'` 제거 (line 69)
- `compiler/passes/allocate-bounds.ts` — `case 'canvas':` 2곳 (line 601, 727) 삭제 → `default:`가 처리 (ISSUE C)
- `ir/types.ts` — `IRContainer.type` 등에서 canvas 타입 제거 (line 112 확인)
- `ir/validators.ts` — canvas 검증 분기 제거 (line 169 확인)
- `compiler/container-meta.ts` — canvas 엔트리 제거 (line 28 확인)
- `packages/editor/src/semantic-editor.ts` — canvas 분기 제거 (line 313 확인)
- `apps/website/public/depix.tmLanguage.json` — syntax 키워드 배열에서 `canvas` 제거 (line 53)
- `__tests__/compiler/parser.test.ts` (line 335-348), `allocate-bounds.test.ts` (line 277) — 테스트 케이스 제거/교체 (Step D에서)

> plan-layout.ts:165의 `case 'canvas': return 'block-canvas';`는 파일 자체가 Step C (e)에서 삭제되므로 별도 처리 불필요.

**(e) 옛 파일 삭제**
- `compiler/passes/emit-ir.ts` 삭제
- `compiler/passes/emit-ir-blocks.ts` 삭제 (§1.4 dead cluster)
- `compiler/passes/emit-ir-elements.ts` 삭제 (§1.4 dead cluster)
- `compiler/passes/emit-ir-charts.ts` 삭제 (§1.4 dead cluster)
- `compiler/passes/emit-ir-helpers.ts` 삭제 (§1.4 dead cluster)
- `compiler/scene/emit-scene.ts` 삭제
- `compiler/scene/plan-scene.ts` 삭제
- `compiler/layout/plan-layout.ts` 삭제

**(f) compile() 새 emit walker 연결**
- Step B에서 신설한 `compiler/emit.ts` walker를 `compile()` 본문에서 호출

> **반드시 단일 commit**: 이 변경들이 분리되면 옛+새 공존 상태가 나타난다. atomic해야 0.1 원칙 보호.

빌드: 이 commit 직후 `pnpm --filter @depix/core run build`가 통과해야 한다. **테스트는 깨진 상태** — Step D에서 수정.

#### Step D — 테스트 마이그레이션 (commit #4)
변경:
- `__tests__/compiler/passes/plan-layout.test.ts` → `plan-all.test.ts`로 재작성 (§3.4.1)
- `__tests__/compiler/passes/budget-system.test.ts` 시그니처 갱신
- `__tests__/compiler/passes/allocate-bounds.test.ts` 시그니처 갱신
- `__tests__/compiler/passes/measure.test.ts` 시그니처 갱신
- `__tests__/compiler/passes/scale-system.test.ts` 시그니처 갱신
- `__tests__/compiler/passes/structural-roles.test.ts` 시그니처 갱신
- `__tests__/compiler/dsl-to-ir.test.ts` (필요 시 — emitInlineBlock 직접 호출이 아닌 compile() 경유면 무변경)

빌드/테스트: `pnpm --filter @depix/core run test` 통과.

#### Step E — 회귀 검증 + spy 테스트 추가 (commit #5)
변경:
- `__tests__/compiler/compile-pipeline.test.ts` 신설 — measure/allocate가 정확히 1회씩 호출됨 spy 검증 (§9.1)
- `__tests__/compiler/emit.test.ts` 신설 — emit walker가 분배 로직 0 검증
- `__tests__/compiler/layout/plan-all.test.ts` 신설 (혹은 Step D에서 함께)
- 시각 회귀: Binary Search flowchart, Image #50/#51, layout preset 14종 수동 확인

빌드/테스트: 전 패키지 빌드 + 전 패키지 테스트 통과.

#### Step 경계 정리 표

| Step | commits | 빌드 통과 | 테스트 통과 | 0.1 원칙 |
|---|---|:-:|:-:|:-:|
| A | #1 | ✅ | ✅ | ✅ (코드 변경 0) |
| B | #2 | ✅ | ✅ | ✅ (신규 dead) |
| C | #3 (atomic) | ✅ | ❌ | ✅ (옛 삭제 + 새 활성) |
| D | #4 | ✅ | ✅ | ✅ |
| E | #5 | ✅ | ✅ | ✅ |
| **PR 머지 시점** | #1~#5 | ✅ | ✅ | ✅ |

Step C 직후 빌드는 통과하나 _테스트가 잠시 깨진다_. 이는 commit 단위의 일시 상태이며, PR 머지는 #5까지 모두 적용된 상태에서 이루어지므로 main 브랜치에는 _절대_ 깨진 상태가 들어가지 않는다.

### 3.8 검증
- L1 단독으로는 빌드만 통과시키고 _기능 검증은 L2 머지 후_ 수행 (L1만으로는 emit이 깨진다 — L2와 같은 PR이어야 하는 이유).
- Step C(atomic commit)가 가장 위험. 작성 전 모든 시그니처/타입 변경 위치를 grep으로 사전 추출하여 commit 작성 시 누락 0 보장.

---

## 4. L2 — 루트 단일 파이프라인

### 4.1 목표
`compile()`이 `planAll`로 만든 트리를 받아, 루트에서 단 1회의 measure/allocate/constraints/bounds 호출로 IR을 생성한다.
`emitInlineBlock`과 `emitSceneIR`을 **삭제**하고 단일 walker `emit(plan, bounds, ctx)`로 통합한다.

### 4.2 새 `compile()` 본문 (의사코드)

```ts
// packages/core/src/compiler/compiler.ts
export function compile(source: string, theme: DepixTheme = defaultTheme): IRRoot {
  const ast       = parse(tokenize(source));
  const plan      = planAll(ast, theme);                              // L1
  const canvas    = resolveCanvas(plan, theme);                       // @page → bounds
  const scaleCtx  = createScaleContext(plan, canvas);
  const constr    = computeConstraints(plan, scaleCtx);
  const budgets   = allocateBudgets(plan, canvas, constr, scaleCtx);
  const measure   = measureDiagram(plan, theme, scaleCtx, budgets);
  const bounds    = allocateBounds(plan, canvas, measure, budgets, constr, scaleCtx);
  const edges     = routeEdges(plan, bounds);
  return emit(plan, bounds, edges, theme);                            // walker only
}
```

핵심: **measure/allocate/constraints/bounds 호출은 정확히 1회씩**. 트리 walker(`emit`)는 어떤 핑퐁도 돌리지 않는다.

### 4.3 새 `emit(plan, bounds, edges, theme): IRRoot`

```ts
// packages/core/src/compiler/emit.ts (신규, emit-scene.ts + emit-ir.ts 통합)
export function emit(plan: PlanNode, bounds: BoundsMap, edges: EdgeMap, theme: DepixTheme): IRRoot {
  // 단순 트리 walk:
  //   - scene  → IRScene (children 재귀)
  //   - flow/tree/stack/box/... → 해당 IR 컨테이너 (children 재귀)
  //   - element → IRElement (leaf)
  // bounds는 plan.id로 조회만 한다 — 어떤 분배 로직도 없음
}
```

### 4.4 삭제 대상

| 파일 | 처리 |
|---|---|
| `compiler/passes/emit-ir.ts::emitInlineBlock` | **삭제** |
| `compiler/passes/emit-ir.ts::emitElement / emitBlockFromPlan` | **삭제** (단순 walker로 흡수) |
| `compiler/passes/emit-ir.ts` 전체 | **삭제** |
| `compiler/passes/emit-ir-blocks.ts` (dead) | **삭제** — §1.4 dead cluster |
| `compiler/passes/emit-ir-elements.ts` (dead) | **삭제** — §1.4 dead cluster |
| `compiler/passes/emit-ir-charts.ts` (dead) | **삭제** — §1.4 dead cluster |
| `compiler/passes/emit-ir-helpers.ts` (dead) | **삭제** — §1.4 dead cluster |
| `compiler/scene/emit-scene.ts` 전체 | **삭제** |

새 파일 `compiler/emit.ts` (+ 4개 분할 파일, §3.5.2)로 대체.
두 파일에서 살릴 만한 헬퍼(예: `applyOverridesTo`, `attachOriginToElement`)는 `compiler/emit-helpers.ts`로 이전.

> dead cluster 4파일에 살릴 코드가 있는지(중복 helper 등) 사전 grep 필수 — `routeASTEdge`, `buildStyle`, `buildInnerText`, `extractCornerRadius`, `computePortOffsets`, `getChartColor` 등이 emit-ir.ts canonical과 dead cluster에 모두 존재하는지 확인 후, canonical 쪽이 사라지면 walker에서 새로 작성한다 (dead cluster에서 가져오지 않음 — 0.1 원칙).

### 4.5 호출부 시그니처 변경

| 함수 | 변경 |
|---|---|
| `allocateBudgets(plan, canvas, constr, scaleCtx)` | 첫 인자가 `PlanNode`. 트리 전체 BFS |
| `measureDiagram(plan, theme, scaleCtx, budgets)` | 동일 |
| `computeConstraints(plan, scaleCtx)` | 동일 |
| `allocateBounds(plan, canvas, measure, budgets, constr, scaleCtx)` | **신규 시그니처**. 현재 `computeLayoutChildren`이 상위 호출자가 되어 트리 walker로 승격 |
| `routeEdges(plan, boundsMap)` | 동일 |

### 4.6 영향 파일 (L2만)
| 파일 | 변경 |
|---|---|
| `compiler/compiler.ts` | 본문 재작성 (위 4.2) |
| `compiler/emit.ts` | **신규** (4.3) |
| `compiler/emit-helpers.ts` | **신규** (헬퍼 보관) |
| `compiler/passes/emit-ir.ts` | **삭제** |
| `compiler/scene/emit-scene.ts` | **삭제** |
| `compiler/passes/allocate-bounds.ts` | 트리 walker로 승격, 자체 함수에서 plan 트리 재귀 |
| `compiler/passes/allocate-budgets.ts` | 동일 |
| `compiler/passes/measure.ts` | 동일 |
| `compiler/passes/compute-constraints.ts` | 동일 |
| `compiler/passes/scale-context.ts` | 동일 |
| `compiler/scene/` 디렉터리 | **삭제** (`emit-scene.ts`, `plan-scene.ts`, `scene-measure.ts`는 L4까지에 모두 사라짐) |

---

## 5. L3 — 모든 블록 타입에서 measureMap 활용

### 5.1 목표
`computeLayoutChildren`(L2 이후 트리 walker)의 **모든 case**가 `measureMap`을 사용하도록 통일.

### 5.2 변경 대상 case
| case | 현재 | 변경 |
|---|---|---|
| `stack` | 이미 사용 (`allocate-bounds.ts:374, 401`) | 변경 없음 |
| `flow` | 미사용, PHI 단독 | `max(measuredCross, idealCross)` 패턴 |
| `tree` | 미사용 | `max(measuredCross, depth-uniform)` 패턴 |
| `grid` | 미사용 | cell별 `max(measured, cellSize)` |
| `layers` | 미사용 | layer별 `max(measured, layerSize)` |
| `group` | 미사용 | 자식 union으로 fit |
| `box` | 미사용 | 컨텐츠 measure로 padding 흡수 후 fit |
| `scene` | 신규 case (L1 이후) | slot별 measure 결과로 preset 분배 보정 |

### 5.3 정책 분리 (선택, 권장)
case별 분기가 6+ 케이스로 늘어나므로, 정책을 데이터로 분리:

```ts
// packages/core/src/compiler/layout/block-policies.ts
export interface BlockPolicy {
  /** 자식 측정 needs를 컨테이너 cross 축 needs로 환산 */
  reduceCross(children: PlanNode[], measureMap: MeasureMap, ctx: PolicyContext): number;
  /** 휴리스틱 ideal cross (PHI 등) */
  idealCross(layout: LayoutContext): number;
  /** 자식별 budget 분배 규칙 */
  distribute(plan: PlanNode, bounds: IRBounds, measureMap: MeasureMap, ctx: PolicyContext): LayoutChild[];
}

export const BLOCK_POLICIES: Record<PlanBlockType, BlockPolicy> = {
  scene:   sceneScene,
  flow:    flowPolicy,
  tree:    treePolicy,
  stack:   stackPolicy,
  // ...
};
```

`computeLayoutChildren`은 dispatch만 한다. case 분기가 사라지고 새 block-type 추가 시 정책 한 곳에만 추가하면 된다.

> **이 분리는 L3의 _필수가 아닌 권장_ 옵션**이다. 위험을 줄이려면 L3에서는 case별 inline 수정만, L7 직전에 분리 PR을 별도로 낼 수 있다.

### 5.4 영향 파일 (L3만)
| 파일 | 변경 |
|---|---|
| `compiler/passes/allocate-bounds.ts` | 6개 case에 measureMap 활용 추가 |
| `compiler/passes/allocate-budgets.ts` | 동일 — `allocateTreeFlowBudgets`를 포함한 모든 분배 함수가 measureMap 우선 |
| `compiler/layout/block-policies.ts` | (선택) 정책 분리 |

### 5.5 검증
- `Math.max(measured, ideal)` 패턴 — 미적 하한(PHI 등) 보존, 회귀 0.
- 회귀 테스트: 황금비 케이스 DSL × 모든 block type.

---

## 6. L4 — `scene-measure.ts` 폐기

### 6.1 목표
Scene 크기 추정을 모두 `measureDiagram` 결과 조회로 대체. naive estimate 함수 제거.

### 6.2 변경
- `scene/scene-measure.ts` 파일 **삭제**.
- 호출부(L1 이후 `planAll` 내부에서 slot 크기 가늠 시):
  ```ts
  // before
  const h = estimateBlockNaturalHeight(block, theme);
  // after
  const h = measureMap.get(node.id)?.minHeight ?? 0;
  ```
- 단, L4 시점에는 _planAll 안에서 measureMap을 알 수 없다_ — measureMap은 plan 이후에 생성되기 때문.
- 해결: **slot 크기 가늠을 planAll에서 빼고 `allocateBounds`의 scene case로 이동**한다.
  scene case는 measureMap을 받으므로 자연스럽게 정확한 값을 사용한다.

### 6.3 영향 파일 (L4만)
| 파일 | 변경 |
|---|---|
| `compiler/scene/scene-measure.ts` | **삭제** |
| `compiler/layout/plan-all.ts` | slot 크기 추정 코드 제거 |
| `compiler/passes/allocate-bounds.ts` | scene case에 slot 크기 결정 로직 추가 |

### 6.4 위험
- "L1에서 정해두지 않으면 plan 단계에서 알 수 없는 정보가 있다"는 가정이 깨질 수 있음.
- 검증 항목: 모든 slot 크기 결정이 `allocateBounds(scene case)` 안에서 가능한지 사전 점검 필요.

---

## 7. L5 — slot ↔ container 역류 채널

### 7.1 목표
Container가 "나는 cross 축으로 X만큼만 필요하다"를 보고하고, 부모 slot layout이 그 차이를 정렬 규칙으로 흡수한다.
현재 `flow-layout.ts:224`의 `usedH = bounds.h` 하드코딩을 제거.

### 7.2 변경
- 모든 layout 함수(`flow-layout.ts`, `tree-layout.ts`, `stack-layout.ts`, …)가 `actualSize: { w, h }`를 반환.
- `allocateBounds` scene case가 자식의 actualSize를 모아 slot bounds를 _재할당_ 한다 (정렬: top/center/bottom, left/center/right).
- 핵심: container 축소 vs 확장은 **block-policy의 결정**이다 — flow는 "황금비 우선", grid는 "cell uniform 우선", group은 "fit shrink" 등.

### 7.3 영향 파일 (L5만)
| 파일 | 변경 |
|---|---|
| `engine/layout/flow-layout.ts` | `usedH` 하드코딩 제거, actualSize 반환 |
| `engine/layout/tree-layout.ts` | 동일 |
| `engine/layout/stack-layout.ts` | 동일 |
| `engine/layout/grid-layout.ts` | 동일 |
| `engine/layout/group-layout.ts` | 동일 |
| `compiler/passes/allocate-bounds.ts` | scene case에 정렬 흡수 로직 추가 |
| `compiler/layout/block-policies.ts` | (L3 권장 분리 시) 정책에 alignment 필드 추가 |

### 7.4 검증
- Binary Search flowchart: 수직 공백이 사라지거나, "정렬에 의한 의도적 공백"으로 명시화됨.
- 황금비 케이스: 컨테이너가 PHI 비율로 _스스로_ 축소되고 부모 slot이 가운데 정렬.

---

## 8. L6 — Fixed-point 수렴 루프

### 8.1 목표
budget이 measure에 의존하고 measure가 scale에 의존하는 케이스에서 수렴을 보장.

### 8.2 변경
`compile()`의 한 줄을 루프로:

```ts
let budgets = allocateBudgets(plan, canvas, constr, scaleCtx);
let measure = measureDiagram(plan, theme, scaleCtx, budgets);

const MAX_ITER = 3;
const EPS = 0.5; // pixels
for (let i = 0; i < MAX_ITER; i++) {
  const nextBudgets = allocateBudgets(plan, canvas, constr, scaleCtx, measure);
  const nextMeasure = measureDiagram(plan, theme, scaleCtx, nextBudgets);
  if (maxDelta(measure, nextMeasure) < EPS) break;
  budgets = nextBudgets;
  measure = nextMeasure;
}
```

### 8.3 변경 조건
`allocateBudgets`가 `measure`를 _참고_ 할 수 있도록 시그니처 확장:
```ts
allocateBudgets(plan, canvas, constr, scaleCtx, measure?: MeasureMap): BudgetMap
```

`measure`가 있으면 자식 needs를 budget 분배에 가중. 없으면(첫 호출) 균등 분배.

### 8.4 영향 파일 (L6만)
| 파일 | 변경 |
|---|---|
| `compiler/compiler.ts` | 루프 추가 |
| `compiler/passes/allocate-budgets.ts` | optional measure 인자 |

### 8.5 검증
- 폰트 스케일이 budget에 의존하는 DSL → 1회 vs 3회 결과 비교, 수렴 확인.
- 일반 DSL → 1회로 종료(`maxDelta < EPS`).

---

## 9. L7 — 테스트 / 문서 / 규칙

### 9.1 테스트
각 PR에 _그 PR이 도입한 기능의_ 회귀 테스트를 동봉한다. 별도 PR이 아니라 PR-1~PR-5에 분산.

#### PR-1 (L1+L2)
- `__tests__/compiler/layout/plan-all.test.ts` — planAll이 다양한 DSL에서 올바른 PlanNode 트리를 만드는지
  - `flow { ... }` → `scene(full).body=flow`
  - `scene { layout: split, left: tree, right: stack }` → 정상 wrapping
  - 깊은 중첩
- `__tests__/compiler/emit.test.ts` — emit walker가 bounds만 조회하고 어떤 분배도 안 함
- `__tests__/compiler/compile-pipeline.test.ts` — `compile()`이 measure/allocate를 정확히 1회씩만 호출 (spy 사용)

#### PR-2 (L3)
- `__tests__/compiler/passes/allocate-bounds-measure-map.test.ts` — `{block-type} × {measureMap 유/무}` 매트릭스
  - flow + measureMap=undefined → 기존 PHI 결과
  - flow + measureMap에 큰 minHeight → cross가 PHI 넘어 확장
  - tree + measureMap → depth uniform 보다 큰 cross 확장
  - 6 block types 전부

#### PR-3 (L4)
- `__tests__/compiler/scene/scene-measure-removed.test.ts`
  - scene-measure.ts 파일 부재 확인
  - slot 크기가 measureMap과 일치하는지

#### PR-4 (L5)
- `__tests__/compiler/scene/slot-feedback.test.ts`
  - container 축소 후 slot 정렬 흡수 검증
  - Binary Search flowchart 수직 공백 회귀 테스트

#### PR-5 (L6)
- `__tests__/compiler/passes/fixed-point-convergence.test.ts`
  - 일반 DSL → 1회 종료
  - 스케일 의존 DSL → 2~3회 수렴

### 9.2 문서
- `docs/DEPIX_ARCHITECTURE.md` — "단일 plan 트리 + 루트 1회 핑퐁" 다이어그램과 데이터 흐름 추가 (PR-1)
- `docs/DEPIX_IR_SPEC.md` — Plan ↔ IR 매핑 갱신 (PR-1)
- `docs/TODO.md` — 본 작업을 단계별 태스크로 분해해 기록

### 9.3 규칙 신설
`rules/specifics/S-pipeline.md`:
```
# S-pipeline — 컴파일러 파이프라인 규칙

## MUST
- compile()은 measure/allocateBudgets/computeConstraints/allocateBounds를 _루트에서 1회씩_ 호출한다.
- emit walker(`compiler/emit.ts`)는 bounds 조회 외 어떤 분배 로직도 갖지 않는다.
- Plan은 단일 트리(PlanNode). DiagramLayoutPlan/SceneNode 등 분리된 plan 타입을 새로 만들지 않는다.

## MUST NOT
- emit walker가 measureDiagram/allocateBudgets를 호출하지 않는다.
- container별 자체 핑퐁(과거 emitInlineBlock 패턴) 부활 금지.
- scene-측 별도 measure 함수(과거 estimateBlockNaturalHeight) 부활 금지.
```

### 9.4 기존 규칙 갱신 — `rules/specifics/S-compiler.md` (PR-1 필수)

현재 S-compiler.md MUST 항목 중 다음은 _옛 파이프라인을 강제_ 하므로 PR-1과 동시에 재작성하지 않으면 PR-1 자체가 S-compiler를 위반하게 된다.

| 행 | 현재 내용 | 변경 |
|---|---|---|
| 14 | "최상위 파이프라인 순서: parse → resolveData → flattenHierarchy → resolveTheme → extractOverrides → normalizeScenes → emitSceneIR → applyOverridesToIR" | "compile() 본문 = parse → resolveData → flattenHierarchy → resolveTheme → extractOverrides → **planAll** → computeConstraints → allocateBudgets → measure → allocateBounds → routeEdges → **emit** → applyOverridesToIR. 각 패스는 트리 전체에 대해 _루트 1회_ 호출된다." |
| 17 | "비-scene 블록은 `scene { layout: full; body: <block> }`으로 래핑된다." | 동일 의미를 `planAll`의 implicit scene 처리로 재서술 |
| 18 | "`emitSceneIR`이 최종 통합 단계이다 ... 다이어그램 블록은 scene 내에서 `emitInlineBlock`으로 처리된다." | "최종 단계는 `emit` walker이며, scene/container/element를 단일 트리로 walk하면서 bounds만 조회한다. **container별 자체 measure/allocate는 금지**." |
| 20 | "다이어그램 블록의 내부 파이프라인 순서: planLayout → ... → emitIR" | **항목 자체 삭제**. 단일 트리에서는 "다이어그램 블록의 내부 파이프라인"이라는 개념이 존재하지 않는다. |
| 21-23 | computeConstraints/allocateBudgets/measure 설명에서 "plan 트리"는 그대로 유효하나 _scope_ 가 다이어그램 블록이 아닌 _전체 plan 트리_ 임을 명시. | 문구 수정 |
| 25 | "새 레이아웃 알고리즘은 `compiler/layout/`에 독립 파일로 추가한다. `emit-ir.ts` 내부에 인라인으로 작성하지 않는다." | "`emit-ir.ts` 내부" → "`emit.ts` walker 내부" |
| 29 | "`emitIR` 패스는 IR 요소를 생성만 한다." | "`emit` 패스(walker)는 IR 요소를 생성만 한다." |

#### 9.4.1 신구 규칙 충돌 처리
PR-1의 _첫 commit_ 이 S-compiler.md 갱신이어야 한다. 그래야 동일 PR의 후속 commit이 새 규칙 기준으로 rule-guard를 통과할 수 있다.

---

## 10. 변경 파일 마스터 목록

### 10.1 신규
| 파일 | 도입 PR | 비고 |
|---|---|---|
| `compiler/layout/plan-types.ts` | PR-1 | PlanNode/PlanEdge/PlanMetrics/PlanBlockType/SceneLayoutSpec (~100줄) |
| `compiler/layout/plan-weights.ts` | PR-1 | BASE_WEIGHT 16종 + computeWeight. 가중치 튜닝 전용 (~80줄, §3.4.3) |
| `compiler/layout/plan-all.ts` | PR-1 | 진입점 (~80줄) |
| `compiler/layout/plan-all-scene.ts` | PR-1 | scene 정규화 (~120줄) |
| `compiler/layout/plan-all-block.ts` | PR-1 | container 변환 (~80줄) |
| `compiler/layout/plan-all-element.ts` | PR-1 | leaf element 변환 + classify/intrinsicSize (~150줄) |
| `compiler/layout/plan-all-edges.ts` | PR-1 | edge 변환 (~50줄) |
| `compiler/emit.ts` | PR-1 | walker 진입점 (~80줄) |
| `compiler/emit-scene-walker.ts` | PR-1 | scene case (~60줄) |
| `compiler/emit-block-walker.ts` | PR-1 | container case (~150줄) |
| `compiler/emit-element-walker.ts` | PR-1 | element case (~200줄) |
| `compiler/emit-helpers.ts` | PR-1 | 공유 헬퍼 (~150줄) |
| `compiler/layout/block-policies.ts` | PR-2 (선택) | |
| `rules/specifics/S-pipeline.md` | PR-1 Step A | §9.3 |
| 테스트 9.1 전부 | 각 PR | |

> 모든 신규 파일은 C1.md 38행 "신규 파일 300줄 제한"을 충족하도록 설계됨 (§3.5).

### 10.2 삭제
| 파일 | 삭제 PR |
|---|---|
| `compiler/passes/emit-ir.ts` | PR-1 |
| `compiler/passes/emit-ir-blocks.ts` (dead) | PR-1 — §1.4 |
| `compiler/passes/emit-ir-elements.ts` (dead) | PR-1 — §1.4 |
| `compiler/passes/emit-ir-charts.ts` (dead) | PR-1 — §1.4 |
| `compiler/passes/emit-ir-helpers.ts` (dead) | PR-1 — §1.4 |
| `compiler/scene/emit-scene.ts` | PR-1 |
| `compiler/scene/plan-scene.ts` | PR-1 |
| `compiler/layout/plan-layout.ts` | PR-1 |
| `compiler/scene/scene-measure.ts` | PR-3 |
| `compiler/scene/` 디렉터리 자체 | PR-3 (모든 파일 삭제 후) |

### 10.3 수정
| 파일 | 수정 PR |
|---|---|
| `compiler/compiler.ts` | PR-1 Step C (compile() 재작성 + normalizeScenes 삭제), PR-5 (수렴 루프) |
| `compiler/tokenizer.ts` | PR-1 Step C (BLOCK_TYPES에서 canvas 제거, §3.4.4) |
| `compiler/passes/allocate-bounds.ts` | PR-1 Step C (시그니처 + nodeType→blockType + astNode 7건 + alias 3건 = 10건 치환 + `case 'canvas':` 2곳 삭제), PR-2 (measureMap 활용), PR-3 (scene case slot 크기), PR-4 (정렬 흡수) |
| `compiler/passes/allocate-budgets.ts` | PR-1 Step C (시그니처 + astNode 13건 치환), PR-2 (measureMap 활용), PR-5 (optional measure) |
| `compiler/passes/measure.ts` | PR-1 Step C (**7개 함수 시그니처 `element: ASTElement` → `plan: PlanNode` + 내부 `element.*` 13건 → `plan.*` 치환, ISSUE A**) |
| `compiler/passes/compute-constraints.ts` | PR-1 Step C (시그니처 + astNode 13건 치환) |
| `compiler/passes/scale-context.ts` | PR-1 Step C (시그니처) |
| `compiler/passes/scale-system.ts` | PR-1 Step C (DiagramLayoutPlan/LayoutPlanNode → PlanNode + astNode 2건 치환, §3.6.2) |
| `compiler/passes/budget-types.ts` | PR-1 Step C (PlanNode.id 키 명시) |
| `compiler/passes/structural-roles.ts` | PR-1 Step C (시그니처 + nodeType→blockType + astNode.label 1건 치환, §3.6.1) |
| `compiler/element-type-registry.ts` | PR-1 Step C (import 경로 + PlanNodeType→PlanBlockType, §3.6.3) |
| `compiler/passes/index.ts` | PR-1 Step C (export 정리 + JSDoc 갱신) |
| `compiler/container-meta.ts` | PR-1 Step C (canvas 엔트리 제거, line 28, ISSUE D) |
| `ir/types.ts` | PR-1 Step C (canvas IR 타입 제거, line 112, ISSUE D) |
| `ir/validators.ts` | PR-1 Step C (canvas 검증 분기 제거, line 169, ISSUE D) |
| `packages/editor/src/semantic-editor.ts` | PR-1 Step C (canvas 분기 제거, line 313, ISSUE D) |
| `apps/website/public/depix.tmLanguage.json` | PR-1 Step C (syntax 키워드에서 canvas 제거, line 53, ISSUE D) |
| `rules/specifics/S-compiler.md` | PR-1 Step A (line 14-23 재작성, §9.4) |
| `engine/layout/flow-layout.ts` | PR-4 (usedH 제거, actualSize 반환) |
| `engine/layout/tree-layout.ts` | PR-4 |
| `engine/layout/stack-layout.ts` | PR-4 |
| `engine/layout/grid-layout.ts` | PR-4 |
| `engine/layout/group-layout.ts` | PR-4 |

---

## 11. 위험 분석

| 위험 | 가능성 | 영향 | 완화책 |
|---|:-:|:-:|---|
| L1 PlanNode 스키마 결함 | 중 | 치명 | L1 시작 전 schema RFC를 별도 문서로 작성, 사용자 리뷰 필수 |
| 1264개 core 테스트 회귀 | 높 | 중 | PR-1을 머지하기 전 모든 테스트를 새 시그니처에 맞게 수정 (별도 sub-PR로 분리 가능) |
| `emit-scene.ts`의 숨은 책임 누락 | 중 | 중 | L2 시작 전 emit-scene/emit-ir의 모든 export 사용처 grep, 누락 0 보장 |
| 폰트 스케일 수렴 실패 (L6) | 낮 | 낮 | MAX_ITER=3에서 무한 발산 시 마지막 결과 사용 + 경고 로그 |
| L5 actualSize 변경이 IR bounds 출력에 영향 | 중 | 중 | scene case의 정렬 흡수가 _IR bounds를 추가로 변경_ 한다는 점을 emit walker가 정확히 반영해야 함 |
| `block-policies.ts` 분리 시 디버깅 난도 증가 | 낮 | 낮 | L3에서는 inline 수정으로 시작, 분리는 L7 직전 별도 PR |
| Scene 정규화의 implicit wrapping 차이 | 중 | 중 | `planAll`이 기존 `normalizeScenes` + `parser` implicit scene 케이스를 모두 커버하는지 단위 테스트로 잠금 |

---

## 12. 검증 계획

### 12.1 PR-1 (L1+L2)
1. `pnpm --filter @depix/core run build` — 타입 통과
2. `pnpm --filter @depix/core run test` — 1264 + 신규 통과 (테스트 시그니처 수정 포함)
3. `pnpm --filter @depix/engine run test` — 120 통과
4. spy 테스트 — measure/allocate가 정확히 1회씩 호출됨 확인
5. 수동 시각 — Binary Search flowchart, Image #50, #51, 각 layout preset 1개씩 14종

### 12.2 PR-2 (L3)
1. 회귀 매트릭스 (block-type × measureMap)
2. 황금비 케이스 회귀 0

### 12.3 PR-3 (L4)
1. `scene-measure.ts` 부재 확인
2. slot 크기와 measureMap 일치

### 12.4 PR-4 (L5)
1. 수직 공백 개선 시각 검증
2. 컨테이너 축소 시 정렬 검증

### 12.5 PR-5 (L6)
1. 1회 종료 / 다회 수렴 단위 테스트
2. 무한 루프 방지 (MAX_ITER 작동) 단위 테스트

---

## 13. Rule Guard 흐름

각 PR마다:
1. **사전 검토** — 변경 계획을 rule-guard에 전달, 현재 taskId 포함
2. PASS면 단계별 수정 실행
3. 각 단계 직후 사후 검증
4. ISSUE면 즉시 멈추고 재계획
5. PR 단위 PASS 후 머지 → 다음 PR

PR-1에서 신설할 `rules/specifics/S-pipeline.md`는 PR-2 이후의 rule-guard 검증 기준이 된다.

---

## 14. 진행 순서 요약

```
PR-1  [L1+L2]  Plan 트리 통합 + 루트 단일 파이프라인 + S-pipeline 규칙
   ↓
PR-2  [L3]    모든 블록 타입 measureMap 활용
   ↓
PR-3  [L4]    scene-measure.ts 폐기
   ↓
PR-4  [L5]    slot↔container 역류 채널
   ↓
PR-5  [L6]    Fixed-point 수렴 루프
```

각 PR이 머지 가능한 단위(빌드/테스트 통과)이며, 0.1 원칙에 따라 _옛 경로 + 새 경로 공존_ 상태는 어느 PR에도 존재하지 않는다.

---

## 15. 대체된 계획

`tasks/pingpong-pipeline-restoration.md`(A안 ~28줄 응급 패치)는 본 계획에 의해 폐기된다.
파일 자체는 git history와 사용자 의사결정 기록을 위해 _보존_ 한다.
