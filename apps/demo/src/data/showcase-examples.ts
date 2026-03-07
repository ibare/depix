export interface ShowcaseExample {
  id: string;
  title: string;
  description: string;
  ascii: string;
  dsl: string;
}

export const SHOWCASE_EXAMPLES: ShowcaseExample[] = [
  {
    id: 'data-pipeline',
    title: 'Data Pipeline',
    description: 'ASCII로 그리던 데이터 흐름을 DSL 한 줄로 표현한다.',
    ascii: `+-------+     +---------+     +--------+
| Input | --> | Process | --> | Output |
+-------+     +---------+     +--------+`,
    dsl: `@page 16:9

flow direction:right {
  node "Input" #in
  node "Process" #proc
  node "Output" #out { shape: diamond }

  #in -> #proc
  #proc -> #out
}`,
  },
  {
    id: 'comparison-table',
    title: 'Comparison Table',
    description: 'ASCII 테이블 대신 grid로 비교표를 선언한다.',
    ascii: `|          | React   | Vue     |
|----------|---------|---------|
| Learning | Medium  | Easy    |
| Perf     | Fast    | Fast    |
| Ecosystem| Vast    | Growing |`,
    dsl: `@page 16:9

grid cols:3 {
  cell ""
  cell "React" { header }
  cell "Vue" { header }

  cell "Learning" { header }
  cell "Medium" { color: warning }
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
    id: 'org-chart',
    title: 'Organization Chart',
    description: '들여쓰기로 표현하던 조직도를 tree로 선언한다.',
    ascii: `         CEO
        / | \\
      /   |   \\
   CTO   CFO   COO
   /|\\    |\\    |\\
  F B I  Ac Fi  HR Ops`,
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
    title: 'Architecture Stack',
    description: '수평선으로 나누던 아키텍처 레이어를 layers로 표현한다.',
    ascii: `========================
      Frontend
------------------------
     API Gateway
------------------------
    Microservices
------------------------
      Database
========================`,
    dsl: `@page 16:9

layers {
  layer "Frontend" { color: blue }
  layer "API Gateway" { color: accent }
  layer "Microservices" { color: green }
  layer "Database" { color: orange }
}`,
  },
  {
    id: 'step-process',
    title: 'Step-by-Step Process',
    description: '번호 매긴 단계를 stack + list로 구조화한다.',
    ascii: `1. Plan        2. Build       3. Ship
- Requirements - Develop      - Deploy
- Design       - Test         - Monitor
- Prototype    - Review       - Iterate`,
    dsl: `@page 16:9

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
}`,
  },
  {
    id: 'system-design',
    title: 'System Design',
    description: '복합적인 시스템 구조를 flow + group으로 표현한다.',
    ascii: `Client --> [API Gateway] --> Service A
                        \\-> Service B
                              |
                           [  DB  ]`,
    dsl: `@page 16:9

flow direction:right {
  node "Client" #client { color: muted }
  node "API Gateway" #gw { color: accent }
  node "Service A" #a { color: primary }
  node "Service B" #b { color: info }
  node "Database" #db { shape: diamond, color: warning }

  #client -> #gw
  #gw -> #a
  #gw -> #b
  #b -> #db
}`,
  },
  {
    id: 'microservices',
    title: 'Microservices with Groups',
    description: 'flow 안에 group을 중첩하여 서비스 클러스터와 연결을 한 번에 표현한다.',
    ascii: `[Client]
    |
[  API Gateway  ]
   /          \\
[Auth Svc]  [User Svc]
   \\          /
   [  Database  ]`,
    dsl: `@page 16:9

flow direction:down {
  node "Client" #client { color: muted }

  group "Gateway" #gw {
    label "API Gateway"
    badge "Rate Limit" { color: warning }
  }

  group "Services" #svc {
    label "Auth Service"
    label "User Service"
  }

  node "Database" #db { shape: diamond, color: success }

  #client -> #gw
  #gw -> #svc
  #svc -> #db
}`,
  },
  {
    id: 'cloud-infra',
    title: 'Cloud Infrastructure',
    description: 'layers와 box를 중첩하여 인프라 계층별 서비스를 구조화한다.',
    ascii: `===== Client Tier =====
  Browser | Mobile App
===== App Tier =======
  LB | Web | API
===== Data Tier ======
  Postgres | Redis | S3`,
    dsl: `@page 16:9

layers {
  box "Client Tier" {
    color: primary
    node "Browser"
    node "Mobile App"
  }
  box "Application Tier" {
    color: info
    node "Load Balancer"
    node "Web Server"
    node "API Server"
  }
  box "Data Tier" {
    color: success
    node "PostgreSQL"
    node "Redis Cache"
    node "Object Storage"
  }
}`,
  },
  {
    id: 'product-overview',
    title: 'Product Overview',
    description: 'tree로 팀 구조를, grid로 기술 매트릭스를 나란히 배치하여 프로젝트 전체를 조감한다.',
    ascii: `     PM
    / \\
  FE   BE        | FE  | BE  |
  /\\    |    +   -+-----+-----+
 R  V  Node      | TS  | Go  |`,
    dsl: `@page 16:9

tree direction:down {
  node "Project Manager" {
    node "Frontend" {
      node "React"
      node "Vue"
    }
    node "Backend" {
      node "Node.js"
    }
  }
}

grid cols:3 {
  cell "" { header }
  cell "Frontend" { header }
  cell "Backend" { header }

  cell "Language" { header }
  cell "TypeScript" { color: primary }
  cell "Go" { color: info }

  cell "Deploy" { header }
  cell "Vercel" { color: success }
  cell "AWS" { color: warning }
}`,
  },
];
