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
  useMemo,
  useImperativeHandle,
  forwardRef,
  useId,
} from 'react';
import type { DepixIR, IRElement, IRContainer, IRStyle, IRBounds, IRBackground } from '@depix/core';
import { CaretLeft, CaretRight, CornersOut, PencilSimple } from '@phosphor-icons/react';
import { findElement, compile } from '@depix/core';
import { DepixEngine, fitToAspectRatio } from '@depix/engine';
import {
  addElement as irAddElement,
  removeElement as irRemoveElement,
  updateStyle as irUpdateStyle,
  updateText as irUpdateText,
  moveElement as irMoveElement,
} from '@depix/editor';
import type { DepixTheme } from '@depix/core';
import type { ToolType } from './types.js';
import { FloatingToolbar } from './components/FloatingToolbar.js';
import { FloatingPropertyPanel } from './components/FloatingPropertyPanel.js';
import { DepixDSLEditor } from './DepixDSLEditor.js';
import { EditorStoreProvider, useEditorStore, useEditorStoreApi } from './store/editor-store-context.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';

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

  // ---- DSL-first editing props (optional) ----
  /** DSL source text. When provided with onDSLChange, enables DSL-first edit mode. */
  dsl?: string;
  /** Called when DSL text changes via editor actions. */
  onDSLChange?: (dsl: string) => void;
  /** Theme for DSL compilation. */
  dslTheme?: DepixTheme;
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
// IR hit detection helper
// ---------------------------------------------------------------------------

/**
 * Find the deepest IR element (non-edge) at a given IR coordinate point.
 * For containers, recursively checks children first (innermost match wins).
 * Edges are skipped — they are handled by Konva's line-stroke hit detection.
 */
function findIRElementAtPoint(elements: IRElement[], irX: number, irY: number): IRElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.type === 'edge') continue;
    const { x, y, w, h } = el.bounds;
    if (irX >= x && irX <= x + w && irY >= y && irY <= y + h) {
      if (el.type === 'container') {
        const child = findIRElementAtPoint((el as IRContainer).children, irX, irY);
        if (child) return child;
      }
      return el;
    }
  }
  return null;
}

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
  return (
    <EditorStoreProvider>
      <DepixCanvasEditableInner {...props} ref={ref} />
    </EditorStoreProvider>
  );
});

const DepixCanvasEditableInner = forwardRef<
  DepixCanvasEditableRef,
  DepixCanvasEditableProps
