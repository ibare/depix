# Depix

**선언적 다이어그램 DSL + 위지윅 에디터**

DSL 텍스트로 다이어그램을 선언하면 컴파일러가 레이아웃을 자동 계산하고 캔버스에 렌더링한다. LLM이 좌표 없이 구조만 기술해도 아름다운 다이어그램이 생성된다.

---

## 핵심 컨셉

```
DSL v2 텍스트  →  Compiler  →  DepixIR  →  Renderer
  (의미 기술)     (레이아웃 계산)  (완전 해결)   (그리기만)
```

- **DSL**: `flow`, `stack`, `grid`, `tree`, `layers` 등 시맨틱 레이아웃 프리미티브로 구조를 기술한다. 좌표를 직접 지정하지 않는다.
- **Compiler**: DSL을 파싱하고 테마를 해석하고 레이아웃을 계산해 모든 값이 해결된 IR을 생성한다.
- **DepixIR**: 모든 좌표, 색상, 경로가 확정된 JSON 문서. 렌더러와 에디터의 공통 데이터 계약.
- **Renderer**: IR을 받아 Konva 캔버스에 그리기만 한다.

---

## DSL 예제

### Flow 다이어그램

```depix
@page 16:9

flow direction:right {
  node "Light Reaction" #light { color: yellow }
  node "Calvin Cycle" #dark  { color: green }
  node "Glucose"      #out   { shape: diamond, color: success }

  #light -> #dark "ATP + NADPH"
  #dark  -> #out  "C6H12O6"
}
```

### 조직도 (Tree)

```depix
@page 16:9

tree direction:down {
  node "CEO" {
    node "CTO" {
      node "Frontend"
      node "Backend"
      node "Infra"
    }
    node "CFO" {
      node "Accounting"
      node "Finance"
    }
  }
}
```

### 비교표 (Grid)

```depix
@page 16:9

grid cols:3 {
  cell ""           { header }
  cell "React"      { header }
  cell "Vue"        { header }

  cell "학습 곡선"  { header }
  cell "중간"       { color: warning }
  cell "쉬움"       { color: success }

  cell "생태계"     { header }
  cell "매우 넓음"  { color: success }
  cell "넓음"       { color: info }
}
```

### 아키텍처 레이어 (Layers)

```depix
@page 16:9

layers {
  layer "Frontend"       { color: blue }
  layer "API Gateway"    { color: accent }
  layer "Microservices"  { color: green }
  layer "Database"       { color: orange }
}
```

### 멀티 씬 프레젠테이션

```depix
@page 16:9

scene "Overview" {
  flow direction:right {
    node "Plan" #a
    node "Build" #b
    node "Ship"  #c
    #a -> #b -> #c
  }
}

scene "Details" {
  stack direction:row gap:lg {
    box "Plan"  { color: primary  list ["Requirements" "Design"] }
    box "Build" { color: info     list ["Develop" "Test"] }
    box "Ship"  { color: success  list ["Deploy" "Monitor"] }
  }
}
```

---

## 레이아웃 프리미티브

| 프리미티브 | 용도 |
|-----------|------|
| `flow` | 방향성 있는 흐름 — 플로우차트, 파이프라인 |
| `stack` | 수직/수평 나열 — 목록, 비교 배치 |
| `grid` | 행렬 배치 — 비교표, 매트릭스 |
| `tree` | 계층 구조 — 조직도, 분류 체계 |
| `group` | 시각적 그룹핑 — 영역 구분 |
| `layers` | 수직 레이어 — 아키텍처 스택 |

---

## 시맨틱 토큰

LLM이 구체적 수치를 몰라도 의도를 표현할 수 있도록 시맨틱 토큰을 제공한다. 컴파일 시 테마에 따라 구체 값으로 해석된다.

| 종류 | 토큰 |
|------|------|
| 간격 | `xs` `sm` `md` `lg` `xl` |
| 색상 | `primary` `secondary` `accent` `success` `warning` `danger` `info` `muted` |
| 폰트 크기 | `xs` `sm` `md` `lg` `xl` `2xl` `3xl` |
| 그림자 | `none` `sm` `md` `lg` |
| 모서리 | `none` `sm` `md` `lg` `full` |

---

## 아키텍처

### 컴파일러 파이프라인

