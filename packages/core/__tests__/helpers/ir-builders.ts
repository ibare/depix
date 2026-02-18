/**
 * Factory functions for creating valid IR elements with sensible defaults.
 *
 * Each builder produces a fully valid IR element that passes `validateElement()`.
 * All functions accept optional overrides to customize the result.
 *
 * @module @depix/core/__tests__/helpers/ir-builders
 */

import type {
  DepixIR,
  IRBounds,
  IRContainer,
  IREdge,
  IRElement,
  IRImage,
  IRLine,
  IRMeta,
  IRPath,
  IRScene,
  IRShape,
  IRStyle,
  IRText,
} from '../../src/ir/types.js';

// ---------------------------------------------------------------------------
// Test ID generation
// ---------------------------------------------------------------------------

let testIdCounter = 0;

/**
 * Generate a unique, deterministic test ID.
 *
 * IDs follow the format `test-{counter}` for easy debugging.
 * Call `resetTestIds()` between tests to get predictable sequences.
 */
export function generateTestId(): string {
  return `test-${++testIdCounter}`;
}

/**
 * Reset the test ID counter to zero.
 *
 * Call this in `beforeEach` to get deterministic IDs across tests.
 */
export function resetTestIds(): void {
  testIdCounter = 0;
}

// ---------------------------------------------------------------------------
// Primitive builders
// ---------------------------------------------------------------------------

/**
 * Create an IRBounds with defaults.
 *
 * Default values: x=10, y=10, w=20, h=15
 */
export function bounds(
  x: number = 10,
  y: number = 10,
  w: number = 20,
  h: number = 15,
): IRBounds {
  return { x, y, w, h };
}

/**
 * Create a default IRStyle (empty object = use renderer defaults).
 */
export function style(overrides?: Partial<IRStyle>): IRStyle {
  return { ...overrides };
}

// ---------------------------------------------------------------------------
// Element builders
// ---------------------------------------------------------------------------

/**
 * Create an IRShape with defaults.
 *
 * Default: rect shape at (10, 10) with 20x15 size.
 */
export function shape(overrides?: Partial<IRShape>): IRShape {
  return {
    id: generateTestId(),
    type: 'shape',
    shape: 'rect',
    bounds: { x: 10, y: 10, w: 20, h: 15 },
    style: {},
    ...overrides,
  };
}

/**
 * Create an IRText with defaults.
 *
 * Default: "Hello" text at (10, 10) with fontSize 14 and color #000000.
 */
export function text(
  content: string = 'Hello',
  overrides?: Partial<IRText>,
): IRText {
  return {
    id: generateTestId(),
    type: 'text',
    bounds: { x: 10, y: 10, w: 30, h: 10 },
    style: {},
    content,
    fontSize: 14,
    color: '#000000',
    ...overrides,
  };
}

/**
 * Create an IRImage with defaults.
 *
 * Default: example.com image at (10, 10) with 20x15 size.
 */
export function image(
  src: string = 'https://example.com/img.png',
  overrides?: Partial<IRImage>,
): IRImage {
  return {
    id: generateTestId(),
    type: 'image',
    bounds: { x: 10, y: 10, w: 20, h: 15 },
    style: {},
    src,
    ...overrides,
  };
}

/**
 * Create an IRLine with defaults.
 *
 * Default: horizontal line from (10, 50) to (90, 50).
 */
export function line(overrides?: Partial<IRLine>): IRLine {
  return {
    id: generateTestId(),
    type: 'line',
    bounds: { x: 10, y: 50, w: 80, h: 0 },
    style: {},
    from: { x: 10, y: 50 },
    to: { x: 90, y: 50 },
    ...overrides,
  };
}

/**
 * Create an IRPath with defaults.
 *
 * Default: diagonal line path from (0,0) to (100,100).
 */
export function path(
  d: string = 'M0,0 L100,100',
  overrides?: Partial<IRPath>,
): IRPath {
  return {
    id: generateTestId(),
    type: 'path',
    bounds: { x: 0, y: 0, w: 100, h: 100 },
    style: {},
    d,
    ...overrides,
  };
}

/**
 * Create an IREdge with defaults.
 *
 * Default: straight edge from element "a" to element "b".
 */
export function edge(
  fromId: string = 'a',
  toId: string = 'b',
  overrides?: Partial<IREdge>,
): IREdge {
  return {
    id: generateTestId(),
    type: 'edge',
    bounds: { x: 0, y: 0, w: 100, h: 100 },
    style: {},
    fromId,
    toId,
    fromAnchor: { x: 30, y: 50 },
    toAnchor: { x: 70, y: 50 },
    path: { type: 'straight' },
    ...overrides,
  };
}

/**
 * Create an IRContainer with defaults.
 *
 * Default: container at (5, 5) with 90x90 size and the given children.
 */
export function container(
  children: IRElement[] = [],
  overrides?: Partial<IRContainer>,
): IRContainer {
  return {
    id: generateTestId(),
    type: 'container',
    bounds: { x: 5, y: 5, w: 90, h: 90 },
    style: {},
    children,
    ...overrides,
  };
}

/**
 * Create an IRScene with defaults.
 *
 * Default: scene with the given elements.
 */
export function scene(
  elements: IRElement[] = [],
  overrides?: Partial<IRScene>,
): IRScene {
  return {
    id: generateTestId(),
    elements,
    ...overrides,
  };
}

/**
 * Create a default IRMeta.
 */
export function meta(overrides?: Partial<IRMeta>): IRMeta {
  return {
    aspectRatio: { width: 16, height: 9 },
    background: { type: 'solid', color: '#ffffff' },
    drawingStyle: 'default',
    ...overrides,
  };
}

/**
 * Create a minimal valid DepixIR document.
 *
 * Default: 16:9 aspect ratio, white background, default drawing style.
 * If no scenes are provided, a single empty scene is created.
 */
export function ir(
  scenes?: IRScene[],
  overrides?: Partial<DepixIR>,
): DepixIR {
  return {
    meta: meta(),
    scenes: scenes ?? [scene()],
    transitions: [],
    ...overrides,
  };
}
