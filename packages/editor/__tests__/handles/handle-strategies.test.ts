import { describe, it, expect } from 'vitest';
import type {
  IRShape,
  IRText,
  IRImage,
  IRLine,
  IRPath,
  IREdge,
  IRContainer,
} from '@depix/core';
import {
  getHandleDefinition,
  isKeepRatioShape,
} from '../../src/handles/handle-strategies.js';
import { ALL_ANCHORS, CORNER_ANCHORS } from '../../src/handles/types.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeShape(shape: IRShape['shape'], id = 's1'): IRShape {
  return {
    id,
    type: 'shape',
    shape,
    bounds: { x: 10, y: 10, w: 20, h: 15 },
    style: {},
  };
}

const textEl: IRText = {
  id: 't1',
  type: 'text',
  bounds: { x: 5, y: 5, w: 30, h: 10 },
  style: {},
  content: 'Hello',
  fontSize: 3,
  color: '#000',
};

const imageEl: IRImage = {
  id: 'i1',
  type: 'image',
  bounds: { x: 0, y: 0, w: 40, h: 30 },
  style: {},
  src: 'https://example.com/photo.png',
};

const lineEl: IRLine = {
  id: 'l1',
  type: 'line',
  bounds: { x: 0, y: 0, w: 50, h: 50 },
  style: {},
  from: { x: 0, y: 0 },
  to: { x: 50, y: 50 },
};

const pathEl: IRPath = {
  id: 'p1',
  type: 'path',
  bounds: { x: 10, y: 10, w: 30, h: 30 },
  style: {},
  d: 'M 10 10 L 40 40',
};

const edgeEl: IREdge = {
  id: 'e1',
  type: 'edge',
  bounds: { x: 0, y: 0, w: 100, h: 100 },
  style: {},
  fromId: 'a',
  toId: 'b',
  fromAnchor: { x: 10, y: 10 },
  toAnchor: { x: 90, y: 90 },
  path: { type: 'straight' },
};

const containerEl: IRContainer = {
  id: 'c1',
  type: 'container',
  bounds: { x: 0, y: 0, w: 60, h: 40 },
  style: {},
  children: [],
};

// ---------------------------------------------------------------------------
// Tests: IRShape strategies
// ---------------------------------------------------------------------------

describe('getHandleDefinition — shape strategies', () => {
  it('returns ALL_ANCHORS and rotation for rect', () => {
    const def = getHandleDefinition(makeShape('rect'));
    expect(def.handleType).toBe('bounding-box');
    expect(def.keepRatio).toBe(false);
    expect(def.rotateEnabled).toBe(true);
    expect(def.enabledAnchors).toEqual(ALL_ANCHORS);
  });

  it('returns ALL_ANCHORS and rotation for diamond', () => {
    const def = getHandleDefinition(makeShape('diamond'));
    expect(def.handleType).toBe('bounding-box');
    expect(def.keepRatio).toBe(false);
    expect(def.rotateEnabled).toBe(true);
    expect(def.enabledAnchors).toEqual(ALL_ANCHORS);
  });

  it('returns ALL_ANCHORS and rotation for pill', () => {
    const def = getHandleDefinition(makeShape('pill'));
    expect(def.handleType).toBe('bounding-box');
    expect(def.keepRatio).toBe(false);
    expect(def.rotateEnabled).toBe(true);
    expect(def.enabledAnchors).toEqual(ALL_ANCHORS);
  });

  it('returns ALL_ANCHORS and rotation for hexagon', () => {
    const def = getHandleDefinition(makeShape('hexagon'));
    expect(def.handleType).toBe('bounding-box');
    expect(def.keepRatio).toBe(false);
    expect(def.rotateEnabled).toBe(true);
    expect(def.enabledAnchors).toEqual(ALL_ANCHORS);
  });

  it('returns ALL_ANCHORS and rotation for triangle', () => {
    const def = getHandleDefinition(makeShape('triangle'));
    expect(def.handleType).toBe('bounding-box');
    expect(def.keepRatio).toBe(false);
    expect(def.rotateEnabled).toBe(true);
    expect(def.enabledAnchors).toEqual(ALL_ANCHORS);
  });

  it('returns ALL_ANCHORS and rotation for parallelogram', () => {
    const def = getHandleDefinition(makeShape('parallelogram'));
    expect(def.handleType).toBe('bounding-box');
    expect(def.keepRatio).toBe(false);
    expect(def.rotateEnabled).toBe(true);
    expect(def.enabledAnchors).toEqual(ALL_ANCHORS);
  });

  it('returns keepRatio and CORNER_ANCHORS for circle', () => {
    const def = getHandleDefinition(makeShape('circle'));
    expect(def.handleType).toBe('bounding-box');
    expect(def.keepRatio).toBe(true);
    expect(def.rotateEnabled).toBe(true);
    expect(def.enabledAnchors).toEqual(CORNER_ANCHORS);
  });

  it('returns CORNER_ANCHORS and rotation for ellipse (no keepRatio)', () => {
    const def = getHandleDefinition(makeShape('ellipse'));
    expect(def.handleType).toBe('bounding-box');
    expect(def.keepRatio).toBe(false);
    expect(def.rotateEnabled).toBe(true);
    expect(def.enabledAnchors).toEqual(ALL_ANCHORS);
  });
});

