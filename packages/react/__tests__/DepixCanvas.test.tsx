/**
 * DepixCanvas + useDepixCanvas Tests
 *
 * Tests the React canvas component and hook for rendering DepixIR documents.
 * The DepixEngine is mocked since Konva requires a full DOM canvas that
 * is not available in the happy-dom test environment.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { renderHook, act as actHook } from '@testing-library/react';
import type { DepixIR } from '@depix/core';

// ---------------------------------------------------------------------------
// Hoisted mocks — vi.hoisted ensures variables are available when
// vi.mock factory functions are evaluated (vi.mock is hoisted to top).
// ---------------------------------------------------------------------------

const {
  mockLoad,
  mockNextScene,
  mockPrevScene,
  mockSetScene,
  mockResize,
  mockDestroy,
  mockGetStage,
  mockGetTransform,
  MockEngineConstructor,
  mockCompile,
  mockSceneState,
} = vi.hoisted(() => {
  const state = { sceneIndex: 0, sceneCount: 1 };

  const _mockLoad = vi.fn();
  const _mockNextScene = vi.fn();
  const _mockPrevScene = vi.fn();
  const _mockSetScene = vi.fn();
  const _mockResize = vi.fn();
  const _mockDestroy = vi.fn();
  const _mockGetStage = vi.fn();
  const _mockGetTransform = vi.fn();

  const _MockEngineConstructor = vi.fn().mockImplementation(() => ({
    load: _mockLoad,
    nextScene: _mockNextScene,
    prevScene: _mockPrevScene,
    setScene: _mockSetScene,
    resize: _mockResize,
    destroy: _mockDestroy,
    get sceneIndex() { return state.sceneIndex; },
    get sceneCount() { return state.sceneCount; },
    getStage: _mockGetStage,
    getTransform: _mockGetTransform,
  }));

  const _mockCompile = vi.fn();

  return {
    mockLoad: _mockLoad,
    mockNextScene: _mockNextScene,
    mockPrevScene: _mockPrevScene,
    mockSetScene: _mockSetScene,
    mockResize: _mockResize,
    mockDestroy: _mockDestroy,
    mockGetStage: _mockGetStage,
    mockGetTransform: _mockGetTransform,
    MockEngineConstructor: _MockEngineConstructor,
    mockCompile: _mockCompile,
    mockSceneState: state,
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@depix/engine', () => ({
  DepixEngine: MockEngineConstructor,
}));

vi.mock('@depix/core', async () => {
  const actual = await vi.importActual<typeof import('@depix/core')>('@depix/core');
  return {
    ...actual,
    compile: mockCompile,
  };
});

// ---------------------------------------------------------------------------
// Component imports (after mock declarations)
// ---------------------------------------------------------------------------

import { DepixCanvas } from '../src/DepixCanvas.js';
import type { DepixCanvasRef } from '../src/DepixCanvas.js';
import { useDepixCanvas } from '../src/hooks/useDepixCanvas.js';

// ---------------------------------------------------------------------------
// Test fixture IR
// ---------------------------------------------------------------------------

const mockIR: DepixIR = {
  meta: {
    aspectRatio: { width: 16, height: 9 },
    background: { type: 'solid', color: '#ffffff' },
    drawingStyle: 'default',
  },
  scenes: [
    {
      id: 'scene-1',
      elements: [
        {
          id: 'el-1',
          type: 'shape',
          shape: 'rect',
          bounds: { x: 10, y: 10, w: 20, h: 10 },
          style: { fill: '#4A90D9' },
          innerText: { content: 'Hello', color: '#000000', fontSize: 14 },
        },
      ],
    },
    {
      id: 'scene-2',
      elements: [],
    },
  ],
  transitions: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRef(): React.RefObject<DepixCanvasRef | null> {
  return { current: null };
}

/**
 * Wire up the mock implementations that depend on mutable scene state.
 * Called in beforeEach since clearAllMocks resets implementations.
 */
