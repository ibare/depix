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

- [x] git 초기화, `.gitignore`, `LICENSE` (MIT)
- [x] pnpm workspace (모노레포) 구성:
  - `packages/core` — IR 타입, 컴파일러, 테마 (순수 TS, 브라우저 의존성 없음)
  - `packages/engine` — Konva 렌더러
  - `packages/editor` — 선택, 히스토리, 핸들
  - `packages/react` — React 컴포넌트
- [x] TypeScript strict 모드, path alias, project references
- [x] tsc 라이브러리 빌드 (각 패키지 ESM + 타입 출력)
- [x] ESLint + Prettier
- [x] Vitest 테스트 프레임워크 (패키지별 vitest.config.ts)
  - `packages/core`: environment `node` (순수 TS)
  - `packages/engine`: environment `happy-dom` (Konva canvas 의존)
  - `packages/editor`: environment `happy-dom`
  - `packages/react`: environment `happy-dom` + `@testing-library/react`
- [x] 커버리지 설정 (`@vitest/coverage-v8`)
- [x] 각 패키지 `package.json` exports 필드

**depends**: 없음
**ref**: `original/package.json`, `original/tsconfig.json`

---

### T-01A: 테스트 인프라 & 공유 픽스처 [N] ✅

테스트 헬퍼, 빌더 함수, 커스텀 매처, 공유 픽스처를 구축한다. 모든 후속 태스크의 테스트가 이 인프라 위에서 작성된다.

- [x] `packages/core/__tests__/helpers/ir-builders.ts` — IR 요소 팩토리 빌더:
  - `shape()`, `text()`, `container()`, `edge()`, `line()`, `image()`, `path()`
  - `scene()`, `ir()` — 문서 레벨 빌더
  - 모든 빌더에 합리적 기본값 + `overrides` 파라미터
- [x] `packages/core/__tests__/helpers/layout-assertions.ts` — 레이아웃 불변식 검증:
  - `assertChildrenWithinParent(parent, children)` — 자식이 부모 안에 있는지
  - `assertNoOverlap(children)` — 자식끼리 겹치지 않는지
  - `assertOrderedInDirection(children, direction)` — 배치 순서
  - `assertUniformGap(children, direction, gap)` — 간격 균일성
  - `assertCrossAlignment(children, parent, align)` — 교차축 정렬

**depends**: T-01, T-02
**ref**: `docs/TESTING_STRATEGY.md`

---

### T-02: IR 타입 정의 [N] ✅

`DEPIX_IR_SPEC.md` 기반으로 DepixIR 타입 시스템을 정의한다. 전체 아키텍처의 중심 데이터 계약.

- [x] `packages/core/src/ir/types.ts`:
  - `DepixIR`, `IRMeta`, `IRScene`
  - `IRElement` union (`IRShape | IRText | IRImage | IRLine | IRPath | IREdge | IRContainer`)
  - `IRBase`, `IRBounds`, `IRTransform`, `IROrigin`
  - `IRShape` + `IRInnerText`
  - `IRText`, `IRImage`, `IRLine`, `IRPoint`, `IRArrowType`
  - `IRPath`, `IREdge`, `IREdgePath`, `IRBezierSegment`, `IREdgeLabel`
  - `IRContainer`
  - `IRStyle`, `IRGradient`, `IRShadow`, `IRBackground`
  - `IRTransition`
- [x] `packages/core/src/ir/validators.ts` — 런타임 검증 (bounds가 숫자인지, 색상이 HEX인지 등)
- [x] `packages/core/src/ir/utils.ts` — 트리 순회 (findElement, walkElements, getParent), ID 생성
- [x] 테스트 (`__tests__/ir/`):
  - validators: 유효한 IR, bounds 누락, 색상이 HEX 아닌 경우, 음수 크기
  - findElement: 최상위/중첩 컨테이너 내부/존재하지 않는 ID
  - walkElements: 빈 씬, 깊은 중첩, 콜백 호출 순서
  - generateId: 고유성 검증 (1000개 생성 시 중복 없음)

**depends**: T-01, T-01A
**ref**: `docs/DEPIX_IR_SPEC.md` (49-448행)

---

### T-03: 테마 시스템 [N] ✅