>(function DepixCanvasEditableInner(props, ref) {
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
    dsl,
    onDSLChange,
    dslTheme,
  } = props;

  const generatedId = useId();
  const containerId = `depix-editable-${generatedId.replace(/:/g, '')}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<DepixEngine | null>(null);
  const irRef = useRef(ir);
  irRef.current = ir;

  // ---- Store access -------------------------------------------------------

  const storeApi = useEditorStoreApi();
  const isEditing = useEditorStore((s) => s.isEditing);
  const isHovered = useEditorStore((s) => s.isHovered);
  const isFullscreen = useEditorStore((s) => s.isFullscreen);
  const activeTool = useEditorStore((s) => s.activeTool);
  const editDims = useEditorStore((s) => s.editDims);
  const panelPositions = useEditorStore((s) => s.panelPositions);
  const currentSceneIndex = useEditorStore((s) => s.activeSceneIndex);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const managers = useEditorStore((s) => s._managers);

  // ---- DSL mode flag ------------------------------------------------------

  const isDSLMode = !!dsl && !!onDSLChange;

  // ---- Local state (not shared) -------------------------------------------

  const snapshotRef = useRef<DepixIR | null>(null);

  // ---- Internal DSL editing state (isolated from parent) -----------------
  // During editing, mutations update editingDsl only.
  // Parent's onDSLChange is called only on confirm.
  const [editingDsl, setEditingDsl] = useState<string | null>(null);

  /** Compile editingDsl to IR for canvas rendering during editing. */
  const editingIR = useMemo(() => {
    if (editingDsl === null) return null;
    try {
      const result = compile(editingDsl, { theme: dslTheme });
      return result.ir;
    } catch (e) {
      console.error('[depix] editingIR compile failed', e);
      return null;
    }
  }, [editingDsl, dslTheme]);

  /** IR to render: internal editingIR during DSL editing, otherwise parent's ir prop. */
  const renderIR = (isEditing && isDSLMode && editingIR) ? editingIR : ir;

  // ---- Fullscreen editing dimensions ------------------------------------

  /** Compute canvas size to fit within 80% of viewport, preserving aspect ratio. */
  const computeEditDims = useCallback((aspectRatio: { width: number; height: number }) => {
    const maxW = window.innerWidth * 0.8;
    const maxH = window.innerHeight * 0.8;
    const ar = aspectRatio.width / aspectRatio.height;
    let w: number, h: number;
    if (maxW / maxH > ar) {
      h = maxH;
      w = maxH * ar;
    } else {
      w = maxW;
      h = maxW / ar;
    }
    return { width: Math.floor(w), height: Math.floor(h) };
  }, []);

  /** Effective canvas size: enlarged when editing, original otherwise. */
  const effectiveWidth = editDims?.width ?? width;
  const effectiveHeight = editDims?.height ?? height;

  // ---- Internal tool state (used only in self-managed edit mode) ----------

  const internalTool = activeTool;
  const setInternalTool = storeApi.getState().setActiveTool;
  const tool = toolProp ?? internalTool;

  // ---- Scene helpers ------------------------------------------------------

  const setCurrentSceneIndex = storeApi.getState().setActiveSceneIndex;

  // ---- Manager refs (convenience accessors from store) --------------------

  const selectionRef = useRef(managers.selection);
  const historyRef = useRef(managers.history);
  const handleRef = useRef(managers.handle);
  const snapRef = useRef(managers.snap);

  // Keep refs in sync with store
  selectionRef.current = managers.selection;
  historyRef.current = managers.history;
  handleRef.current = managers.handle;
  snapRef.current = managers.snap;

  // ---- Derived edit-active flag ------------------------------------------

  /** True when editing functionality is active (self-managed or external tool). */
  const isEditActive = isEditing || !!toolProp;

  // ---- Konva overlay refs (created only in edit mode) --------------------

  const overlayLayerRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);

  // ---- Initialize managers on mount via store ----------------------------

  useEffect(() => {
    storeApi.getState()._initManagers(onSelectionChange);

    // Set initial edit mode if requested
    if (initialEditMode) {
      const ar = ir.meta.aspectRatio ?? { width: 16, height: 9 };
      storeApi.getState().enterEditMode(computeEditDims(ar));
    }

    return () => {
      storeApi.getState()._destroyManagers();
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
    engine.update(renderIR);
  }, [renderIR]);

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

      const shiftKey = e.evt?.shiftKey ?? false;

      // Step 1: Konva walk-up — reliable ONLY for edges (line stroke hit detection)
      const target = e.target;
      if (target && target !== stage) {
        let node = target;
        while (node && node !== stage) {
          const id = typeof node.id === 'function' ? node.id() : node.id;
          if (id && typeof id === 'string' && id.startsWith('el-')) {
            const element = irRef.current ? findElement(irRef.current, id) : null;
            if (element?.type === 'edge') {
              selectionRef.current?.select(id, shiftKey);
              return;
            }
            break; // non-edge el- found — fall through to IR detection
          }
          node = node.parent;
        }
      }

      // Step 2: IR coordinate-based hit detection for shapes/containers/text
      const container = containerRef.current;
      const engine = engineRef.current;
      if (!container || !engine) return;

      const nativeEvent = e.evt as MouseEvent | undefined;
      if (!nativeEvent) return;

      const rect = container.getBoundingClientRect();
      const pixelX = nativeEvent.clientX - rect.left;
      const pixelY = nativeEvent.clientY - rect.top;
      const irPoint = engine.getTransform().toRelativePoint(pixelX, pixelY);

      const sceneIdx = storeApi.getState().activeSceneIndex;
      const scene = irRef.current?.scenes[sceneIdx];
      if (!scene) return;

      const hit = findIRElementAtPoint(scene.elements, irPoint.x, irPoint.y);
      if (hit) {
        selectionRef.current?.select(hit.id, shiftKey);
      } else {
        const currentIds = storeApi.getState().selectedIds;
        if (currentIds.length > 0) {
          selectionRef.current?.clearSelection();
        } else {
          // Nothing hit and nothing selected → select root layout container
          const rootEl = scene.elements.find((el) => el.type === 'container');
          if (rootEl) selectionRef.current?.select(rootEl.id, false);
        }
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

      const transformer = new K.Transformer(isDSLMode ? {
        // DSL mode: border-only, no handles
        borderStroke: '#3b82f6',
        borderStrokeWidth: 1.5,
        borderDash: [4, 4],
        enabledAnchors: [],
        rotateEnabled: false,
        resizeEnabled: false,
      } : {
        // Freeform mode: full handles
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
  }, [isEditing, toolProp, isDSLMode]);

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

    // Configure Transformer based on mode
    if (isDSLMode) {
      // DSL mode: border-only selection indicator, no manipulation
      transformer.enabledAnchors([]);
      transformer.rotateEnabled(false);
      transformer.resizeEnabled(false);
    } else {
      // Freeform mode: configure from HandleManager definition
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

  useKeyboardShortcuts({
    enabled: !readOnly && (isEditing || !!toolProp),
    onUndo: useCallback(() => historyRef.current?.undo(), []),
    onRedo: useCallback(() => historyRef.current?.redo(), []),
    onDelete: useCallback(() => {
      const selection = selectionRef.current;
      if (!selection) return;
      const ids = selection.getSelectedIds();
      if (ids.length === 0) return;
      let currentIR = ir;
      for (const id of ids) currentIR = irRemoveElement(currentIR, id);
      selection.clearSelection();
      onIRChange(currentIR);
    }, [ir, onIRChange]),
    onSelectAll: useCallback(() => {
      const scene = ir.scenes[currentSceneIndex];
      if (!scene) return;
      const allIds = scene.elements.map((el) => el.id);
      selectionRef.current?.selectMultiple(allIds);
    }, [ir, currentSceneIndex]),
    onEscape: useCallback(() => {
      if (isEditing && !toolProp) handleCancel();
    }, [isEditing, toolProp]),
  });

  // ---- Fullscreen management ----------------------------------------------

  useEffect(() => {
    const onChange = () => {
      storeApi.getState().setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [storeApi]);

  const enterFullscreen = useCallback(() => {
    containerRef.current?.parentElement?.requestFullscreen();
  }, []);

  // ---- Fullscreen keyboard navigation ------------------------------------

  useEffect(() => {
    if (!isFullscreen || isEditing) return;

    const handleKey = (e: KeyboardEvent) => {
      const idx = storeApi.getState().activeSceneIndex;
      switch (e.key) {
        case ' ':
        case 'ArrowRight':
          e.preventDefault();
          storeApi.getState().setActiveSceneIndex(Math.min(ir.scenes.length - 1, idx + 1));
          break;
        case 'Backspace':
        case 'ArrowLeft':
          e.preventDefault();
          storeApi.getState().setActiveSceneIndex(Math.max(0, idx - 1));
          break;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFullscreen, isEditing, ir.scenes.length, storeApi]);

  // ---- Lock body scroll while editing (prevent background scroll) ---------

  useEffect(() => {
    if (!isEditing) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isEditing]);

  // ---- Recompute editing dimensions on window resize ----------------------

  useEffect(() => {
    if (!isEditing) return;

    const handleResize = () => {
      const ar = ir.meta.aspectRatio ?? { width: 16, height: 9 };
      storeApi.getState().setEditDims(computeEditDims(ar));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isEditing, ir.meta.aspectRatio, computeEditDims, storeApi]);

  // ---- Edit mode management ----------------------------------------------

  const enterEditMode = useCallback(() => {
    snapshotRef.current = structuredClone(ir);
    if (isDSLMode) {
      setEditingDsl(dsl!);
    }
    const ar = ir.meta.aspectRatio ?? { width: 16, height: 9 };
    storeApi.getState().enterEditMode(computeEditDims(ar));
    onEditModeChange?.(true);
  }, [ir, onEditModeChange, isDSLMode, dsl, computeEditDims, storeApi]);

  const handleConfirm = useCallback(() => {
    // Commit DSL edits to parent (only time onDSLChange is called)
    if (isDSLMode && editingDsl !== null) {
      onDSLChange!(editingDsl);
      if (editingIR) onIRChange(editingIR);
    }
    snapshotRef.current = null;
    setEditingDsl(null);
    storeApi.getState().exitEditMode();
    selectionRef.current?.clearSelection();
    onEditModeChange?.(false);
  }, [onEditModeChange, isDSLMode, editingDsl, editingIR, onDSLChange, onIRChange, storeApi]);

  const handleCancel = useCallback(() => {
    // Discard edits — parent state is unchanged
    if (!isDSLMode && snapshotRef.current) {
      // Freeform mode: restore IR snapshot
      onIRChange(snapshotRef.current);
    }
    snapshotRef.current = null;
    setEditingDsl(null);
    storeApi.getState().exitEditMode();
    selectionRef.current?.clearSelection();
    onEditModeChange?.(false);
  }, [onIRChange, onEditModeChange, isDSLMode, storeApi]);

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
    storeApi.getState().setActiveSceneIndex(newIR.scenes.length - 1);
  }, [ir, onIRChange, storeApi]);

  const handleDeleteScene = useCallback(
    (index: number) => {
      if (ir.scenes.length <= 1) return;
      const newIR = structuredClone(ir);
      newIR.scenes.splice(index, 1);
      onIRChange(newIR);
      const idx = storeApi.getState().activeSceneIndex;
      if (idx >= newIR.scenes.length) {
        storeApi.getState().setActiveSceneIndex(newIR.scenes.length - 1);
      }
    },
    [ir, onIRChange, storeApi],
  );

  // ---- Scene navigation (read-mode pill) ----------------------------------

  const goToPrevScene = useCallback(() => {
    const idx = storeApi.getState().activeSceneIndex;
    storeApi.getState().setActiveSceneIndex(Math.max(0, idx - 1));
  }, [storeApi]);

  const goToNextScene = useCallback(() => {
    const idx = storeApi.getState().activeSceneIndex;
    storeApi.getState().setActiveSceneIndex(Math.min(ir.scenes.length - 1, idx + 1));
  }, [ir.scenes.length, storeApi]);

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

  useEffect(() => {
    if (!showEditUI) {
      storeApi.getState().setPanelPositions(null);
      return;
    }

    const updatePositions = () => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      storeApi.getState().setPanelPositions({
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
  }, [showEditUI, storeApi]);

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
      onMouseEnter={() => storeApi.getState().setIsHovered(true)}
      onMouseLeave={() => storeApi.getState().setIsHovered(false)}
    >
      {/* Dimmed backdrop (only in edit mode) */}
      {isEditing && (
        <div
          key="backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            zIndex: 9998,
          }}
        />
      )}

      {/* Canvas container — CSS changes from in-flow to fixed-centered when editing */}
      <div
        key="canvas-container"
        ref={containerRef}
        style={isEditing ? {
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: effectiveWidth,
          height: effectiveHeight,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        } : {
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
                      <CaretLeft size={14} weight="bold" />
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
                      <CaretRight size={14} weight="bold" />
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
                  <CornersOut size={16} weight="bold" />
                </button>
                <button
                  type="button"
                  style={pillIconBtnStyle}
                  onClick={enterEditMode}
                  title="Edit"
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <PencilSimple size={16} weight="bold" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit mode: DSL-first overlay OR freeform panels */}
      {showEditUI && isDSLMode && editingDsl !== null && panelPositions && (
        <DepixDSLEditor
          dsl={editingDsl}
          onDSLChange={setEditingDsl}
          ir={editingIR}
          theme={dslTheme}
          width={effectiveWidth}
          height={effectiveHeight}
          panelPositions={panelPositions}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      {showEditUI && !isDSLMode && showToolbar && panelPositions && (
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
            zIndex: 10000,
          }}
          draggable
        />
      )}

      {showEditUI && !isDSLMode && showPropertyPanel && panelPositions && (
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
          onSceneChange={storeApi.getState().setActiveSceneIndex}
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
            zIndex: 10000,
          }}
          draggable
        />
      )}
    </div>
  );
});
