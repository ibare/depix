/**
 * Built-in asset definitions.
 *
 * Provides a default set of shapes, arrows, and icons that ship with Depix.
 */

import type { AssetDefinition } from './asset-types.js';

export const BUILTIN_ASSETS: AssetDefinition[] = [
  // ---------------------------------------------------------------------------
  // Shapes
  // ---------------------------------------------------------------------------
  {
    id: 'shape-rect',
    name: 'Rectangle',
    category: 'shapes',
    type: 'shape',
    shapeType: 'rect',
    tags: ['rectangle', 'box', 'square'],
  },
  {
    id: 'shape-circle',
    name: 'Circle',
    category: 'shapes',
    type: 'shape',
    shapeType: 'circle',
    tags: ['circle', 'round'],
  },
  {
    id: 'shape-ellipse',
    name: 'Ellipse',
    category: 'shapes',
    type: 'shape',
    shapeType: 'ellipse',
    tags: ['ellipse', 'oval'],
  },
  {
    id: 'shape-diamond',
    name: 'Diamond',
    category: 'shapes',
    type: 'path',
    pathData: 'M 50 0 L 100 50 L 50 100 L 0 50 Z',
    tags: ['diamond', 'rhombus', 'decision'],
  },
  {
    id: 'shape-triangle',
    name: 'Triangle',
    category: 'shapes',
    type: 'path',
    pathData: 'M 50 0 L 100 100 L 0 100 Z',
    tags: ['triangle'],
  },
  {
    id: 'shape-star',
    name: 'Star',
    category: 'shapes',
    type: 'path',
    pathData:
      'M 50 0 L 61 35 L 98 35 L 68 57 L 79 91 L 50 70 L 21 91 L 32 57 L 2 35 L 39 35 Z',
    tags: ['star', 'favorite'],
  },
  {
    id: 'shape-pentagon',
    name: 'Pentagon',
    category: 'shapes',
    type: 'path',
    pathData: 'M 50 0 L 97 35 L 79 91 L 21 91 L 3 35 Z',
    tags: ['pentagon', 'polygon'],
  },
  {
    id: 'shape-hexagon',
    name: 'Hexagon',
    category: 'shapes',
    type: 'path',
    pathData: 'M 25 0 L 75 0 L 100 50 L 75 100 L 25 100 L 0 50 Z',
    tags: ['hexagon', 'polygon'],
  },
  {
    id: 'shape-cloud',
    name: 'Cloud',
    category: 'shapes',
    type: 'path',
    pathData:
      'M 25 60 Q 0 60 5 45 Q 0 30 15 25 Q 15 10 30 10 Q 40 0 55 10 Q 70 5 75 20 Q 95 20 95 35 Q 100 50 85 55 Q 90 65 75 65 Z',
    tags: ['cloud', 'weather'],
  },

  // ---------------------------------------------------------------------------
  // Arrows
  // ---------------------------------------------------------------------------
  {
    id: 'arrow-right',
    name: 'Arrow Right',
    category: 'arrows',
    type: 'path',
    pathData: 'M 0 40 L 60 40 L 60 20 L 100 50 L 60 80 L 60 60 L 0 60 Z',
    tags: ['arrow', 'right', 'direction'],
  },
  {
    id: 'arrow-left',
    name: 'Arrow Left',
    category: 'arrows',
    type: 'path',
    pathData: 'M 100 40 L 40 40 L 40 20 L 0 50 L 40 80 L 40 60 L 100 60 Z',
    tags: ['arrow', 'left', 'direction'],
  },
  {
    id: 'arrow-up',
    name: 'Arrow Up',
    category: 'arrows',
    type: 'path',
    pathData: 'M 40 100 L 40 40 L 20 40 L 50 0 L 80 40 L 60 40 L 60 100 Z',
    tags: ['arrow', 'up', 'direction'],
  },
  {
    id: 'arrow-down',
    name: 'Arrow Down',
    category: 'arrows',
    type: 'path',
    pathData: 'M 40 0 L 40 60 L 20 60 L 50 100 L 80 60 L 60 60 L 60 0 Z',
    tags: ['arrow', 'down', 'direction'],
  },

  // ---------------------------------------------------------------------------
  // Icons
  // ---------------------------------------------------------------------------
  {
    id: 'icon-check',
    name: 'Check',
    category: 'icons',
    type: 'path',
    pathData: 'M 10 50 L 40 80 L 90 20',
    tags: ['check', 'checkmark', 'done', 'yes'],
  },
  {
    id: 'icon-cross',
    name: 'Cross',
    category: 'icons',
    type: 'path',
    pathData: 'M 20 20 L 80 80 M 80 20 L 20 80',
    tags: ['cross', 'close', 'no', 'x'],
  },
];
