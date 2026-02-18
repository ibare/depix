/**
 * Example: Build a DepixIR document programmatically
 *
 * Instead of writing DSL, you can construct IR objects directly
 * and render them with DepixCanvas or DepixEngine.
 */
import type { DepixIR, IRScene, IRShape, IRText, IREdge } from '@depix/core';
import { generateId } from '@depix/core';

// Create elements
const nodeA: IRShape = {
  id: generateId(),
  type: 'shape',
  bounds: { x: 10, y: 35, w: 20, h: 12 },
  shape: 'rect',
  style: { fill: '#4263eb', stroke: '#364fc7', strokeWidth: 1 },
  text: { content: 'Service A', fontSize: 14, fontFamily: 'sans-serif', align: 'center' },
};

const nodeB: IRShape = {
  id: generateId(),
  type: 'shape',
  bounds: { x: 60, y: 35, w: 20, h: 12 },
  shape: 'rect',
  style: { fill: '#40c057', stroke: '#2f9e44', strokeWidth: 1 },
  text: { content: 'Service B', fontSize: 14, fontFamily: 'sans-serif', align: 'center' },
};

const edge: IREdge = {
  id: generateId(),
  type: 'edge',
  bounds: { x: 0, y: 0, w: 100, h: 100 },
  fromId: nodeA.id,
  toId: nodeB.id,
  route: { type: 'straight', x1: 30, y1: 41, x2: 60, y2: 41 },
  style: { stroke: '#868e96', strokeWidth: 1 },
  endArrow: 'arrow',
};

// Assemble the IR document
const scene: IRScene = {
  id: generateId(),
  name: 'Architecture',
  elements: [nodeA, nodeB, edge],
};

const ir: DepixIR = {
  meta: {
    aspectRatio: { width: 16, height: 9 },
    background: { type: 'solid', color: '#ffffff' },
  },
  scenes: [scene],
};

console.log('Created IR with', ir.scenes[0].elements.length, 'elements');
console.log(JSON.stringify(ir, null, 2));
