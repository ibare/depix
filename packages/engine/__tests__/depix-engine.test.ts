/**
 * DepixEngine Tests
 *
 * Tests the fitToAspectRatio utility used by the engine to auto-fit
 * the Konva Stage to the IR's aspect ratio within available space.
 */

import { describe, it, expect } from 'vitest';
import { fitToAspectRatio } from '../src/depix-engine.js';

// ===========================================================================
// fitToAspectRatio — pure function tests
// ===========================================================================

describe('fitToAspectRatio', () => {
  describe('exact match (no scaling needed)', () => {
    it('16:9 in 800x450 → 800x450', () => {
      const result = fitToAspectRatio(800, 450, { width: 16, height: 9 });
      expect(result).toEqual({ width: 800, height: 450 });
    });

    it('1:1 in 500x500 → 500x500', () => {
      const result = fitToAspectRatio(500, 500, { width: 1, height: 1 });
      expect(result).toEqual({ width: 500, height: 500 });
    });

    it('4:3 in 400x300 → 400x300', () => {
      const result = fitToAspectRatio(400, 300, { width: 4, height: 3 });
      expect(result).toEqual({ width: 400, height: 300 });
    });
  });

  describe('height-constrained (viewport wider than canvas AR)', () => {
    it('1:1 in 800x450 → 450x450', () => {
      const result = fitToAspectRatio(800, 450, { width: 1, height: 1 });
      expect(result).toEqual({ width: 450, height: 450 });
    });

    it('4:3 in 800x450 → 600x450', () => {
      const result = fitToAspectRatio(800, 450, { width: 4, height: 3 });
      expect(result).toEqual({ width: 600, height: 450 });
    });

    it('9:16 in 800x450 → 253x450', () => {
      const result = fitToAspectRatio(800, 450, { width: 9, height: 16 });
      expect(result.width).toBe(Math.round(450 * 9 / 16));
      expect(result.height).toBe(450);
    });

    it('1:2 in 1000x400 → 200x400', () => {
      const result = fitToAspectRatio(1000, 400, { width: 1, height: 2 });
      expect(result).toEqual({ width: 200, height: 400 });
    });
  });

  describe('width-constrained (viewport taller than canvas AR)', () => {
    it('16:9 in 600x600 → 600x338', () => {
      const result = fitToAspectRatio(600, 600, { width: 16, height: 9 });
      expect(result.width).toBe(600);
      expect(result.height).toBe(Math.round(600 * 9 / 16));
    });

    it('16:9 in 400x400 → 400x225', () => {
      const result = fitToAspectRatio(400, 400, { width: 16, height: 9 });
      expect(result.width).toBe(400);
      expect(result.height).toBe(225);
    });

    it('2:1 in 300x500 → 300x150', () => {
      const result = fitToAspectRatio(300, 500, { width: 2, height: 1 });
      expect(result).toEqual({ width: 300, height: 150 });
    });

    it('3:2 in 600x800 → 600x400', () => {
      const result = fitToAspectRatio(600, 800, { width: 3, height: 2 });
      expect(result).toEqual({ width: 600, height: 400 });
    });
  });

  describe('edge cases', () => {
    it('very wide aspect ratio (32:9)', () => {
      const result = fitToAspectRatio(800, 450, { width: 32, height: 9 });
      // canvasAR = 32/9 ≈ 3.56, viewAR = 800/450 ≈ 1.78
      // width-constrained: width = 800, height = 800 * 9/32 = 225
      expect(result.width).toBe(800);
      expect(result.height).toBe(225);
    });

    it('very tall aspect ratio (9:32)', () => {
      const result = fitToAspectRatio(800, 450, { width: 9, height: 32 });
      // canvasAR = 9/32 ≈ 0.28, viewAR = 800/450 ≈ 1.78
      // height-constrained: width = 450 * 9/32 ≈ 127, height = 450
      expect(result.width).toBe(Math.round(450 * 9 / 32));
      expect(result.height).toBe(450);
    });

    it('small available space', () => {
      const result = fitToAspectRatio(100, 100, { width: 16, height: 9 });
      expect(result.width).toBe(100);
      expect(result.height).toBe(Math.round(100 * 9 / 16));
    });

    it('large available space', () => {
      const result = fitToAspectRatio(3840, 2160, { width: 16, height: 9 });
      expect(result).toEqual({ width: 3840, height: 2160 });
    });
  });

  describe('integration with CoordinateTransform expectations', () => {
    // When the engine fits the stage to the aspect ratio, the CoordinateTransform
    // receives viewport dimensions that exactly match the canvas AR.
    // This means offset should be 0 in both directions.

    it('fitted 1:1 viewport eliminates letterbox/pillarbox offset', () => {
      // Available: 800x450, AR: 1:1 → fitted: 450x450
      const fitted = fitToAspectRatio(800, 450, { width: 1, height: 1 });
      // When CoordinateTransform uses {width:450, height:450} with 1:1 AR,
      // there should be no offset. We verify by checking the ratio matches.
      const viewportAR = fitted.width / fitted.height;
      const canvasAR = 1 / 1;
      expect(viewportAR).toBeCloseTo(canvasAR, 2);
    });

    it('fitted 4:3 viewport matches canvas AR', () => {
      const fitted = fitToAspectRatio(1600, 900, { width: 4, height: 3 });
      const viewportAR = fitted.width / fitted.height;
      const canvasAR = 4 / 3;
      expect(viewportAR).toBeCloseTo(canvasAR, 2);
    });

    it('fitted 16:9 viewport matches canvas AR', () => {
      const fitted = fitToAspectRatio(500, 500, { width: 16, height: 9 });
      const viewportAR = fitted.width / fitted.height;
      const canvasAR = 16 / 9;
      expect(viewportAR).toBeCloseTo(canvasAR, 1);
    });
  });
});
