# Depix v2 Open Source TODO

## Overview

**전략**: 새 레포에서 새 아키텍처로 시작하되, 원본의 검증된 코드를 선택적으로 포팅

**원본 소스 위치**: `original/src/` (심볼릭 링크)

**범례**:
- **[N]** = New (완전 신규 작성)
- **[P]** = Port (원본에서 포팅 후 타입/인터페이스 적응)
- **[M]** = Modify (원본 기반 대폭 수정)

---

## Phase 0: 프로젝트 토대 ✅ COMPLETED

### T-01: 레포 및 빌드 셋업 [N] ✅

패키지 구조와 빌드 도구를 설정한다.

- [ ] git 초기화, `.gitignore`, `LICENSE` (MIT)
- [ ] pnpm workspace (모노레포) 구성:
  - `packages/core` — IR 타입, 컴파일러, 테마 (순수 TS, 브라우저 의존성 없음)
  - `packages/engine` — Konva 렌더러
  - `packages/editor` — 선택, 히스토리, 핸들
  - `packages/react` — React 컴포넌트
- [ ] TypeScript strict 모드, path alias, project references
- [ ] Vite 라이브러리 빌드 (각 패키지 ESM + 타입 출력)
- [ ] ESLint + Prettier
- [ ] Vitest 테스트 프레임워크 (패키지별 vitest.config.ts)
  - `packages/core`: environment `node` (순수 TS)
  - `packages/engine`: environment `happy-dom` (Konva canvas 의존)
  - `packages/editor`: environment `happy-dom`
  - `packages/react`: environment `happy-dom` + `@testing-library/react`
- [ ] 커버리지 설정 (`@vitest/coverage-v8`)
- [ ] 각 패키지 `package.json` exports 필드

**depends**: 없음
**ref**: `original/package.json`, `original/tsconfig.json`

---

### T-01A: 테스트 인프라 & 공유 픽스처 [N] ✅

테스트 헬퍼, 빌더 함수, 커스텀 매처, 공유 픽스처를 구축한다. 모든 후속 태스크의 테스트가 이 인프라 위에서 작성된다.

- [ ] `packages/core/__tests__/helpers/ir-builders.ts` — IR 요소 팩토리 빌더:
  - `shape()`, `text()`, `container()`, `edge()`, `line()`, `image()`, `path()`
  - `scene()`, `ir()` — 문서 레벨 빌더
  - 모든 빌더에 합리적 기본값 + `overrides` 파라미터
- [ ] `packages/core/__tests__/helpers/ast-builders.ts` — AST 노드 팩토리:
  - `flowBlock()`, `stackBlock()`, `gridBlock()`, `treeBlock()`
  - `nodeElement()`, `boxElement()`, `labelElement()`
- [ ] `packages/core/__tests__/helpers/layout-assertions.ts` — 레이아웃 불변식 검증:
  - `assertChildrenWithinParent(parent, children)` — 자식이 부모 안에 있는지
  - `assertNoOverlap(children)` — 자식끼리 겹치지 않는지
  - `assertOrderedInDirection(children, direction)` — 배치 순서
  - `assertUniformGap(children, direction, gap)` — 간격 균일성
  - `assertCrossAlignment(children, parent, align)` — 교차축 정렬
- [ ] `packages/core/__tests__/helpers/matchers.ts` — Vitest 커스텀 매처:
  - `toHaveBoundsCloseTo(expected, precision)` — bounds 근사 비교
  - `toMatchIRStructure(expected)` — IR 트리 구조 비교 (ID 무시)
  - `toContainCompileError({ line?, message })` — 컴파일 에러 검증
- [ ] `packages/core/__tests__/fixtures/` — 공유 테스트 픽스처:
  - `dsl/` — DSL v2 텍스트 파일 (14+ 정상 예제, 3+ 에러 예제)
  - `ast/` — 기대 AST JSON
  - `ir/` — 기대 IR JSON
  - `readFixture(path)` 유틸리티 함수

**depends**: T-01, T-02
**ref**: `docs/TESTING_STRATEGY.md`

---

### T-02: IR 타입 정의 [N] ✅

`DEPIX_IR_SPEC.md` 기반으로 DepixIR 타입 시스템을 정의한다. 전체 아키텍처의 중심 데이터 계약.

- [ ] `packages/core/src/ir/types.ts`:
  - `DepixIR`, `IRMeta`, `IRScene`
  - `IRElement` union (`IRShape | IRText | IRImage | IRLine | IRPath | IREdge | IRContainer`)
  - `IRBase`, `IRBounds`, `IRTransform`, `IROrigin`
  - `IRShape` + `IRInnerText`
  - `IRText`, `IRImage`, `IRLine`, `IRPoint`, `IRArrowType`
  - `IRPath`, `IREdge`, `IREdgePath`, `IRBezierSegment`, `IREdgeLabel`
  - `IRContainer`
  - `IRStyle`, `IRGradient`, `IRShadow`, `IRBackground`
  - `IRTransition`
- [ ] `packages/core/src/ir/validators.ts` — 런타임 검증 (bounds가 숫자인지, 색상이 HEX인지 등)
- [ ] `packages/core/src/ir/utils.ts` — 트리 순회 (findElement, walkElements, getParent), ID 생성
- [ ] 테스트 (`__tests__/ir/`):
  - validators: 유효한 IR, bounds 누락, 색상이 HEX 아닌 경우, 음수 크기
  - findElement: 최상위/중첩 컨테이너 내부/존재하지 않는 ID
  - walkElements: 빈 씬, 깊은 중첩, 콜백 호출 순서
  - generateId: 고유성 검증 (1000개 생성 시 중복 없음)

**depends**: T-01, T-01A
**ref**: `docs/DEPIX_IR_SPEC.md` (49-448행)

---

### T-03: 테마 시스템 [N] ✅

시맨틱 토큰(색상, 간격, fontSize, shadow, radius)을 구체 값으로 해석하는 테마 시스템.

- [ ] `packages/core/src/theme/types.ts`:
  - `DepixTheme` 인터페이스 (colors, spacing, fontSize, shadow, radius, node 기본값, edge 기본값)
  - `SemanticColor`: `'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'muted'`
  - `SemanticSpacing`, `SemanticFontSize`, `SemanticShadow`, `SemanticRadius` 타입
- [ ] `packages/core/src/theme/builtin-themes.ts`:
  - `lightTheme` (IR 스펙 508-553행 기반)
  - `darkTheme`