시맨틱 토큰(색상, 간격, fontSize, shadow, radius)을 구체 값으로 해석하는 테마 시스템.

- [x] `packages/core/src/theme/types.ts`:
  - `DepixTheme` 인터페이스 (colors, spacing, fontSize, shadow, radius, node 기본값, edge 기본값)
  - `SemanticColor`: `'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'muted'`
  - `SemanticSpacing`, `SemanticFontSize`, `SemanticShadow`, `SemanticRadius` 타입
- [x] `packages/core/src/theme/builtin-themes.ts`:
  - `lightTheme` (IR 스펙 508-553행 기반)
  - `darkTheme`
- [x] `packages/core/src/theme/resolver.ts`:
  - `resolveColor(value, theme)` — `'primary'` → `'#3b82f6'`, HEX 패스스루
  - `resolveSpacing(value, theme)`
  - `resolveFontSize(value, theme)`
  - `resolveShadow(value, theme)`
  - `resolveRadius(value, theme)`
  - `resolveNamedColor(name, theme)` — `'blue'` → 매핑된 HEX
- [x] 테스트 (`__tests__/theme/`):
  - resolveColor: 시맨틱 컬러 8종 각각, HEX 패스스루, 이름 컬러 (blue, red 등), 잘못된 값
  - resolveSpacing: xs~xl 5단계, 숫자 패스스루
  - resolveFontSize: xs~3xl 7단계, 파라미터화 테스트 (`it.each`)
  - resolveShadow: none/sm/md/lg, 결과 객체 구조 검증
  - resolveRadius: none/sm/md/lg/full
  - 테마 커스터마이징: lightTheme/darkTheme 기본값 확인, 커스텀 테마 오버라이드

**depends**: T-02
**ref**: `docs/DEPIX_IR_SPEC.md` (496-553행), `docs/DEPIX_DSL_V2_DRAFT.md` (317-355행)

---

## Phase 1: 컴파일러 + 렌더러 ✅ COMPLETED

### T-04: DSL v2 토크나이저 [N] ✅

v2 문법을 위한 새 토크나이저. v1과 문법이 근본적으로 다름.

- [x] `packages/core/src/compiler/tokenizer.ts`:
  - 토큰 타입: `DIRECTIVE` (`@page`, `@theme` 등), `BLOCK_TYPE` (`flow`, `stack`, `grid`, `tree`, `group`, `layers`, `canvas`), `ELEMENT_TYPE` (`node`, `box`, `label`, `list`, `badge`, `icon`, `divider`, `image`, `cell`, `layer`, `rect`, `circle`, `line`, `text`), `HASH` (`#id`), `ARROW` (`->`, `-->`, `--`, `<->`), `STRING`, `BRACE_OPEN/CLOSE`, `BRACKET_OPEN/CLOSE`, `COLON`, `COMMA`, `NUMBER`, `IDENTIFIER`, `FLAG`, `SCENE`, `NEWLINE`, `EOF`
  - 주석 처리 (`//`)
  - 문자열 리터럴, 이스케이프
  - 리스트 구문: `["item1", "item2"]`
  - 속성: `direction:right`, `gap:md`, `cols:3`
  - 플래그: `bold`, `italic`, `underline`, `strikethrough`, `center`, `outline`, `header`, `ordered`
- [x] 테스트 (`__tests__/compiler/tokenizer.test.ts`): 133 tests
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

### T-05: DSL v2 파서 (토큰 → AST) [N] ✅

토큰 스트림을 문서 구조 AST로 변환.

- [x] `packages/core/src/compiler/ast.ts` — AST 타입:
  - `ASTDocument { directives, scenes }`
  - `ASTScene { name, children }`
  - `ASTBlock { blockType, props, children }`
  - `ASTElement { elementType, label, id, props, style, flags, children, items }`
  - `ASTEdge { fromId, toId, edgeStyle, label }`
  - `ASTDirective { key, value }`
- [x] `packages/core/src/compiler/parser.ts`:
  - 문서 디렉티브 파싱 (`@page`, `@theme`, `@style`, `@transition`)
  - `scene "name" { ... }` 파싱
  - 레이아웃 프리미티브 블록 파싱 (`flow`, `stack`, `grid`, `tree`, `group`, `layers`, `canvas`)
  - 시각 요소 파싱 (`node`, `box`, `label` 등)
  - `#id` 할당
  - 엣지 선언 파싱 (`#a -> #b "label"`, 체이닝 `#a -> #b -> #c`)
  - 중첩 블록
  - `canvas` 폴백 모드 (좌표 기반)
  - 에러 복구 (line/column 정보 포함)
