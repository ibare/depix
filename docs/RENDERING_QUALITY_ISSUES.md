# Depix 렌더링 품질 문제 분석 및 해결책

> 현재 구현된 예산 시스템 기반 렌더링에서 발견된 문제들을 분류하고,
> "어색하지 않은 수준"까지 도달하기 위한 구체적인 해결책을 제시한다.

---

## 문제 분류 개요

| # | 문제 | 심각도 | 해결 난이도 | 예상 개선 효과 |
|---|------|:------:|:-----------:|:------------:|
| 1 | 노드 최대 크기 상한 없음 | 🔴 심각 | 낮음 | 매우 높음 |
| 2 | 폰트 크기 상한 없음 | 🔴 심각 | 낮음 | 매우 높음 |
| 3 | 도형별 aspect ratio 무시 | 🔴 심각 | 낮음 | 높음 |
| 4 | 텍스트 길이 ↔ 폰트 역관계 없음 | 🟡 중간 | 중간 | 높음 |
| 5 | 텍스트 클리핑 | 🟡 중간 | 중간 | 중간 |
| 6 | 엣지 라벨 위치 | 🟡 중간 | 중간 | 중간 |
| 7 | 분기 flow 노드 크기 불균형 | 🟡 중간 | 중간 | 중간 |
| 8 | 노드 간 여백 부족 | 🟢 경미 | 낮음 | 중간 |
| 9 | 단일 노드 레이어의 과도한 크기 | 🟢 경미 | 낮음 | 낮음 |

---

## 🔴 심각 — 즉시 어색함을 유발

---

### 문제 1. 노드 최대 크기 상한 없음

#### 현상

Input → Process → Output 3노드 flow에서 각 노드가 캔버스 높이 전체를 차지한다.
예산 시스템이 "주어진 공간을 꽉 채워라"는 원칙으로 작동하기 때문이다.

노드가 3개든 30개든 캔버스를 균등 분할하므로, 노드 수가 적을수록 노드 하나가 비이상적으로 커진다.

```
캔버스 900×506 (16:9), flow direction:right, 3노드
  layerMain = (900 - gaps) / 3 ≈ 290px
  nodeCross = min(506, 506 × 0.6) = 303px

→ 노드 크기: 290×303 — 거의 정사각형이고 엄청나게 크다
```

#### 근본 원인

예산 시스템은 "공간 배분"을 목표로 설계되었는데, 시각적으로 자연스러운 노드 크기는
**내용(텍스트)과 맥락(노드 수, 다이어그램 목적)에 따른 적정 크기**이지 공간 배분의 결과가 아니다.

인간이 플로우차트를 그릴 때 노드 3개짜리 다이어그램의 노드 크기와 노드 20개짜리의 노드 크기는 크게 다르지 않다. 여백이 많으면 여백으로 두는 것이 자연스럽다.

#### 해결책: 노드 크기 상한 (maxNodeSize)

예산에서 노드 크기를 계산할 때 절대 상한을 적용한다.

```typescript
// layout/flow-layout.ts, layout/tree-layout.ts

// 캔버스 크기 기반 상한: 짧은 쪽의 비율
const canvasShort = Math.min(canvasW, canvasH);

const MAX_NODE_MAIN  = canvasShort * 0.25;  // main축 최대 25%
const MAX_NODE_CROSS = canvasShort * 0.30;  // cross축 최대 30%

const nodeMain  = Math.min(budgetMain,  MAX_NODE_MAIN);
const nodeCross = Math.min(budgetCross, MAX_NODE_CROSS);
```

**상한값 근거**:
- 노드 1개일 때 캔버스 짧은 쪽의 25~30%가 시각적으로 "크지만 적절한" 크기
- 노드 4개 이상이면 예산이 자연스럽게 이 상한 이하로 내려옴
- 상한을 넘은 여분 공간은 패딩/여백으로 흡수 (중앙 정렬)

**flow 배치 변경**:

