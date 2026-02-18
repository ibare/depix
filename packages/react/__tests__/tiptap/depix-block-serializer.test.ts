import { describe, expect, it } from 'vitest';

import type { DepixBlockAttrs } from '../../src/tiptap/depix-block-types.js';
import {
  hasDepixBlocks,
  parseAllDepixBlocks,
  parseDepixBlock,
  serializeDepixBlock,
} from '../../src/tiptap/depix-block-serializer.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal valid DepixIR JSON. */
const MINIMAL_IR = JSON.stringify({
  meta: {
    aspectRatio: { width: 16, height: 9 },
    background: { type: 'solid', color: '#ffffff' },
    drawingStyle: 'default',
  },
  scenes: [{ id: 's1', elements: [] }],
  transitions: [],
});

/** A more complex IR with elements. */
const COMPLEX_IR = JSON.stringify({
  meta: {
    aspectRatio: { width: 4, height: 3 },
    background: { type: 'solid', color: '#000000' },
    drawingStyle: 'sketch',
  },
  scenes: [
    {
      id: 's1',
      elements: [
        {
          id: 'e1',
          type: 'shape',
          shape: 'rect',
          bounds: { x: 10, y: 10, w: 30, h: 20 },
          style: { fill: '#3b82f6' },
        },
      ],
    },
  ],
  transitions: [],
});

const SAMPLE_DSL = `flow direction:right {
  node #a "Start"
  node #b "End"
  #a -> #b
}`;

// ---------------------------------------------------------------------------
// serializeDepixBlock
// ---------------------------------------------------------------------------

describe('serializeDepixBlock', () => {
  it('should serialize minimal attrs to a depix code block', () => {
    const attrs: DepixBlockAttrs = { ir: MINIMAL_IR };
    const result = serializeDepixBlock(attrs);

    expect(result).toContain('```depix');
    expect(result).toContain('```');
    // The IR string is JSON-encoded inside the payload, so check the
    // wrapper object includes the ir field correctly.
    const jsonLine = result.split('\n')[1]!;
    const parsed = JSON.parse(jsonLine);
    expect(parsed.ir).toBe(MINIMAL_IR);
  });

  it('should produce valid fenced code block format', () => {
    const attrs: DepixBlockAttrs = { ir: MINIMAL_IR };
    const result = serializeDepixBlock(attrs);
    const lines = result.split('\n');

    expect(lines[0]).toBe('```depix');
    expect(lines[lines.length - 1]).toBe('```');
  });

  it('should include dsl when provided', () => {
    const attrs: DepixBlockAttrs = { ir: MINIMAL_IR, dsl: SAMPLE_DSL };
    const result = serializeDepixBlock(attrs);
    const jsonLine = result.split('\n')[1]!;
    const parsed = JSON.parse(jsonLine);

    expect(parsed.dsl).toBe(SAMPLE_DSL);
  });

  it('should include width and height when provided', () => {
    const attrs: DepixBlockAttrs = { ir: MINIMAL_IR, width: 800, height: 600 };
    const result = serializeDepixBlock(attrs);
    const jsonLine = result.split('\n')[1]!;
    const parsed = JSON.parse(jsonLine);

    expect(parsed.width).toBe(800);
    expect(parsed.height).toBe(600);
  });

  it('should omit undefined optional fields from JSON', () => {
    const attrs: DepixBlockAttrs = { ir: MINIMAL_IR };
    const result = serializeDepixBlock(attrs);
    const jsonLine = result.split('\n')[1]!;
    const parsed = JSON.parse(jsonLine);

    expect(Object.keys(parsed)).toEqual(['ir']);
    expect(parsed).not.toHaveProperty('dsl');
    expect(parsed).not.toHaveProperty('width');
    expect(parsed).not.toHaveProperty('height');
  });

  it('should include all fields when all are provided', () => {
    const attrs: DepixBlockAttrs = {
      ir: COMPLEX_IR,
      dsl: SAMPLE_DSL,
      width: 1024,
      height: 768,
    };
    const result = serializeDepixBlock(attrs);
    const jsonLine = result.split('\n')[1]!;
    const parsed = JSON.parse(jsonLine);

    expect(parsed.ir).toBe(COMPLEX_IR);
    expect(parsed.dsl).toBe(SAMPLE_DSL);
    expect(parsed.width).toBe(1024);
    expect(parsed.height).toBe(768);
  });

  it('should handle empty ir string', () => {
    const attrs: DepixBlockAttrs = { ir: '' };
    const result = serializeDepixBlock(attrs);

    expect(result).toContain('```depix');
    const jsonLine = result.split('\n')[1]!;
    const parsed = JSON.parse(jsonLine);
    expect(parsed.ir).toBe('');
  });

  it('should handle ir containing special JSON characters', () => {
    const irWithSpecials = '{"key":"value with \\"quotes\\" and \\\\backslashes"}';
    const attrs: DepixBlockAttrs = { ir: irWithSpecials };
    const result = serializeDepixBlock(attrs);
    const jsonLine = result.split('\n')[1]!;
    const parsed = JSON.parse(jsonLine);

    expect(parsed.ir).toBe(irWithSpecials);
  });

  it('should throw when ir is not a string', () => {
    // @ts-expect-error -- testing runtime behavior
    expect(() => serializeDepixBlock({ ir: 123 })).toThrow('DepixBlockAttrs.ir must be a string');
  });
});

