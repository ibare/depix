# Depix v2 테스트 전략

## 원칙

1. **컴파일러 패스는 모두 순수 함수다.** 입력 → 출력이 결정적이므로, 단위 테스트로 완전한 커버리지가 가능하다.
2. **테스트 픽스처를 공유 자산으로 관리한다.** DSL 예제, AST 스냅샷, IR 스냅샷을 한곳에 모아 여러 테스트에서 재사용한다.
3. **각 레이어 경계에서 계약 테스트를 작성한다.** DSL→AST, AST→ResolvedAST, ResolvedAST→IR, IR→Konva 각 변환의 입출력을 검증한다.
4. **렌더러는 구조 테스트로 검증한다.** 픽셀 비교 대신, 생성되는 Konva 노드 트리의 구조와 속성을 검증한다.
5. **에지 케이스와 에러 케이스를 일급 시민으로 다룬다.** 정상 경로만이 아니라, 잘못된 입력에 대한 에러 메시지 품질도 테스트한다.

---

## 테스트 인프라

### 도구

| 도구 | 용도 |
|------|------|
| **Vitest** | 테스트 러너, assertion, 모킹, 커버리지 |
| **@vitest/coverage-v8** | 코드 커버리지 (V8 네이티브) |
| **happy-dom** | packages/engine, editor, react의 DOM 환경 |
| **@testing-library/react** | React 컴포넌트 테스트 (Phase 3) |

### 프로젝트 구조

```
packages/
├── core/
│   ├── src/
│   └── __tests__/
│       ├── ir/                    # IR 타입 검증, 유틸리티
│       ├── theme/                 # 테마 해석
│       ├── compiler/
│       │   ├── tokenizer.test.ts
│       │   ├── parser.test.ts
│       │   ├── passes/
│       │   │   └── resolve-theme.test.ts
│       │   ├── layout/
│       │   │   ├── stack-layout.test.ts
│       │   │   ├── grid-layout.test.ts
│       │   │   ├── flow-layout.test.ts
│       │   │   ├── tree-layout.test.ts
│       │   │   └── group-layers-layout.test.ts
│       │   ├── routing/
│       │   │   └── edge-router.test.ts
│       │   └── compiler.integration.test.ts
│       └── fixtures/              # 공유 테스트 데이터
│           ├── dsl/               # DSL v2 텍스트 파일
│           ├── ast/               # 기대 AST JSON
│           └── ir/                # 기대 IR JSON
│
├── engine/
│   ├── src/
│   └── __tests__/
│       ├── renderers/             # 각 렌더러 단위 테스트
│       ├── depix-engine.test.ts
│       └── helpers/
│           └── konva-mock.ts      # Konva 헬퍼/모킹
│
├── editor/
│   ├── src/
│   └── __tests__/
│       ├── ir-operations.test.ts
│       ├── semantic-editor.test.ts
│       ├── detach.test.ts
│       ├── selection-manager.test.ts
│       ├── history-manager.test.ts
│       └── guides/
│
└── react/
    ├── src/
    └── __tests__/
        ├── DepixCanvas.test.tsx
        └── DepixCanvasEditable.test.tsx
```

### 공유 테스트 픽스처

`packages/core/__tests__/fixtures/`에 중앙 관리하며, 다른 패키지에서도 참조.

```
fixtures/
├── dsl/
│   ├── flow-basic.depix           # 기본 flow
│   ├── flow-branching.depix       # 분기/합류 flow
│   ├── stack-row.depix            # 수평 stack
│   ├── stack-col.depix            # 수직 stack
│   ├── grid-basic.depix           # 기본 grid
│   ├── tree-basic.depix           # 기본 tree
│   ├── group-nested.depix         # 중첩 group
│   ├── layers-arch.depix          # 아키텍처 layers
│   ├── canvas-fallback.depix      # 좌표 기반 폴백
│   ├── multi-scene.depix          # 멀티 씬
│   ├── photosynthesis.depix       # 종합 예제 (광합성)
│   ├── react-lifecycle.depix      # 종합 예제 (React)
│   ├── git-branches.depix         # 종합 예제 (Git)
│   ├── comparison-grid.depix      # 종합 예제 (비교표)
│   ├── error-missing-ref.depix    # 에러: 존재하지 않는 #id 참조
│   ├── error-unclosed-brace.depix # 에러: 닫히지 않은 중괄호
│   └── error-invalid-prop.depix   # 에러: 잘못된 속성
│
├── ast/
│   ├── flow-basic.json            # flow-basic.depix의 기대 AST
│   ├── stack-row.json
│   └── ...
│
└── ir/
    ├── flow-basic.json            # flow-basic.depix의 기대 IR
    ├── stack-row.json
    └── ...
```

