export interface ReferenceExample {
  label: string;
  dsl: string;
  themeName?: 'light' | 'dark';
}

export interface ReferenceSection {
  id: string;
  title: string;
  description: string;
  syntax?: string;
  examples: ReferenceExample[];
}

export interface ReferenceCategory {
  id: string;
  title: string;
  sections: ReferenceSection[];
}

export const REFERENCE_CATEGORIES: ReferenceCategory[] = [
  {
    id: 'document',
    title: '1. Document Structure',
    sections: [
      {
        id: 'page',
        title: '@page',
        description: '캔버스의 비율 또는 크기를 지정한다. 지정하지 않으면 16:9 기본값.',
        syntax: '@page 16:9 | 4:3 | 1:1 | A4 | letter',
        examples: [
          {
            label: '16:9 (기본)',
            dsl: `@page 16:9

node "16:9 Widescreen" { color: primary }`,
          },
          {
            label: '1:1 정사각형',
            dsl: `@page 1:1

node "Square Canvas" { color: accent }`,
          },
        ],
      },
      {
        id: 'theme',
        title: 'Theme',
        description: '테마는 DSL 외부에서 지정한다. 동일한 DSL을 다른 테마로 렌더링하여 시맨틱 컬러의 차이를 확인할 수 있다.',
        syntax: 'compile(dsl, { theme: lightTheme | darkTheme })',
        examples: [
          {
            label: 'Light 테마',
            themeName: 'light',
            dsl: `@page 16:9

stack direction:row gap:md {
  node "Primary" { color: primary }
  node "Success" { color: success }
  node "Danger" { color: danger }
}`,
          },
          {
            label: 'Dark 테마',
            themeName: 'dark',
            dsl: `@page 16:9

stack direction:row gap:md {
  node "Primary" { color: primary }
  node "Success" { color: success }
  node "Danger" { color: danger }
}`,
          },
        ],
      },
      {
        id: 'scene',
        title: 'scene',
        description: '멀티씬 프레젠테이션을 위한 장면 분리. 생략하면 단일 캔버스.',
        syntax: 'scene "Title" { ... }',
        examples: [
          {
            label: '2개 씬',
            dsl: `@page 16:9

scene "Intro" {
  node "Welcome" { color: primary, font-size: xl }
}

scene "Content" {
  stack direction:row gap:lg {
    node "Point A" { color: info }
    node "Point B" { color: success }
  }
}`,
          },
        ],
      },
      {
        id: 'style',
        title: '@style',
        description: '렌더링 스타일을 지정한다. sketch를 사용하면 손으로 그린 듯한 느낌을 준다.',
        syntax: '@style sketch',
        examples: [
          {
            label: 'Sketch 스타일',
            dsl: `@page 16:9
@style sketch

flow direction:right {
  node "Idea" #a { color: primary }
  node "Design" #b { color: info }
  node "Build" #c { color: success }

  #a -> #b
  #b -> #c
}`,
          },
        ],
      },
      {
        id: 'transition',
        title: '@transition',
        description: '씬 간 전환 애니메이션을 지정한다.',
        syntax: '@transition fade | slide-left | slide-right | slide-up | slide-down | zoom-in | zoom-out',
        examples: [
          {
            label: 'Fade 전환',
            dsl: `@transition fade

scene "First" {
  layout: center
  body: heading "Slide 1"
}

scene "Second" {
  layout: center
  body: heading "Slide 2"
}`,
          },
        ],
      },
      {
        id: 'data',
        title: '@data',
        description: '이름이 있는 데이터 블록을 정의한다. table이나 chart에서 참조하여 같은 데이터를 다양한 형태로 시각화할 수 있다.',
        syntax: '@data "name" { "col1" "col2" \\n "val1" val2 ... }',
        examples: [
          {
            label: '@data + table + chart',
            dsl: `
@data "revenue" {
  "Quarter" "Revenue"
  "Q1" 120
  "Q2" 185
  "Q3" 240
}

scene "numbers" {
  layout: header
  header: heading "Sales Data"
  body: table "revenue"
}

scene "trend" {
  layout: header
  header: heading "Revenue Trend"
  body: chart "revenue" type:bar x:"Quarter" y:"Revenue"
}`,
          },
        ],
      },
    ],
  },
  {
    id: 'layouts',
    title: '2. Layout Primitives',
    sections: [
      {
        id: 'flow',
        title: 'flow',
        description: '방향성 있는 흐름. 노드를 화살표로 연결한다. 플로우차트, 파이프라인에 사용.',
        syntax: 'flow direction:right|left|down|up { ... }',
        examples: [
          {
            label: '기본 flow',
            dsl: `@page 16:9

flow direction:right {
  node "A" #a
  node "B" #b
  node "C" #c

  #a -> #b "step 1"
  #b -> #c "step 2"
}`,
          },
          {
            label: '분기 flow',
            dsl: `@page 16:9

flow direction:right {
  node "Start" #s
  node "Check" #chk { shape: diamond }
  node "Yes" #y { color: success }
  node "No" #n { color: danger }

  #s -> #chk
  #chk -> #y "pass"
  #chk -> #n "fail"
}`,
          },
        ],
      },
      {
        id: 'stack',
        title: 'stack',
        description: '요소를 수직(col) 또는 수평(row)으로 쌓는다.',
        syntax: 'stack direction:row|col gap:xs|sm|md|lg|xl align:start|center|end|stretch { ... }',
        examples: [
          {
            label: '수평 stack',
            dsl: `@page 16:9

stack direction:row gap:md {
  node "A" { color: primary }
  node "B" { color: info }
  node "C" { color: success }
}`,
          },
          {
            label: '수직 stack',
            dsl: `@page 16:9

stack direction:col gap:sm {
  node "Top" { color: primary }
  node "Middle" { color: info }
  node "Bottom" { color: success }
}`,
          },
        ],
      },
      {
        id: 'grid',
        title: 'grid',
        description: '행렬(테이블) 배치. cols로 열 수를 지정한다.',
        syntax: 'grid cols:N gap:xs~xl { cell "text" { header } ... }',
        examples: [
          {
            label: '3열 그리드',
            dsl: `@page 16:9

grid cols:3 {
  cell "Name" { header }
  cell "Role" { header }
  cell "Status" { header }

  cell "Alice"
  cell "Engineer"
  cell "Active" { color: success }

  cell "Bob"
  cell "Designer"
  cell "Away" { color: warning }
}`,
          },
        ],
      },
      {
        id: 'tree',
        title: 'tree',
        description: '계층 구조. 노드를 중첩하면 부모-자식 관계가 된다.',
        syntax: 'tree direction:down|right|up|left { node "label" { node "child" ... } }',
        examples: [
          {
            label: '파일 시스템',
            dsl: `@page 16:9

tree direction:down {
  node "src" {
    node "components" {
      node "Header.tsx"
      node "Footer.tsx"
    }
    node "pages" {
      node "Home.tsx"
      node "About.tsx"
    }
    node "index.ts"
  }
}`,
          },
        ],
      },
      {
        id: 'group',
        title: 'group',
        description: '요소들을 하나의 영역으로 묶어 시각적으로 그룹핑한다.',
        syntax: 'group "Title" { ... }',
        examples: [
          {
            label: '그룹핑',
            dsl: `@page 16:9

flow direction:right {
  group "Frontend" #fe {
    label "React"
    label "Next.js"
  }

  group "Backend" #be {
    label "Node.js"
    label "PostgreSQL"
  }

  #fe -> #be "API"
}`,
          },
        ],
      },
      {
        id: 'layers',
        title: 'layers',
        description: '위에서 아래로 쌓이는 레이어. 아키텍처 스택 다이어그램에 적합.',
        syntax: 'layers { layer "name" { color: ... } ... }',
        examples: [
          {
            label: 'OSI 모델',
            dsl: `@page 16:9

layers {
  layer "Application" { color: blue }
  layer "Transport" { color: accent }
  layer "Network" { color: green }
  layer "Data Link" { color: orange }
  layer "Physical" { color: muted }
}`,
          },
        ],
      },
      {
        id: 'table',
        title: 'table',
        description: '데이터를 표 형태로 시각화한다. 인라인 데이터를 직접 넣거나, @data 블록을 참조할 수 있다.',
        syntax: 'table { "col1" "col2" \\n "val1" val2 } | table "dataName"',
        examples: [
          {
            label: '인라인 테이블',
            dsl: `@page 16:9

table {
  "Name" "Score"
  "Alice" 95
  "Bob" 88
}`,
          },
          {
            label: '@data 참조 테이블',
            dsl: `@data "sales" {
  "Quarter" "Revenue"
  "Q1" 120
  "Q2" 185
}

table "sales"`,
          },
        ],
      },
      {
        id: 'chart',
        title: 'chart',
        description: '@data 블록의 데이터를 차트로 시각화한다. bar, line, pie 3가지 타입을 지원.',
        syntax: 'chart "dataName" type:bar|line|pie x:"colName" y:"colName"',
        examples: [
          {
            label: 'Bar 차트',
            dsl: `@data "revenue" {
  "Quarter" "Revenue"
  "Q1" 120
  "Q2" 185
  "Q3" 240
}

chart "revenue" type:bar x:"Quarter" y:"Revenue"`,
          },
          {
            label: 'Pie 차트',
            dsl: `@data "share" {
  "Browser" "Share"
  "Chrome" 65
  "Firefox" 20
  "Safari" 15
}

chart "share" type:pie x:"Browser" y:"Share"`,
          },
        ],
      },
      {
        id: 'canvas',
        title: 'canvas',
        description: '저수준 자유 배치. x, y, w, h를 직접 지정하여 요소를 절대 좌표로 배치한다.',
        syntax: 'canvas { rect "label" { x:N, y:N, w:N, h:N } ... }',
        examples: [
          {
            label: '자유 배치',
            dsl: `@page 16:9

canvas {
  rect "Box" { x:10, y:10, w:200, h:100 }
  circle "Dot" { x:300, y:60, r:30 }
}`,
          },
        ],
      },
    ],
  },
  {
    id: 'elements',
    title: '3. Visual Elements',
    sections: [
      {
        id: 'box',
        title: 'box',
        description: '순수 컨테이너. 자체적으로 텍스트를 렌더링하지 않으며, heading/label/list 등 자식 요소로 내용을 구성한다.',
        syntax: 'box { background: ..., heading "...", label "...", list [...] }',
        examples: [
          {
            label: 'box with list',
            dsl: `@page 16:9

box {
  background: primary
  heading "Features"
  label "Feature Overview"
  list [
    "New DSL syntax"
    "Visual editor"
    "PNG export"
  ]
}`,
          },
        ],
      },
      {
        id: 'node',
        title: 'node',
        description: '연결 가능한 다이어그램 노드. shape으로 모양을 지정한다.',
        syntax: 'node "Label" #id { shape: rect|circle|diamond|pill|hexagon|triangle|parallelogram|ellipse }',
        examples: [
          {
            label: '기본 shapes',
            dsl: `@page 16:9

flow direction:right {
  node "Rect" { shape: rect, color: primary }
  node "Circle" { shape: circle, color: info }
  node "Diamond" { shape: diamond, color: warning }
}`,
          },
          {
            label: '확장 shapes',
            dsl: `@page 16:9

flow direction:right {
  node "Pill" { shape: pill, color: success }
  node "Hexagon" { shape: hexagon, color: accent }
  node "Triangle" { shape: triangle, color: danger }
}`,
          },
        ],
      },
      {
        id: 'label',
        title: 'label',
        description: '단순 텍스트 표시.',
        syntax: 'label "Text" { bold, italic, font-size: xs~3xl }',
        examples: [
          {
            label: 'Label styles',
            dsl: `@page 16:9

stack direction:col gap:sm {
  label "Large Bold" { bold, font-size: xl }
  label "Normal text"
  label "Small muted" { font-size: sm, color: muted }
}`,
          },
        ],
      },
      {
        id: 'badge',
        title: 'badge',
        description: '강조용 작은 라벨. 태그, 상태 표시에 사용.',
        syntax: 'badge "Text" { color: ..., outline }',
        examples: [
          {
            label: 'Badge colors',
            dsl: `@page 16:9

stack direction:row gap:sm {
  badge "Success" { color: success }
  badge "Warning" { color: warning }
  badge "Danger" { color: danger }
  badge "Info" { color: info }
}`,
          },
        ],
      },
      {
        id: 'list',
        title: 'list',
        description: '항목 나열. box 안에 넣거나 독립적으로 사용. ordered 플래그로 순서 목록을 만든다.',
        syntax: 'list ["item1", "item2", ...] | list ordered [...]',
        examples: [
          {
            label: 'Unordered list',
            dsl: `@page 16:9

stack direction:row gap:lg {
  box {
    background: primary
    heading "Unordered"
    list [
      "Alpha"
      "Beta"
      "Gamma"
    ]
  }
}`,
          },
          {
            label: 'Ordered list',
            dsl: `@page 16:9

box {
  background: info
  heading "Steps"
  list ordered [
    "First"
    "Second"
    "Third"
  ]
}`,
          },
        ],
      },
      {
        id: 'divider',
        title: 'divider',
        description: '구분선. 라벨을 붙일 수 있다.',
        syntax: 'divider | divider "label"',
        examples: [
          {
            label: 'Divider with label',
            dsl: `@page 16:9

stack direction:col gap:md {
  label "Above" { bold }
  divider "separator"
  label "Below" { bold }
}`,
          },
        ],
      },
      {
        id: 'icon',
        title: 'icon',
        description: '아이콘을 표시한다. 노드나 아이템에 icon 속성으로 지정할 수도 있다.',
        syntax: 'icon "name" { color: ... }',
        examples: [
          {
            label: 'Icon 표시',
            dsl: `@page 16:9

stack direction:row gap:md {
  icon "star"
  icon "heart" { color: danger }
  icon "check" { color: success }
}`,
          },
        ],
      },
      {
        id: 'image',
        title: 'image',
        description: '이미지를 표시한다. fit 속성으로 맞춤 방식을 지정한다.',
        syntax: 'image "url" { fit: contain|cover|fill }',
        examples: [
          {
            label: 'Image 요소',
            dsl: `@page 16:9

image "https://picsum.photos/400/200" { fit: cover }`,
          },
        ],
      },
    ],
  },
  {
    id: 'connections',
    title: '4. Connections & IDs',
    sections: [
      {
        id: 'id-syntax',
        title: '#id',
        description: '요소에 #id를 붙여 식별자를 부여한다. 연결(edge)에서 참조할 때 사용.',
        syntax: 'node "Label" #myId',
        examples: [
          {
            label: 'ID and edges',
            dsl: `@page 16:9

flow direction:right {
  node "Source" #src
  node "Target" #tgt

  #src -> #tgt "connected"
}`,
          },
        ],
      },
      {
        id: 'edge-types',
        title: 'Edge Types',
        description: '4가지 연결 스타일을 제공한다.',
        syntax: '#a -> #b  (solid)  |  #a --> #b  (dashed)  |  #a <-> #b  (bidirectional)  |  #a -- #b  (no arrow)',
        examples: [
          {
            label: '모든 edge 스타일',
            dsl: `@page 16:9

flow direction:right {
  node "A" #a
  node "B" #b
  node "C" #c
  node "D" #d

  #a -> #b "solid"
  #b --> #c "dashed"
  #c <-> #d "both"
}`,
          },
        ],
      },
    ],
  },
  {
    id: 'styling',
    title: '5. Styling',
    sections: [
      {
        id: 'inline-style',
        title: 'Inline Styles',
        description: 'CSS-like 속성을 인라인으로 지정한다. 미지정 시 테마 기본값 적용.',
        syntax: '{ background: #hex, color: semantic, border: ..., shadow: sm|md|lg, radius: sm|md|lg|full }',
        examples: [
          {
            label: '커스텀 스타일',
            dsl: `@page 16:9

stack direction:row gap:md {
  box {
    background: #dbeafe
    border: #3b82f6
    shadow: lg
    radius: lg
    heading "Custom"
  }
  box {
    background: #fef3c7
    border: #f59e0b
    shadow: md
    radius: md
    heading "Gradient feel"
  }
}`,
          },
        ],
      },
      {
        id: 'semantic-colors',
        title: 'Semantic Colors',
        description: '테마에 따라 자동 매핑되는 시맨틱 컬러. LLM이 HEX를 몰라도 의도를 표현 가능.',
        syntax: 'primary | secondary | accent | success | warning | danger | info | muted',
        examples: [
          {
            label: '전체 시맨틱 컬러',
            dsl: `@page 16:9

grid cols:4 {
  cell "primary" { color: primary }
  cell "secondary" { color: secondary }
  cell "accent" { color: accent }
  cell "success" { color: success }
  cell "warning" { color: warning }
  cell "danger" { color: danger }
  cell "info" { color: info }
  cell "muted" { color: muted }
}`,
          },
        ],
      },
      {
        id: 'semantic-tokens',
        title: 'Semantic Tokens',
        description: '크기, 간격, 효과를 시맨틱 토큰으로 지정한다.',
        syntax: 'gap: xs|sm|md|lg|xl  |  font-size: xs~3xl  |  shadow: none|sm|md|lg  |  radius: none|sm|md|lg|full',
        examples: [
          {
            label: 'Gap 비교',
            dsl: `@page 16:9

stack direction:col gap:lg {
  stack direction:row gap:xs {
    badge "xs" { color: muted }
    badge "gap" { color: muted }
  }
  stack direction:row gap:md {
    badge "md" { color: info }
    badge "gap" { color: info }
  }
  stack direction:row gap:xl {
    badge "xl" { color: primary }
    badge "gap" { color: primary }
  }
}`,
          },
        ],
      },
      {
        id: 'flags',
        title: 'Flags',
        description: 'Boolean 속성. 키만 적으면 true.',
        syntax: '{ bold } | { italic } | { underline } | { strikethrough } | { center } | { outline } | { header } | { ordered }',
        examples: [
          {
            label: 'Text flags',
            dsl: `@page 16:9

stack direction:col gap:sm {
  label "Bold text" { bold }
  label "Italic text" { italic }
  label "Strikethrough" { strikethrough }
  label "Bold + Center" { bold, center }
}`,
          },
        ],
      },
    ],
  },
  {
    id: 'scene-layouts',
    title: '6. Scene Layouts',
    sections: [
      {
        id: 'layout-full',
        title: 'full',
        description: '전체 캔버스를 body 슬롯 하나로 사용. 다이어그램을 꽉 채워 표시할 때 사용한다.',
        syntax: 'scene "..." { layout: full, body: ... }',
        examples: [
          {
            label: 'Full 레이아웃',
            dsl: `
scene "System" {
  layout: full
  body: flow direction:right {
    node "Client" #a { color: primary }
    node "Server" #b { color: accent }
    #a -> #b "API"
  }
}`,
          },
        ],
      },
      {
        id: 'layout-center',
        title: 'center',
        description: '중앙에 내용을 배치. 타이틀, 인용문, 강조 메시지에 적합.',
        syntax: 'scene "..." { layout: center, body: ... }',
        examples: [
          {
            label: 'Center 레이아웃',
            dsl: `
scene "Title" {
  layout: center
  body: column {
    heading "Welcome to Depix"
    label "Declarative Diagram DSL"
  }
}`,
          },
        ],
      },
      {
        id: 'layout-split',
        title: 'split',
        description: '좌우 2분할. left, right 슬롯으로 나란히 배치.',
        syntax: 'scene "..." { layout: split, left: ..., right: ... }',
        examples: [
          {
            label: 'Split 레이아웃',
            dsl: `
scene "Compare" {
  layout: split
  left: column {
    heading "Before"
    label "수동 드래그"
    label "픽셀 단위 조정"
  }
  right: column {
    heading "After"
    label "선언적 코드"
    label "자동 레이아웃"
  }
}`,
          },
        ],
      },
      {
        id: 'layout-rows',
        title: 'rows',
        description: '상하 2분할. top, bottom 슬롯으로 위아래 배치.',
        syntax: 'scene "..." { layout: rows, top: ..., bottom: ... }',
        examples: [
          {
            label: 'Rows 레이아웃',
            dsl: `
scene "Stack" {
  layout: rows
  top: heading "상단 영역"
  bottom: label "하단 영역"
}`,
          },
        ],
      },
      {
        id: 'layout-sidebar',
        title: 'sidebar',
        description: '메인 + 사이드바. main은 넓게, side는 좁게 배치.',
        syntax: 'scene "..." { layout: sidebar, main: ..., side: ... }',
        examples: [
          {
            label: 'Sidebar 레이아웃',
            dsl: `
scene "Dashboard" {
  layout: sidebar
  main: heading "메인 콘텐츠"
  side: column {
    label "사이드 메뉴 1"
    label "사이드 메뉴 2"
  }
}`,
          },
        ],
      },
      {
        id: 'layout-header',
        title: 'header',
        description: '상단 헤더 + 하단 본문. 가장 기본적인 프레젠테이션 레이아웃.',
        syntax: 'scene "..." { layout: header, header: heading "...", body: ... }',
        examples: [
          {
            label: 'Header 레이아웃',
            dsl: `
scene "Key Points" {
  layout: header
  header: heading "주요 특징"
  body: bullet {
    item "선언적 DSL 문법"
    item "시맨틱 컬러 시스템"
    item "14가지 슬라이드 레이아웃"
    item "실시간 미리보기"
  }
}`,
          },
        ],
      },
      {
        id: 'layout-header-split',
        title: 'header-split',
        description: '상단 헤더 + 좌우 분할. 비교, 2단 구성에 적합.',
        syntax: 'scene "..." { layout: header-split, header: ..., left: ..., right: ... }',
        examples: [
          {
            label: 'Header-split 레이아웃',
            dsl: `
scene "Comparison" {
  layout: header-split
  header: heading "Before vs After"
  left: column {
    label "수동 드래그"
    label "픽셀 단위 조정"
    label "재사용 불가"
  }
  right: column {
    label "선언적 코드"
    label "자동 레이아웃"
    label "버전 관리 가능"
  }
}`,
          },
        ],
      },
      {
        id: 'layout-header-rows',
        title: 'header-rows',
        description: '상단 헤더 + 상하 분할 본문.',
        syntax: 'scene "..." { layout: header-rows, header: ..., top: ..., bottom: ... }',
        examples: [
          {
            label: 'Header-rows 레이아웃',
            dsl: `
scene "Analysis" {
  layout: header-rows
  header: heading "분석 결과"
  top: label "상단: 요약"
  bottom: label "하단: 상세"
}`,
          },
        ],
      },
      {
        id: 'layout-header-sidebar',
        title: 'header-sidebar',
        description: '상단 헤더 + 메인/사이드바 본문.',
        syntax: 'scene "..." { layout: header-sidebar, header: ..., main: ..., side: ... }',
        examples: [
          {
            label: 'Header-sidebar 레이아웃',
            dsl: `
scene "Overview" {
  layout: header-sidebar
  header: heading "Dashboard"
  main: heading "메인 콘텐츠"
  side: column {
    label "Navigation"
    label "Settings"
  }
}`,
          },
        ],
      },
      {
        id: 'layout-grid',
        title: 'grid',
        description: '균등 그리드. cell 슬롯을 반복하여 N개 셀 배치.',
        syntax: 'scene "..." { layout: grid, cell: ..., cell: ..., ... }',
        examples: [
          {
            label: 'Grid 레이아웃',
            dsl: `
scene "Features" {
  layout: grid
  cell: heading "Feature 1"
  cell: heading "Feature 2"
  cell: heading "Feature 3"
  cell: heading "Feature 4"
}`,
          },
        ],
      },
      {
        id: 'layout-header-grid',
        title: 'header-grid',
        description: '상단 헤더 + 그리드 본문. 지표, 아이콘 그리드 등에 적합.',
        syntax: 'scene "..." { layout: header-grid, header: ..., cell: ..., ... }',
        examples: [
          {
            label: 'Header-grid 레이아웃',
            dsl: `
scene "Metrics" {
  layout: header-grid
  header: heading "KPI Dashboard"
  cell: stat "99.9%" { label: "Uptime" }
  cell: stat "50ms" { label: "Avg Response" }
  cell: stat "10K+" { label: "Daily Users" }
}`,
          },
        ],
      },
      {
        id: 'layout-focus',
        title: 'focus',
        description: '중심 포커스 + 하단 셀들. 주요 항목 강조에 적합.',
        syntax: 'scene "..." { layout: focus, focus: ..., cell: ..., ... }',
        examples: [
          {
            label: 'Focus 레이아웃',
            dsl: `
scene "Hero" {
  layout: focus
  focus: heading "핵심 기능"
  cell: label "보조 1"
  cell: label "보조 2"
  cell: label "보조 3"
}`,
          },
        ],
      },
      {
        id: 'layout-header-focus',
        title: 'header-focus',
        description: '헤더 + 포커스 + 셀. 가장 풍부한 계층 구조.',
        syntax: 'scene "..." { layout: header-focus, header: ..., focus: ..., cell: ..., ... }',
        examples: [
          {
            label: 'Header-focus 레이아웃',
            dsl: `
scene "Product" {
  layout: header-focus
  header: heading "Product Line"
  focus: stat "1M+" { label: "Total Users" }
  cell: label "Enterprise"
  cell: label "Startup"
}`,
          },
        ],
      },
      {
        id: 'layout-custom',
        title: 'custom',
        description: '자유 배치. cell 슬롯이 세로로 쌓인다. layout 미지정 시 기본값.',
        syntax: 'scene "..." { layout: custom, cell: ..., cell: ..., ... }',
        examples: [
          {
            label: 'Custom 레이아웃',
            dsl: `
scene "Freeform" {
  layout: custom
  cell: heading "Section A"
  cell: label "Content goes here"
  cell: label "More content"
}`,
          },
        ],
      },
    ],
  },
];
