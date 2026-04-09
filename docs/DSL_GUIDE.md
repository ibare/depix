# Depix DSL 가이드

Depix DSL은 좌표 없이 다이어그램의 구조와 의미만 선언하는 도메인 특화 언어이다. 컴파일러가 레이아웃을 자동으로 계산하여 완전히 해결된 IR(Intermediate Representation)을 생성한다.

---

## 기본 구조

```depix
@page 16:9

scene "제목" {
  layout: header
  header: heading "발표 제목"
  body: flow direction:right {
    node "A" #a
    node "B" #b
    #a -> #b "연결"
  }
}
```

DSL 문서는 **디렉티브**(`@page`, `@data` 등)와 **블록**(`scene`, `flow`, `grid` 등)으로 구성된다. `scene` 블록이 없는 DSL은 암묵적 씬으로 감싸져 동일한 파이프라인을 거친다.

---

## 디렉티브

문서 최상위에 선언하며, 전역 설정을 제어한다.

| 디렉티브 | 값 | 설명 |
|----------|-----|------|
| `@page` | `16:9`, `4:3`, `1:1`, `*` | 캔버스 비율. `*`는 콘텐츠 기반 자동 높이 |
| `@ratio` | `16:9` 등 | `@page`의 별칭 |
| `@style` | `default`, `sketch` | 드로잉 스타일 |
| `@transition` | `fade`, `slide-left`, `slide-right`, `slide-up`, `slide-down`, `zoom-in`, `zoom-out` | 씬 간 기본 전환 효과 |
| `@data` | `"name" { ... }` | 데이터셋 정의 (chart/table 블록에서 참조) |
| `@overrides` | `{ #id { x, y, w, h } }` | 에디터에서 요소 위치 수동 조정 |
| `@theme` | `"name"` | 테마 지정 |
| `@presentation` | (예약됨) | 프레젠테이션 모드 |

### @data 데이터셋

```depix
@data "sales" {
  "분기" "매출" "성장률"
  "Q1" 1200 15
  "Q2" 1500 25
  "Q3" 1800 20
  "Q4" 2100 17
}

chart "sales" type:bar
```

첫 번째 행은 컬럼 헤더로 처리된다. 이후 행은 데이터 행이다. `chart "sales"` 또는 `table "sales"`로 참조하면 해당 데이터셋이 자동으로 바인딩된다.

### @overrides 위치 보정

```depix
@overrides {
  #nodeA { x: 10, y: 20, w: 30, h: 15 }
  #nodeB { x: 50, y: 60 }
}
```

컴파일러가 자동 계산한 좌표를 에디터에서 수동으로 보정할 때 사용한다. 좌표는 0–100 상대 좌표계이다.

---

## 블록 타입

블록은 다이어그램의 구조적 컨테이너이다. 내부에 요소(element)와 자식 블록을 포함할 수 있다.

| 블록 | 용도 | 주요 속성 |
|------|------|----------|
| `flow` | 방향성 흐름 (플로우차트, 파이프라인) | `direction` |
| `tree` | 계층 구조 (조직도, 분류) | `direction` |
| `stack` | 수직/수평 나열 (목록, 비교) | `direction`, `gap` |
| `grid` | 행렬 배치 (비교표, 매트릭스) | `cols`, `rows`, `gap` |
| `layers` | 수직 레이어 (아키텍처 스택) | — |
| `box` | 스타일 컨테이너 (배경색/테두리) | `background`, `border` |
| `layer` | 존 라벨 컨테이너 (카테고리 라벨) | `background` |
| `group` | 시각적 그룹핑 (영역 구분) | — |
| `column` | 세로 콘텐츠 배치 | — |
| `table` | 데이터 테이블 (행/열) | — |
| `chart` | 차트 (`@data` 시각화) | `type` |
| `canvas` | 자유 좌표 배치 | — |

### 블록 중첩

블록은 다른 블록 안에 중첩할 수 있다.

```depix
stack direction:row gap:lg {
  box "Plan" { background: primary }
  box "Build" { background: info }
  box "Ship" { background: success }
}
```

### direction 속성

`flow`, `tree`, `stack` 블록은 방향을 지정할 수 있다.

```depix
flow direction:right { ... }   // 왼쪽 → 오른쪽 (기본)
flow direction:down  { ... }   // 위 → 아래
flow direction:left  { ... }   // 오른쪽 → 왼쪽
flow direction:up    { ... }   // 아래 → 위
```

---

## 요소 타입

요소(element)는 블록 안의 개별 시각적 단위이다.

### 노드/도형 요소

