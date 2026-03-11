# Depix IR (Internal Representation) 설계

## 아키텍처 개요

```
                        ┌─────────────┐
  DSL 텍스트 ─────────→ │  Compiler   │ ──→ DepixIR (JSON)
                        └─────────────┘          │
                              ↑                  ↓
                         레이아웃 엔진       DepixEngine (Konva)
                         색상 해석              렌더링만 담당
                         edge 라우팅             (계산 없음)
                              ↑                  ↑
                        ┌─────────────┐          │
                        │ 위지윅 에디터 │──────────┘
                        └─────────────┘
                         IR 직접 조작
```

### 역할 분리

| 레이어 | 역할 | 판단/계산 | 비유 |
|--------|------|-----------|------|
| **DSL** | LLM/사람이 의도를 기술 | 없음 (선언만) | Java 소스 |
| **Compiler** | DSL → IR 변환, 모든 계산 수행 | 레이아웃, 색상, 경로 | javac |
| **DepixIR** | 완전히 해결된 장면 기술 | 없음 (결과만) | bytecode |
| **DepixEngine** | IR → 화면 렌더링 | 없음 (그리기만) | JVM |
| **Editor** | IR 직접 조작 | 사용자 입력 처리 | IDE |

### 현재 DepixDocument와의 관계

```
현재 DepixDocument             DepixIR
─────────────────              ───────
SizingValue: 'fill'     →     w: 42.5 (계산된 절대값)
gap: 5 (상대)           →     각 요소의 x,y에 이미 반영됨
ConnectorObject          →     EdgeObject (경로 포인트 계산됨)
FrameObject (레이아웃)   →     ContainerObject (좌표 해결됨)
```

핵심: **DepixIR에는 계산이 필요한 값이 없다.**

---

## IR 타입 정의

### Document

```typescript
/**
 * DepixIR - 완전히 해결된(resolved) 장면 기술
 *
 * 모든 좌표는 0-100 상대값 (현재와 동일)
 * 모든 색상은 HEX 또는 rgba() (시맨틱 컬러 해석 완료)
 * 모든 레이아웃은 계산 완료 (fill, hug 등이 구체적 수치로)
 * 모든 edge 경로는 포인트 배열로 계산 완료
 */

interface DepixIR {
  /** 문서 메타데이터 */
  meta: IRMeta;
  /** 씬 목록 */
  scenes: IRScene[];
  /** 씬 간 전환 */
  transitions: IRTransition[];
}

interface IRMeta {
  /** 캔버스 비율 */
  aspectRatio: { width: number; height: number };
  /** 해석된 배경 (HEX/gradient, 시맨틱 컬러 아님) */
  background: IRBackground;
  /** 드로잉 스타일 */
  drawingStyle: 'default' | 'sketch';
}
```

### Scene

```typescript
interface IRScene {
  /** 씬 ID */
  id: string;
  /** 씬별 배경 오버라이드 */
  background?: IRBackground;
  /** 최상위 요소들 (z-order = 배열 순서) */
  elements: IRElement[];
}
```

### Element (통합 요소 타입)

현재 DepixDocument는 12개 오브젝트 타입이 있지만,
IR에서는 **렌더러가 구분해야 하는 최소 단위**로 통합함.

```typescript
/**
 * IR 요소 타입
 *
 * 현재 12개 → IR 8개로 통합
 *
 * rect, circle, ellipse        →  IRShape (shape 속성으로 구분)
 * text                         →  IRText
 * image                        →  IRImage
 * line                         →  IRLine
 * path                         →  IRPath
 * connector                    →  IREdge (경로 해결됨)
 * group, frame                 →  IRContainer (레이아웃 해결됨)
 * list                         →  IRContainer + IRText[] 로 분해
 * symbol                       →  IRShape 또는 IRPath로 분해
 */
type IRElement =
  | IRShape
  | IRText
  | IRImage
  | IRLine
  | IRPath
  | IREdge
  | IRContainer;
```

### 공통 기반