// ---------------------------------------------------------------------------
// parseDepixBlock
// ---------------------------------------------------------------------------

describe('parseDepixBlock', () => {
  it('should parse a valid depix code block', () => {
    const markdown = `\`\`\`depix\n${JSON.stringify({ ir: MINIMAL_IR })}\n\`\`\``;
    const result = parseDepixBlock(markdown);

    expect(result).not.toBeNull();
    expect(result!.ir).toBe(MINIMAL_IR);
  });

  it('should round-trip through serialize/parse', () => {
    const original: DepixBlockAttrs = {
      ir: COMPLEX_IR,
      dsl: SAMPLE_DSL,
      width: 800,
      height: 600,
    };
    const serialized = serializeDepixBlock(original);
    const parsed = parseDepixBlock(serialized);

    expect(parsed).toEqual(original);
  });

  it('should return null for empty string', () => {
    expect(parseDepixBlock('')).toBeNull();
  });

  it('should return null for non-depix code block', () => {
    const markdown = '```javascript\nconsole.log("hello");\n```';
    expect(parseDepixBlock(markdown)).toBeNull();
  });

  it('should return null for malformed JSON inside depix block', () => {
    const markdown = '```depix\n{invalid json}\n```';
    expect(parseDepixBlock(markdown)).toBeNull();
  });

  it('should return null for depix block without ir field', () => {
    const markdown = '```depix\n{"dsl":"flow{}"}\n```';
    expect(parseDepixBlock(markdown)).toBeNull();
  });

  it('should return null for depix block with non-string ir', () => {
    const markdown = '```depix\n{"ir":42}\n```';
    expect(parseDepixBlock(markdown)).toBeNull();
  });

  it('should return null for empty depix block', () => {
    const markdown = '```depix\n\n```';
    expect(parseDepixBlock(markdown)).toBeNull();
  });

  it('should parse depix block embedded in larger markdown', () => {
    const markdown = `# My Document

Some text here.

\`\`\`depix
${JSON.stringify({ ir: MINIMAL_IR })}
\`\`\`

More text after.`;

    const result = parseDepixBlock(markdown);
    expect(result).not.toBeNull();
    expect(result!.ir).toBe(MINIMAL_IR);
  });

  it('should parse only the first depix block when multiple exist', () => {
    const first = JSON.stringify({ ir: 'first-ir' });
    const second = JSON.stringify({ ir: 'second-ir' });
    const markdown = `\`\`\`depix\n${first}\n\`\`\`\n\n\`\`\`depix\n${second}\n\`\`\``;

    const result = parseDepixBlock(markdown);
    expect(result).not.toBeNull();
    expect(result!.ir).toBe('first-ir');
  });

  it('should ignore non-finite width/height values', () => {
    const markdown = `\`\`\`depix\n${JSON.stringify({ ir: 'test', width: Infinity, height: NaN })}\n\`\`\``;
    const result = parseDepixBlock(markdown);

    expect(result).not.toBeNull();
    expect(result!.ir).toBe('test');
    expect(result!.width).toBeUndefined();
    expect(result!.height).toBeUndefined();
  });

  it('should return null for array JSON in depix block', () => {
    const markdown = '```depix\n[1,2,3]\n```';
    expect(parseDepixBlock(markdown)).toBeNull();
  });

  it('should return null for null JSON in depix block', () => {
    const markdown = '```depix\nnull\n```';
    expect(parseDepixBlock(markdown)).toBeNull();
  });

  it('should handle dsl field with special characters', () => {
    const dsl = 'flow {\n  node #a "Hello\\nWorld"\n}';
    const attrs: DepixBlockAttrs = { ir: MINIMAL_IR, dsl };
    const serialized = serializeDepixBlock(attrs);
    const parsed = parseDepixBlock(serialized);

    expect(parsed).not.toBeNull();
    expect(parsed!.dsl).toBe(dsl);
  });

  it('should return null for non-string input', () => {
    // @ts-expect-error -- testing runtime behavior
    expect(parseDepixBlock(undefined)).toBeNull();
    // @ts-expect-error -- testing runtime behavior
    expect(parseDepixBlock(null)).toBeNull();
    // @ts-expect-error -- testing runtime behavior
    expect(parseDepixBlock(42)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// hasDepixBlocks
// ---------------------------------------------------------------------------

describe('hasDepixBlocks', () => {
  it('should return true for a string containing a depix block', () => {
    const markdown = `\`\`\`depix\n${JSON.stringify({ ir: 'test' })}\n\`\`\``;
    expect(hasDepixBlocks(markdown)).toBe(true);
  });

  it('should return false for empty string', () => {
    expect(hasDepixBlocks('')).toBe(false);
  });

  it('should return false for non-depix code blocks', () => {
    expect(hasDepixBlocks('```javascript\ncode\n```')).toBe(false);
  });

  it('should return false for plain text', () => {
    expect(hasDepixBlocks('Hello, world!')).toBe(false);
  });

  it('should return true for depix block embedded in markdown', () => {
    const markdown = `# Title\n\nSome text.\n\n\`\`\`depix\n{"ir":"x"}\n\`\`\`\n\nMore text.`;
    expect(hasDepixBlocks(markdown)).toBe(true);
  });

  it('should return true for multiple depix blocks', () => {
    const markdown = `\`\`\`depix\n{"ir":"a"}\n\`\`\`\n\n\`\`\`depix\n{"ir":"b"}\n\`\`\``;
    expect(hasDepixBlocks(markdown)).toBe(true);
  });

  it('should return false for incomplete depix fence', () => {
    expect(hasDepixBlocks('```depix\nno closing fence')).toBe(false);
  });

  it('should return false for non-string input', () => {
    // @ts-expect-error -- testing runtime behavior
    expect(hasDepixBlocks(undefined)).toBe(false);
    // @ts-expect-error -- testing runtime behavior
    expect(hasDepixBlocks(null)).toBe(false);
    // @ts-expect-error -- testing runtime behavior
    expect(hasDepixBlocks(123)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseAllDepixBlocks
// ---------------------------------------------------------------------------

describe('parseAllDepixBlocks', () => {
  it('should return empty array for empty string', () => {
    expect(parseAllDepixBlocks('')).toEqual([]);
  });

  it('should return empty array for no depix blocks', () => {
    expect(parseAllDepixBlocks('# Just markdown\n\nSome text.')).toEqual([]);
  });

  it('should parse a single block', () => {
    const markdown = `\`\`\`depix\n${JSON.stringify({ ir: 'only-one' })}\n\`\`\``;
    const results = parseAllDepixBlocks(markdown);

    expect(results).toHaveLength(1);
    expect(results[0]!.ir).toBe('only-one');
  });

  it('should parse multiple blocks', () => {
    const block1 = JSON.stringify({ ir: 'first', width: 100 });
    const block2 = JSON.stringify({ ir: 'second', dsl: 'flow {}' });
    const block3 = JSON.stringify({ ir: 'third', height: 200 });
    const markdown = `\`\`\`depix\n${block1}\n\`\`\`\n\nText\n\n\`\`\`depix\n${block2}\n\`\`\`\n\n\`\`\`depix\n${block3}\n\`\`\``;

    const results = parseAllDepixBlocks(markdown);
    expect(results).toHaveLength(3);
    expect(results[0]!.ir).toBe('first');
    expect(results[0]!.width).toBe(100);
    expect(results[1]!.ir).toBe('second');
    expect(results[1]!.dsl).toBe('flow {}');
    expect(results[2]!.ir).toBe('third');
    expect(results[2]!.height).toBe(200);
  });

  it('should skip malformed blocks among valid ones', () => {
    const valid = JSON.stringify({ ir: 'good' });
    const markdown = `\`\`\`depix\n${valid}\n\`\`\`\n\n\`\`\`depix\n{bad json}\n\`\`\`\n\n\`\`\`depix\n${valid}\n\`\`\``;

    const results = parseAllDepixBlocks(markdown);
    expect(results).toHaveLength(2);
    expect(results[0]!.ir).toBe('good');
    expect(results[1]!.ir).toBe('good');
  });

  it('should return empty array for non-string input', () => {
    // @ts-expect-error -- testing runtime behavior
    expect(parseAllDepixBlocks(null)).toEqual([]);
    // @ts-expect-error -- testing runtime behavior
    expect(parseAllDepixBlocks(undefined)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Integration / round-trip
// ---------------------------------------------------------------------------

describe('integration', () => {
  it('should round-trip attrs with only ir', () => {
    const original: DepixBlockAttrs = { ir: MINIMAL_IR };
    const serialized = serializeDepixBlock(original);
    const parsed = parseDepixBlock(serialized);

    expect(parsed).toEqual(original);
  });

  it('should round-trip attrs with all fields', () => {
    const original: DepixBlockAttrs = {
      ir: COMPLEX_IR,
      dsl: SAMPLE_DSL,
      width: 1920,
      height: 1080,
    };
    const serialized = serializeDepixBlock(original);
    const parsed = parseDepixBlock(serialized);

    expect(parsed).toEqual(original);
  });

  it('should detect serialized blocks with hasDepixBlocks', () => {
    const attrs: DepixBlockAttrs = { ir: MINIMAL_IR };
    const serialized = serializeDepixBlock(attrs);

    expect(hasDepixBlocks(serialized)).toBe(true);
  });

  it('should parse all serialized blocks with parseAllDepixBlocks', () => {
    const a1: DepixBlockAttrs = { ir: 'ir-1', width: 100 };
    const a2: DepixBlockAttrs = { ir: 'ir-2', dsl: 'flow {}' };

    const markdown = `${serializeDepixBlock(a1)}\n\nSome text.\n\n${serializeDepixBlock(a2)}`;
    const results = parseAllDepixBlocks(markdown);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(a1);
    expect(results[1]).toEqual(a2);
  });

  it('should handle consecutive serialize/parse calls without state leaking', () => {
    // This verifies that the regex lastIndex is properly reset between calls.
    for (let i = 0; i < 5; i++) {
      const attrs: DepixBlockAttrs = { ir: `ir-${i}` };
      const serialized = serializeDepixBlock(attrs);
      const parsed = parseDepixBlock(serialized);

      expect(parsed).toEqual(attrs);
      expect(hasDepixBlocks(serialized)).toBe(true);
    }
  });
});