- [x] 테스트 (`__tests__/compiler/parser.test.ts`): 59 tests
  - 문서 구조: 디렉티브만, 단일 씬, 다중 씬, 씬 없음 (암묵적 단일)
  - flow 블록: 명시적 엣지, 체이닝 (`#a -> #b -> #c`), 라벨
  - stack 블록: row/col, gap/align, 중첩 자식
  - grid 블록: cols 지정
  - tree 블록: 중첩 노드 (부모-자식 관계)
  - group/layers 블록: 라벨과 자식 요소
  - 중첩: flow 안에 group, stack 안에 box + list
  - 인라인 스타일: background, color, border, shadow, radius
  - 에러 복구: 닫히지 않은 블록, 잘못된 속성, 누락 ID 참조, 에러 위치 정확성
  - 스냅샷: 종합 예제의 AST 출력 (`toMatchSnapshot`)

**depends**: T-04
**ref**: `original/src/core/parser.ts` (패턴 참조), `docs/DEPIX_DSL_V2_DRAFT.md` (40-605행)

---

### T-06: 컴파일러 패스 — 테마 해석 [N] ✅

두 번째 컴파일 패스: AST를 순회하며 모든 시맨틱 토큰을 테마 기반 구체 값으로 해석.

- [x] `packages/core/src/compiler/passes/resolve-theme.ts`:
  - `resolveTheme(ast: ASTDocument, theme: DepixTheme): ASTDocument`
  - 색상 속성 해석 (`background`, `color`, `border`)
  - 간격 해석 (`gap`)
  - `font-size` 해석
  - `shadow`, `radius`, `border-width` 해석
  - 테마 `node` 기본값을 스타일 미지정 노드에 적용 (fill→background, stroke→border, cornerRadius→radius)
  - 불변성 보장 (directives 배열 복사)
- [x] 테스트 (`__tests__/compiler/passes/resolve-theme.test.ts`): 49 tests
  - 시맨틱 컬러 → HEX 변환 (AST 내 모든 color 속성)
  - gap 토큰 → 숫자 변환
  - 혼합 (일부 시맨틱 + 일부 리터럴 HEX)
  - 스타일 미지정 노드에 테마 기본값 적용 확인
  - 커스텀 테마 전달 시 해당 테마 값 사용
  - 불변성 테스트 (원본 AST 변경 없음)

**depends**: T-03, T-05

---

### T-07: 레이아웃 알고리즘 — stack [P] ✅

Flexbox 스타일 순차 배치. 기존 Frame 레이아웃 로직 기반.

- [x] `packages/core/src/compiler/layout/stack-layout.ts`:
  - 입력: LayoutChild[], StackLayoutConfig (bounds, direction, gap, align, wrap)
  - 알고리즘: cursor 기반 배치 → computeCrossOffset → bounds 할당
  - `align`: start, center, end, stretch
  - `wrap: true` 다중 행 지원 (layoutSingle / layoutWrapped 분기)
  - 출력: LayoutResult { containerBounds, childBounds[] }
- [x] 테스트 (`__tests__/compiler/layout/stack-layout.test.ts`): 77 tests
  - row/col 방향, gap, align 4종, wrap, 빈/단일 자식, bounds 검증

**depends**: T-06, T-01A
**ref**: `original/src/engine/layout/frame-layout.ts` (전체 — 973행의 검증된 Flexbox 스타일 레이아웃)

---

### T-08: 레이아웃 알고리즘 — grid [N] ✅

CSS Grid 스타일 행/열 배치.

- [x] `packages/core/src/compiler/layout/grid-layout.ts`:
  - 입력: LayoutChild[], GridLayoutConfig (bounds, cols, gap)
  - 알고리즘: effectiveCols = min(cols, children), 균등 열 너비, 행 높이 = max(row children)
  - 출력: LayoutResult { containerBounds, childBounds[] }
