# AUDIT 결과

---

## AUDIT-v3 (2026-03-26) — 전수 감사

**감사 기준**: principles (P1-P6), C1~C5, S-compiler, S-renderer, S-ir-ops, S-zustand, S-dsl-mutations
**감사 방법**: 3 배치 병렬 실행 (Principles / Concerns / Specifics), grep 기반 전수 검색

### 요약

| 항목 | 수치 |
|------|------|
| 총 위반 | 40건 |
| Critical | 0 |
| High | 4 |
| Medium | 6 |
| Low | 30 |
| Principles 준수율 | **100%** (P1~P6 전항목 PASS) |
| Zustand 규칙 준수율 | **100%** (S-zustand 전항목 PASS) |

---

### High Severity (4건)

| # | Rule | File | Description |
|---|------|------|-------------|
| 1 | C1 | `core/compiler/scene/emit-scene.ts` (1,466줄) | 300줄 제한 5배 초과 |
| 2 | C1 | `core/compiler/passes/emit-ir.ts` (1,060줄) | 300줄 제한 3.5배 초과 |
| 3 | S-ir-ops | `editor/ir-edge-operations.ts:95-117` | `recalculateEdge`가 기존 엣지 style을 보존하지 않음. `routeEdge()`가 hardcoded `stroke: '#333333'`으로 fresh style 생성 |
| 4 | S-dsl-mutations | `editor/dsl-mutations.ts:654,662` | DSL 프래그먼트에서 라벨 추출 시 regex `content.match(/"([^"]*)"/)` 사용. parse()를 통해야 함 |

### Medium Severity (6건)

| # | Rule | File | Description |
|---|------|------|-------------|
| 5 | C1 | `react/DepixCanvasEditable.tsx` (980줄) | 300줄 제한 3.3배 초과 |
| 6 | C5 | `react/hooks/useCanvasClickHandler.ts:78` | `: any` 타입 사용 |
| 7 | C5 | `react/hooks/useKonvaTransformer.ts:80` | `: any[]` 타입 사용 |
| 8 | C2 | `react/tiptap/depix-block-serializer.ts:135` | 빈 catch 블록 (사유 주석 없음) |
| 9 | C2 | `react/DepixDSLEditor.tsx:109` | 빈 catch 블록 (사유 주석 없음) |
| 10 | C2 | `react/hooks/useDSLSync.ts:55` | 빈 catch 블록 (사유 주석 없음) |

### Low Severity (30건)

**C1 파일 크기 (300줄 초과) — 21건**

| # | Lines | File |
|---|------:|------|
| 11 | 936 | `core/compiler/passes/allocate-bounds.ts` |
| 12 | 919 | `core/ir/validators.ts` |
| 13 | 905 | `core/compiler/parser.ts` |
| 14 | 712 | `editor/dsl-mutations.ts` |
| 15 | 661 | `core/ir/types.ts` |
| 16 | 658 | `core/compiler/routing/edge-router.ts` |
| 17 | 597 | `core/compiler/tokenizer.ts` |
| 18 | 556 | `react/components/editor/InspectorPanel.tsx` |
| 19 | 486 | `core/compiler/passes/compute-constraints.ts` |
| 20 | 459 | `core/compiler/layout/chart-layout.ts` |
| 21 | 411 | `engine/depix-engine.ts` |
| 22 | 410 | `core/compiler/passes/allocate-budgets.ts` |
| 23 | 401 | `core/compiler/passes/measure.ts` |
| 24 | 373 | `editor/selection-manager.ts` |
| 25 | 350 | `core/compiler/layout/scene-layout.ts` |
| 26 | 337 | `core/compiler/layout/flow-layout.ts` |
| 27 | 331 | `editor/semantic-editor.ts` |
| 28 | 319 | `react/DepixDSLEditor.tsx` |
| 29 | 313 | `core/compiler/serializer.ts` |
| 30 | 314 | `core/compiler/resolve-theme.ts` |
| 31 | 301 | `core/compiler/flatten-hierarchy.ts` |

**C5 `as any` 캐스트 — 7건**

| # | File:Line | Reason |
|---|-----------|--------|
| 32 | `react/hooks/useKonvaTransformer.ts:67` | Konva 격리 (C4 준수용) |
| 33 | `react/hooks/useKonvaTransformer.ts:70` | Konva 격리 |
| 34 | `react/hooks/useKonvaTransformer.ts:75` | Konva 격리 |
| 35 | `react/hooks/useKonvaTransformer.ts:88` | Konva 격리 |
| 36 | `react/hooks/useKonvaTransformer.ts:117` | Konva 격리 |
| 37 | `react/hooks/useCanvasClickHandler.ts:75` | Konva 격리 |
| 38 | `react/store/create-editor-store.ts:28` | `(window as any).__DEV__` devtools 환경 체크 |

**S-compiler magic constants — 1건**

| # | File | Description |
|---|------|-------------|
| 39 | `core/compiler/passes/emit-ir.ts` 다수 라인 | 매직 상수 (`0.8`, `1.25`, `0.25`, `0.2`, `0.15`, `0.7` 등) 사유 주석 없음 |

**C1 .tsx 네이밍 — 2건**

| # | File | Description |
|---|------|-------------|
| 40 | `react/components/editor/context-aware-picker/pill-components.tsx` | React 컴포넌트 export하지만 kebab-case 사용 |
| — | `react/store/editor-store-context.tsx` | Provider export하지만 kebab-case (borderline) |

---

### 전항목 PASS

#### Principles (P1-P6)

