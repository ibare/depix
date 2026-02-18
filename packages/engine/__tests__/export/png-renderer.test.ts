import { describe, it, expect } from 'vitest';
import { renderIRToPNG, renderSceneToPNG } from '../../src/export/png-renderer.js';
import type { DepixIR, IRScene, IRMeta } from '@depix/core';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function createTestMeta(
  aspectRatio: { width: number; height: number } = { width: 16, height: 9 },
): IRMeta {
  return {
    aspectRatio,
    background: { type: 'solid', color: '#ffffff' },
    drawingStyle: 'default',
  };
}

function createTestIR(
  aspectRatio: { width: number; height: number } = { width: 16, height: 9 },
): DepixIR {
  return {
    meta: createTestMeta(aspectRatio),
    scenes: [
      {
        id: 'scene-1',
        elements: [
          {
            id: 's1',
            type: 'shape',
            shape: 'rect',
            bounds: { x: 10, y: 10, w: 30, h: 20 },
            style: { fill: '#ff0000' },
          },
          {
            id: 's2',
            type: 'shape',
            shape: 'circle',
            bounds: { x: 50, y: 50, w: 20, h: 20 },
            style: { fill: '#0000ff' },
          },
        ],
      },
      {
        id: 'scene-2',
        elements: [
          {
            id: 's3',
            type: 'shape',
            shape: 'rect',
            bounds: { x: 20, y: 20, w: 60, h: 60 },
            style: { fill: '#00ff00' },
          },
        ],
      },
    ],
    transitions: [],
  };
}

function createEmptySceneIR(): DepixIR {
  return {
    meta: createTestMeta(),
    scenes: [
      {
        id: 'empty-scene',
        elements: [],
      },
    ],
    transitions: [],
  };
}

function createNoScenesIR(): DepixIR {
  return {
    meta: createTestMeta(),
    scenes: [],
    transitions: [],
  };
}

// ---------------------------------------------------------------------------
// Basic rendering
// ---------------------------------------------------------------------------

