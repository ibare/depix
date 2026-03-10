# Depix 컴파일러 아키텍처 설계

> **목표**: "의도"를 기술하면 "모양"으로 변환한다.  
> 의도는 지속적으로 추가될 수 있고, 의도가 추가될 때 렌더러를 건드리지 않으며, 의도가 중첩되어도 동일한 메커니즘이 작동한다.

---

## 1. 핵심 철학

### 1.1 세 가지 분리

```
"무엇을" (의도)   →   "어떻게" (컴파일러)   →   "그리기" (렌더러)
     DSL                  Compiler                  Renderer
```

- **DSL**: 사용자는 의미만 기술한다. 좌표, 크기, 폰트 수치를 직접 지정하지 않는다.
- **Compiler**: 의도를 해석하고 레이아웃을 계산해 모든 값이 확정된 IR을 생성한다.
- **Renderer**: 완전히 해결된 IR을 받아 그리기만 한다. 레이아웃 로직이 없다.

렌더러는 IR 계약만 지키면 변경할 이유가 없다. 새로운 의도가 추가되거나 레이아웃 알고리즘이 개선되어도 렌더러는 그대로다. "아름다움"을 추구하는 시각적 튜닝도 렌더러 레이어에서 독립적으로 진행할 수 있다.

### 1.2 캔버스의 재귀성

> 최상단 부모는 캔버스다. 모든 자식 의도 덩어리는 자신이 받은 공간 안에서 동작하는 작은 캔버스다.

```
Canvas
├── tree 노드 "Engineering"  ← 캔버스의 40% 배정
│   └── flow direction:right  ← tree가 준 공간 안에서 작은 캔버스처럼 동작
│       ├── node "Plan"
│       ├── node "Build"
│       └── node "Ship"
└── tree 노드 "Finance"       ← 캔버스의 60% 배정
    └── grid cols:2
```

이 재귀 구조 덕분에 복잡한 중첩 문제가 "같은 문제의 반복"이 된다.  
새 의도가 추가될 때 구현해야 할 것이 두 함수로 정규화된다:

- `computeConstraints()` — 내 min/max는 얼마인가
- `allocateBudget(budget)` — 받은 예산을 자식들에게 어떻게 나누는가

### 1.3 DSL과 오버라이드의 역할 분담

사용자가 편집기에서 노드를 움직이거나 크기를 조정하면, 그 정보는 더 이상 의미 기반이 아니다.  
Depix는 이를 명확하게 분리한다.

```
DSL        → 무엇이 있는가 (구조, 연결, 의도)
@overrides → 어디에 어떻게 보이는가 (위치, 크기 고정값)
```

내부적으로 `BoundsMap`은 **항상 완전하게 존재**한다. 컴파일러가 계산한 값이든 사용자가 고정한 값이든, 렌더링에 필요한 좌표는 언제나 확정되어 있다. 차이는 단 하나 — **이 값을 다음 컴파일에서 재계산해도 되는가(`pinned: false`), 아니면 사용자가 고정했는가(`pinned: true`)**.

`@overrides`는 `pinned: true`인 노드의 값만 DSL에 직렬화한 것이다.

---

## 2. 의도(Intent)

### 2.1 정의

의도는 "사람이 도식화할 때 사용하는 의미 덩어리"다.  
브라우저의 `flex`, `grid`가 배치 규칙인 것과 달리, Depix의 의도는 **도메인 수준의 의미**를 가진다.

| 의도 | 의미 |
|------|------|
| `flow` | 방향성 있는 흐름 — 파이프라인, 프로세스 |
| `tree` | 계층 구조 — 조직도, 분류 체계 |
| `stack` | 순서 있는 나열 — 목록, 단계 |
| `grid` | 행렬 배치 — 비교표, 매트릭스 |
| `layers` | 수직 레이어 스택 — 아키텍처, 기술 스택 |
| `group` | 시각적 그룹핑 — 영역 구분 |
| *(확장 예정)* | `timeline`, `swimlane`, `mindmap`, `kanban` ... |

### 2.2 의도의 중첩

의도는 다른 의도를 자식으로 포함할 수 있다. 중첩 깊이에 제한이 없다.