- [ ] `packages/core/src/theme/resolver.ts`:
  - `resolveColor(value, theme)` — `'primary'` → `'#3b82f6'`, HEX 패스스루
  - `resolveSpacing(value, theme)`
  - `resolveFontSize(value, theme)`
  - `resolveShadow(value, theme)`
  - `resolveRadius(value, theme)`
  - `resolveNamedColor(name, theme)` — `'blue'` → 매핑된 HEX
- [ ] 테스트 (`__tests__/theme/`):
  - resolveColor: 시맨틱 컬러 8종 각각, HEX 패스스루, 이름 컬러 (blue, red 등), 잘못된 값
  - resolveSpacing: xs~xl 5단계, 숫자 패스스루
  - resolveFontSize: xs~3xl 7단계, 파라미터화 테스트 (`it.each`)
  - resolveShadow: none/sm/md/lg, 결과 객체 구조 검증
  - resolveRadius: none/sm/md/lg/full
  - 테마 커스터마이징: lightTheme/darkTheme 기본값 확인, 커스텀 테마 오버라이드

**depends**: T-02
**ref**: `docs/DEPIX_IR_SPEC.md` (496-553행), `docs/DEPIX_DSL_V2_DRAFT.md` (317-355행)

---

## Phase 1: 컴파일러 + 렌더러

### T-04: DSL v2 토크나이저 [N]

v2 문법을 위한 새 토크나이저. v1과 문법이 근본적으로 다름.

- [ ] `packages/core/src/compiler/tokenizer.ts`:
  - 토큰 타입: `DIRECTIVE` (`@page`, `@theme` 등), `BLOCK_TYPE` (`flow`, `stack`, `grid`, `tree`, `group`, `layers`, `canvas`), `ELEMENT_TYPE` (`node`, `box`, `label`, `list`, `badge`, `icon`, `divider`, `image`, `cell`, `layer`, `rect`, `circle`, `line`, `text`), `HASH_ID` (`#id`), `ARROW` (`->`, `-->`, `--`, `<->`), `STRING`, `BRACE_OPEN/CLOSE`, `BRACKET_OPEN/CLOSE`, `PROPERTY`, `FLAG`, `SCENE_KEYWORD`, `NEWLINE`, `EOF`
  - 주석 처리 (`//`)
  - 문자열 리터럴, 이스케이프
  - 리스트 구문: `["item1", "item2"]`
  - 속성: `direction:right`, `gap:md`, `cols:3`
  - 플래그: `bold`, `italic`, `underline`, `strikethrough`, `center`, `outline`, `header`, `ordered`
- [ ] 테스트 (`__tests__/compiler/tokenizer.test.ts`):
  - 디렉티브: `@page 16:9`, `@theme dark`, `@style sketch`, `@transition fade`
  - 블록/요소 타입: 각 키워드별 토큰 생성 확인
  - 문자열: 일반, 이스케이프, 유니코드, 빈 문자열, 줄바꿈 포함
  - ID: `#simple`, `#with-dash`, `#123`
  - 화살표: `->`, `-->`, `--`, `<->`
  - 속성: `direction:right`, `gap:md`, `cols:3`, `background:#fff`
  - 리스트 구문: `["a", "b"]`, `["a"]`, `[]`
  - 주석: `// 주석`, 줄 끝 주석
  - 에러: 닫히지 않은 문자열, 잘못된 토큰, 위치 정보(line/column) 정확성

**depends**: T-01
**ref**: `original/src/core/tokenizer.ts` (구조 패턴 참조, 문법은 다름), `docs/DEPIX_DSL_V2_DRAFT.md`

---

### T-05: DSL v2 파서 (토큰 → AST) [N]

토큰 스트림을 문서 구조 AST로 변환.

- [ ] `packages/core/src/compiler/ast.ts` — AST 타입:
  - `ASTDocument { directives, scenes }`
  - `ASTScene { name, children }`
  - `ASTBlock { type, props, children, edges }`
  - `ASTElement { type, label, id, props, children }`
  - `ASTEdge { fromId, toId, style, label }`
  - `ASTDirective { key, value }`
  - `ASTStyle { properties }`
- [ ] `packages/core/src/compiler/parser.ts`:
  - 문서 디렉티브 파싱 (`@page`, `@theme`, `@style`, `@transition`)
  - `scene "name" { ... }` 파싱
  - 레이아웃 프리미티브 블록 파싱 (`flow`, `stack`, `grid`, `tree`, `group`, `layers`, `canvas`)
  - 시각 요소 파싱 (`node`, `box`, `label` 등)
  - `#id` 할당
  - 엣지 선언 파싱 (`#a -> #b "label"`, 체이닝 `#a -> #b -> #c`)
  - 중첩 블록
  - `canvas` 폴백 모드 (좌표 기반)
  - 에러 복구 (line/column 정보 포함)
- [ ] `packages/core/src/compiler/parse-error.ts`
- [ ] 테스트 (`__tests__/compiler/parser.test.ts`):
  - 문서 구조: 디렉티브만, 단일 씬, 다중 씬, 씬 없음 (암묵적 단일)
  - flow 블록: 자동 연결, 명시적 엣지, 체이닝 (`#a -> #b -> #c`), 라벨
  - stack 블록: row/col, gap/align, 중첩 자식
  - grid 블록: cols 지정, header 플래그
  - tree 블록: 중첩 노드 (부모-자식 관계)
  - group/layers 블록: 라벨과 자식 요소
  - canvas 폴백: 좌표 기반 rect, circle, line
  - 중첩: flow 안에 group, stack 안에 box + list
  - 인라인 스타일: background, color, border, shadow, radius
  - 에러 복구: 닫히지 않은 블록, 잘못된 속성, 누락 ID 참조, 에러 위치 정확성
  - 스냅샷: 6개 종합 예제의 AST 출력 (`toMatchSnapshot`)

**depends**: T-04
**ref**: `original/src/core/parser.ts` (패턴 참조), `docs/DEPIX_DSL_V2_DRAFT.md` (40-605행)

---

### T-06: 컴파일러 패스 — 테마 해석 [N]

두 번째 컴파일 패스: AST를 순회하며 모든 시맨틱 토큰을 테마 기반 구체 값으로 해석.

