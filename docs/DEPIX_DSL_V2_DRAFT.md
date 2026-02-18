# Depix DSL v2 — 초안 설계

## 설계 원칙

1. **LLM이 이미 아는 문법을 차용한다** — CSS 스타일링, HTML-like 구조, Markdown-like 텍스트
2. **좌표를 쓰지 않는다** — 레이아웃은 시맨틱 프리미티브가 결정하고, 렌더러가 배치한다
3. **아름다움은 렌더러의 책임이다** — DSL은 "무엇을" 표현할지만 기술한다
4. **조합 가능한 소수의 프리미티브** — 5~7개의 레이아웃 블록으로 무한한 다이어그램을 조합
5. **간결하다** — 토큰 수가 적을수록 LLM 생성 비용이 낮고 정확도가 높다

---

## 문서 구조

```depix
@page 16:9
@theme light

scene "타이틀" {
  ...
}

scene "본문" {
  ...
}
```

### 문서 메타데이터

| 키 | 값 | 설명 |
|---|---|---|
| `@page` | `16:9`, `4:3`, `1:1`, `A4`, `letter` | 캔버스 비율/크기 |
| `@theme` | `light`, `dark`, 또는 커스텀 이름 | 렌더러의 기본 색상 테마 |
| `@style` | `default`, `sketch` | 드로잉 스타일 |
| `@transition` | `fade`, `slide`, `none` | 씬 간 기본 전환 |

---

## 레이아웃 프리미티브

### 1. `flow` — 방향성 있는 흐름

노드들이 화살표로 연결되는 구조. 플로우차트, 프로세스, 파이프라인에 사용.

```depix
flow direction:right {
  node "시작"
  node "처리" { subtitle: "데이터 변환" }
  node "끝" { shape: diamond }
}
```

**속성:**
- `direction`: `right` (기본), `left`, `down`, `up`

**노드 간 연결:**
- 기본: 선언 순서대로 자동 연결 (A → B → C)
- 커스텀 연결:

```depix
flow direction:right {
  node "A" #a
  node "B" #b
  node "C" #c
  node "D" #d

  #a -> #b "라벨"
  #a -> #c
  #b -> #d
  #c -> #d "합류"
}
```

**edge 스타일:**
- `->` 실선 화살표
- `-->` 점선 화살표
- `--` 실선 (화살표 없음)
- `<->` 양방향 화살표

### 2. `stack` — 순서 있는 나열

요소들을 수직 또는 수평으로 쌓는 구조. 목록, 단계, 비교 배치에 사용.

```depix
stack direction:row gap:md {
  box "Mounting" {
    list [
      "constructor()"
      "render()"
      "componentDidMount()"
    ]
  }
  box "Updating" {
    list [
      "shouldComponentUpdate()"
      "render()"
      "componentDidUpdate()"
    ]
  }
  box "Unmounting" {
    list [
      "componentWillUnmount()"
    ]
  }
}
```

**속성:**
- `direction`: `row` (기본), `col`
- `gap`: `xs`, `sm`, `md`, `lg`, `xl`
- `align`: `start`, `center`, `end`, `stretch`
- `wrap`: `true`, `false` (기본)

### 3. `grid` — 행렬 배치

행과 열로 구성되는 테이블/매트릭스.

```depix
grid cols:3 {
  cell "헤더 1" { header }
  cell "헤더 2" { header }
  cell "헤더 3" { header }
  cell "데이터 A"
  cell "데이터 B"
  cell "데이터 C"
}
```

**속성:**
- `cols`: 열 수 (필수)
- `gap`: `xs` ~ `xl`
- `header`: 첫 행을 헤더로 처리 (자동 스타일)

### 4. `tree` — 계층 구조

부모-자식 관계를 표현하는 트리.

```depix
tree direction:down {
  node "CEO" {
    node "CTO" {
      node "개발팀"
      node "인프라팀"
    }
    node "CFO" {
      node "재무팀"
      node "회계팀"
    }
  }
}
```

**속성:**
- `direction`: `down` (기본), `right`, `up`, `left`

### 5. `group` — 시각적 그룹핑

요소들을 하나의 영역으로 묶어 표현. 배경, 테두리, 라벨 포함.

