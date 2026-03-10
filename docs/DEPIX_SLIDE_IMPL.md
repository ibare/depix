# Depix Scene 지원 구현 명세

> Depix 컴파일러에 씬 DSL을 추가한다.
> 기존 인프라(Budget System, IR, Renderer)는 변경하지 않는다.
> 새로 추가되는 것은 파서, 씬 의도, 콘텐츠 노드, 테마 시스템이다.

---

## 1. 추가되는 것 / 변경되는 것

### 추가
- 프레젠테이션 선언 파싱 (`@presentation`, `@theme`, `@ratio`)
- `scene` 컨테이너 의도
- 씬 레이아웃 의도 8종
- 콘텐츠 노드 5종 (`heading`, `label`, `bullet`, `stat`, `quote`)
- 테마 시스템 (`packages/core/src/theme/`)

### 변경 없음
- Budget System (ConstraintMap, BudgetMap, BoundsMap)
- IR 스펙
- Renderer
- 기존 다이어그램 의도 (flow, tree, stack, grid, layers, group)

---

## 2. DSL 문법

### 2.1 프레젠테이션 선언

```depix
@presentation
@theme default
@ratio 16:9
```

`@presentation`이 선언된 파일은 씬 모드로 컴파일된다.
선언이 없으면 기존 다이어그램 모드로 동작한다. (하위 호환)

### 2.2 scene 컨테이너

```depix
scene "scene-id" {
  layout: bullets

  heading "제목"
  bullet {
    item "항목 1"
    item "항목 2"
  }
}
```

- `scene`은 고정된 캔버스 크기(`@ratio` 기준)의 독립된 페이지다.
- `layout`은 필수. 컴파일러가 내부 콘텐츠 배치 방식을 결정한다.
- 각 `scene`은 독립적으로 컴파일되어 별도의 IR을 생성한다.

### 2.3 레이아웃 의도 8종

| 의도 | 설명 |
|------|------|
| `title` | 표지, 섹션 구분. 중앙 정렬, 큰 제목 |
| `statement` | 핵심 메시지 하나. 한 문장 크게 |
| `bullets` | 제목 + 요점 목록 |
| `two-column` | 좌우 2분할 |
| `three-column` | 3분할 |
| `big-number` | 숫자/지표 강조 |
| `quote` | 인용문 중앙 배치 |
| `custom` | 기존 인프라 직접 구성 (layout 선언 생략 시 기본값) |

### 2.4 콘텐츠 노드

#### heading

```depix
heading "AI가 바꾸는 업무 방식"
heading "소제목" { level: 2 }
```

- `level: 1` (기본): 씬 메인 제목
- `level: 2`: 소제목

#### label

```depix
label "2025 전략 보고"
label "출처: McKinsey, 2024" { size: sm }
```

부제목, 캡션, 보조 설명에 사용한다.

#### bullet

```depix
bullet {
  item "항목 하나"
  item "항목 둘"
  item "중첩 가능한 항목" {
    item "하위 항목"
    item "하위 항목"
  }
}
```

#### stat

```depix
stat "340%"  { label: "생산성 향상" }
stat "-40%"  { label: "운영 비용" color: success }
```

`label`은 필수다. 숫자만 단독으로 쓰지 않는다.

#### quote

```depix
quote "속도보다 중요한 것은 방향이다." {
  attribution: "Peter Drucker"
}
```

---

## 3. 레이아웃 의도별 배치 계약

컴파일러가 각 레이아웃에서 콘텐츠를 어떻게 배치하는지 정의한다.
모든 배치는 기존 Budget System을 통해 계산된다.

### title

```
씬 전체를 stack direction:col 로 구성
  상단 여백: 30%
  heading (level: 1): 중앙 정렬, 큰 폰트
  label들: heading 아래, 작은 폰트
  하단 여백: 20%
```

허용 콘텐츠: `heading` 1개, `label` 0~2개
그 외 콘텐츠가 있으면 컴파일 경고.

### statement

```
씬 전체를 수직 중앙 정렬
  heading: 중앙, 큰 폰트, 최대 2줄
  label: heading 아래, 작은 폰트
```

허용 콘텐츠: `heading` 1개, `label` 0~1개

### bullets

```
stack direction:col
  heading: 상단, 테마의 heading 높이 고정
  divider (선택적): 테마에 따라
  bullet: 나머지 공간 전체
    item들: 균등 분배
```

허용 콘텐츠: `heading` 1개, `bullet` 1개, `label` 0~1개

### two-column / three-column

```
stack direction:col
  heading: 상단
  grid cols:2 (또는 cols:3): 나머지 공간
    각 column: stack direction:col
      column 제목 (heading level:2): 고정 높이
      column 내용: 나머지
```

허용 콘텐츠: `heading` 1개, `column` 2개 (또는 3개)
`column` 내부에는 `heading`, `bullet`, `stat`, `label` 허용

### big-number

```
stack direction:col
  heading: 상단
  grid cols:(stat 수): 나머지 공간
    각 stat: 중앙 정렬
      숫자: 큰 폰트
      label: 숫자 아래, 작은 폰트
```