```typescript
// 현재: 예산 전체를 노드 크기로
h: budgetCross

// 변경: 상한 적용 후 나머지는 여백
const actualCross = Math.min(budgetCross, MAX_NODE_CROSS);
h: actualCross
// 노드를 layer 중앙에 배치 (상하 여백 균등)
y: layerY + (budgetCross - actualCross) / 2
```

---

### 문제 2. 폰트 크기 상한 없음

#### 현상

노드 크기에 비례해서 폰트가 결정되므로, 노드가 크면 폰트도 거대해진다.
"Input" 3글자가 80px 크기로 렌더링되는 상황이 발생한다.

현재 로직:
```
shortSide = min(nodeW, nodeH)
fontSize  = shortSide × 0.30   // innerLabel ratio
```

노드가 200px × 300px이면 fontSize = 60px. 어떤 다이어그램에서도 60px 텍스트는 부적절하다.

#### 근본 원인

폰트 크기는 두 가지 제약의 교집합이어야 한다.
1. 노드 크기에 비례한 값 (노드보다 커서는 안 됨)
2. 절대적인 가독성 상한 (너무 커서 어색하지 않을 것)

현재는 1번만 있고 2번이 없다.

#### 해결책: 폰트 절대 상한 + 스케일 감쇠

```typescript
// passes/measure.ts

function computeFontSize(shortSide: number, role: FontRole): number {
  // 비례 계산
  const ratio = FONT_RATIO[role];  // innerLabel: 0.30, header: 0.35 등
  const proportional = shortSide * ratio;

  // 절대 상한 (px 기준, 캔버스 좌표계)
  const ABSOLUTE_MAX: Record<FontRole, number> = {
    innerLabel: 18,   // 노드 내부 텍스트
    outerLabel: 14,   // 노드 외부 라벨
    header:     22,   // 컨테이너 헤더
    edgeLabel:  11,   // 엣지 라벨
  };

  // 감쇠 함수: 비례값이 클수록 상한에 부드럽게 수렴
  // f(x) = max / (1 + e^(-k(x - midpoint))) — sigmoid clamp
  const max = ABSOLUTE_MAX[role];
  return Math.min(proportional, max);
}
```

**감쇠 곡선 시뮬레이션** (innerLabel, ratio 0.30):

| shortSide | 비례값 | 적용 후 |
|-----------|--------|---------|
| 20px | 6.0 | 6.0 |
| 40px | 12.0 | 12.0 |
| 60px | 18.0 | 18.0 ← 상한 도달 |
| 100px | 30.0 | 18.0 |
| 200px | 60.0 | 18.0 |

노드가 아무리 커도 텍스트는 18px을 넘지 않는다.

---

### 문제 3. 도형별 aspect ratio 무시

#### 현상

다이아몬드(diamond) 노드가 예산이 할당한 직사각형 bounds를 그대로 사용해서
수직으로 길쭉한 기형적인 형태가 된다.

예산 배분:
```
budget = { w: 150, h: 300 }  (cross축이 main축보다 큰 경우)
diamond bounds = { w: 150, h: 300 }
→ 세로로 매우 긴 마름모 — 자연스럽지 않다
```

자연스러운 다이아몬드는 가로:세로 비율이 약 1.5:1 ~ 2:1이다.
직사각형과 원은 비율 제약이 덜하지만, 다이아몬드/헥사곤 등 각도가 의미 있는 도형은 비율 왜곡이 즉시 눈에 띈다.

#### 근본 원인

현재 레이아웃 알고리즘은 bounds를 계산할 때 도형 타입을 고려하지 않는다.
렌더러만 도형 타입을 알고 있고, 컴파일러는 bounds를 직사각형 공간으로만 취급한다.

#### 해결책: 도형별 preferredRatio + bounds 조정

```typescript
// compiler/shapes.ts (신규)

interface ShapeConstraint {
  preferredRatio: number;   // width / height
  ratioStrict: boolean;     // true면 강제, false면 권장
  minWidth?: number;
  minHeight?: number;
}

const SHAPE_CONSTRAINTS: Record<ShapeType, ShapeConstraint> = {
  rect:     { preferredRatio: 1.6,  ratioStrict: false },
  circle:   { preferredRatio: 1.0,  ratioStrict: true  },  // 항상 정원
  diamond:  { preferredRatio: 1.6,  ratioStrict: true  },  // 가로:세로 = 1.6:1
  hexagon:  { preferredRatio: 1.15, ratioStrict: true  },
  ellipse:  { preferredRatio: 1.6,  ratioStrict: false },
  parallelogram: { preferredRatio: 1.8, ratioStrict: true },
};
```

