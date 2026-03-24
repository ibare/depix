# Content-Aware Max Constraint Pipeline

## 문제 정의

모든 레이아웃 타입(flow, tree, stack, grid, layers 등)이 "가용 공간을 최대한 활용"하는 방식으로 노드 크기를 결정한다.
결과적으로 내용과 무관하게 거대하게 부풀려진 노드가 만들어진다.

**근본 원인**: 파이프라인 어디에도 "콘텐츠 기반 최대 크기(maxWidth/maxHeight)"가 존재하지 않는다.

## 해결 방향

1. `measure.ts`에서 콘텐츠 기반 max 크기 계산
2. 모든 레이아웃에서 max 클램핑 적용
3. 잉여 공간 → gap 확장 (노드 팽창 금지)

---

## 5단계 구현 계획

### Phase 1: MeasureResult에 maxWidth/maxHeight 추가 ✅ 진행 예정
파일: `packages/core/src/compiler/passes/measure.ts`

**추가 필드:**
```typescript
export interface MeasureResult {
  // ... existing fields ...
  /** Maximum width this element should occupy (content-aware upper bound). */
  maxWidth: number;
  /** Maximum height this element should occupy (content-aware upper bound). */
  maxHeight: number;
}
```

**각 타입별 max 계산:**
- `measureShape`: maxWidth = minWidth * 3.0, maxHeight = minHeight * 3.0
- `measureText`: maxWidth = minWidth * 2.0, maxHeight = minHeight * 1.5
- `measureList`: maxWidth = minWidth * 2.5, maxHeight = minHeight * 1.5
- `measureDivider`: maxWidth = Infinity, maxHeight = minHeight * 3
- `measureImage`: maxWidth = minWidth, maxHeight = minHeight (고정 크기)
- `measureBlock`: maxWidth = Infinity, maxHeight = Infinity (컨테이너는 제한 없음)

### Phase 2: redistributeWithConstraints 추가 ✅ 진행 예정
파일: `packages/core/src/compiler/passes/allocate-bounds.ts`

```typescript
export function redistributeWithConstraints(
  raw: number[],
  mins: number[],
  maxs: number[],
  total: number,
): number[] {
  // 1. min 클램핑 (기존 redistributeWithMinimums 로직)
  // 2. max 클램핑: max를 초과하는 항목 잘라내기
  // 3. 잉여 공간 → 배열에 반환 (호출자가 gap에 추가)
}
```

실제 시그니처: `redistributeWithConstraints(raw, mins, maxs, total): { sizes: number[], surplus: number }`

### Phase 3: computeLayoutChildren에 max 클램핑 적용 ✅ 진행 예정
파일: `packages/core/src/compiler/passes/allocate-bounds.ts`

모든 레이아웃 케이스에서 measureMap의 maxWidth/maxHeight를 사용:
- `stack col`: height 클램핑, surplus → adjustedGap = baseGap + surplus / numGaps
- `stack row`: width 클램핑, 동일
- `flow`: cross-axis 클램핑 (main은 role-weight으로 이미 제어됨)
- `tree`: cross-axis 클램핑
- `grid`: 클램핑 없음 (uniform cell은 의도적)
- `layers`: height 클램핑
- `group`: height 클램핑

### Phase 4: emitInlineBlock에 inline measure 추가 ✅ 진행 예정
파일: `packages/core/src/compiler/emit-ir.ts`

scene 파이프라인이 `computeLayoutChildren`을 호출할 때 measureMap을 전달한다.
현재는 None을 전달하므로 max 제약이 적용되지 않는다.

```typescript
// emitInlineBlock 내부
const inlineMeasureMap = measureInlineBlock(plan, bounds, scaleCtx);
const layoutChildren = computeLayoutChildren(plan, bounds, scaleCtx, inlineMeasureMap);
```

`measureInlineBlock`은 measure.ts의 `measureNode`를 활용한다.

### Phase 5: allocateBudgets에도 max constraint 적용 ✅ 진행 예정
파일: `packages/core/src/compiler/passes/allocate-budgets.ts`

budget 할당 단계에서도 max를 고려하여 budget이 max를 초과하지 않도록 한다.
현재 BFS 방식에서 각 child의 budget을 계산할 때 constraints의 maxWidth/maxHeight 적용.

---

## 진행 상태

- [ ] Phase 1: measure.ts — maxWidth/maxHeight 필드 추가
- [ ] Phase 2: allocate-bounds.ts — redistributeWithConstraints
- [ ] Phase 3: computeLayoutChildren — max 클램핑
- [ ] Phase 4: emit-ir.ts — inline measure
- [ ] Phase 5: allocate-budgets.ts — max constraint

각 Phase 완료 후 커밋.

---

## 불변사항

- allocateDiagram(), allocateBudgets() 시그니처 변경 없음
- IR 타입, Renderer, DSL 파서 변경 없음
- 기존 테스트 모두 통과 유지
