# Depix 아키텍처

## 배경

Depix는 마크다운 문서 안에서 시각적 콘텐츠를 생성하고 편집하는 도구다. `depix` 코드 블럭으로 DSL을 작성하면 렌더링되고, Figma 수준의 위지윅 편집기로 직접 수정할 수도 있다.

Depix의 핵심 가치 — **심플함, 직관성, 아름다움** — 을 더 넓은 사용 시나리오에서 실현하기 위한 구조적 설계다.

---

## 왜 재설계하는가

### 1. LLM 시대의 요구

Depix의 원래 설계에는 **LLM이 DSL을 생성하는 시나리오**가 포함되어 있었다. 실제로 LLM에게 Depix DSL 문법을 알려주고 아스키 다이어그램을 변환하게 하면 동작은 하지만, 결과의 품질이 일관되지 않다.

원인은 명확하다:

- **좌표 추정의 한계.** LLM은 `x:37 y:22 w:28 h:15` 같은 수치를 쓸 때 화면에 어떻게 보일지 모른다. 결과적으로 요소가 겹치거나, 간격이 불균일하거나, 비율이 맞지 않는 문제가 반복된다.

- **커스텀 문법의 학습 비용.** 현재 DSL 문법(`rect { fill:#3b82f6 stroke-w:2 }`)은 CSS와 비슷하지만 CSS가 아니다. LLM은 학습 데이터에 없는 문법에서 미묘한 실수를 자주 한다. 프롬프트에 전체 문법 가이드를 포함해야 하므로 토큰 비용도 높다.

- **의미와 표현의 불일치.** LLM이 "광합성 과정을 다이어그램으로 표현해"라는 요청을 받으면, 머릿속에는 "명반응 → 암반응 흐름"이라는 **의미**가 있다. 하지만 현재 DSL에서는 이를 `rect`, `line`, `connector`의 **조합**으로 풀어야 한다. 의미를 알고 있는데 그리기 도구를 일일이 지정하는 것은 비효율적이다.

### 2. 렌더러의 과도한 책임

현재 아키텍처에서 `DepixEngine`은 너무 많은 일을 한다:

```
현재 DepixEngine의 책임:
- Frame 자동 레이아웃 계산 (row/col/pre, fill/hug 해석)
- Connector 경로 계산 (앵커 포인트, 경로 라우팅)
- 시맨틱 값 해석 (SizingValue의 5가지 경우)
- Konva 노드 생성 및 관리
- 뷰포트 관리 (줌, 패닝)
- 씬 전환 애니메이션
- 이벤트 처리
```

레이아웃 계산과 렌더링이 결합되어 있어서, 새로운 레이아웃 방식(flow, tree, grid)을 추가하려면 렌더러 내부를 수정해야 한다. 이는 렌더러의 안정성을 해치고 복잡도를 높인다.

### 3. 에디터의 표현력 제약

현재 에디터는 DSL이 표현할 수 있는 것만 편집할 수 있다. UML 클래스 다이어그램의 섹션 박스, Value Chain의 원형 배치, 복잡한 edge 라벨(multiplicity, role name) 같은 것은 DSL의 제약 때문에 에디터에서도 만들 수 없다.

DSL은 **생성의 진입점**이지 **표현력의 한계**가 되어서는 안 된다.

---

## 목표

### 핵심 목표 3가지

**1. LLM이 좌표 없이 다이어그램을 생성할 수 있게 한다.**

LLM에게 "이 개념의 의미 구조를 기술해라"고 요청하고, 배치는 시스템이 자동으로 결정한다. LLM은 `flow`, `stack`, `grid` 같은 시맨틱 레이아웃 프리미티브로 의도만 표현하면 된다.

**2. 렌더러는 그리기만 한다.**

레이아웃 계산, 색상 해석, 경로 라우팅 등 모든 "판단"을 컴파일러로 분리한다. 렌더러는 완전히 해결된(resolved) 데이터를 받아서 Konva에 그리기만 하면 된다.

**3. 에디터의 표현력을 DSL로부터 해방한다.**

에디터는 내부 포맷(IR)을 직접 조작하므로, DSL이 지원하지 않는 복잡한 다이어그램도 자유롭게 만들 수 있다.

### 부수 효과

- 프롬프트 토큰 절감 (문법 가이드 축소)
- 테마 시스템 도입으로 일관된 비주얼
- 새로운 레이아웃 알고리즘 추가가 렌더러와 독립적
- 기존 데이터 무손실 마이그레이션

---