bounds 확정 시 도형 제약 적용:

```typescript
// passes/allocate-bounds.ts

function applyShapeConstraint(
  bounds: IRBounds,
  shapeType: ShapeType,
): IRBounds {
  const constraint = SHAPE_CONSTRAINTS[shapeType];
  if (!constraint || !constraint.ratioStrict) return bounds;

  const { preferredRatio } = constraint;
  const currentRatio = bounds.w / bounds.h;

  if (Math.abs(currentRatio - preferredRatio) < 0.1) return bounds;

  // 예산 안에서 비율 맞추기: 더 작은 쪽 기준으로 조정
  const maxW = bounds.h * preferredRatio;
  const maxH = bounds.w / preferredRatio;

  if (bounds.w > maxW) {
    // 너비가 기준 초과 → 높이를 기준으로 너비 축소
    return {
      ...bounds,
      w: maxW,
      x: bounds.x + (bounds.w - maxW) / 2,  // 중앙 정렬
    };
  } else {
    // 높이가 기준 초과 → 너비를 기준으로 높이 축소
    return {
      ...bounds,
      h: maxH,
      y: bounds.y + (bounds.h - maxH) / 2,  // 중앙 정렬
    };
  }
}
```

**적용 결과 시뮬레이션**:
```
budget = { w: 150, h: 300 }
diamond preferredRatio = 1.6

currentRatio = 150/300 = 0.5  (너무 세로로 김)
maxW = 300 * 1.6 = 480 → bounds.w(150) < maxW, 높이 기준 조정
maxH = 150 / 1.6 = 93.75

결과: bounds = { w: 150, h: 93.75, y: y + 103 }  (중앙 정렬)
→ 자연스러운 가로 1.6:1 비율의 다이아몬드
```

---

## 🟡 중간 — 반복해서 보면 어색함

---

### 문제 4. 텍스트 길이 ↔ 폰트 크기 역관계 없음

#### 현상

"CEO" 3글자와 "API Gateway" 11글자가 같은 노드 크기를 받으면 동일한 폰트로 렌더링된다.
인간이 손으로 그릴 때는 텍스트가 길면 자연스럽게 폰트를 줄이거나 노드를 키운다.

이미지 3의 조직도에서 CEO는 3글자인데 거대한 폰트가 적용되어 "텍스트 하나에 노드 하나"처럼 보이지 않고 "거대한 글자 하나"처럼 보인다.

#### 근본 원인

현재 fontSize = shortSide × ratio 계산에서 텍스트 길이가 전혀 반영되지 않는다.

#### 해결책: 텍스트 길이 기반 폰트 보정

```typescript
// passes/measure.ts

function computeFontSizeWithText(
  shortSide: number,
  role: FontRole,
  text: string,
): number {
  const base = computeFontSize(shortSide, role);  // 기존 계산

  const charCount = text.length;

  // 짧은 텍스트(1~4글자): 폰트 축소 — 너무 거대하게 보임 방지
  // 긴 텍스트(10글자+): 폰트 축소 — 노드 너비 초과 방지
  const shortPenalty = charCount <= 4
    ? 0.6 + (charCount - 1) * 0.1   // 1글자: 0.6, 4글자: 0.9
    : 1.0;

  // 긴 텍스트 축소: sqrt 감쇠
  const longPenalty = charCount > 6
    ? Math.sqrt(6 / charCount)
    : 1.0;

  const penalty = Math.min(shortPenalty, longPenalty);
  return base * penalty;
}
```

**시뮬레이션** (base fontSize = 18, shortSide = 60):