### 테스트 헬퍼 & 팩토리

```typescript
// packages/core/__tests__/helpers/ir-builders.ts

/** IR 요소를 간결하게 생성하는 빌더 */
export function shape(overrides?: Partial<IRShape>): IRShape;
export function text(content: string, overrides?: Partial<IRText>): IRText;
export function container(children: IRElement[], overrides?: Partial<IRContainer>): IRContainer;
export function edge(fromId: string, toId: string, overrides?: Partial<IREdge>): IREdge;
export function scene(elements: IRElement[], overrides?: Partial<IRScene>): IRScene;
export function ir(scenes: IRScene[], overrides?: Partial<DepixIR>): DepixIR;

// packages/core/__tests__/helpers/ast-builders.ts

/** AST 노드를 간결하게 생성하는 빌더 */
export function flowBlock(nodes: ASTElement[], edges?: ASTEdge[]): ASTBlock;
export function stackBlock(children: ASTElement[]): ASTBlock;
export function nodeElement(label: string, id?: string): ASTElement;
```

### 커스텀 매처

```typescript
// packages/core/__tests__/helpers/matchers.ts

/** IR 구조 비교 매처 (ID, 소수점 무시) */
expect.extend({
  /** bounds가 허용 오차 내에서 일치하는지 */
  toHaveBoundsCloseTo(received: IRBounds, expected: IRBounds, precision?: number),
  /** IR 요소 트리 구조가 일치하는지 (ID 무시, bounds 근사 비교) */
  toMatchIRStructure(received: IRElement, expected: Partial<IRElement>),
  /** 컴파일 에러가 특정 위치와 메시지를 포함하는지 */
  toContainCompileError(received: CompileResult, errorPattern: { line?: number, message: RegExp }),
});
```

---

## 패키지별 테스트 전략

### packages/core (순수 TypeScript)

브라우저 의존성이 없어 가장 테스트하기 쉬운 패키지.
모든 함수가 순수 함수이므로 입력→출력 검증으로 충분.

#### IR 타입 & 검증 (`ir/`)

| 대상 | 테스트 방법 | 핵심 케이스 |
|------|-----------|------------|
| `validateIR(ir)` | 단위 | 유효한 IR, bounds 누락, 색상이 HEX 아닌 경우, 음수 크기 |
| `findElement(ir, id)` | 단위 | 최상위, 중첩 컨테이너 내부, 존재하지 않는 ID |
| `walkElements(ir, visitor)` | 단위 | 빈 씬, 깊은 중첩, 콜백 호출 순서 |
| `generateId()` | 단위 | 고유성 (1000개 생성 시 중복 없음) |

#### 테마 (`theme/`)

| 대상 | 테스트 방법 | 핵심 케이스 |
|------|-----------|------------|
| `resolveColor` | 단위 | 시맨틱 컬러 8종 각각, HEX 패스스루, 이름 컬러 (blue, red 등), 잘못된 값 |
| `resolveSpacing` | 단위 | xs~xl 5단계, 숫자 패스스루 |
| `resolveFontSize` | 단위 | xs~3xl 7단계 |
| `resolveShadow` | 단위 | none/sm/md/lg, 결과 객체 구조 |
| `resolveRadius` | 단위 | none/sm/md/lg/full |
| 테마 커스터마이징 | 단위 | lightTheme/darkTheme 기본값 확인, 커스텀 테마 |

#### 토크나이저 (`compiler/tokenizer`)

| 대상 | 테스트 방법 | 핵심 케이스 |
|------|-----------|------------|
| 디렉티브 | 단위 | `@page 16:9`, `@style sketch`, `@transition fade` |
| 블록 타입 | 단위 | flow, stack, grid, tree, group, layers, canvas |
| 요소 타입 | 단위 | node, box, label, list, badge, icon, divider, image, cell, layer |
| 문자열 | 단위 | 일반 문자열, 이스케이프, 유니코드, 빈 문자열, 줄바꿈 포함 |
| ID | 단위 | `#simple`, `#with-dash`, `#123` |
| 화살표 | 단위 | `->`, `-->`, `--`, `<->` |
| 속성 | 단위 | `direction:right`, `gap:md`, `cols:3`, `background:#fff` |
| 플래그 | 단위 | `bold`, `italic`, `header`, `outline` |
| 리스트 구문 | 단위 | `["a", "b"]`, `["a"]`, `[]` |
| 주석 | 단위 | `// 주석`, 줄 끝 주석 |
| 에러 | 단위 | 닫히지 않은 문자열, 잘못된 토큰, 위치 정보 정확성 |