```depix
group "명반응" {
  label "틸라코이드"
  label "H₂O → O₂"
  label "전자전달계"
}
```

**속성:**
- 모든 스타일 속성 적용 가능 (배경, 테두리 등)

### 6. `layers` — 수직 레이어

위에서 아래로 쌓이는 계층 구조. 아키텍처, 스택 다이어그램에 사용.

```depix
layers {
  layer "프론트엔드" { color: blue }
  layer "API Gateway"
  layer "마이크로서비스" { color: green }
  layer "데이터베이스" { color: orange }
}
```

---

## 시각 요소 (Visual Elements)

레이아웃 프리미티브 안에 배치되는 콘텐츠 단위.

### `box` — 박스/카드

가장 기본적인 콘텐츠 컨테이너. 내부에 다른 요소를 포함할 수 있음.

```depix
box "제목" {
  subtitle: "부제목"
  list ["항목1", "항목2"]
}
```

### `node` — 다이어그램 노드

flow, tree 등에서 사용되는 연결 가능한 요소.

```depix
node "처리 단계" #id {
  shape: rect          // rect (기본), circle, diamond, pill, hexagon
  subtitle: "설명 텍스트"
  icon: "database"
}
```

### `label` — 텍스트 라벨

단순 텍스트 표시.

```depix
label "H₂O → O₂ + 4H⁺"
label "중요한 텍스트" { bold }
```

### `list` — 목록

```depix
list [
  "첫 번째 항목"
  "두 번째 항목"
  "세 번째 항목"
]
list ordered [
  "Step 1"
  "Step 2"
]
```

### `badge` — 뱃지/태그

강조 표시용 작은 라벨.

```depix
badge "ATP"
badge "NADPH" { color: green }
badge "v2.0" { outline }
```

### `icon` — 아이콘

```depix
icon "sun"
icon "arrow-right"
icon "database" { size: lg }
```

### `divider` — 구분선

```depix
divider
divider "또는"   // 라벨 포함 구분선
```

### `image` — 이미지

```depix
image "https://example.com/photo.jpg" {
  fit: cover
}
```

---

## ID와 연결

### ID 지정

`#id`를 요소 뒤에 붙여 식별자를 부여.

```depix
node "A" #alpha
node "B" #beta
```

### 연결 (Connections)

```depix
#alpha -> #beta              // 기본 화살표
#alpha -> #beta "라벨 텍스트"  // 라벨 포함
#alpha --> #beta             // 점선
#alpha <-> #beta             // 양방향
#alpha -- #beta              // 선만 (화살표 없음)
```

연결은 flow 블록 안에서 정의하거나, 씬 레벨에서 정의 가능.

---

## 스타일링

CSS-like 문법을 인라인으로 사용. 렌더러가 기본 스타일을 제공하므로,
**스타일 지정은 선택사항** — 미지정 시 테마 기본값 적용.

### 인라인 스타일

```depix
node "경고" {
  background: #fee2e2
  border: #ef4444
  color: #991b1b
}

box "카드" {
  background: white
  shadow: md
  radius: lg
}
```

### 사용 가능한 스타일 속성

| 속성 | 값 | 설명 |
|---|---|---|
| `background` | 색상값, `gradient(방향, 색1, 색2)` | 배경 |
| `color` | 색상값 | 텍스트 색상 |
| `border` | 색상값 | 테두리 색상 |
| `border-width` | `thin`, `medium`, `thick`, 또는 숫자 | 테두리 두께 |
| `border-style` | `solid`, `dashed`, `dotted` | 테두리 스타일 |
| `shadow` | `none`, `sm`, `md`, `lg` | 그림자 |
| `radius` | `none`, `sm`, `md`, `lg`, `full` | 모서리 둥글기 |
| `opacity` | `0` ~ `1` | 투명도 |
| `font-size` | `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl` | 글자 크기 |
| `font-weight` | `normal`, `bold` | 글자 두께 |

### 색상값

```
#3b82f6           // HEX
blue              // 시맨틱 컬러 (테마에 따라 매핑)
red, green, yellow, purple, orange, gray, white, black
gradient(right, #f00, #00f)
```

### 시맨틱 컬러

