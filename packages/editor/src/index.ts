// @depix/editor — Selection, history, handles, guides, IR operations, semantic editing

// Selection
export { SelectionManager } from './selection-manager.js';
export type {
  SelectionState,
  SelectionChangeHandler,
  DragEndHandler,
  TransformEndHandler,
  SelectionManagerOptions,
} from './selection-manager.js';

// History
export { HistoryManager, createPropertyAction, createAddAction, createDeleteAction } from './history-manager.js';
export type {
  HistoryAction,
  HistoryState,
  HistoryChangeHandler,
  HistoryManagerOptions,
} from './history-manager.js';

// Handles
export { HandleManager } from './handles/index.js';
export { getHandleDefinition, isKeepRatioShape } from './handles/index.js';
export type { HandleManagerOptions } from './handles/index.js';
export type { HandleType, HandleDefinition, AnchorName } from './handles/index.js';
export { ALL_ANCHORS, CORNER_ANCHORS } from './handles/index.js';

// Guides
export { SnapCalculator, SnapGuideManager } from './guides/index.js';
export type { SnapPoint, SnapResult, GuideLine, SnapGuideConfig, SnapPointType } from './guides/index.js';
export { DEFAULT_SNAP_CONFIG } from './guides/index.js';

// IR Operations
export {
  moveElement,
  resizeElement,
  addElement,
  removeElement,
  updateStyle,
  updateText,
  reorderElements,
} from './ir-operations.js';
export { recalculateEdge, recalculateConnectedEdges } from './ir-edge-operations.js';

// Semantic editing
export {
  isSemanticContainer,
  getSemanticType,
  addNodeToFlow,
  reorderStackChild,
  addGridCell,
  relayoutContainer,
} from './semantic-editor.js';

// Detach
export { detachFromLayout, detachAll } from './detach.js';

// DSL Mutations
export {
  addScene,
  changeSceneTitle,
  removeScene,
  reorderScenes,
  changeLayout,
  addSlotContent,
  changeSlotBlockType,
  addBlockChild,
  changeElementLabel,
  changeElementType,
  removeElement as removeElementDSL,
  changeElementStyle,
  upsertOverride,
  wrapSlotInBlock,
} from './dsl-mutations.js';