#### 파서 (`compiler/parser`)

| 대상 | 테스트 방법 | 핵심 케이스 |
|------|-----------|------------|
| 문서 구조 | 단위 | 디렉티브만, 단일 씬, 다중 씬, 씬 없음 (암묵적 단일) |
| flow 블록 | 단위 | 자동 연결, 명시적 엣지, 체이닝 (`#a -> #b -> #c`), 라벨 |
| stack 블록 | 단위 | row/col, gap/align, 중첩 자식 |
| grid 블록 | 단위 | cols 지정, header 플래그 |
| tree 블록 | 단위 | 중첩 노드 (부모-자식 관계) |
| group 블록 | 단위 | 라벨과 자식 요소 |
| layers 블록 | 단위 | layer 요소들 |
| canvas 폴백 | 단위 | 좌표 기반 rect, circle, line |
| 중첩 | 단위 | flow 안에 group, stack 안에 box + list |
| 인라인 스타일 | 단위 | background, color, border, shadow, radius |
| 에러 복구 | 단위 | 닫히지 않은 블록, 잘못된 속성, 누락 ID 참조, 에러 위치 정확성 |
| 스냅샷 | 스냅샷 | 6개 종합 예제의 AST 출력 |

#### 컴파일러 패스 (`compiler/passes/`)

| 대상 | 테스트 방법 | 핵심 케이스 |
|------|-----------|------------|
| resolve-theme | 단위 | 시맨틱 컬러 → HEX, gap → 숫자, 혼합 (일부 시맨틱 + 일부 리터럴) |
| resolve-theme | 단위 | 기본 테마 적용 (스타일 미지정 노드), 커스텀 테마 |

#### 레이아웃 알고리즘 (`compiler/layout/`)

레이아웃은 **결과의 올바름**을 검증하는 것이 핵심. 직접 좌표를 비교하기보다 **불변식(invariant)을 검증**하는 방식을 병행.

**stack 레이아웃:**

| 테스트 | 검증 방식 |
|--------|----------|
| row 3개 자식, 균등 | 자식이 겹치지 않음, 순서대로 왼→오 배치, gap 일정 |
| col 3개 자식, 균등 | 자식이 겹치지 않음, 순서대로 위→아래, gap 일정 |
| align:center | 교차축 중앙 정렬 (모든 자식의 중심점 동일) |
| align:stretch | 교차축 크기가 컨테이너와 동일 |
| wrap:true | 넘치는 자식이 다음 줄로 |
| 빈 자식 | 빈 컨테이너, 크래시 없음 |
| 단일 자식 | 정상 동작 |

**grid 레이아웃:**

| 테스트 | 검증 방식 |
|--------|----------|
| cols:3, 6개 셀 | 2행 3열 배치, 행/열 정렬 |
| cols:2, 3개 셀 | 마지막 행 불완전 |
| header 행 | 첫 행에 header 스타일 |
| gap 적용 | 셀 간 간격 균일 |

**flow 레이아웃:**

| 테스트 | 검증 방식 |
|--------|----------|
| 선형 (A→B→C) | 노드가 direction 방향으로 순차 배치 |
| 분기 (A→B, A→C) | B와 C가 같은 레이어, 겹치지 않음 |
| 합류 (B→D, C→D) | D가 B,C보다 뒤 레이어 |
| 다이아몬드 (A→B,C / B,C→D) | 레이어 할당 정확, 노드 비겹침 |
| direction:down | 세로 방향 배치 |
| 자동 연결 (엣지 없음) | 선언 순서대로 연결 |
| 고립 노드 | 연결 안 된 노드도 배치 |

**tree 레이아웃:**

| 테스트 | 검증 방식 |
|--------|----------|
| 이진 트리 | 부모가 자식 위, 자식이 대칭 |
| 넓은 트리 (자식 5개) | 자식 겹치지 않음 |
| 깊은 트리 (5레벨) | 레벨별 y좌표 일정 |
| 단일 노드 | 정상 동작 |
| direction:right | 가로 방향 트리 |

**group/layers 레이아웃:**

| 테스트 | 검증 방식 |
|--------|----------|
| group | 바운딩 박스가 모든 자식을 포함 |
| layers 3개 | 균등 높이 분할, 겹치지 않음, 위→아래 순서 |

**불변식 검증 헬퍼:**