| 요소 | 설명 | 예시 |
|------|------|------|
| `node` | 기본 사각형 노드 | `node "서버" #server` |
| `diamond` | 마름모 (조건 분기) | `diamond "조건?" #cond` |
| `circle` | 원 | `circle "시작" #start` |
| `ellipse` | 타원 | `ellipse "프로세스"` |
| `pill` | 알약형 (둥근 사각형) | `pill "API"` |
| `hexagon` | 육각형 | `hexagon "서비스"` |
| `triangle` | 삼각형 | `triangle "경고"` |
| `parallelogram` | 평행사변형 (I/O) | `parallelogram "입력"` |
| `cylinder` | 원통 (DB) | `cylinder "PostgreSQL"` |
| `trapezoid` | 사다리꼴 | `trapezoid "로드밸런서"` |
| `rect` | 사각형 (node와 동일) | `rect "블록"` |
| `shape` | 범용 도형 | `shape "커스텀"` |

### 텍스트/콘텐츠 요소

| 요소 | 설명 | 예시 |
|------|------|------|
| `heading` | 제목 텍스트 | `heading "제목"` |
| `label` | 본문 텍스트 | `label "설명 텍스트"` |
| `text` | 일반 텍스트 | `text "내용"` |
| `bullet` | 글머리 기호 목록 | `bullet ["항목1", "항목2"]` |
| `list` | 목록 (bullet의 별칭) | `list ["A", "B"]` |
| `stat` | 통계 수치 | `stat "99.9%" { label: "Uptime" }` |
| `quote` | 인용문 | `quote "명언" { attribution: "저자" }` |
| `step` | 단계 표시 (원형) | `step "1"` |

### 기타 요소

| 요소 | 설명 | 예시 |
|------|------|------|
| `divider` | 구분선 | `divider` |
| `image` | 이미지 | `image "url"` |
| `cell` | 그리드 셀 | `cell "내용"` |
| `item` | 목록 항목 | `item "항목"` |
| `badge` | 뱃지 | `badge "NEW"` |
| `line` | 직선 | `line` |

### 요소 구문

```depix
// 기본: 타입 "라벨"
node "서버"

// ID 부여: 타입 "라벨" #id
node "서버" #server

// 인라인 속성: 타입 "라벨" key:value
node "서버" #server { background: primary }

// 플래그: bold, italic, outline, header, ordered 등
cell "제목" header bold

// 목록 항목: 대괄호 구문
bullet ["항목1", "항목2", "항목3"]

// 복합 속성
stat "99.9%" { label: "가동률", color: success }
quote "인용문" { attribution: "저자", color: primary }
```

---

## 엣지 (연결선)

노드 간 연결을 선언한다. `#id`로 노드를 참조한다.

### 엣지 연산자

| 연산자 | 설명 | 시각 |
|--------|------|------|
| `->` | 실선 단방향 화살표 | ─── ▶ |
| `-->` | 점선 단방향 화살표 | - - - ▶ |
| `--` | 실선 (화살표 없음) | ─── |
| `<->` | 양방향 화살표 | ◀ ─── ▶ |

### 엣지 구문

```depix
// 기본 연결
#a -> #b

// 라벨 포함
#a -> #b "데이터 전송"

// 체인 연결 (a→b, b→c)
#a -> #b -> #c

// 체인 + 라벨 (마지막 구간에 적용)
#a -> #b -> #c "완료"

// 다양한 스타일
#a --> #b "비동기"     // 점선
#a -- #b               // 화살표 없음
#a <-> #b "양방향"     // 양방향
```

### 사용 범위

엣지는 `flow`, `tree` 블록 내부에서 사용한다.

```depix
flow direction:right {
  node "클라이언트" #client
  node "서버"       #server
  cylinder "DB"     #db

  #client -> #server "요청"
  #server -> #db "쿼리"
  #db --> #server "결과"
  #server -> #client "응답"
}
```

---

## 씬 (Scene)

씬은 하나의 독립적인 다이어그램 단위이다. 슬롯 기반 레이아웃으로 요소를 배치한다.

### 기본 구문

```depix
scene "씬 제목" {
  layout: header
  header: heading "제목"
  body: flow direction:right {
    node "A" #a
    node "B" #b
    #a -> #b
  }
}
```

### 멀티 씬

하나의 DSL에 여러 씬을 선언할 수 있다. 각 씬은 독립적인 다이어그램이다.

```depix
scene "개요" {
  layout: full
  body: heading "프로젝트 개요"
}

scene "아키텍처" {
  layout: header-sidebar
  header: heading "시스템 구조"
  main: flow { ... }
  side: bullet ["특징1", "특징2"]
}
```

---

## 씬 레이아웃 프리셋

14가지 슬롯 기반 레이아웃을 제공한다.

