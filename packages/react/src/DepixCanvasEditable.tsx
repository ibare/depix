/**
 * DepixCanvasEditable
 *
 * An editable canvas component for the Depix editor.
 * Extends the rendering capabilities of DepixCanvas with selection,
 * undo/redo history, handle management, and snap guides.
 *
 * Supports two modes:
 * - **Read mode** (default): Canvas only, hover shows "Edit" button
 * - **Edit mode**: Full editor with FloatingToolbar + FloatingPropertyPanel
 *
 * This is a **controlled** component: the parent owns the IR and is
 * notified of changes via `onIRChange`. The component manages internal
 * editing state (selection, history, handles, guides) and exposes an
 * imperative ref API for programmatic control.
 *
 * When in edit mode, a snapshot of the IR is taken on entry.
 * "Done" commits the changes, "Cancel" restores the snapshot.
 */

import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  useImperativeHandle,
  forwardRef,
  useId,
} from 'react';
import type { DepixIR, IRElement, IRStyle, IRBounds, IRBackground } from '@depix/core';
import { findElement } from '@depix/core';
import { DepixEngine, fitToAspectRatio } from '@depix/engine';
import {
  SelectionManager,
  HistoryManager,
  HandleManager,
  SnapGuideManager,
  addElement as irAddElement,
  removeElement as irRemoveElement,
  updateStyle as irUpdateStyle,
  updateText as irUpdateText,
  moveElement as irMoveElement,
} from '@depix/editor';
import type { ToolType } from './types.js';
import { FloatingToolbar } from './components/FloatingToolbar.js';
import { FloatingPropertyPanel } from './components/FloatingPropertyPanel.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DepixCanvasEditableProps {
  /** The IR document to render and edit (controlled). */
  ir: DepixIR;
  /** Called when the IR changes due to editing operations. */
  onIRChange: (ir: DepixIR) => void;
  /** Called when element selection changes. */
  onSelectionChange?: (selectedIds: string[]) => void;
  /** Currently active tool. Default: 'select'. */
  tool?: ToolType;
  /** When true, disables all editing interactions. */
  readOnly?: boolean;
  /** CSS class name. */
  className?: string;
  /** CSS style. */
  style?: React.CSSProperties;
  /** Initial width in pixels. Default: 800 */
  width?: number;
  /** Initial height in pixels. Default: 450 */
  height?: number;

  // ---- Edit mode props ----
  /** Whether to start in edit mode. Default: false */
  initialEditMode?: boolean;
  /** Position of the edit button in read mode. Default: 'top-right' */
  editButtonPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Callback when edit mode changes. */
  onEditModeChange?: (editing: boolean) => void;
  /** Whether to show the toolbar in edit mode. Default: true */
  showToolbar?: boolean;
  /** Whether to show the property panel in edit mode. Default: true */
  showPropertyPanel?: boolean;
  /** Show debug overlay with element bounding boxes. Default: false */
  debug?: boolean;
}

export interface DepixCanvasEditableRef {
  /** Undo the last action. */
  undo: () => void;
  /** Redo the last undone action. */
  redo: () => void;
  /** Whether undo is available. */
  canUndo: boolean;
  /** Whether redo is available. */
  canRedo: boolean;
  /** Select all elements in the current scene. */
  selectAll: () => void;
  /** Clear the current selection. */
  clearSelection: () => void;
  /** Delete the currently selected elements. */
  deleteSelected: () => void;
  /** Get the selected IR elements. */
  getSelectedElements: () => IRElement[];
  /** Add an element to the first scene. */
  addElement: (element: IRElement) => void;
  /** Remove an element by ID. */
  removeElement: (id: string) => void;
  /** Get the underlying DepixEngine instance. */
  getEngine: () => DepixEngine | null;
}

// ---------------------------------------------------------------------------
// Edit button position map
// ---------------------------------------------------------------------------

const OVERLAY_PILL_POSITIONS: Record<string, React.CSSProperties> = {
  'top-left': { top: '8px', left: '8px' },
  'top-right': { top: '8px', right: '8px' },
  'bottom-left': { bottom: '8px', left: '8px' },
  'bottom-right': { bottom: '8px', right: '8px' },
};