- [ ] `packages/core/src/compiler/passes/resolve-theme.ts`:
  - `resolveTheme(ast: ASTDocument, theme: DepixTheme): ASTDocument`
  - 색상 속성 해석 (`background`, `color`, `border`)
  - 간격 해석 (`gap`)
  - `font-size` 해석
  - `shadow`, `radius`, `border-width` 해석
  - 테마 `node` 기본값을 스타일 미지정 노드에 적용
  - 테마 `edge` 기본값을 스타일 미지정 엣지에 적용
- [ ] 테스트 (`__tests__/compiler/passes/resolve-theme.test.ts`):
  - 시맨틱 컬러 → HEX 변환 (AST 내 모든 color 속성)
  - gap 토큰 → 숫자 변환
  - 혼합 (일부 시맨틱 + 일부 리터럴 HEX)
  - 스타일 미지정 노드에 테마 기본값 적용 확인
  - 커스텀 테마 전달 시 해당 테마 값 사용

**depends**: T-03, T-05

---

### T-07: 레이아웃 알고리즘 — stack [P]

Flexbox 스타일 순차 배치. 기존 Frame 레이아웃 로직 기반.

- [ ] `packages/core/src/compiler/layout/stack-layout.ts`:
  - 입력: 해석된 크기의 자식들, direction (row/col), gap, align, wrap
  - 알고리즘: 자식 측정 → 공간 분배 → bounds 할당
  - `align`: start, center, end, stretch
  - `wrap: true` 다중 행 지원
  - 출력: 각 자식에 절대 `IRBounds`
- [ ] 기존 `frame-layout.ts`에서 측정 로직 포팅 (358-430행, `measureObjectSize`)
- [ ] 기존 `frame-layout.ts`에서 레이아웃 계산 포팅 (544-751행)
- [ ] 테스트 (`__tests__/compiler/layout/stack-layout.test.ts`):
  - row 3개 자식 균등: 겹치지 않음, 왼→오 순서, gap 균일 (`assertNoOverlap`, `assertOrderedInDirection`, `assertUniformGap`)
  - col 3개 자식 균등: 겹치지 않음, 위→아래 순서, gap 균일
  - align:center — 교차축 중앙 정렬 (`assertCrossAlignment`)
  - align:stretch — 교차축 크기가 컨테이너와 동일
  - wrap:true — 넘치는 자식이 다음 줄로
  - 빈 자식 — 크래시 없음
  - 단일 자식 — 정상 동작
  - 모든 자식이 부모 bounds 안에 있는지 (`assertChildrenWithinParent`)

**depends**: T-06, T-01A
**ref**: `original/src/engine/layout/frame-layout.ts` (전체 — 973행의 검증된 Flexbox 스타일 레이아웃)

---

### T-08: 레이아웃 알고리즘 — grid [N]

CSS Grid 스타일 행/열 배치.

- [ ] `packages/core/src/compiler/layout/grid-layout.ts`:
  - 입력: 자식들, cols 수, gap, header 플래그
  - 알고리즘: 셀 크기 = (전체 너비 - gaps) / cols, 행/열 위치 할당
  - 헤더 행 스타일링
  - 출력: 각 자식에 절대 `IRBounds`
- [ ] 테스트 (`__tests__/compiler/layout/grid-layout.test.ts`):
  - cols:3, 6개 셀 — 2행 3열 배치, 행/열 정렬
  - cols:2, 3개 셀 — 마지막 행 불완전 처리
  - header 행 — 첫 행에 header 스타일 적용
  - gap 적용 — 셀 간 간격 균일 (`assertUniformGap`)
  - 빈 그리드 — 크래시 없음
  - 모든 셀이 부모 bounds 안에 있는지 (`assertChildrenWithinParent`)

**depends**: T-06, T-01A

---

### T-09: 레이아웃 알고리즘 — flow [N]

방향성 그래프 토폴로지 정렬 기반 배치. 가장 복잡한 신규 레이아웃.

- [ ] `packages/core/src/compiler/layout/flow-layout.ts`:
  - 입력: 노드 ID 목록, 엣지 from/to, direction (right/down/left/up)
  - 알고리즘:
    1. 엣지에서 인접 그래프 구축
    2. 토폴로지 정렬
    3. 레이어 할당 (Sugiyama 스타일 또는 간소화 버전)
    4. 레이어 내 순서 최적화 (교차 최소화 — barycenter 휴리스틱)
    5. 레이어 및 위치 기반 절대 좌표 할당
  - 명시적 엣지 없으면 선언 순서대로 자동 연결 (A→B→C)
  - 출력: IRContainer + IRShape[] (노드) + IREdge[]
- [ ] 외부 라이브러리 없이 dagre 알고리즘 개념 참조하여 자체 구현
- [ ] 테스트 (`__tests__/compiler/layout/flow-layout.test.ts`):
  - 선형 (A→B→C) — direction 방향으로 순차 배치, `assertOrderedInDirection`
  - 분기 (A→B, A→C) — B와 C가 같은 레이어, `assertNoOverlap`
  - 합류 (B→D, C→D) — D가 B,C보다 뒤 레이어
  - 다이아몬드 (A→B,C / B,C→D) — 레이어 할당 정확, 노드 비겹침
  - direction:down — 세로 방향 배치
  - 자동 연결 (엣지 없음) — 선언 순서대로 연결
  - 고립 노드 — 연결 안 된 노드도 배치됨
  - 빈 flow — 크래시 없음
  - 모든 노드가 부모 bounds 안에 있는지 (`assertChildrenWithinParent`)

**depends**: T-06, T-01A
**ref**: `docs/DEPIX_IR_SPEC.md` (560-570행)

---

### T-10: 레이아웃 알고리즘 — tree [N]

Reingold-Tilford 또는 간소화 변형 트리 레이아웃.

- [ ] `packages/core/src/compiler/layout/tree-layout.ts`:
  - 입력: 계층적 노드 구조 (중첩 `node`), direction (down/right/left/up)
  - 알고리즘: Reingold-Tilford 또는 Walker's algorithm
  - 가변 노드 크기 처리
  - 부모-자식 엣지 자동 생성
  - 출력: IRContainer + IRShape[] + IREdge[]
- [ ] 테스트 (`__tests__/compiler/layout/tree-layout.test.ts`):
  - 이진 트리 — 부모가 자식 위, 자식이 대칭 배치
  - 넓은 트리 (자식 5개) — 자식 겹치지 않음 (`assertNoOverlap`)
  - 깊은 트리 (5레벨) — 레벨별 y좌표 일정
  - 단일 노드 — 정상 동작
  - direction:right — 가로 방향 트리
  - 부모-자식 엣지 자동 생성 확인

