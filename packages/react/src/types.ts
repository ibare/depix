/**
 * Shared types for @depix/react.
 *
 * @module @depix/react/types
 */

// ---------------------------------------------------------------------------
// Tool Types
// ---------------------------------------------------------------------------

/**
 * Available editing tools in the Depix editor.
 *
 * - `select`    - Default pointer tool for selecting/moving/resizing elements.
 * - `rect`      - Draw rectangle shapes.
 * - `circle`    - Draw circle shapes.
 * - `text`      - Create text elements.
 * - `line`      - Draw straight lines.
 * - `connector` - Draw edges/connections between elements.
 * - `image`     - Place image elements.
 * - `hand`      - Pan/scroll the canvas (no element interaction).
 */
export type ToolType =
  | 'select'
  | 'rect'
  | 'circle'
  | 'text'
  | 'line'
  | 'connector'
  | 'image'
  | 'hand';
