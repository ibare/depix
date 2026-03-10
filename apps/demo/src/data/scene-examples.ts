export interface SceneExample {
  id: string;
  title: string;
  description: string;
  dsl: string;
}

export const SCENE_EXAMPLES: SceneExample[] = [
  {
    id: 'title-scene',
    title: 'Title Scene',
    description: '표지 슬라이드. 중앙에 큰 제목과 부제를 배치한다.',
    dsl: `@presentation
@ratio 16:9

scene "cover" {
  layout: title
  heading "Depix Slide DSL"
  label "Declarative Presentations"
  label "2025 Q1"
}`,
  },
  {
    id: 'statement-scene',
    title: 'Statement Scene',
    description: '핵심 메시지 하나를 크게 강조하는 레이아웃.',
    dsl: `@presentation
@ratio 16:9

scene "message" {
  layout: statement
  heading "Simple DSL, Beautiful Slides"
  label "No design tools needed"
}`,
  },
  {
    id: 'bullets-scene',
    title: 'Bullets Scene',
    description: '제목과 핵심 포인트 목록을 보여주는 가장 기본적인 레이아웃.',
    dsl: `@presentation
@ratio 16:9

scene "agenda" {
  layout: bullets
  heading "Why Depix?"
  bullet {
    item "Declarative: describe what, not how"
    item "Version-controlled: diffs that make sense"
    item "Themeable: one theme, all slides"
    item "Extensible: custom layouts welcome"
  }
}`,
  },
  {
    id: 'big-number-scene',
    title: 'Big Number Scene',
    description: '숫자 지표를 크게 강조하는 레이아웃.',
    dsl: `@presentation
@ratio 16:9

scene "metrics" {
  layout: big-number
  heading "2025 Q1 Results"
  stat "340%" { label: "Revenue Growth" }
  stat "1.2M" { label: "Active Users" }
  stat "99.9%" { label: "Uptime SLA" }
}`,
  },
  {
    id: 'quote-scene',
    title: 'Quote Scene',
    description: '인용문을 중앙에 크게 배치하는 레이아웃.',
    dsl: `@presentation
@ratio 16:9

scene "inspiration" {
  layout: quote
  quote "The best way to predict the future is to invent it." {
    attribution: "Alan Kay"
  }
}`,
  },
  {
    id: 'two-column-scene',
    title: 'Two Column Scene',
    description: '좌우 2분할 비교 레이아웃.',
    dsl: `@presentation
@ratio 16:9

scene "compare" {
  layout: two-column
  heading "Before vs After"
  column {
    heading "Before" { level: 2 }
    label "Manual diagram tools"
    label "Hours of tweaking"
    label "Hard to version control"
  }
  column {
    heading "After" { level: 2 }
    label "Declarative DSL"
    label "Instant rendering"
    label "Git-friendly diffs"
  }
}`,
  },
  {
    id: 'three-column-scene',
    title: 'Three Column Scene',
    description: '3분할 레이아웃으로 기능을 나열한다.',
    dsl: `@presentation
@ratio 16:9

scene "features" {
  layout: three-column
  heading "Core Features"
  column {
    heading "Parse" { level: 2 }
    label "DSL v2 Tokenizer"
    label "Error recovery"
  }
  column {
    heading "Compile" { level: 2 }
    label "13-pass pipeline"
    label "Theme resolution"
  }
  column {
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
    dsl: `@presentation
@ratio 16:9

scene "product" {
  layout: image-text
  heading "Product Overview"
  image "product-screenshot.png" { alt: "Product Screenshot" }
  label "A powerful DSL for creating presentations"
  label "No design tools required"
  label "Version-controlled and git-friendly"
}`,
  },
  {
    id: 'icon-grid-scene',
    title: 'Icon Grid Scene',
    description: '아이콘과 설명을 그리드로 배치. SaaS 기능 소개에 적합.',
    dsl: `@presentation
@ratio 16:9

scene "features" {
  layout: icon-grid
  heading "Platform Features"
  icon "P" { label: "Parse", description: "Tokenizer + error recovery" }
  icon "C" { label: "Compile", description: "13-pass pipeline" }
  icon "R" { label: "Render", description: "Canvas + PNG export" }
  icon "E" { label: "Edit", description: "Real-time collaboration" }
}`,
  },
  {
    id: 'timeline-scene',
    title: 'Timeline Scene',
    description: '수평 타임라인으로 단계별 프로세스를 보여주는 레이아웃.',
    dsl: `@presentation
@ratio 16:9

scene "roadmap" {
  layout: timeline
  heading "Product Roadmap 2025"
  step "Q1" { label: "Research & Design" }
  step "Q2" { label: "Core Development" }
  step "Q3" { label: "Beta Launch" }
  step "Q4" { label: "GA Release" }
}`,
  },
  {
    id: 'full-presentation',
    title: 'Full Presentation (5 Slides)',
    description: '여러 레이아웃을 조합한 완성된 프레젠테이션 예시. 첫 번째 슬라이드가 렌더링된다.',
    dsl: `@presentation
@ratio 16:9
@transition fade

scene "title" {
  layout: title
  heading "AI Strategy 2025"
  label "Transforming Our Business"
}

scene "why" {
  layout: statement
  heading "AI is not optional anymore"
  label "Every competitor is investing"
}

scene "plan" {
  layout: bullets
  heading "Our 3-Step Plan"
  bullet {
    item "Assess: audit current workflows"
    item "Pilot: run 3 AI experiments in Q2"
    item "Scale: roll out winners company-wide"
  }
}

scene "impact" {
  layout: big-number
  heading "Expected Impact"
  stat "+60%" { label: "Productivity" }
  stat "-35%" { label: "Manual Work" }
  stat "3x" { label: "Faster Delivery" }
}

scene "closing" {
  layout: quote
  quote "The future belongs to those who prepare for it today." {
    attribution: "Malcolm X"
  }
}`,
  },
];