```depix
tree direction:down {
  node "CEO"
  node "Engineering" {
    flow direction:right {      ← tree 노드 안의 flow
      node "Plan" #a
      node "Build" #b
      node "Ship" #c
      #a -> #b -> #c
    }
  }
  node "Finance" {
    grid cols:2 {               ← tree 노드 안의 grid
      cell "Q1" { color: success }
      cell "Q2" { color: warning }
    }
  }
}
```

컴파일러는 동일한 재귀 메커니즘으로 처리한다. 각 의도는 받은 예산 안에서 작은 캔버스처럼 독립적으로 동작한다.

---

## 3. 컴파일러 파이프라인

### 3.1 전체 구조

```
DSL 텍스트 + @overrides
    │
    ▼
┌─────────────┐
│    Parse     │  DSL + @overrides → AST + PinnedMap
└──────┬──────┘
       │
    ▼
┌─────────────┐
│ Resolve Theme│  시맨틱 토큰 → 구체 값 (color: warning → #F59E0B)
└──────┬──────┘
       │
    ▼
┌─────────────┐
│  Plan Layout │  구조 분석 — 레벨 수, 분기, 레이어 등
└──────┬──────┘
       │
    ▼
┌─────────────┐
│  Scale System│  baseUnit 계산 (√(면적/요소수) × 0.55)
└──────┬──────┘
       │
    ▼  ← 2-pass 예산 시스템
┌─────────────┐
│  Bottom-up   │  자식 → 부모 방향으로 min/max 제약 수집
│  Constraints │  (pinned 노드는 고정값을 제약으로 사용)
└──────┬──────┘
       │  ConstraintMap = Map<id, { minW, maxW, minH, maxH }>
    ▼
┌─────────────┐
│  Top-down    │  부모 → 자식 방향으로 예산 배분
│  Budget      │  (pinned 노드는 배분 스킵, 고정값 그대로)
└──────┬──────┘
       │  BudgetMap = Map<id, { width, height, pinned }>
    ▼
┌─────────────┐
│   Measure    │  budget 기반 fontSize, padding, minHeight 결정
└──────┬──────┘
       │  MeasureMap = Map<id, MeasureResult>
    ▼
┌─────────────┐
│   Allocate   │  measure 제약 + layout 알고리즘으로 최종 좌표 확정
│              │  (pinned 노드는 좌표 계산 스킵)
└──────┬──────┘
       │  BoundsMap = Map<id, BoundsEntry>
    ▼
┌─────────────┐
│   Emit IR    │  모든 좌표, 색상, 경로가 확정된 IR JSON 생성
└─────────────┘
       │
    ▼
  DepixIR
```

### 3.2 핵심: 2-pass 예산 시스템

기존 파이프라인의 문제는 **닭과 달걀**이었다.

```
fontSize를 결정하려면 → 할당된 공간(크기)을 알아야 함
공간을 할당하려면   → fontSize(→ minHeight)를 알아야 함
```

2-pass가 이를 해소한다.

```
Pass 1 (Bottom-up): 자식이 "나는 최소 X, 최대 Y가 필요해"를 부모에게 보고
Pass 2 (Top-down):  부모가 그 제약 안에서 예산을 배분하고 자식에게 전달
```

measure는 확정된 예산을 받은 후 실행되므로 순환 의존이 끊긴다.

---

## 4. 2-pass 예산 시스템 상세

### 4.1 데이터 타입

```typescript
// Pass 1 결과: 각 노드의 크기 제약
interface ConstraintMap {
  constraints: Map<string, {
    minWidth: number;
    maxWidth: number;   // Infinity 가능
    minHeight: number;
    maxHeight: number;  // Infinity 가능
  }>;
}

// Pass 2 결과: 각 노드에 확정된 예산
interface BudgetMap {
  budgets: Map<string, {
    width: number;
    height: number;
    pinned: boolean;
  }>;
}

// 최종 좌표 (항상 완전)
interface BoundsEntry {
  x: number;
  y: number;
  w: number;
  h: number;
  pinned: boolean;  // false = 컴파일러가 재계산 가능
                    // true  = 사용자 고정값, 재계산 스킵
}
```

### 4.2 Pass 1 — Bottom-up: 제약 수집

자식 의도가 부모에게 자신의 크기 요구 범위를 보고한다.

```typescript
export function computeConstraints(
  plan: DiagramLayoutPlan,
  pinnedMap: PinnedMap,
  scaleCtx: ScaleContext,
): ConstraintMap;
```

