export interface DemoExample {
  id: string;
  title: string;
  description: string;
  category: Category;
  dsl: string;
}

export type Category = 'flow' | 'stack' | 'grid' | 'tree' | 'layers' | 'multi';

export const CATEGORIES: { id: Category | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'flow', label: 'Flow' },
  { id: 'stack', label: 'Stack' },
  { id: 'grid', label: 'Grid' },
  { id: 'tree', label: 'Tree' },
  { id: 'layers', label: 'Layers' },
  { id: 'multi', label: 'Multi-Scene' },
];

export const EXAMPLES: DemoExample[] = [
  {
    id: 'photosynthesis',
    title: 'Photosynthesis',
    description: 'Light/dark reactions in a flow diagram',
    category: 'flow',
    dsl: `@page 16:9
@theme light

flow direction:right {
  node "Light Reaction" #light { color: yellow }
  node "Calvin Cycle" #dark { color: green }
  node "Glucose" #out { shape: diamond, color: success }

  #light -> #dark "ATP + NADPH"
  #dark -> #out "C6H12O6"
}`,
  },
  {
    id: 'react-lifecycle',
    title: 'React Lifecycle',
    description: 'Component lifecycle phases side by side',
    category: 'stack',
    dsl: `@page 16:9

stack direction:row gap:lg {
  box "Mounting" {
    color: primary
    list [
      "constructor()"
      "render()"
      "componentDidMount()"
    ]
  }
  box "Updating" {
    color: info
    list [
      "shouldComponentUpdate()"
      "render()"
      "componentDidUpdate()"
    ]
  }
  box "Unmounting" {
    color: warning
    list [
      "componentWillUnmount()"
    ]
  }
}`,
  },
  {
    id: 'comparison-table',
    title: 'Framework Comparison',
    description: 'Grid-based comparison table',
    category: 'grid',
    dsl: `@page 16:9

grid cols:3 {
  cell ""
  cell "React" { header }
  cell "Vue" { header }

  cell "Learning Curve" { header }
  cell "Moderate" { color: warning }
  cell "Easy" { color: success }

  cell "Performance" { header }
  cell "Fast" { color: success }
  cell "Fast" { color: success }

  cell "Ecosystem" { header }
  cell "Vast" { color: primary }
  cell "Growing" { color: info }
}`,
  },
  {
    id: 'nlp-pipeline',
    title: 'NLP Pipeline',
    description: 'Natural language processing data flow',
    category: 'flow',
    dsl: `@page 16:9

flow direction:right {
  node "Raw Text" #input
  node "Tokenizer" #tok
  node "POS Tagger" #pos
  node "NER" #ner { color: accent }
  node "Output" #out { shape: diamond }

  #input -> #tok
  #tok -> #pos
  #pos -> #ner
  #ner -> #out "entities"
}`,
  },
  {
    id: 'nested-stack',
    title: 'Candlestick Legend',
    description: 'Nested stacks for chart legend layout',
    category: 'stack',
    dsl: `@page 16:9

stack direction:col gap:md {
  box "Candlestick Chart" {
    color: primary
    stack direction:row gap:sm {
      box "Bullish" { color: success }
      box "Bearish" { color: danger }
    }
  }
  stack direction:row gap:md {
    box "Volume" { color: info }
    box "Moving Avg" { color: warning }
    box "RSI" { color: accent }
  }
}`,
  },
  {
    id: 'org-chart',
    title: 'Organization Chart',
    description: 'Hierarchical tree of company roles',
    category: 'tree',
    dsl: `@page 16:9

tree direction:down {
  node "CEO" {
    node "CTO" {
      node "Frontend"
      node "Backend"
      node "Infra"
    }
    node "CFO" {
      node "Accounting"
      node "Finance"
    }
    node "COO" {
      node "HR"
      node "Operations"
    }
  }
}`,
  },
  {
    id: 'tech-stack',
    title: 'Tech Stack',
    description: 'Layered architecture overview',
    category: 'layers',
    dsl: `@page 16:9

layers {
  layer "Frontend" { color: blue }
  layer "API Gateway" { color: accent }
  layer "Microservices" { color: green }
  layer "Database" { color: orange }
}`,
  },
  {
    id: 'multi-scene',
    title: 'Multi-Scene Presentation',
    description: 'Multiple scenes with transitions',
    category: 'multi',
    dsl: `@page 16:9

scene "Overview" {
  flow direction:right {
    node "Plan" #a
    node "Build" #b
    node "Ship" #c

    #a -> #b
    #b -> #c
  }
}

scene "Details" {
  stack direction:row gap:lg {
    box "Plan" {
      color: primary
      list [
        "Requirements"
        "Design"
        "Prototype"
      ]
    }
    box "Build" {
      color: info
      list [
        "Develop"
        "Test"
        "Review"
      ]
    }
    box "Ship" {
      color: success
      list [
        "Deploy"
        "Monitor"
        "Iterate"
      ]
    }
  }
}`,
  },
];