```typescript
/**
 * 모든 IR 요소의 공통 속성
 *
 * 핵심 차이: 모든 값이 "해결됨(resolved)"
 * - x, y, w, h: 구체적 숫자 (fill, hug 없음)
 * - 색상: HEX/rgba (시맨틱 컬러 없음)
 * - opacity, rotate: 그대로 전달
 */
interface IRBase {
  /** 고유 ID (에디터 조작, 연결 참조용) */
  id: string;
  /** 요소 타입 */
  type: IRElementType;
  /** 바운딩 박스 - 항상 존재, 항상 해결됨 */
  bounds: IRBounds;
  /** 변환 */
  transform?: IRTransform;
  /** 스타일 (모든 값 해결됨) */
  style: IRStyle;
  /** 시맨틱 출처 메타데이터 (에디터에서 "어디서 왔는지" 추적용) */
  origin?: IROrigin;
}

/** 바운딩 박스 - 모든 요소가 반드시 가짐 */
interface IRBounds {
  /** 좌상단 X (0-100) */
  x: number;
  /** 좌상단 Y (0-100) */
  y: number;
  /** 너비 (0-100, 항상 해결된 구체값) */
  w: number;
  /** 높이 (0-100, 항상 해결된 구체값) */
  h: number;
}

/** 변환 */
interface IRTransform {
  /** 회전 (도) */
  rotate?: number;
  /** 투명도 (0-1) */
  opacity?: number;
  /** 블러 */
  blur?: number;
}

/**
 * 시맨틱 출처 정보
 *
 * 컴파일러가 "이 IRContainer는 원래 DSL의 flow 블록이었다"를
 * 기록해두면, 에디터가 이 정보를 활용해서 스마트한 편집 제공 가능.
 * 예: flow 출신이면 노드 추가 시 자동 재배치, 연결선 자동 생성
 *
 * 에디터에서 자유 편집으로 전환하면 origin을 제거 → 순수 IR이 됨
 */
interface IROrigin {
  /** 원래 DSL 프리미티브 타입 */
  sourceType: 'flow' | 'stack' | 'grid' | 'tree' | 'group' | 'layers' | 'canvas';
  /** 원래 DSL에서의 속성들 (재컴파일 시 활용) */
  sourceProps?: Record<string, unknown>;
}
```

### Shape (도형)

```typescript
/**
 * IRShape - rect, circle, ellipse, diamond, pill, hexagon 등 모든 도형
 *
 * 현재: RectObject, CircleObject, EllipseObject 각각 다른 인터페이스
 * IR: 하나의 IRShape, shape 속성으로 구분
 *
 * 렌더러에게 "이 바운딩 박스 안에 이 모양을 그려라"
 */
interface IRShape extends IRBase {
  type: 'shape';
  /** 도형 종류 */
  shape: 'rect' | 'circle' | 'ellipse' | 'diamond' | 'pill'
       | 'hexagon' | 'triangle' | 'parallelogram';
  /** 모서리 반지름 (rect 계열에서만 유효) */
  cornerRadius?: number | { tl: number; tr: number; br: number; bl: number };
  /** 내부 텍스트 (해결됨) */
  innerText?: IRInnerText;
}

interface IRInnerText {
  content: string;
  color: string;          // 해결된 HEX
  fontSize: number;       // 해결된 절대값
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
}
```

### Text

```typescript
/**
 * IRText - 독립 텍스트 요소
 */
interface IRText extends IRBase {
  type: 'text';
  content: string;
  fontSize: number;         // 해결된 절대값 (상대값 아님, 캔버스 기준 비율)
  color: string;            // 해결된 HEX
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  lineHeight?: number;
  wrapWidth?: number;       // 해결된 절대값
}
```

### Image

```typescript
interface IRImage extends IRBase {
  type: 'image';
  src: string;
  fit?: 'contain' | 'cover' | 'fill';
  cornerRadius?: number;
}
```

### Line