## 아키텍처 변화

### Before (현재)

```
DSL 텍스트
    ↓ parser.ts
DepixDocument (JSON)  ←→  에디터가 직접 조작
    ↓                      ↓
DepixEngine ──────────→ Konva Stage
 (레이아웃 계산 +          (렌더링)
  색상 해석 +
  경로 라우팅 +
  렌더링)
```

- `DepixDocument`가 파서 출력, 렌더러 입력, 에디터 상태, 저장 포맷을 모두 겸한다.
- 렌더러가 레이아웃 계산을 포함한 모든 해석을 담당한다.
- 에디터의 표현력이 DSL/DepixDocument의 스키마에 묶여 있다.

### 현재 구조

```
DSL 텍스트                      에디터
    ↓ Compiler                    │
    ├─ Parse                      │
    ├─ Resolve Theme              │
    ├─ Plan Layout                │
    ├─ Scale System               │ (IR 직접 조작)
    ├─ Allocate Bounds            │
    ├─ Layout                     │
    ├─ Route Edges                │
    ↓                             ↓
DepixIR (JSON)  ←─────────────────┘
    ↓
DepixEngine (Konva)
 (렌더링만)
```

- **3개의 독립적 레이어**: DSL (생성) → IR (표현) → Renderer (출력)
- 컴파일러가 모든 계산을 수행하고, IR에는 해결된 값만 담긴다.
- 에디터는 IR을 직접 조작하여 DSL의 제약에 묶이지 않는다.
- 렌더러는 IR을 받아 그리기만 한다.

### Java/JVM 비유

| 개념 | Java 세계 | Depix |
|------|-----------|-------|
| 소스 코드 | .java, .kotlin, .scala | DSL 텍스트 |
| 컴파일러 | javac, kotlinc | Depix Compiler |
| 바이트코드 | .class (JVM bytecode) | DepixIR (JSON) |
| 런타임 | JVM | DepixEngine (Konva) |
| IDE | IntelliJ, Eclipse | 위지윅 에디터 |

- 여러 언어(Java, Kotlin)가 같은 바이트코드를 타겟으로 할 수 있듯이, 미래에 다른 DSL이나 AI 모델이 같은 IR을 생성할 수 있다.
- IDE가 바이트코드가 아닌 소스를 편집하듯... Depix 에디터는 IR을 직접 편집하지만, 시맨틱 출처 정보(`origin`)를 활용하여 구조적 편집도 제공할 수 있다.
- 바이트코드를 Java로 완벽하게 디컴파일할 수 없듯이, 에디터에서 자유롭게 편집한 IR을 DSL로 역변환하는 것은 필수가 아니다.

---

## DSL 설계

### 설계 원칙

1. **LLM이 이미 아는 문법을 차용한다.** CSS-like 스타일링, HTML-like 구조, Markdown-like 텍스트.
2. **좌표를 쓰지 않는다.** 레이아웃은 시맨틱 프리미티브가 결정하고, 컴파일러가 계산한다.
3. **아름다움은 렌더러의 책임이다.** DSL은 "무엇을" 표현할지만 기술한다.
4. **조합 가능한 소수의 프리미티브.** 5~7개의 레이아웃 블록으로 다양한 다이어그램을 조합한다.
5. **간결하다.** 토큰 수가 적을수록 LLM 생성 비용이 낮고 정확도가 높다.

### 레이아웃 프리미티브

| 프리미티브 | 용도 | 예시 |
|-----------|------|------|
| `flow` | 방향성 있는 흐름 | 플로우차트, 프로세스, 파이프라인 |
| `stack` | 수직/수평 나열 | 목록, 단계별 배치, 비교 |
| `grid` | 행렬 배치 | 비교표, 매트릭스, 카드 그리드 |
| `tree` | 계층 구조 | 조직도, 분류 체계, 의사결정 트리 |
| `group` | 시각적 그룹핑 | 영역 구분, 카테고리 표현 |
| `layers` | 수직 레이어 | 아키텍처 스택, 계층 모델 |

이 6개의 조합으로 대부분의 설명 다이어그램을 표현할 수 있다. 표현 불가능한 경우를 위해 `canvas` 블록에서 기존 좌표 기반 배치를 폴백으로 지원한다.

### 시맨틱 토큰

LLM이 구체적 수치를 몰라도 의도를 표현할 수 있도록 시맨틱 토큰을 제공한다.

