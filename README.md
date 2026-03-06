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

### 파이프라인

```
DSL v2 텍스트
    ↓  Tokenizer → Parser
   AST
    ↓  Resolve Theme → Plan Layout → Scale System → Allocate Bounds → Layout → Route Edges
  DepixIR  (모든 좌표, 색상, 경로가 확정된 JSON)
    ↓  CoordinateTransform → Konva 노드
  Canvas
```

#### 컴파일러 패스 순서

| 단계 | 입력 | 출력 |
|------|------|------|
| Parse | DSL 텍스트 | AST |
| Resolve Theme | AST + Theme | AST (시맨틱 토큰 → 구체값) |
| Plan Layout | AST | SceneLayoutPlan (가중치, 깊이 분석) |
| Scale System | Plan + Canvas | ScaleContext (baseUnit = √(면적/요소수) × 0.55) |
| Allocate Bounds | Plan + ScaleContext | BoundsMap (가중치 비례 공간 배분) |
| Layout | LayoutChildren + Config | LayoutResult (절대 좌표) |
| Route Edges | IR 요소들 + 엣지 정의 | IREdge[] (경로 포인트) |
| Emit IR | AST + BoundsMap + ScaleContext | DepixIR JSON |

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
| `@depix/core` | 839 | 90%+ |
| `@depix/engine` | 102 | 70%+ |
| `@depix/editor` | 315 | 80%+ |
| `@depix/react` | 299 | 60%+ |
| **합계** | **1,555** | |