```typescript
/**
 * IRLine - 직선 (두 점 사이)
 *
 * 복잡한 경로는 IRPath나 IREdge 사용
 */
interface IRLine extends IRBase {
  type: 'line';
  /** 시작점 (0-100 절대 좌표) */
  from: IRPoint;
  /** 끝점 (0-100 절대 좌표) */
  to: IRPoint;
  /** 화살표 */
  arrowStart?: IRArrowType;
  arrowEnd?: IRArrowType;
}

interface IRPoint {
  x: number;
  y: number;
}

type IRArrowType = 'none' | 'triangle' | 'diamond' | 'circle' | 'square'
  | 'open-triangle'     // UML 일반화 (빈 삼각형)
  | 'filled-diamond'    // UML 합성 (채운 다이아몬드)
  | 'open-diamond';     // UML 집합 (빈 다이아몬드)
```

### Path

```typescript
/**
 * IRPath - SVG 경로 (자유 곡선, 다각형 등)
 *
 * 복잡한 커스텀 도형이나 아이콘의 해체(resolved symbol) 결과
 */
interface IRPath extends IRBase {
  type: 'path';
  /** SVG path data (절대 좌표로 변환됨) */
  d: string;
  /** 닫힌 경로 여부 */
  closed?: boolean;
}
```

### Edge (연결선)

```typescript
/**
 * IREdge - 요소 간 연결선
 *
 * 현재 ConnectorObject와의 핵심 차이:
 * - fromId/toId로 "누구를 연결하라"가 아님
 * - 이미 계산된 경로 포인트를 가짐
 * - 렌더러는 포인트를 따라 그리기만 하면 됨
 *
 * 하지만 from/to ID는 유지 → 에디터에서 요소 이동 시 재계산 가능
 */
interface IREdge extends IRBase {
  type: 'edge';
  /** 연결 출발 요소 ID (에디터에서 재계산용) */
  fromId: string;
  /** 연결 도착 요소 ID (에디터에서 재계산용) */
  toId: string;
  /** 연결 앵커 */
  fromAnchor: IRPoint;
  toAnchor: IRPoint;
  /** 계산된 경로 포인트 */
  path: IREdgePath;
  /** 화살표 */
  arrowStart?: IRArrowType;
  arrowEnd?: IRArrowType;
  /** 라벨들 (위치 해결됨) */
  labels?: IREdgeLabel[];
}

/**
 * Edge 경로 - 직선, 꺾은선, 베지어 곡선
 */
type IREdgePath =
  | { type: 'straight' }                                    // fromAnchor → toAnchor 직선
  | { type: 'polyline'; points: IRPoint[] }                 // 꺾은선 (경유점 포함)
  | { type: 'bezier'; controlPoints: IRBezierSegment[] };   // 베지어 곡선

interface IRBezierSegment {
  cp1: IRPoint;   // 제어점 1
  cp2: IRPoint;   // 제어점 2
  end: IRPoint;   // 끝점
}

/**
 * Edge 라벨 - 연결선 위의 텍스트
 *
 * UML의 multiplicity (1..*, 0..12), role name (borrowed, records) 등
 * 위치가 이미 계산되어 있음
 */
interface IREdgeLabel {
  text: string;
  /** 해결된 위치 */
  position: IRPoint;
  /** 라벨 배치 기준 */
  placement: 'start' | 'middle' | 'end' | 'start-above' | 'end-above';
  fontSize: number;
  color: string;
}
```

### Container

```typescript
/**
 * IRContainer - 자식 요소를 포함하는 컨테이너
 *
 * 현재 GroupObject, FrameObject의 통합.
 * 핵심 차이: 레이아웃이 이미 해결됨.
 *
 * - 현재 Frame: { direction: 'row', gap: 5, children: [...] }
 *   → 렌더러가 row 레이아웃 계산해야 함
 *
 * - IR Container: { children: [{ bounds: {x:10, y:5, w:25, h:40} }, ...] }
 *   → 자식의 위치가 이미 계산됨, 렌더러는 그리기만
 *
 * 단, 에디터에서 자식 추가/제거 시 재배치가 필요할 수 있으므로
 * origin에 원래 레이아웃 정보를 보존
 */
interface IRContainer extends IRBase {
  type: 'container';
  /** 자식 요소들 (z-order = 배열 순서) */
  children: IRElement[];
  /** 클리핑 (자식이 컨테이너 밖으로 나가는 것을 자름) */
  clip?: boolean;
}
```