| 원칙 | 검증 방법 | 결과 |
|------|----------|------|
| P1 레이어 의존성 방향 | 6방향 역방향 import grep | 0건 — **PASS** |
| P2 IR 불변성 | ir-operations/edge-operations/semantic-editor/detach에서 structuredClone 확인 | 모든 뮤테이션 함수가 clone 후 조작 — **PASS** |
| P3 컴파일러 패스 순수성 | 모듈 레벨 `let`/`var` grep | 0건, const Set만 존재 — **PASS** |
| P4 IR 완전 해결 | IR 타입 파일에서 시맨틱 토큰 검색 | 0건 — **PASS** |
| P5 패키지 경계 | deep import (`@depix/*/src/`) grep | 0건 — **PASS** |
| P6 Konva 격리 | core/editor/react에서 `from 'konva'` grep | 0건 — **PASS** |

#### Concerns

| 규칙 | 결과 |
|------|------|
| C1 .js 확장자 | 모든 상대 import에 .js 확장자 사용 — **PASS** |
| C1 import type | 타입 전용 import에 inline type 키워드 사용 — **PASS** |
| C1 barrel exports | 4개 패키지 모두 src/index.ts 존재 — **PASS** |
| C3 테스트 | 4개 패키지 모두 __tests__/ 디렉터리, 74개 테스트 파일 — **PASS** |
| C4 Konva 격리 | store에 Konva 참조 0건, core/editor에 Konva import 0건 — **PASS** |
| C5 @ts-ignore | 0건 — **PASS** |
| C5 @ts-expect-error | 0건 — **PASS** |
| C5 strict: true | root tsconfig에 strict: true, 모든 패키지가 extends — **PASS** |

#### Specifics

| 규칙 | 결과 |
|------|------|
| S-compiler 파이프라인 순서 | compiler.ts가 문서화된 8단계 순서와 일치 — **PASS** |
| S-compiler 순수 함수 | 모듈 레벨 가변 상태 0건 — **PASS** |
| S-compiler 레이아웃 파일 위치 | 모든 레이아웃 알고리즘이 layout/ 디렉터리 — **PASS** |
| S-renderer IR 읽기 전용 | engine에서 compiler/layout import 0건 — **PASS** |
| S-renderer IR 미수정 | 렌더러 파일에서 IR 프로퍼티 할당 0건 — **PASS** |
| S-ir-ops structuredClone | 4개 파일 모든 뮤테이션 함수에서 사용 — **PASS** |
| S-ir-ops 반환 타입 | 모든 함수가 DepixIR 반환 — **PASS** |
| S-ir-ops No Konva | editor에서 Konva import 0건 — **PASS** |
| S-zustand 인스턴스 패턴 | createStore + Context 사용, 글로벌 create 미사용 — **PASS** |
| S-zustand selector 기반 | 모든 useEditorStore 호출이 selector 형태 — **PASS** |
| S-zustand DSL/IR/Konva 미저장 | store 타입에 dsl/DepixIR/Konva 참조 0건 — **PASS** |
| S-zustand store 격리 | core/engine/editor에서 store import 0건 — **PASS** |
| S-dsl-mutations parse-serialize | 17개 함수 모두 parse→serialize 패턴 — **PASS** |
| S-dsl-mutations no compile | dsl-mutations에서 compile 호출 0건 — **PASS** |
| S-dsl-mutations 순수 함수 | 부수효과 0건 — **PASS** |
| S-dsl-mutations 인덱스 방어 | 모든 scene 접근에 범위 체크 — **PASS** |

---

### 예외 판정

1. **C5/C4 tension (`as any` 7건)**: DepixEngine이 Konva 객체를 반환하지만 C4가 react에서 konva import를 금지. `as any` 캐스트는 C4 준수를 위한 불가피한 타입 우회. → DepixEngine에 타입된 인터페이스 추가로 해소 가능 (별도 태스크).
2. **C1 hook 파일 네이밍 (10건)**: `useXxx.ts` camelCase는 React 생태계 표준 관행. kebab-case 규칙의 예외로 인정.
3. **C1 types.ts (661줄)**: 타입 정의 전용 파일. 로직 없이 인터페이스/타입만 포함. 분할 시 타입 참조가 복잡해져 현상 유지 판정.
4. **C2 useDSLSync.ts:48 catch**: 에러 정보를 포함한 객체를 반환 (`{ ir: null, errors: [...] }`). 빈 catch가 아닌 정상 에러 핸들링.

---

### 리팩토링 권고 (우선순위)

| 우선순위 | 항목 | 영향 규칙 | 예상 난이도 |
|----------|------|----------|-----------|
| **1** | `recalculateEdge` 엣지 스타일 보존 | S-ir-ops (High) | 낮음 |
| **2** | dsl-mutations regex → parse 전환 | S-dsl-mutations (High) | 낮음 |
| **3** | 빈 catch 블록에 사유 주석 추가 | C2 (Medium) | 낮음 |
| **4** | emit-scene.ts 분할 (1,466줄) | C1 (High) | 높음 |
| **5** | emit-ir.ts 분할 (1,060줄) | C1 (High) | 높음 |
| **6** | DepixCanvasEditable.tsx 분할 (980줄) | C1 (Medium) | 중간 |
| **7** | DepixEngine 타입 인터페이스 추가 | C5 (Medium) | 중간 |
| **8** | emit-ir.ts 매직 상수에 주석 추가 | S-compiler (Low) | 낮음 |

---

## AUDIT-v2 (2026-03-26) — 규칙 부트스트랩 시 실행

- 총 위반: 27건 (Critical 0, High 2, Medium 3, Low 22)
- 상세: v3에 통합

## AUDIT-v1 (2026-03-05)

- 총 위반: 2건 → 해소 완료
