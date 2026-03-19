export interface PlaygroundExample {
  id: string;
  title: string;
  hint: string;
  dsl: string;
}

export interface PlaygroundLevel {
  id: string;
  label: string;
  description: string;
  examples: PlaygroundExample[];
}

export const PLAYGROUND_LEVELS: PlaygroundLevel[] = [
  {
    id: 'basics',
    label: 'Level 1: Basics',
    description: '단일 요소를 하나씩 배워봅니다.',
    examples: [
      {
        id: 'box',
        title: 'Box',
        hint: 'box는 순수 컨테이너입니다. 내부에 heading, label, list 등 자식 요소를 넣어 구성합니다.',
        dsl: `@page 16:9

box {
  background: primary
  heading "Hello Depix"
  label "Your first diagram"
}`,
      },
      {
        id: 'node',
        title: 'Node',
        hint: 'node는 flow/tree에서 연결 가능한 요소입니다. shape으로 모양을 바꿀 수 있습니다.',
        dsl: `@page 16:9

flow direction:right {
  node "Start" { shape: circle, color: success }
  node "Process" { color: primary }
  node "End" { shape: diamond, color: danger }
}`,
      },
      {
        id: 'label-badge',
        title: 'Label & Badge',
        hint: 'label은 텍스트, badge는 강조용 작은 라벨입니다.',
        dsl: `@page 16:9

stack direction:col gap:md {
  label "This is a label" { bold }
  label "A smaller label" { font-size: sm, color: muted }
  stack direction:row gap:sm {
    badge "stable" { color: success }
    badge "beta" { color: warning }
    badge "new" { color: info }
  }
}`,
      },
      {
        id: 'list',
        title: 'List',
        hint: 'list는 항목을 순서대로 나열합니다. box 안에 넣을 수도 있습니다.',
        dsl: `@page 16:9

box {
  background: primary
  heading "Shopping List"
  list [
    "Apples"
    "Bananas"
    "Milk"
    "Bread"
  ]
}`,
      },
      {
        id: 'divider',
        title: 'Divider',
        hint: 'divider는 구분선입니다. 라벨을 붙일 수 있습니다.',
        dsl: `@page 16:9

stack direction:col gap:md {
  label "Section A" { bold }
  label "Some content here"
  divider "or"
  label "Section B" { bold }
  label "Other content here"
}`,
      },
    ],
  },
  {
    id: 'layouts',
    label: 'Level 2: Layouts',
    description: '레이아웃 프리미티브로 구조를 잡습니다.',
    examples: [
      {
        id: 'flow',
        title: 'Flow',
        hint: 'flow는 노드를 화살표로 연결합니다. direction으로 방향을 지정합니다.',
        dsl: `@page 16:9

flow direction:right {
  node "Idea" #a { color: warning }
  node "Prototype" #b { color: info }
  node "Product" #c { color: success }
  node "Feedback" #d { color: accent }

  #a -> #b "design"
  #b -> #c "build"
  #c -> #d "measure"
  #d -> #a "learn"
}`,
      },
      {
        id: 'stack',
        title: 'Stack',
        hint: 'stack은 요소를 수직(col) 또는 수평(row)으로 쌓습니다.',
        dsl: `@page 16:9

stack direction:row gap:lg {
  box {
    background: primary
    heading "Column 1"
    list ["Item A", "Item B"]
  }
  box {
    background: info
    heading "Column 2"
    list ["Item C", "Item D"]
  }
  box {
    background: success
    heading "Column 3"
    list ["Item E", "Item F"]
  }
}`,
      },
      {
        id: 'grid',
        title: 'Grid',
        hint: 'grid는 행렬 배치입니다. cols로 열 수를 지정합니다.',
        dsl: `@page 16:9

grid cols:4 {
  cell "Q1" { header }
  cell "Q2" { header }
  cell "Q3" { header }
  cell "Q4" { header }

  cell "Plan" { color: primary }
  cell "Build" { color: info }
  cell "Test" { color: warning }
  cell "Ship" { color: success }
}`,
      },
      {
        id: 'tree',
        title: 'Tree',
        hint: 'tree는 계층 구조입니다. 노드 안에 노드를 중첩하면 부모-자식 관계가 됩니다.',
        dsl: `@page 16:9

tree direction:down {
  node "Animals" {
    node "Mammals" {
      node "Dog"
      node "Cat"
    }
    node "Birds" {
      node "Eagle"
      node "Penguin"
    }
  }
}`,
      },
      {
        id: 'layers',
        title: 'Layers',
        hint: 'layers는 위에서 아래로 쌓이는 레이어 구조입니다.',
        dsl: `@page 16:9

layers {
  layer "UI Components" { color: blue }
  layer "State Management" { color: accent }
  layer "API Layer" { color: green }
  layer "Infrastructure" { color: orange }
}`,
      },
    ],
  },
  {
    id: 'advanced',
    label: 'Level 3: Advanced',
    description: '중첩, 스타일링, 멀티씬 등 실전 수준의 표현입니다.',
    examples: [
      {
        id: 'nested',
        title: 'Nested Layouts',
        hint: '레이아웃 안에 레이아웃을 중첩할 수 있습니다.',
        dsl: `@page 16:9

stack direction:col gap:md {
  box {
    background: primary
    heading "Dashboard"
    stack direction:row gap:sm {
      node "Users" { color: info }
      node "Revenue" { color: success }
      node "Errors" { color: danger }
    }
  }
  stack direction:row gap:md {
    node "Chart Area" { color: muted }
    node "Activity Log" { color: muted }
  }
}`,
      },
      {
        id: 'edge-styles',
        title: 'Edge Styles',
        hint: '-> 실선, --> 점선, <-> 양방향, -- 선만. 라벨도 붙일 수 있습니다.',
        dsl: `@page 16:9

flow direction:right {
  node "A" #a
  node "B" #b
  node "C" #c
  node "D" #d

  #a -> #b "solid"
  #b --> #c "dashed"
  #c <-> #d "bidirectional"
}`,
      },
      {
        id: 'semantic-tokens',
        title: 'Semantic Tokens',
        hint: '시맨틱 토큰으로 구체적 값 없이 의도를 표현합니다.',
        dsl: `@page 16:9

stack direction:row gap:xl {
  box {
    background: primary
    shadow: lg
    radius: lg
    heading "Primary"
    list ["shadow: lg", "radius: lg"]
  }
  box {
    background: warning
    shadow: sm
    radius: sm
    heading "Warning"
    list ["shadow: sm", "radius: sm"]
  }
  box {
    background: danger
    shadow: md
    radius: md
    heading "Danger"
    list ["shadow: md", "radius: md"]
  }
}`,
      },
      {
        id: 'multi-scene',
        title: 'Multi-Scene',
        hint: 'scene으로 여러 장면을 선언합니다. 프레젠테이션에 활용할 수 있습니다.',
        dsl: `@page 16:9

scene "Problem" {
  stack direction:col gap:md {
    label "The Problem" { bold, font-size: xl }
    node "Manual processes are slow" { color: danger }
    node "Error-prone repetition" { color: warning }
  }
}

scene "Solution" {
  flow direction:right {
    node "Automate" #a { color: primary }
    node "Validate" #b { color: info }
    node "Deploy" #c { color: success }

    #a -> #b
    #b -> #c
  }
}`,
      },
      {
        id: 'complex-flow',
        title: 'Complex Flow',
        hint: '복잡한 분기와 합류를 ID와 연결로 표현합니다.',
        dsl: `@page 16:9

flow direction:right {
  node "Request" #req { color: muted }
  node "Auth" #auth { color: warning }
  node "Cache" #cache { color: info }
  node "API" #api { color: primary }
  node "DB" #db { shape: diamond, color: accent }
  node "Response" #res { color: success }

  #req -> #auth
  #auth -> #cache
  #auth -> #api
  #cache -> #res "hit"
  #api -> #db
  #db -> #res "data"
}`,
      },
    ],
  },
];