### Style

```typescript
/**
 * IRStyle - 모든 값이 해결된 스타일
 *
 * CSS-like 속성명 사용하되, 값은 모두 구체적.
 * "primary", "md", "lg" 같은 시맨틱 토큰은 여기 없음.
 */
interface IRStyle {
  /** 배경색/그라데이션 (해결된 HEX) */
  fill?: string | IRGradient;
  /** 테두리색 (해결된 HEX) */
  stroke?: string | IRGradient;
  /** 테두리 두께 */
  strokeWidth?: number;
  /** 점선 패턴 */
  dashPattern?: number[];
  /** 그림자 */
  shadow?: IRShadow;
}

interface IRGradient {
  type: 'linear' | 'radial';
  angle?: number;
  cx?: number;
  cy?: number;
  stops: { position: number; color: string }[];
}

interface IRShadow {
  offsetX: number;
  offsetY: number;
  blur: number;
  color: string;
}

interface IRBackground {
  type: 'solid' | 'linear-gradient' | 'radial-gradient';
  color?: string;
  angle?: number;
  cx?: number;
  cy?: number;
  stops?: { position: number; color: string }[];
}
```

### Transition

```typescript
/** 씬 전환 (현재와 거의 동일, 이미 저수준) */
interface IRTransition {
  from: string;
  to: string;
  type: 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down'
      | 'zoom-in' | 'zoom-out';
  duration: number;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}
```

---

## Compiler: DSL → IR 변환

### 컴파일러 파이프라인

```
DSL 텍스트
    ↓
  Parse (텍스트 → AST)
    ↓
  Resolve Theme (시맨틱 컬러/토큰 → 구체값)
    ↓
  Layout (flow/stack/grid/tree → 절대 좌표)
    ↓
  Route Edges (연결선 경로 계산)
    ↓
  Emit IR (최종 DepixIR JSON 출력)
```

### 각 단계의 책임

#### 1. Parse
```
DSL 텍스트 → AST (Abstract Syntax Tree)

flow direction:right {
  node "A" #a
  node "B" #b
  #a -> #b "라벨"
}

→ {
    type: 'flow',
    props: { direction: 'right' },
    children: [
      { type: 'node', label: 'A', id: 'a' },
      { type: 'node', label: 'B', id: 'b' },
    ],
    edges: [
      { from: 'a', to: 'b', label: '라벨' }
    ]
  }
```

#### 2. Resolve Theme
```
시맨틱 값 → 구체값

color: primary     →  color: '#3b82f6'
color: danger      →  color: '#ef4444'
gap: md            →  gap: 3 (상대값)
shadow: lg         →  shadow: { offsetX: 0, offsetY: 4, blur: 12, color: 'rgba(0,0,0,0.15)' }
font-size: xl      →  fontSize: 3.2 (캔버스 기준 배율)
```