- [x] 테스트 (`__tests__/compiler/layout/grid-layout.test.ts`): 62 tests
  - 2/3/4열 배치, 불완전 행, gap, 행 높이 적응, 빈/단일 자식, 경계 검증

**depends**: T-06, T-01A

---

### T-09: 레이아웃 알고리즘 — flow [N] ✅

방향성 그래프 토폴로지 정렬 기반 배치. 가장 복잡한 신규 레이아웃.

- [x] `packages/core/src/compiler/layout/flow-layout.ts`:
  - 입력: LayoutChild[], FlowLayoutConfig (bounds, direction, gap, edges)
  - 알고리즘: Kahn 토폴로지 정렬 → longest-path 레이어 할당 → barycenter 교차 최소화
  - 사이클 처리 (남은 노드 마지막 레이어에 추가)
  - 출력: LayoutResult { containerBounds, childBounds[] }
- [x] 테스트 (`__tests__/compiler/layout/flow-layout.test.ts`): 12 tests
  - 선형/분기/합류/다이아몬드 패턴, direction:right/down, 빈 flow, 경계 검증

**depends**: T-06, T-01A
**ref**: `docs/DEPIX_IR_SPEC.md` (560-570행)

---

### T-10: 레이아웃 알고리즘 — tree [N] ✅

Reingold-Tilford 또는 간소화 변형 트리 레이아웃.

- [x] `packages/core/src/compiler/layout/tree-layout.ts`:
  - 입력: TreeNode[] (id, width, height, children indices), TreeLayoutConfig (bounds, direction, levelGap, siblingGap)
  - 알고리즘: 간소화 Reingold-Tilford (subtree span → level assignment → position)
  - direction: down/right/up/left 지원
  - 출력: LayoutResult { containerBounds, childBounds[] }
- [x] 테스트 (`__tests__/compiler/layout/tree-layout.test.ts`): 17 tests
  - 이진/넓은/깊은/비대칭 트리, direction:down/right, 단일 노드, 경계 검증

**depends**: T-06, T-01A

---

### T-11: 레이아웃 알고리즘 — group, layers [N] ✅

단순 레이아웃 알고리즘들.

- [x] `packages/core/src/compiler/layout/group-layout.ts`:
  - 입력: LayoutChild[], GroupLayoutConfig (bounds, padding)
  - 알고리즘: 수직 스택 + 패딩, 수평 중앙 정렬
  - 출력: LayoutResult
- [x] `packages/core/src/compiler/layout/layers-layout.ts`:
  - 입력: LayoutChild[], LayersLayoutConfig (bounds, gap)
  - 알고리즘: 균등 수직 분할 (bandHeight = (h - totalGap) / n)
  - 출력: LayoutResult
- [x] `packages/core/src/compiler/layout/types.ts` — 공유 타입 (LayoutChild, LayoutResult, 각 config)
- [x] `packages/core/src/compiler/layout/index.ts` — barrel exports
- [x] 테스트: group-layout.test.ts (14 tests) + layers-layout.test.ts (15 tests)
  - group: 바운딩 박스, 패딩, 수직 스택, 빈 자식
  - layers: 균등 분할, gap, 순서, 빈 자식

**depends**: T-06, T-01A

---

### T-12: 엣지 라우팅 엔진 [P] ✅

엣지의 구체적 경로 포인트를 계산.

- [x] `packages/core/src/compiler/routing/edge-router.ts`:
  - `routeEdge(input: RouteEdgeInput): IREdge` — 단일 엣지 라우팅
  - `routeEdges(inputs): IREdge[]` — 다중 엣지 라우팅
  - `getAutoAnchors` — 도형 타입별 경계 포인트 자동 계산
  - `getRectBoundaryPoint`, `getEllipseBoundaryPoint` — 기하 헬퍼
  - `createStraightPath`, `createPolylinePath`, `createBezierPath` — 경로 생성
  - `getBezierMidpoint`, `getPolylineMidpoint` — 라벨 배치
- [x] DSL 엣지 스타일 → IR 매핑:
  - `->` : solid + arrowEnd triangle
  - `-->` : dashed + arrowEnd triangle
  - `--` : solid, 화살표 없음
  - `<->` : solid + arrowStart triangle + arrowEnd triangle