| 텍스트 | 길이 | penalty | 최종 fontSize |
|--------|------|---------|--------------|
| "A" | 1 | 0.60 | 10.8 |
| "CEO" | 3 | 0.80 | 14.4 |
| "Input" | 5 | 1.00 | 18.0 |
| "API Gateway" | 11 | 0.74 | 13.3 |
| "Authentication" | 14 | 0.65 | 11.8 |

짧은 텍스트는 덜 거대하게, 긴 텍스트는 넘치지 않게 자동 조정된다.

---

### 문제 5. 텍스트 클리핑 — 단어 중간 줄바꿈

#### 현상

이미지 6에서 "secondary"가 "secondar / y"로 단어 중간에서 잘린다.
노드 너비 대비 폰트가 크거나, 텍스트 렌더링 영역이 충분히 계산되지 않은 결과다.

#### 근본 원인

measure 패스는 fontSize를 결정하지만 실제 텍스트 렌더링 너비(`textWidth = fontSize × charCount × avgCharWidth`)를 노드 bounds와 비교하지 않는다.

#### 해결책: 텍스트 오버플로우 사전 감지 + 폰트 축소

```typescript
// passes/measure.ts

const AVG_CHAR_WIDTH_RATIO = 0.55;  // 평균 글자 너비 / fontSize 비율 (모노스페이스 아닌 경우)
const TEXT_PADDING_H = 0.15;        // 노드 너비 대비 좌우 패딩 비율

function clampFontSizeToFit(
  fontSize: number,
  text: string,
  nodeWidth: number,
): number {
  const availableWidth = nodeWidth * (1 - TEXT_PADDING_H * 2);
  const estimatedTextWidth = fontSize * text.length * AVG_CHAR_WIDTH_RATIO;

  if (estimatedTextWidth <= availableWidth) return fontSize;

  // 텍스트가 너비를 초과 → 비율 축소
  return fontSize * (availableWidth / estimatedTextWidth);
}
```

줄바꿈 허용 여부도 노드 타입별로 다르게 정책 설정:

```typescript
const TEXT_WRAP_POLICY: Record<NodeRole, 'nowrap' | 'word' | 'auto'> = {
  flowNode:    'nowrap',  // flow 노드는 줄바꿈 없이 폰트 축소
  treeNode:    'word',    // tree 노드는 단어 단위 줄바꿈 허용
  gridCell:    'word',    // grid 셀은 단어 단위 줄바꿈 허용
  layerLabel:  'nowrap',  // layer 라벨은 한 줄
};
```

---

### 문제 6. 엣지 라벨 위치

#### 현상

이미지 5에서 "pass" 라벨이 화살표 위에 어색하게 붙어있다.
라벨이 엣지 경로의 중점에 정확히 위치하지 않고, 화살표와 겹치거나 너무 가깝다.

#### 근본 원인

엣지 라벨 위치를 엣지 시작점과 끝점의 단순 중점으로 계산하면, 곡선 엣지에서는 실제 곡선 중점과 다르다. 또한 라벨이 엣지 선 위에 그대로 올라가서 선과 텍스트가 겹친다.

#### 해결책: 베지어 중점 계산 + 오프셋

```typescript
// layout/edge-router.ts

function computeEdgeLabelPosition(
  edge: IREdge,
): { x: number; y: number } {
  const points = edge.points;  // 경로 포인트들

  if (points.length === 2) {
    // 직선: 단순 중점
    return {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2,
    };
  }

  // 곡선: 전체 경로 길이의 50% 지점 계산
  const totalLength = computePolylineLength(points);
  return getPointAtLength(points, totalLength * 0.5);
}

// 라벨을 선에서 수직 방향으로 오프셋
function computeLabelOffset(
  edge: IREdge,
  labelPos: { x: number; y: number },
): { x: number; y: number } {
  const LABEL_OFFSET = 8;  // px
  const tangent = getTangentAtPoint(edge.points, labelPos);
  const normal = { x: -tangent.y, y: tangent.x };  // 수직 벡터

  return {
    x: labelPos.x + normal.x * LABEL_OFFSET,
    y: labelPos.y + normal.y * LABEL_OFFSET,
  };
}
```

---

### 문제 7. 분기 flow 노드 크기 불균형