```
DSL v2 텍스트
    │
    ▼
┌───────────────────┐
│  Tokenize + Parse │  텍스트 → AST
└────────┬──────────┘
         ▼
┌───────────────────┐
│ Flatten Hierarchy  │  중첩 tree/flow → flat children + implicit edges
└────────┬──────────┘
         ▼
┌───────────────────┐
│  Resolve Theme    │  시맨틱 토큰 → 구체 값 (color: warning → #F59E0B)
└────────┬──────────┘
         ▼
┌───────────────────┐
│  Plan Layout      │  구조 분석 — 가중치, 깊이, 분기 수 산출
└────────┬──────────┘
         ▼
┌───────────────────┐
│  Scale System     │  baseUnit = √(캔버스면적 / 요소수) × 0.55
└────────┬──────────┘
         ▼  ── 2-pass 예산 시스템 ──
┌───────────────────┐
│  Compute          │  ↑ Bottom-up: 자식 → 부모 방향으로
│  Constraints      │    각 노드의 min/max 크기 제약 수집
└────────┬──────────┘  ConstraintMap
         ▼
┌───────────────────┐
│  Allocate         │  ↓ Top-down: 캔버스 루트 → 자식 방향으로
│  Budgets          │    가용 공간을 weight 비례 배분
└────────┬──────────┘  BudgetMap
         ▼
┌───────────────────┐
│  Measure          │  확정된 예산 기반으로 fontSize, padding,
│                   │  lineHeight, minWidth, minHeight 결정
└────────┬──────────┘  MeasureMap
         ▼  ── 좌표 확정 ──
┌───────────────────┐
│  Allocate Bounds  │  measure 제약 + 레이아웃 알고리즘으로 최종 좌표 확정
└────────┬──────────┘  BoundsMap
         ▼
┌───────────────────┐
│  Route Edges      │  노드 좌표 기반 연결선 경로 계산
└────────┬──────────┘
         ▼
┌───────────────────┐
│  Emit IR          │  모든 값이 확정된 DepixIR JSON 생성
└───────────────────┘
         ▼
      DepixIR  →  Renderer (Konva)
```

#### 컴파일러 패스 순서 (13패스)

| # | 패스 | 입력 | 출력 | 역할 |
|---|------|------|------|------|
| 1 | Tokenize | DSL 텍스트 | Token[] | 어휘 분석 |
| 2 | Parse | Token[] | AST | 구문 분석 |
| 3 | Flatten Hierarchy | AST | AST (정규화) | tree/flow의 중첩 요소를 flat children + implicit edges로 변환 |
| 4 | Resolve Theme | AST + Theme | AST (해결) | 시맨틱 토큰(`primary`, `md`) → HEX/수치 |
| 5 | Plan Layout | AST | SceneLayoutPlan | 가중치, 깊이, 자식 수, 의도별 타입 분석 |
| 6 | Scale System | Plan + Canvas | ScaleContext | `baseUnit` 산출, 동적 gap/font/padding 비율 결정 |
| 7 | Compute Constraints | Plan + ScaleCtx | ConstraintMap | Bottom-up: 각 노드의 min/max 크기 수집 |
| 8 | Allocate Budgets | Plan + Canvas + Constraints + ScaleCtx | BudgetMap | Top-down: 가용 공간을 weight 비례 배분 |
| 9 | Measure | Plan + Theme + ScaleCtx + BudgetMap | MeasureMap | 예산 기반 fontSize, padding, minHeight 산출 |
| 10 | Allocate Bounds | Plan + Canvas + MeasureMap + ScaleCtx | BoundsMap | 레이아웃 알고리즘 실행, 최종 좌표 확정 |
| 11 | Layout | LayoutChildren + Config | LayoutResult | flow/stack/grid/tree/layers/group 배치 |
| 12 | Route Edges | BoundsMap + 엣지 정의 | IREdge[] | 연결선 경로 포인트 계산 |
| 13 | Emit IR | AST + BoundsMap + ScaleCtx + MeasureMap | DepixIR | 완전 해결된 IR JSON 생성 |

> 각 패스는 **순수 함수**다. 전역 상태를 읽지 않고, 같은 입력에 항상 같은 출력을 반환한다.

#### 2-pass 예산 시스템

fontSize를 결정하려면 할당 공간이 필요하고, 공간을 할당하려면 fontSize(→ minHeight)가 필요하다. 이 순환 의존을 2-pass로 해소한다.

```
Pass 1 — Compute Constraints (Bottom-up)
  자식이 "나는 최소 X, 최대 Y가 필요해"를 부모에게 보고
  → ConstraintMap = Map<id, { minWidth, maxWidth, minHeight, maxHeight }>

Pass 2 — Allocate Budgets (Top-down)
  부모가 제약 안에서 예산을 weight 비례로 배분
  → BudgetMap = Map<id, { width, height }>

Measure — 확정된 예산으로 fontSize 결정
  budget의 shortSide(= min(width, height))로 fontSize 산출
  → 요소가 많을수록 예산 축소 → fontSize 자동 축소 → 오버플로우 방지
```

의도별 예산 배분 전략:

| 의도 | 배분 축 | 전략 |
|------|---------|------|
| `stack col` | height 분할 | weight 비례, width는 부모 전체 |
| `stack row` | width 분할 | weight 비례, height는 부모 전체 |
| `grid` | 양축 균등 | `(width / cols)` × `(height / rows)` |
| `layers` | height 균등 | 모든 레이어에 동일 높이 |
| `group` | height 분할 | padding 차감 후 weight 비례 |
| `tree` | main축 레벨, cross축 span | subtreeSpan(리프 수) 비례 cross-axis 배분 |
| `flow` | main축 레이어 | 콘텐츠 복잡도(measure) 비례 레이어 사이징 |