- [x] `packages/core/src/compiler/routing/index.ts` — barrel exports
- [x] 테스트 (`__tests__/compiler/routing/edge-router.test.ts`): 64 tests
  - 앵커 자동 감지, 직선/폴리라인/베지어 경로, 라벨 배치, 엣지 스타일 매핑, 경계 케이스

**depends**: T-02, T-01A
**ref**: `original/src/engine/renderers/connector-utils.ts` (경계 계산, 경로 생성), `original/src/engine/renderers/connector-renderer.ts` (화살표 마커)

---

### T-13: 컴파일러 — IR 출력 및 통합 [N] ✅

최종 컴파일 패스: 해석된 요소, 레이아웃, 엣지를 `DepixIR` JSON으로 조합.

- [x] `packages/core/src/compiler/passes/emit-ir.ts`:
  - `emitIR(ast, theme): DepixIR` — 해석된 AST → 완전한 IR 문서
  - 레이아웃 디스패치 (blockType → layoutStack/Grid/Flow/Tree/Group/Layers)
  - AST 요소 → IR 요소 변환 (node→IRShape, label→IRText, box→IRContainer 등 14종)
  - 엣지 라우팅 통합 (boundsMap 기반)
  - 문서 메타데이터 해석 (`@page` → aspectRatio, `@style` → drawingStyle)
  - 전환 효과 처리 (`@transition` 디렉티브)
  - 레이아웃 출신 컨테이너에 `origin` 메타데이터 설정
- [x] `packages/core/src/compiler/compiler.ts`:
  - `compile(dsl: string, options?: CompileOptions): CompileResult`
  - `CompileResult = { ir: DepixIR, errors: ParseError[] }`
  - 파이프라인: parse → resolveTheme → emitIR
- [x] 테스트: emit-ir.test.ts (63 tests) + compiler.test.ts (15 tests)
  - 메타/씬/전환, 14종 요소 변환, 스타일 매핑, 레이아웃 블록 7종, 엣지 라우팅, 중첩 블록, ID 할당

**depends**: T-04, T-05, T-06, T-07, T-08, T-09, T-10, T-11, T-12

---

### T-14: IR 기반 렌더러 (DepixEngine) [P/M] ✅

DepixEngine을 `DepixIR` 입력으로 전환. 모든 레이아웃 계산이 완료된 상태이므로 렌더러는 극적으로 단순해짐.

- [x] `packages/engine/src/depix-engine.ts`:
  - `load(ir: DepixIR)` — IR 로드, 좌표 변환 갱신, 씬 렌더링
  - Stage/Layer 관리 (backgroundLayer + contentLayer)
  - `nextScene()`, `prevScene()`, `setScene(index)` — 씬 네비게이션
  - `resize(width, height)` — 반응형 리사이즈
  - `destroy()` — 리소스 정리
- [x] `packages/engine/src/ir-renderer.ts`:
  - `renderElement(element, transform)` — type 기반 디스패치
  - `renderElements(elements, transform)` — Konva.Group으로 묶어 반환
  - shape: rect/circle/ellipse/diamond/pill/hexagon/triangle/parallelogram 8종
  - text, image (placeholder), line, path, edge (straight/polyline/bezier + arrows + labels), container
  - 스타일: fill/stroke/shadow/dash, gradient stops, corner radius, font style
- [x] `packages/engine/src/coordinate-transform.ts`:
  - `CoordinateTransform` — 0-100 상대좌표 → 절대 픽셀 변환
  - aspect ratio 보정 (letterbox/pillarbox)
  - `toAbsolutePoint`, `toAbsoluteBounds`, `toRelativePoint`, `getScale`
- [x] `packages/engine/__tests__/setup.ts` — canvas 패키지 기반 Konva 테스트 환경
- [x] 테스트: coordinate-transform.test.ts (12 tests) + ir-renderer.test.ts (40 tests)
  - 좌표 변환 (16:9, 4:3, 1:1), shape 8종, text, edge 3종, container, 스타일

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

### T-15: E2E 파이프라인 테스트 [N] ✅

DSL → IR → Render 전체 파이프라인을 예제 다이어그램으로 검증.