**depends**: T-06, T-01A

---

### T-11: 레이아웃 알고리즘 — group, layers [N]

단순 레이아웃 알고리즘들.

- [ ] `packages/core/src/compiler/layout/group-layout.ts`:
  - 모든 자식의 바운딩 박스 합산, 패딩, 배경/테두리 적용
  - 자식은 그룹 원점 기준 자동 스태킹
- [ ] `packages/core/src/compiler/layout/layers-layout.ts`:
  - 균등 수직 분할, 각 레이어는 수평 밴드
  - 각 레이어에 라벨 및 선택적 색상
- [ ] 테스트 (`__tests__/compiler/layout/group-layers-layout.test.ts`):
  - group: 바운딩 박스가 모든 자식을 포함 (`assertChildrenWithinParent`)
  - group: 패딩 적용 시 자식과 경계 사이 간격
  - layers 3개: 균등 높이 분할, 겹치지 않음, 위→아래 순서
  - layers: 라벨 텍스트 포함 확인
  - 빈 group/layers — 크래시 없음

**depends**: T-06, T-01A

---

### T-12: 엣지 라우팅 엔진 [P]

엣지의 구체적 경로 포인트를 계산.

- [ ] `packages/core/src/compiler/routing/edge-router.ts`:
  - 입력: 엣지 정의 (fromId, toId, style), 전체 요소 bounds
  - 알고리즘:
    1. 출발/도착 앵커 포인트 결정 (자동 또는 힌트)
    2. 경로 계산: straight, orthogonal (elbow), bezier
    3. 장애물 회피 (간소화 A* 또는 직교 라우팅)
    4. 라벨 위치 계산
  - 출력: `IREdge[]` (path, fromAnchor, toAnchor, labels 모두 해석됨)
- [ ] 기존 connector-utils.ts에서 포팅:
  - `getAnchorPoint` (도형 타입별 자동 감지)
  - `getRectBoundaryPoint`, `getEllipseBoundaryPoint`
  - `createStraightPath`, `createElbowPath`, `createCurvePath`
  - `getBezierMidpoint`, `getPolylineMidpoint` (라벨 배치)
- [ ] DSL 엣지 스타일 → IR 매핑:
  - `->` : solid + arrowEnd triangle
  - `-->` : dashed + arrowEnd triangle
  - `--` : solid, 화살표 없음
  - `<->` : solid + arrowStart triangle + arrowEnd triangle
- [ ] 테스트 (`__tests__/compiler/routing/edge-router.test.ts`):
  - 직선 연결: from/to 앵커가 도형 경계 위에 있음
  - 꺾임(elbow) 연결: 모든 세그먼트가 수직 또는 수평
  - 곡선(bezier) 연결: 제어점이 합리적 범위 내
  - 장애물 회피: 경로가 다른 노드를 관통하지 않음
  - 라벨 배치: 라벨 위치가 경로 위/근처
  - 앵커 자동 감지: 상대 위치에 따라 가장 가까운 면 선택
  - 동일 위치 노드: 엣지 케이스 처리

**depends**: T-02, T-01A
**ref**: `original/src/engine/renderers/connector-utils.ts` (경계 계산, 경로 생성), `original/src/engine/renderers/connector-renderer.ts` (화살표 마커)

---

### T-13: 컴파일러 — IR 출력 및 통합 [N]

최종 컴파일 패스: 해석된 요소, 레이아웃, 엣지를 `DepixIR` JSON으로 조합.

- [ ] `packages/core/src/compiler/passes/emit-ir.ts`:
  - 해석된 AST + 레이아웃 결과 + 라우팅된 엣지 → `DepixIR`
  - 모든 요소에 고유 ID 생성
  - 레이아웃 프리미티브 출신 컨테이너에 `origin` 메타데이터 설정
  - z-order 결정 (배열 순서)
  - 문서 메타데이터 해석 (`@page` → `IRMeta.aspectRatio`, `@style` → drawingStyle)
  - 전환 효과 처리
  - 최종 IR 검증 (모든 bounds가 숫자, 모든 색상이 HEX)
- [ ] `packages/core/src/compiler/compiler.ts`:
  - `compile(dsl: string, options?: CompileOptions): CompileResult`
  - `CompileResult = { success: true, ir: DepixIR } | { success: false, errors: CompileError[] }`
  - 전체 파이프라인 오케스트레이션: tokenize → parse → resolve theme → layout → route edges → emit IR
- [ ] 통합 테스트 (`__tests__/compiler/compiler.integration.test.ts`):
  - 6개 종합 예제 (fixtures/dsl/) 전수 컴파일 → IR 스냅샷 테스트 (`toMatchSnapshot`)
  - 테마 전환: 동일 DSL + light/dark → 색상 차이 확인
  - 에러 케이스: 잘못된 DSL → 에러에 line/column 포함 (`toContainCompileError`)
  - 왕복 안정성: compile → IR → 변경 없이 재검증 → 동일 결과

**depends**: T-04, T-05, T-06, T-07, T-08, T-09, T-10, T-11, T-12

---

### T-14: IR 기반 렌더러 (DepixEngine) [P/M]

DepixEngine을 `DepixIR` 입력으로 전환. 모든 레이아웃 계산이 완료된 상태이므로 렌더러는 극적으로 단순해짐.

- [ ] `packages/engine/src/depix-engine.ts`:
  - 입력을 `DepixDocument` → `DepixIR`로 변경
  - `load(ir: DepixIR)` / `loadFromString(dsl: string)` (DSL은 내부에서 컴파일)
  - 레이아웃 계산 책임 제거
  - 유지: Stage/Layer 관리, 리사이즈, 배경 렌더링, 씬 관리, 좌표 변환, 이벤트
- [ ] `packages/engine/src/ir-renderer.ts`:
  - `IRElement.type` 기반 디스패치
  - `renderShape` — shape 속성(rect/circle/ellipse/diamond/pill/hexagon)별 Konva 노드
  - `renderText` — Konva.Text
  - `renderImage` — Konva.Image
  - `renderLine` — Konva.Line
  - `renderPath` — Konva.Path
  - `renderEdge` — 사전 계산된 경로 + 화살표 마커 + 라벨
  - `renderContainer` — Konva.Group + 클리핑, 자식 재귀
  - 각 렌더러: bounds 읽기 → `toAbsolute()` → Konva 노드 생성. 계산 없음.