```typescript
// packages/core/__tests__/helpers/layout-assertions.ts

/** 모든 자식이 컨테이너 bounds 안에 있는지 */
export function assertChildrenWithinParent(parent: IRBounds, children: IRBounds[]): void;
/** 자식끼리 겹치지 않는지 */
export function assertNoOverlap(children: IRBounds[]): void;
/** 특정 방향으로 순서대로 배치되었는지 */
export function assertOrderedInDirection(children: IRBounds[], direction: 'right' | 'down'): void;
/** gap이 균일한지 (허용 오차 내) */
export function assertUniformGap(children: IRBounds[], direction: 'row' | 'col', expectedGap: number): void;
/** 교차축 정렬이 올바른지 */
export function assertCrossAlignment(children: IRBounds[], parentBounds: IRBounds, align: string): void;
```

#### 엣지 라우팅 (`compiler/routing/`)

| 테스트 | 검증 방식 |
|--------|----------|
| 직선 연결 | from/to 앵커가 도형 경계 위에 있음 |
| 꺾임 연결 | 모든 세그먼트가 수직 또는 수평 |
| 장애물 회피 | 경로가 다른 노드를 관통하지 않음 |
| 라벨 배치 | 라벨이 경로 위/근처에 위치 |
| 앵커 자동 감지 | 상대 위치에 따라 가장 가까운 면 선택 |

#### 컴파일러 통합 (`compiler.integration.test.ts`)

DSL 텍스트 → `compile()` → DepixIR 전체 파이프라인을 종합 예제로 검증.

| 테스트 | 방식 |
|--------|------|
| 6개 종합 예제 | 스냅샷 테스트 (IR JSON 스냅샷) |
| 테마 전환 | 동일 DSL + light/dark → 색상 차이 확인 |
| 에러 케이스 | 잘못된 DSL → 에러 메시지에 line/column 포함 확인 |
| 왕복 안정성 | compile → IR → 변경 없이 재검증 → 동일 결과 |

---

### packages/engine (Konva 의존)

Konva는 canvas API를 필요로 하므로 별도 전략이 필요.

#### 환경 설정

```typescript
// vitest.config.ts (packages/engine)
export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./test-setup.ts'],
  },
});

// test-setup.ts
// Konva의 canvas 의존성 처리
import Konva from 'konva';
// happy-dom 환경에서 Konva가 동작하도록 설정
```

#### 렌더러 테스트 전략

**픽셀 비교가 아닌 노드 트리 구조 검증:**

```typescript
// IR Shape (rect) → renderShape() → Konva.Rect 노드 생성 확인
it('renders IRShape rect correctly', () => {
  const irShape = shape({ shape: 'rect', bounds: { x: 10, y: 10, w: 30, h: 20 } });
  const node = renderShape(irShape, mockEngine);

  expect(node).toBeInstanceOf(Konva.Rect);
  expect(node.width()).toBeCloseTo(expectedAbsWidth);
  expect(node.height()).toBeCloseTo(expectedAbsHeight);
  expect(node.fill()).toBe('#3b82f6');
});
```

| 대상 | 테스트 방법 | 핵심 케이스 |
|------|-----------|------------|
| shape 렌더러 | 단위 (노드 구조) | rect/circle/ellipse/diamond/pill/hexagon 각각, 스타일 적용, innerText |
| text 렌더러 | 단위 (노드 구조) | 기본, bold, italic, align, fontSize |
| image 렌더러 | 단위 (노드 구조) | fit 옵션, cornerRadius |
| line 렌더러 | 단위 (노드 구조) | 화살표 유무, 대시 패턴 |
| edge 렌더러 | 단위 (노드 구조) | straight/polyline/bezier, 화살표, 라벨 |
| container 렌더러 | 단위 (노드 구조) | 자식 재귀, 클리핑 |
| 스타일 어댑터 | 단위 | default vs sketch (RoughJS) |
| 좌표 변환 | 단위 | toAbsolute/toRelative, 다양한 비율 |
| 배경 렌더링 | 단위 | 단색, 그라데이션 |

#### 엔진 통합 테스트

```typescript
it('loads IR and creates correct Konva tree', () => {
  const engine = DepixEngine.create({ container: div });
  engine.load(testIR);
  // Stage → Layer → 예상 노드 수 확인
  expect(engine.getStage().find('Rect').length).toBe(3);
});
```

---

### packages/editor

#### 순수 로직 (DOM 무관)