오버플로우 처리: 자식 min 합계 > 부모 예산일 때, `redistributeWithMinimums`가 비례 축소하여 모든 요소가 캔버스 내에 표시되도록 보장한다.

### 패키지 의존 구조

```
@depix/core          ← 의존성 없음 (DSL, IR 타입, 컴파일러, 테마, 레이아웃)
@depix/engine        ← core (Konva 렌더러, 좌표 변환, PNG 내보내기)
@depix/editor        ← core, engine (선택, 히스토리, 핸들, 스냅, IR 조작, 시맨틱 편집)
@depix/react         ← core, engine, editor (React 컴포넌트, 훅, TipTap 통합)
```

### IR 요소 타입

IR은 7가지 discriminated union 타입으로 구성된다.

| 타입 | 설명 |
|------|------|
| `shape` | 도형 (rect, circle, diamond, hexagon 등 8종) |
| `text` | 텍스트 블록 |
| `line` | 직선 |
| `edge` | 연결선 (경로 포인트, 화살표, 라벨 포함) |
| `container` | 자식 요소를 포함하는 컨테이너 |
| `image` | 이미지 |
| `path` | SVG 패스 |

모든 요소는 `id`, `bounds` (0–100 상대 좌표), `style`, 타입별 필드를 가진다.

---

## 모노레포 구조

```
depix/
├── packages/
│   ├── core/      — IR 타입, 컴파일러, 테마, 레이아웃 알고리즘 (순수 TS, DOM 의존 없음)
│   ├── engine/    — Konva 렌더러, 좌표 변환, PNG 내보내기
│   ├── editor/    — 선택, 히스토리, 핸들, 스냅, IR 직접 조작
│   └── react/     — React 컴포넌트, 훅, TipTap 직렬화
├── apps/
│   └── demo/      — Vite + React 데모 앱
└── docs/          — 아키텍처, IR 스펙, DSL 문법, TODO
```

---

## 개발 환경

### 요구사항

- Node.js 18+
- pnpm 9+

### 설치

```bash
git clone https://github.com/your-org/depix.git
cd depix
pnpm install
```

### 빌드

```bash
pnpm build           # 전체 패키지 빌드
```

### 데모 앱 실행

```bash
pnpm --filter @depix/demo dev
```

브라우저에서 `http://localhost:5173`으로 접속한다.

데모 앱은 두 개의 탭으로 구성된다:
- **Gallery** — 카테고리별 DSL 예제 (flow, stack, grid, tree, layers, multi-scene)
- **Editor** — DSL 라이브 에디터 + 실시간 캔버스 미리보기 + IR JSON 뷰어

### 테스트

```bash
pnpm test                              # 전체 테스트
pnpm test:coverage                     # 커버리지 포함
pnpm --filter @depix/core test         # 단일 패키지
pnpm --filter @depix/core exec vitest run __tests__/compiler/tokenizer.test.ts  # 단일 파일
```

### 린트 / 타입 검사

```bash
pnpm lint
pnpm typecheck
```

---

## React 컴포넌트 사용

### DepixCanvas — 읽기 전용 뷰어

```tsx
import { DepixCanvas } from '@depix/react';

const dsl = `
  flow direction:right {
    node "A" #a
    node "B" #b
    #a -> #b
  }
`;

<DepixCanvas data={dsl} width={800} height={450} />
```

### DepixCanvasEditable — 편집 가능한 캔버스

```tsx
import { useState } from 'react';
import { compile } from '@depix/core';
import { DepixCanvasEditable } from '@depix/react';
import type { DepixIR } from '@depix/core';

function Editor() {
  const [ir, setIr] = useState<DepixIR>(() => compile(dsl).ir);

  return (
    <DepixCanvasEditable
      ir={ir}
      onIRChange={setIr}
      width={800}
      height={450}
    />
  );
}
```

### compile API

```ts
import { compile, lightTheme, darkTheme } from '@depix/core';

const { ir, errors } = compile(dsl, { theme: darkTheme });
```

---

## 에디터와 DSL의 관계

에디터는 IR을 직접 조작하므로 DSL의 표현 범위에 제약받지 않는다.

- DSL로 생성한 다이어그램을 에디터에서 자유롭게 수정할 수 있다.
- 에디터에서 수정한 결과는 IR로 저장된다. DSL로의 역변환은 제공하지 않는다.
- 시맨틱 레이아웃(flow, stack 등)의 제약에서 벗어나려면 **Detach** 기능을 사용한다. Figma의 "Remove Auto Layout"과 동일한 개념이다.

---

## 테스트 현황

| 패키지 | 테스트 수 | 커버리지 목표 |
|--------|----------|-------------|
| `@depix/core` | 1,021 | 90%+ |
| `@depix/engine` | 120 | 70%+ |
| `@depix/editor` | 315 | 80%+ |
| `@depix/react` | 299 | 60%+ |
| **합계** | **1,755** | |