- [ ] 스타일 유틸리티 포팅:
  - 그라데이션 fill/stroke
  - 그림자 렌더링
  - 대시 패턴
  - 스케치 스타일 어댑터 (RoughJS)
- [ ] 배경 렌더링 포팅
- [ ] 씬 전환 매니저 포팅
- [ ] 테스트 (`packages/engine/__tests__/`):
  - 렌더러 단위 (노드 구조 검증, 픽셀 비교 아님):
    - shape: rect/circle/ellipse/diamond/pill/hexagon 각각 → Konva 노드 타입/속성 확인
    - text: 기본, bold, italic, align, fontSize
    - image: fit 옵션, cornerRadius
    - line: 화살표 유무, 대시 패턴
    - edge: straight/polyline/bezier, 화살표 마커, 라벨
    - container: 자식 재귀 렌더링, 클리핑
  - 스타일 어댑터: default vs sketch (RoughJS 호출 확인)
  - 좌표 변환: toAbsolute/toRelative, 다양한 aspectRatio (16:9, 4:3, 1:1)
  - 배경 렌더링: 단색, 그라데이션
  - 엔진 통합: IR load → Stage 노드 트리 구조 확인

**depends**: T-01, T-02
**ref**:
  - `original/src/engine/depix-engine.ts` — 전체 엔진 구조
  - `original/src/engine/object-renderer.ts` — 렌더러 위임 패턴
  - `original/src/engine/renderers/rect-renderer.ts` — 도형 렌더링
  - `original/src/engine/renderers/circle-renderer.ts`
  - `original/src/engine/renderers/ellipse-renderer.ts`
  - `original/src/engine/renderers/text-renderer.ts`
  - `original/src/engine/renderers/image-renderer.ts`
  - `original/src/engine/renderers/line-renderer.ts`
  - `original/src/engine/renderers/path-renderer.ts`
  - `original/src/engine/renderers/group-renderer.ts`
  - `original/src/engine/renderers/frame-renderer.ts` — 컨테이너 (레이아웃 계산 제거)
  - `original/src/engine/renderers/connector-renderer.ts` — 엣지/화살표
  - `original/src/engine/renderers/list-renderer.ts`
  - `original/src/engine/renderers/symbol-renderer.ts`
  - `original/src/engine/renderers/base-renderer.ts` — 기본 유틸 (스케일, 폰트 크기 등)
  - `original/src/engine/renderers/renderer-registry.ts`
  - `original/src/engine/renderers/style-adapters/sketch-adapter.ts`
  - `original/src/engine/renderers/style-adapters/svg-path-utils.ts`
  - `original/src/engine/scene-manager.ts`
  - `original/src/engine/transition-manager.ts`
  - `original/src/engine/engine-events.ts`

---

### T-15: E2E 파이프라인 테스트 [N]

DSL → IR → Render 전체 파이프라인을 예제 다이어그램으로 검증.

- [ ] DSL v2 초안 문서의 6개 예제로 테스트 픽스처 생성
- [ ] tokenize → parse → compile → IR 구조 검증
- [ ] IR → Konva Stage 렌더링 테스트 (스냅샷)
- [ ] 컴파일 에러 케이스 (잘못된 DSL, 누락된 참조 등)
- [ ] 테마 전환 테스트 (동일 DSL에 light vs dark)

**depends**: T-13, T-14

---

## Phase 2: 에디터

### T-16: SelectionManager 포팅 [P/M]

IR 요소 기반 선택 관리 시스템.

- [ ] `packages/editor/src/selection-manager.ts`:
  - `DepixObject` → `IRElement`로 타입 변경
  - 유지: 클릭 선택, 다중 선택 (shift/ctrl), 드래그, 호버, 이벤트 위임
  - 수정: IR 요소 ID 기반 조회
  - 스냅 가이드 인터페이스 유지

**depends**: T-14
**ref**: `original/src/editor/selection-manager.ts`

---

### T-17: HistoryManager 포팅 [P]

Undo/Redo 시스템. 대부분 IR 무관한 로직.

- [ ] `packages/editor/src/history-manager.ts`:
  - 코어 undo/redo 스택 로직은 타입 무관 (클로저 기반 액션)
  - `createPropertyAction` 헬퍼를 IR 요소 속성에 맞게 수정
  - `createAddAction` / `createDeleteAction` IR 요소용으로 수정
  - 유지: 머지 타임아웃, 최대 히스토리, 변경 리스너

**depends**: T-01
**ref**: `original/src/editor/history-manager.ts` (거의 1:1 포팅)

---

### T-18: HandleManager 포팅 [P/M]

IR 요소용 핸들 시스템 (리사이즈, 회전, 엔드포인트).

- [ ] `packages/editor/src/handle-manager.ts` — 포팅
- [ ] 핸들 전략, IR용으로 간소화:
  - `IRShape` 가 모든 도형 처리 (rect, circle, ellipse, diamond 등)
  - `IRContainer` 는 그룹 스타일 핸들
  - `IREdge` 는 커넥터 핸들
  - `IRLine` 은 엔드포인트 핸들
  - `IRText`, `IRImage` 는 사각형 스타일 핸들
- [ ] 트랜스포머 통합
- [ ] 간소화: 프레임 auto-layout 자식 감지 제거 (IR 컨테이너는 bounds 해석 완료)

**depends**: T-14, T-16
**ref**:
  - `original/src/editor/handle-manager.ts`
  - `original/src/editor/handles/` (모든 파일)
  - `original/src/editor/transformers/` (모든 파일)

---

### T-19: 스냅 가이드 시스템 포팅 [P]

정렬/스냅 가이드 시스템.

- [ ] `packages/editor/src/guides/`:
  - `snap-calculator.ts`
  - `snap-guide-manager.ts`
  - `guide-renderer.ts`
  - `types.ts`
- [ ] IR bounds에 맞게 적응 (더 단순 — 모든 요소에 `IRBounds` 존재)

**depends**: T-14
**ref**: `original/src/editor/guides/` (모든 파일)

---

### T-20: IR 직접 조작 API [N]

에디터가 IR을 직접 변경하는 연산 레이어.

