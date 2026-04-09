# @depix/editor

Depix 캔버스의 편집 기능을 제공하는 패키지. 선택, 히스토리, 핸들, 스냅, IR 조작, 시맨틱 편집, DSL 뮤테이션을 포함한다.

## 설치

```bash
pnpm add @depix/editor @depix/core @depix/engine konva
```

## 주요 기능

### 선택 관리

```ts
import { SelectionManager } from '@depix/editor';

const selection = new SelectionManager({
  onChange: (state) => console.log('선택 변경:', state),
});

selection.select('element-id');
selection.toggleSelect('another-id');
selection.clearSelection();
```

### 히스토리 (Undo/Redo)

```ts
import { HistoryManager, createPropertyAction } from '@depix/editor';

const history = new HistoryManager({
  onChange: (state) => console.log('히스토리:', state),
});

history.push(createPropertyAction(element, 'style.fill', oldValue, newValue));
history.undo();
history.redo();
```

### IR 직접 조작

```ts
import { moveElement, resizeElement, updateStyle } from '@depix/editor';

moveElement(ir, 'element-id', { x: 10, y: 20 });
resizeElement(ir, 'element-id', { w: 30, h: 15 });
updateStyle(ir, 'element-id', { fill: '#FF0000' });
```

### DSL 뮤테이션 (DSL-first 모드)

```ts
import { changeLayout, addSlotContent, changeElementLabel } from '@depix/editor';

let dsl = '...';
dsl = changeLayout(dsl, 0, 'header-sidebar');
dsl = addSlotContent(dsl, 0, 'header', 'heading "제목"');
dsl = changeElementLabel(dsl, 0, 0, '새 라벨');
```

### 시맨틱 편집

```ts
import { addNodeToFlow, reorderStackChild, detachFromLayout } from '@depix/editor';

addNodeToFlow(ir, containerId, { label: '새 노드' });
reorderStackChild(ir, containerId, fromIndex, toIndex);
detachFromLayout(ir, containerId);  // 자유 배치로 전환
```

## 주요 export

| 카테고리 | export |
|----------|--------|
| 선택 | `SelectionManager`, `SelectionState` |
| 히스토리 | `HistoryManager`, `createPropertyAction`, `createAddAction`, `createDeleteAction` |
| 핸들 | `HandleManager`, `getHandleDefinition` |
| 스냅 | `SnapCalculator`, `SnapGuideManager`, `DEFAULT_SNAP_CONFIG` |
| IR 조작 | `moveElement`, `resizeElement`, `addElement`, `removeElement`, `updateStyle`, `updateText` |
| 시맨틱 | `addNodeToFlow`, `reorderStackChild`, `addGridCell`, `detachFromLayout`, `detachAll` |
| DSL 뮤테이션 | `changeLayout`, `addSlotContent`, `changeElementLabel`, `changeElementStyle`, `addScene`, `removeScene` |

## 의존성

- `@depix/core` — IR 타입, 컴파일러
- `@depix/engine` — 렌더러, 좌표 변환
- `konva` (peer) — 캔버스 엔진