- **간격**: `xs`, `sm`, `md`, `lg`, `xl`
- **글자 크기**: `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`
- **색상**: `primary`, `secondary`, `accent`, `success`, `warning`, `danger`, `info`, `muted`
- **그림자**: `none`, `sm`, `md`, `lg`
- **모서리**: `none`, `sm`, `md`, `lg`, `full`

이 토큰들은 컴파일 시점에 테마에 따라 구체적 값으로 해석된다.

### 설계 결정

| 영역 | 설계 |
|------|------|
| 레이아웃 | 시맨틱 프리미티브 (`flow`, `stack`, `grid`) |
| 스타일 문법 | CSS-like (`background: #색`, `border: #색`) |
| 크기/간격 | 시맨틱 토큰 (`gap:md`) 또는 자동 |
| 색상 | 시맨틱 컬러 + HEX |
| 다이어그램 | flow, tree, grid 등 의미 단위 |
| 프롬프트 비용 | 목표 ~800 토큰 이하 |

**상세 문법은 별도 문서 참조: `DEPIX_DSL_DRAFT.md`**

---

## IR (Internal Representation): 무엇이 바뀌나

### 핵심 개념

IR은 **모든 계산이 끝난 장면 기술**이다. DSL의 시맨틱 표현도, 에디터의 자유로운 편집 결과도, IR로 수렴한다.

IR의 핵심 속성:
- **모든 좌표가 해결됨.** `fill`, `hug` 같은 동적 크기가 없다. 구체적인 숫자만 있다.
- **모든 색상이 해결됨.** `primary`, `danger` 같은 시맨틱 토큰이 없다. HEX만 있다.
- **모든 경로가 해결됨.** "A에서 B로 연결"이 아니라 구체적 포인트 배열이 있다.
- **시맨틱 출처 정보가 선택적으로 보존됨.** 에디터가 활용할 수 있지만, 없어도 렌더링에 지장 없다.

### 현재 DepixDocument와의 관계

| 현재 타입 | IR 타입 | 변화 |
|----------|---------|------|
| `RectObject`, `CircleObject`, `EllipseObject` | `IRShape` | 통합 (shape 속성으로 구분) |
| `FrameObject`, `GroupObject` | `IRContainer` | 통합 (레이아웃 해결됨) |
| `ConnectorObject` | `IREdge` | 경로가 포인트로 해결됨 |
| `ListObject` | `IRContainer + IRText[]` | 분해 |
| `SymbolObject` | `IRShape` / `IRPath` | 심볼 해체 |
| `SizingValue` (5가지) | `number` (항상) | 컴파일러가 해결 |
| `Scene` (레이아웃 속성 포함) | `IRScene` | 레이아웃 속성 제거 |

12개 오브젝트 타입 → 7개 IR 요소 타입으로 통합.

**상세 스펙은 별도 문서 참조: `DEPIX_IR_SPEC.md`**

---

## Compiler: 새로 만드는 것

### 컴파일러 파이프라인

```
DSL 텍스트
    ↓
① Parse ─────────── 텍스트 → AST (tokenizer → parser)
    ↓
② Resolve Theme ─── 시맨틱 토큰 → 구체값
    ↓
③ Plan Layout ───── 구조 분석, 가중치 산출
    ↓
④ Scale System ──── 캔버스 면적 + 요소 수 → baseUnit → 동적 gap/font/padding
    ↓
⑤ Allocate Bounds ─ 가중치 비례 공간 배분 (top-down)
    ↓
⑥ Layout ────────── flow/stack/grid/tree → 절대 좌표
    ↓
⑦ Route Edges ───── 연결선 경로 계산
    ↓
⑧ Emit IR ────────── AST → IR 변환 + 동적 fontSize/padding 적용
```

③~⑧은 `emitIR()` 내부에서 씬 단위로 실행된다:
`planDiagram() → createScaleContext() → allocateDiagram() → emitDiagramFromPlan()`

### 스케일 시스템 (`passes/scale-system.ts`)

요소 수에 따라 간격, 폰트 크기, 패딩을 동적으로 조정하는 통일된 스케일 시스템이다.

**핵심 공식:**
```
baseUnit = sqrt(canvasArea / elementCount) * DENSITY_FACTOR(0.55)
```

**Gap 계층 (5종):**
| 타입 | 비율 | 범위 | 용도 |
|------|------|------|------|
| `childGap` | 0.03 | 0.5~3.0 | 부모-자식 내부 간격 |
| `innerPadding` | 0.06 | 1.0~5.0 | 컨테이너 내부 여백 |
| `siblingGap` | 0.10 | 1.5~6.0 | 형제 요소 간격 |
| `sectionGap` | 0.12 | 2.0~7.0 | 씬 레벨 섹션 간격 |
| `connectorGap` | 0.15 | 2.5~8.0 | flow/tree 연결선 간격 |