의도별 제약 계산 전략:

| 의도 | minWidth | minHeight |
|------|----------|-----------|
| `flow` | 노드 수 × minNodeSize + gaps | 레이어 수 × minNodeSize + gaps |
| `tree` | 최대 형제 수 × minNodeSize + gaps | 레벨 수 × minNodeSize + gaps |
| `grid` | cols × minCellSize + gaps | rows × minCellSize + gaps |
| `layers` | minLayerWidth | 레이어 수 × minLayerHeight + gaps |
| `stack` | 단일 자식 minWidth | 자식 minHeight 합계 + gaps |

자식이 중첩 의도일 경우 재귀적으로 계산된다.

```
tree
└── node "Engineering"
    └── flow  ← flow.computeConstraints() 먼저 실행
               → 결과가 node "Engineering"의 min 크기에 반영
               → tree.computeConstraints()에서 그 값을 사용
```

pinned 노드는 고정된 크기가 곧 제약이다.

```typescript
if (pinnedMap.has(nodeId)) {
  const p = pinnedMap.get(nodeId);
  return { minWidth: p.w, maxWidth: p.w, minHeight: p.h, maxHeight: p.h };
}
```

### 4.3 Pass 2 — Top-down: 예산 배분

캔버스 크기를 루트 예산으로, 자식들의 제약 안에서 예산을 분배한다.

```typescript
export function allocateBudgets(
  plan: DiagramLayoutPlan,
  canvasBounds: IRBounds,
  constraints: ConstraintMap,
  pinnedMap: PinnedMap,
  scaleCtx: ScaleContext,
): BudgetMap;
```

배분 알고리즘:

```
1. 부모 예산 B를 받는다
2. pinned 자식은 고정값을 그대로 사용, 나머지 예산에서 제외
3. 남은 자식들의 minSize 합계를 계산
4. 여분 공간(B - pinnedSum - minSum)을 weight 비례로 분배
5. 각 자식에게 min/max 범위 안에서 최종 예산 확정
6. 각 자식에 대해 재귀적으로 반복
```

오버플로우 처리 (자식 min 합계 > 부모 예산):

```typescript
if (totalMin > parentBudget) {
  const ratio = parentBudget / totalMin;
  children.forEach(child => {
    child.budget = child.min * ratio;
  });
}
```

### 4.4 의도별 예산 배분 전략

#### Stack

```
direction: col
  usableH = budget.h - gap × (n - 1)
  자식[i].budget.h = usableH × (weight[i] / totalWeight)
  자식[i].budget.w = budget.w
```

#### Grid

```
rows = ceil(n / cols)
자식.budget.w = (budget.w - gapX × (cols - 1)) / cols
자식.budget.h = (budget.h - gapY × (rows - 1)) / rows
```

#### Layers

```
자식.budget.w = budget.w
자식.budget.h = (budget.h - gap × (n - 1)) / n
```

#### Group

```
padding 제외 후 자식들에게 weight 비례 분배 (Stack col과 동일 구조)
  usableW = budget.w - paddingX × 2
  usableH = budget.h - paddingY × 2 - gap × (n - 1)
  자식[i].budget.h = usableH × (weight[i] / totalWeight)
  자식[i].budget.w = usableW
```

#### Tree ← 기존 대비 변경

기존: area 휴리스틱 + `Math.min(1, scale)` cap → 캔버스 미활용  
변경: 레벨 기반 공간 분할 → space-filling

```
1. 트리 구조 분석: numLevels, nodesPerLevel[]

2. Main축 분배 (direction:down → height)
   levelH = (budget.h - levelGap × (numLevels - 1)) / numLevels

3. Cross축 분배 — 레벨별
   level L의 각 노드:
     nodeW = (budget.w - siblingGap × (nodesAtLevel - 1)) / nodesAtLevel
     nodeW = min(nodeW, budget.w × 0.5)  ← 단일 노드 과도한 확대 방지
```

예시 (조직도 3레벨):

```
레벨 0 (CEO):         budget = { w: 90,   h: 28.3 }
레벨 1 (CTO/CFO/COO): budget = { w: 28.7, h: 28.3 }
레벨 2 (8 leaf):      budget = { w: 10.1, h: 28.3 }
```

#### Flow ← 기존 대비 변경

기존: area 휴리스틱 + cross축 40% cap → cross축 미활용  
변경: Sugiyama layer 기반 공간 분할 → space-filling

