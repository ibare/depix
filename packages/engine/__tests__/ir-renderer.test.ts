import { describe, it, expect, beforeEach } from 'vitest';
import Konva from 'konva';
import { renderElement, renderElements } from '../src/ir-renderer.js';
import { CoordinateTransform } from '../src/coordinate-transform.js';
import type {
  IRShape,
  IRText,
  IRLine,
  IREdge,
  IRContainer,
  IRImage,
  IRPath,
} from '@depix/core';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let transform: CoordinateTransform;

beforeEach(() => {
  transform = new CoordinateTransform(
    { width: 1000, height: 1000 },
    { width: 1, height: 1 },
  );
});

// ---------------------------------------------------------------------------
// Shape rendering
// ---------------------------------------------------------------------------

describe('renderElement — shape', () => {
  const baseShape: IRShape = {
    id: 'shape-1',
    type: 'shape',
    shape: 'rect',
    bounds: { x: 10, y: 10, w: 20, h: 15 },
    style: { fill: '#ff0000', stroke: '#000000', strokeWidth: 0.2 },
  };

  it('renders rect shape as Konva.Group with Konva.Rect child', () => {
    const node = renderElement(baseShape, transform);
    expect(node).toBeInstanceOf(Konva.Group);
    const children = (node as Konva.Group).getChildren();
    expect(children.length).toBeGreaterThanOrEqual(1);
    expect(children[0]).toBeInstanceOf(Konva.Rect);
  });

  it('applies correct position from bounds', () => {
    const node = renderElement(baseShape, transform);
    // 10 * 10 (scale) = 100
    expect(node.x()).toBeCloseTo(100);
    expect(node.y()).toBeCloseTo(100);
  });

  it('sets the element id', () => {
    const node = renderElement(baseShape, transform);
    expect(node.id()).toBe('shape-1');
  });

  it('renders circle shape', () => {
    const circle: IRShape = { ...baseShape, shape: 'circle', id: 'c1' };
    const node = renderElement(circle, transform);
    const children = (node as Konva.Group).getChildren();
    expect(children[0]).toBeInstanceOf(Konva.Circle);
  });

  it('renders ellipse shape', () => {
    const ellipse: IRShape = { ...baseShape, shape: 'ellipse', id: 'e1' };
    const node = renderElement(ellipse, transform);
    const children = (node as Konva.Group).getChildren();
    expect(children[0]).toBeInstanceOf(Konva.Ellipse);
  });

  it('renders diamond shape as closed Line', () => {
    const diamond: IRShape = { ...baseShape, shape: 'diamond', id: 'd1' };
    const node = renderElement(diamond, transform);
    const children = (node as Konva.Group).getChildren();
    expect(children[0]).toBeInstanceOf(Konva.Line);
  });

  it('renders pill shape as Rect with large cornerRadius', () => {
    const pill: IRShape = { ...baseShape, shape: 'pill', id: 'p1' };
    const node = renderElement(pill, transform);
    const children = (node as Konva.Group).getChildren();
    expect(children[0]).toBeInstanceOf(Konva.Rect);
    expect((children[0] as Konva.Rect).cornerRadius()).toBeGreaterThan(0);
  });

  it('renders triangle shape', () => {
    const triangle: IRShape = { ...baseShape, shape: 'triangle', id: 't1' };
    const node = renderElement(triangle, transform);
    const children = (node as Konva.Group).getChildren();
    expect(children[0]).toBeInstanceOf(Konva.Line);
  });

  it('renders hexagon shape', () => {
    const hexagon: IRShape = { ...baseShape, shape: 'hexagon', id: 'h1' };
    const node = renderElement(hexagon, transform);
    const children = (node as Konva.Group).getChildren();
    expect(children[0]).toBeInstanceOf(Konva.Line);
  });

  it('renders parallelogram shape', () => {
    const para: IRShape = { ...baseShape, shape: 'parallelogram', id: 'pg1' };
    const node = renderElement(para, transform);
    const children = (node as Konva.Group).getChildren();
    expect(children[0]).toBeInstanceOf(Konva.Line);
  });

  it('renders inner text', () => {
    const withText: IRShape = {
      ...baseShape,
      id: 'wt1',
      innerText: {
        content: 'Hello',
        color: '#000000',
        fontSize: 1.4,
        align: 'center',
        valign: 'middle',
      },
    };
    const node = renderElement(withText, transform);
    const children = (node as Konva.Group).getChildren();
    expect(children.length).toBe(2); // shape + text
    expect(children[1]).toBeInstanceOf(Konva.Text);
    expect((children[1] as Konva.Text).text()).toBe('Hello');
  });

  it('applies cornerRadius to rect', () => {
    const rounded: IRShape = { ...baseShape, cornerRadius: 2, id: 'r1' };
    const node = renderElement(rounded, transform);
    const rect = (node as Konva.Group).getChildren()[0] as Konva.Rect;
    expect(rect.cornerRadius()).toBeGreaterThan(0);
  });

  it('applies per-corner radius', () => {
    const perCorner: IRShape = {
      ...baseShape,
      cornerRadius: { tl: 1, tr: 2, br: 3, bl: 4 },
      id: 'pc1',
    };
    const node = renderElement(perCorner, transform);
    const rect = (node as Konva.Group).getChildren()[0] as Konva.Rect;
    const cr = rect.cornerRadius();
    expect(Array.isArray(cr)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Text rendering
// ---------------------------------------------------------------------------

describe('renderElement — text', () => {
  const baseText: IRText = {
    id: 'text-1',
    type: 'text',
    bounds: { x: 5, y: 5, w: 30, h: 10 },
    style: {},
    content: 'Hello World',
    fontSize: 1.4,
    color: '#333333',
  };

  it('renders as Konva.Text', () => {
    const node = renderElement(baseText, transform);
    expect(node).toBeInstanceOf(Konva.Text);
  });

  it('sets text content', () => {
    const node = renderElement(baseText, transform) as Konva.Text;
    expect(node.text()).toBe('Hello World');
  });

  it('applies fill color', () => {
    const node = renderElement(baseText, transform) as Konva.Text;
    expect(node.fill()).toBe('#333333');
  });

  it('applies bold font style', () => {
    const bold: IRText = { ...baseText, fontWeight: 'bold', id: 'b1' };
    const node = renderElement(bold, transform) as Konva.Text;
    expect(node.fontStyle()).toContain('bold');
  });

  it('applies italic font style', () => {
    const italic: IRText = { ...baseText, fontStyle: 'italic', id: 'i1' };
    const node = renderElement(italic, transform) as Konva.Text;
    expect(node.fontStyle()).toContain('italic');
  });
});

// ---------------------------------------------------------------------------
// Line rendering
// ---------------------------------------------------------------------------

describe('renderElement — line', () => {
  const baseLine: IRLine = {
    id: 'line-1',
    type: 'line',
    bounds: { x: 0, y: 0, w: 100, h: 100 },
    style: { stroke: '#000000', strokeWidth: 0.2 },
    from: { x: 10, y: 50 },
    to: { x: 90, y: 50 },
  };

  it('renders as Konva.Group', () => {
    const node = renderElement(baseLine, transform);
    expect(node).toBeInstanceOf(Konva.Group);
  });

  it('contains a Konva.Line child', () => {
    const node = renderElement(baseLine, transform) as Konva.Group;
    const children = node.getChildren();
    expect(children.length).toBeGreaterThanOrEqual(1);
    expect(children[0]).toBeInstanceOf(Konva.Line);
  });
});

// ---------------------------------------------------------------------------
// Edge rendering
// ---------------------------------------------------------------------------

describe('renderElement — edge', () => {
  const baseEdge: IREdge = {
    id: 'edge-1',
    type: 'edge',
    bounds: { x: 0, y: 0, w: 100, h: 100 },
    style: { stroke: '#666', strokeWidth: 0.2 },
    fromId: 'a',
    toId: 'b',
    fromAnchor: { x: 30, y: 50 },
    toAnchor: { x: 70, y: 50 },
    path: { type: 'straight' },
    arrowEnd: 'triangle',
  };

  it('renders as Konva.Group', () => {
    const node = renderElement(baseEdge, transform);
    expect(node).toBeInstanceOf(Konva.Group);
  });

  it('renders straight edge with line and arrow', () => {
    const node = renderElement(baseEdge, transform) as Konva.Group;
    // At least 2 children: line + arrow marker
    expect(node.getChildren().length).toBeGreaterThanOrEqual(2);
  });

  it('renders polyline edge', () => {
    const polyEdge: IREdge = {
      ...baseEdge,
      id: 'pe1',
      path: {
        type: 'polyline',
        points: [{ x: 40, y: 30 }, { x: 60, y: 70 }],
      },
    };
    const node = renderElement(polyEdge, transform) as Konva.Group;
    expect(node.getChildren().length).toBeGreaterThanOrEqual(1);
  });

  it('renders bezier edge', () => {
    const bezierEdge: IREdge = {
      ...baseEdge,
      id: 'be1',
      path: {
        type: 'bezier',
        controlPoints: [{
          cp1: { x: 40, y: 30 },
          cp2: { x: 60, y: 70 },
          end: { x: 70, y: 50 },
        }],
      },
    };
    const node = renderElement(bezierEdge, transform) as Konva.Group;
    expect(node.getChildren().length).toBeGreaterThanOrEqual(1);
  });

  it('renders edge labels', () => {
    const labeledEdge: IREdge = {
      ...baseEdge,
      id: 'le1',
      labels: [{
        text: 'connection',
        position: { x: 50, y: 50 },
        placement: 'middle',
        fontSize: 1.0,
        color: '#000000',
      }],
    };
    const node = renderElement(labeledEdge, transform) as Konva.Group;
    const textChildren = node.getChildren().filter(c => c instanceof Konva.Text);
    expect(textChildren.length).toBeGreaterThanOrEqual(1);
  });

  it('renders bidirectional edge with two arrows', () => {
    const biEdge: IREdge = {
      ...baseEdge,
      id: 'bi1',
      arrowStart: 'triangle',
      arrowEnd: 'triangle',
    };
    const node = renderElement(biEdge, transform) as Konva.Group;
    // line + 2 arrows
    expect(node.getChildren().length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Container rendering
// ---------------------------------------------------------------------------

describe('renderElement — container', () => {
  const baseContainer: IRContainer = {
    id: 'container-1',
    type: 'container',
    bounds: { x: 5, y: 5, w: 90, h: 90 },
    style: { fill: '#f0f0f0' },
    children: [
      {
        id: 'child-1',
        type: 'shape',
        shape: 'rect',
        bounds: { x: 10, y: 10, w: 20, h: 15 },
        style: { fill: '#ff0000' },
      } as IRShape,
    ],
  };

  it('renders as Konva.Group', () => {
    const node = renderElement(baseContainer, transform);
    expect(node).toBeInstanceOf(Konva.Group);
  });

  it('renders background rect', () => {
    const node = renderElement(baseContainer, transform) as Konva.Group;
    const children = node.getChildren();
    // First child should be background rect
    expect(children[0]).toBeInstanceOf(Konva.Rect);
  });

  it('renders child elements', () => {
    const node = renderElement(baseContainer, transform) as Konva.Group;
    const children = node.getChildren();
    // Background rect + child group
    expect(children.length).toBeGreaterThanOrEqual(2);
  });

  it('sets container id', () => {
    const node = renderElement(baseContainer, transform);
    expect(node.id()).toBe('container-1');
  });
});

// ---------------------------------------------------------------------------
// Image rendering
// ---------------------------------------------------------------------------

describe('renderElement — image', () => {
  const baseImage: IRImage = {
    id: 'img-1',
    type: 'image',
    bounds: { x: 10, y: 10, w: 30, h: 20 },
    style: {},
    src: 'https://example.com/img.png',
  };

  it('renders as Konva.Group', () => {
    const node = renderElement(baseImage, transform);
    expect(node).toBeInstanceOf(Konva.Group);
  });

  it('contains a placeholder rect', () => {
    const node = renderElement(baseImage, transform) as Konva.Group;
    const children = node.getChildren();
    expect(children[0]).toBeInstanceOf(Konva.Rect);
  });
});

// ---------------------------------------------------------------------------
// Path rendering
// ---------------------------------------------------------------------------

describe('renderElement — path', () => {
  const basePath: IRPath = {
    id: 'path-1',
    type: 'path',
    bounds: { x: 0, y: 0, w: 50, h: 50 },
    style: { stroke: '#000', strokeWidth: 0.1 },
    d: 'M0,0 L50,50',
  };

  it('renders as Konva.Path', () => {
    const node = renderElement(basePath, transform);
    expect(node).toBeInstanceOf(Konva.Path);
  });

  it('sets path id', () => {
    const node = renderElement(basePath, transform);
    expect(node.id()).toBe('path-1');
  });
});

// ---------------------------------------------------------------------------
// renderElements
// ---------------------------------------------------------------------------

describe('renderElements', () => {
  it('renders multiple elements into a group', () => {
    const elements: IRShape[] = [
      {
        id: 's1',
        type: 'shape',
        shape: 'rect',
        bounds: { x: 0, y: 0, w: 10, h: 10 },
        style: {},
      },
      {
        id: 's2',
        type: 'shape',
        shape: 'circle',
        bounds: { x: 20, y: 20, w: 10, h: 10 },
        style: {},
      },
    ];

    const group = renderElements(elements, transform);
    expect(group).toBeInstanceOf(Konva.Group);
    expect(group.getChildren().length).toBe(2);
  });

  it('returns empty group for no elements', () => {
    const group = renderElements([], transform);
    expect(group.getChildren().length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Style application
// ---------------------------------------------------------------------------

describe('renderElement — styles', () => {
  it('applies shadow from IRStyle', () => {
    const shape: IRShape = {
      id: 'shadow-1',
      type: 'shape',
      shape: 'rect',
      bounds: { x: 10, y: 10, w: 20, h: 15 },
      style: {
        fill: '#fff',
        shadow: { offsetX: 0, offsetY: 2, blur: 6, color: 'rgba(0,0,0,0.1)' },
      },
    };
    const node = renderElement(shape, transform) as Konva.Group;
    const rect = node.getChildren()[0] as Konva.Rect;
    expect(rect.shadowEnabled()).toBe(true);
    expect(rect.shadowColor()).toBe('rgba(0,0,0,0.1)');
  });

  it('applies dash pattern', () => {
    const shape: IRShape = {
      id: 'dash-1',
      type: 'shape',
      shape: 'rect',
      bounds: { x: 10, y: 10, w: 20, h: 15 },
      style: { stroke: '#000', dashPattern: [4, 3] },
    };
    const node = renderElement(shape, transform) as Konva.Group;
    const rect = node.getChildren()[0] as Konva.Rect;
    expect(rect.dash()).toBeDefined();
    expect(rect.dash()!.length).toBe(2);
  });

  it('applies opacity transform', () => {
    const shape: IRShape = {
      id: 'opacity-1',
      type: 'shape',
      shape: 'rect',
      bounds: { x: 10, y: 10, w: 20, h: 15 },
      style: { fill: '#fff' },
      transform: { opacity: 0.5 },
    };
    const node = renderElement(shape, transform);
    expect(node.opacity()).toBeCloseTo(0.5);
  });

  it('applies rotation transform', () => {
    const shape: IRShape = {
      id: 'rotate-1',
      type: 'shape',
      shape: 'rect',
      bounds: { x: 10, y: 10, w: 20, h: 15 },
      style: { fill: '#fff' },
      transform: { rotate: 45 },
    };
    const node = renderElement(shape, transform);
    expect(node.rotation()).toBeCloseTo(45);
  });
});
