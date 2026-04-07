// synced_with: 'complete-examples@c8eb48e9'

export const completeExamples = {
  id: 'complete-examples',
  title: 'Complete Examples',
  titleKo: '종합 예제',
  content: `
The examples below combine multiple Depix concepts into real-world scenarios. Each one shows how directives, scenes, layouts, elements, and blocks work together.

---

## Presentation Slide

A multi-scene presentation with a title slide, metrics, and bullet points. Demonstrates **multiple scenes**, **header layouts**, **stat elements**, and **text formatting flags**.

\`\`\`depix
@page 16:9

scene "Title" {
  layout: center
  body: heading "Quarterly Report" bold
}

scene "Metrics" {
  layout: header-split
  header: heading "Key Numbers"
  left: stat "42%" { label: "Growth" }
  right: stat "$1.2M" { label: "Revenue" }
}

scene "Details" {
  layout: header
  header: heading "Process"
  body: bullet ["Analyze data", "Build models", "Deploy", "Monitor"]
}
\`\`\`

**Concepts used:** \`@page\` directive, three scene types (\`center\`, \`header-split\`, \`header\`), \`stat\` elements with labels, \`bullet\` list, \`bold\` flag.

---

## Flowchart

A complete **Binary Search** algorithm flowchart with three decision branches, two return paths, and two retry loops. Demonstrates **flow blocks**, **multi-way branching**, **edge labels**, **back-edges**, and **inline styles**.

\`\`\`depix
@page 4:3

scene {
  layout: full
  body: flow {
    pill "Start" #start { background: primary }
    parallelogram "Input A, T" #input
    rect "low = 0, high = n-1" #init
    diamond "low <= high?" #loop
    rect "mid = (low+high)/2" #mid
    diamond "A[mid] == T?" #eq
    diamond "A[mid] < T?" #lt
    rect "low = mid + 1" #incr
    rect "high = mid - 1" #decr
    parallelogram "Return mid" #found { background: #4ade80, color: white }
    parallelogram "Return -1" #notfound { background: #ff4444, color: white }
    pill "End" #end { background: primary }

    #start -> #input
    #input -> #init
    #init -> #loop
    #loop -> #notfound "No"
    #loop -> #mid "Yes"
    #mid -> #eq
    #eq -> #found "Yes"
    #eq -> #lt "No"
    #lt -> #incr "Yes"
    #lt -> #decr "No"
    #incr --> #loop "Retry"
    #decr --> #loop "Retry"
    #found -> #end
    #notfound -> #end
  }
}
\`\`\`

**Concepts used:** Four shape types (\`pill\`, \`parallelogram\`, \`diamond\`, \`rect\`), three nested decisions (loop guard, equality, comparison), two back-edges that converge on the loop head, two terminating return paths, dashed arrows for retry semantics, hex color styling for success/failure states.

---

## Data Dashboard

A dashboard combining named datasets, charts, and stat cards. Demonstrates **\`@data\` directive**, **chart blocks**, **header-split layout**, and **stat elements**.

\`\`\`depix
@page 16:9

@data "revenue" {
  "Month" "Revenue"
  "Jan" 100
  "Feb" 120
  "Mar" 150
  "Apr" 130
}

scene "Dashboard" {
  layout: header-split
  header: heading "Revenue Overview"
  left: chart "revenue" type:bar
  right: stat "$500K" { label: "Total Revenue" }
}
\`\`\`

**Concepts used:** \`@data\` with header row and numeric values, \`chart\` block referencing data by name, \`header-split\` layout for side-by-side presentation.

---

## Architecture Diagram

A layered system architecture showing client, API, and data tiers. Demonstrates **layers block**, **layer containers** with labels, **cylinder shapes** for databases, and **full layout**.

\`\`\`depix
@page 16:9

scene {
  layout: full
  body: layers {
    layer "Client" {
      node "Browser"
      node "Mobile App"
    }
    layer "API" {
      node "Gateway"
      node "Auth Service"
    }
    layer "Data" {
      cylinder "PostgreSQL"
      cylinder "Redis"
    }
  }
}
\`\`\`

**Concepts used:** \`layers\` block for tier visualization, \`layer\` containers with named zones, \`cylinder\` shape for storage, implicit scene naming.

---

## Auto-Height Document

A content-driven document that grows vertically to fit. Demonstrates **auto-height mode** (\`@page *\`), **box containers**, **heading and list elements**, and content that is not constrained to a fixed slide ratio.

\`\`\`depix
@page *

box {
  background: primary
  heading "Shopping List"
  list [
    "Apples"
    "Bananas"
    "Milk"
    "Bread"
    "Eggs"
    "Cheese"
  ]
}
\`\`\`

**Concepts used:** \`@page *\` for auto-height canvas, \`box\` with background styling, \`heading\` and \`list\` elements. The canvas height adjusts automatically — no content is cropped.
  `,
  contentKo: `
아래 예제들은 Depix의 여러 개념을 결합하여 실제 사용 시나리오를 보여줍니다. 디렉티브, 씬, 레이아웃, 요소, 블록이 어떻게 함께 동작하는지 확인할 수 있습니다.

---

## 프레젠테이션 슬라이드

타이틀 슬라이드, 지표, 불릿 포인트로 구성된 다중 씬 프레젠테이션입니다. **여러 씬**, **헤더 레이아웃**, **stat 요소**, **텍스트 서식 플래그**를 활용합니다.

\`\`\`depix
@page 16:9

scene "Title" {
  layout: center
  body: heading "Quarterly Report" bold
}

scene "Metrics" {
  layout: header-split
  header: heading "Key Numbers"
  left: stat "42%" { label: "Growth" }
  right: stat "$1.2M" { label: "Revenue" }
}

scene "Details" {
  layout: header
  header: heading "Process"
  body: bullet ["Analyze data", "Build models", "Deploy", "Monitor"]
}
\`\`\`

**사용된 개념:** \`@page\` 디렉티브, 세 가지 씬 타입(\`center\`, \`header-split\`, \`header\`), 라벨이 있는 \`stat\` 요소, \`bullet\` 리스트, \`bold\` 플래그.

---

## 플로차트

세 단계 의사결정 분기, 두 개의 반환 경로, 두 개의 재시도 루프가 포함된 완전한 **이진 탐색(Binary Search)** 알고리즘 플로우차트입니다. **flow 블록**, **다중 분기**, **엣지 라벨**, **백엣지**, **인라인 스타일**을 보여줍니다.

\`\`\`depix
@page 4:3

scene {
  layout: full
  body: flow {
    pill "Start" #start { background: primary }
    parallelogram "Input A, T" #input
    rect "low = 0, high = n-1" #init
    diamond "low <= high?" #loop
    rect "mid = (low+high)/2" #mid
    diamond "A[mid] == T?" #eq
    diamond "A[mid] < T?" #lt
    rect "low = mid + 1" #incr
    rect "high = mid - 1" #decr
    parallelogram "Return mid" #found { background: #4ade80, color: white }
    parallelogram "Return -1" #notfound { background: #ff4444, color: white }
    pill "End" #end { background: primary }

    #start -> #input
    #input -> #init
    #init -> #loop
    #loop -> #notfound "No"
    #loop -> #mid "Yes"
    #mid -> #eq
    #eq -> #found "Yes"
    #eq -> #lt "No"
    #lt -> #incr "Yes"
    #lt -> #decr "No"
    #incr --> #loop "Retry"
    #decr --> #loop "Retry"
    #found -> #end
    #notfound -> #end
  }
}
\`\`\`

**사용된 개념:** 4가지 도형(\`pill\`, \`parallelogram\`, \`diamond\`, \`rect\`), 세 단계 중첩 의사결정(루프 가드, 동등성, 비교), 루프 머리로 수렴하는 두 개의 백엣지, 두 개의 종료 반환 경로, 재시도 의미를 표현하는 점선 화살표, 성공/실패 상태를 위한 헥스 컬러 스타일링.

---

## 데이터 대시보드

이름 있는 데이터셋, 차트, 통계 카드를 결합한 대시보드입니다. **\`@data\` 디렉티브**, **chart 블록**, **header-split 레이아웃**, **stat 요소**를 활용합니다.

\`\`\`depix
@page 16:9

@data "revenue" {
  "Month" "Revenue"
  "Jan" 100
  "Feb" 120
  "Mar" 150
  "Apr" 130
}

scene "Dashboard" {
  layout: header-split
  header: heading "Revenue Overview"
  left: chart "revenue" type:bar
  right: stat "$500K" { label: "Total Revenue" }
}
\`\`\`

**사용된 개념:** 헤더 행과 숫자 데이터를 가진 \`@data\`, 이름으로 데이터를 참조하는 \`chart\` 블록, 나란히 배치하는 \`header-split\` 레이아웃.

---

## 아키텍처 다이어그램

클라이언트, API, 데이터 계층으로 구성된 시스템 아키텍처입니다. **layers 블록**, 라벨이 있는 **layer 컨테이너**, 데이터베이스용 **cylinder 도형**, **full 레이아웃**을 보여줍니다.

\`\`\`depix
@page 16:9

scene {
  layout: full
  body: layers {
    layer "Client" {
      node "Browser"
      node "Mobile App"
    }
    layer "API" {
      node "Gateway"
      node "Auth Service"
    }
    layer "Data" {
      cylinder "PostgreSQL"
      cylinder "Redis"
    }
  }
}
\`\`\`

**사용된 개념:** 계층 시각화를 위한 \`layers\` 블록, 이름 있는 영역의 \`layer\` 컨테이너, 저장소용 \`cylinder\` 도형, 암시적 씬 이름.

---

## 자동 높이 문서

콘텐츠 양에 따라 세로로 늘어나는 문서입니다. **자동 높이 모드**(\`@page *\`), **box 컨테이너**, **heading과 list 요소**를 보여주며, 고정 슬라이드 비율에 제한받지 않습니다.

\`\`\`depix
@page *

box {
  background: primary
  heading "Shopping List"
  list [
    "Apples"
    "Bananas"
    "Milk"
    "Bread"
    "Eggs"
    "Cheese"
  ]
}
\`\`\`

**사용된 개념:** 자동 높이 캔버스를 위한 \`@page *\`, 배경 스타일이 있는 \`box\`, \`heading\`과 \`list\` 요소. 캔버스 높이가 자동 조정되어 콘텐츠가 잘리지 않습니다.
  `,
};