- [ ] `packages/editor/src/ir-operations.ts`:
  - `moveElement(ir, elementId, dx, dy)` — bounds 변경, origin 있으면 연결 엣지 재계산
  - `resizeElement(ir, elementId, newBounds)` — bounds 변경, 연결 엣지 재계산
  - `addElement(scene, element)` — elements 배열에 추가
  - `removeElement(ir, elementId)` — 트리에서 제거, 참조 엣지 정리
  - `updateStyle(ir, elementId, style)` — 스타일 변경 머지
  - `updateText(ir, elementId, content)` — 텍스트 내용 변경
  - `reorderElements(scene, elementIds)` — z-order 재정렬
- [ ] `packages/editor/src/ir-edge-operations.ts`:
  - `recalculateEdge(ir, edgeId)` — 현재 요소 위치 기반 엣지 재라우팅
  - `recalculateConnectedEdges(ir, elementId)` — 해당 요소에 연결된 모든 엣지 재라우팅
- [ ] 테스트 (`packages/editor/__tests__/ir-operations.test.ts`):
  - moveElement: 일반 이동 → bounds 변경 확인, 컨테이너 내 이동
  - resizeElement: bounds 업데이트, 최소 크기 제약
  - addElement: 추가 후 findElement로 조회
  - removeElement: 삭제 후 조회 불가, 연결 엣지 정리 확인
  - updateStyle: 부분 머지 (기존 스타일 유지), 새 속성 추가
  - reorderElements: z-order 변경 확인
  - recalculateEdge: 요소 이동 후 엣지 path 업데이트 확인
  - recalculateConnectedEdges: 연결된 모든 엣지 업데이트

**depends**: T-02, T-12, T-01A

---

### T-21: 시맨틱 구조 활용 [N]

`IROrigin` 메타데이터를 활용한 스마트 편집.

- [ ] `packages/editor/src/semantic-editor.ts`:
  - `addNodeToFlow(container, newNode)` — origin이 `flow`면 flow 레이아웃 재실행
  - `reorderStackChild(container, fromIndex, toIndex)` — stack 레이아웃 재실행
  - `addGridCell(container, newCell)` — grid 레이아웃 재실행
  - `isSemanticContainer(element): boolean`
  - `getSemanticType(element): string | null`
- [ ] 시맨틱 컨테이너 내 요소 수정 시 자동 재레이아웃 통합
- [ ] 테스트 (`packages/editor/__tests__/semantic-editor.test.ts`):
  - addNodeToFlow: flow origin 컨테이너에 노드 추가 → 재배치 발생
  - reorderStackChild: 순서 변경 → 재배치 발생
  - addGridCell: 셀 추가 → 그리드 재계산
  - isSemanticContainer: origin 있는/없는 요소 구분
  - 일반 컨테이너 (origin 없음)에 추가 시 재배치 미발생

**depends**: T-20, T-07, T-08, T-09, T-10

---

### T-22: 시맨틱 해체 (Detach) [N]

시맨틱 레이아웃 제약에서 벗어나 자유 편집으로 전환. Figma의 "Remove Auto Layout"과 동일.

- [ ] `packages/editor/src/detach.ts`:
  - `detachFromLayout(ir, containerId)` — 컨테이너와 모든 자식에서 `origin` 제거
  - 해체 후 자식은 현재 절대 위치 유지, 자동 레이아웃 미적용
- [ ] 테스트 (`packages/editor/__tests__/detach.test.ts`):
  - flow 컨테이너 해체 → origin 제거 확인, 자식 위치 보존 확인
  - 해체 후 노드 추가 시 재레이아웃 미트리거 확인
  - 중첩 컨테이너 해체: 자식의 origin도 제거
  - 이미 origin 없는 컨테이너 해체 → 무동작

**depends**: T-21

---

## Phase 3: React UI + 통합

### T-23: DepixCanvas (뷰어) 포팅 [P/M]

읽기 전용 React 캔버스 컴포넌트.

- [ ] `packages/react/src/DepixCanvas.tsx`:
  - `data: string | DepixIR` 수용 (string = DSL v2 텍스트, 내부 컴파일)
  - `useDepixCanvas` 훅 포팅
  - 씬 네비게이션 (next/prev/setScene)
  - 리사이즈 처리
  - `ref` imperative API

**depends**: T-14
**ref**: `original/src/react/DepixCanvas.tsx`

---

### T-24: DepixCanvasEditable 포팅 [P/M]

편집 가능한 캔버스 컴포넌트.

- [ ] `packages/react/src/DepixCanvasEditable.tsx`:
  - IR 기반 데이터 흐름으로 포팅
  - SelectionManager, HistoryManager, HandleManager 통합 (packages/editor)
  - 편집 모드 토글, undo/redo, 삭제, 속성 변경
  - 씬 관리 (추가/삭제/이름변경/순서변경)
  - 레이어 관리
  - 커넥터/앵커포인트 관리
  - 전체화면 오버레이
- [ ] `packages/react/src/context/DepixContext.tsx` 포팅 (다중 블록 편집 코디네이션)

**depends**: T-16, T-17, T-18, T-19, T-20, T-23
**ref**: `original/src/react/DepixCanvasEditable.tsx`, `original/src/react/context/DepixContext.tsx`, `original/src/editor/anchor-point-manager.ts`

---

### T-25: FloatingToolbar 포팅 [P/M]

플로팅 툴바 컴포넌트.

- [ ] `packages/react/src/components/FloatingToolbar.tsx`:
  - 도구 선택 (select, rect, circle, text, line, connector 등)
  - Undo/Redo 버튼
  - 삭제 버튼
  - 심볼 피커 트리거
  - IR 네이티브 요소 생성에 맞게 도구 타입 적응
- [ ] `useDraggable` 훅 포팅
- [ ] 패널 위치 훅 포팅

**depends**: T-23
**ref**: `original/src/react/components/FloatingToolbar.tsx`, `original/src/react/hooks/useDraggable.ts`, `original/src/react/hooks/usePanelPositions.ts`

---

### T-26: FloatingPropertyPanel 포팅 [P/M]

속성 편집 패널. IR 요소 타입에 맞게 에디터 재구성.

- [ ] `packages/react/src/components/FloatingPropertyPanel.tsx`
- [ ] 속성 패널 탭 포팅:
  - `CanvasTab.tsx` — 비율, 배경
  - `LayersTab.tsx` — 요소 순서, 잠금, 프레임 계층
  - `SceneTab.tsx` — 씬 목록, 추가/삭제/이름변경/순서변경
