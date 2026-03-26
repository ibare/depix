# AUDIT 결과

---

## AUDIT-v2 (2026-03-26)

**감사 기준**: principles (P1-P6), C1~C5, S-compiler, S-renderer, S-ir-ops, S-zustand, S-dsl-mutations

### 요약

- 총 위반: 27건
- Critical: 0 / High: 2 / Medium: 3 / Low: 22
- 핵심 원칙 준수율: 100% (P1~P6 전항목 PASS)
- 도메인 규칙 준수율: 100% (S-* 전항목 PASS)

### High Severity

| # | Rule | File | Description |
|---|------|------|-------------|
| 1 | C1 | `core/compiler/scene/emit-scene.ts` (1,466줄) | 300줄 제한 5배 초과 |
| 2 | C1 | `core/compiler/passes/emit-ir.ts` (1,060줄) | 300줄 제한 3.5배 초과 |

### Medium Severity

| # | Rule | File | Description |
|---|------|------|-------------|
| 3 | C1 | `react/DepixCanvasEditable.tsx` (980줄) | 300줄 제한 3.3배 초과 |
| 4 | C5 | `react/hooks/useCanvasClickHandler.ts:78` | `: any` 타입 사용 |
| 5 | C5 | `react/hooks/useKonvaTransformer.ts:80` | `: any[]` 타입 사용 |

### Low Severity (C1 300줄 초과)

22건 — allocate-bounds.ts(936), validators.ts(919), parser.ts(905), dsl-mutations.ts(712), types.ts(661), edge-router.ts(658), tokenizer.ts(597), InspectorPanel.tsx(556), compute-constraints.ts(486), chart-layout.ts(459), depix-engine.ts(411), allocate-budgets.ts(410), measure.ts(401), selection-manager.ts(373), scene-layout.ts(350), flow-layout.ts(337), semantic-editor.ts(331), DepixDSLEditor.tsx(319), serializer.ts(313)

### 전항목 PASS

- P1 레이어 의존성 방향: 역방향 import 0건
- P2 IR 불변성: structuredClone 일관 사용
- P3 컴파일러 패스 순수성: 모듈 레벨 가변 상태 0건
- P4 IR 완전 해결: 시맨틱 토큰 잔존 0건
- P5 패키지 경계: 내부 경로 직접 import 0건
- P6 Konva 격리: core/editor/react에서 konva import 0건
- C2 에러 처리: 빈 catch 블록 0건
- C3 테스트: 기존 예외 사항 외 준수
- C4 Konva 격리: store에 Konva 참조 0건
- C5 @ts-ignore: 0건, @ts-expect-error 모두 사유 주석 포함
- S-compiler: 파이프라인 순서 및 순수 함수 준수
- S-renderer: 레이아웃 import 0건
- S-ir-ops: structuredClone 일관 사용
- S-zustand: 인스턴스 패턴, selector 기반, DSL/IR/Konva 미저장
- S-dsl-mutations: parse→AST→serialize 패턴 100% 준수, regex/compile 사용 0건

### 예외 판정

1. **C5 any in react hooks**: DepixEngine이 Konva 객체를 반환하지만 C4가 react에서 konva import를 금지. `as any` 캐스트는 C4 준수를 위한 불가피한 타입 우회. → DepixEngine에 타입된 인터페이스 추가로 해소 가능 (별도 태스크).
2. **C1 hook 파일 네이밍**: `useXxx.ts` camelCase는 React 생태계 표준 관행. kebab-case 규칙의 예외로 인정.

---

## AUDIT-v1 (2026-03-05)

**감사 기준**: principles, C1~C4, S-compiler, S-renderer, S-ir-ops

- 총 위반: 2건 → 해소 완료
- 상세: (이전 감사 기록 유지)