테마 기반 색상. LLM이 구체적 HEX를 몰라도 의도를 표현 가능.

| 이름 | 용도 |
|---|---|
| `primary` | 주요 강조색 |
| `secondary` | 보조색 |
| `accent` | 포인트색 |
| `success` | 성공/긍정 |
| `warning` | 경고 |
| `danger` | 위험/오류 |
| `info` | 정보 |
| `muted` | 비강조 |

---

## 플래그 (Flags)

Boolean 속성은 키만 적으면 true.

```depix
label "중요" { bold }
label "취소선" { strikethrough }
node "DB" { shape: circle }
badge "New" { outline }
cell "헤더" { header }
```

사용 가능: `bold`, `italic`, `underline`, `strikethrough`, `center`, `outline`, `header`

---

## 씬 (Scene)

멀티 씬 프레젠테이션 지원.

```depix
@page 16:9
@theme dark

scene "인트로" {
  box "Depix" {
    subtitle: "선언적 그래픽 DSL"
    font-size: 2xl
    center
  }
}

scene "기능 소개" {
  stack direction:row gap:lg {
    box "기능 1" {
      icon "zap"
      label "빠른 생성"
    }
    box "기능 2" {
      icon "edit"
      label "쉬운 편집"
    }
    box "기능 3" {
      icon "sparkles"
      label "아름다운 결과"
    }
  }
}
```

씬이 1개이거나 생략하면 단일 캔버스 모드.

---

## 조합 예제

### 예제 1: 광합성 다이어그램

```depix
@page 16:9
@theme light

flow direction:right {
  group "명반응" #light {
    icon "sun"
    label "틸라코이드"
    label "H₂O → O₂"
    label "전자전달계"
    badge "산소 방출" { color: blue }
  }

  group "암반응" #dark {
    label "캘빈 회로"
    label "CO₂ → C₆H₁₂O₆"
    label "+ RuBisCO"
    badge "포도당 합성" { color: green }
  }

  #light -> #dark "ATP\nNADPH"
}
```

### 예제 2: Git 브랜치 전략

```depix
@page 16:9

flow direction:right {
  // main 브랜치
  node "●" #m1 { color: blue }
  node "●" #m2 { color: blue }
  node "●" #m3 { color: blue }
  node "●" #m4 { color: blue }

  // develop 브랜치
  node "●" #d1 { color: green }
  node "●" #d2 { color: green }
  node "●" #d3 { color: green }

  // feature 브랜치
  node "●" #f1 { color: orange }
  node "●" #f2 { color: orange }

  // 연결
  #m1 -> #m2 -> #m3 -> #m4
  #m1 -> #d1 -> #d2 -> #d3 -> #m4
  #d1 -> #f1 -> #f2 -> #d2

  // 레인 배치 힌트
  @lane "main": #m1 #m2 #m3 #m4
  @lane "develop": #d1 #d2 #d3
  @lane "feature": #f1 #f2
}
```

### 예제 3: React 라이프사이클

```depix
@page 16:9

stack direction:row gap:lg {
  box "Mounting" {
    background: primary
    list [
      "constructor()"
      "render()"
      "componentDidMount()"
    ]
  }

  box "Updating" {
    background: info
    list [
      "shouldComponentUpdate()"
      "render()"
      "componentDidUpdate()"
    ]
  }

  box "Unmounting" {
    background: warning
    list [
      "componentWillUnmount()"
    ]
  }
}
```

### 예제 4: NLP 패러다임 변화

```depix
@page 16:9

flow direction:down {
  box "기존 NLP 패러다임" #old {
    badge "특정 작업별 모델" { color: orange }
    label "데이터마다, 작업마다 따로"
  }

  box "대형 언어 모델 (LLM)" #new {
    badge "하나로 모든 작업을" { color: green }
    badge "프롬프트 기반 확장" { color: blue }
  }

  #old -> #new "패러다임 전환"
}
```

### 예제 5: 캔들차트 구조 설명

