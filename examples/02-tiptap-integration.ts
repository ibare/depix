/**
 * Example: Serialize and parse Depix blocks in Markdown
 *
 * Use `serializeDepixBlock` to embed a Depix diagram in Markdown content,
 * and `parseDepixBlock` / `parseAllDepixBlocks` to extract them back.
 */
import { compile } from '@depix/core';
import { serializeDepixBlock, parseDepixBlock, parseAllDepixBlocks } from '@depix/react';

// 1. Compile DSL to IR
const dsl = `flow direction:right {
  node "A" #a
  node "B" #b
  #a -> #b
}`;

const { ir } = compile(dsl);

// 2. Serialize IR as a Markdown-embeddable block
const markdown = serializeDepixBlock({
  ir: JSON.stringify(ir),
  dsl,
  width: 600,
  height: 340,
});

console.log('Serialized block:\n', markdown);

// 3. Parse it back
const parsed = parseDepixBlock(markdown);
if (parsed) {
  console.log('Parsed DSL:', parsed.dsl);
  console.log('Parsed width:', parsed.width);
}

// 4. Parse multiple blocks from a document
const doc = `
# My Document

Some text here.

${markdown}

More text.

${markdown}
`;

const blocks = parseAllDepixBlocks(doc);
console.log(`Found ${blocks.length} Depix blocks`);