**동적 fontSize (4종 역할):**
| 역할 | 비율 | 범위 |
|------|------|------|
| `listItem` | 0.20 | 0.6~3.2 |
| `standaloneText` | 0.25 | 0.6~3.2 |
| `innerLabel` | 0.30 | 0.6~3.2 |
| `edgeLabel` | 0.60 | 0.6~3.2 |

fontSize는 `containerShortSide * ratio`로 산출하여 도형 크기에 비례한다.
DSL에서 명시적으로 지정한 `gap`, `font-size`, `padding` 값은 항상 우선한다.

### 각 단계의 입출력

| 단계 | 입력 | 출력 | 핵심 로직 |
|------|------|------|----------|
| Parse | DSL 텍스트 | AST | 토큰화, 구문 분석 |
| Resolve Theme | AST + Theme | AST (값 해결됨) | 시맨틱 컬러/토큰 → HEX/수치 |
| Plan Layout | AST (해결됨) | DiagramLayoutPlan | 가중치, 깊이, 자식 수 분석 |
| Scale System | Plan + Canvas | ScaleContext | baseUnit, 요소 수 기반 스케일 팩터 |
| Allocate Bounds | Plan + ScaleContext | BoundsMap | top-down 가중치 비례 공간 배분 |
| Layout | LayoutChildren + Props | LayoutResult | 레이아웃 알고리즘 실행 (동적 gap) |
| Route Edges | IR 요소들 + edge 정의 | IREdge[] | 경로 계산, 라벨 배치 |
| Emit IR | AST + BoundsMap + ScaleContext | DepixIR JSON | IR 변환, 동적 fontSize/padding |

### 레이아웃 알고리즘

| 프리미티브 | 알고리즘 | 복잡도 |
|-----------|---------|--------|
| `stack` | Flexbox 모방 (순차 배치) | 낮음 |
| `grid` | CSS Grid 모방 (행/열 분배) | 낮음 |
| `group` | 자식 바운딩 박스 합산 | 낮음 |
| `layers` | 균등 수직 분할 | 낮음 |
| `flow` | 토폴로지 정렬 + 계층 배치 | 중간 |
| `tree` | Reingold-Tilford 변형 | 중간 |

`stack`과 `grid`는 기존 `FrameObject`의 레이아웃 로직을 재활용할 수 있다. `flow`와 `tree`가 새로 구현해야 하는 핵심 알고리즘이다.

---

## 에디터: 무엇이 바뀌나

### 에디터는 IR을 직접 조작한다

에디터는 `DepixIR`을 직접 조작한다. 근본적인 편집 모델(선택, 드래그, 리사이즈, undo/redo)은 동일하다.

### 바뀌는 것

**렌더러의 단순화.** `ObjectTypeRenderer`가 레이아웃 계산 없이 그리기만 하면 된다. IR의 `bounds`를 Konva 노드에 매핑하는 것이 전부다.

**표현력의 확장.** IR은 DSL보다 표현력이 넓으므로, 에디터에서 DSL이 지원하지 않는 요소(UML 섹션 박스, 자유 곡선 배치 등)를 만들 수 있다.

**시맨틱 구조의 활용.** IR의 `origin` 필드를 통해, 시맨틱 컨테이너(flow, stack 등) 출신의 요소에 대해 스마트한 편집을 제공할 수 있다. 예를 들어 flow 안의 노드를 이동하면 연결선이 자동으로 재조정된다.

**시맨틱 구조의 해체.** 사용자가 시맨틱 레이아웃의 제약에서 벗어나고 싶을 때, "해체(detach)"를 선택하면 `origin`이 제거되고 완전한 자유 편집 모드가 된다. Figma에서 Auto Layout을 해제하는 것과 같은 개념이다.

### 바뀌지 않는 것

- `SelectionManager`, `TransformControls`, `SnapManager`, `HistoryManager`, `ClipboardManager`의 핵심 로직
- Toolbar, PropertyPanel, LayerPanel의 UI 구조
- Konva 기반 렌더링 파이프라인
- TipTap 통합 방식 (노드의 data 속성에 JSON 저장)

---

## 데이터 흐름

### LLM이 다이어그램을 생성할 때