#### 현상

이미지 4에서 Client/API Gateway 노드는 작고, Service A/B 노드는 상대적으로 크다.

Sugiyama layer 분석에서:
```
layer 0: [Client]          → 1개, nodeCross = min(crossAvail, 0.6 cap) = 큰 값
layer 1: [API Gateway]     → 1개, nodeCross = 동일하게 큰 값
layer 2: [Service A, B]    → 2개, nodeCross = (crossAvail - gap) / 2 = 작은 값
layer 3: [Database]        → 1개, nodeCross = 큰 값
```

단일 노드 레이어와 2노드 레이어의 nodeCross가 다르면 시각적으로 노드 크기가 들쭉날쭉해 보인다.

#### 근본 원인

cross축 크기를 "레이어 내 노드 수"로 나누기 때문에 레이어마다 노드 크기가 달라진다.
시각적으로는 같은 flow 안의 노드들이 비슷한 크기여야 통일감이 있다.

#### 해결책: flow 전체 기준 노드 크기 통일

```typescript
// layout/flow-layout.ts

// 변경 전: 레이어별 nodeCross 개별 계산
// 변경 후: flow 전체에서 가장 혼잡한 레이어 기준으로 통일

const maxNodesInAnyLayer = Math.max(...layerGroups.map(l => l.length));
const referenceCross = (crossAvail - gap * (maxNodesInAnyLayer - 1)) / maxNodesInAnyLayer;
const cappedCross = Math.min(referenceCross, crossAvail * 0.4);

// 모든 노드에 동일한 cappedCross 적용
// 단일 노드 레이어는 cappedCross 크기의 노드를 중앙 정렬
```

**시뮬레이션** (crossAvail = 500, gap = 20):
```
변경 전:
  layer 0 (1개): nodeCross = min(500, 300) = 300
  layer 2 (2개): nodeCross = (500 - 20) / 2 = 240

변경 후:
  maxNodes = 2
  referenceCross = (500 - 20) / 2 = 240
  모든 레이어: nodeCross = 240 → 시각적으로 균일
```

---

## 🟢 경미 — 전체 분위기에서 느껴지는 것

---

### 문제 8. 노드 간 여백 부족

#### 현상

이미지 3 조직도에서 노드들이 서로 너무 가까이 붙어있다. 정보 밀도가 높아 숨막히는 느낌이 든다.

인간이 다이어그램을 그릴 때 노드 크기 대비 약 30~50%의 여백을 두는 것이 일반적이다.
현재는 예산을 꽉 채우는 방향이라 여백이 거의 없다.

#### 근본 원인

현재 gap 값이 ScaleContext의 baseUnit 기반으로 계산되는데, baseUnit이 요소 수가 많아질수록 작아지고 그에 비례해 gap도 줄어든다. 요소가 많은 다이어그램일수록 더 촘촘해지는 역효과가 있다.

#### 해결책: 최소 gap 보장 + 노드 크기 대비 gap 비율 유지

```typescript
// passes/pre-allocate.ts

function computeGap(
  scaleCtx: ScaleContext,
  nodeCount: number,
  budgetPerNode: number,
): number {
  // 기존 baseUnit 기반 gap
  const baseGap = scaleCtx.baseUnit * GAP_RATIO;

  // 최소 gap: 노드 크기의 20%
  const minGap = budgetPerNode * 0.20;

  // 최대 gap: 노드 크기의 50% (너무 성기지 않게)
  const maxGap = budgetPerNode * 0.50;

  return Math.max(minGap, Math.min(maxGap, baseGap));
}
```

tree 레이아웃의 레벨 간 gap도 동일 원칙:

```typescript
const levelGap = Math.max(levelHeight * 0.25, MIN_LEVEL_GAP);
```

---

### 문제 9. 단일 노드 레이어의 과도한 크기

#### 현상

이미지 5에서 Start 노드가 캔버스 너비의 약 25%를 차지한다. "분기 flow" 맥락에서 시작 노드는 상대적으로 작게 보여야 흐름이 자연스럽다.

