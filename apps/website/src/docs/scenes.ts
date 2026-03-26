// synced_with: 'scenes@81801997'

export const scenes = {
  id: 'scenes',
  title: 'Scenes & Layouts',
  titleKo: '씬과 레이아웃',
  content: `
## What is a Scene?

A **scene** is a single visual page in your Depix document — think of it as one slide in a presentation or one page in a report. Each scene has its own layout and content, and you can define as many scenes as you need.

\`\`\`depix
scene "Welcome" {
  layout: center
  body: heading "Hello, Depix!" bold
}

scene "Details" {
  layout: header
  header: heading "What We Built"
  body: bullet ["Fast compiler", "14 layout presets", "Rich element library"]
}
\`\`\`

---

## Slot-Based Layout System

Every scene uses a **slot-based layout** to arrange its content. You pick a layout preset, and the preset defines named **slots** — reserved areas on the canvas where you place your content.

This approach keeps things simple: choose a preset, fill in the slots, and Depix handles all the sizing and positioning for you.

---

## Layout Presets

Depix provides **14 layout presets** covering the most common visual arrangements:

| Preset | Available Slots | Description |
|--------|----------------|-------------|
| \`full\` | body | Single area filling the entire canvas |
| \`center\` | body | Content centered with padding |
| \`split\` | left, right | Vertical split — two columns side by side |
| \`rows\` | top, bottom | Horizontal split — two rows stacked |
| \`sidebar\` | main, side | Primary content area with a narrower sidebar |
| \`header\` | header, body | Top header strip with a body area below |
| \`header-split\` | header, left, right | Header on top, two columns below |
| \`header-rows\` | header, top, bottom | Header on top, two rows below |
| \`header-sidebar\` | header, main, side | Header on top, sidebar layout below |
| \`grid\` | cell (repeatable) | Uniform grid — auto-arranged cells |
| \`header-grid\` | header, cell (repeatable) | Header on top, grid of cells below |
| \`focus\` | focus, cell (repeatable) | One large focal area with smaller cells alongside |
| \`header-focus\` | header, focus, cell (repeatable) | Header, focal area, and smaller cells |
| \`custom\` | cell (repeatable) | Simple vertical stack — a flexible fallback |

---

## Slot Names Reference

Each slot name has a specific role. You can only use slots that your chosen preset supports:

| Slot | Role | Used In |
|------|------|---------|
| \`header\` | Fixed-height top section for titles | header, header-split, header-rows, header-sidebar, header-grid, header-focus |
| \`body\` | Main content area | full, center, header |
| \`left\` | Left column | split, header-split |
| \`right\` | Right column | split, header-split |
| \`top\` | Top row | rows, header-rows |
| \`bottom\` | Bottom row | rows, header-rows |
| \`main\` | Primary content area | sidebar, header-sidebar |
| \`side\` | Secondary sidebar area | sidebar, header-sidebar |
| \`focus\` | Large focal area for featured content | focus, header-focus |
| \`cell\` | Repeatable grid cell (use multiple times) | grid, header-grid, focus, header-focus, custom |

> **Note:** The \`cell\` slot is the only slot that can appear more than once. All other slot names must be unique within a scene.

---

## Scene Properties

You can configure a scene's layout behavior with these properties, placed directly inside the scene block:

\`\`\`depix
scene "Configurable" {
  layout: split         // which preset to use
  ratio: 0.4            // split ratio (0.0 to 1.0) — adjusts column/row proportions
  direction: left       // sidebar direction (for sidebar-based presets)
}
\`\`\`

| Property | Values | Default | Description |
|----------|--------|---------|-------------|
| \`layout\` | Any preset name | \`full\` | Determines the slot arrangement |
| \`ratio\` | \`0.0\` – \`1.0\` | \`0.5\` (split/rows), \`0.7\` (sidebar) | Controls the size balance between split areas |
| \`direction\` | \`left\`, \`right\` | \`right\` | Which side the sidebar appears on |

---

## Slot Assignment

Assign content to a slot using \`slotName: content\` syntax. The content can be any element or block:

\`\`\`depix
scene "Dashboard" {
  layout: header-split
  header: heading "Monthly Report"
  left: stat "89%" { label: "Uptime" }
  right: flow {
    node "Collect" #a
    node "Analyze" #b
    node "Report" #c
    #a -> #b -> #c
  }
}
\`\`\`

For grid-based layouts, repeat the \`cell\` slot for each item:

\`\`\`depix
scene "Team" {
  layout: grid
  cell: stat "Alice" { label: "Design" }
  cell: stat "Bob" { label: "Engineering" }
  cell: stat "Carol" { label: "Product" }
  cell: stat "Dave" { label: "Marketing" }
}
\`\`\`

---

## Tips: Choosing the Right Layout

- **Single content block?** Use \`full\` or \`center\`.
- **Title slide or section header?** Use \`header\` with a heading in the header slot.
- **Comparing two things side by side?** Use \`split\` or \`header-split\`.
- **Showing multiple metrics?** Use \`grid\` or \`header-grid\` with stat cells.
- **One hero item plus supporting items?** Use \`focus\` or \`header-focus\`.
- **Need a navigation or info panel?** Use \`sidebar\` or \`header-sidebar\`.
- **Just stacking content vertically?** Use \`custom\` as a simple fallback.
  `,
  contentKo: `
## 씬이란?

**씬(Scene)**은 Depix 문서의 하나의 시각적 페이지입니다. 프레젠테이션의 슬라이드, 보고서의 한 페이지라고 생각하면 됩니다. 각 씬은 독립적인 레이아웃과 콘텐츠를 가지며, 필요한 만큼 자유롭게 추가할 수 있습니다.

\`\`\`depix
scene "Welcome" {
  layout: center
  body: heading "Hello, Depix!" bold
}

scene "Details" {
  layout: header
  header: heading "What We Built"
  body: bullet ["Fast compiler", "14 layout presets", "Rich element library"]
}
\`\`\`

---

## 슬롯 기반 레이아웃 시스템

모든 씬은 **슬롯 기반 레이아웃**으로 콘텐츠를 배치합니다. 레이아웃 프리셋을 선택하면 해당 프리셋이 정의한 **슬롯**(이름이 붙은 영역)이 캔버스 위에 할당되고, 각 슬롯에 콘텐츠를 넣으면 됩니다.

프리셋을 고르고 슬롯을 채우기만 하면, 크기 조정과 배치는 Depix가 알아서 처리합니다.

---

## 레이아웃 프리셋

Depix는 다양한 시각 구성을 커버하는 **14가지 레이아웃 프리셋**을 제공합니다:

| 프리셋 | 사용 가능한 슬롯 | 설명 |
|--------|----------------|------|
| \`full\` | body | 캔버스 전체를 채우는 단일 영역 |
| \`center\` | body | 여백과 함께 중앙 배치 |
| \`split\` | left, right | 좌우 2단 분할 |
| \`rows\` | top, bottom | 상하 2단 분할 |
| \`sidebar\` | main, side | 본문 + 사이드바 구성 |
| \`header\` | header, body | 상단 헤더 + 하단 본문 |
| \`header-split\` | header, left, right | 헤더 + 좌우 2단 |
| \`header-rows\` | header, top, bottom | 헤더 + 상하 2단 |
| \`header-sidebar\` | header, main, side | 헤더 + 사이드바 레이아웃 |
| \`grid\` | cell (반복 가능) | 균일 그리드 — 셀 자동 배치 |
| \`header-grid\` | header, cell (반복 가능) | 헤더 + 그리드 |
| \`focus\` | focus, cell (반복 가능) | 대형 포커스 영역 + 보조 셀 |
| \`header-focus\` | header, focus, cell (반복 가능) | 헤더 + 포커스 + 보조 셀 |
| \`custom\` | cell (반복 가능) | 단순 세로 나열 — 범용 폴백 |

---

## 슬롯 이름 참조

각 슬롯 이름에는 고유한 역할이 있습니다. 선택한 프리셋이 지원하는 슬롯만 사용할 수 있습니다:

| 슬롯 | 역할 | 사용되는 프리셋 |
|------|------|----------------|
| \`header\` | 제목용 고정 높이 상단 영역 | header 계열 프리셋 |
| \`body\` | 주요 콘텐츠 영역 | full, center, header |
| \`left\` | 왼쪽 칼럼 | split, header-split |
| \`right\` | 오른쪽 칼럼 | split, header-split |
| \`top\` | 위쪽 행 | rows, header-rows |
| \`bottom\` | 아래쪽 행 | rows, header-rows |
| \`main\` | 주요 콘텐츠 영역 | sidebar, header-sidebar |
| \`side\` | 보조 사이드바 영역 | sidebar, header-sidebar |
| \`focus\` | 주목 콘텐츠를 위한 대형 영역 | focus, header-focus |
| \`cell\` | 반복 가능한 그리드 셀 | grid, header-grid, focus, header-focus, custom |

> **참고:** \`cell\` 슬롯만 여러 번 사용할 수 있습니다. 나머지 슬롯은 씬 안에서 한 번만 선언해야 합니다.

---

## 씬 속성

씬 블록 안에서 다음 속성을 사용하여 레이아웃 동작을 조정할 수 있습니다:

\`\`\`depix
scene "Configurable" {
  layout: split         // 사용할 프리셋
  ratio: 0.4            // 분할 비율 (0.0 ~ 1.0) — 칼럼/행 비율 조정
  direction: left       // 사이드바 방향 (sidebar 계열 프리셋)
}
\`\`\`

| 속성 | 값 | 기본값 | 설명 |
|------|-----|--------|------|
| \`layout\` | 프리셋 이름 | \`full\` | 슬롯 배치 방식 결정 |
| \`ratio\` | \`0.0\` – \`1.0\` | \`0.5\` (split/rows), \`0.7\` (sidebar) | 분할 영역 간 비율 제어 |
| \`direction\` | \`left\`, \`right\` | \`right\` | 사이드바 위치 방향 |

---

## 슬롯에 콘텐츠 할당하기

\`슬롯이름: 콘텐츠\` 문법으로 슬롯에 콘텐츠를 배치합니다. 콘텐츠는 어떤 요소든 블록이든 가능합니다:

\`\`\`depix
scene "Dashboard" {
  layout: header-split
  header: heading "Monthly Report"
  left: stat "89%" { label: "Uptime" }
  right: flow {
    node "Collect" #a
    node "Analyze" #b
    node "Report" #c
    #a -> #b -> #c
  }
}
\`\`\`

그리드 기반 레이아웃에서는 \`cell\` 슬롯을 반복하여 각 항목을 배치합니다:

\`\`\`depix
scene "Team" {
  layout: grid
  cell: stat "Alice" { label: "Design" }
  cell: stat "Bob" { label: "Engineering" }
  cell: stat "Carol" { label: "Product" }
  cell: stat "Dave" { label: "Marketing" }
}
\`\`\`

---

## 팁: 어떤 레이아웃을 선택할까?

- **콘텐츠가 하나뿐?** \`full\` 또는 \`center\`를 사용하세요.
- **타이틀 슬라이드나 섹션 구분?** \`header\`에 heading을 넣으세요.
- **두 가지를 나란히 비교?** \`split\` 또는 \`header-split\`이 적합합니다.
- **여러 지표를 보여줄 때?** \`grid\` 또는 \`header-grid\`에 stat 셀을 나열하세요.
- **하나의 핵심 항목 + 보조 항목?** \`focus\` 또는 \`header-focus\`를 사용하세요.
- **네비게이션이나 정보 패널이 필요?** \`sidebar\` 또는 \`header-sidebar\`가 좋습니다.
- **단순히 콘텐츠를 세로로 나열?** \`custom\`을 범용 폴백으로 활용하세요.
  `,
};