```depix
@page 16:9

stack direction:row gap:xl {
  // 양봉 (상승)
  stack direction:col align:center {
    label "고가 (High)" { font-size: sm, color: muted }
    divider
    label "윗꼬리 (Upper Shadow)" { font-size: xs }
    box "몸통" {
      background: #ef4444
      label "종가 (Close)" { bold }
      label "시가 (Open)"
    }
    label "아랫꼬리 (Lower Shadow)" { font-size: xs }
    divider
    label "저가 (Low)" { font-size: sm, color: muted }
  }

  // 음봉 (하락)
  stack direction:col align:center {
    label "고가 (High)" { font-size: sm, color: muted }
    divider
    label "윗꼬리" { font-size: xs }
    box "몸통" {
      background: #3b82f6
      label "시가 (Open)" { bold }
      label "종가 (Close)"
    }
    label "아랫꼬리" { font-size: xs }
    divider
    label "저가 (Low)" { font-size: sm, color: muted }
  }
}
```

### 예제 6: 비교 다이어그램

```depix
@page 16:9

grid cols:3 {
  cell ""
  cell "React" { header }
  cell "Vue" { header }

  cell "학습 곡선" { header }
  cell "중간" { color: warning }
  cell "쉬움" { color: success }

  cell "생태계" { header }
  cell "매우 넓음" { color: success }
  cell "넓음" { color: info }

  cell "성능" { header }
  cell "우수" { color: success }
  cell "우수" { color: success }
}
```

---

## 저수준 폴백 (Low-level Fallback)

시맨틱 프리미티브로 표현이 안 되는 경우, 기존 저수준 문법으로 폴백.
위지윅 에디터에서 시맨틱 컨테이너를 "해체"하면 이 형태로 전환됨.

```depix
canvas {
  rect { x:10 y:10 w:30 h:20 fill:#3b82f6 }
  circle { x:50 y:50 r:15 fill:#ef4444 }
  line { x1:10 y1:50 x2:90 y2:50 stroke:#333 }
  text "자유 배치" { x:50 y:80 font-size:lg }
}
```

**원칙: LLM은 가능한 한 시맨틱 프리미티브를 사용하고, canvas 폴백은 최후 수단.**

---

## v1 → v2 변경 요약

| 영역 | v1 (현재) | v2 (제안) |
|---|---|---|
| 레이아웃 | 좌표 기반 (x, y, w, h) | 시맨틱 프리미티브 (flow, stack, grid...) |
| 스타일 문법 | 커스텀 (fill:#색, stroke-w:2) | CSS-like (background, border, shadow) |
| 크기 지정 | 절대값 0-100 | 시맨틱 토큰 (xs~xl) 또는 자동 |
| 색상 | HEX만 | 시맨틱 컬러 + HEX |
| 다이어그램 구조 | rect + line + connector 조합 | flow, tree, grid 등 의미 단위 |
| 프롬프트 토큰 | 문법 가이드 ~2000 토큰 | 목표: ~800 토큰 이하 |
| LLM 학습 필요 | 전체 문법 설명 필요 | 익숙한 문법 차용으로 최소화 |

---

## 미결 과제 (Open Questions)

1. **`@lane` 문법의 범용성** — Git 브랜치 예시에서 도입한 `@lane`이 다른 곳에서도 쓸모 있는가?
   아니면 flow의 내부 속성으로 처리할 것인가?

2. **중첩 깊이 제한** — flow 안에 stack, stack 안에 grid 같은 깊은 중첩을
   어디까지 허용할 것인가? LLM이 3단계 이상 중첩하면 실수 확률이 높아짐.

3. **애니메이션/전환** — 씬 간 전환 외에 요소 단위 애니메이션을 지원할 것인가?
   지원한다면 DSL에서 어떻게 표현할 것인가?

4. **커스텀 테마 정의** — `@theme` 확장 시 DSL 안에서 테마를 정의하는 문법이
   필요한가, 외부 파일로 분리하는가?

5. **반응형** — 화면 크기에 따라 레이아웃이 바뀌어야 하는 경우를 DSL이
   다뤄야 하는가?

6. **flow 내 복잡한 라우팅** — 분기, 합류, 루프 등 복잡한 흐름을
   현재 edge 문법으로 충분히 표현할 수 있는가?

7. **JSON 출력 옵션** — LLM이 structured output으로 JSON을 생성하는 경우를 위해
   DSL의 JSON 표현도 공식 지원할 것인가?
