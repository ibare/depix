// synced_with: 'blocks@9e6eb226'

export const blocks = {
  id: 'blocks',
  title: 'Blocks',
  titleKo: '블록',
  content: `
## What Are Blocks?

Blocks are containers that hold and arrange elements. While elements are the atomic visual units, blocks provide **layout and grouping** — they determine how elements are positioned relative to each other.

Think of blocks as the structural skeleton of your visual. Each block type has its own layout algorithm and is designed for a specific kind of content arrangement.

---

## flow — Directed Graph / Flowchart

The \`flow\` block is used for directed graphs and flowcharts. Elements inside a \`flow\` block can be connected with edges (arrows) to show relationships and processes.

\`\`\`depix
flow {
  pill "Start"       #start
  diamond "Valid?"    #check
  rect "Process"     #process
  cylinder "Database" #db
  pill "End"         #end

  #start -> #check
  #check -> #process "Yes"
  #check --> #db "No"
  #process -> #end
  #db -> #end
}
\`\`\`

The layout engine automatically positions nodes and routes edges to minimize crossings.

**Direction:** Controls the primary flow direction. Set with \`direction\` property.
- \`right\` (default) — left-to-right flow
- \`left\` — right-to-left flow
- \`down\` — top-to-bottom flow
- \`up\` — bottom-to-top flow

> **Tip:** \`flow\` is the most versatile block type. Use it for process diagrams, state machines, decision trees, network diagrams, and any visual where elements have directional relationships.

---

## tree — Hierarchical Tree

The \`tree\` block displays hierarchical parent-child relationships. It shares edge syntax with \`flow\` but uses a tree layout algorithm that ensures clean hierarchical spacing.

\`\`\`depix
tree {
  node "CEO" #root
  node "CTO" #a
  node "CFO" #b
  node "VP Engineering" #c
  node "VP Finance" #d

  #root -> #a
  #root -> #b
  #a -> #c
  #b -> #d
}
\`\`\`

**Direction:** Controls which way the tree grows.
- \`down\` (default) — root at top, children below
- \`up\` — root at bottom, children above
- \`right\` — root at left, children to the right
- \`left\` — root at right, children to the left

> **Tip:** Use \`tree\` over \`flow\` when your data is strictly hierarchical (org charts, file systems, category taxonomies). The tree layout algorithm produces cleaner results for these structures.

---

## stack — Linear Layout

The \`stack\` block arranges elements in a single line — either vertically (column) or horizontally (row). It's the simplest layout block, ideal for linear sequences of content.

\`\`\`depix
stack direction:row {
  node "Step 1"
  node "Step 2"
  node "Step 3"
}
\`\`\`

**Direction:**
- \`col\` (default) — vertical stacking, top to bottom
- \`row\` — horizontal stacking, left to right

> **Tip:** \`stack\` is perfect for simple sequences, navigation bars, feature lists, or any content that flows in one direction without branching.

---

## grid — Uniform Grid

The \`grid\` block arranges elements in a uniform grid with a specified number of columns. Elements wrap to the next row automatically.

\`\`\`depix
grid cols:3 {
  node "1"
  node "2"
  node "3"
  node "4"
  node "5"
  node "6"
}
\`\`\`

**Key property:** \`cols\` — the number of columns in the grid.

> **Tip:** \`grid\` is great for feature grids, icon galleries, comparison matrices, or any content where items should be evenly distributed in rows and columns.

---

## layers — Stacked Layers

The \`layers\` block creates vertically stacked horizontal bands, commonly used for architecture diagrams. Each child \`layer\` block represents one tier.

\`\`\`depix
layers {
  layer "Frontend" {
    node "React"
    node "Next.js"
  }
  layer "Backend" {
    node "API Gateway"
    node "Auth Service"
  }
  layer "Data" {
    cylinder "PostgreSQL"
    cylinder "Redis"
  }
}
\`\`\`

The \`layers\` block automatically handles spacing between tiers and draws layer boundaries. It visually communicates that each tier sits "on top of" the one below.

> **Tip:** \`layers\` is purpose-built for technology stack diagrams, OSI model visualizations, and any architecture where you need to show distinct horizontal tiers.

---

## box — Styled Container

The \`box\` block is a container with visual styling — backgrounds, borders, and padding. Use it to visually group content within a styled region.

\`\`\`depix
box {
  background: primary
  heading "Section Title"
  text "Content inside a styled box"
}
\`\`\`

Unlike \`group\`, a \`box\` can have its own background color, making it useful for cards, callouts, and highlighted sections.

> **Tip:** Use \`box\` for cards in dashboards, highlighted callout areas, or any region that needs a distinct visual background to stand out from surrounding content.

---

## layer — Container with Zone Label

The \`layer\` block renders a bordered container with a category label in the top-left corner. It's designed for labeling zones or regions within a larger diagram.

\`\`\`depix
layer "Category Name" {
  node "Item A"
  node "Item B"
}
\`\`\`

The label is rendered as a small tag in the top-left corner of the container, clearly marking what the zone represents.

> **Tip:** Use \`layer\` inside a \`layers\` block for architecture diagrams, or standalone to mark labeled zones in any layout. Don't confuse \`layer\` (a container) with \`layers\` (the stacking layout).

---

## group — Simple Border Grouping

The \`group\` block draws a simple border around its children. It has no background, no label — just a visual boundary.

\`\`\`depix
group {
  node "Grouped A"
  node "Grouped B"
}
\`\`\`

> **Tip:** Use \`group\` when you want a subtle visual boundary without the styling of \`box\` or the label of \`layer\`. It's the lightest-weight container.

---

## table — Data Table

The \`table\` block displays data in a tabular row-column format. Rows are defined with the \`row\` element and a JSON-style array of values.

\`\`\`depix
table {
  row ["Name", "Age", "City"] header
  row ["Alice", 30, "Seoul"]
  row ["Bob", 25, "Tokyo"]
  row ["Charlie", 35, "London"]
}
\`\`\`

The first row with the \`header\` flag receives header styling (bold text, distinct background). Subsequent rows are styled as data rows.

> **Tip:** Tables work well for comparison data, specifications, and any structured data. For data that needs visualization (charts), use the \`chart\` block instead.

---

## chart — Data Visualization

The \`chart\` block renders data visualizations by referencing a named \`@data\` dataset. It supports common chart types for presenting numerical data visually.

\`\`\`depix
chart "sales" type:bar
chart "metrics" type:line
chart "distribution" type:pie
\`\`\`

The string label references a \`@data\` directive defined earlier in the document. The \`type\` property specifies the chart type.

**Supported types:** \`bar\`, \`line\`, \`pie\`

> **Tip:** Always define your \`@data\` directive before the scene that uses the \`chart\`. The chart name must exactly match the data name.

---

## column — Vertical Content Column

The \`column\` block stacks content vertically, similar to \`stack\` with \`direction:col\`, but designed specifically for rich mixed content — headings, text, dividers, and other elements in a natural reading flow.

\`\`\`depix
column {
  heading "Title"
  text "First paragraph of content."
  divider
  text "Second section after the divider."
  stat "99.9%" { label: "Uptime" }
}
\`\`\`

> **Tip:** Use \`column\` for document-like content where you're mixing headings, paragraphs, dividers, and data elements in a single vertical flow. Use \`stack\` when you're arranging uniform elements.
  `,
  contentKo: `
## 블록이란?

블록은 요소를 담고 배치하는 컨테이너입니다. 요소가 최소 시각 단위라면, 블록은 **레이아웃과 그룹핑**을 담당합니다 — 요소들이 서로 어떤 위치 관계로 배치될지를 결정합니다.

블록을 시각물의 구조적 뼈대라고 생각하세요. 각 블록 유형은 고유한 레이아웃 알고리즘을 가지며, 특정 종류의 콘텐츠 배열에 맞게 설계되어 있습니다.

---

## flow — 유향 그래프 / 플로우차트

\`flow\` 블록은 유향 그래프와 플로우차트에 사용됩니다. 내부 요소를 엣지(화살표)로 연결하여 관계와 프로세스를 표현할 수 있습니다.

\`\`\`depix
flow {
  pill "시작"        #start
  diamond "유효?"     #check
  rect "처리"        #process
  cylinder "데이터베이스" #db
  pill "종료"        #end

  #start -> #check
  #check -> #process "예"
  #check --> #db "아니오"
  #process -> #end
  #db -> #end
}
\`\`\`

레이아웃 엔진이 자동으로 노드를 배치하고 교차를 최소화하도록 엣지를 라우팅합니다.

**방향:** \`direction\` 속성으로 주요 흐름 방향을 제어합니다.
- \`right\` (기본값) — 왼쪽에서 오른쪽
- \`left\` — 오른쪽에서 왼쪽
- \`down\` — 위에서 아래
- \`up\` — 아래에서 위

> **팁:** \`flow\`는 가장 다재다능한 블록입니다. 프로세스 다이어그램, 상태 머신, 의사결정 트리, 네트워크 다이어그램 등 요소 간 방향성 관계가 있는 모든 시각물에 사용하세요.

---

## tree — 계층 트리

\`tree\` 블록은 계층적 부모-자식 관계를 표시합니다. \`flow\`와 동일한 엣지 문법을 사용하지만, 깔끔한 계층 간격을 보장하는 트리 레이아웃 알고리즘을 적용합니다.

\`\`\`depix
tree {
  node "CEO" #root
  node "CTO" #a
  node "CFO" #b
  node "VP 엔지니어링" #c
  node "VP 재무" #d

  #root -> #a
  #root -> #b
  #a -> #c
  #b -> #d
}
\`\`\`

**방향:** 트리가 성장하는 방향을 제어합니다.
- \`down\` (기본값) — 루트가 위, 자식이 아래
- \`up\` — 루트가 아래, 자식이 위
- \`right\` — 루트가 왼쪽, 자식이 오른쪽
- \`left\` — 루트가 오른쪽, 자식이 왼쪽

> **팁:** 데이터가 순수 계층 구조(조직도, 파일 시스템, 카테고리 분류)인 경우 \`flow\`보다 \`tree\`를 사용하세요. 트리 레이아웃 알고리즘이 이런 구조에서 더 깔끔한 결과를 냅니다.

---

## stack — 선형 레이아웃

\`stack\` 블록은 요소를 한 줄로 배열합니다 — 수직(열) 또는 수평(행). 가장 단순한 레이아웃 블록으로, 콘텐츠의 선형 나열에 적합합니다.

\`\`\`depix
stack direction:row {
  node "단계 1"
  node "단계 2"
  node "단계 3"
}
\`\`\`

**방향:**
- \`col\` (기본값) — 수직 쌓기, 위에서 아래
- \`row\` — 수평 쌓기, 왼쪽에서 오른쪽

> **팁:** \`stack\`은 단순 시퀀스, 내비게이션 바, 기능 목록 등 분기 없이 한 방향으로 흐르는 콘텐츠에 적합합니다.

---

## grid — 균일 그리드

\`grid\` 블록은 지정된 열 수로 요소를 균일한 그리드에 배열합니다. 요소가 자동으로 다음 행으로 줄바꿈됩니다.

\`\`\`depix
grid cols:3 {
  node "1"
  node "2"
  node "3"
  node "4"
  node "5"
  node "6"
}
\`\`\`

**핵심 속성:** \`cols\` — 그리드의 열 수.

> **팁:** \`grid\`는 기능 그리드, 아이콘 갤러리, 비교 매트릭스 등 항목이 행과 열에 고르게 분포해야 하는 콘텐츠에 적합합니다.

---

## layers — 적층 레이어

\`layers\` 블록은 수직으로 쌓인 수평 밴드를 만들며, 아키텍처 다이어그램에 주로 사용됩니다. 각 자식 \`layer\` 블록이 하나의 계층을 나타냅니다.

\`\`\`depix
layers {
  layer "프론트엔드" {
    node "React"
    node "Next.js"
  }
  layer "백엔드" {
    node "API 게이트웨이"
    node "인증 서비스"
  }
  layer "데이터" {
    cylinder "PostgreSQL"
    cylinder "Redis"
  }
}
\`\`\`

\`layers\` 블록은 계층 간 간격과 레이어 경계를 자동으로 처리합니다. 각 계층이 아래 계층 "위에" 놓여있음을 시각적으로 전달합니다.

> **팁:** \`layers\`는 기술 스택 다이어그램, OSI 모델 시각화, 수평 계층을 보여줘야 하는 모든 아키텍처에 특화되어 있습니다.

---

## box — 스타일 컨테이너

\`box\` 블록은 배경, 테두리, 패딩 등 시각적 스타일을 가진 컨테이너입니다. 스타일이 적용된 영역 안에 콘텐츠를 시각적으로 그룹화할 때 사용합니다.

\`\`\`depix
box {
  background: primary
  heading "섹션 제목"
  text "스타일 박스 안의 콘텐츠"
}
\`\`\`

\`group\`과 달리 \`box\`는 자체 배경색을 가질 수 있어, 카드, 콜아웃, 강조 섹션에 유용합니다.

> **팁:** 대시보드의 카드, 강조 콜아웃 영역, 주변 콘텐츠에서 시각적으로 돋보여야 하는 영역에 \`box\`를 사용하세요.

---

## layer — 영역 라벨 컨테이너

\`layer\` 블록은 좌상단에 카테고리 라벨이 있는 테두리 컨테이너를 렌더링합니다. 큰 다이어그램 안에서 영역이나 구역에 라벨을 붙이기 위해 설계되었습니다.

\`\`\`depix
layer "카테고리명" {
  node "항목 A"
  node "항목 B"
}
\`\`\`

라벨은 컨테이너 좌상단에 작은 태그로 렌더링되어, 해당 영역이 무엇을 나타내는지 명확하게 표시합니다.

> **팁:** 아키텍처 다이어그램에서는 \`layers\` 블록 안에 \`layer\`를 사용하고, 단독으로도 라벨이 있는 영역 표시에 활용할 수 있습니다. \`layer\`(컨테이너)와 \`layers\`(적층 레이아웃)를 혼동하지 마세요.

---

## group — 단순 테두리 그룹

\`group\` 블록은 자식 요소 주위에 단순한 테두리를 그립니다. 배경도, 라벨도 없이 시각적 경계만 제공합니다.

\`\`\`depix
group {
  node "그룹 A"
  node "그룹 B"
}
\`\`\`

> **팁:** \`box\`의 스타일링이나 \`layer\`의 라벨 없이 미묘한 시각적 경계만 원할 때 \`group\`을 사용하세요. 가장 가벼운 컨테이너입니다.

---

## table — 데이터 테이블

\`table\` 블록은 행-열 형식으로 데이터를 표시합니다. 행은 \`row\` 요소와 JSON 스타일 값 배열로 정의합니다.

\`\`\`depix
table {
  row ["이름", "나이", "도시"] header
  row ["Alice", 30, "서울"]
  row ["Bob", 25, "도쿄"]
  row ["Charlie", 35, "런던"]
}
\`\`\`

\`header\` 플래그가 있는 첫 번째 행은 헤더 스타일(굵은 텍스트, 구분된 배경)을 적용받습니다. 이후 행은 데이터 행으로 스타일링됩니다.

> **팁:** 테이블은 비교 데이터, 사양, 구조화된 데이터에 적합합니다. 시각화가 필요한 데이터(차트)에는 \`chart\` 블록을 사용하세요.

---

## chart — 데이터 시각화

\`chart\` 블록은 이름이 지정된 \`@data\` 데이터셋을 참조하여 데이터 시각화를 렌더링합니다. 수치 데이터를 시각적으로 표현하는 일반적인 차트 유형을 지원합니다.

\`\`\`depix
chart "sales" type:bar
chart "metrics" type:line
chart "distribution" type:pie
\`\`\`

문자열 라벨은 문서 앞부분에 정의된 \`@data\` 지시자를 참조합니다. \`type\` 속성으로 차트 유형을 지정합니다.

**지원 유형:** \`bar\`, \`line\`, \`pie\`

> **팁:** \`chart\`를 사용하는 씬보다 먼저 \`@data\` 지시자를 정의하세요. 차트 이름은 데이터 이름과 정확히 일치해야 합니다.

---

## column — 수직 콘텐츠 열

\`column\` 블록은 콘텐츠를 수직으로 쌓습니다. \`stack direction:col\`과 유사하지만, 제목, 텍스트, 구분선 등 다양한 요소가 자연스러운 읽기 흐름으로 배치되는 풍부한 혼합 콘텐츠에 특화되어 있습니다.

\`\`\`depix
column {
  heading "제목"
  text "첫 번째 문단의 내용입니다."
  divider
  text "구분선 이후의 두 번째 섹션입니다."
  stat "99.9%" { label: "가동률" }
}
\`\`\`

> **팁:** 제목, 문단, 구분선, 데이터 요소를 단일 수직 흐름으로 혼합하는 문서 형태의 콘텐츠에 \`column\`을 사용하세요. 균일한 요소를 배열할 때는 \`stack\`을 사용하세요.
  `,
};
