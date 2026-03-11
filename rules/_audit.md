# AUDIT 결과

**감사 일시**: 2026-03-05
**감사 기준**: rules/principles.md, rules/concerns/C1~C4, rules/specifics/S-compiler, S-renderer, S-ir-ops

---

## 요약

- 총 위반: 2건 → **해소 완료**
- Critical: 0건 / High: 0건 / Medium: 0건 (해소) / Low: 0건
- 준수율: 100%

---

## 위반 목록

| # | 규칙 | 파일 | Severity | 내용 |
|---|------|------|:--------:|------|
| 1 | C3 | `packages/core/__tests__/compiler/layout/stack-layout.test.ts` | Medium | 레이아웃 결과를 불변식이 아닌 정확한 좌표 하드코딩으로 검증 (`expect(b.x).toBe(0)`, `expect(result.containerBounds.w).toBe(30)` 등 다수) |
| 2 | C3 | `packages/core/__tests__/compiler/layout/flow-layout.test.ts` | Medium | containerBounds를 `toEqual({ x: 10, y: 20, w: 80, h: 60 })`으로 검증 (단, 이는 입력 bounds가 그대로 반영되는지 확인하는 것으로 예외 판정 가능) |

---

## PASS 항목

| 규칙 | 검사 항목 | 결과 |
|------|----------|------|
| P1 레이어 의존성 | core/engine/editor 역방향 import | PASS |
| P2 IR 불변성 | editor에서 IR 직접 변경 | PASS (cloneAndFind 헬퍼 패턴) |
| P3 컴파일러 순수성 | 모듈 수준 mutable 변수 | PASS |
| P4 IR 완전 해결 | engine에 시맨틱 토큰 잔존 | PASS |
| P5 패키지 경계 | 내부 경로 직접 참조 | PASS |
| P6 Konva 격리 | core/editor에서 konva import | PASS |
| C1 모듈 구조 | .js 확장자, import type | PASS |
| C2 에러 처리 | 빈 catch 블록 | PASS |
| C2 에러 처리 | emit-ir.ts의 throw | PASS (프로그래밍 오류 — 예외 적용) |
| C4 Konva 격리 | react/src에서 konva 직접 import | PASS |
| S-compiler | 픽셀 단위 사용 | PASS |
| S-compiler | emitIR 내 레이아웃 직접 계산 | PASS |
| S-renderer | IR 변경 | PASS |
| S-renderer | layout import | PASS |
| S-renderer | CoordinateTransform 없이 좌표 계산 | PASS |
| S-ir-ops | structuredClone 사용 | PASS (cloneAndFind 헬퍼로 일관 적용) |
| S-ir-ops | origin 임의 조작 | PASS |

---

## 예외 판정

- **emit-ir.ts:200 `throw new Error`**: `boundsMap`에 값이 없는 것은 컴파일러 파이프라인 자체의 버그이므로 C2 규칙의 "복구 불가능한 프로그래밍 오류" 예외에 해당. 위반 아님.
- **flow-layout.test.ts containerBounds 검증**: 입력으로 전달한 bounds가 컨테이너 bounds로 그대로 반영되는지 확인하는 것은 "레이아웃이 입력 영역을 존중하는가"라는 불변식 검증으로 볼 수 있음. **예외로 판정.**

---

## 리팩토링 계획

### Track A: C3 — stack-layout.test.ts 좌표 하드코딩 해소 (Medium 1건)

`stack-layout.test.ts`에서 정확한 좌표를 단언하는 테스트를 불변식 기반으로 전환한다.

```ts
// Before (위반)
expect(b.x).toBe(0);
expect(b.w).toBe(20);

// After (불변식)
assertChildrenWithinParent(containerBounds, childBounds);
assertNoOverlap(childBounds);
assertOrderedInDirection(childBounds, 'col');
```

**예외**: 단일 자식이거나 빈 컨테이너처럼 좌표가 자명하게 결정되는 경우, 가독성을 위해 그대로 유지할 수 있음.
