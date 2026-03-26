// synced_with: 'quick-reference@2d6512ca'

export const quickReference = {
  id: 'quick-reference',
  title: 'Quick Reference',
  titleKo: '빠른 참조',
  content: `
A compact cheat sheet for the entire Depix DSL. Keep this handy while writing your documents.

---

## Shapes

Geometric elements for diagrams and flowcharts.

| Shape | Keyword | Typical Use |
|-------|---------|-------------|
| Rectangle | \`node\`, \`rect\` | Generic nodes, process steps |
| Circle | \`circle\` | States, markers |
| Ellipse | \`ellipse\` | Ovals |
| Diamond | \`diamond\` | Decisions, branches |
| Pill | \`pill\` | Start/end terminals |
| Hexagon | \`hexagon\` | Preparation steps |
| Triangle | \`triangle\` | Warnings, directions |
| Parallelogram | \`parallelogram\` | Data I/O |
| Cylinder | \`cylinder\` | Databases, storage |
| Trapezoid | \`trapezoid\` | Manual operations |
| Badge | \`badge\` | Small label badges |

---

## Blocks

Container and layout structures.

| Block | Purpose | Key Props |
|-------|---------|-----------|
| \`flow\` | Directed graph / flowchart | \`direction\`: right, left, down, up |
| \`tree\` | Hierarchical tree | \`direction\`: down, up, right, left |
| \`stack\` | Linear layout | \`direction\`: col (default), row |
| \`grid\` | Uniform grid | \`cols\`: number of columns |
| \`layers\` | Stacked tier layers | — |
| \`layer\` | Named zone container | label string |
| \`box\` | Styled container | style properties |
| \`group\` | Bordered container | — |
| \`column\` | Vertical content column | — |
| \`table\` | Data table | \`row\` children with \`header\` flag |
| \`chart\` | Data visualization | \`type\`: bar, line, pie |

---

## Text Elements

| Element | Description | Props |
|---------|-------------|-------|
| \`heading\` | Large bold title | — |
| \`text\` | Body text | — |
| \`label\` | Body text (alias) | — |
| \`item\` | Body text (alias) | — |
| \`stat\` | Large value + subtitle | \`label\` |
| \`quote\` | Italic quote | \`attribution\` |
| \`step\` | Numbered marker | \`description\` |
| \`icon\` | Symbol + label | \`label\`, \`description\` |

---

## Lists

\`\`\`depix
list ["A", "B", "C"]              // unordered
bullet ["A", "B", "C"]            // unordered (alias)
list ordered ["First", "Second"]  // numbered
\`\`\`

---

## Arrow Syntax

| Syntax | Type | Visual |
|--------|------|--------|
| \`#a -> #b\` | Directed | Solid line + arrowhead |
| \`#a --> #b\` | Dashed directed | Dashed line + arrowhead |
| \`#a -- #b\` | Undirected | Solid line, no arrowhead |
| \`#a <-> #b\` | Bidirectional | Arrowheads on both ends |
| \`#a -> #b "label"\` | Labeled | Text on the edge |
| \`#a -> #b -> #c\` | Chain | Multiple edges in sequence |

---

## Layouts (14 Presets)

| Preset | Slots |
|--------|-------|
| \`full\` | body |
| \`center\` | body |
| \`split\` | left, right |
| \`rows\` | top, bottom |
| \`sidebar\` | main, side |
| \`header\` | header, body |
| \`header-split\` | header, left, right |
| \`header-rows\` | header, top, bottom |
| \`header-sidebar\` | header, main, side |
| \`grid\` | cell* |
| \`header-grid\` | header, cell* |
| \`focus\` | focus, cell* |
| \`header-focus\` | header, focus, cell* |
| \`custom\` | cell* |

\\* \`cell\` is repeatable.

---

## Slots

\`header\` \`body\` \`left\` \`right\` \`top\` \`bottom\` \`main\` \`side\` \`focus\` \`cell\`

---

## Directives

| Directive | Example | Description |
|-----------|---------|-------------|
| \`@page\` | \`@page 16:9\` | Canvas ratio (\`16:9\`, \`4:3\`, \`1:1\`, \`*\`) |
| \`@style\` | \`@style sketch\` | Drawing style (\`default\`, \`sketch\`) |
| \`@transition\` | \`@transition fade\` | Scene transition animation |
| \`@ratio\` | \`@ratio 4:3\` | Alias for \`@page\` |
| \`@data\` | \`@data "name" { ... }\` | Named dataset for charts |
| \`@overrides\` | \`@overrides { #id { x, y } }\` | Manual position overrides |

---

## Flags

Bare keywords that modify elements:

\`bold\` \`italic\` \`underline\` \`strikethrough\` \`center\` \`outline\` \`header\` \`ordered\`

---

## Style Keys

Visual appearance properties (inside \`{ }\`):

| Key | Example Values |
|-----|---------------|
| \`background\` | \`primary\`, \`accent\`, \`#ff5733\`, \`gradient(right, #f00, #00f)\` |
| \`color\` | \`white\`, \`text\`, \`#333\` |
| \`border\` | \`accent\`, \`#000\` |
| \`border-width\` | \`2\` |
| \`border-style\` | \`dashed\` |
| \`shadow\` | \`true\` |
| \`radius\` | \`4\`, \`8\` |
| \`opacity\` | \`0.5\`, \`0.8\` |
| \`font-size\` | \`14\`, \`24\` |
| \`font-weight\` | \`bold\`, \`600\` |

---

## Element Syntax Pattern

\`\`\`
<type> ["label"] [#id] [flags] [{ props/style }]
\`\`\`

Every part after the type keyword is optional. Examples:

\`\`\`depix
node                                    // bare shape
node "Server"                           // with label
node "Server" #srv                      // with label and ID
node "Server" #srv bold                 // with flag
node "Server" #srv { background: primary }  // with style
\`\`\`
  `,
  contentKo: `
Depix DSL 전체를 한눈에 볼 수 있는 치트 시트입니다. 문서 작성 시 참고하세요.

---

## 도형 (Shapes)

다이어그램과 플로차트에 사용하는 기하학적 요소입니다.

| 도형 | 키워드 | 주요 용도 |
|------|--------|-----------|
| 사각형 | \`node\`, \`rect\` | 범용 노드, 프로세스 단계 |
| 원 | \`circle\` | 상태, 마커 |
| 타원 | \`ellipse\` | 타원형 |
| 마름모 | \`diamond\` | 의사결정, 분기 |
| 알약형 | \`pill\` | 시작/종료 터미널 |
| 육각형 | \`hexagon\` | 준비 단계 |
| 삼각형 | \`triangle\` | 경고, 방향 |
| 평행사변형 | \`parallelogram\` | 데이터 입출력 |
| 원통형 | \`cylinder\` | 데이터베이스, 저장소 |
| 사다리꼴 | \`trapezoid\` | 수동 작업 |
| 뱃지 | \`badge\` | 소형 라벨 뱃지 |

---

## 블록 (Blocks)

콘텐츠를 감싸는 컨테이너와 레이아웃 구조입니다.

| 블록 | 용도 | 주요 속성 |
|------|------|-----------|
| \`flow\` | 방향 그래프 / 플로차트 | \`direction\`: right, left, down, up |
| \`tree\` | 계층 트리 | \`direction\`: down, up, right, left |
| \`stack\` | 선형 배치 | \`direction\`: col (기본), row |
| \`grid\` | 균일 그리드 | \`cols\`: 열 수 |
| \`layers\` | 계층 레이어 | — |
| \`layer\` | 이름 있는 영역 컨테이너 | 라벨 문자열 |
| \`box\` | 스타일 컨테이너 | 스타일 속성 |
| \`group\` | 테두리 컨테이너 | — |
| \`column\` | 세로 콘텐츠 칼럼 | — |
| \`table\` | 데이터 표 | \`row\` + \`header\` 플래그 |
| \`chart\` | 데이터 시각화 | \`type\`: bar, line, pie |

---

## 텍스트 요소

| 요소 | 설명 | 속성 |
|------|------|------|
| \`heading\` | 큰 볼드 제목 | — |
| \`text\` | 본문 텍스트 | — |
| \`label\` | 본문 텍스트 (별칭) | — |
| \`item\` | 본문 텍스트 (별칭) | — |
| \`stat\` | 큰 값 + 부제 | \`label\` |
| \`quote\` | 이탤릭 인용문 | \`attribution\` |
| \`step\` | 번호 마커 | \`description\` |
| \`icon\` | 심볼 + 라벨 | \`label\`, \`description\` |

---

## 리스트

\`\`\`depix
list ["A", "B", "C"]              // 비순서
bullet ["A", "B", "C"]            // 비순서 (별칭)
list ordered ["First", "Second"]  // 순서
\`\`\`

---

## 화살표 문법

| 문법 | 유형 | 모양 |
|------|------|------|
| \`#a -> #b\` | 방향 | 실선 + 화살촉 |
| \`#a --> #b\` | 점선 방향 | 점선 + 화살촉 |
| \`#a -- #b\` | 무방향 | 실선, 화살촉 없음 |
| \`#a <-> #b\` | 양방향 | 양쪽 화살촉 |
| \`#a -> #b "label"\` | 라벨 | 엣지 위 텍스트 |
| \`#a -> #b -> #c\` | 체인 | 연속 엣지 |

---

## 레이아웃 (14 프리셋)

| 프리셋 | 슬롯 |
|--------|------|
| \`full\` | body |
| \`center\` | body |
| \`split\` | left, right |
| \`rows\` | top, bottom |
| \`sidebar\` | main, side |
| \`header\` | header, body |
| \`header-split\` | header, left, right |
| \`header-rows\` | header, top, bottom |
| \`header-sidebar\` | header, main, side |
| \`grid\` | cell* |
| \`header-grid\` | header, cell* |
| \`focus\` | focus, cell* |
| \`header-focus\` | header, focus, cell* |
| \`custom\` | cell* |

\\* \`cell\`은 반복 사용 가능합니다.

---

## 슬롯

\`header\` \`body\` \`left\` \`right\` \`top\` \`bottom\` \`main\` \`side\` \`focus\` \`cell\`

---

## 디렉티브

| 디렉티브 | 예시 | 설명 |
|----------|------|------|
| \`@page\` | \`@page 16:9\` | 캔버스 비율 (\`16:9\`, \`4:3\`, \`1:1\`, \`*\`) |
| \`@style\` | \`@style sketch\` | 렌더링 스타일 (\`default\`, \`sketch\`) |
| \`@transition\` | \`@transition fade\` | 씬 전환 애니메이션 |
| \`@ratio\` | \`@ratio 4:3\` | \`@page\`의 별칭 |
| \`@data\` | \`@data "name" { ... }\` | 차트용 이름 있는 데이터셋 |
| \`@overrides\` | \`@overrides { #id { x, y } }\` | 수동 위치 오버라이드 |

---

## 플래그

요소를 수식하는 키워드:

\`bold\` \`italic\` \`underline\` \`strikethrough\` \`center\` \`outline\` \`header\` \`ordered\`

---

## 스타일 키

\`{ }\` 안에서 사용하는 시각적 속성:

| 키 | 값 예시 |
|----|---------|
| \`background\` | \`primary\`, \`accent\`, \`#ff5733\`, \`gradient(right, #f00, #00f)\` |
| \`color\` | \`white\`, \`text\`, \`#333\` |
| \`border\` | \`accent\`, \`#000\` |
| \`border-width\` | \`2\` |
| \`border-style\` | \`dashed\` |
| \`shadow\` | \`true\` |
| \`radius\` | \`4\`, \`8\` |
| \`opacity\` | \`0.5\`, \`0.8\` |
| \`font-size\` | \`14\`, \`24\` |
| \`font-weight\` | \`bold\`, \`600\` |

---

## 요소 문법 패턴

\`\`\`
<type> ["label"] [#id] [flags] [{ props/style }]
\`\`\`

타입 키워드 이후의 모든 부분은 선택 사항입니다:

\`\`\`depix
node                                    // 빈 도형
node "Server"                           // 라벨 추가
node "Server" #srv                      // 라벨 + ID
node "Server" #srv bold                 // 플래그 추가
node "Server" #srv { background: primary }  // 스타일 추가
\`\`\`
  `,
};