```
사용자: "광합성 과정을 다이어그램으로 보여줘"
    ↓
LLM: DSL 텍스트 생성
    ↓
Compiler: DSL → IR 변환
    ↓
DepixEngine: IR → 화면 렌더링
    ↓
사용자: 결과 확인, 필요시 에디터로 수정
```

### 사용자가 에디터에서 직접 만들 때

```
사용자: 에디터에서 도형 추가, 드래그, 연결
    ↓
에디터: IR 직접 조작
    ↓
DepixEngine: IR → 화면 렌더링 (실시간)
```

### 마크다운에 저장될 때

```
TipTap 노드: {
  attrs: {
    ir: DepixIR (JSON)    // 렌더링/편집용 데이터
    dsl: "..."             // 원본 DSL 텍스트 (선택적)
  }
}
    ↓
마크다운 직렬화:
  ```depix
  ... IR의 JSON 또는 DSL 텍스트 ...
  ```
```

---

## 마이그레이션 전략

### 원칙

1. **기존 데이터를 깨뜨리지 않는다.** 현재 `DepixDocument` 형식의 데이터는 자동 변환된다.
2. **점진적으로 전환한다.** 한 번에 모든 것을 바꾸지 않고 단계별로 진행한다.
3. **양방향 호환 기간을 둔다.** 전환 기간 동안 이전 포맷과 현재 포맷을 모두 지원한다.

### 단계별 계획

#### Phase 0: IR 정의 및 변환기

- IR 타입 정의 (`ir-types.ts`)
- 기존 `DepixDocument` → `DepixIR` 변환기 구현
- 변환 후 렌더링 결과가 기존과 동일한지 검증

이 단계에서 기존 기능은 전혀 변하지 않는다. 변환기가 정상 동작하는지만 확인한다.

#### Phase 1: 렌더러를 IR 기반으로 전환

- `DepixEngine`이 `DepixIR`을 입력으로 받도록 변경
- 기존 `DepixDocument` 입력은 내부에서 자동 변환 후 IR로 처리
- `ObjectTypeRenderer`를 IR 기반으로 단순화
- Frame 레이아웃 계산 로직을 렌더러에서 분리

외부 인터페이스는 유지하되 내부를 IR 기반으로 전환한다.

#### Phase 2: DSL 파서 및 컴파일러

- DSL 문법 확정
- 파서 구현 (텍스트 → AST)
- 테마 시스템 구현
- `stack`, `grid` 레이아웃 컴파일러 (기존 Frame 로직 재활용)
- `flow`, `tree` 레이아웃 컴파일러 (신규)
- Edge 라우팅 엔진

이 단계에서 LLM이 DSL을 생성하고 렌더링하는 것이 가능해진다.

#### Phase 3: 에디터를 IR 기반으로 전환

- 에디터가 `DepixIR`을 직접 조작하도록 변경
- `origin` 기반 시맨틱 편집 지원
- 시맨틱 구조 해체(detach) 기능
- PropertyPanel에 IR 속성 반영

#### Phase 4: 이전 DSL 호환 제거 (완료)

- 이전 파서 호환 레이어 제거 완료
- 문서에서 이전 문법 참조 제거 완료
- 이전 코드 정리 완료

---

## 영향 범위

### 변경되는 모듈

| 모듈 | 변경 내용 | 규모 |
|------|----------|------|
| `core/types.ts` | IR 타입 추가, 기존 타입 유지(호환) | 중 |
| `core/parser.ts` | 파서 구현 | 대 |
| **신규** `core/compiler.ts` | 컴파일러 파이프라인 | 대 |
| **신규** `core/theme.ts` | 테마 시스템 | 중 |
| **신규** `core/layout/` | 레이아웃 알고리즘들 | 대 |
| **신규** `core/routing/` | Edge 라우팅 엔진 | 중 |
| `engine/depix-engine.ts` | IR 기반 입력으로 전환 | 중 |
| `engine/object-renderer.ts` | IR 기반 렌더러로 단순화 | 중 |
| `editor/` | IR 직접 조작으로 전환 | 중 |
| `react/` | Props 타입 변경 (내부) | 소 |
| `tiptap/` | 저장 포맷 변경 (data 속성) | 소 |

### 변경되지 않는 것

- Konva 기반 렌더링 방식
- 에디터의 핵심 조작 모델 (선택, 드래그, 리사이즈)
- `SelectionManager`, `SnapManager`, `HistoryManager`의 핵심 로직
- `ViewportManager`, `TransitionManager`, `AnimationManager`
- TipTap 통합 방식
- React 컴포넌트 외부 인터페이스