현재 `cross × 0.6` cap이 있지만 절대값으로 보면 여전히 크다.

#### 근본 원인

cap 비율(0.6)이 너무 관대하다. 실제 플로우차트에서 단일 노드 레이어의 자연스러운 크기는 최대 노드 레이어 크기의 80~90% 정도다.

#### 해결책: 문제 7 해결책과 통합

문제 7에서 제시한 "flow 전체 기준 노드 크기 통일"을 적용하면 자연스럽게 해결된다. 모든 노드가 `maxNodesInAnyLayer` 기준 크기를 사용하므로 단일 노드도 과도하게 커지지 않는다.

추가로 단일 노드 레이어에만 적용하는 별도 cap:

```typescript
// 단일 노드일 때 참조 크기의 90% 이하로
const singleNodeCap = referenceCross * 0.9;
const finalCross = layer.length === 1
  ? Math.min(cappedCross, singleNodeCap)
  : cappedCross;
```

---

## 구현 우선순위 및 작업 계획

### 1단계 — 즉시 효과 (예상 개선율 70%)

문제 1, 2, 3을 해결하면 "불필요하게 거대하다"는 핵심 이슈가 해소된다.
파이프라인 구조 변경 없이 measure/allocate 패스에 clamp 로직 추가만으로 완료 가능하다.

| 작업 | 파일 | 변경 규모 |
|------|------|----------|
| 노드 최대 크기 상한 (MAX_NODE_MAIN/CROSS) | `layout/flow-layout.ts`, `layout/tree-layout.ts` | 소 |
| 폰트 절대 상한 clamp | `passes/measure.ts` | 소 |
| 도형별 preferredRatio + bounds 조정 | `passes/allocate-bounds.ts`, `compiler/shapes.ts` (신규) | 중 |

**검증**: Input/Process/Output 3노드 flow에서 노드가 적절한 크기로 렌더링되고 폰트가 읽기 좋은 크기로 유지됨.

### 2단계 — 정교화 (예상 추가 개선율 20%)

문제 4, 5, 7을 해결하면 텍스트 표현의 자연스러움과 flow 다이어그램의 균일감이 개선된다.

| 작업 | 파일 | 변경 규모 |
|------|------|----------|
| 텍스트 길이 기반 폰트 보정 | `passes/measure.ts` | 소 |
| 텍스트 오버플로우 감지 + 폰트 축소 | `passes/measure.ts` | 소 |
| flow 전체 기준 노드 크기 통일 | `layout/flow-layout.ts` | 중 |

**검증**: "CEO" 같은 짧은 텍스트의 폰트가 과도하지 않고, "secondary" 같은 긴 텍스트가 노드 안에서 자연스럽게 표현됨.

### 3단계 — 마무리 (예상 추가 개선율 10%)

문제 6, 8, 9는 기능 품질보다는 시각적 완성도에 해당한다.

| 작업 | 파일 | 변경 규모 |
|------|------|----------|
| 엣지 라벨 베지어 중점 + 오프셋 | `layout/edge-router.ts` | 중 |
| 최소 gap 보장 | `passes/pre-allocate.ts` | 소 |
| 단일 노드 레이어 추가 cap | `layout/flow-layout.ts` | 소 |

---

## 완성 후 기대 상태

| 시나리오 | 현재 | 개선 후 |
|---------|------|--------|
| 3노드 flow | 노드가 캔버스 전체 차지, 폰트 거대 | 적정 크기 노드, 읽기 좋은 폰트 |
| 다이아몬드 노드 | 수직으로 변형된 기형 | 1.6:1 비율의 자연스러운 마름모 |
| 단어 클리핑 | "secondar / y" | "secondary" 한 줄 표현 |
| 분기 flow | 레이어별 노드 크기 들쭉날쭉 | 모든 노드 균일한 크기 |
| 조직도 | 노드 간 여백 없이 빽빽함 | 숨쉬는 여백 |

"어색하지 않은 수준"은 1단계 완료 시점에 달성 가능하다.
1, 2, 3단계 모두 완료하면 Mermaid 대비 시각적으로 확연히 우수한 결과물을 낼 수 있다.