- [ ] 속성 에디터 — 기존 12개 타입별 → IR 기반으로 통합:
  - `ShapeEditor` (rect, circle, ellipse 에디터 통합) — fill, stroke, shadow, cornerRadius, innerText
  - `TextEditor` — content, fontSize, color, fontWeight, align
  - `ImageEditor` — src, fit, cornerRadius
  - `LineEditor` — from/to, stroke, arrows
  - `EdgeEditor` (connector 에디터 대체) — path type, stroke, arrows, labels
  - `ContainerEditor` (frame, group 에디터 대체) — clip, background, children
  - `BaseEditor` — 공통 bounds, transform, style 컨트롤
- [ ] 속성 컨트롤 포팅 (color, number, select, checkbox, range, slider, text)

**depends**: T-24
**ref**: `original/src/react/components/FloatingPropertyPanel.tsx`, `original/src/react/components/property-panel-tabs/`, `original/src/react/property-editors/`, `original/src/react/property-controls/`

---

### T-27: SymbolPicker 포팅 [P]

심볼/아이콘 피커.

- [ ] `packages/react/src/components/SymbolPicker.tsx` 포팅
- [ ] 에셋 레지스트리 시스템 포팅:
  - `packages/core/src/assets/asset-registry.ts`
  - `packages/core/src/assets/asset-types.ts`
  - `packages/core/src/assets/builtin-assets.ts`
- [ ] IR에서 심볼은 `IRShape`/`IRPath`로 해석되지만, 에디터 피커는 에셋 카탈로그 필요

**depends**: T-25
**ref**: `original/src/react/components/SymbolPicker.tsx`, `original/src/core/assets/`

---

### T-28: 키보드 단축키 & 오브젝트 생성 훅 포팅 [P]

- [ ] `useKeyboardShortcuts.ts` 포팅 (Ctrl+Z, Ctrl+Y, Delete, 도구 단축키)
- [ ] `useObjectCreation.ts` 포팅 — IR 요소 생성으로 적응
- [ ] `useDraggable.ts` 포팅
- [ ] `usePanelPositions.ts` 포팅

**depends**: T-24
**ref**: `original/src/react/hooks/`

---

### T-29: TipTap 통합 [P/M]

리치 텍스트 에디터 내 Depix 블록 임베딩.

- [ ] `packages/tiptap/src/depix-block.ts`:
  - TipTap Node extension for `depixBlock`
  - Node attrs: `{ ir: DepixIR, dsl?: string }`
  - 마크다운 직렬화: ````depix ... ``` 코드 블록

**depends**: T-24
**ref**: `original/src/tiptap/depix-block.ts`

---

### T-30: Export 기능 [P/M]

PNG 내보내기, IR 입력으로 적응.

- [ ] `packages/engine/src/export/png-renderer.ts`:
  - `renderIRToPNG(ir, sceneId?, options?): PNGResult`
  - 원본의 MiniDepixEngine 패턴 포팅 (오프스크린 Konva Stage)
  - IR 기반 렌더러 사용

**depends**: T-14
**ref**: `original/src/export/png-renderer.ts`

---

## Phase 4: 오픈소스 준비

### T-31: README & 문서화 [N]

- [ ] 루트 `README.md`: 프로젝트 개요, 기능, 빠른 시작, 아키텍처 다이어그램, 설치
- [ ] `docs/DSL_GUIDE.md`: DSL v2 완전 문법 레퍼런스 + 예제
- [ ] `docs/IR_SPEC.md`: 고급 사용자/대체 프론트엔드용 IR 스펙
- [ ] `docs/THEME_GUIDE.md`: 커스텀 테마 생성 가이드
- [ ] `docs/ARCHITECTURE.md`: 아키텍처 개요 (DSL → Compiler → IR → Renderer)
- [ ] 각 패키지 README
- [ ] API 레퍼런스 (TypeDoc 등)
- [ ] 모든 public API에 JSDoc

**depends**: T-15, T-24

---

### T-32: CONTRIBUTING 가이드 [N]

- [ ] `CONTRIBUTING.md`: 개발 환경 설정, 코딩 표준, PR 프로세스, 커밋 컨벤션
- [ ] `CODE_OF_CONDUCT.md`
- [ ] Issue 템플릿 (버그 리포트, 기능 요청)
- [ ] PR 템플릿

**depends**: T-31

---

### T-33: 예제 & 데모 앱 [N/P]

- [ ] `apps/demo/` Vite 앱:
  - DSL v2 예제 갤러리
  - 라이브 DSL 에디터 (textarea + 프리뷰)
  - 테마 스위처 (light/dark)
  - Export 버튼
  - 편집 캔버스 데모
- [ ] 원본 데모에서 유용한 예제 포팅
- [ ] `examples/` 디렉토리 (독립 사용 예제):
  - 기본 React 사용법
  - TipTap 통합
  - 프로그래밍 방식 IR 생성
  - 커스텀 테마

**depends**: T-14, T-24
**ref**: `original/demo/`

---

### T-34: CI/CD 파이프라인 [N]

- [ ] GitHub Actions 워크플로우:
  - Lint (ESLint)
  - Type check (tsc --noEmit)
  - 단위 테스트 (Vitest)
  - 전체 패키지 빌드
- [ ] 릴리스 태그 시 npm 자동 배포
- [ ] main 푸시 시 데모 앱 배포 (GitHub Pages / Vercel)
- [ ] PR 프리뷰 배포

**depends**: T-01

---

### T-35: npm 배포 준비 [N]

- [ ] 패키지명 확정: `@depix/core`, `@depix/engine`, `@depix/editor`, `@depix/react`, `@depix/tiptap`
- [ ] 각 패키지 `package.json`:
  - `exports` (ESM + types)
  - `files` (dist only)
  - `peerDependencies` (react, konva, tiptap 선택적)
  - `engines` (node >= 18)
  - `repository`, `homepage`, `bugs` URL
  - `keywords`, `description`
- [ ] changesets 버전 관리 설정
- [ ] `npm pack` 출력 검증 (불필요한 파일 제외)
- [ ] 신규 프로젝트에서 설치 테스트

**depends**: T-31, T-34

---

## 의존성 그래프

```
Phase 0:
  T-01 (레포 셋업)
   ├── T-02 (IR 타입) ── T-03 (테마)
   ├── T-04 (토크나이저)
   └── T-01A (테스트 인프라) ← T-01 + T-02

