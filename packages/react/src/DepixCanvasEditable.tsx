/**
 * DepixCanvasEditable — orchestrates engine lifecycle, edit-mode management,
 * selection, and delegates to extracted sub-modules.
 */

import React, {
  useRef, useEffect, useCallback, useImperativeHandle, forwardRef,
} from 'react';
import type { IRElement } from '@depix/core';
import { fitToAspectRatio } from '@depix/engine';
import { addElement as irAddElement, removeElement as irRemoveElement } from '@depix/editor';
import { DepixDSLEditor } from './DepixDSLEditor.js';
import { EditorStoreProvider, useEditorStore, useEditorStoreApi } from './store/editor-store-context.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import { useCanvasClickHandler } from './hooks/useCanvasClickHandler.js';
import { useKonvaTransformer } from './hooks/useKonvaTransformer.js';
import { useEditableEngine } from './use-editable-engine.js';
import { useEditableMode } from './use-editable-mode.js';
import { ReadModeOverlay } from './ReadModeOverlay.js';
import { computeEditDims } from './editable-styles.js';

export type { DepixCanvasEditableProps, DepixCanvasEditableRef } from './editable-types.js';
import type { DepixCanvasEditableProps, DepixCanvasEditableRef } from './editable-types.js';

/** Editable canvas component for the Depix editor. */
export const DepixCanvasEditable = forwardRef<DepixCanvasEditableRef, DepixCanvasEditableProps>(
  function DepixCanvasEditable(props, ref) {
    return (
      <EditorStoreProvider>
        <DepixCanvasEditableInner {...props} ref={ref} />
      </EditorStoreProvider>
    );
  },
);