테마 정의 예시:
```typescript
const lightTheme: DepixTheme = {
  colors: {
    primary: '#3b82f6',
    secondary: '#6b7280',
    accent: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4',
    muted: '#9ca3af',
    background: '#ffffff',
    foreground: '#1f2937',
    border: '#e5e7eb',
  },
  spacing: {
    xs: 1, sm: 2, md: 3, lg: 5, xl: 8,
  },
  fontSize: {
    xs: 0.6, sm: 0.8, md: 1.0, lg: 1.4, xl: 1.8, '2xl': 2.4, '3xl': 3.2,
  },
  shadow: {
    sm: { offsetX: 0, offsetY: 1, blur: 3, color: 'rgba(0,0,0,0.1)' },
    md: { offsetX: 0, offsetY: 2, blur: 6, color: 'rgba(0,0,0,0.12)' },
    lg: { offsetX: 0, offsetY: 4, blur: 12, color: 'rgba(0,0,0,0.15)' },
  },
  radius: {
    sm: 0.5, md: 1, lg: 2, full: 50,
  },
  // 자동 배치 시 기본 노드 스타일
  node: {
    fill: '#ffffff',
    stroke: '#e5e7eb',
    strokeWidth: 1,
    cornerRadius: 1,
    shadow: 'sm',
    padding: 2,
    minWidth: 12,
    minHeight: 8,
  },
  // 자동 배치 시 기본 edge 스타일
  edge: {
    stroke: '#6b7280',
    strokeWidth: 0.3,
    arrowEnd: 'triangle',
  },
};
```

#### 3. Layout

각 시맨틱 프리미티브의 레이아웃 알고리즘:

**flow:**
```
입력: nodes[], edges[], direction
알고리즘:
  1. 토폴로지 정렬 (방향 기반)
  2. 레이어 할당 (Sugiyama 스타일 또는 간소화 버전)
  3. 레이어 내 순서 최적화 (교차 최소화)
  4. 각 노드에 bounds 할당
  5. edge 경로 계산은 다음 단계에서
출력: IRContainer + IRShape[] + IREdge[]
```

**stack:**
```
입력: children[], direction, gap, align
알고리즘:
  1. 자식 크기 계산 (hug → 내용 크기, fill → 남은 공간 분배)
  2. direction에 따라 순차 배치
  3. cross-axis 정렬 적용
출력: IRContainer + children (bounds 해결됨)
```

**grid:**
```
입력: children[], cols, gap
알고리즘:
  1. 행/열 수 계산
  2. 셀 크기 = (전체 - gap) / cols
  3. 각 셀에 자식 배치
출력: IRContainer + children (bounds 해결됨)
```

**tree:**
```
입력: root node, direction
알고리즘:
  1. 트리 깊이/너비 계산
  2. Reingold-Tilford 또는 간소화 알고리즘
  3. 부모-자식 연결선 생성
출력: IRContainer + IRShape[] + IREdge[]
```

#### 4. Route Edges
```
입력: edge 정의 (from, to), 모든 요소의 bounds
알고리즘:
  1. from/to 앵커 포인트 결정 (자동 또는 힌트)
  2. 장애물 회피 경로 계산 (A* 또는 orthogonal routing)
  3. 경로를 polyline 또는 bezier로 출력
  4. 라벨 위치 계산
출력: IREdge[] (path, labels 모두 해결됨)
```

#### 5. Emit IR
```
모든 결과를 DepixIR JSON으로 조합
ID 생성, z-order 결정, 최종 검증
```

---

## 에디터와 IR의 관계

### 에디터가 IR을 직접 조작하는 방식

```typescript
// 요소 이동 → bounds 변경
function moveElement(ir: DepixIR, elementId: string, dx: number, dy: number) {
  const el = findElement(ir, elementId);
  el.bounds.x += dx;
  el.bounds.y += dy;

  // origin이 있으면 (시맨틱 컨테이너 출신) 연결된 edge 재계산
  if (el.origin) {
    recalculateConnectedEdges(ir, elementId);
  }
}

// 새 요소 추가 → IR에 직접 삽입
function addElement(scene: IRScene, element: IRElement) {
  scene.elements.push(element);
}

// 시맨틱 컨테이너 "해체" → origin 제거
function detachFromLayout(container: IRContainer) {
  delete container.origin;
  // 이제 자식들은 자유 배치, 레이아웃 규칙 무시
}
```

### 에디터에서 시맨틱 구조 활용

```typescript
// flow 출신 컨테이너에 노드 추가 시
function addNodeToFlow(container: IRContainer, newNode: IRShape) {
  if (container.origin?.sourceType === 'flow') {
    // 원래 flow 속성으로 재컴파일
    const flowProps = container.origin.sourceProps;
    container.children.push(newNode);
    // 레이아웃 재계산
    recompileFlow(container, flowProps);
  } else {
    // 일반 컨테이너 → 그냥 추가
    container.children.push(newNode);
  }
}
```

