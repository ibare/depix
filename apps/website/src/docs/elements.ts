// synced_with: 'elements@e0ef0084'

export const elements = {
  id: 'elements',
  title: 'Elements',
  titleKo: '요소',
  content: `
## What Are Elements?

Elements are the atomic visual units of Depix. Every shape, text block, icon, and list you see on the canvas is an element. They are the building blocks you compose into diagrams, slides, and infographics.

## Generic Syntax

Every element follows the same pattern:

\`\`\`depix
<elementType> ["label"] [#id] [flags] [{ props/style }]
\`\`\`

Only \`<elementType>\` is required. Everything else is optional:

- **label** — a quoted string displayed inside or alongside the element
- **#id** — a unique identifier (needed when connecting elements with edges)
- **flags** — bare keywords that modify appearance or behavior
- **{ props/style }** — a block of key-value pairs for properties and visual styles

---

## Shape Elements

Shape elements render as geometric shapes on the canvas. They are the workhorses of flowcharts, diagrams, and architectural visuals.

| Element | Shape | Typical Use |
|---------|-------|-------------|
| \`node\` | Rectangle | Generic node — use when you don't need a specific shape |
| \`rect\` | Rectangle | Explicit rectangle |
| \`circle\` | Circle | Standalone markers, state indicators |
| \`diamond\` | Diamond | Decision points, conditional branches |
| \`pill\` | Rounded rectangle | Start/end terminals in flowcharts |
| \`ellipse\` | Oval | Alternative to circle for wider content |
| \`hexagon\` | Hexagon | Preparation steps, special processes |
| \`triangle\` | Triangle | Warnings, directional indicators |
| \`parallelogram\` | Parallelogram | Data input/output operations |
| \`cylinder\` | Cylinder | Databases, storage systems |
| \`trapezoid\` | Trapezoid | Manual operations, hardware interfaces |
| \`badge\` | Pill (small) | Small label badges, status indicators |
| \`cell\` | Rectangle | Generic cell (used inside grids/tables) |

\`\`\`depix
node "Label"
diamond "Decision?" { background: accent }
pill "Start" #myId { background: primary, color: white }
cylinder "PostgreSQL" #db
\`\`\`

> **Tip: \`node\` vs specific shapes** — Use \`node\` when the shape doesn't carry semantic meaning (e.g., generic process steps). Use specific shapes like \`diamond\`, \`cylinder\`, or \`pill\` when the shape itself communicates something (decisions, databases, terminals). This makes your diagrams self-documenting.

---

## Text Elements

Text elements display textual content in various formats. They range from simple headings to rich compound elements like stats and quotes.

| Element | Description | Key Props |
|---------|-------------|-----------|
| \`heading\` | Large, bold, centered text. Use for titles and section headers. | — |
| \`text\` | Standard body text for paragraphs and descriptions. | — |
| \`label\` | Alias for \`text\`. Use whichever reads better in context. | — |
| \`item\` | Alias for \`text\`. Convenient when listing items semantically. | — |
| \`stat\` | A large prominent value with a smaller label underneath. Perfect for KPIs and metrics. | \`label\` |
| \`quote\` | Italic quoted text with optional attribution. Great for testimonials. | \`attribution\` |
| \`step\` | A numbered circle marker with a description. Ideal for process steps. | \`description\` |
| \`icon\` | A large symbol character with a label and description below. Use for feature highlights. | \`label\`, \`description\` |

### Examples

\`\`\`depix
heading "Welcome to Our Platform"

text "This is a paragraph of body text that describes something important."

stat "42%" { label: "Conversion Rate" }

quote "Design is not just what it looks like." { attribution: "Steve Jobs" }

step "1" { description: "Sign up for an account" }

icon "🚀" { label: "Launch", description: "Deploy to production" }
\`\`\`

The \`stat\` element is particularly useful in dashboards — the main value is displayed prominently while the \`label\` property provides context underneath.

The \`step\` element automatically renders its label inside a circular marker, making it perfect for numbered process flows without needing a full \`flow\` block.

---

## List Elements

Lists display multiple items in a bulleted or numbered format.

\`\`\`depix
list ["Apples", "Bananas", "Milk"]
list ordered ["First", "Second", "Third"]
bullet ["Item A", "Item B", "Item C"]
\`\`\`

- \`list\` and \`bullet\` are interchangeable — use whichever reads better
- Add the \`ordered\` flag to render numbered items instead of bullets
- Items are provided as a JSON-style array of quoted strings

---

## Other Elements

### Divider

A simple horizontal line to visually separate content:

\`\`\`depix
divider
\`\`\`

### Image

An image placeholder with alt text and a source URL:

\`\`\`depix
image "Product screenshot" { src: "https://example.com/image.png" }
\`\`\`

---

## ID Assignment

Assign an ID to any element by appending \`#\` followed by the identifier name. IDs are required when you want to connect elements with edges.

\`\`\`depix
pill "Begin" #start
diamond "Check?" #decision
rect "Process" #process
\`\`\`

IDs must be unique within their containing block. Use descriptive names that reflect the element's role — this makes edge declarations much easier to read.

> **Tip:** You only need IDs on elements that participate in edge connections. Elements that just display content (like headings or stats) don't need IDs.

---

## Flags

Flags are bare keywords placed after the label (and optional ID) that modify the element's appearance or behavior. No value assignment needed — just write the keyword.

\`\`\`depix
heading "Title" bold center
text "Important note" italic underline
list ordered ["a", "b", "c"]
row ["Name", "Age"] header
\`\`\`

### Available Flags

| Flag | Effect |
|------|--------|
| \`bold\` | Bold font weight |
| \`italic\` | Italic font style |
| \`underline\` | Underlined text |
| \`strikethrough\` | Strikethrough text decoration |
| \`center\` | Center-aligned text |
| \`outline\` | Outline-only style (no fill) |
| \`header\` | Header styling (used with table rows) |
| \`ordered\` | Numbered list (used with list/bullet) |

Multiple flags can be combined on a single element. They are applied in any order.

---

## Properties & Styles

Use curly braces \`{ }\` to set key-value pairs on an element. The compiler automatically separates these into **style keys** (visual appearance) and **property keys** (semantic data).

\`\`\`depix
node "Server" {
  background: primary
  color: white
  border: accent
  border-width: 2
  radius: 4
  opacity: 0.8
  shape: diamond
  width: 20
  height: 15
}
\`\`\`

### Style Keys (Visual Appearance)

These control how the element looks:

| Key | Description |
|-----|-------------|
| \`background\` | Fill color of the element |
| \`color\` | Text color |
| \`border\` | Border color |
| \`border-width\` | Border thickness (number) |
| \`border-style\` | Border line style |
| \`shadow\` | Drop shadow |
| \`radius\` | Corner rounding (number) |
| \`opacity\` | Transparency (0.0 to 1.0) |
| \`font-size\` | Text size |
| \`font-weight\` | Text weight |

### Property Keys (Semantic Data)

These control the element's behavior and content:

| Key | Description |
|-----|-------------|
| \`direction\` | Layout direction |
| \`gap\` | Spacing between child elements |
| \`ratio\` | Split ratio |
| \`cols\` | Number of grid columns |
| \`layout\` | Layout preset name |
| \`subtitle\` | Subtitle text |
| \`attribution\` | Quote attribution |
| \`description\` | Description text |
| \`label\` | Label text |
| \`type\` | Chart type or element variant |
| \`shape\` | Override the rendered shape |
| \`width\` | Explicit width |
| \`height\` | Explicit height |
| \`size\` | Size hint |
| \`fit\` | Content fitting mode |
| \`src\` | Image source URL |
| \`x\`, \`y\` | Position coordinates |

---

## Color System

Depix provides three ways to specify colors:

### Semantic Tokens

Predefined color names that adapt to the current theme:

| Token | Purpose |
|-------|---------|
| \`primary\` | Brand / primary accent color |
| \`accent\` | Secondary accent color |
| \`surface\` | Card / container background |
| \`text\` | Default text color |
| \`textMuted\` | Subdued text color |
| \`background\` | Page background color |

Using semantic tokens is recommended — they ensure your visuals look correct across different themes and styles.

### Hex Colors

Direct hex color values for precise control:

\`\`\`depix
node "Error" { background: #ff4444, color: #ffffff }
\`\`\`

### Gradients

Linear gradients with direction and color stops:

\`\`\`depix
box { background: gradient(right, #f00, #00f) }
\`\`\`

The first argument is the direction (\`right\`, \`left\`, \`down\`, \`up\`), followed by two or more color stops.

> **Tip:** Prefer semantic tokens over hex colors when possible. They make your documents portable across themes and ensure consistent visual hierarchy.
  `,
  contentKo: `
## 요소란?

요소(Element)는 Depix의 최소 시각 단위입니다. 캔버스에 보이는 모든 도형, 텍스트 블록, 아이콘, 목록이 하나의 요소입니다. 다이어그램, 슬라이드, 인포그래픽을 구성하는 기본 빌딩 블록이라 할 수 있습니다.

## 기본 문법

모든 요소는 동일한 패턴을 따릅니다:

\`\`\`depix
<elementType> ["label"] [#id] [flags] [{ props/style }]
\`\`\`

\`<elementType>\`만 필수이고 나머지는 모두 선택 사항입니다:

- **label** — 요소 안이나 옆에 표시되는 따옴표 문자열
- **#id** — 고유 식별자 (엣지로 연결할 때 필요)
- **flags** — 외형이나 동작을 변경하는 키워드
- **{ props/style }** — 속성과 스타일을 지정하는 키-값 블록

---

## 도형 요소

도형 요소는 캔버스 위에 기하학적 형태로 렌더링됩니다. 플로우차트, 다이어그램, 아키텍처 시각화의 핵심 요소입니다.

| 요소 | 형태 | 일반적 용도 |
|------|------|------------|
| \`node\` | 사각형 | 범용 노드 — 특정 형태가 필요 없을 때 사용 |
| \`rect\` | 사각형 | 명시적 사각형 |
| \`circle\` | 원 | 마커, 상태 표시기 |
| \`diamond\` | 마름모 | 조건 분기, 의사결정 포인트 |
| \`pill\` | 둥근 사각형 | 플로우차트의 시작/종료 터미널 |
| \`ellipse\` | 타원 | 넓은 콘텐츠를 위한 원 대안 |
| \`hexagon\` | 육각형 | 준비 단계, 특수 프로세스 |
| \`triangle\` | 삼각형 | 경고, 방향 표시 |
| \`parallelogram\` | 평행사변형 | 데이터 입출력 |
| \`cylinder\` | 원기둥 | 데이터베이스, 저장소 |
| \`trapezoid\` | 사다리꼴 | 수동 작업, 하드웨어 인터페이스 |
| \`badge\` | 작은 알약형 | 라벨 배지, 상태 표시 |
| \`cell\` | 사각형 | 범용 셀 (그리드/테이블 내부) |

\`\`\`depix
node "Label"
diamond "Decision?" { background: accent }
pill "Start" #myId { background: primary, color: white }
cylinder "PostgreSQL" #db
\`\`\`

> **팁: \`node\` vs 특정 도형** — 도형 자체에 의미가 없는 경우(일반 프로세스 단계 등) \`node\`를 사용하세요. 의사결정(\`diamond\`), 데이터베이스(\`cylinder\`), 시작/종료(\`pill\`) 등 도형이 의미를 전달하는 경우에만 특정 도형을 사용하세요. 다이어그램을 자기 문서화하는 효과가 있습니다.

---

## 텍스트 요소

텍스트 요소는 다양한 형식의 텍스트 콘텐츠를 표시합니다. 단순한 제목부터 통계, 인용구 같은 복합 요소까지 포함합니다.

| 요소 | 설명 | 주요 속성 |
|------|------|----------|
| \`heading\` | 크고 굵은 중앙 정렬 텍스트. 제목과 섹션 헤더에 사용. | — |
| \`text\` | 본문 텍스트. 문단과 설명에 사용. | — |
| \`label\` | \`text\`의 별칭. 문맥에 맞게 사용. | — |
| \`item\` | \`text\`의 별칭. 항목을 의미적으로 나열할 때 편리. | — |
| \`stat\` | 큰 값 + 아래 작은 라벨. KPI와 메트릭에 적합. | \`label\` |
| \`quote\` | 기울임 인용문 + 출처. 증언에 적합. | \`attribution\` |
| \`step\` | 번호 원형 마커 + 설명. 프로세스 단계에 이상적. | \`description\` |
| \`icon\` | 큰 심볼 문자 + 라벨 + 설명. 기능 하이라이트에 사용. | \`label\`, \`description\` |

### 예시

\`\`\`depix
heading "플랫폼에 오신 것을 환영합니다"

text "중요한 내용을 설명하는 본문 텍스트입니다."

stat "42%" { label: "전환율" }

quote "디자인은 단순히 보이는 것이 아닙니다." { attribution: "스티브 잡스" }

step "1" { description: "계정 가입" }

icon "🚀" { label: "출시", description: "프로덕션 배포" }
\`\`\`

\`stat\` 요소는 대시보드에서 특히 유용합니다 — 주요 값이 크게 표시되고 \`label\` 속성이 아래에 맥락을 제공합니다.

\`step\` 요소는 라벨을 원형 마커 안에 자동 렌더링하므로, \`flow\` 블록 없이도 번호가 매겨진 프로세스를 표현할 수 있습니다.

---

## 목록 요소

목록은 여러 항목을 글머리 기호 또는 번호 형식으로 표시합니다.

\`\`\`depix
list ["사과", "바나나", "우유"]
list ordered ["첫째", "둘째", "셋째"]
bullet ["항목 A", "항목 B", "항목 C"]
\`\`\`

- \`list\`와 \`bullet\`은 동일한 기능입니다 — 가독성에 맞게 선택하세요
- \`ordered\` 플래그를 추가하면 글머리 기호 대신 번호가 매겨집니다
- 항목은 JSON 스타일의 따옴표 문자열 배열로 제공합니다

---

## 기타 요소

### 구분선

콘텐츠를 시각적으로 분리하는 수평선입니다:

\`\`\`depix
divider
\`\`\`

### 이미지

대체 텍스트와 소스 URL을 가진 이미지 플레이스홀더입니다:

\`\`\`depix
image "제품 스크린샷" { src: "https://example.com/image.png" }
\`\`\`

---

## ID 지정

\`#\` 뒤에 식별자 이름을 붙여 모든 요소에 ID를 지정할 수 있습니다. 엣지로 요소를 연결하려면 ID가 반드시 필요합니다.

\`\`\`depix
pill "시작" #start
diamond "확인?" #decision
rect "처리" #process
\`\`\`

ID는 포함 블록 내에서 고유해야 합니다. 요소의 역할을 반영하는 서술적 이름을 사용하면 엣지 선언의 가독성이 크게 향상됩니다.

> **팁:** 엣지 연결에 참여하는 요소만 ID가 필요합니다. 제목이나 통계처럼 단순히 콘텐츠를 표시하는 요소에는 ID를 붙이지 않아도 됩니다.

---

## 플래그

플래그는 라벨(및 선택적 ID) 뒤에 오는 키워드로, 요소의 외형이나 동작을 변경합니다. 값 할당 없이 키워드만 작성하면 됩니다.

\`\`\`depix
heading "제목" bold center
text "중요한 메모" italic underline
list ordered ["a", "b", "c"]
row ["이름", "나이"] header
\`\`\`

### 사용 가능한 플래그

| 플래그 | 효과 |
|--------|------|
| \`bold\` | 굵은 글씨체 |
| \`italic\` | 기울임 글씨체 |
| \`underline\` | 밑줄 텍스트 |
| \`strikethrough\` | 취소선 텍스트 |
| \`center\` | 가운데 정렬 |
| \`outline\` | 외곽선 스타일 (채움 없음) |
| \`header\` | 헤더 스타일링 (테이블 행에 사용) |
| \`ordered\` | 번호 목록 (list/bullet에 사용) |

여러 플래그를 하나의 요소에 조합할 수 있으며, 순서는 관계없습니다.

---

## 속성과 스타일

중괄호 \`{ }\`로 요소에 키-값 쌍을 설정합니다. 컴파일러가 자동으로 **스타일 키**(시각적 외형)와 **속성 키**(의미적 데이터)로 분류합니다.

\`\`\`depix
node "서버" {
  background: primary
  color: white
  border: accent
  border-width: 2
  radius: 4
  opacity: 0.8
  shape: diamond
  width: 20
  height: 15
}
\`\`\`

### 스타일 키 (시각적 외형)

요소의 모습을 제어합니다:

| 키 | 설명 |
|----|------|
| \`background\` | 요소의 채움색 |
| \`color\` | 텍스트 색상 |
| \`border\` | 테두리 색상 |
| \`border-width\` | 테두리 두께 (숫자) |
| \`border-style\` | 테두리 선 스타일 |
| \`shadow\` | 그림자 효과 |
| \`radius\` | 모서리 둥글기 (숫자) |
| \`opacity\` | 투명도 (0.0 ~ 1.0) |
| \`font-size\` | 텍스트 크기 |
| \`font-weight\` | 텍스트 굵기 |

### 속성 키 (의미적 데이터)

요소의 동작과 콘텐츠를 제어합니다:

| 키 | 설명 |
|----|------|
| \`direction\` | 레이아웃 방향 |
| \`gap\` | 자식 요소 간 간격 |
| \`ratio\` | 분할 비율 |
| \`cols\` | 그리드 열 수 |
| \`layout\` | 레이아웃 프리셋 이름 |
| \`subtitle\` | 부제목 텍스트 |
| \`attribution\` | 인용 출처 |
| \`description\` | 설명 텍스트 |
| \`label\` | 라벨 텍스트 |
| \`type\` | 차트 유형 또는 요소 변형 |
| \`shape\` | 렌더링 도형 오버라이드 |
| \`width\` | 명시적 너비 |
| \`height\` | 명시적 높이 |
| \`size\` | 크기 힌트 |
| \`fit\` | 콘텐츠 맞춤 모드 |
| \`src\` | 이미지 소스 URL |
| \`x\`, \`y\` | 위치 좌표 |

---

## 색상 시스템

Depix는 세 가지 색상 지정 방식을 제공합니다:

### 시맨틱 토큰

현재 테마에 맞게 자동으로 조정되는 미리 정의된 색상 이름입니다:

| 토큰 | 용도 |
|------|------|
| \`primary\` | 브랜드 / 주요 강조 색상 |
| \`accent\` | 보조 강조 색상 |
| \`surface\` | 카드 / 컨테이너 배경 |
| \`text\` | 기본 텍스트 색상 |
| \`textMuted\` | 흐린 텍스트 색상 |
| \`background\` | 페이지 배경 색상 |

시맨틱 토큰 사용을 권장합니다 — 다양한 테마와 스타일에서 시각물이 올바르게 보이도록 보장합니다.

### Hex 색상

정밀한 제어를 위한 직접 hex 색상 값:

\`\`\`depix
node "오류" { background: #ff4444, color: #ffffff }
\`\`\`

### 그라디언트

방향과 색상 정지점을 가진 선형 그라디언트:

\`\`\`depix
box { background: gradient(right, #f00, #00f) }
\`\`\`

첫 번째 인수는 방향(\`right\`, \`left\`, \`down\`, \`up\`)이고, 그 뒤에 두 개 이상의 색상 정지점이 옵니다.

> **팁:** 가능하면 hex 색상보다 시맨틱 토큰을 사용하세요. 테마 간 이식성을 높이고 일관된 시각적 계층 구조를 보장합니다.
  `,
};