const overlayPillStyle: React.CSSProperties = {
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  padding: '4px',
  borderRadius: '10px',
  border: 'none',
  backgroundColor: 'rgba(30,30,30,0.88)',
  opacity: 0,
  transition: 'opacity 0.2s',
  zIndex: 10,
  pointerEvents: 'none',
};

const pillIconBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  borderRadius: '7px',
  border: 'none',
  backgroundColor: 'transparent',
  color: '#ddd',
  cursor: 'pointer',
  padding: 0,
  lineHeight: 0,
  transition: 'background-color 0.15s',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Editable canvas component for the Depix editor.
 */
export const DepixCanvasEditable = forwardRef<
  DepixCanvasEditableRef,
  DepixCanvasEditableProps
>(function DepixCanvasEditable(props, ref) {
  const {
    ir,
    onIRChange,
    onSelectionChange,
    tool: toolProp,
    readOnly = false,
    className,
    style,
    width = 800,
    height = 450,
    initialEditMode = false,
    editButtonPosition = 'bottom-right',
    onEditModeChange,
    showToolbar = true,
    showPropertyPanel = true,
    debug = false,
  } = props;

  const generatedId = useId();
  const containerId = `depix-editable-${generatedId.replace(/:/g, '')}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<DepixEngine | null>(null);

  // ---- Edit mode state ---------------------------------------------------

  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [isHovered, setIsHovered] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const snapshotRef = useRef<DepixIR | null>(null);

  // ---- Internal tool state (used only in self-managed edit mode) ----------

  const [internalTool, setInternalTool] = useState<ToolType>('select');
  const tool = toolProp ?? internalTool;

  // ---- Scene state -------------------------------------------------------

  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);

  // ---- Editor managers (stable across renders) ---------------------------

  const selectionRef = useRef<SelectionManager | null>(null);
  const historyRef = useRef<HistoryManager | null>(null);
  const handleRef = useRef<HandleManager | null>(null);
  const snapRef = useRef<SnapGuideManager | null>(null);

  // ---- Derived edit-active flag ------------------------------------------

  /** True when editing functionality is active (self-managed or external tool). */
  const isEditActive = isEditing || !!toolProp;

  // ---- Selection state for UI updates ------------------------------------

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // ---- History state for re-render triggers ------------------------------

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // ---- Konva overlay refs (created only in edit mode) --------------------

  const overlayLayerRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);

  // ---- Initialize managers on mount --------------------------------------

  useEffect(() => {
    const selection = new SelectionManager({
      onChange: (state) => {
        setSelectedIds(state.selectedIds);
        onSelectionChange?.(state.selectedIds);
      },
    });

    const history = new HistoryManager();
    history.onChange((state) => {
      setCanUndo(state.canUndo);
      setCanRedo(state.canRedo);
    });

    const handle = new HandleManager();
    const snap = new SnapGuideManager();

    selectionRef.current = selection;
    historyRef.current = history;
    handleRef.current = handle;
    snapRef.current = snap;

    return () => {
      selection.destroy();
      history.destroy();
      handle.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Engine lifecycle --------------------------------------------------

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.id = containerId;

    const engine = new DepixEngine({
      container: containerId,
      width,
      height,
    });

    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Update IR when it changes (preserves current scene) ---------------

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.update(ir);
  }, [ir]);

  // ---- Sync debug mode to engine ------------------------------------------

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setDebugMode(debug);
  }, [debug]);

  // ---- Sync scene index to engine ----------------------------------------

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setScene(currentSceneIndex);
  }, [currentSceneIndex]);

  // ---- Canvas click → element selection (via Konva Stage) ----------------
  // Only active when in edit mode — prevents selection in read mode.

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || readOnly || !isEditActive) return;

    let stage: any;
    try {
      stage = engine.getStage();
    } catch {
      return;
    }
    if (!stage || typeof stage.on !== 'function') return;

    const handleStageClick = (e: any) => {
      // Only handle selection when in select mode
      const currentTool = toolProp ?? internalTool;
      if (currentTool !== 'select') return;

      const target = e.target;

      // Click on empty stage → clear selection
      if (target === stage) {
        selectionRef.current?.clearSelection();
        return;
      }

      // Walk up the node tree to find a node with an element ID (starts with 'el-')
      let node = target;
      let elementId: string | null = null;
      while (node && node !== stage) {
        const id = typeof node.id === 'function' ? node.id() : node.id;
        if (id && typeof id === 'string' && id.startsWith('el-')) {
          elementId = id;
          break;
        }
        node = node.parent;
      }

      if (elementId) {
        const shiftKey = e.evt?.shiftKey ?? false;
        selectionRef.current?.select(elementId, shiftKey);
      } else {
        selectionRef.current?.clearSelection();
      }
    };

    stage.on('click', handleStageClick);
    return () => {
      stage.off('click', handleStageClick);
    };
  }, [readOnly, toolProp, internalTool, isEditing]);

  // ---- Responsive resize -------------------------------------------------

  useEffect(() => {
    const container = containerRef.current;
    const engine = engineRef.current;
    if (!container || !engine) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          engine.resize(w, h);
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ---- Konva overlay: create/destroy Transformer on edit mode change ------
  // Uses Konva.Transformer (like the original) instead of manual drawing.
  // Only active when in edit mode.

  useEffect(() => {
    if (!isEditActive) {
      // Teardown on edit mode exit
      if (transformerRef.current) {
        transformerRef.current.nodes([]);
        transformerRef.current.destroy();
        transformerRef.current = null;
      }
      if (overlayLayerRef.current) {
        overlayLayerRef.current.destroy();
        overlayLayerRef.current = null;
      }
      return;
    }

    const engine = engineRef.current;
    if (!engine) return;

    let stage: any;
    try {
      stage = engine.getStage();
    } catch {
      return;
    }
    if (!stage || typeof stage.add !== 'function') return;

    let cancelled = false;

    import('konva').then((mod) => {
      if (cancelled) return;
      const K = mod.default ?? mod;

      const layer = new K.Layer();
      stage.add(layer);

      const transformer = new K.Transformer({
        // Match original Depix style: blue border, white anchors with blue stroke
        borderStroke: '#3b82f6',
        borderStrokeWidth: 1,
        anchorFill: '#ffffff',
        anchorStroke: '#3b82f6',
        anchorStrokeWidth: 2,
        anchorSize: 8,
        anchorCornerRadius: 2,
        keepRatio: false,
        rotateEnabled: true,
        rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
        rotationSnapTolerance: 5,
      });
      layer.add(transformer);

      overlayLayerRef.current = layer;
      transformerRef.current = transformer;
      layer.batchDraw();
    }).catch(() => {
      // Konva not available (test environment)
    });

    return () => {
      cancelled = true;
      if (transformerRef.current) {
        transformerRef.current.nodes([]);
        transformerRef.current.destroy();
        transformerRef.current = null;
      }
      if (overlayLayerRef.current) {
        overlayLayerRef.current.destroy();
        overlayLayerRef.current = null;
      }
    };
  }, [isEditing, toolProp]);

  // ---- Update Transformer nodes when selection changes -------------------
  // Finds rendered Konva nodes by element ID and attaches Transformer.
  // Configures Transformer based on HandleManager definition.

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer || !isEditActive) return;

    const engine = engineRef.current;
    if (!engine) return;

    let stage: any;
    try {
      stage = engine.getStage();
    } catch {
      return;
    }
    if (!stage) return;

    if (selectedIds.length === 0) {
      transformer.nodes([]);
      overlayLayerRef.current?.batchDraw();
      return;
    }

    // Find rendered Konva nodes by element ID
    const nodes: any[] = [];
    for (const id of selectedIds) {
      const node = stage.findOne(`#${id}`);
      if (node) nodes.push(node);
    }

    if (nodes.length === 0) {
      transformer.nodes([]);
      overlayLayerRef.current?.batchDraw();
      return;
    }

    // Configure Transformer from HandleManager definition
    const elements = selectedIds
      .map((id) => findElement(ir, id))
      .filter((el): el is IRElement => el !== undefined);

    handleRef.current?.updateForElements(elements);
    const def = handleRef.current?.getDefinition();

    if (def?.handleType === 'bounding-box') {
      transformer.keepRatio(def.keepRatio ?? false);
      transformer.rotateEnabled(def.rotateEnabled ?? true);
      if (def.enabledAnchors) {
        transformer.enabledAnchors(def.enabledAnchors);
      }
    }

    transformer.nodes(nodes);
    overlayLayerRef.current?.moveToTop();
    overlayLayerRef.current?.batchDraw();
  }, [selectedIds, ir, isEditing, toolProp]);

  // ---- Clear selection when leaving edit mode ----------------------------

  const wasEditActiveRef = useRef(isEditActive);
  useEffect(() => {
    const wasActive = wasEditActiveRef.current;
    wasEditActiveRef.current = isEditActive;

    // Only clear when transitioning from edit → non-edit
    if (wasActive && !isEditActive) {
      selectionRef.current?.clearSelection();
    }
  }, [isEditActive]);

  // ---- Keyboard shortcuts ------------------------------------------------

  useEffect(() => {
    if (readOnly) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when in edit mode (or when tool is externally controlled)
      if (!isEditing && !toolProp) return;

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // Undo: Ctrl+Z
      if (isCtrlOrCmd && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        historyRef.current?.undo();
      }

      // Redo: Ctrl+Shift+Z
      if (isCtrlOrCmd && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        historyRef.current?.redo();
      }

      // Redo: Ctrl+Y (alternative)
      if (isCtrlOrCmd && e.key === 'y') {
        e.preventDefault();
        historyRef.current?.redo();
      }

      // Delete: Delete/Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selection = selectionRef.current;
        if (!selection) return;
        const ids = selection.getSelectedIds();
        if (ids.length === 0) return;

        e.preventDefault();
        let currentIR = ir;
        for (const id of ids) {
          currentIR = irRemoveElement(currentIR, id);
        }
        selection.clearSelection();
        onIRChange(currentIR);
      }

      // Select all: Ctrl+A
      if (isCtrlOrCmd && e.key === 'a') {
        e.preventDefault();
        const scene = ir.scenes[currentSceneIndex];
        if (!scene) return;
        const allIds = scene.elements.map((el) => el.id);
        selectionRef.current?.selectMultiple(allIds);
      }

      // Escape: exit edit mode
      if (e.key === 'Escape' && isEditing && !toolProp) {
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readOnly, ir, onIRChange, isEditing, toolProp, currentSceneIndex]);

  // ---- Fullscreen management ----------------------------------------------

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const enterFullscreen = useCallback(() => {
    containerRef.current?.parentElement?.requestFullscreen();
  }, []);

  // ---- Fullscreen keyboard navigation ------------------------------------

  useEffect(() => {
    if (!isFullscreen || isEditing) return;

    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
        case 'ArrowRight':
          e.preventDefault();
          setCurrentSceneIndex((i) => Math.min(ir.scenes.length - 1, i + 1));
          break;
        case 'Backspace':
        case 'ArrowLeft':
          e.preventDefault();
          setCurrentSceneIndex((i) => Math.max(0, i - 1));
          break;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFullscreen, isEditing, ir.scenes.length]);

  // ---- Edit mode management ----------------------------------------------

  const enterEditMode = useCallback(() => {
    snapshotRef.current = structuredClone(ir);
    setIsEditing(true);
    setInternalTool('select');
    onEditModeChange?.(true);
  }, [ir, onEditModeChange]);

  const handleConfirm = useCallback(() => {
    // Commit: the current ir is already the latest via onIRChange
    snapshotRef.current = null;
    setIsEditing(false);
    selectionRef.current?.clearSelection();
    onEditModeChange?.(false);
  }, [onEditModeChange]);

  const handleCancel = useCallback(() => {
    // Restore snapshot
    if (snapshotRef.current) {
      onIRChange(snapshotRef.current);
      snapshotRef.current = null;
    }
    setIsEditing(false);
    selectionRef.current?.clearSelection();
    onEditModeChange?.(false);
  }, [onIRChange, onEditModeChange]);

  // ---- IR manipulation callbacks -----------------------------------------

  const handleStyleChange = useCallback(
    (id: string, style: Partial<IRStyle>) => {
      const newIR = irUpdateStyle(ir, id, style);
      onIRChange(newIR);
    },
    [ir, onIRChange],
  );

  const handleTextChange = useCallback(
    (id: string, text: string) => {
      const newIR = irUpdateText(ir, id, text);
      onIRChange(newIR);
    },
    [ir, onIRChange],
  );

  const handleBoundsChange = useCallback(
    (id: string, bounds: Partial<IRBounds>) => {
      if (bounds.x !== undefined || bounds.y !== undefined) {
        const el = findElement(ir, id);
        if (el) {
          const dx = bounds.x !== undefined ? bounds.x - el.bounds.x : 0;
          const dy = bounds.y !== undefined ? bounds.y - el.bounds.y : 0;
          const newIR = irMoveElement(ir, id, dx, dy);
          onIRChange(newIR);
        }
      }
    },
    [ir, onIRChange],
  );

  const handleSelectElement = useCallback(
    (id: string, append?: boolean) => {
      selectionRef.current?.select(id, append);
    },
    [],
  );

  const handleAspectRatioChange = useCallback(
    (ratio: { width: number; height: number }) => {
      const newIR = structuredClone(ir);
      newIR.meta.aspectRatio = ratio;
      onIRChange(newIR);
    },
    [ir, onIRChange],
  );

  const handleBackgroundChange = useCallback(
    (bg: IRBackground) => {
      const newIR = structuredClone(ir);
      newIR.meta.background = bg;
      onIRChange(newIR);
    },
    [ir, onIRChange],
  );

  const handleAddScene = useCallback(() => {
    const newIR = structuredClone(ir);
    const newScene = {
      id: `scene-${Date.now()}`,
      elements: [],
      background: { type: 'solid' as const, color: '#ffffff' },
    };
    newIR.scenes.push(newScene);
    onIRChange(newIR);
    setCurrentSceneIndex(newIR.scenes.length - 1);
  }, [ir, onIRChange]);

  const handleDeleteScene = useCallback(
    (index: number) => {
      if (ir.scenes.length <= 1) return;
      const newIR = structuredClone(ir);
      newIR.scenes.splice(index, 1);
      onIRChange(newIR);
      if (currentSceneIndex >= newIR.scenes.length) {
        setCurrentSceneIndex(newIR.scenes.length - 1);
      }
    },
    [ir, onIRChange, currentSceneIndex],
  );

  // ---- Scene navigation (read-mode pill) ----------------------------------

  const goToPrevScene = useCallback(() => {
    setCurrentSceneIndex((i) => Math.max(0, i - 1));
  }, []);

  const goToNextScene = useCallback(() => {
    setCurrentSceneIndex((i) => Math.min(ir.scenes.length - 1, i + 1));
  }, [ir.scenes.length]);

  const handleRenameScene = useCallback(
    (index: number, name: string) => {
      const newIR = structuredClone(ir);
      (newIR.scenes[index] as unknown as { name: string }).name = name;
      onIRChange(newIR);
    },
    [ir, onIRChange],
  );

  // ---- Imperative ref API ------------------------------------------------

  const undo = useCallback(() => {
    historyRef.current?.undo();
  }, []);

  const redo = useCallback(() => {
    historyRef.current?.redo();
  }, []);

  const selectAll = useCallback(() => {
    const scene = ir.scenes[currentSceneIndex];
    if (!scene) return;
    const allIds = scene.elements.map((el) => el.id);
    selectionRef.current?.selectMultiple(allIds);
  }, [ir, currentSceneIndex]);

  const clearSelection = useCallback(() => {
    selectionRef.current?.clearSelection();
  }, []);

  const deleteSelected = useCallback(() => {
    const selection = selectionRef.current;
    if (!selection) return;
    const ids = selection.getSelectedIds();
    if (ids.length === 0) return;

    let currentIR = ir;
    for (const id of ids) {
      currentIR = irRemoveElement(currentIR, id);
    }
    selection.clearSelection();
    onIRChange(currentIR);
  }, [ir, onIRChange]);

  const getSelectedElements = useCallback((): IRElement[] => {
    const selection = selectionRef.current;
    if (!selection) return [];
    return selection.getSelectedElements(ir);
  }, [ir]);

  const addElementFn = useCallback(
    (element: IRElement) => {
      const scene = ir.scenes[currentSceneIndex];
      if (!scene) return;
      const newIR = irAddElement(ir, scene.id, element);
      onIRChange(newIR);
    },
    [ir, onIRChange, currentSceneIndex],
  );

  const removeElementFn = useCallback(
    (id: string) => {
      const newIR = irRemoveElement(ir, id);
      onIRChange(newIR);
    },
    [ir, onIRChange],
  );

  const getEngine = useCallback(() => {
    return engineRef.current;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      undo,
      redo,
      canUndo,
      canRedo,
      selectAll,
      clearSelection,
      deleteSelected,
      getSelectedElements,
      addElement: addElementFn,
      removeElement: removeElementFn,
      getEngine,
    }),
    [
      undo,
      redo,
      canUndo,
      canRedo,
      selectAll,
      clearSelection,
      deleteSelected,
      getSelectedElements,
      addElementFn,
      removeElementFn,
      getEngine,
    ],
  );

  // ---- Derive selected elements for property panel -----------------------

  const selectedElements: IRElement[] = selectedIds
    .map((id) => findElement(ir, id))
    .filter((el): el is IRElement => el !== undefined);

  // ---- Determine if we show edit-mode UI ---------------------------------

  const showEditUI = isEditActive;
  const showReadModeEditButton = !showEditUI && !readOnly && !toolProp && !isFullscreen;

  // ---- Calculate panel positions relative to canvas ----------------------

  const [panelPositions, setPanelPositions] = useState<{
    toolbar: { top: number; left: number };
    panel: { top: number; left: number };
  } | null>(null);

  useEffect(() => {
    if (!showEditUI) {
      setPanelPositions(null);
      return;
    }

    const updatePositions = () => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setPanelPositions({
        toolbar: {
          top: rect.top + 8,
          left: rect.left + 8,
        },
        panel: {
          top: rect.top + 8,
          left: rect.right - 288, // 280px panel + 8px padding
        },
      });
    };

    updatePositions();
    window.addEventListener('scroll', updatePositions, true);
    window.addEventListener('resize', updatePositions);
    return () => {
      window.removeEventListener('scroll', updatePositions, true);
      window.removeEventListener('resize', updatePositions);
    };
  }, [showEditUI]);

  // ---- Render ------------------------------------------------------------

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: style?.width ?? width,
    height: style?.height ?? height,
    ...style,
  };

  return (
    <div
      style={containerStyle}
      className={className}
      data-tool={tool}
      data-readonly={readOnly || undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Canvas container */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        data-tool={tool}
        data-readonly={readOnly || undefined}
      />

      {/* Read mode: overlay buttons — sized to match the fitted canvas */}
      {showReadModeEditButton && (() => {
        const fitted = fitToAspectRatio(width, height, ir.meta.aspectRatio);
        const hasMultipleScenes = ir.scenes.length > 1;
        const sceneName = ir.scenes[currentSceneIndex]?.id ?? `scene-${currentSceneIndex + 1}`;

        return (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <div style={{ position: 'relative', width: fitted.width, height: fitted.height }}>
              <div
                data-edit-button
                style={{
                  ...overlayPillStyle,
                  ...OVERLAY_PILL_POSITIONS[editButtonPosition],
                  opacity: isHovered ? 1 : 0,
                  pointerEvents: isHovered ? 'auto' : 'none',
                }}
              >
                {/* Scene navigation (only when multiple scenes) */}
                {hasMultipleScenes && (
                  <>
                    <button
                      type="button"
                      style={{
                        ...pillIconBtnStyle,
                        opacity: currentSceneIndex > 0 ? 1 : 0.35,
                      }}
                      onClick={goToPrevScene}
                      disabled={currentSceneIndex === 0}
                      title="Previous scene"
                      onMouseEnter={e => { if (currentSceneIndex > 0) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 3L5 8l5 5" />
                      </svg>
                    </button>
                    <span
                      style={{
                        color: '#ddd',
                        fontSize: '12px',
                        fontFamily: 'system-ui, sans-serif',
                        padding: '0 2px',
                        whiteSpace: 'nowrap',
                        userSelect: 'none',
                        maxWidth: '120px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {sceneName}
                    </span>
                    <button
                      type="button"
                      style={{
                        ...pillIconBtnStyle,
                        opacity: currentSceneIndex < ir.scenes.length - 1 ? 1 : 0.35,
                      }}
                      onClick={goToNextScene}
                      disabled={currentSceneIndex === ir.scenes.length - 1}
                      title="Next scene"
                      onMouseEnter={e => { if (currentSceneIndex < ir.scenes.length - 1) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 3l5 5-5 5" />
                      </svg>
                    </button>
                    {/* Divider */}
                    <div
                      style={{
                        width: '1px',
                        height: '18px',
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        margin: '0 2px',
                        flexShrink: 0,
                      }}
                    />
                  </>
                )}
                <button
                  type="button"
                  style={pillIconBtnStyle}
                  onClick={enterFullscreen}
                  title="Fullscreen"
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 6V3a1 1 0 0 1 1-1h3" />
                    <path d="M10 2h3a1 1 0 0 1 1 1v3" />
                    <path d="M14 10v3a1 1 0 0 1-1 1h-3" />
                    <path d="M6 14H3a1 1 0 0 1-1-1v-3" />
                  </svg>
                </button>
                <button
                  type="button"
                  style={pillIconBtnStyle}
                  onClick={enterEditMode}
                  title="Edit"
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11.5 1.5a2.12 2.12 0 0 1 3 3L5 14l-4 1 1-4Z" />
                    <path d="M10 3.5l2.5 2.5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit mode: floating panels */}
      {showEditUI && showToolbar && panelPositions && (
        <FloatingToolbar
          tool={tool}
          onToolChange={toolProp ? (props as any).onToolChange ?? (() => {}) : setInternalTool}
          onUndo={undo}
          onRedo={redo}
          onDelete={deleteSelected}
          canUndo={canUndo}
          canRedo={canRedo}
          hasSelection={selectedIds.length > 0}
          style={{
            position: 'fixed',
            top: `${panelPositions.toolbar.top}px`,
            left: `${panelPositions.toolbar.left}px`,
          }}
          draggable
        />
      )}

      {showEditUI && showPropertyPanel && panelPositions && (
        <FloatingPropertyPanel
          elements={selectedElements}
          onStyleChange={handleStyleChange}
          onTextChange={handleTextChange}
          onBoundsChange={handleBoundsChange}
          ir={ir}
          currentSceneIndex={currentSceneIndex}
          selectedIds={selectedIds}
          onCancel={toolProp ? undefined : handleCancel}
          onConfirm={toolProp ? undefined : handleConfirm}
          onSceneChange={setCurrentSceneIndex}
          onAddScene={handleAddScene}
          onDeleteScene={handleDeleteScene}
          onRenameScene={handleRenameScene}
          onSelectElement={handleSelectElement}
          onAspectRatioChange={handleAspectRatioChange}
          onBackgroundChange={handleBackgroundChange}
          style={{
            position: 'fixed',
            top: `${panelPositions.panel.top}px`,
            left: `${panelPositions.panel.left}px`,
          }}
          draggable
        />
      )}
    </div>
  );
});