- [x] `packages/engine/__tests__/e2e-pipeline.test.ts`: 25 tests
  - DSL → compile → IR → renderElements → Konva 노드 검증
  - 단일 노드, stack/grid/flow 레이아웃, 중첩 블록
  - 엣지 라우팅 (->/--> /--/<->), 라벨
  - 테마 통합 (semantic color 해석, light/dark 전환)
  - 디렉티브 (@page, @style, @transition)
  - 다중 씬 + 전환
  - 좌표 변환 통합 (aspect ratio 대응)
  - IR 구조 유효성 (bounds, edge path, meta)

**depends**: T-13, T-14

---

## Phase 2: 에디터 ✅ COMPLETED

### T-16: SelectionManager 포팅 [P/M] ✅

IR 요소 기반 선택 관리 시스템.

- [x] `packages/editor/src/selection-manager.ts`:
  - `DepixObject` → `IRElement`로 타입 변경 (순수 상태 관리, Konva 의존 없음)
  - select, selectMultiple, deselect, clearSelection, toggleSelection, isSelected, getSelectedIds
  - 호버: setHovered, getHoveredId
  - 이벤트: onChange, onDragEnd, onTransformEnd (언서브스크라이브 지원)
  - IR 요소 조회: getSelectedElements(ir) — findElement 사용
  - getPrimarySelection, getSelectionCount, getState, destroy
- [x] 테스트: 45 tests (단일/다중 선택, 호버, 이벤트, 요소 조회, 라이프사이클, 엣지 케이스)

**depends**: T-14

---

### T-17: HistoryManager 포팅 [P] ✅

Undo/Redo 시스템. 타입 무관 순수 로직.

- [x] `packages/editor/src/history-manager.ts`:
  - 클로저 기반 액션 (HistoryAction: execute/undo/mergeKey)
  - push, undo, redo, canUndo, canRedo, getState, clear, destroy
  - 액션 머지: 동일 mergeKey + mergeTimeout(300ms) 내 → 기존 undo 보존 + 새 execute 교체
  - maxHistory(100) 적용, 초과 시 oldest 제거
  - `createPropertyAction`, `createAddAction`, `createDeleteAction` 헬퍼
  - onChange 리스너 (언서브스크라이브)
- [x] 테스트: 45 tests (undo/redo, 스택 관리, 머지, 리스너, 헬퍼, 통합, 엣지 케이스)

**depends**: T-01
**ref**: `original/src/editor/history-manager.ts`

---

### T-18: HandleManager 포팅 [P/M] ✅

IR 요소용 핸들 시스템 (리사이즈, 회전, 엔드포인트). 순수 로직, Konva 의존 없음.

- [x] `packages/editor/src/handles/types.ts` — HandleType, AnchorName, HandleDefinition, ALL_ANCHORS, CORNER_ANCHORS
- [x] `packages/editor/src/handles/handle-strategies.ts` — 순수 함수 getHandleDefinition(element):
  - `IRShape`: shape 서브타입별 (circle=keepRatio+CORNER, 나머지=ALL+rotate)
  - `IRText`: bounding-box, ALL_ANCHORS, no rotation
  - `IRImage`: bounding-box, keepRatio, CORNER_ANCHORS
  - `IRLine`: endpoint 핸들
  - `IRPath`: bounding-box, keepRatio, CORNER_ANCHORS, rotate
  - `IREdge`: connector 핸들
  - `IRContainer`: bounding-box, ALL_ANCHORS, no rotation
  - `isKeepRatioShape()` 헬퍼
- [x] `packages/editor/src/handles/handle-manager.ts`:
  - updateForElements, getActiveHandleType, getDefinition, hideHandles, onHandleChange, destroy
  - 다중 선택 → merged definition (bounding-box, no rotation, ALL_ANCHORS)
- [x] `packages/editor/src/handles/index.ts` — barrel exports
- [x] 간소화: auto-layout 자식 감지 제거 (IR은 bounds 해석 완료)
- [x] 테스트: handle-strategies.test.ts (28) + handle-manager.test.ts (28) = 56 tests

**depends**: T-14, T-16

---

### T-19: 스냅 가이드 시스템 포팅 [P] ✅

정렬/스냅 가이드 시스템. IRBounds(0-100) 기반, 렌더러 콜백 패턴.