// ---------------------------------------------------------------------------
// Tests: IRText
// ---------------------------------------------------------------------------

describe('getHandleDefinition — text', () => {
  it('returns bounding-box handle type', () => {
    const def = getHandleDefinition(textEl);
    expect(def.handleType).toBe('bounding-box');
  });

  it('has no rotation and ALL_ANCHORS', () => {
    const def = getHandleDefinition(textEl);
    expect(def.keepRatio).toBe(false);
    expect(def.rotateEnabled).toBe(false);
    expect(def.enabledAnchors).toEqual(ALL_ANCHORS);
  });
});

// ---------------------------------------------------------------------------
// Tests: IRImage
// ---------------------------------------------------------------------------

describe('getHandleDefinition — image', () => {
  it('returns bounding-box with keepRatio', () => {
    const def = getHandleDefinition(imageEl);
    expect(def.handleType).toBe('bounding-box');
    expect(def.keepRatio).toBe(true);
  });

  it('has CORNER_ANCHORS only and no rotation', () => {
    const def = getHandleDefinition(imageEl);
    expect(def.rotateEnabled).toBe(false);
    expect(def.enabledAnchors).toEqual(CORNER_ANCHORS);
  });
});

// ---------------------------------------------------------------------------
// Tests: IRLine
// ---------------------------------------------------------------------------

describe('getHandleDefinition — line', () => {
  it('returns endpoint handle type', () => {
    const def = getHandleDefinition(lineEl);
    expect(def.handleType).toBe('endpoint');
  });

  it('has no anchors, no rotation, no keepRatio', () => {
    const def = getHandleDefinition(lineEl);
    expect(def.keepRatio).toBe(false);
    expect(def.rotateEnabled).toBe(false);
    expect(def.enabledAnchors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests: IRPath
// ---------------------------------------------------------------------------

describe('getHandleDefinition — path', () => {
  it('returns bounding-box with keepRatio', () => {
    const def = getHandleDefinition(pathEl);
    expect(def.handleType).toBe('bounding-box');
    expect(def.keepRatio).toBe(true);
  });

  it('has CORNER_ANCHORS and rotation enabled', () => {
    const def = getHandleDefinition(pathEl);
    expect(def.rotateEnabled).toBe(true);
    expect(def.enabledAnchors).toEqual(CORNER_ANCHORS);
  });
});

// ---------------------------------------------------------------------------
// Tests: IREdge
// ---------------------------------------------------------------------------

describe('getHandleDefinition — edge', () => {
  it('returns connector handle type', () => {
    const def = getHandleDefinition(edgeEl);
    expect(def.handleType).toBe('connector');
  });

  it('has no anchors, no rotation, no keepRatio', () => {
    const def = getHandleDefinition(edgeEl);
    expect(def.keepRatio).toBe(false);
    expect(def.rotateEnabled).toBe(false);
    expect(def.enabledAnchors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests: IRContainer
// ---------------------------------------------------------------------------

describe('getHandleDefinition — container', () => {
  it('returns bounding-box handle type', () => {
    const def = getHandleDefinition(containerEl);
    expect(def.handleType).toBe('bounding-box');
  });

  it('has ALL_ANCHORS, no rotation, no keepRatio', () => {
    const def = getHandleDefinition(containerEl);
    expect(def.keepRatio).toBe(false);
    expect(def.rotateEnabled).toBe(false);
    expect(def.enabledAnchors).toEqual(ALL_ANCHORS);
  });
});

// ---------------------------------------------------------------------------
// Tests: isKeepRatioShape
// ---------------------------------------------------------------------------

describe('isKeepRatioShape', () => {
  it('returns true for circle', () => {
    expect(isKeepRatioShape('circle')).toBe(true);
  });

  it('returns false for rect', () => {
    expect(isKeepRatioShape('rect')).toBe(false);
  });

  it('returns false for ellipse', () => {
    expect(isKeepRatioShape('ellipse')).toBe(false);
  });

  it('returns false for diamond', () => {
    expect(isKeepRatioShape('diamond')).toBe(false);
  });

  it('returns false for pill', () => {
    expect(isKeepRatioShape('pill')).toBe(false);
  });

  it('returns false for hexagon', () => {
    expect(isKeepRatioShape('hexagon')).toBe(false);
  });

  it('returns false for triangle', () => {
    expect(isKeepRatioShape('triangle')).toBe(false);
  });

  it('returns false for parallelogram', () => {
    expect(isKeepRatioShape('parallelogram')).toBe(false);
  });
});
