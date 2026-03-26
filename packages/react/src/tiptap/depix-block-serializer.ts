/**
 * Markdown serialization / deserialization for Depix blocks.
 *
 * Depix diagrams are embedded in markdown using fenced code blocks
 * with the `depix` language identifier:
 *
 * ```depix
 * {"meta":...,"scenes":...,"transitions":...}
 * ```
 *
 * The JSON payload is a serialized {@link DepixBlockAttrs} object.
 * Only the `ir` field is required; `dsl`, `width`, and `height` are optional.
 *
 * @module @depix/react/tiptap
 */

import type { DepixBlockAttrs } from './depix-block-types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Opening fence for a depix code block. */
const DEPIX_FENCE_OPEN = '```depix';

/** Closing fence. */
const DEPIX_FENCE_CLOSE = '```';

/**
 * Regex that matches a single depix fenced code block.
 *
 * Captures the JSON content between the fences (group 1).
 * Uses non-greedy matching so multiple blocks in the same string
 * are matched individually.
 */
const DEPIX_BLOCK_RE = /```depix\n([\s\S]*?)```/g;

// ---------------------------------------------------------------------------
// Serialize
// ---------------------------------------------------------------------------

/**
 * Serialize {@link DepixBlockAttrs} to a markdown depix code block.
 *
 * The output format is:
 * ```depix
 * {"ir":"...","dsl":"...","width":800,"height":600}
 * ```
 *
 * Only non-undefined fields are included in the JSON payload.
 *
 * @param attrs - The block attributes to serialize.
 * @returns A markdown string containing the depix code block.
 * @throws {Error} If `attrs.ir` is not a string.
 */
export function serializeDepixBlock(attrs: DepixBlockAttrs): string {
  if (typeof attrs.ir !== 'string') {
    throw new Error('DepixBlockAttrs.ir must be a string');
  }

  // Build a clean payload with only defined fields.
  const payload: Record<string, unknown> = { ir: attrs.ir };
  if (attrs.dsl !== undefined) {
    payload.dsl = attrs.dsl;
  }
  if (attrs.width !== undefined) {
    payload.width = attrs.width;
  }
  if (attrs.height !== undefined) {
    payload.height = attrs.height;
  }

  const json = JSON.stringify(payload);
  return `${DEPIX_FENCE_OPEN}\n${json}\n${DEPIX_FENCE_CLOSE}`;
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

/**
 * Parse a depix code block from a markdown string and return
 * the block attributes.
 *
 * Accepts a string that is either exactly a depix code block, or
 * contains a depix code block. Only the **first** block is parsed.
 *
 * @param markdown - The markdown string to parse.
 * @returns The parsed {@link DepixBlockAttrs}, or `null` if the
 *          string does not contain a valid depix block.
 */
export function parseDepixBlock(markdown: string): DepixBlockAttrs | null {
  if (typeof markdown !== 'string' || markdown.length === 0) {
    return null;
  }

  // Reset the regex lastIndex to ensure fresh matching.
  DEPIX_BLOCK_RE.lastIndex = 0;
  const match = DEPIX_BLOCK_RE.exec(markdown);
  if (!match || !match[1]) {
    return null;
  }

  const jsonContent = match[1].trim();
  if (jsonContent.length === 0) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(jsonContent);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const obj = parsed as Record<string, unknown>;

    // `ir` is required and must be a string.
    if (typeof obj.ir !== 'string') {
      return null;
    }

    const attrs: DepixBlockAttrs = { ir: obj.ir };

    if (typeof obj.dsl === 'string') {
      attrs.dsl = obj.dsl;
    }
    if (typeof obj.width === 'number' && isFinite(obj.width)) {
      attrs.width = obj.width;
    }
    if (typeof obj.height === 'number' && isFinite(obj.height)) {
      attrs.height = obj.height;
    }

    return attrs;
  } catch {
    // Malformed JSON is expected — markdown content from external sources
    // may contain invalid depix blocks, so we gracefully return null.
    return null;
  }
}

// ---------------------------------------------------------------------------
// Detect
// ---------------------------------------------------------------------------

/**
 * Check whether a markdown string contains at least one depix code block.
 *
 * @param markdown - The markdown string to check.
 * @returns `true` if one or more depix blocks are present.
 */
export function hasDepixBlocks(markdown: string): boolean {
  if (typeof markdown !== 'string' || markdown.length === 0) {
    return false;
  }
  DEPIX_BLOCK_RE.lastIndex = 0;
  return DEPIX_BLOCK_RE.test(markdown);
}

// ---------------------------------------------------------------------------
// Utilities (bonus, useful for consumers)
// ---------------------------------------------------------------------------

/**
 * Parse **all** depix code blocks from a markdown string.
 *
 * @param markdown - The markdown string to parse.
 * @returns An array of parsed {@link DepixBlockAttrs} objects.
 *          Empty array if no valid blocks are found.
 */
export function parseAllDepixBlocks(markdown: string): DepixBlockAttrs[] {
  if (typeof markdown !== 'string' || markdown.length === 0) {
    return [];
  }

  const results: DepixBlockAttrs[] = [];
  DEPIX_BLOCK_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = DEPIX_BLOCK_RE.exec(markdown)) !== null) {
    if (!match[1]) continue;
    const jsonContent = match[1].trim();
    if (jsonContent.length === 0) continue;

    try {
      const parsed: unknown = JSON.parse(jsonContent);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        continue;
      }

      const obj = parsed as Record<string, unknown>;
      if (typeof obj.ir !== 'string') continue;

      const attrs: DepixBlockAttrs = { ir: obj.ir };
      if (typeof obj.dsl === 'string') attrs.dsl = obj.dsl;
      if (typeof obj.width === 'number' && isFinite(obj.width)) attrs.width = obj.width;
      if (typeof obj.height === 'number' && isFinite(obj.height)) attrs.height = obj.height;

      results.push(attrs);
    } catch {
      // Skip malformed JSON blocks.
    }
  }

  return results;
}
