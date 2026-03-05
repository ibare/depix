export interface ReferenceExample {
  label: string;
  dsl: string;
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

box "16:9 Widescreen" { color: primary }`,
          },
          {
            label: '1:1 정사각형',
            dsl: `@page 1:1

box "Square Canvas" { color: accent }`,
          },
        ],
      },
      {
        id: 'theme',
        title: '@theme',
        description: '렌더링 테마를 지정한다. 시맨틱 컬러(primary, success 등)의 실제 색상이 결정된다.',
        syntax: '@theme light | dark',
        examples: [
          {
            label: 'Light 테마',
            dsl: `@page 16:9
@theme light

stack direction:row gap:md {
  box "Primary" { color: primary }
  box "Success" { color: success }
  box "Danger" { color: danger }
}`,
          },
          {
            label: 'Dark 테마',
            dsl: `@page 16:9
@theme dark

stack direction:row gap:md {
  box "Primary" { color: primary }
  box "Success" { color: success }
  box "Danger" { color: danger }
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
  box "Welcome" { color: primary, font-size: xl }
}

scene "Content" {
  stack direction:row gap:lg {
    box "Point A" { color: info }
    box "Point B" { color: success }
  }
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
  box "A" { color: primary }
  box "B" { color: info }
  box "C" { color: success }
}`,
          },
          {
            label: '수직 stack',
            dsl: `@page 16:9

stack direction:col gap:sm {
  box "Top" { color: primary }
  box "Middle" { color: info }
  box "Bottom" { color: success }
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
    ],
  },
  {
    id: 'elements',
    title: '3. Visual Elements',
    sections: [
      {
        id: 'box',
        title: 'box',
        description: '기본 컨테이너. 제목, 부제목, 리스트를 포함할 수 있다.',
        syntax: 'box "Title" { subtitle: "...", color: ..., list [...] }',
        examples: [
          {
            label: 'box with list',
            dsl: `@page 16:9

box "Features" {
  color: primary
  subtitle: "Version 2.0"
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
        syntax: 'node "Label" #id { shape: rect|circle|diamond|pill|hexagon }',
        examples: [
          {
            label: 'Node shapes',
            dsl: `@page 16:9

flow direction:right {
  node "Rect" { shape: rect, color: primary }
  node "Circle" { shape: circle, color: info }
  node "Diamond" { shape: diamond, color: warning }
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
        description: '항목 나열. box 안에 넣거나 독립적으로 사용.',
        syntax: 'list ["item1", "item2", ...] | list ordered [...]',
        examples: [
          {
            label: 'Standalone list',
            dsl: `@page 16:9

stack direction:row gap:lg {
  box "Unordered" {
    color: primary
    list [
      "Alpha"
      "Beta"
      "Gamma"
    ]
  }
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
  box "Custom" {
    background: #dbeafe
    border: #3b82f6
    shadow: lg
    radius: lg
  }
  box "Gradient feel" {
    background: #fef3c7
    border: #f59e0b
    shadow: md
    radius: md
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
        syntax: '{ bold } | { italic } | { underline } | { header } | { outline } | { center }',
        examples: [
          {
            label: 'Text flags',
            dsl: `@page 16:9

stack direction:col gap:sm {
  label "Bold text" { bold }
  label "Italic text" { italic }
  label "Bold + Center" { bold, center }
}`,
          },
        ],
      },
    ],
  },
];
