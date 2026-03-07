import { describe, it, expect } from 'vitest';
import { computeTreeLevelInfo, computeFlowLayerInfo, computeSubtreeSpans } from '../../../src/compiler/passes/layout-analysis.js';

// ---------------------------------------------------------------------------
// computeTreeLevelInfo
// ---------------------------------------------------------------------------

describe('computeTreeLevelInfo', () => {
  it('returns empty for no nodes', () => {
    const result = computeTreeLevelInfo([], []);
    expect(result.numLevels).toBe(0);
    expect(result.nodesPerLevel).toEqual([]);
  });

  it('single node → 1 level', () => {
    const result = computeTreeLevelInfo(['root'], []);
    expect(result.numLevels).toBe(1);
    expect(result.nodesPerLevel).toEqual([1]);
    expect(result.nodeLevel.get('root')).toBe(0);
  });

  it('root → 2 children → 2 levels', () => {
    const result = computeTreeLevelInfo(
      ['root', 'a', 'b'],
      [{ fromId: 'root', toId: 'a' }, { fromId: 'root', toId: 'b' }],
    );
    expect(result.numLevels).toBe(2);
    expect(result.nodesPerLevel).toEqual([1, 2]);
    expect(result.nodeLevel.get('root')).toBe(0);
    expect(result.nodeLevel.get('a')).toBe(1);
    expect(result.nodeLevel.get('b')).toBe(1);
  });

  it('3-level tree', () => {
    const result = computeTreeLevelInfo(
      ['root', 'c1', 'c2', 'gc1', 'gc2'],
      [
        { fromId: 'root', toId: 'c1' },
        { fromId: 'root', toId: 'c2' },
        { fromId: 'c1', toId: 'gc1' },
        { fromId: 'c1', toId: 'gc2' },
      ],
    );
    expect(result.numLevels).toBe(3);
    expect(result.nodesPerLevel).toEqual([1, 2, 2]);
  });

  it('handles disconnected nodes', () => {
    const result = computeTreeLevelInfo(
      ['a', 'b', 'c'],
      [], // no edges
    );
    expect(result.numLevels).toBe(1);
    // All are roots
    expect(result.nodesPerLevel).toEqual([3]);
  });
});

// ---------------------------------------------------------------------------
// computeSubtreeSpans
// ---------------------------------------------------------------------------

describe('computeSubtreeSpans', () => {
  it('returns empty for no nodes', () => {
    const result = computeSubtreeSpans([], []);
    expect(result.nodeSpan.size).toBe(0);
    expect(result.roots).toEqual([]);
  });

  it('single node → span 1', () => {
    const result = computeSubtreeSpans(['root'], []);
    expect(result.nodeSpan.get('root')).toBe(1);
    expect(result.roots).toEqual(['root']);
  });

  it('root with 3 leaf children → root span 3', () => {
    const result = computeSubtreeSpans(
      ['root', 'a', 'b', 'c'],
      [
        { fromId: 'root', toId: 'a' },
        { fromId: 'root', toId: 'b' },
        { fromId: 'root', toId: 'c' },
      ],
    );
    expect(result.nodeSpan.get('root')).toBe(3);
    expect(result.nodeSpan.get('a')).toBe(1);
    expect(result.nodeSpan.get('b')).toBe(1);
    expect(result.nodeSpan.get('c')).toBe(1);
  });

  it('org chart — subtree spans match leaf counts', () => {
    const result = computeSubtreeSpans(
      ['ceo', 'cto', 'cfo', 'fe', 'be', 'infra', 'acc', 'fin'],
      [
        { fromId: 'ceo', toId: 'cto' },
        { fromId: 'ceo', toId: 'cfo' },
        { fromId: 'cto', toId: 'fe' },
        { fromId: 'cto', toId: 'be' },
        { fromId: 'cto', toId: 'infra' },
        { fromId: 'cfo', toId: 'acc' },
        { fromId: 'cfo', toId: 'fin' },
      ],
    );
    expect(result.nodeSpan.get('ceo')).toBe(5); // 5 leaves total
    expect(result.nodeSpan.get('cto')).toBe(3); // 3 leaves: fe, be, infra
    expect(result.nodeSpan.get('cfo')).toBe(2); // 2 leaves: acc, fin
    expect(result.nodeSpan.get('fe')).toBe(1);
    expect(result.roots).toEqual(['ceo']);
  });

  it('disconnected nodes → all span 1, all roots', () => {
    const result = computeSubtreeSpans(['a', 'b', 'c'], []);
    expect(result.nodeSpan.get('a')).toBe(1);
    expect(result.nodeSpan.get('b')).toBe(1);
    expect(result.nodeSpan.get('c')).toBe(1);
    expect(result.roots).toEqual(['a', 'b', 'c']);
  });
});

// ---------------------------------------------------------------------------
// computeFlowLayerInfo
// ---------------------------------------------------------------------------

describe('computeFlowLayerInfo', () => {
  it('returns empty for no nodes', () => {
    const result = computeFlowLayerInfo([], []);
    expect(result.layerCount).toBe(0);
  });

  it('no edges → all in layer 0', () => {
    const result = computeFlowLayerInfo(['a', 'b', 'c'], []);
    expect(result.layerCount).toBe(1);
    expect(result.nodesPerLayer).toEqual([3]);
  });

  it('linear chain A→B→C → 3 layers', () => {
    const result = computeFlowLayerInfo(
      ['a', 'b', 'c'],
      [{ fromId: 'a', toId: 'b' }, { fromId: 'b', toId: 'c' }],
    );
    expect(result.layerCount).toBe(3);
    expect(result.nodesPerLayer).toEqual([1, 1, 1]);
    expect(result.nodeLayer.get('a')).toBe(0);
    expect(result.nodeLayer.get('b')).toBe(1);
    expect(result.nodeLayer.get('c')).toBe(2);
  });

  it('diamond A→B,C; B,C→D → 3 layers with middle layer having 2', () => {
    const result = computeFlowLayerInfo(
      ['a', 'b', 'c', 'd'],
      [
        { fromId: 'a', toId: 'b' },
        { fromId: 'a', toId: 'c' },
        { fromId: 'b', toId: 'd' },
        { fromId: 'c', toId: 'd' },
      ],
    );
    expect(result.layerCount).toBe(3);
    expect(result.nodesPerLayer).toEqual([1, 2, 1]);
  });

  it('multiple sources → both at layer 0', () => {
    const result = computeFlowLayerInfo(
      ['a', 'b', 'c'],
      [{ fromId: 'a', toId: 'c' }, { fromId: 'b', toId: 'c' }],
    );
    expect(result.nodeLayer.get('a')).toBe(0);
    expect(result.nodeLayer.get('b')).toBe(0);
    expect(result.nodeLayer.get('c')).toBe(1);
  });
});