| # | 프리셋 | 슬롯 | 설명 |
|---|--------|------|------|
| 1 | `full` | body | 전체 영역 단일 슬롯 |
| 2 | `center` | body | 가운데 정렬 (10% 여백) |
| 3 | `split` | left, right | 좌우 분할 (기본 50:50) |
| 4 | `rows` | top, bottom | 상하 분할 (기본 50:50) |
| 5 | `sidebar` | main, side | 메인-사이드바 (기본 70:30) |
| 6 | `header` | header, body | 헤더 + 본문 |
| 7 | `header-split` | header, left, right | 헤더 + 좌우 분할 |
| 8 | `header-rows` | header, top, bottom | 헤더 + 상하 분할 |
| 9 | `header-sidebar` | header, main, side | 헤더 + 메인-사이드바 |
| 10 | `grid` | cell x N | 다중 셀 그리드 |
| 11 | `header-grid` | header, cell x N | 헤더 + 다중 셀 그리드 |
| 12 | `focus` | focus, cell x N | 포커스(65%) + 하단 셀 |
| 13 | `header-focus` | header, focus, cell x N | 헤더 + 포커스 + 셀 |
| 14 | `custom` | cell x N | 수직 스택 폴백 |

### 슬롯 구문

`slotName: element` 또는 `slotName: block` 형태로 슬롯에 콘텐츠를 배치한다.

```depix
scene "대시보드" {
  layout: header-sidebar
  header: heading "시스템 모니터링"
  main: flow direction:down {
    node "API Gateway" #gw
    node "Services"    #svc
    #gw -> #svc
  }
  side: stat "99.9%" { label: "가동률" }
}
```

### 슬롯 이름 목록

| 슬롯 | 용도 | 반복 가능 |
|------|------|:---------:|
| `header` | 상단 헤더 영역 | |
| `body` | 본문 영역 | |
| `left` | 좌측 영역 | |
| `right` | 우측 영역 | |
| `top` | 상단 영역 | |
| `bottom` | 하단 영역 | |
| `main` | 메인 영역 | |
| `side` | 사이드바 영역 | |
| `focus` | 포커스 영역 | |
| `cell` | 그리드 셀 | O |

`cell`만 여러 번 선언할 수 있다 (grid 셀). 나머지 슬롯은 프리셋당 유일하다.

### 레이아웃 속성

```depix
// 비율 조정
scene "예제" {
  layout: split
  ratio: 60              // 좌:우 = 60:40 (기본 50)
  left: heading "메인"
  right: bullet ["부가"]
}

// 방향 반전 (sidebar)
scene "예제" {
  layout: sidebar
  direction: reverse      // side가 왼쪽으로
  main: flow { ... }
  side: bullet ["메뉴"]
}
```

---

## 속성 (Properties)

### 인라인 속성

블록/요소 선언과 같은 줄에 `key:value` 형태로 작성한다.

```depix
flow direction:right gap:md { ... }
grid cols:3 rows:2 { ... }
node "서버" #server
```

### 속성 블록

중괄호 `{ }` 안에 속성을 나열한다. 스타일 속성과 일반 속성을 함께 사용할 수 있다.

```depix
node "서버" #server {
  background: primary
  color: white
  border: accent
  radius: md
  shadow: sm
  font-size: lg
  bold
}
```

### 스타일 속성

| 속성 | 값 | 설명 |
|------|-----|------|
| `background` | 색상 토큰/HEX | 배경색 |
| `color` | 색상 토큰/HEX | 텍스트 색상 |
| `border` | 색상 토큰/HEX | 테두리 색상 |
| `border-width` | `thin`, `medium`, `thick` | 테두리 두께 |
| `border-style` | 스타일 값 | 테두리 스타일 |
| `shadow` | `none`, `sm`, `md`, `lg` | 그림자 |
| `radius` | `none`, `sm`, `md`, `lg`, `full` | 모서리 반경 |
| `opacity` | 0–1 | 불투명도 |
| `font-size` | 크기 토큰 | 폰트 크기 |
| `font-weight` | `bold` 등 | 폰트 두께 |

### 플래그

값 없이 키워드만 선언하면 `true`로 처리된다.

| 플래그 | 설명 |
|--------|------|
| `bold` | 굵은 글씨 |
| `italic` | 기울임 |
| `underline` | 밑줄 |
| `strikethrough` | 취소선 |
| `center` | 가운데 정렬 |
| `outline` | 아웃라인 스타일 |
| `header` | 헤더 행 (table/grid) |
| `ordered` | 순서 있는 목록 (bullet/list) |

---

## 시맨틱 토큰

구체적인 수치 대신 의도를 표현하는 토큰이다. 컴파일 시 테마에 따라 구체 값으로 해석된다.

### 색상 토큰

**시맨틱 색상** (의미 기반):