- [x] `packages/editor/src/guides/types.ts` — SnapPoint, GuideLine, SnapResult, SnapGuideConfig, DEFAULT_SNAP_CONFIG
- [x] `packages/editor/src/guides/snap-calculator.ts`:
  - extractSnapPoints: 요소 bounds → 6개 스냅 포인트 (left/center-x/right/top/center-y/bottom)
  - calculateSnap: 드래그 요소 vs 다른 요소들 + 캔버스 엣지(0,50,100) 스냅, 가이드라인 생성
- [x] `packages/editor/src/guides/snap-guide-manager.ts`:
  - onDragStart (캐시), onDragMove (스냅 계산), onDragEnd (클리어)
  - setGuideRenderer 콜백 (Konva 분리), setEnabled, updateConfig
- [x] `packages/editor/src/guides/index.ts` — barrel exports
- [x] 테스트: snap-calculator.test.ts (33) + snap-guide-manager.test.ts (16) = 49 tests

**depends**: T-14

---

### T-20: IR 직접 조작 API [N] ✅

에디터가 IR을 직접 변경하는 연산 레이어. 불변 패턴 (structuredClone).

- [x] `packages/editor/src/ir-operations.ts`:
  - `moveElement(ir, elementId, dx, dy)` — bounds 변경, 컨테이너 자식 재귀 이동
  - `resizeElement(ir, elementId, newBounds)` — bounds 변경, 최소 1x1 적용
  - `addElement(ir, sceneId, element, targetId?)` — 씬 또는 컨테이너에 추가
  - `removeElement(ir, elementId)` — 트리에서 제거 + 연결 엣지 정리 (중첩 자식 ID 수집)
  - `updateStyle(ir, elementId, style)` — Partial<IRStyle> 머지
  - `updateText(ir, elementId, content)` — IRText.content 또는 IRShape.innerText.content
  - `reorderElements(ir, sceneId, elementIds)` — z-order 재정렬
- [x] `packages/editor/src/ir-edge-operations.ts`:
  - `recalculateEdge(ir, edgeId)` — routeEdge()로 경로 재계산, 기존 스타일/ID 보존
  - `recalculateConnectedEdges(ir, elementId)` — 연결된 모든 엣지 재라우팅
- [x] 테스트: 49 tests (7개 연산 + 엣지 재계산 + 통합, 불변성 검증 포함)

**depends**: T-02, T-12, T-01A

---

### T-21: 시맨틱 구조 활용 [N] ✅

`IROrigin` 메타데이터를 활용한 스마트 편집. 레이아웃 자동 재실행.

- [x] `packages/editor/src/semantic-editor.ts`:
  - `isSemanticContainer(element)` — container + origin 존재 확인
  - `getSemanticType(element)` — origin.sourceType 반환 또는 null
  - `addNodeToFlow(ir, containerId, newNode, edges?)` — flow에 노드 + 엣지 추가 후 재레이아웃
  - `reorderStackChild(ir, containerId, fromIndex, toIndex)` — stack 자식 순서 변경 후 재레이아웃
  - `addGridCell(ir, containerId, newCell)` — grid에 셀 추가 후 재레이아웃
  - `relayoutContainer(ir, containerId)` — origin.sourceType 기반 디스패치 (stack/grid/flow/group/layers)
  - 기본 sourceProps: stack(col,2,start,false), grid(2,2), flow(right,5), group(2), layers(1)
  - 엣지 자식은 레이아웃에서 제외 (bounds 보존)
- [x] 테스트: 44 tests (쿼리, 스마트 편집, relayout 6종, 엣지 케이스)

**depends**: T-20, T-07, T-08, T-09, T-10

---

### T-22: 시맨틱 해체 (Detach) [N] ✅

시맨틱 레이아웃 제약에서 벗어나 자유 편집으로 전환. Figma의 "Remove Auto Layout"과 동일.

- [x] `packages/editor/src/detach.ts`:
  - `detachFromLayout(ir, containerId)` — 컨테이너와 모든 중첩 자식에서 origin 제거 (delete)
  - `detachAll(ir)` — IR 전체의 모든 origin 제거 (flatten/export용)
  - no-op 최적화: 미발견/origin 없음 → 동일 참조 반환 (변경 감지 가능)
  - 자식 bounds 불변 (현재 절대 위치 유지)
- [x] 테스트: 27 tests (기본, 중첩, 불변성, no-op, 위치 보존, detachAll, 엣지 케이스)

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
