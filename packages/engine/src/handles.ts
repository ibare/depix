/**
 * Konva-free typed interfaces for the API surface that @depix/react hooks consume.
 *
 * These interfaces describe the *minimal* subset of Konva objects (Stage, Layer,
 * Transformer) that react hooks access via DepixEngine getters. By returning
 * these handle types instead of raw `Konva.*` types, @depix/engine exposes a
 * typed contract that @depix/react can depend on without importing konva —
 * eliminating the `as any` casts that previously bridged the C5 / C4 boundary.
 *
 * IMPORTANT: This file must NEVER import from 'konva'. The interfaces are
 * intentionally structural (duck-typed) so that Konva objects satisfy them
 * without an explicit `implements` clause.
 */

// ---------------------------------------------------------------------------
// Primitive handle for any node in the scene graph
// ---------------------------------------------------------------------------

/** Minimal node reference — the common denominator returned by findOne, etc. */
export interface NodeHandle {
  id(): string;
  parent: NodeHandle | null;
}

// ---------------------------------------------------------------------------
// StageHandle
// ---------------------------------------------------------------------------

/** Konva Stage event object shape used by click handlers. */
export interface StageEventObject {
  target: NodeHandle;
  evt?: MouseEvent;
}

/**
 * Typed facade for `Konva.Stage`.
 *
 * Covers:
 * - `findOne(selector)` — used by useKonvaTransformer to locate rendered nodes
 * - `on / off` — used by useCanvasClickHandler for click event binding
 */
export interface StageHandle {
  findOne(selector: string): NodeHandle | undefined;
  on(event: string, handler: (e: StageEventObject) => void): void;
  off(event: string, handler?: (e: StageEventObject) => void): void;
}

// ---------------------------------------------------------------------------
// LayerHandle
// ---------------------------------------------------------------------------

/**
 * Typed facade for `Konva.Layer`.
 *
 * Covers:
 * - `batchDraw()` — used after Transformer node sync
 * - `moveToTop()` — used to ensure overlay renders above content
 */
export interface LayerHandle {
  batchDraw(): void;
  moveToTop(): void;
}

// ---------------------------------------------------------------------------
// TransformerHandle
// ---------------------------------------------------------------------------

/**
 * Typed facade for `Konva.Transformer`.
 *
 * Covers all Transformer configuration methods used in useKonvaTransformer:
 * - `nodes` — set/get attached nodes
 * - `enabledAnchors` — configure which resize anchors are visible
 * - `rotateEnabled` — toggle rotation handle
 * - `resizeEnabled` — toggle resize handles
 * - `keepRatio` — toggle aspect-ratio lock
 */
export interface TransformerHandle {
  nodes(nodes?: unknown[]): unknown[];
  enabledAnchors(anchors?: string[]): string[];
  rotateEnabled(enabled?: boolean): boolean;
  resizeEnabled(enabled?: boolean): boolean;
  keepRatio(keep?: boolean): boolean;
}