---

## 성공 기준

### 정량 기준

| 지표 | 현재 | 목표 |
|------|------|------|
| LLM 프롬프트 내 문법 가이드 토큰 수 | ~2000 | ~800 이하 |
| LLM 생성 다이어그램의 레이아웃 정상 비율 | ~60% (추정) | 90% 이상 |
| 렌더러 코드 라인 수 | 기준선 측정 필요 | 30% 이상 감소 |
| 기존 데이터 마이그레이션 성공률 | - | 100% |

### 정성 기준

- LLM에게 "이 개념을 Depix 다이어그램으로 표현해"라고 하면 **즉시 아름다운 결과가 나온다.**
- 에디터에서 **DSL을 모르는 사용자**도 복잡한 다이어그램을 자유롭게 만들 수 있다.
- 새로운 레이아웃 알고리즘 추가가 **렌더러 수정 없이** 가능하다.
- 테마 변경으로 **전체 다이어그램의 비주얼이 일괄 변경**된다.

---

## 리스크

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 레이아웃 알고리즘의 품질 | flow/tree 결과가 못생길 수 있음 | 기존 검증된 알고리즘(dagre, Reingold-Tilford) 활용, 반복 튜닝 |
| IR 파일 크기 증가 | 저장 용량 증가 | JSON gzip 압축, 불필요한 기본값 생략 |
| 에디터 전환 비용 | 기존 에디터 로직 수정 필요 | Phase 1에서 렌더러만 먼저 전환, 에디터는 Phase 3 |
| 양방향 호환 기간의 복잡도 | 이전 포맷 동시 지원 비용 | 변환기를 단방향(이전 포맷→IR)으로만 구현, 역변환은 안 함 |
| LLM이 DSL 문법을 잘 생성하는가 | 실제 테스트 필요 | Phase 2에서 조기 LLM 테스트, 문법 피드백 반영 |

---

## 테스트 전략

### 3레이어 아키텍처의 테스트 이점

DSL → IR → Renderer 3레이어 분리는 테스트에도 큰 이점을 준다:

- **컴파일러 패스는 모두 순수 함수.** 입력 → 출력이 결정적이므로 단위 테스트로 완전한 커버리지가 가능하다.
- **각 레이어 경계가 테스트 계약.** DSL→AST, AST→ResolvedAST, ResolvedAST→IR, IR→Konva 각 변환의 입출력을 독립적으로 검증한다.
- **렌더러가 단순해져 테스트가 쉬움.** IR에 모든 값이 해결되어 있으므로, 렌더러 테스트는 "이 bounds가 이 Konva 노드로 매핑되는가"만 확인하면 된다.

### 레이아웃 알고리즘의 불변식 검증

레이아웃 결과는 정확한 좌표를 단언하기보다 **불변식(invariant)**으로 검증한다:
- 자식이 부모 bounds 안에 있는가
- 자식끼리 겹치지 않는가
- 지정한 방향으로 순서대로 배치되었는가
- gap이 균일한가
- 교차축 정렬이 올바른가

이 방식은 알고리즘 세부 구현이 바뀌어도 테스트가 깨지지 않는 안정성을 제공한다.

### 커버리지 목표

| 패키지 | 라인 커버리지 | 비고 |
|--------|-------------|------|
| `@depix/core` | **90%+** | 순수 로직, 브라우저 의존성 없음 |
| `@depix/engine` | **70%+** | Konva 의존, 노드 구조로 검증 |
| `@depix/editor` | **80%+** | 순수 로직 높음, DOM 의존 일부 |
| `@depix/react` | **60%+** | UI 컴포넌트, 구조 검증 위주 |

**상세 전략은 별도 문서 참조: `TESTING_STRATEGY.md`**

---

## 참조 문서

| 문서 | 내용 |
|------|------|
| `DEPIX_DSL_DRAFT.md` | DSL 문법 초안, 프리미티브 정의, 예제 |
| `DEPIX_IR_SPEC.md` | IR 타입 정의, 컴파일러 설계, 에디터-IR 관계 |
| `TESTING_STRATEGY.md` | 테스트 인프라, 패키지별 전략, 픽스처, 헬퍼, 커버리지 |
| `TODO.md` | 전체 구현 태스크 목록 |
| `DEPIX_SYNTAX_GUIDE.md` | DSL 문법 (참조) |
| `DEPIX_DESIGN.md` | 현재 아키텍처 (참조) |
| `types.ts` | 현재 타입 정의 (참조) |
