/**
 * DepixCanvasEditable + DepixContext Tests
 *
 * Tests the editable canvas component, its ref API, keyboard shortcuts,
 * readOnly mode, and the DepixContext provider/hook.
 *
 * DepixEngine and @depix/editor modules are mocked since Konva requires
 * a full DOM canvas not available in the happy-dom test environment.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup, fireEvent } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import type { DepixIR, IRElement, IRShape } from '@depix/core';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockLoad,
  mockUpdate,
  mockResize,
  mockDestroy,
  mockGetStage,
  mockGetTransform,
  mockSetScene,
  MockEngineConstructor,
  mockSelectionManagerInstance,
  MockSelectionManager,
  mockHistoryManagerInstance,
  MockHistoryManager,
  mockHandleManagerInstance,
  MockHandleManager,
  MockSnapGuideManager,
  mockAddElement,
  mockRemoveElement,
} = vi.hoisted(() => {
  // ---- DepixEngine mock ----
  const _mockLoad = vi.fn();
  const _mockUpdate = vi.fn();
  const _mockResize = vi.fn();
  const _mockDestroy = vi.fn();
  const _mockGetStage = vi.fn();
  const _mockGetTransform = vi.fn();
  const _mockSetScene = vi.fn();

  const _MockEngineConstructor = vi.fn().mockImplementation(() => ({
    load: _mockLoad,
    update: _mockUpdate,
    resize: _mockResize,
    destroy: _mockDestroy,
    getStage: _mockGetStage,
    getTransform: _mockGetTransform,
    setScene: _mockSetScene,
    setDebugMode: vi.fn(),
    createEditOverlay: vi.fn(),
    destroyEditOverlay: vi.fn(),
    getEditTransformer: vi.fn().mockReturnValue(null),
    getOverlayLayer: vi.fn().mockReturnValue(null),
    get sceneIndex() { return 0; },
    get sceneCount() { return 1; },
    get debugMode() { return false; },
  }));

  // ---- SelectionManager mock ----
  const _mockSelectionManagerInstance = {
    select: vi.fn(),
    selectMultiple: vi.fn(),
    deselect: vi.fn(),
    clearSelection: vi.fn(),
    toggleSelection: vi.fn(),
    isSelected: vi.fn().mockReturnValue(false),
    getSelectedIds: vi.fn().mockReturnValue([]),
    getSelectionCount: vi.fn().mockReturnValue(0),
    setHovered: vi.fn(),
    getHoveredId: vi.fn().mockReturnValue(null),
    getSelectedElements: vi.fn().mockReturnValue([]),
    getPrimarySelection: vi.fn().mockReturnValue(null),
    onChange: vi.fn().mockReturnValue(() => {}),
    onDragEnd: vi.fn().mockReturnValue(() => {}),
    onTransformEnd: vi.fn().mockReturnValue(() => {}),
    emitDragEnd: vi.fn(),
    emitTransformEnd: vi.fn(),
    getState: vi.fn().mockReturnValue({ selectedIds: [], hoveredId: null }),
    destroy: vi.fn(),
  };

  const _MockSelectionManager = vi.fn().mockImplementation(() => _mockSelectionManagerInstance);

  // ---- HistoryManager mock ----
  const _mockHistoryManagerInstance = {
    push: vi.fn(),
    undo: vi.fn().mockReturnValue(false),
    redo: vi.fn().mockReturnValue(false),
    canUndo: vi.fn().mockReturnValue(false),
    canRedo: vi.fn().mockReturnValue(false),
    getState: vi.fn().mockReturnValue({ undoCount: 0, redoCount: 0, canUndo: false, canRedo: false }),
    clear: vi.fn(),
    onChange: vi.fn().mockReturnValue(() => {}),
    destroy: vi.fn(),
  };

  const _MockHistoryManager = vi.fn().mockImplementation(() => _mockHistoryManagerInstance);

  // ---- HandleManager mock ----
  const _mockHandleManagerInstance = {
    updateForElements: vi.fn(),
    getActiveHandleType: vi.fn().mockReturnValue('none'),
    getDefinition: vi.fn().mockReturnValue(null),
    getElements: vi.fn().mockReturnValue([]),
    hideHandles: vi.fn(),
    onHandleChange: vi.fn().mockReturnValue(() => {}),
    destroy: vi.fn(),
  };

  const _MockHandleManager = vi.fn().mockImplementation(() => _mockHandleManagerInstance);

  // ---- SnapGuideManager mock ----
  const _MockSnapGuideManager = vi.fn().mockImplementation(() => ({
    setEnabled: vi.fn(),
    isEnabled: vi.fn().mockReturnValue(true),
    updateConfig: vi.fn(),
    getConfig: vi.fn(),
    setGuideRenderer: vi.fn(),
    onDragStart: vi.fn(),
    onDragMove: vi.fn(),
    onDragEnd: vi.fn(),
    clearGuides: vi.fn(),
    getGuides: vi.fn().mockReturnValue([]),
  }));

  // ---- IR operations mocks ----
  const _mockAddElement = vi.fn().mockImplementation((ir: DepixIR) => ir);
  const _mockRemoveElement = vi.fn().mockImplementation((ir: DepixIR) => ir);

  return {
    mockLoad: _mockLoad,
    mockUpdate: _mockUpdate,
    mockResize: _mockResize,
    mockDestroy: _mockDestroy,
    mockGetStage: _mockGetStage,
    mockGetTransform: _mockGetTransform,
    mockSetScene: _mockSetScene,
    MockEngineConstructor: _MockEngineConstructor,
    mockSelectionManagerInstance: _mockSelectionManagerInstance,
    MockSelectionManager: _MockSelectionManager,
    mockHistoryManagerInstance: _mockHistoryManagerInstance,
    MockHistoryManager: _MockHistoryManager,
    mockHandleManagerInstance: _mockHandleManagerInstance,
    MockHandleManager: _MockHandleManager,
    MockSnapGuideManager: _MockSnapGuideManager,
    mockAddElement: _mockAddElement,
    mockRemoveElement: _mockRemoveElement,
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@depix/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@depix/engine')>();
  return {
    ...actual,
    DepixEngine: MockEngineConstructor,
  };
});

vi.mock('@depix/editor', () => ({
  SelectionManager: MockSelectionManager,
  HistoryManager: MockHistoryManager,
  HandleManager: MockHandleManager,
  SnapGuideManager: MockSnapGuideManager,
  addElement: mockAddElement,
  removeElement: mockRemoveElement,
}));

vi.mock('@depix/core', async () => {
  const actual = await vi.importActual<typeof import('@depix/core')>('@depix/core');
  return {
    ...actual,
  };
});

// ---------------------------------------------------------------------------
// Component imports (after mock declarations)
// ---------------------------------------------------------------------------

import { DepixCanvasEditable } from '../src/DepixCanvasEditable.js';
import type { DepixCanvasEditableRef } from '../src/DepixCanvasEditable.js';
import { DepixProvider, useDepixContext } from '../src/context/DepixContext.js';
import type { DepixContextValue } from '../src/context/DepixContext.js';

// ---------------------------------------------------------------------------
// Test fixture IR
// ---------------------------------------------------------------------------

const mockElement: IRShape = {
  id: 'el-1',
  type: 'shape',
  shape: 'rect',
  bounds: { x: 10, y: 10, w: 20, h: 10 },
  style: { fill: '#4A90D9' },
  innerText: { content: 'Hello', color: '#000000', fontSize: 14 },
};

const mockElement2: IRShape = {
  id: 'el-2',
  type: 'shape',
  shape: 'circle',
  bounds: { x: 40, y: 40, w: 15, h: 15 },
  style: { fill: '#FF0000' },
};

const mockIR: DepixIR = {
  meta: {
    aspectRatio: { width: 16, height: 9 },
    background: { type: 'solid', color: '#ffffff' },
    drawingStyle: 'default',
  },
  scenes: [
    {
      id: 'scene-1',
      elements: [mockElement, mockElement2],
    },
  ],
  transitions: [],
};

const emptyIR: DepixIR = {
  meta: {
    aspectRatio: { width: 16, height: 9 },
    background: { type: 'solid', color: '#ffffff' },
    drawingStyle: 'default',
  },
  scenes: [
    {
      id: 'scene-1',
      elements: [],
    },
  ],
  transitions: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRef(): React.RefObject<DepixCanvasEditableRef | null> {
  return { current: null };
}

const noop = () => {};

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Reset mock return values
  mockSelectionManagerInstance.getSelectedIds.mockReturnValue([]);
  mockSelectionManagerInstance.getSelectedElements.mockReturnValue([]);
  mockSelectionManagerInstance.getSelectionCount.mockReturnValue(0);
  mockHistoryManagerInstance.canUndo.mockReturnValue(false);
  mockHistoryManagerInstance.canRedo.mockReturnValue(false);

  // mockAddElement / mockRemoveElement return the IR they receive
  mockAddElement.mockImplementation((ir: DepixIR) => ir);
  mockRemoveElement.mockImplementation((ir: DepixIR) => ir);
});

afterEach(() => {
  cleanup();
});

// ===========================================================================
// DepixCanvasEditable Component Tests
// ===========================================================================

describe('DepixCanvasEditable', () => {
  // ---- Rendering -----------------------------------------------------------

  describe('rendering', () => {
    it('renders a div container', () => {
      const { container } = render(
        <DepixCanvasEditable ir={mockIR} onIRChange={noop} />,
      );
      const div = container.firstElementChild;

      expect(div).toBeTruthy();
      expect(div!.tagName).toBe('DIV');
    });

    it('renders with className', () => {
      const { container } = render(
        <DepixCanvasEditable ir={mockIR} onIRChange={noop} className="editable-canvas" />,
      );
      const div = container.firstElementChild as HTMLElement;

      expect(div.className).toBe('editable-canvas');
    });

    it('renders with custom style', () => {
      const customStyle: React.CSSProperties = {
        border: '2px solid blue',
        borderRadius: '4px',
      };
      const { container } = render(
        <DepixCanvasEditable ir={mockIR} onIRChange={noop} style={customStyle} />,
      );
      const div = container.firstElementChild as HTMLElement;

      expect(div.style.border).toBe('2px solid blue');
      expect(div.style.borderRadius).toBe('4px');
    });

    it('renders with default width and height', () => {
      const { container } = render(
        <DepixCanvasEditable ir={mockIR} onIRChange={noop} />,
      );
      const div = container.firstElementChild as HTMLElement;

      expect(div.style.width).toBe('800px');
      expect(div.style.height).toBe('450px');
    });

    it('renders with custom width and height', () => {
      const { container } = render(
        <DepixCanvasEditable ir={mockIR} onIRChange={noop} width={1024} height={768} />,
      );
      const div = container.firstElementChild as HTMLElement;

      expect(div.style.width).toBe('1024px');
      expect(div.style.height).toBe('768px');
    });

    it('renders with data-tool attribute', () => {
      const { container } = render(
        <DepixCanvasEditable ir={mockIR} onIRChange={noop} tool="rect" />,
      );
      const div = container.firstElementChild as HTMLElement;

      expect(div.getAttribute('data-tool')).toBe('rect');
    });

    it('renders with default tool "select"', () => {
      const { container } = render(
        <DepixCanvasEditable ir={mockIR} onIRChange={noop} />,
      );
      const div = container.firstElementChild as HTMLElement;

      expect(div.getAttribute('data-tool')).toBe('select');
    });
  });

  // ---- IR loading ----------------------------------------------------------

  describe('IR loading', () => {
    it('updates IR on mount', () => {
      render(<DepixCanvasEditable ir={mockIR} onIRChange={noop} />);

      expect(mockUpdate).toHaveBeenCalledWith(mockIR);
    });

    it('updates when IR prop changes', () => {
      const { rerender } = render(
        <DepixCanvasEditable ir={mockIR} onIRChange={noop} />,
      );
      expect(mockUpdate).toHaveBeenCalledTimes(1);

      rerender(<DepixCanvasEditable ir={emptyIR} onIRChange={noop} />);
      expect(mockUpdate).toHaveBeenCalledTimes(2);
      expect(mockUpdate).toHaveBeenLastCalledWith(emptyIR);
    });
  });

  // ---- Editor managers initialization --------------------------------------

  describe('editor managers', () => {
    it('creates SelectionManager on mount', () => {
      render(<DepixCanvasEditable ir={mockIR} onIRChange={noop} />);

      expect(MockSelectionManager).toHaveBeenCalledTimes(1);
    });

    it('creates HistoryManager on mount', () => {
      render(<DepixCanvasEditable ir={mockIR} onIRChange={noop} />);

      expect(MockHistoryManager).toHaveBeenCalledTimes(1);
    });

    it('creates HandleManager on mount', () => {
      render(<DepixCanvasEditable ir={mockIR} onIRChange={noop} />);

      expect(MockHandleManager).toHaveBeenCalledTimes(1);
    });

    it('creates SnapGuideManager on mount', () => {
      render(<DepixCanvasEditable ir={mockIR} onIRChange={noop} />);

      expect(MockSnapGuideManager).toHaveBeenCalledTimes(1);
    });

    it('destroys managers on unmount', () => {
      const { unmount } = render(
        <DepixCanvasEditable ir={mockIR} onIRChange={noop} />,
      );

      unmount();

      expect(mockSelectionManagerInstance.destroy).toHaveBeenCalledTimes(1);
      expect(mockHistoryManagerInstance.destroy).toHaveBeenCalledTimes(1);
      expect(mockHandleManagerInstance.destroy).toHaveBeenCalledTimes(1);
    });
  });

  // ---- Ref API: undo/redo -------------------------------------------------

  describe('ref API — undo/redo', () => {
    it('exposes undo function', () => {
      const ref = createRef();
      render(<DepixCanvasEditable ref={ref} ir={mockIR} onIRChange={noop} />);

      expect(typeof ref.current!.undo).toBe('function');

      act(() => {
        ref.current!.undo();
      });

      expect(mockHistoryManagerInstance.undo).toHaveBeenCalledTimes(1);
    });

    it('exposes redo function', () => {
      const ref = createRef();
      render(<DepixCanvasEditable ref={ref} ir={mockIR} onIRChange={noop} />);

      expect(typeof ref.current!.redo).toBe('function');

      act(() => {
        ref.current!.redo();
      });

      expect(mockHistoryManagerInstance.redo).toHaveBeenCalledTimes(1);
    });

    it('exposes canUndo as false initially', () => {
      const ref = createRef();
      render(<DepixCanvasEditable ref={ref} ir={mockIR} onIRChange={noop} />);

      expect(ref.current!.canUndo).toBe(false);
    });

    it('exposes canRedo as false initially', () => {
      const ref = createRef();
      render(<DepixCanvasEditable ref={ref} ir={mockIR} onIRChange={noop} />);

      expect(ref.current!.canRedo).toBe(false);
    });
  });

  // ---- Ref API: selection --------------------------------------------------

  describe('ref API — selection', () => {
    it('selectAll selects all elements in first scene', () => {
      const ref = createRef();
      render(<DepixCanvasEditable ref={ref} ir={mockIR} onIRChange={noop} />);

      act(() => {
        ref.current!.selectAll();
      });

      expect(mockSelectionManagerInstance.selectMultiple).toHaveBeenCalledWith([
        'el-1',
        'el-2',
      ]);
    });

    it('clearSelection clears the selection', () => {
      const ref = createRef();
      render(<DepixCanvasEditable ref={ref} ir={mockIR} onIRChange={noop} />);

      act(() => {
        ref.current!.clearSelection();
      });

      expect(mockSelectionManagerInstance.clearSelection).toHaveBeenCalledTimes(1);
    });

    it('getSelectedElements returns selected elements from IR', () => {
      const ref = createRef();
      mockSelectionManagerInstance.getSelectedElements.mockReturnValue([mockElement]);

      render(<DepixCanvasEditable ref={ref} ir={mockIR} onIRChange={noop} />);

      const result = ref.current!.getSelectedElements();
      expect(result).toEqual([mockElement]);
      expect(mockSelectionManagerInstance.getSelectedElements).toHaveBeenCalledWith(mockIR);
    });

    it('deleteSelected removes selected elements and calls onIRChange', () => {
      const ref = createRef();
      const handleIRChange = vi.fn();
      mockSelectionManagerInstance.getSelectedIds.mockReturnValue(['el-1']);

      render(
        <DepixCanvasEditable ref={ref} ir={mockIR} onIRChange={handleIRChange} />,
      );

      act(() => {
        ref.current!.deleteSelected();
      });

      expect(mockRemoveElement).toHaveBeenCalledWith(mockIR, 'el-1');
      expect(mockSelectionManagerInstance.clearSelection).toHaveBeenCalled();
      expect(handleIRChange).toHaveBeenCalled();
    });

    it('deleteSelected is a no-op when nothing is selected', () => {
      const ref = createRef();
      const handleIRChange = vi.fn();
      mockSelectionManagerInstance.getSelectedIds.mockReturnValue([]);

      render(
        <DepixCanvasEditable ref={ref} ir={mockIR} onIRChange={handleIRChange} />,
      );

      act(() => {
        ref.current!.deleteSelected();
      });

      expect(mockRemoveElement).not.toHaveBeenCalled();
      expect(handleIRChange).not.toHaveBeenCalled();
    });
  });

  // ---- Ref API: element operations ----------------------------------------

  describe('ref API — element operations', () => {
    it('addElement adds an element to the first scene', () => {
      const ref = createRef();
      const handleIRChange = vi.fn();
      const newElement: IRShape = {
        id: 'el-new',
        type: 'shape',
        shape: 'rect',
        bounds: { x: 0, y: 0, w: 10, h: 10 },
        style: { fill: '#00ff00' },
      };

      render(
        <DepixCanvasEditable ref={ref} ir={mockIR} onIRChange={handleIRChange} />,
      );

      act(() => {
        ref.current!.addElement(newElement);
      });

      expect(mockAddElement).toHaveBeenCalledWith(mockIR, 'scene-1', newElement);
      expect(handleIRChange).toHaveBeenCalled();
    });

    it('removeElement removes an element by ID', () => {
      const ref = createRef();
      const handleIRChange = vi.fn();

      render(
        <DepixCanvasEditable ref={ref} ir={mockIR} onIRChange={handleIRChange} />,
      );

      act(() => {
        ref.current!.removeElement('el-1');
      });

      expect(mockRemoveElement).toHaveBeenCalledWith(mockIR, 'el-1');
      expect(handleIRChange).toHaveBeenCalled();
    });

    it('getEngine returns the engine instance', () => {
      const ref = createRef();
      render(<DepixCanvasEditable ref={ref} ir={mockIR} onIRChange={noop} />);

      const engine = ref.current!.getEngine();
      expect(engine).not.toBeNull();
      expect(typeof engine!.load).toBe('function');
    });
  });

  // ---- readOnly mode -------------------------------------------------------

  describe('readOnly mode', () => {
    it('sets data-readonly attribute', () => {
      const { container } = render(
        <DepixCanvasEditable ir={mockIR} onIRChange={noop} readOnly />,
      );
      const div = container.firstElementChild as HTMLElement;

      expect(div.getAttribute('data-readonly')).toBe('true');
    });

    it('does not set data-readonly when false', () => {
      const { container } = render(
        <DepixCanvasEditable ir={mockIR} onIRChange={noop} readOnly={false} />,
      );
      const div = container.firstElementChild as HTMLElement;

      expect(div.hasAttribute('data-readonly')).toBe(false);
    });

    it('does not register keyboard shortcuts when readOnly', () => {
      const handleIRChange = vi.fn();
      render(
        <DepixCanvasEditable ir={mockIR} onIRChange={handleIRChange} readOnly />,
      );

      // Simulate Ctrl+Z — should NOT trigger undo in readOnly mode
      act(() => {
        fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
      });

      expect(mockHistoryManagerInstance.undo).not.toHaveBeenCalled();
    });
  });

  // ---- Lifecycle -----------------------------------------------------------

  describe('lifecycle', () => {
    it('creates engine on mount', () => {
      render(<DepixCanvasEditable ir={mockIR} onIRChange={noop} />);

      expect(MockEngineConstructor).toHaveBeenCalledTimes(1);
      expect(MockEngineConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          container: expect.any(String),
          width: 800,
          height: 450,
        }),
      );
    });

    it('destroys engine on unmount', () => {
      const { unmount } = render(
        <DepixCanvasEditable ir={mockIR} onIRChange={noop} />,
      );

      expect(mockDestroy).not.toHaveBeenCalled();
      unmount();
      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });
  });

  // ---- Selection change callback -------------------------------------------

  describe('onSelectionChange callback', () => {
    it('passes onChange handler to SelectionManager', () => {
      const handleSelection = vi.fn();
      render(
        <DepixCanvasEditable
          ir={mockIR}
          onIRChange={noop}
          onSelectionChange={handleSelection}
        />,
      );

      // SelectionManager was constructed with an options object containing onChange
      expect(MockSelectionManager).toHaveBeenCalledWith(
        expect.objectContaining({
          onChange: expect.any(Function),
        }),
      );
    });
  });
});

// ===========================================================================
// DepixContext Tests
// ===========================================================================

describe('DepixContext', () => {
  const mockContextValue: DepixContextValue = {
    ir: mockIR,
    selectedIds: ['el-1'],
    tool: 'select',
    setTool: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: true,
    canRedo: false,
    updateIR: vi.fn(),
  };

  describe('DepixProvider', () => {
    it('provides context to children', () => {
      let capturedValue: DepixContextValue | null = null;

      function Consumer() {
        capturedValue = useDepixContext();
        return <div>consumer</div>;
      }

      render(
        <DepixProvider value={mockContextValue}>
          <Consumer />
        </DepixProvider>,
      );

      expect(capturedValue).not.toBeNull();
      expect(capturedValue!.ir).toBe(mockIR);
      expect(capturedValue!.selectedIds).toEqual(['el-1']);
      expect(capturedValue!.tool).toBe('select');
      expect(capturedValue!.canUndo).toBe(true);
      expect(capturedValue!.canRedo).toBe(false);
    });

    it('provides updateIR function', () => {
      let capturedValue: DepixContextValue | null = null;

      function Consumer() {
        capturedValue = useDepixContext();
        return <div>consumer</div>;
      }

      render(
        <DepixProvider value={mockContextValue}>
          <Consumer />
        </DepixProvider>,
      );

      expect(typeof capturedValue!.updateIR).toBe('function');
    });

    it('provides setTool function', () => {
      let capturedValue: DepixContextValue | null = null;

      function Consumer() {
        capturedValue = useDepixContext();
        return <div>consumer</div>;
      }

      render(
        <DepixProvider value={mockContextValue}>
          <Consumer />
        </DepixProvider>,
      );

      expect(typeof capturedValue!.setTool).toBe('function');
    });
  });

  describe('useDepixContext', () => {
    it('throws when used outside of DepixProvider', () => {
      // Suppress console.error from React error boundary
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      function BadConsumer() {
        useDepixContext();
        return <div>bad</div>;
      }

      expect(() => render(<BadConsumer />)).toThrow(
        'useDepixContext must be used within a <DepixProvider>',
      );

      consoleSpy.mockRestore();
    });

    it('returns the provided context value', () => {
      let tool: string = '';

      function Consumer() {
        const ctx = useDepixContext();
        tool = ctx.tool;
        return <div>{ctx.tool}</div>;
      }

      render(
        <DepixProvider value={mockContextValue}>
          <Consumer />
        </DepixProvider>,
      );

      expect(tool).toBe('select');
    });
  });
});
