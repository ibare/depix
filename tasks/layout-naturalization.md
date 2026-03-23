# Layout Naturalization — 역할 기반 사이즈 팔레트

## 목표

균등 배분("3노드 모두 동일 크기")을 역할 기반 비례 배분으로 교체.
Before: Input / Process / Output 모두 동일 크기
After: Input(S) → Process(M) → Output(S) — 구조적 중심이 더 크게

알고리즘 근거: Cartography(Visual Salience) + Editorial Layout + Squarified Treemap + Musical Accent Pattern

---

## 상태

- [x] Phase 1: `structural-roles.ts` + `allocate-budgets.ts`
- [x] Phase 2: `allocate-bounds.ts` (`computeLayoutChildren`)
- [x] Phase 3: 테스트 (1263 pass)

---

## 파일 변경 범위

```
신규
  packages/core/src/compiler/passes/structural-roles.ts

수정
  packages/core/src/compiler/passes/allocate-budgets.ts
  packages/core/src/compiler/passes/allocate-bounds.ts

불변
  IR 타입, Renderer, DSL 파서, compiler.ts, emit-scene.ts
  computeConstraints.ts, allocateBudgets() 시그니처
```

---

## Phase 1 — `structural-roles.ts` + `allocate-budgets.ts`

### 1-A. 신규: `passes/structural-roles.ts`

**타입 & 팔레트**

```typescript
const PHI = 1.618;
// PHI^0=1.0, PHI^1=1.618, PHI^2=2.618, PHI^3=4.236, PHI^4=6.854
export const SIZE_PALETTE = {
  XS: 1.0,
  S:  PHI,
  M:  PHI ** 2,
  L:  PHI ** 3,
  XL: PHI ** 4,
} as const;
export type SizeStep = keyof typeof SIZE_PALETTE;

export type StructuralRole =
  | 'root' | 'branch' | 'leaf'
  | 'entry' | 'terminal' | 'junction' | 'transform'
  | 'container' | 'cell' | 'header-cell' | 'label-cell';

const ROLE_TO_STEP: Record<StructuralRole, SizeStep> = {
  root: 'L',  branch: 'M',  container: 'M',
  transform: 'M',  junction: 'M',
  entry: 'S',  terminal: 'S',  leaf: 'S',
  cell: 'S',  'header-cell': 'S',  'label-cell': 'S',
};
```

**`analyzeFlowRoles(nodeIds, edges): Map<string, StructuralRole>`**

```typescript
// 1. inDeg/outDeg 계산
// 2. computeFlowLayerInfo 호출 → centerLayerIdx = Math.floor(layerCount / 2)
// 3. 역할 결정:
//    inDeg === 0       → 'entry'
//    outDeg === 0      → 'terminal'
//    inDeg + outDeg >= 3 → 'junction'
//    nodeLayer === centerLayerIdx → 'transform'
//    나머지            → 'leaf'
```

참고: `computeFlowLayerInfo`는 `layout-analysis.ts`에서 import.

**`analyzeTreeRoles(nodeIds, edges): Map<string, StructuralRole>`**

```typescript
// 1. hasParent, hasChild Set 계산
// 2. 역할 결정:
//    !hasParent → 'root'
//    hasChild   → 'branch'
//    나머지     → 'leaf'
```

**`roleWeight(role, node): number`**

```typescript
// base = SIZE_PALETTE[ROLE_TO_STEP[role]]
// adjustStep:
//   role === 'branch' && node.children.length >= 3 → stepUp (M→L)
//   role === 'leaf' && (node.astNode.label?.length ?? 0) > 15 → stepUp (S→M)
// return SIZE_PALETTE[adjustedStep]
```

**`computeLevelWeights(levelInfo, children, roles): number[]`**

```typescript
// levelWeights = new Array(levelInfo.numLevels).fill(SIZE_PALETTE.S)
// for each child:
//   level = levelInfo.nodeLevel.get(child.id) ?? 0
//   w = roleWeight(roles.get(child.id) ?? 'leaf', child)
//   levelWeights[level] = Math.max(levelWeights[level], w)
// return levelWeights
```

**`distributeByWeights(weights, total): number[]`**

```typescript
// totalW = sum(weights)
// totalW > 0 ? weights.map(w => total * (w / totalW)) : uniform
```

**`applyAccentPattern(weights): number[]`**

Flow 전용 후처리. Tree에는 적용하지 않는다(감소 패턴이 자연스러움).

```typescript
// 1. max/min 클램프: max/min > PHI^2(=2.618) 이면 min = min * (PHI^2 / ratio)로 끌어올림
// 2. 단조 감지: 모든 쌍이 non-decreasing 또는 non-increasing이면 단조
// 3. 단조이면 중심 우세형으로 재정렬:
//    내림차순 정렬 후, 짝수 인덱스에 큰 값, 홀수 인덱스에 작은 값 배치
//    예: [3, 2, 1] → [2, 3, 1]의 포지션 매핑이 아니라
//    원래 순서 유지하되 monotone이면 swap해서 중간이 크도록
// 주의: 3노드 S-S-M이면 중심 우세형으로 → S-M-S
```

구체적 구현 참고:
```typescript
// weights = [w0, w1, w2]가 [S, S, M] 단조 증가면
// → 정렬: [M, S, S]
// → 인터리브: [0]=S, [1]=M, [2]=S (중앙에 큰 값)
// 단, 원소 수가 짝수면 앞쪽에 큰 값 배치
```

---

### 1-B. 수정: `allocate-budgets.ts` — `allocateTreeFlowBudgets`

**Flow 분기 (현재 lines 357-388)**

교체 대상: `layerWeights` 계산 부분