describe('renderIRToPNG — basic rendering', () => {
  it('returns a PNGResult with all required properties', () => {
    const ir = createTestIR();
    const result = renderIRToPNG(ir);

    expect(result).toHaveProperty('dataUrl');
    expect(result).toHaveProperty('displayWidth');
    expect(result).toHaveProperty('displayHeight');
    expect(result).toHaveProperty('pixelWidth');
    expect(result).toHaveProperty('pixelHeight');
  });

  it('returns a data URL that starts with the PNG data URI prefix', () => {
    const ir = createTestIR();
    const result = renderIRToPNG(ir);

    expect(result.dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('returns positive pixel dimensions', () => {
    const ir = createTestIR();
    const result = renderIRToPNG(ir);

    expect(result.pixelWidth).toBeGreaterThan(0);
    expect(result.pixelHeight).toBeGreaterThan(0);
  });

  it('produces expected dimensions with default scale=2 and baseSize=400', () => {
    const ir = createTestIR(); // 16:9
    const result = renderIRToPNG(ir);

    // ratio = 16/9 >= 1, so:
    // pixelWidth = round(400 * 2 * 1) = 800
    // pixelHeight = round(400 * 2 * (1 / (16/9))) = round(800 * 9/16) = 450
    expect(result.pixelWidth).toBe(800);
    expect(result.pixelHeight).toBe(450);
    expect(result.displayWidth).toBe(400);
    expect(result.displayHeight).toBe(225);
  });

  it('data URL contains valid base64 content after the prefix', () => {
    const ir = createTestIR();
    const result = renderIRToPNG(ir);

    const base64Part = result.dataUrl.replace(/^data:image\/png;base64,/, '');
    expect(base64Part.length).toBeGreaterThan(0);
    // Base64 characters only
    expect(base64Part).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});

// ---------------------------------------------------------------------------
// Custom options
// ---------------------------------------------------------------------------

describe('renderIRToPNG — custom options', () => {
  it('applies custom scale factor', () => {
    const ir = createTestIR(); // 16:9
    const result = renderIRToPNG(ir, 0, { scale: 3 });

    // pixelWidth = round(400 * 3 * 1) = 1200
    // pixelHeight = round(400 * 3 * (9/16)) = round(1200 * 9/16) = 675
    expect(result.pixelWidth).toBe(1200);
    expect(result.pixelHeight).toBe(675);
    expect(result.displayWidth).toBe(400);
    expect(result.displayHeight).toBe(225);
  });

  it('applies custom width and height overriding aspect ratio calculation', () => {
    const ir = createTestIR();
    const result = renderIRToPNG(ir, 0, { width: 1920, height: 1080 });

    expect(result.pixelWidth).toBe(1920);
    expect(result.pixelHeight).toBe(1080);
    // displayWidth/Height uses default scale=2
    expect(result.displayWidth).toBe(960);
    expect(result.displayHeight).toBe(540);
  });

  it('applies custom backgroundColor', () => {
    const ir = createTestIR();
    // Should not throw; we verify it produces a valid result
    const result = renderIRToPNG(ir, 0, { backgroundColor: '#ff0000' });

    expect(result.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.pixelWidth).toBeGreaterThan(0);
  });

  it('applies custom baseSize', () => {
    const ir = createTestIR(); // 16:9, default scale=2
    const result = renderIRToPNG(ir, 0, { baseSize: 200 });

    // pixelWidth = round(200 * 2 * 1) = 400
    // pixelHeight = round(200 * 2 * (9/16)) = round(400 * 9/16) = 225
    expect(result.pixelWidth).toBe(400);
    expect(result.pixelHeight).toBe(225);
  });

  it('combines custom scale and baseSize', () => {
    const ir = createTestIR(); // 16:9
    const result = renderIRToPNG(ir, 0, { scale: 1, baseSize: 100 });

    // pixelWidth = round(100 * 1 * 1) = 100
    // pixelHeight = round(100 * 1 * (9/16)) = round(56.25) = 56
    expect(result.pixelWidth).toBe(100);
    expect(result.pixelHeight).toBe(56);
    expect(result.displayWidth).toBe(100);
    expect(result.displayHeight).toBe(56);
  });
});

// ---------------------------------------------------------------------------
// Scene selection
// ---------------------------------------------------------------------------

describe('renderIRToPNG — scene selection', () => {
  it('renders first scene by default (sceneIndex=0)', () => {
    const ir = createTestIR();
    const result = renderIRToPNG(ir);

    // Should succeed and produce a valid image
    expect(result.dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('renders a specific scene by index', () => {
    const ir = createTestIR();
    const result = renderIRToPNG(ir, 1);

    // Should succeed and produce a valid image for scene-2
    expect(result.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.pixelWidth).toBeGreaterThan(0);
  });

  it('throws for out-of-range positive scene index', () => {
    const ir = createTestIR(); // 2 scenes

    expect(() => renderIRToPNG(ir, 5)).toThrow(/out of range/);
  });

  it('throws for negative scene index', () => {
    const ir = createTestIR();

    expect(() => renderIRToPNG(ir, -1)).toThrow(/out of range/);
  });
});

// ---------------------------------------------------------------------------
// Aspect ratio
// ---------------------------------------------------------------------------

describe('renderIRToPNG — aspect ratio', () => {
  it('16:9 produces a wider image than it is tall', () => {
    const ir = createTestIR({ width: 16, height: 9 });
    const result = renderIRToPNG(ir);

    expect(result.pixelWidth).toBeGreaterThan(result.pixelHeight);
  });

  it('4:3 produces different dimensions from 16:9', () => {
    const ir43 = createTestIR({ width: 4, height: 3 });
    const ir169 = createTestIR({ width: 16, height: 9 });

    const result43 = renderIRToPNG(ir43);
    const result169 = renderIRToPNG(ir169);

    // 4:3 produces a shorter width/height ratio than 16:9
    const ratio43 = result43.pixelWidth / result43.pixelHeight;
    const ratio169 = result169.pixelWidth / result169.pixelHeight;

    expect(ratio169).toBeGreaterThan(ratio43);
  });

  it('1:1 aspect ratio produces square image', () => {
    const ir = createTestIR({ width: 1, height: 1 });
    const result = renderIRToPNG(ir);

    expect(result.pixelWidth).toBe(result.pixelHeight);
  });

  it('portrait aspect ratio (9:16) produces a taller image', () => {
    const ir = createTestIR({ width: 9, height: 16 });
    const result = renderIRToPNG(ir);

    expect(result.pixelHeight).toBeGreaterThan(result.pixelWidth);
  });
});

// ---------------------------------------------------------------------------
// renderSceneToPNG
// ---------------------------------------------------------------------------

describe('renderSceneToPNG', () => {
  it('works with a standalone scene and meta', () => {
    const scene: IRScene = {
      id: 'standalone',
      elements: [
        {
          id: 'rect-1',
          type: 'shape',
          shape: 'rect',
          bounds: { x: 10, y: 10, w: 80, h: 80 },
          style: { fill: '#336699' },
        },
      ],
    };

    const meta = createTestMeta();
    const result = renderSceneToPNG(scene, meta);

    expect(result.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.pixelWidth).toBeGreaterThan(0);
    expect(result.pixelHeight).toBeGreaterThan(0);
  });

  it('uses scene background when scene has its own background', () => {
    const scene: IRScene = {
      id: 'with-bg',
      background: { type: 'solid', color: '#000000' },
      elements: [],
    };

    const meta = createTestMeta(); // white background
    const result = renderSceneToPNG(scene, meta);

    // Should produce a valid image (background override applied)
    expect(result.dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('falls back to meta background when scene has no background', () => {
    const scene: IRScene = {
      id: 'no-bg',
      elements: [],
    };

    const meta = createTestMeta(); // white background
    const result = renderSceneToPNG(scene, meta);

    expect(result.dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('accepts custom options', () => {
    const scene: IRScene = {
      id: 'custom-opts',
      elements: [],
    };

    const meta = createTestMeta();
    const result = renderSceneToPNG(scene, meta, {
      scale: 1,
      baseSize: 200,
    });

    // 16:9 at baseSize=200, scale=1:
    // pixelWidth = round(200 * 1 * 1) = 200
    // pixelHeight = round(200 * 1 * (9/16)) = round(112.5) = 113
    expect(result.pixelWidth).toBe(200);
    expect(result.pixelHeight).toBe(113);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('renderIRToPNG — edge cases', () => {
  it('renders an empty scene (no elements) as background only', () => {
    const ir = createEmptySceneIR();
    const result = renderIRToPNG(ir);

    expect(result.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.pixelWidth).toBeGreaterThan(0);
    expect(result.pixelHeight).toBeGreaterThan(0);
  });

  it('throws when IR has no scenes', () => {
    const ir = createNoScenesIR();

    expect(() => renderIRToPNG(ir)).toThrow(/no scenes/);
  });

  it('handles gradient background by falling back to white', () => {
    const ir: DepixIR = {
      meta: {
        aspectRatio: { width: 16, height: 9 },
        background: {
          type: 'linear-gradient',
          angle: 45,
          stops: [
            { position: 0, color: '#ff0000' },
            { position: 1, color: '#0000ff' },
          ],
        },
        drawingStyle: 'default',
      },
      scenes: [{ id: 's1', elements: [] }],
      transitions: [],
    };

    const result = renderIRToPNG(ir);
    // Should fall back to #ffffff for non-solid backgrounds
    expect(result.dataUrl).toMatch(/^data:image\/png;base64,/);
  });
});