```
1. Sugiyama layer 할당: layerCount, layerGroups[]

2. Main축 분배
   layerMain = (budget.main - gap × (layerCount - 1)) / layerCount

3. Cross축 분배 — layer별
   layer L의 각 노드:
     nodeCross = (budget.cross - gap × (nodesInLayer - 1)) / nodesInLayer
     nodeCross = min(nodeCross, budget.cross × 0.6)  ← 단일 노드 cap
```

예시 (분기 flow, 5노드):

```
layer 0: [Client]       → { w: 21.3, h: 54   }
layer 1: [API Gateway]  → { w: 21.3, h: 54   }
layer 2: [Service A, B] → { w: 21.3, h: 43.3 }
layer 3: [Database]     → { w: 21.3, h: 54   }
```

---

## 5. 의도 인터페이스 계약

새 의도를 추가할 때 구현해야 할 인터페이스:

```typescript
interface IntentImplementation {
  /**
   * Pass 1: 이 의도가 동작하기 위한 최소/최대 크기를 반환한다.
   * 자식 의도들의 제약이 이미 ConstraintMap에 포함되어 있다.
   */
  computeConstraints(
    plan: IntentPlan,
    childConstraints: ConstraintMap,
    scaleCtx: ScaleContext,
  ): { minWidth: number; maxWidth: number; minHeight: number; maxHeight: number };

  /**
   * Pass 2: 받은 예산을 자식들에게 어떻게 나눌지 결정한다.
   * 자식의 min/max와 pinned 상태를 존중하면서 분배한다.
   */
  allocateBudget(
    plan: IntentPlan,
    budget: { width: number; height: number },
    childConstraints: ConstraintMap,
    pinnedMap: PinnedMap,
  ): Map<string, { width: number; height: number; pinned: boolean }>;
}
```

새 의도(`timeline`, `swimlane` 등)는 이 두 함수만 구현하면 된다.  
Measure, Allocate, Emit 패스는 변경 없이 동작한다.

---

## 6. BoundsMap — 항상 완전한 내부 모델

### 6.1 설계 원칙

BoundsMap은 렌더링에 필요한 모든 노드의 위치와 크기를 담는다.  
컴파일러가 계산했든 사용자가 고정했든 **항상 완전하게 존재**한다.

```
컴파일 시:
  pinned: false → 정상 파이프라인 (constraints → budget → measure → allocate)
  pinned: true  → 예산/레이아웃 계산 스킵, 고정값 그대로 BoundsMap에 삽입

렌더링 시:
  항상 완전한 BoundsMap → 렌더러는 pinned 여부를 모른다, 그냥 그린다

DSL 직렬화 시:
  pinned: true  인 노드만 @overrides 블록에 기록
  pinned: false 인 노드는 기록 안 함 (다음 컴파일에서 재계산)
```

### 6.2 @overrides DSL 표현

```depix
flow direction:right {
  node "Input" #in
  node "Process" #proc
  node "Output" #out { shape: diamond }
  node "Logger" #log        ← 사용자가 추가한 노드 (DSL에 기록)
  #in -> #proc -> #out
  #proc -> #log             ← 사용자가 추가한 연결 (DSL에 기록)
}

@overrides {
  #proc { x: 45.2, y: 30.1, w: 20.3, h: 15.7 }  ← 사용자가 이동/크기 조정
  #log  { x: 48.0, y: 60.0 }                      ← 사용자가 배치
}
```

역할 분담:

```
노드/연결의 존재 여부  → DSL 본문
노드의 위치/크기 고정 → @overrides
```

엣지 경로는 @overrides에 저장하지 않는다. 노드 위치가 확정된 후 항상 재라우팅한다.

### 6.3 오버라이드 초기화

```typescript
// 특정 노드 고정 해제
boundsMap.get('#proc').pinned = false;

// 전체 해제 — @overrides 제거와 동일한 효과
boundsMap.forEach(entry => entry.pinned = false);
```

@overrides 블록을 DSL에서 제거하면 원래 의도 기반 레이아웃으로 완전히 복원된다.

---

## 7. 시맨틱 사이즈 토큰 — LLM 친화적 예산 힌트

### 7.1 설계 원칙