function wireSceneMocks() {
  mockLoad.mockImplementation(() => {
    mockSceneState.sceneCount = 2;
    mockSceneState.sceneIndex = 0;
  });
  mockNextScene.mockImplementation(() => {
    if (mockSceneState.sceneIndex < mockSceneState.sceneCount - 1) {
      mockSceneState.sceneIndex++;
    }
  });
  mockPrevScene.mockImplementation(() => {
    if (mockSceneState.sceneIndex > 0) {
      mockSceneState.sceneIndex--;
    }
  });
  mockSetScene.mockImplementation((index: number) => {
    if (index >= 0 && index < mockSceneState.sceneCount) {
      mockSceneState.sceneIndex = index;
    }
  });
  mockCompile.mockReturnValue({ ir: mockIR, errors: [] });
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockSceneState.sceneIndex = 0;
  mockSceneState.sceneCount = 1;
  vi.clearAllMocks();
  wireSceneMocks();
});

afterEach(() => {
  cleanup();
});

// ===========================================================================
// DepixCanvas Component Tests
// ===========================================================================

describe('DepixCanvas', () => {
  // ---- Rendering -----------------------------------------------------------

  describe('rendering', () => {
    it('renders a div container', () => {
      const { container } = render(<DepixCanvas data={mockIR} />);
      const div = container.firstElementChild;

      expect(div).toBeTruthy();
      expect(div!.tagName).toBe('DIV');
    });

    it('renders with className', () => {
      const { container } = render(
        <DepixCanvas data={mockIR} className="my-canvas" />,
      );
      const div = container.firstElementChild as HTMLElement;

      expect(div.className).toBe('my-canvas');
    });

    it('renders with custom style', () => {
      const customStyle: React.CSSProperties = {
        border: '1px solid red',
        borderRadius: '8px',
      };
      const { container } = render(
        <DepixCanvas data={mockIR} style={customStyle} />,
      );
      const div = container.firstElementChild as HTMLElement;

      expect(div.style.border).toBe('1px solid red');
      expect(div.style.borderRadius).toBe('8px');
    });

    it('renders with default width and height', () => {
      const { container } = render(<DepixCanvas data={mockIR} />);
      const div = container.firstElementChild as HTMLElement;

      expect(div.style.width).toBe('800px');
      expect(div.style.height).toBe('450px');
    });

    it('renders with custom width and height', () => {
      const { container } = render(
        <DepixCanvas data={mockIR} width={1024} height={768} />,
      );
      const div = container.firstElementChild as HTMLElement;

      expect(div.style.width).toBe('1024px');
      expect(div.style.height).toBe('768px');
    });
  });

  // ---- Data loading --------------------------------------------------------

  describe('data loading', () => {
    it('loads DepixIR object on mount', () => {
      render(<DepixCanvas data={mockIR} />);

      expect(mockLoad).toHaveBeenCalledWith(mockIR);
    });

    it('loads DSL string by compiling it', () => {
      render(<DepixCanvas data='node "Hello" #h1' />);

      expect(mockCompile).toHaveBeenCalledWith('node "Hello" #h1');
      expect(mockLoad).toHaveBeenCalledWith(mockIR);
    });

    it('does not load when data is an empty string', () => {
      render(<DepixCanvas data="" />);

      expect(mockLoad).not.toHaveBeenCalled();
    });

    it('re-loads when data prop changes', () => {
      const otherIR: DepixIR = {
        ...mockIR,
        scenes: [{ id: 'other', elements: [] }],
      };

      const { rerender } = render(<DepixCanvas data={mockIR} />);
      expect(mockLoad).toHaveBeenCalledTimes(1);

      rerender(<DepixCanvas data={otherIR} />);
      expect(mockLoad).toHaveBeenCalledTimes(2);
      expect(mockLoad).toHaveBeenLastCalledWith(otherIR);
    });
  });

  // ---- Click handler -------------------------------------------------------

  describe('click handler', () => {
    it('calls onClick when container is clicked', () => {
      const handleClick = vi.fn();
      const { container } = render(
        <DepixCanvas data={mockIR} onClick={handleClick} />,
      );
      const div = container.firstElementChild as HTMLElement;

      act(() => {
        div.click();
      });

      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  // ---- Ref API -------------------------------------------------------------

  describe('ref API', () => {
    it('exposes nextScene and prevScene', () => {
      const ref = createRef();
      render(<DepixCanvas ref={ref} data={mockIR} />);

      expect(ref.current).not.toBeNull();
      expect(typeof ref.current!.nextScene).toBe('function');
      expect(typeof ref.current!.prevScene).toBe('function');
    });

    it('exposes setScene', () => {
      const ref = createRef();
      render(<DepixCanvas ref={ref} data={mockIR} />);

      act(() => {
        ref.current!.setScene(1);
      });

      expect(mockSetScene).toHaveBeenCalledWith(1);
    });

    it('getSceneIndex returns current scene index', () => {
      const ref = createRef();
      render(<DepixCanvas ref={ref} data={mockIR} />);

      expect(ref.current!.getSceneIndex()).toBe(0);
    });

    it('getSceneCount returns total scene count', () => {
      const ref = createRef();
      render(<DepixCanvas ref={ref} data={mockIR} />);

      // After load, mockSceneCount is 2
      expect(ref.current!.getSceneCount()).toBe(2);
    });

    it('getEngine returns the engine instance', () => {
      const ref = createRef();
      render(<DepixCanvas ref={ref} data={mockIR} />);

      const engine = ref.current!.getEngine();
      expect(engine).not.toBeNull();
      expect(typeof engine!.load).toBe('function');
    });

    it('calls onSceneChange when navigating via ref', () => {
      const handleSceneChange = vi.fn();
      const ref = createRef();
      render(
        <DepixCanvas ref={ref} data={mockIR} onSceneChange={handleSceneChange} />,
      );

      act(() => {
        ref.current!.nextScene();
      });

      expect(mockNextScene).toHaveBeenCalled();
      expect(handleSceneChange).toHaveBeenCalledWith(1);
    });
  });

  // ---- Lifecycle -----------------------------------------------------------

  describe('lifecycle', () => {
    it('creates engine on mount', () => {
      render(<DepixCanvas data={mockIR} />);

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
      const { unmount } = render(<DepixCanvas data={mockIR} />);

      expect(mockDestroy).not.toHaveBeenCalled();

      unmount();

      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });
  });
});

// ===========================================================================
// useDepixCanvas Hook Tests
// ===========================================================================

describe('useDepixCanvas', () => {
  // ---- Initialization ------------------------------------------------------

  describe('initialization', () => {
    it('returns a containerRef', () => {
      const { result } = renderHook(() => useDepixCanvas());

      expect(result.current.containerRef).toBeDefined();
      expect(result.current.containerRef.current).toBeNull();
    });

    it('returns null engine initially (no container attached)', () => {
      const { result } = renderHook(() => useDepixCanvas());

      // Engine is null because containerRef is not attached to a DOM element
      expect(result.current.engine).toBeNull();
    });

    it('initializes sceneIndex and sceneCount to 0', () => {
      const { result } = renderHook(() => useDepixCanvas());

      expect(result.current.sceneIndex).toBe(0);
      expect(result.current.sceneCount).toBe(0);
    });
  });

  // ---- Loading -------------------------------------------------------------

  describe('loading', () => {
    it('exposes a load function', () => {
      const { result } = renderHook(() => useDepixCanvas());

      expect(typeof result.current.load).toBe('function');
    });

    it('does not throw when load is called without engine', () => {
      const { result } = renderHook(() => useDepixCanvas());

      expect(() => {
        actHook(() => {
          result.current.load(mockIR);
        });
      }).not.toThrow();
    });
  });

  // ---- Navigation ----------------------------------------------------------

  describe('navigation', () => {
    it('exposes nextScene and prevScene functions', () => {
      const { result } = renderHook(() => useDepixCanvas());

      expect(typeof result.current.nextScene).toBe('function');
      expect(typeof result.current.prevScene).toBe('function');
    });

    it('exposes setScene function', () => {
      const { result } = renderHook(() => useDepixCanvas());

      expect(typeof result.current.setScene).toBe('function');
    });

    it('does not throw when navigation is called without engine', () => {
      const { result } = renderHook(() => useDepixCanvas());

      expect(() => {
        actHook(() => {
          result.current.nextScene();
          result.current.prevScene();
          result.current.setScene(0);
        });
      }).not.toThrow();
    });
  });

  // ---- Options -------------------------------------------------------------

  describe('options', () => {
    it('accepts custom width and height', () => {
      const { result } = renderHook(() =>
        useDepixCanvas({ width: 1920, height: 1080 }),
      );

      // Hook should initialize without error
      expect(result.current).toBeDefined();
    });
  });
});