| 토큰 | 용도 |
|------|------|
| `primary` | 주요 강조 |
| `secondary` | 보조 강조 |
| `accent` | 액센트 |
| `success` | 성공/긍정 |
| `warning` | 경고/주의 |
| `danger` | 위험/오류 |
| `info` | 정보 |
| `muted` | 음소거/비활성 |

**명명된 색상** (직접 지정):

`red`, `orange`, `yellow`, `green`, `blue`, `purple`, `gray`, `white`, `black`

**HEX 색상**: `#FF5733`, `#333` 등 직접 HEX 값도 사용 가능.

### 간격 토큰

| 토큰 | 기본값 (0–100 상대) |
|------|:----:|
| `xs` | 1 |
| `sm` | 2 |
| `md` | 3 |
| `lg` | 5 |
| `xl` | 8 |

### 폰트 크기 토큰

| 토큰 | 배율 |
|------|:----:|
| `xs` | 0.6 |
| `sm` | 0.8 |
| `md` | 1.0 |
| `lg` | 1.4 |
| `xl` | 1.8 |
| `2xl` ~ `10xl` | 2.4 ~ 10.0 |

### 그림자 토큰

| 토큰 | 설명 |
|------|------|
| `none` | 그림자 없음 |
| `sm` | 미세한 그림자 |
| `md` | 중간 그림자 |
| `lg` | 큰 그림자 |

### 모서리 반경 토큰

| 토큰 | 기본값 |
|------|:------:|
| `none` | 0 |
| `sm` | 0.5 |
| `md` | 1 |
| `lg` | 2 |
| `full` | 50 (완전 원형) |

### 테두리 두께 토큰

| 토큰 | 기본값 |
|------|:------:|
| `thin` | 0.3 |
| `medium` | 0.6 |
| `thick` | 1.0 |

---

## 차트 (Chart)

`@data` 데이터셋을 시각화한다.

```depix
@data "revenue" {
  "분기" "매출"
  "Q1" 1200
  "Q2" 1500
  "Q3" 1800
  "Q4" 2100
}

chart "revenue" type:bar
```

### 차트 타입

| 타입 | 설명 |
|------|------|
| `bar` | 막대 차트 |
| `line` | 선 차트 |
| `pie` | 파이 차트 |

### 인라인 데이터

`@data` 없이 직접 데이터를 포함할 수도 있다.

```depix
chart "성과" type:bar {
  "항목" "점수"
  "A" 85
  "B" 92
  "C" 78
}
```

---

## 테이블 (Table)

```depix
@data "specs" {
  "항목" "React" "Vue"
  "학습" "중간" "쉬움"
  "생태계" "넓음" "보통"
}

table "specs"
```

인라인 방식도 지원한다:

```depix
table "비교" {
  "기능" "A안" "B안"
  "속도" "빠름" "보통"
  "비용" "높음" "낮음"
}
```

---

## 종합 예제

### 시스템 아키텍처

```depix
@page 16:9

scene "System Architecture" {
  layout: header
  header: heading "마이크로서비스 아키텍처"
  body: flow direction:down {
    node "Client" #client { background: info }

    node "API Gateway" #gw { background: primary }

    node "Auth Service"   #auth   { background: accent }
    node "User Service"   #user   { background: accent }
    node "Order Service"  #order  { background: accent }

    cylinder "PostgreSQL" #db { background: warning }

    #client -> #gw "HTTPS"
    #gw -> #auth
    #gw -> #user
    #gw -> #order
    #auth -> #db
    #user -> #db
    #order -> #db
  }
}
```

### 프레젠테이션 슬라이드

```depix
@page 16:9
@transition fade

scene "표지" {
  layout: center
  body: heading "분기 실적 보고"
}

scene "핵심 지표" {
  layout: header-grid
  header: heading "KPI 요약"
  cell: stat "99.9%" { label: "가동률" }
  cell: stat "1.2M" { label: "월간 사용자" }
  cell: stat "+25%" { label: "매출 성장" }
}

scene "상세" {
  layout: header-sidebar
  header: heading "기술 스택"
  main: layers {
    layer "Frontend"      { background: blue }
    layer "API Gateway"   { background: accent }
    layer "Microservices" { background: green }
    layer "Database"      { background: orange }
  }
  side: bullet ["React", "Kong", "Go", "PostgreSQL"]
}
```

---

## 좌표계

Depix는 **0–100 상대 좌표계**를 사용한다. 모든 bounds(`x`, `y`, `w`, `h`)는 캔버스 대비 비율 값이다. 렌더러가 실제 픽셀 크기로 변환한다.

- `x: 0, y: 0` = 캔버스 좌상단
- `x: 100, y: 100` = 캔버스 우하단
- `w: 50` = 캔버스 너비의 50%

이 좌표계 덕분에 DSL 작성 시 픽셀 값을 알 필요가 없다.