DSL에서 `font-size: xl` 같은 시맨틱 사이즈 표현을 허용한다.  
단, 컴파일러는 이를 **절대 크기가 아닌 예산 weight 힌트**로 해석한다.

- **LLM 친화성**: LLM은 CSS 유사 문법(`font-size: xl`)을 수십억 개의 예제로 학습했다. 이 패턴이 가장 자연스럽게 생성된다.
- **철학 일관성**: 절대 수치는 DSL에 없다. 예산 시스템이 실제 크기를 결정한다.

### 7.2 토큰 → Weight 변환

```
font-size: 2xl → weight: 2.0
font-size: xl  → weight: 1.5
font-size: lg  → weight: 1.25
font-size: md  → weight: 1.0  (기본값, 미지정 시)
font-size: sm  → weight: 0.75
font-size: xs  → weight: 0.5
```

### 7.3 동작 방식

시맨틱 사이즈는 형제 노드 간의 **상대적 예산 배분 비율**에만 영향을 미친다.

```depix
flow direction:right {
  node "Critical" { font-size: xl }   ← weight 1.5
  node "Normal"                        ← weight 1.0 (기본)
  node "Minor"    { font-size: sm }   ← weight 0.75
}
```

```
총 weight = 3.25, 부모 예산 width = 900px

Critical → 900 × (1.5 / 3.25) ≈ 415px
Normal   → 900 × (1.0 / 3.25) ≈ 277px
Minor    → 900 × (0.75 / 3.25) ≈ 208px
```

각 노드는 받은 예산 안에서 fontSize가 자동 결정된다. `font-size: xl`이라고 썼지만 실제 fontSize 수치는 캔버스 크기와 형제 수에 따라 달라진다.

### 7.4 중첩 의도에서의 동작

시맨틱 사이즈는 **같은 부모를 공유하는 형제 간에만** 적용된다. 중첩 경계를 넘어 전파되지 않는다.

```depix
tree direction:down {
  node "Engineering" { font-size: xl }  ← tree 레벨에서 형제 대비 1.5배
    flow direction:right {
      node "Plan"
      node "Build" { font-size: lg }    ← flow 레벨에서 형제 대비 1.25배
    }
  node "Finance"                         ← tree 레벨에서 형제 대비 1.0배
}
```

### 7.5 measure에서의 fontSize 결정

시맨틱 사이즈 weight는 예산 배분 단계에서 이미 반영된다. measure 패스는 확정된 예산 크기만으로 fontSize를 결정하므로 별도 처리가 없다.

```typescript
// measure.ts
const budget = budgetMap.get(plan.id);
const shortSide = budget
  ? Math.min(budget.width, budget.height)
  : Math.min(plan.intrinsicSize.width, plan.intrinsicSize.height);

return computeFontSize(shortSide, role);
// innerLabel: shortSide × 0.30
// outerLabel: shortSide × 0.25
// header:     shortSide × 0.35
```

요소가 많아질수록 예산이 줄고, 예산이 줄면 fontSize가 자연스럽게 축소된다.

**layers 시뮬레이션** (동일 weight):

| 요소 수 | budget.h | fontSize |
|---------|----------|----------|
| 1 | 90.0 | 10.0 (max) |
| 2 | 43.3 | 10.0 (max) |
| 4 | 20.6 | 6.2 |
| 6 | 13.3 | 4.0 |
| 12 | 6.1 | 1.8 |
| 20 | 3.1 | 0.9 |

모든 단계에서 오버플로우 없이 캔버스를 전체 활용한다.

---

## 8. 편집 모델

### 9.1 편집 = pinned 전환

사용자가 에디터에서 노드 경계를 드래그하면, 해당 노드가 `pinned: true`로 전환된다.  
형제 노드들의 예산이 남은 공간 안에서 재조정되고, @overrides에 기록된다.

```
사용자: "Process 노드를 드래그해서 이동"
  → #proc: pinned: true, 새 x/y/w/h 고정
  → 형제 노드들: 남은 예산으로 재배분
  → #proc에 연결된 엣지: 새 위치 기준으로 재라우팅
  → @overrides에 #proc 좌표 기록
  → DSL 직렬화
```

### 9.2 LLM과의 역할 분담

```
LLM 작업 영역    → DSL 본문 (구조, 의도, 연결, 내용)
편집기 작업 영역 → @overrides (위치, 크기 고정값)
```

