// synced_with: 'directives@9815374a'

export const directives = {
  id: 'directives',
  title: 'Directives',
  titleKo: '디렉티브',
  content: `
## What are Directives?

Directives are document-level settings that start with \`@\`. They configure the canvas, visual style, transitions, and data for your entire document. Place them at the top of your DSL, before any scene blocks.

\`\`\`depix
@page 16:9
@style sketch

scene "First Slide" {
  layout: center
  body: heading "Hello"
}
\`\`\`

---

## Directive Reference

| Directive | Values | Description |
|-----------|--------|-------------|
| \`@page\` | \`16:9\`, \`4:3\`, \`1:1\`, \`*\` | Sets the canvas aspect ratio. Use \`*\` for auto-height mode where the canvas grows to fit content. |
| \`@style\` | \`default\`, \`sketch\` | Sets the visual rendering style for the entire document. |
| \`@transition\` | \`fade\`, \`slide-left\`, \`slide-right\`, \`slide-up\`, \`slide-down\`, \`zoom-in\`, \`zoom-out\` | Defines the animation used when switching between scenes. |
| \`@ratio\` | \`16:9\`, \`4:3\`, etc. | Alias for \`@page\`. Use whichever reads better in your context. |

### Auto-Height Mode (\`@page *\`)

When you set \`@page *\`, the canvas width remains fixed but the height expands automatically to accommodate all content. This is ideal for documents, long-form content, or any visual that shouldn't be constrained to a fixed aspect ratio.

\`\`\`depix
@page *

box {
  heading "Shopping List"
  list ["Apples", "Bananas", "Milk", "Bread", "Eggs", "Cheese"]
}
\`\`\`

---

## @data — Named Datasets

The \`@data\` directive defines a named dataset that can be referenced by \`chart\` blocks. The **first row is automatically treated as the header** — it defines column names for the data that follows.

\`\`\`depix
@data "sales" {
  "Quarter" "Revenue" "Profit"
  "Q1" 120 30
  "Q2" 150 45
  "Q3" 180 60
  "Q4" 200 75
}
\`\`\`

Reference the dataset by name in a chart:

\`\`\`depix
scene "Sales Report" {
  layout: header
  header: heading "Quarterly Sales"
  body: chart "sales" type:bar
}
\`\`\`

You can define multiple datasets in one document:

\`\`\`depix
@data "revenue" {
  "Month" "Amount"
  "Jan" 100
  "Feb" 120
  "Mar" 150
}

@data "users" {
  "Month" "Count"
  "Jan" 500
  "Feb" 800
  "Mar" 1200
}

scene "Overview" {
  layout: split
  left: chart "revenue" type:line
  right: chart "users" type:bar
}
\`\`\`

---

## @overrides — Element Position Overrides

The \`@overrides\` directive stores manual position adjustments for elements. This is primarily used by the visual editor to persist drag-and-drop changes, but you can also write overrides by hand.

Each entry targets an element by its \`#id\` and specifies position (\`x\`, \`y\`) and/or size (\`w\`, \`h\`) values:

\`\`\`depix
@overrides {
  #title { x: 50, y: 20 }
  #sidebar { x: 10, y: 100, w: 200, h: 400 }
}
\`\`\`

> **Note:** Override values represent percentage-based positions within the canvas. The layout engine applies these after computing the default positions.

---

## Tips

- **Always place directives before scenes.** The compiler expects directives at the top of the document. Placing them after a scene may cause unexpected behavior.
- **\`@page\` is the most common directive.** Most documents start with \`@page 16:9\` for presentation-style content.
- **Use \`@page *\` for documents.** When your content is more like a document than a slide deck, auto-height mode avoids awkward cropping.
- **\`@data\` pairs with \`chart\`.** Define your data once at the top, then reference it by name anywhere in your scenes.
  `,
  contentKo: `
## 디렉티브란?

디렉티브는 \`@\`로 시작하는 문서 전체 설정입니다. 캔버스, 시각 스타일, 전환 효과, 데이터 등 문서 전반에 적용되는 항목을 구성합니다. DSL 최상단, 씬 블록보다 앞에 작성합니다.

\`\`\`depix
@page 16:9
@style sketch

scene "First Slide" {
  layout: center
  body: heading "Hello"
}
\`\`\`

---

## 디렉티브 참조표

| 디렉티브 | 값 | 설명 |
|----------|-----|------|
| \`@page\` | \`16:9\`, \`4:3\`, \`1:1\`, \`*\` | 캔버스 비율 설정. \`*\`는 콘텐츠에 맞춰 높이가 자동으로 늘어나는 모드입니다. |
| \`@style\` | \`default\`, \`sketch\` | 문서 전체의 시각적 렌더링 스타일을 지정합니다. |
| \`@transition\` | \`fade\`, \`slide-left\`, \`slide-right\`, \`slide-up\`, \`slide-down\`, \`zoom-in\`, \`zoom-out\` | 씬 간 전환 시 사용되는 애니메이션을 정의합니다. |
| \`@ratio\` | \`16:9\`, \`4:3\` 등 | \`@page\`의 별칭입니다. 문맥에 맞는 쪽을 사용하세요. |

### 자동 높이 모드 (\`@page *\`)

\`@page *\`를 설정하면 캔버스 너비는 고정되지만, 높이는 콘텐츠 양에 따라 자동으로 확장됩니다. 문서형 콘텐츠나 길이가 정해지지 않은 시각화에 적합합니다.

\`\`\`depix
@page *

box {
  heading "Shopping List"
  list ["Apples", "Bananas", "Milk", "Bread", "Eggs", "Cheese"]
}
\`\`\`

---

## @data — 이름 있는 데이터셋

\`@data\` 디렉티브는 \`chart\` 블록에서 참조할 수 있는 이름 있는 데이터셋을 정의합니다. **첫 번째 행은 자동으로 헤더로 처리**되어 이후 데이터의 칼럼명이 됩니다.

\`\`\`depix
@data "sales" {
  "Quarter" "Revenue" "Profit"
  "Q1" 120 30
  "Q2" 150 45
  "Q3" 180 60
  "Q4" 200 75
}
\`\`\`

차트에서 이름으로 참조합니다:

\`\`\`depix
scene "Sales Report" {
  layout: header
  header: heading "Quarterly Sales"
  body: chart "sales" type:bar
}
\`\`\`

하나의 문서에 여러 데이터셋을 정의할 수도 있습니다:

\`\`\`depix
@data "revenue" {
  "Month" "Amount"
  "Jan" 100
  "Feb" 120
  "Mar" 150
}

@data "users" {
  "Month" "Count"
  "Jan" 500
  "Feb" 800
  "Mar" 1200
}

scene "Overview" {
  layout: split
  left: chart "revenue" type:line
  right: chart "users" type:bar
}
\`\`\`

---

## @overrides — 요소 위치 오버라이드

\`@overrides\` 디렉티브는 요소의 수동 위치 조정값을 저장합니다. 주로 비주얼 에디터가 드래그 앤 드롭 결과를 저장할 때 사용하지만, 직접 작성할 수도 있습니다.

각 항목은 \`#id\`로 요소를 지정하고 위치(\`x\`, \`y\`) 및/또는 크기(\`w\`, \`h\`) 값을 설정합니다:

\`\`\`depix
@overrides {
  #title { x: 50, y: 20 }
  #sidebar { x: 10, y: 100, w: 200, h: 400 }
}
\`\`\`

> **참고:** 오버라이드 값은 캔버스 내 백분율 기반 위치입니다. 레이아웃 엔진이 기본 위치를 계산한 후에 적용됩니다.

---

## 팁

- **디렉티브는 반드시 씬 앞에 작성하세요.** 컴파일러는 문서 상단에서 디렉티브를 기대합니다. 씬 뒤에 배치하면 예기치 않은 동작이 발생할 수 있습니다.
- **\`@page\`가 가장 자주 쓰이는 디렉티브입니다.** 대부분의 문서는 \`@page 16:9\`로 시작합니다.
- **문서형 콘텐츠에는 \`@page *\`를 사용하세요.** 슬라이드 덱이 아닌 문서 형태라면 자동 높이 모드가 잘린 콘텐츠를 방지합니다.
- **\`@data\`는 \`chart\`와 짝입니다.** 상단에서 데이터를 한 번 정의하고, 씬 어디서든 이름으로 참조하세요.
  `,
};
