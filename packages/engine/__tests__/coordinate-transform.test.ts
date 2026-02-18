import { describe, it, expect } from 'vitest';
import { CoordinateTransform } from '../src/coordinate-transform.js';

describe('CoordinateTransform', () => {
  describe('16:9 aspect ratio, 1600x900 viewport', () => {
    const transform = new CoordinateTransform(
      { width: 1600, height: 900 },
      { width: 16, height: 9 },
    );

    it('converts origin (0,0) to pixel coordinates', () => {
      const p = transform.toAbsolutePoint({ x: 0, y: 0 });
      expect(p.x).toBeCloseTo(0);
      expect(p.y).toBeCloseTo(0);
    });

    it('converts (100,100) to (1600,900)', () => {
      const p = transform.toAbsolutePoint({ x: 100, y: 100 });
      expect(p.x).toBeCloseTo(1600);
      expect(p.y).toBeCloseTo(900);
    });

    it('converts center (50,50) correctly', () => {
      const p = transform.toAbsolutePoint({ x: 50, y: 50 });
      expect(p.x).toBeCloseTo(800);
      expect(p.y).toBeCloseTo(450);
    });

    it('converts bounds correctly', () => {
      const b = transform.toAbsoluteBounds({ x: 10, y: 20, w: 30, h: 40 });
      expect(b.x).toBeCloseTo(160);
      expect(b.y).toBeCloseTo(180);
      expect(b.width).toBeCloseTo(480);
      expect(b.height).toBeCloseTo(360);
    });

    it('converts size correctly', () => {
      expect(transform.toAbsoluteSize(10)).toBeCloseTo(90);
    });

    it('round-trips points', () => {
      const original = { x: 25, y: 75 };
      const abs = transform.toAbsolutePoint(original);
      const back = transform.toRelativePoint(abs.x, abs.y);
      expect(back.x).toBeCloseTo(25);
      expect(back.y).toBeCloseTo(75);
    });
  });

  describe('pillarbox (wide viewport for narrow canvas)', () => {
    // 1600x900 viewport with 4:3 aspect ratio
    const transform = new CoordinateTransform(
      { width: 1600, height: 900 },
      { width: 4, height: 3 },
    );

    it('adds horizontal offset', () => {
      const p = transform.toAbsolutePoint({ x: 0, y: 0 });
      // 4:3 → effective width = 900 * 4/3 = 1200, offset = (1600-1200)/2 = 200
      expect(p.x).toBeCloseTo(200);
      expect(p.y).toBeCloseTo(0);
    });

    it('center is at viewport center', () => {
      const p = transform.toAbsolutePoint({ x: 50, y: 50 });
      expect(p.x).toBeCloseTo(800);
      expect(p.y).toBeCloseTo(450);
    });
  });

  describe('letterbox (tall viewport for wide canvas)', () => {
    // 800x800 viewport with 16:9 aspect ratio
    const transform = new CoordinateTransform(
      { width: 800, height: 800 },
      { width: 16, height: 9 },
    );

    it('adds vertical offset', () => {
      const p = transform.toAbsolutePoint({ x: 0, y: 0 });
      // effective width = 800, effective height = 800 * 9/16 = 450
      // offset = (800 - 450) / 2 = 175
      expect(p.x).toBeCloseTo(0);
      expect(p.y).toBeCloseTo(175);
    });
  });

  describe('1:1 aspect ratio', () => {
    const transform = new CoordinateTransform(
      { width: 500, height: 500 },
      { width: 1, height: 1 },
    );

    it('maps (0,0) to (0,0)', () => {
      const p = transform.toAbsolutePoint({ x: 0, y: 0 });
      expect(p.x).toBeCloseTo(0);
      expect(p.y).toBeCloseTo(0);
    });

    it('maps (100,100) to (500,500)', () => {
      const p = transform.toAbsolutePoint({ x: 100, y: 100 });
      expect(p.x).toBeCloseTo(500);
      expect(p.y).toBeCloseTo(500);
    });
  });

  describe('getScale', () => {
    it('returns scale factors', () => {
      const transform = new CoordinateTransform(
        { width: 1000, height: 1000 },
        { width: 1, height: 1 },
      );
      const scale = transform.getScale();
      expect(scale.scaleX).toBeCloseTo(10);
      expect(scale.scaleY).toBeCloseTo(10);
    });
  });
});
