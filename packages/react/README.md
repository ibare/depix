# @depix/react

Depix의 React 통합 패키지. 캔버스 컴포넌트, 에디터 UI, 훅, TipTap 직렬화, Zustand 스토어를 포함한다.

## 설치

```bash
pnpm add @depix/react @depix/core @depix/editor @depix/engine react react-dom konva react-konva
```

## 사용법

### 읽기 전용 캔버스

```tsx
import { DepixCanvas } from '@depix/react';

<DepixCanvas data={dsl} width={800} height={450} />
```

### 편집 가능한 캔버스 (DSL-first 모드)

```tsx
import { useState, useEffect } from 'react';
import { compile } from '@depix/core';
import { DepixCanvasEditable } from '@depix/react';

function Editor() {
  const [dsl, setDsl] = useState(initialDsl);
  const [ir, setIr] = useState(() => compile(initialDsl).ir);

  useEffect(() => {
    setIr(compile(dsl).ir);
  }, [dsl]);

  return (
    <DepixCanvasEditable
      ir={ir}
      onIRChange={setIr}
      width={800}
      height={450}
      dsl={dsl}
      onDSLChange={setDsl}
    />
  );
}
```

### DSL 에디터 (통합 UI)

```tsx
import { DepixDSLEditor } from '@depix/react';

<DepixDSLEditor
  dsl={dsl}
  onDSLChange={setDsl}
  width={800}
  height={450}
/>
```

### TipTap 통합

```ts
import { serializeDepixBlock, parseDepixBlock, hasDepixBlocks } from '@depix/react';

// TipTap 문서에서 Depix 블록 감지
if (hasDepixBlocks(tiptapDoc)) {
  const blocks = parseAllDepixBlocks(tiptapDoc);
}
```

## 주요 export

| 카테고리 | export |
|----------|--------|
| 캔버스 | `DepixCanvasEditable`, `DepixDSLEditor` |
| 컨텍스트 | `DepixProvider`, `useDepixContext` |
| 훅 | `useDraggable`, `useKeyboardShortcuts`, `useObjectCreation` |
| UI 컴포넌트 | `SymbolPicker`, `SceneStrip`, `LayoutPicker`, `SlotOverlay`, `EditorPropertyPanel` |
| 속성 패널 | `ObjectTab`, `LayersTab`, `CanvasTab`, `SceneTab` |
| 속성 컨트롤 | `ColorInput`, `NumberInput`, `SliderInput`, `SelectInput`, `TextInput` |
| 스토어 | `createEditorStore`, `EditorStoreProvider`, `useEditorStore`, `useSelectedElements` |
| TipTap | `serializeDepixBlock`, `parseDepixBlock`, `hasDepixBlocks` |
| 아이콘 | `SelectIcon`, `RectIcon`, `CircleIcon`, `TextIcon`, `LineIcon` 등 |

## 의존성

- `@depix/core`, `@depix/engine`, `@depix/editor` — 핵심 패키지
- `react`, `react-dom` (peer) — React 프레임워크
- `konva`, `react-konva` (peer) — 캔버스 렌더링
- `zustand` — 상태 관리
- `immer` — 불변 상태 업데이트
