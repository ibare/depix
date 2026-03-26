// synced_with: 'document-structure@f7056c78'

export const documentStructure = {
  id: 'document-structure',
  title: 'Document Structure',
  titleKo: '문서 구조',
  content: `
## Overview

A Depix document is composed of two fundamental building blocks:

1. **Directives** — document-level settings that control the canvas, style, and data
2. **Scenes** — individual visual pages, each containing layout slots and content

Directives always come first, followed by one or more scenes. Think of directives as the "global configuration" and scenes as the "pages" of your visual document.

\`\`\`depix
@page 16:9
@style sketch

scene "Title Slide" {
  layout: header
  header: heading "Welcome to Depix"
  body: text "A DSL for visual content"
}

scene "Details" {
  layout: split
  left: stat "42%" { label: "Growth" }
  right: bullet ["Fast", "Flexible", "Beautiful"]
}
\`\`\`

In this example, \`@page\` and \`@style\` are directives that apply to the entire document. Each \`scene\` block defines a separate visual page with its own layout and content.

## Implicit Scene Wrapping

You don't always need to write \`scene { ... }\` explicitly. If you skip the scene block and write top-level content directly, the compiler automatically wraps everything in a single implicit scene.

This means a simple document like:

\`\`\`depix
heading "Hello World"
text "This is a quick note."
\`\`\`

is treated exactly the same as:

\`\`\`depix
scene {
  heading "Hello World"
  text "This is a quick note."
}
\`\`\`

This is convenient for quick sketches and single-page visuals where the ceremony of a \`scene\` block would be unnecessary.

> **Tip:** Use explicit scenes when you have multiple pages or need layout control. Use implicit wrapping for quick, single-page content.
  `,
  contentKo: `
## 개요

Depix 문서는 두 가지 핵심 구성 요소로 이루어져 있습니다:

1. **지시자(Directives)** — 캔버스, 스타일, 데이터 등 문서 전체에 적용되는 설정
2. **씬(Scenes)** — 개별 시각 페이지로, 각각 레이아웃 슬롯과 콘텐츠를 담고 있습니다

지시자를 먼저 선언한 후, 하나 이상의 씬을 작성합니다. 지시자는 "전역 설정", 씬은 시각 문서의 "페이지"라고 생각하면 됩니다.

\`\`\`depix
@page 16:9
@style sketch

scene "Title Slide" {
  layout: header
  header: heading "Welcome to Depix"
  body: text "A DSL for visual content"
}

scene "Details" {
  layout: split
  left: stat "42%" { label: "Growth" }
  right: bullet ["Fast", "Flexible", "Beautiful"]
}
\`\`\`

이 예시에서 \`@page\`와 \`@style\`은 문서 전체에 적용되는 지시자이고, 각 \`scene\` 블록은 고유한 레이아웃과 콘텐츠를 가진 독립적인 시각 페이지입니다.

## 암시적 씬 래핑

\`scene { ... }\`을 명시적으로 작성하지 않아도 됩니다. 씬 블록 없이 최상위에 바로 콘텐츠를 작성하면, 컴파일러가 자동으로 하나의 암시적 씬으로 감싸줍니다.

즉, 다음과 같은 간단한 문서는:

\`\`\`depix
heading "Hello World"
text "This is a quick note."
\`\`\`

아래와 완전히 동일하게 처리됩니다:

\`\`\`depix
scene {
  heading "Hello World"
  text "This is a quick note."
}
\`\`\`

단일 페이지 시각화나 빠른 스케치에서 \`scene\` 블록의 번거로움을 줄여주는 편의 기능입니다.

> **팁:** 여러 페이지가 있거나 레이아웃 제어가 필요하면 명시적 씬을 사용하세요. 빠른 단일 페이지 콘텐츠에는 암시적 래핑이 편리합니다.
  `,
};