허용 콘텐츠: `heading` 1개, `stat` 1~4개

### quote

```
씬 전체 수직 중앙 정렬
  인용 기호 (렌더러가 자동 추가)
  quote 텍스트: 중앙, 큰 폰트, 이탤릭
  attribution: 텍스트 아래 우측, 작은 폰트
  label: attribution 아래
```

허용 콘텐츠: `quote` 1개, `label` 0~1개

### custom

레이아웃 배치를 컴파일러가 결정하지 않는다.
기존 다이어그램 의도(`stack`, `grid`, `layers`, `flow` 등)를 직접 구성한다.

```depix
scene "arch" {
  layout: custom

  stack direction:col {
    heading "시스템 구조"
    layers {
      layer "Frontend"
      layer "Backend"
      layer "Database"
    }
  }
}
```

---

## 4. 테마 시스템

### 4.1 테마가 결정하는 것

```typescript
interface SceneTheme {
  // 색상
  colors: {
    background: string;
    surface: string;       // 카드, 컨테이너 배경
    primary: string;
    text: string;
    textMuted: string;
    accent: string;
  };

  // 타이포그래피
  typography: {
    headingFont: string;
    bodyFont: string;
    headingSize: number;   // 기준 크기, Budget System이 실제값 결정
    bodySize: number;
    statSize: number;
  };

  // 레이아웃
  layout: {
    scenePadding: number;       // 씬 외곽 여백 (%)
    columnGap: number;          // 컬럼 간격 (%)
    itemGap: number;            // bullet item 간격 (%)
    headingHeight: number;      // heading 영역 고정 높이 (%)
  };

  // 정보 밀도 힌트 (LLM 프롬프트용, 컴파일러는 사용 안 함)
  density: {
    bulletItemsMax: number;
    statCountMax: number;
  };
}
```

### 4.2 초기 테마: default

```typescript
const defaultTheme: SceneTheme = {
  colors: {
    background: '#FFFFFF',
    surface:    '#F8F9FA',
    primary:    '#1A1A2E',
    text:       '#1A1A2E',
    textMuted:  '#6B7280',
    accent:     '#4F46E5',
  },
  typography: {
    headingFont: 'Inter',
    bodyFont:    'Inter',
    headingSize: 1.0,    // 기준값, Budget이 실제 px 결정
    bodySize:    0.6,
    statSize:    2.0,
  },
  layout: {
    scenePadding:  8,
    columnGap:     4,
    itemGap:       2,
    headingHeight: 18,
  },
  density: {
    bulletItemsMax: 5,
    statCountMax:   3,
  },
};
```

---

## 5. 파일 구조

### 신규
```
packages/core/src/
  compiler/
    intents/
      scene/
        scene-container.ts      ← scene 컨테이너 의도
        layouts/
          title-layout.ts
          statement-layout.ts
          bullets-layout.ts
          two-column-layout.ts
          three-column-layout.ts
          big-number-layout.ts
          quote-layout.ts
    nodes/
      heading-node.ts           ← heading 콘텐츠 노드
      label-node.ts
      bullet-node.ts
      stat-node.ts
      quote-node.ts
  theme/
    types.ts                    ← SceneTheme 인터페이스
    default.ts                  ← default 테마
    index.ts
```

### 수정
```
packages/core/src/
  compiler/
    parser.ts     ← @presentation, @theme, @ratio, scene, 콘텐츠 노드 파싱
    emit-ir.ts    ← 씬 모드 분기 (scene[]으로 IR 배열 생성)
```

---

## 6. IR 변경

씬 모드에서 IR은 단일 객체가 아니라 배열로 생성된다.

```typescript
// 기존 (다이어그램 모드)
type DepixIR = IRScene;

// 씬 모드
type DepixIR = IRScene[];  // 씬 수만큼 IRScene 배열

interface IRScene {
  width: number;
  height: number;
  nodes: IRNode[];
  edges: IREdge[];
}
```

Renderer는 `IRScene[]`을 받아 씬 수만큼 페이지를 렌더링한다.
기존 단일 `IRScene` 렌더링 로직은 변경 없이 각 페이지에 반복 적용된다.

---

## 7. 구현 순서

### Phase 1 — 파서 + 기본 레이아웃

1. `@presentation`, `@theme`, `@ratio` 파싱
2. `scene` 컨테이너 파싱
3. 콘텐츠 노드 파싱 (`heading`, `label`, `bullet`, `stat`, `quote`)
4. `title`, `statement`, `bullets` 레이아웃 구현
5. default 테마 정의
6. IR 배열 생성 및 Renderer 연결

**완료 기준**: 3장짜리 씬(title + bullets + statement)이 렌더링된다.

### Phase 2 — 컬럼 레이아웃 + 나머지

1. `two-column`, `three-column` 레이아웃 구현
2. `big-number`, `quote` 레이아웃 구현
3. `custom` 레이아웃 (기존 인프라 위임)

**완료 기준**: 전체 예제 5장 씬이 렌더링된다.