---

## 저장 포맷

### TipTap 노드에 저장

```typescript
// 마크다운 코드 블럭에는 DSL 텍스트 (선택적, 역변환 가능 시)
// TipTap node data에는 DepixIR JSON
{
  type: 'depixBlock',
  attrs: {
    ir: DepixIR,           // 실제 렌더링/편집 데이터
    dsl?: string,          // 원본 DSL (참고용, 없을 수 있음)
  }
}
```

### 파일 크기 고려

IR은 DSL보다 큼 (좌표가 모두 풀려있으므로).
하지만 JSON이므로 gzip 압축이 잘 됨.
에디터에서 편집한 결과는 DSL로 역변환 불가할 수 있으므로
IR이 primary 저장 포맷이 되는 것이 맞음.

---

## 마이그레이션 전략

### 현재 DepixDocument → DepixIR 변환

기존 데이터를 버리지 않기 위한 변환기:

```typescript
function convertDocumentToIR(doc: DepixDocument): DepixIR {
  return {
    meta: {
      aspectRatio: doc.aspectRatio,
      background: resolveBackground(doc.background),
      drawingStyle: 'default',
    },
    scenes: doc.scenes.map(scene => ({
      id: scene.id,
      elements: scene.objects.map(obj => convertObject(obj)),
    })),
    transitions: doc.transitions.map(t => ({
      ...t,
      easing: t.easing ?? 'ease-out',
    })),
  };
}

function convertObject(obj: DepixObject): IRElement {
  switch (obj.type) {
    case 'rect':
      return {
        type: 'shape',
        id: obj.id ?? generateId(),
        shape: 'rect',
        bounds: { x: obj.x, y: obj.y, w: resolveSize(obj.w), h: resolveSize(obj.h) },
        style: {
          fill: obj.fill as string,
          stroke: obj.stroke as string,
          strokeWidth: obj.strokeWidth,
        },
        cornerRadius: obj.r,
        innerText: obj.text ? { content: obj.text, color: obj.textColor, ... } : undefined,
      };

    case 'frame':
      // Frame → IRContainer (레이아웃 계산 필요)
      return compileFrame(obj);

    case 'connector':
      // Connector → IREdge (경로 계산 필요)
      return compileConnector(obj, /* 다른 요소들의 bounds 참조 */);

    // ... 나머지 타입들
  }
}
```

---

## 정리: 기존 types.ts와의 대응

| 현재 (types.ts) | IR | 변화 |
|---|---|---|
| `DepixDocument` | `DepixIR` | 구조 유사, 하위 요소가 다름 |
| `Scene` (extends FrameLayoutProps) | `IRScene` | 레이아웃 속성 제거 (해결됨) |
| `RectObject` | `IRShape { shape: 'rect' }` | 통합 |
| `CircleObject` | `IRShape { shape: 'circle' }` | 통합 |
| `EllipseObject` | `IRShape { shape: 'ellipse' }` | 통합 |
| `TextObject` | `IRText` | fontSize 해결됨 |
| `ImageObject` | `IRImage` | 거의 동일 |
| `LineObject` | `IRLine` | from/to 포인트로 통일 |
| `PathObject` | `IRPath` | 거의 동일 |
| `GroupObject` | `IRContainer` | 통합 |
| `FrameObject` | `IRContainer` | 레이아웃 해결됨, origin에 보존 |
| `ConnectorObject` | `IREdge` | 경로 해결됨 |
| `ListObject` | `IRContainer + IRText[]` | 분해 |
| `SymbolObject` | `IRShape` 또는 `IRPath` | 심볼 해체 |
| `SizingValue` ('fill', 'hug') | `number` (항상) | 컴파일러가 해결 |
| 시맨틱 컬러 | HEX | 컴파일러가 해결 |