const DepixCanvasEditableInner = forwardRef<DepixCanvasEditableRef, DepixCanvasEditableProps>(
  function DepixCanvasEditableInner(props, ref) {
    const {
      ir, onIRChange, onSelectionChange, tool: toolProp, readOnly = false,
      className, style, width = 800, height = 450, initialEditMode = false,
      editButtonPosition = 'bottom-right', onEditModeChange, debug = false,
      dsl, onDSLChange, dslTheme,
    } = props;

    // Store access
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

    const isDSLMode = !!dsl && !!onDSLChange;

    // Manager refs
    const selectionRef = useRef(managers.selection);
    const historyRef = useRef(managers.history);
    const handleRef = useRef(managers.handle);
    const snapRef = useRef(managers.snap);
    selectionRef.current = managers.selection;
    historyRef.current = managers.history;
    handleRef.current = managers.handle;
    snapRef.current = managers.snap;

    // Edit mode (extracted hook)
    const {
      renderIR, editingDsl, setEditingDsl, editingIR,
      enterEditMode, handleConfirm, handleCancel,
    } = useEditableMode({
      ir, onIRChange, isDSLMode, dsl, onDSLChange, dslTheme,
      isEditing, onEditModeChange, storeApi, selectionRef,
    });

    const irRef = useRef(renderIR);
    irRef.current = renderIR;

    // Engine lifecycle (extracted hook)
    const { containerRef, engineRef, enterFullscreen } = useEditableEngine({
      renderIR, width, height, debug, currentSceneIndex,
      isEditing, isFullscreen, totalScenes: ir.scenes.length,
      aspectRatio: ir.meta.aspectRatio, storeApi,
    });

    // Derived state
    const effectiveWidth = editDims?.width ?? width;
    const effectiveHeight = editDims?.height ?? height;
    const tool = toolProp ?? activeTool;
    const isEditActive = isEditing || !!toolProp;

    // Initialize managers on mount
    useEffect(() => {
      storeApi.getState()._initManagers(onSelectionChange);
      if (initialEditMode) {
        const ar = ir.meta.aspectRatio ?? { width: 16, height: 9 };
        storeApi.getState().enterEditMode(computeEditDims(ar));
      }
      return () => { storeApi.getState()._destroyManagers(); };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useCanvasClickHandler({
      engineRef, containerRef, irRef, selectionRef, storeApi,
      toolProp, internalTool: activeTool, isEditing, readOnly,
    });

    useKonvaTransformer({ engineRef, ir, isEditing, toolProp, isDSLMode, selectedIds, handleRef });

    // Clear selection when leaving edit mode
    const wasEditActiveRef = useRef(isEditActive);
    useEffect(() => {
      const wasActive = wasEditActiveRef.current;
      wasEditActiveRef.current = isEditActive;
      if (wasActive && !isEditActive) selectionRef.current?.clearSelection();
    }, [isEditActive]);

    useKeyboardShortcuts({
      enabled: !readOnly && (isEditing || !!toolProp),
      onUndo: useCallback(() => historyRef.current?.undo(), []),
      onRedo: useCallback(() => historyRef.current?.redo(), []),
      onDelete: useCallback(() => {
        const sel = selectionRef.current;
        if (!sel) return;
        const ids = sel.getSelectedIds();
        if (ids.length === 0) return;
        let cur = ir;
        for (const id of ids) cur = irRemoveElement(cur, id);
        sel.clearSelection();
        onIRChange(cur);
      }, [ir, onIRChange]),
      onSelectAll: useCallback(() => {
        const scene = ir.scenes[currentSceneIndex];
        if (scene) selectionRef.current?.selectMultiple(scene.elements.map((el) => el.id));
      }, [ir, currentSceneIndex]),
      onEscape: useCallback(() => {
        if (isEditing && !toolProp) handleCancel();
      }, [isEditing, toolProp, handleCancel]),
    });

    // Scene navigation
    const goToPrevScene = useCallback(() => {
      const idx = storeApi.getState().activeSceneIndex;
      storeApi.getState().setActiveSceneIndex(Math.max(0, idx - 1));
    }, [storeApi]);
    const goToNextScene = useCallback(() => {
      const idx = storeApi.getState().activeSceneIndex;
      storeApi.getState().setActiveSceneIndex(Math.min(ir.scenes.length - 1, idx + 1));
    }, [ir.scenes.length, storeApi]);

    // Imperative ref API
    useImperativeHandle(ref, () => ({
      undo: () => historyRef.current?.undo(),
      redo: () => historyRef.current?.redo(),
      canUndo, canRedo,
      selectAll: () => {
        const scene = ir.scenes[currentSceneIndex];
        if (scene) selectionRef.current?.selectMultiple(scene.elements.map((el) => el.id));
      },
      clearSelection: () => selectionRef.current?.clearSelection(),
      deleteSelected: () => {
        const sel = selectionRef.current;
        if (!sel) return;
        const ids = sel.getSelectedIds();
        if (ids.length === 0) return;
        let cur = ir;
        for (const id of ids) cur = irRemoveElement(cur, id);
        sel.clearSelection();
        onIRChange(cur);
      },
      getSelectedElements: () => selectionRef.current?.getSelectedElements(ir) ?? [],
      addElement: (element: IRElement) => {
        const scene = ir.scenes[currentSceneIndex];
        if (scene) onIRChange(irAddElement(ir, scene.id, element));
      },
      removeElement: (id: string) => onIRChange(irRemoveElement(ir, id)),
      getEngine: () => engineRef.current,
    }), [canUndo, canRedo, ir, currentSceneIndex, onIRChange]);

    // UI flags
    const showEditUI = isEditActive;
    const showReadModeEditButton = !showEditUI && !readOnly && !toolProp && !isFullscreen;

    // Panel positions
    useEffect(() => {
      if (!showEditUI) { storeApi.getState().setPanelPositions(null); return; }
      const update = () => {
        const c = containerRef.current;
        if (!c) return;
        const r = c.getBoundingClientRect();
        storeApi.getState().setPanelPositions({
          toolbar: { top: r.top + 8, left: r.left + 8 },
          panel: { top: r.top + 8, left: r.right - 288 },
        });
      };
      update();
      window.addEventListener('scroll', update, true);
      window.addEventListener('resize', update);
      return () => {
        window.removeEventListener('scroll', update, true);
        window.removeEventListener('resize', update);
      };
    }, [showEditUI, storeApi, containerRef]);

    // Render
    return (
      <div
        style={{ position: 'relative', width: style?.width ?? width, height: style?.height ?? height, ...style }}
        className={className}
        data-tool={tool}
        data-readonly={readOnly || undefined}
        onMouseEnter={() => storeApi.getState().setIsHovered(true)}
        onMouseLeave={() => storeApi.getState().setIsHovered(false)}
      >
        {isEditing && (
          <div key="backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9998 }} />
        )}
        <div
          key="canvas-container"
          ref={containerRef}
          style={isEditing ? {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: effectiveWidth, height: effectiveHeight, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          } : { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          data-tool={tool}
          data-readonly={readOnly || undefined}
        />
        {showReadModeEditButton && (() => {
          const fitted = fitToAspectRatio(width, height, ir.meta.aspectRatio);
          const sceneName = ir.scenes[currentSceneIndex]?.id ?? `scene-${currentSceneIndex + 1}`;
          return (
            <ReadModeOverlay
              editButtonPosition={editButtonPosition} isHovered={isHovered}
              currentSceneIndex={currentSceneIndex} totalScenes={ir.scenes.length}
              sceneName={sceneName} fitted={fitted}
              goToPrevScene={goToPrevScene} goToNextScene={goToNextScene}
              enterFullscreen={enterFullscreen} enterEditMode={enterEditMode}
            />
          );
        })()}
        {showEditUI && isDSLMode && editingDsl !== null && panelPositions && (
          <DepixDSLEditor
            dsl={editingDsl} onDSLChange={setEditingDsl}
            ir={editingIR} theme={dslTheme}
            width={effectiveWidth} height={effectiveHeight}
            panelPositions={panelPositions}
            onConfirm={handleConfirm} onCancel={handleCancel}
          />
        )}
      </div>
    );
  },
);