Phase 1:
  T-04 → T-05 (파서)
  T-03 + T-05 → T-06 (테마 해석 패스)
  T-06 → T-07 (stack) ─┐
  T-06 → T-08 (grid)  ─┤
  T-06 → T-09 (flow)  ─┼→ T-13 (IR 출력/컴파일러)
  T-06 → T-10 (tree)  ─┤
  T-06 → T-11 (group) ─┤
  T-02 → T-12 (엣지) ──┘
  T-01 + T-02 → T-14 (렌더러)
  T-13 + T-14 → T-15 (E2E 테스트)

Phase 2:
  T-14 → T-16 (선택) ─┐
  T-01 → T-17 (히스토리)│
  T-16 → T-18 (핸들)  ─┼→ T-24 (편집 캔버스)
  T-14 → T-19 (스냅)  ─┤
  T-02 + T-12 → T-20 (IR 조작) → T-21 (시맨틱) → T-22 (해체)

Phase 3:
  T-14 → T-23 (뷰어 캔버스) → T-25 (툴바) → T-27 (심볼 피커)
  T-23 + Phase2 → T-24 (편집 캔버스) → T-26 (속성 패널)
  T-24 → T-28 (훅) / T-29 (TipTap)
  T-14 → T-30 (Export)

Phase 4:
  T-15 + T-24 → T-31 (문서) → T-32 (CONTRIBUTING)
  T-14 + T-24 → T-33 (데모)
  T-01 → T-34 (CI/CD)
  T-31 + T-34 → T-35 (npm 배포)
```

---

## 파일 매핑 (신규 → 원본 참조)

| 신규 패키지 | 신규 경로 | 타입 | 원본 참조 |
|---|---|---|---|
| core | `src/ir/types.ts` | [N] | `docs/DEPIX_IR_SPEC.md` |
| core | `src/ir/validators.ts` | [N] | — |
| core | `src/ir/utils.ts` | [N] | `core/object-utils.ts` (패턴) |
| core | `src/theme/types.ts` | [N] | `docs/DEPIX_IR_SPEC.md` |
| core | `src/theme/builtin-themes.ts` | [N] | `constants/` (최소 참조) |
| core | `src/theme/resolver.ts` | [N] | — |
| core | `src/compiler/tokenizer.ts` | [N] | `core/tokenizer.ts` (구조 패턴) |
| core | `src/compiler/ast.ts` | [N] | — |
| core | `src/compiler/parser.ts` | [N] | `core/parser.ts` (구조 패턴) |
| core | `src/compiler/passes/resolve-theme.ts` | [N] | — |
| core | `src/compiler/layout/stack-layout.ts` | [P] | `engine/layout/frame-layout.ts` |
| core | `src/compiler/layout/grid-layout.ts` | [N] | — |
| core | `src/compiler/layout/flow-layout.ts` | [N] | — |
| core | `src/compiler/layout/tree-layout.ts` | [N] | — |
| core | `src/compiler/layout/group-layout.ts` | [N] | — |
| core | `src/compiler/layout/layers-layout.ts` | [N] | — |
| core | `src/compiler/routing/edge-router.ts` | [P] | `engine/renderers/connector-utils.ts` |
| core | `src/compiler/passes/emit-ir.ts` | [N] | — |
| core | `src/compiler/compiler.ts` | [N] | — |
| core | `src/assets/` | [P] | `core/assets/` |
| engine | `src/depix-engine.ts` | [P] | `engine/depix-engine.ts` |
| engine | `src/ir-renderer.ts` | [M] | `engine/object-renderer.ts` + 렌더러 전체 |
| engine | `src/renderers/shape-renderer.ts` | [M] | `engine/renderers/rect-,circle-,ellipse-renderer.ts` |
| engine | `src/renderers/text-renderer.ts` | [P] | `engine/renderers/text-renderer.ts` |
| engine | `src/renderers/edge-renderer.ts` | [M] | `engine/renderers/connector-renderer.ts` |
| engine | `src/renderers/container-renderer.ts` | [M] | `engine/renderers/frame-,group-renderer.ts` |
| engine | `src/renderers/style-adapters/` | [P] | `engine/renderers/style-adapters/` |
| engine | `src/scene-manager.ts` | [P] | `engine/scene-manager.ts` |
| engine | `src/transition-manager.ts` | [P] | `engine/transition-manager.ts` |
| engine | `src/export/png-renderer.ts` | [P] | `export/png-renderer.ts` |
| editor | `src/selection-manager.ts` | [P] | `editor/selection-manager.ts` |
| editor | `src/history-manager.ts` | [P] | `editor/history-manager.ts` |
| editor | `src/handle-manager.ts` | [P] | `editor/handle-manager.ts` |
| editor | `src/handles/` | [P] | `editor/handles/` |
| editor | `src/transformers/` | [P] | `editor/transformers/` |
| editor | `src/guides/` | [P] | `editor/guides/` |
| editor | `src/ir-operations.ts` | [N] | — |
| editor | `src/semantic-editor.ts` | [N] | — |
| editor | `src/detach.ts` | [N] | — |
| editor | `src/anchor-point-manager.ts` | [P] | `editor/anchor-point-manager.ts` |
| react | `src/DepixCanvas.tsx` | [P] | `react/DepixCanvas.tsx` |
| react | `src/DepixCanvasEditable.tsx` | [P] | `react/DepixCanvasEditable.tsx` |
| react | `src/components/FloatingToolbar.tsx` | [P] | `react/components/FloatingToolbar.tsx` |
| react | `src/components/FloatingPropertyPanel.tsx` | [P] | `react/components/FloatingPropertyPanel.tsx` |
| react | `src/components/SymbolPicker.tsx` | [P] | `react/components/SymbolPicker.tsx` |
| react | `src/components/FullscreenOverlay.tsx` | [P] | `react/components/FullscreenOverlay.tsx` |
| react | `src/components/property-panel-tabs/` | [P] | `react/components/property-panel-tabs/` |
| react | `src/property-editors/` | [M] | `react/property-editors/` (통합) |
| react | `src/property-controls/` | [P] | `react/property-controls/` |
| react | `src/hooks/` | [P] | `react/hooks/` |
| react | `src/context/` | [P] | `react/context/` |
| tiptap | `src/depix-block.ts` | [P] | `tiptap/depix-block.ts` |
