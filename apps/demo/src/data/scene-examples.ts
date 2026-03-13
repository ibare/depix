export interface SceneExample {
  id: string;
  title: string;
  description: string;
  layout: string;
  dsl: string;
}

export const SCENE_EXAMPLES: SceneExample[] = [
  // ---------------------------------------------------------------------------
  // Layout Presets — 14 layouts, one example each
  // ---------------------------------------------------------------------------
  {
    id: 'layout-full',
    title: 'Full Layout',
    description: '전체 캔버스를 body 슬롯 하나로 사용. 다이어그램을 꽉 채워 배치할 때 적합.',
    layout: 'full',
    dsl: `@ratio 16:9

scene "system" {
  layout: full
  body: flow direction:right {
    node "Client" #a { color: primary }
    node "Server" #b { color: accent }
    node "Database" #c { shape: diamond, color: success }
    #a -> #b "API"
    #b -> #c
  }
}`,
  },
  {
    id: 'layout-center',
    title: 'Center Layout',
    description: '중앙에 내용을 배치. 타이틀, 인용문, 강조 메시지에 적합.',
    layout: 'center',
    dsl: `@ratio 16:9

scene "cover" {
  layout: center
  body: column {
    heading "Depix Slide DSL"
    label "Declarative Presentations"
    label "2025 Q1"
  }
}`,
  },
  {
    id: 'layout-split',
    title: 'Split Layout',
    description: '좌우 2분할. left, right 슬롯으로 나란히 배치.',
    layout: 'split',
    dsl: `@ratio 16:9

scene "compare" {
  layout: split
  left: column {
    heading "Plan A"
    label "Simple and fast"
    label "Low cost"
    label "Basic support"
  }
  right: column {
    heading "Plan B"
    label "Feature-rich"
    label "Premium pricing"
    label "Priority support"
  }
}`,
  },
  {
    id: 'layout-rows',
    title: 'Rows Layout',
    description: '상하 2분할. top, bottom 슬롯으로 위아래 배치.',
    layout: 'rows',
    dsl: `@ratio 16:9

scene "summary" {
  layout: rows
  top: column {
    heading "Executive Summary"
    label "Revenue increased by 40% year over year"
  }
  bottom: column {
    heading "Key Takeaways"
    label "Customer satisfaction at all-time high"
    label "Market share expanded to 3 new regions"
  }
}`,
  },
  {
    id: 'layout-sidebar',
    title: 'Sidebar Layout',
    description: '메인 + 사이드바. main은 넓게, side는 좁게 배치.',
    layout: 'sidebar',
    dsl: `@ratio 16:9

scene "dashboard" {
  layout: sidebar
  main: column {
    heading "Dashboard Overview"
    label "Key metrics and performance indicators"
    label "Real-time monitoring data"
  }
  side: column {
    label "Navigation"
    label "Settings"
    label "Profile"
    label "Help"
  }
}`,
  },
  {
    id: 'layout-header',
    title: 'Header Layout',
    description: '상단 헤더 + 하단 본문. 가장 기본적인 프레젠테이션 레이아웃.',
    layout: 'header',
    dsl: `@ratio 16:9

scene "agenda" {
  layout: header
  header: heading "Why Depix?"
  body: bullet {
    item "Declarative: describe what, not how"
    item "Version-controlled: diffs that make sense"
    item "Themeable: one theme, all slides"
    item "Extensible: custom layouts welcome"
  }
}`,
  },
  {
    id: 'layout-header-split',
    title: 'Header-Split Layout',
    description: '상단 헤더 + 좌우 분할. 비교, 2단 구성에 적합.',
    layout: 'header-split',
    dsl: `@ratio 16:9

scene "compare" {
  layout: header-split
  header: heading "Before vs After"
  left: column {
    heading "Before" { level: 2 }
    label "Manual diagram tools"
    label "Hours of tweaking"
    label "Hard to version control"
  }
  right: column {
    heading "After" { level: 2 }
    label "Declarative DSL"
    label "Instant rendering"
    label "Git-friendly diffs"
  }
}`,
  },
  {
    id: 'layout-header-rows',
    title: 'Header-Rows Layout',
    description: '상단 헤더 + 상하 분할 본문.',
    layout: 'header-rows',
    dsl: `@ratio 16:9

scene "analysis" {
  layout: header-rows
  header: heading "Analysis Results"
  top: column {
    heading "Findings" { level: 2 }
    label "Performance improved by 60%"
    label "Error rate reduced to 0.1%"
  }
  bottom: column {
    heading "Recommendations" { level: 2 }
    label "Scale infrastructure by Q3"
    label "Implement automated monitoring"
  }
}`,
  },
  {
    id: 'layout-header-sidebar',
    title: 'Header-Sidebar Layout',
    description: '상단 헤더 + 메인/사이드바 본문.',
    layout: 'header-sidebar',
    dsl: `@ratio 16:9

scene "workspace" {
  layout: header-sidebar
  header: heading "Project Workspace"
  main: column {
    heading "Editor" { level: 2 }
    label "Main editing area"
    label "Code and preview panels"
  }
  side: column {
    label "Files"
    label "Search"
    label "Extensions"
  }
}`,
  },
  {
    id: 'layout-grid',
    title: 'Grid Layout',
    description: '균등 그리드. cell 슬롯을 반복하여 N개 셀 배치.',
    layout: 'grid',
    dsl: `@ratio 16:9

scene "overview" {
  layout: grid
  cell: column {
    heading "Speed"
    label "Sub-50ms response"
  }
  cell: column {
    heading "Scale"
    label "10K+ concurrent"
  }
  cell: column {
    heading "Security"
    label "SOC2 compliant"
  }
  cell: column {
    heading "Support"
    label "24/7 available"
  }
}`,
  },
  {
    id: 'layout-header-grid',
    title: 'Header-Grid Layout',
    description: '상단 헤더 + 그리드 본문. 지표, 아이콘 그리드에 적합.',
    layout: 'header-grid',
    dsl: `@ratio 16:9

scene "metrics" {
  layout: header-grid
  header: heading "2025 Q1 Results"
  cell: stat "340%" { label: "Revenue Growth" }
  cell: stat "1.2M" { label: "Active Users" }
  cell: stat "99.9%" { label: "Uptime SLA" }
}`,
  },
  {
    id: 'layout-focus',
    title: 'Focus Layout',
    description: '중심 포커스 + 하단 셀들. 주요 항목 강조에 적합.',
    layout: 'focus',
    dsl: `@ratio 16:9

scene "spotlight" {
  layout: focus
  focus: column {
    heading "Core Platform"
    label "The unified engine powering everything"
  }
  cell: label "API"
  cell: label "SDK"
  cell: label "CLI"
}`,
  },
  {
    id: 'layout-header-focus',
    title: 'Header-Focus Layout',
    description: '헤더 + 포커스 + 셀. 가장 풍부한 계층 구조.',
    layout: 'header-focus',
    dsl: `@ratio 16:9

scene "product" {
  layout: header-focus
  header: heading "Product Line"
  focus: stat "1M+" { label: "Total Users" }
  cell: label "Enterprise"
  cell: label "Startup"
  cell: label "Individual"
}`,
  },
  {
    id: 'layout-custom',
    title: 'Custom Layout',
    description: '자유 배치. cell 슬롯이 세로로 쌓인다. layout 미지정 시 기본값.',
    layout: 'custom',
    dsl: `@ratio 16:9

scene "agenda" {
  layout: custom
  cell: heading "Part 1: Introduction"
  cell: heading "Part 2: Deep Dive"
  cell: heading "Part 3: Conclusion"
}`,
  },

  // ---------------------------------------------------------------------------
  // Applied Examples — real-world presentation patterns
  // ---------------------------------------------------------------------------
  {
    id: 'quote-scene',
    title: 'Quote Scene',
    description: '인용문을 중앙에 크게 배치하는 레이아웃.',
    layout: 'center',
    dsl: `@ratio 16:9

scene "inspiration" {
  layout: center
  body: quote "The best way to predict the future is to invent it." {
    attribution: "Alan Kay"
  }
}`,
  },
  {
    id: 'three-column-scene',
    title: 'Three Column Scene',
    description: '3분할 레이아웃으로 기능을 나열한다.',
    layout: 'header-grid',
    dsl: `@ratio 16:9

scene "features" {
  layout: header-grid
  header: heading "Core Features"
  cell: column {
    heading "Parse" { level: 2 }
    label "DSL Tokenizer"
    label "Error recovery"
  }
  cell: column {
    heading "Compile" { level: 2 }
    label "13-pass pipeline"
    label "Theme resolution"
  }
  cell: column {
    heading "Render" { level: 2 }
    label "Canvas output"
    label "PNG export"
  }
}`,
  },
  {
    id: 'image-text-scene',
    title: 'Image + Text Scene',
    description: '이미지와 텍스트를 좌우로 배치하는 레이아웃. 제품 소개에 적합.',
    layout: 'header-split',
    dsl: `@ratio 16:9

scene "product" {
  layout: header-split
  header: heading "Product Overview"
  left: image "product-screenshot.png" { alt: "Product Screenshot" }
  right: column {
    label "A powerful DSL for creating presentations"
    label "No design tools required"
    label "Version-controlled and git-friendly"
  }
}`,
  },
  {
    id: 'icon-grid-scene',
    title: 'Icon Grid Scene',
    description: '아이콘과 설명을 그리드로 배치. SaaS 기능 소개에 적합.',
    layout: 'header-grid',
    dsl: `@ratio 16:9

scene "features" {
  layout: header-grid
  header: heading "Platform Features"
  cell: icon "P" { label: "Parse", description: "Tokenizer + error recovery" }
  cell: icon "C" { label: "Compile", description: "13-pass pipeline" }
  cell: icon "R" { label: "Render", description: "Canvas + PNG export" }
  cell: icon "E" { label: "Edit", description: "Real-time collaboration" }
}`,
  },
  {
    id: 'timeline-scene',
    title: 'Timeline Scene',
    description: '수평 타임라인으로 단계별 프로세스를 보여주는 레이아웃.',
    layout: 'header-grid',
    dsl: `@ratio 16:9

scene "roadmap" {
  layout: header-grid
  header: heading "Product Roadmap 2025"
  cell: step "Q1" { label: "Research & Design" }
  cell: step "Q2" { label: "Core Development" }
  cell: step "Q3" { label: "Beta Launch" }
  cell: step "Q4" { label: "GA Release" }
}`,
  },
  {
    id: 'comparison-scene',
    title: 'Comparison Scene',
    description: 'Before/After 비교 레이아웃. 변화 전후를 나란히 보여준다.',
    layout: 'header-split',
    dsl: `@ratio 16:9

scene "comparison" {
  layout: header-split
  header: heading "Migration Impact"
  left: column {
    heading "Before" { level: 2 }
    label "Manual deployments"
    label "4-hour release cycles"
    label "Frequent rollbacks"
    label "No visibility"
  }
  right: column {
    heading "After" { level: 2 }
    label "Fully automated CI/CD"
    label "15-minute releases"
    label "Zero-downtime deploys"
    label "Real-time dashboards"
  }
}`,
  },
  {
    id: 'full-presentation',
    title: 'Full Presentation (5 Slides)',
    description: '여러 레이아웃을 조합한 완성된 프레젠테이션 예시.',
    layout: 'center',
    dsl: `@ratio 16:9
@transition fade

scene "title" {
  layout: center
  body: column {
    heading "AI Strategy 2025"
    label "Transforming Our Business"
  }
}

scene "why" {
  layout: center
  body: column {
    heading "AI is not optional anymore"
    label "Every competitor is investing"
  }
}

scene "plan" {
  layout: header
  header: heading "Our 3-Step Plan"
  body: bullet {
    item "Assess: audit current workflows"
    item "Pilot: run 3 AI experiments in Q2"
    item "Scale: roll out winners company-wide"
  }
}

scene "impact" {
  layout: header-grid
  header: heading "Expected Impact"
  cell: stat "+60%" { label: "Productivity" }
  cell: stat "-35%" { label: "Manual Work" }
  cell: stat "3x" { label: "Faster Delivery" }
}

scene "closing" {
  layout: center
  body: quote "The future belongs to those who prepare for it today." {
    attribution: "Malcolm X"
  }
}`,
  },

  // ---------------------------------------------------------------------------
  // Data — table & chart in presentation
  // ---------------------------------------------------------------------------
  {
    id: 'table-scene',
    title: 'Table Scene',
    description: '데이터를 표로 시각화하는 레이아웃. 인라인 데이터를 바로 정의한다.',
    layout: 'header',
    dsl: `@ratio 16:9

scene "metrics" {
  layout: header
  header: heading "Q1 Performance"
  body: table {
    "Metric" "Target" "Actual" "Status"
    "Revenue" 500 520 "Exceeded"
    "Users" 10000 9800 "On Track"
    "NPS" 70 75 "Exceeded"
    "Churn" 5 4.2 "Exceeded"
  }
}`,
  },
  {
    id: 'chart-scene',
    title: 'Chart Scene',
    description: '@data로 정의한 데이터를 차트로 시각화한다.',
    layout: 'header',
    dsl: `@ratio 16:9

@data "revenue" {
  "Quarter" "Revenue" "Profit"
  "Q1" 120 45
  "Q2" 185 62
  "Q3" 240 89
  "Q4" 310 115
}

scene "numbers" {
  layout: header
  header: heading "Revenue Overview"
  body: table "revenue"
}

scene "trend" {
  layout: header
  header: heading "Revenue Trend"
  body: chart "revenue" type:bar x:"Quarter" y:"Revenue"
}`,
  },

  // ---------------------------------------------------------------------------
  // Diagrams in Scene — flow, tree, layers, grid
  // ---------------------------------------------------------------------------
  {
    id: 'flow-diagram-scene',
    title: 'Flow Diagram Scene',
    description: 'scene 안에 flow 다이어그램을 직접 배치한다.',
    layout: 'full',
    dsl: `@ratio 16:9

scene "architecture" {
  layout: full
  body: flow direction:right {
    node "Client" #client { color: muted }
    node "API Gateway" #gw { color: accent }
    node "Auth Service" #auth { color: primary }
    node "User Service" #user { color: info }
    node "Database" #db { shape: diamond, color: success }

    #client -> #gw
    #gw -> #auth
    #gw -> #user
    #user -> #db
  }
}`,
  },
  {
    id: 'tree-diagram-scene',
    title: 'Tree Diagram Scene',
    description: 'scene 안에 tree 다이어그램으로 조직도를 표현한다.',
    layout: 'full',
    dsl: `@ratio 16:9

scene "org-chart" {
  layout: full
  body: tree direction:down {
    node "CEO" {
      node "CTO" {
        node "Frontend"
        node "Backend"
        node "DevOps"
      }
      node "CPO" {
        node "Design"
        node "Research"
      }
      node "CFO" {
        node "Finance"
        node "Legal"
      }
    }
  }
}`,
  },
  {
    id: 'layers-diagram-scene',
    title: 'Layers Diagram Scene',
    description: 'scene 안에 layers로 아키텍처 스택을 표현한다.',
    layout: 'full',
    dsl: `@ratio 16:9

scene "tech-stack" {
  layout: full
  body: layers {
    layer "Presentation" { color: primary }
    layer "Application Logic" { color: accent }
    layer "Domain Model" { color: info }
    layer "Infrastructure" { color: success }
    layer "Database" { color: warning }
  }
}`,
  },
  {
    id: 'mixed-diagram-scene',
    title: 'Mixed Diagrams (Multi-Scene)',
    description: '여러 scene에 서로 다른 다이어그램 유형을 배치한 프레젠테이션.',
    layout: 'center',
    dsl: `@ratio 16:9
@transition slide-left

scene "cover" {
  layout: center
  body: column {
    heading "System Architecture"
    label "Technical Overview"
  }
}

scene "data-flow" {
  layout: full
  body: flow direction:right {
    node "Ingestion" #in { color: primary }
    node "Processing" #proc { color: accent }
    node "Storage" #store { shape: diamond, color: success }
    node "Analytics" #out { color: info }

    #in -> #proc
    #proc -> #store
    #store -> #out
  }
}

scene "team" {
  layout: full
  body: tree direction:down {
    node "Tech Lead" {
      node "Frontend" {
        node "React"
        node "Mobile"
      }
      node "Backend" {
        node "API"
        node "Data"
      }
    }
  }
}

scene "stack" {
  layout: full
  body: layers {
    layer "CDN + Edge" { color: muted }
    layer "Frontend App" { color: primary }
    layer "API Gateway" { color: accent }
    layer "Microservices" { color: info }
    layer "Message Queue" { color: warning }
    layer "Database Cluster" { color: success }
  }
}`,
  },
];