| 대상 | 테스트 방법 | 핵심 케이스 |
|------|-----------|------------|
| `moveElement` | 단위 | 일반 이동, 컨테이너 내 이동, bounds 업데이트 확인 |
| `resizeElement` | 단위 | 최소 크기 제약, bounds 업데이트 |
| `addElement` / `removeElement` | 단위 | 추가 후 조회, 삭제 후 연결 엣지 정리 |
| `updateStyle` | 단위 | 부분 머지, 기존 스타일 유지 |
| `reorderElements` | 단위 | z-order 변경 |
| `recalculateEdge` | 단위 | 요소 이동 후 엣지 경로 업데이트 |
| `detachFromLayout` | 단위 | origin 제거, 위치 보존 |
| `addNodeToFlow` | 단위 | 노드 추가 후 재배치 트리거 |
| HistoryManager | 단위 | undo/redo 스택, 액션 머지, 최대 크기 |

#### Konva 의존 로직

| 대상 | 테스트 방법 | 핵심 케이스 |
|------|-----------|------------|
| SelectionManager | 통합 (happy-dom) | 클릭 선택, 다중 선택, 선택 해제 |
| HandleManager | 통합 (happy-dom) | 핸들 표시, 드래그 리사이즈 |
| SnapGuideManager | 단위 (로직만) | 스냅 계산, 가이드라인 생성 |

---

### packages/react

Phase 3에서 구현하며, 기본적인 렌더링 확인 수준.

| 대상 | 테스트 방법 | 핵심 케이스 |
|------|-----------|------------|
| DepixCanvas | @testing-library/react | 마운트, DSL 전달 시 렌더링, 씬 전환 API |
| DepixCanvasEditable | @testing-library/react | 마운트, 편집 모드 토글 |
| FloatingToolbar | @testing-library/react | 도구 선택 콜백 |
| FloatingPropertyPanel | @testing-library/react | 속성 변경 콜백 |

---

## 커버리지 목표

| 패키지 | 라인 커버리지 | 브랜치 커버리지 | 비고 |
|--------|-------------|---------------|------|
| `@depix/core` | **90%+** | **85%+** | 순수 로직, 높은 커버리지 가능 |
| `@depix/engine` | **70%+** | **60%+** | Konva 의존으로 일부 제약 |
| `@depix/editor` | **80%+** | **70%+** | 순수 로직 높음, DOM 의존 일부 |
| `@depix/react` | **60%+** | **50%+** | UI 컴포넌트, 구조 테스트 위주 |

---

## CI 연동

```yaml
# .github/workflows/test.yml
test:
  - pnpm --filter @depix/core test       # 항상 실행 (빠름)
  - pnpm --filter @depix/engine test     # 항상 실행
  - pnpm --filter @depix/editor test     # 항상 실행
  - pnpm --filter @depix/react test      # 항상 실행
  - pnpm run test:coverage               # PR 시 커버리지 리포트
```

### PR 체크 기준

- 모든 테스트 통과
- 커버리지가 기존 대비 감소하지 않음 (ratchet 방식)
- 새 기능에는 반드시 테스트 포함

---

## 테스트 작성 가이드라인

### 네이밍 컨벤션

```typescript
describe('StackLayout', () => {
  describe('row direction', () => {
    it('places children left to right with equal spacing', () => { ... });
    it('centers children on cross axis when align is center', () => { ... });
    it('wraps to next row when wrap is true and children overflow', () => { ... });
  });

  describe('edge cases', () => {
    it('handles empty children array without error', () => { ... });
    it('handles single child correctly', () => { ... });
  });

  describe('error cases', () => {
    it('throws when gap is negative', () => { ... });
  });
});
```

### 패턴: Given-When-Then

```typescript
it('resolves semantic color to HEX using theme', () => {
  // Given
  const theme = lightTheme;
  const input = 'primary';

  // When
  const result = resolveColor(input, theme);

  // Then
  expect(result).toBe('#3b82f6');
});
```

### 패턴: 파라미터화 테스트

```typescript
it.each([
  ['primary', '#3b82f6'],
  ['danger', '#ef4444'],
  ['success', '#10b981'],
  ['#ff0000', '#ff0000'],  // HEX passthrough
])('resolves "%s" to "%s"', (input, expected) => {
  expect(resolveColor(input, lightTheme)).toBe(expected);
});
```

### 패턴: 스냅샷 테스트 (컴파일러 출력)

```typescript
it('compiles photosynthesis example to expected IR', () => {
  const dsl = readFixture('dsl/photosynthesis.depix');
  const result = compile(dsl);

  expect(result.success).toBe(true);
  expect(result.ir).toMatchSnapshot();
});
```

스냅샷 업데이트는 의도적 변경 시에만 허용 (`--update`). PR 리뷰에서 스냅샷 diff 확인 필수.
