/**
 * Tests for IR builder factory functions.
 *
 * Verifies that each builder:
 * 1. Produces valid IR that passes validateElement()
 * 2. Respects overrides
 * 3. Generates unique IDs
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { validateElement, validateIR } from '../../../src/ir/validators.js';
import {
  shape,
  text,
  image,
  line,
  path,
  edge,
  container,
  scene,
  ir,
  bounds,
  meta,
  style,
  generateTestId,
  resetTestIds,
} from '../ir-builders.js';

describe('IR Builders', () => {
  beforeEach(() => {
    resetTestIds();
  });

  // -------------------------------------------------------------------------
  // generateTestId
  // -------------------------------------------------------------------------

  describe('generateTestId', () => {
    it('produces unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateTestId());
      }
      expect(ids.size).toBe(100);
    });

    it('follows test-{n} format', () => {
      const id1 = generateTestId();
      const id2 = generateTestId();
      expect(id1).toBe('test-1');
      expect(id2).toBe('test-2');
    });

    it('resets counter with resetTestIds', () => {
      generateTestId();
      generateTestId();
      resetTestIds();
      const id = generateTestId();
      expect(id).toBe('test-1');
    });
  });

  // -------------------------------------------------------------------------
  // bounds
  // -------------------------------------------------------------------------

  describe('bounds()', () => {
    it('creates default bounds', () => {
      const b = bounds();
      expect(b).toEqual({ x: 10, y: 10, w: 20, h: 15 });
    });

    it('accepts custom values', () => {
      const b = bounds(5, 15, 30, 25);
      expect(b).toEqual({ x: 5, y: 15, w: 30, h: 25 });
    });
  });

  // -------------------------------------------------------------------------
  // shape
  // -------------------------------------------------------------------------

  describe('shape()', () => {
    it('produces valid IR', () => {
      const s = shape();
      const result = validateElement(s);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('has correct defaults', () => {
      const s = shape();
      expect(s.type).toBe('shape');
      expect(s.shape).toBe('rect');
      expect(s.bounds).toEqual({ x: 10, y: 10, w: 20, h: 15 });
      expect(s.style).toEqual({});
    });

    it('respects overrides', () => {
      const s = shape({
        shape: 'circle',
        bounds: { x: 0, y: 0, w: 50, h: 50 },
        style: { fill: '#ff0000' },
      });
      expect(s.shape).toBe('circle');
      expect(s.bounds.w).toBe(50);
      expect(s.style.fill).toBe('#ff0000');
    });

    it('overrides id', () => {
      const s = shape({ id: 'custom-id' });
      expect(s.id).toBe('custom-id');
    });
  });

  // -------------------------------------------------------------------------
  // text
  // -------------------------------------------------------------------------

  describe('text()', () => {
    it('produces valid IR', () => {
      const t = text();
      const result = validateElement(t);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('has correct defaults', () => {
      const t = text();
      expect(t.type).toBe('text');
      expect(t.content).toBe('Hello');
      expect(t.fontSize).toBe(14);
      expect(t.color).toBe('#000000');
    });

    it('accepts custom content', () => {
      const t = text('World');
      expect(t.content).toBe('World');
    });

    it('respects overrides', () => {
      const t = text('Title', { fontSize: 24, fontWeight: 'bold' });
      expect(t.content).toBe('Title');
      expect(t.fontSize).toBe(24);
      expect(t.fontWeight).toBe('bold');
    });
  });

  // -------------------------------------------------------------------------
  // image
  // -------------------------------------------------------------------------

  describe('image()', () => {
    it('produces valid IR', () => {
      const img = image();
      const result = validateElement(img);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('has correct defaults', () => {
      const img = image();
      expect(img.type).toBe('image');
      expect(img.src).toBe('https://example.com/img.png');
    });

    it('accepts custom src', () => {
      const img = image('https://other.com/photo.jpg');
      expect(img.src).toBe('https://other.com/photo.jpg');
    });

    it('respects overrides', () => {
      const img = image('data:image/png;base64,...', { fit: 'cover', cornerRadius: 8 });
      expect(img.fit).toBe('cover');
      expect(img.cornerRadius).toBe(8);
    });
  });

  // -------------------------------------------------------------------------
  // line
  // -------------------------------------------------------------------------

  describe('line()', () => {
    it('produces valid IR', () => {
      const l = line();
      const result = validateElement(l);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('has correct defaults', () => {
      const l = line();
      expect(l.type).toBe('line');
      expect(l.from).toEqual({ x: 10, y: 50 });
      expect(l.to).toEqual({ x: 90, y: 50 });
    });

    it('respects overrides', () => {
      const l = line({
        from: { x: 0, y: 0 },
        to: { x: 100, y: 100 },
        arrowEnd: 'triangle',
      });
      expect(l.from).toEqual({ x: 0, y: 0 });
      expect(l.arrowEnd).toBe('triangle');
    });
  });

  // -------------------------------------------------------------------------
  // path
  // -------------------------------------------------------------------------

  describe('path()', () => {
    it('produces valid IR', () => {
      const p = path();
      const result = validateElement(p);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('has correct defaults', () => {
      const p = path();
      expect(p.type).toBe('path');
      expect(p.d).toBe('M0,0 L100,100');
    });

    it('accepts custom path data', () => {
      const p = path('M10,10 C20,20 40,20 50,10');
      expect(p.d).toBe('M10,10 C20,20 40,20 50,10');
    });

    it('respects overrides', () => {
      const p = path('M0,0 Z', { closed: true });
      expect(p.closed).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // edge
  // -------------------------------------------------------------------------

  describe('edge()', () => {
    it('produces valid IR', () => {
      const e = edge();
      const result = validateElement(e);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('has correct defaults', () => {
      const e = edge();
      expect(e.type).toBe('edge');
      expect(e.fromId).toBe('a');
      expect(e.toId).toBe('b');
      expect(e.path).toEqual({ type: 'straight' });
    });

    it('accepts custom from/to IDs', () => {
      const e = edge('node1', 'node2');
      expect(e.fromId).toBe('node1');
      expect(e.toId).toBe('node2');
    });

    it('respects overrides', () => {
      const e = edge('x', 'y', {
        arrowEnd: 'triangle',
        path: { type: 'polyline', points: [{ x: 50, y: 25 }] },
      });
      expect(e.arrowEnd).toBe('triangle');
      expect(e.path.type).toBe('polyline');
    });
  });

  // -------------------------------------------------------------------------
  // container
  // -------------------------------------------------------------------------

  describe('container()', () => {
    it('produces valid IR with no children', () => {
      const c = container();
      const result = validateElement(c);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('produces valid IR with children', () => {
      const c = container([shape(), text()]);
      const result = validateElement(c);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('has correct defaults', () => {
      const c = container();
      expect(c.type).toBe('container');
      expect(c.children).toEqual([]);
      expect(c.bounds).toEqual({ x: 5, y: 5, w: 90, h: 90 });
    });

    it('respects overrides', () => {
      const c = container([], { clip: true, bounds: { x: 0, y: 0, w: 100, h: 100 } });
      expect(c.clip).toBe(true);
      expect(c.bounds.w).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // scene
  // -------------------------------------------------------------------------

  describe('scene()', () => {
    it('creates a scene with no elements', () => {
      const s = scene();
      expect(s.id).toBeDefined();
      expect(s.elements).toEqual([]);
    });

    it('creates a scene with elements', () => {
      const s = scene([shape(), text()]);
      expect(s.elements).toHaveLength(2);
    });

    it('respects overrides', () => {
      const s = scene([], { id: 'scene-1', background: { type: 'solid', color: '#000' } });
      expect(s.id).toBe('scene-1');
      expect(s.background?.type).toBe('solid');
    });
  });

  // -------------------------------------------------------------------------
  // meta
  // -------------------------------------------------------------------------

  describe('meta()', () => {
    it('creates default meta', () => {
      const m = meta();
      expect(m.aspectRatio).toEqual({ width: 16, height: 9 });
      expect(m.background).toEqual({ type: 'solid', color: '#ffffff' });
      expect(m.drawingStyle).toBe('default');
    });

    it('respects overrides', () => {
      const m = meta({ drawingStyle: 'sketch' });
      expect(m.drawingStyle).toBe('sketch');
    });
  });

  // -------------------------------------------------------------------------
  // ir (full document)
  // -------------------------------------------------------------------------

  describe('ir()', () => {
    it('produces valid IR document', () => {
      const doc = ir();
      const result = validateIR(doc);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('creates single empty scene by default', () => {
      const doc = ir();
      expect(doc.scenes).toHaveLength(1);
      expect(doc.scenes[0]!.elements).toEqual([]);
    });

    it('accepts custom scenes', () => {
      const s1 = scene([shape()]);
      const s2 = scene([text()]);
      const doc = ir([s1, s2]);
      expect(doc.scenes).toHaveLength(2);
    });

    it('validates complex document with nested containers', () => {
      const doc = ir([
        scene([
          container([shape(), text(), image()]),
          edge('a', 'b'),
          line(),
        ]),
      ]);
      const result = validateIR(doc);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('respects overrides', () => {
      const doc = ir(undefined, {
        meta: meta({ drawingStyle: 'sketch' }),
        transitions: [],
      });
      expect(doc.meta.drawingStyle).toBe('sketch');
    });
  });

  // -------------------------------------------------------------------------
  // Unique IDs across builders
  // -------------------------------------------------------------------------

  describe('unique IDs', () => {
    it('generates unique IDs across different element types', () => {
      const elements = [
        shape(),
        text(),
        image(),
        line(),
        path(),
        edge(),
        container(),
      ];
      const ids = elements.map((e) => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(elements.length);
    });
  });

  // -------------------------------------------------------------------------
  // style helper
  // -------------------------------------------------------------------------

  describe('style()', () => {
    it('creates empty style by default', () => {
      const s = style();
      expect(s).toEqual({});
    });

    it('accepts overrides', () => {
      const s = style({ fill: '#ff0000', strokeWidth: 2 });
      expect(s.fill).toBe('#ff0000');
      expect(s.strokeWidth).toBe(2);
    });
  });
});