LLM이 "Logger 노드를 추가해줘"라는 요청을 받으면 DSL 본문만 수정한다. @overrides는 건드리지 않는다.

### 9.3 제약 vs 자유 편집

**제약 편집 (기본)**: 부모 예산 안에서 형제 간 비율 조정. 항상 캔버스를 꽉 채운다.

**자유 편집 (Detach)**: 의도의 레이아웃 제약에서 완전히 벗어난 절대 좌표 편집. Figma의 "Remove Auto Layout"과 동일한 개념. Detach된 노드는 IR을 직접 저장하며 DSL로 역변환되지 않는다.

### 9.4 서브트리 선택적 재컴파일

예산이 변경된 서브트리만 재컴파일한다.

```
사용자가 "Engineering" 노드 크기 조정
  → Engineering 서브트리 재컴파일 (안의 flow 포함)
  → Finance 서브트리 변경 없음 (캐시 사용)
  → tree 루트 레이아웃만 재계산
```

---

## 9. 구현 계획

### Phase 1 — 인프라: 2-pass 예산 시스템

| # | 작업 | 파일 |
|---|------|------|
| 1-1 | `ConstraintMap`, `BudgetMap`, `BoundsEntry` 타입 정의 | `passes/types.ts` (신규) |
| 1-2 | `computeConstraints()` 구현 — stack/grid/layers/group | `passes/compute-constraints.ts` (신규) |
| 1-3 | `allocateBudgets()` 구현 — stack/grid/layers/group | `passes/pre-allocate.ts` (신규) |
| 1-4 | 시맨틱 사이즈 → weight 변환 | `passes/compute-constraints.ts` |
| 1-5 | `pinned` 플래그 BoundsMap 통합 | `passes/allocate-bounds.ts` |
| 1-6 | measure에 budgetMap 전달 | `passes/measure.ts` |
| 1-7 | 파이프라인 연결 | `passes/emit-ir.ts` |

**검증**: layers 12개 → 모두 캔버스 내 표시, fontSize 자동 축소.

### Phase 2 — Tree/Flow Space-Filling

| # | 작업 | 파일 |
|---|------|------|
| 2-1 | `computeTreeLevels()` 유틸 추출 | `passes/compute-constraints.ts` |
| 2-2 | `computeFlowLayers()` 유틸 추출 | `passes/compute-constraints.ts` |
| 2-3 | tree constraints / budget 구현 | `passes/compute-constraints.ts`, `passes/pre-allocate.ts` |
| 2-4 | flow constraints / budget 구현 | 동일 |
| 2-5 | tree-layout space-filling (scale cap 제거) | `layout/tree-layout.ts` |
| 2-6 | flow-layout cross축 space-filling | `layout/flow-layout.ts` |

**검증**: 조직도 캔버스 전체 활용, flow 다이어그램 여백 감소.

### Phase 3 — 중첩 의도 지원

| # | 작업 | 파일 |
|---|------|------|
| 3-1 | `IntentImplementation` 인터페이스 정의 | `intents/base.ts` (신규) |
| 3-2 | 기존 의도들을 인터페이스로 리팩토링 | 각 layout 파일 |
| 3-3 | 중첩 의도 재귀 처리 | `passes/compute-constraints.ts`, `passes/pre-allocate.ts` |
| 3-4 | 중첩 시나리오 E2E 테스트 | `__tests__/compiler/nested-intents.test.ts` |

**검증**: tree 안의 flow, flow 안의 grid 등 중첩 케이스 동작.

### Phase 4 — @overrides 및 편집 모델

| # | 작업 | 파일 |
|---|------|------|
| 4-1 | `@overrides` DSL 파싱 | `compiler/parser.ts` |
| 4-2 | `PinnedMap` 생성 및 파이프라인 통합 | `passes/types.ts` |
| 4-3 | `@overrides` DSL 직렬화 | `compiler/serializer.ts` (신규) |
| 4-4 | 예산 조정 API (드래그 → pinned 전환) | `editor/budget-editor.ts` (신규) |
| 4-5 | 서브트리 선택적 재컴파일 | `compiler/incremental.ts` (신규) |
| 4-6 | Detach 모드 | `editor/detach.ts` (신규) |

---

## 10. 영향받는 파일 목록

