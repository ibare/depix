# @depix/engine

Depix IR을 Konva 캔버스에 렌더링하는 엔진 패키지.

## 설치

```bash
pnpm add @depix/engine konva
```

## 사용법

### 기본 렌더링

```ts
import { compile } from '@depix/core';
import { DepixEngine } from '@depix/engine';

const { ir } = compile(dsl);
const engine = new DepixEngine({
  container: 'canvas-container',
  width: 800,
  height: 450,
});

engine.render(ir);
```

### PNG 내보내기

```ts
import { renderIRToPNG } from '@depix/engine';

const { dataUrl } = await renderIRToPNG(ir, { width: 1920, height: 1080 });
```

### 좌표 변환

```ts
import { CoordinateTransform } from '@depix/engine';

const transform = new CoordinateTransform(
  { width: 800, height: 450 },    // viewport
  { width: 100, height: 100 },     // IR 좌표계 (0-100)
);

const screenPos = transform.toScreen({ x: 50, y: 50 });
const irPos = transform.toIR({ x: 400, y: 225 });
```

### 아이콘 레지스트리

```ts
const registry = engine.getRegistry();

// 커스텀 아이콘 등록
registry.register('my-icon', {
  svgPath: 'M12 2L2 7l10 5 10-5-10-5z',
  viewBox: '0 0 24 24',
});
```

## 주요 export

| 카테고리 | export |
|----------|--------|
| 엔진 | `DepixEngine`, `DepixEngineOptions` |
| 렌더링 | `renderElement`, `renderElements` |
| 좌표 | `CoordinateTransform`, `fitToAspectRatio` |
| PNG | `renderIRToPNG`, `renderSceneToPNG` |
| 레지스트리 | `ShapeRegistry`, `collectShapeIds`, `loadRegistryIndex`, `resolveShapes` |
| 핸들 | `NodeHandle`, `StageHandle`, `LayerHandle` |

## 의존성

- `@depix/core` — IR 타입, 컴파일러
- `konva` (peer) — 캔버스 렌더링 엔진