```typescript
// BEFORE (lines 362-373)
const layerWeights: number[] = new Array(layerCount).fill(0);
for (const child of node.children) {
  const layer = layerInfo.nodeLayer.get(child.id) ?? 0;
  const cc = _constraints.get(child.id);
  const mainMin = isHorizontal ? (cc?.minWidth ?? 4) : (cc?.minHeight ?? 3);
  layerWeights[layer] = Math.max(layerWeights[layer], mainMin);
}
const totalLayerWeight = layerWeights.reduce((s, w) => s + w, 0);
const layerMainSizes = totalLayerWeight > 0
  ? layerWeights.map(w => mainUsable * (w / totalLayerWeight))
  : layerWeights.map(() => mainUsable / layerCount);

// AFTER
const roles = analyzeFlowRoles(nodeIds, edges);
const rawWeights = node.children.map(c => roleWeight(roles.get(c.id) ?? 'leaf', c));
const accentedWeights = applyAccentPattern(rawWeights);
const layerWeights: number[] = new Array(layerCount).fill(0);
node.children.forEach((child, i) => {
  const layer = layerInfo.nodeLayer.get(child.id) ?? 0;
  layerWeights[layer] = Math.max(layerWeights[layer], accentedWeights[i]);
});
const totalLayerWeight = layerWeights.reduce((s, w) => s + w, 0);
const layerMainSizes = distributeByWeights(layerWeights, mainUsable);
```

**Tree 분기 (현재 lines 336-355)**

```typescript
// BEFORE (line 338)
const levelHeight = (mainAvail - gap * Math.max(levelInfo.numLevels - 1, 0))
  / Math.max(levelInfo.numLevels, 1);
// ... for loop에서 levelHeight 사용

// AFTER
const roles = analyzeTreeRoles(nodeIds, edges);
const levelWeights = computeLevelWeights(levelInfo, node.children, roles);
const mainUsable = mainAvail - gap * Math.max(levelInfo.numLevels - 1, 0);
const levelMainSizes = distributeByWeights(levelWeights, mainUsable);
// for loop에서 levelHeight 대신:
//   const level = levelInfo.nodeLevel.get(child.id) ?? 0;
//   const nodeMain = levelMainSizes[level];
```

---

## Phase 2 — `allocate-bounds.ts` (`computeLayoutChildren`)

### Flow 케이스 (현재 lines 419-465)

교체 대상: `layerWeights` 계산 부분 (lines 433-443)

```typescript
// BEFORE (lines 433-443)
const layerWeights: number[] = new Array(layerCount).fill(0);
for (const c of plan.children) {
  const layer = layerInfo.nodeLayer.get(c.id) ?? 0;
  const m = measureMap?.get(c.id);
  const mainMin = isHorizontal ? (m?.minWidth ?? 4) : (m?.minHeight ?? 3);
  layerWeights[layer] = Math.max(layerWeights[layer], mainMin);
}
const totalLayerWeight = layerWeights.reduce((s, w) => s + w, 0);
const layerMainSizes = totalLayerWeight > 0
  ? layerWeights.map(w => mainUsable * (w / totalLayerWeight))
  : layerWeights.map(() => mainUsable / layerCount);

// AFTER
const roles = analyzeFlowRoles(nodeIds, plan.edges);
const rawWeights = plan.children.map(c => roleWeight(roles.get(c.id) ?? 'leaf', c));
const accentedWeights = applyAccentPattern(rawWeights);
const layerWeights: number[] = new Array(layerCount).fill(0);
plan.children.forEach((c, i) => {
  const layer = layerInfo.nodeLayer.get(c.id) ?? 0;
  layerWeights[layer] = Math.max(layerWeights[layer], accentedWeights[i]);
});
const layerMainSizes = distributeByWeights(layerWeights, mainUsable);
```

나머지 cross-axis 로직 (lines 446-464) 변경 없음.

### Tree 케이스 (현재 lines 467-493)

```typescript
// BEFORE (line 480)
const levelHeight = (mainAxis - levelGap * Math.max(levelInfo.numLevels - 1, 0))
  / Math.max(levelInfo.numLevels, 1);
// 모든 노드에 동일한 levelHeight 사용

// AFTER
const roles = analyzeTreeRoles(nodeIds, plan.edges);
const levelWeights = computeLevelWeights(levelInfo, plan.children, roles);
const mainUsable = mainAxis - levelGap * Math.max(levelInfo.numLevels - 1, 0);
const levelMainSizes = distributeByWeights(levelWeights, mainUsable);
// return에서 levelHeight 대신:
//   const level = levelInfo.nodeLevel.get(c.id) ?? 0;
//   const nodeMain = levelMainSizes[level];
```

나머지 cross-axis (uniformWidth, maxCrossSize) 변경 없음.

---

## Phase 3 — 검증

| 케이스 | DSL | 기대 결과 |
|--------|-----|-----------|
| Flow 3노드 | `flow direction:right { node "Input" · node "Process" · node "Output" }` | Process > Input = Output |
| Tree 3레벨 | `tree { node "CEO" → node "CTO", node "CFO" → node "Dev1", node "Dev2" }` | CEO > CTO/CFO > Dev |
| Flow 분기 | `flow { A → B · A → C }` | B=C (모두 terminal, S) |
| 동일 DSL 2회 | 모든 케이스 | 동일 bounds 결과 |

---

## 주요 불변사항

- `allocateBudgets()` 함수 시그니처 변경 없음
- `computeLayoutChildren()` 함수 시그니처 변경 없음
- `analyzeFlowRoles` / `analyzeTreeRoles` 는 `structural-roles.ts`에서 export, 양쪽 파일이 import
- `plan.edges` 타입: `{ fromId: string; toId: string }[]` (ASTEdge)
- `node.astNode.label` 로 텍스트 길이 접근 (ASTElement의 label 필드)