### 신규
- `packages/core/src/compiler/passes/types.ts`
- `packages/core/src/compiler/passes/compute-constraints.ts`
- `packages/core/src/compiler/passes/pre-allocate.ts`
- `packages/core/src/compiler/intents/base.ts`
- `packages/core/src/compiler/serializer.ts` *(Phase 4)*
- `packages/core/src/compiler/incremental.ts` *(Phase 4)*
- `packages/editor/src/budget-editor.ts` *(Phase 4)*
- `packages/editor/src/detach.ts` *(Phase 4)*

### 수정
- `packages/core/src/compiler/parser.ts` — @overrides 파싱 추가
- `packages/core/src/compiler/passes/measure.ts` — budgetMap 파라미터 추가
- `packages/core/src/compiler/passes/emit-ir.ts` — 2-pass 파이프라인 삽입
- `packages/core/src/compiler/passes/allocate-bounds.ts` — pinned 처리, tree/flow 크기 변경
- `packages/core/src/compiler/layout/tree-layout.ts` — space-filling
- `packages/core/src/compiler/layout/flow-layout.ts` — cross축 space-filling
- `rules/specifics/S-compiler.md` — 패스 순서 업데이트

---

## 11. 설계 결정 근거

### Q: 왜 반복 수렴(iterative convergence)이 아닌 2-pass인가?

반복 수렴은 수렴 보장이 어렵고 레이아웃 알고리즘이 매 반복마다 다른 결과를 낼 수 있다. 2-pass는 방향이 명확하고(bottom-up → top-down), 1회 통과로 예측 가능한 결과를 보장한다.

### Q: 브라우저 렌더링 엔진과 무엇이 다른가?

브라우저의 `flex`, `grid`는 배치 규칙이다. "이건 파이프라인이야", "이건 조직도야"라는 의미가 없다. Depix의 의도는 의미 덩어리이고, 배치는 그 의미에서 추론된다. 브라우저는 의도가 고정되어 있고, Depix는 의도가 계속 추가된다. 의도 안에 의도가 중첩될 때의 예산 협상은 브라우저의 intrinsic sizing보다 훨씬 복잡한 의미 수준에서 이루어진다.

### Q: @overrides를 별도 블록으로 분리한 이유는?

DSL 본문은 의미(구조, 연결, 의도)만 담고, @overrides는 시각적 고정값만 담는다. 이 분리 덕분에 LLM은 DSL 본문만 읽고 수정하면 되고 @overrides는 건드릴 이유가 없다. 또한 @overrides 블록을 제거하면 원래 의도 기반 레이아웃으로 완전히 복원된다.

### Q: BoundsMap을 내부적으로 항상 유지하는 이유는?

렌더링에 필요한 좌표는 컴파일러가 계산했든 사용자가 고정했든 항상 완전히 존재해야 한다. 이 구조 덕분에 렌더러는 pinned 여부를 모르고 그냥 그리면 되고, @overrides는 BoundsMap 중 pinned: true인 것만 직렬화한 뷰에 불과하다. 내부 모델이 하나로 통일된다.

### Q: DSL에서 font-size 같은 스타일 속성을 완전히 제거하면 안 되나?

제거하면 "강조"를 표현할 방법이 없어진다. `emphasis: high` 같은 Depix 전용 문법으로 대체할 수 있지만, LLM은 CSS 유사 문법(`font-size: xl`)을 수십억 개의 예제로 학습했기 때문에 더 자연스럽게 생성한다. 따라서 시맨틱 사이즈 토큰을 유지하되 컴파일러가 이를 절대 크기가 아닌 예산 weight 힌트로 해석한다. LLM이 쓰기 쉬운 문법을 의미론적으로 재해석하는 것은 컴파일러의 몫이다.

### Q: 자식 min 합계가 부모 예산을 초과하면?

비례 축소(proportional shrink)로 처리한다. 모든 자식을 동등하게 희생시키며, 특정 자식을 우선하는 것보다 예측 가능하다. 정상 시나리오에서는 발생하지 않아야 하며, 이 경우가 빈번하다면 해당 의도의 min 계산 로직을 검토해야 한다.

### Q: pinned 노드에 연결된 엣지는 어떻게 처리하나?

엣지 경로는 @overrides에 저장하지 않는다. 노드 위치가 pinned로 확정된 후 연결된 엣지는 항상 재라우팅한다. 엣지 경로는 노드 위치의 함수이므로 별도로 고정할 이유가 없다.
