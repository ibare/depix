/**
 * DepixIR Type Definitions
 *
 * The Internal Representation (IR) describes a fully resolved scene.
 * All coordinates are relative values in the 0-100 range.
 * All colors are resolved HEX values (no semantic tokens).
 * All layouts are pre-computed (no dynamic sizing).
 * All edge paths are pre-computed point arrays.
 *
 * @module @depix/core/ir
 */

// ---------------------------------------------------------------------------
// Element type literal union
// ---------------------------------------------------------------------------

/**
 * Discriminator for IR element types.
 *
 * 7 element kinds cover all visual primitives:
 * - `shape`     - rect, circle, ellipse, diamond, pill, hexagon, triangle, parallelogram
 * - `text`      - standalone text block
 * - `image`     - raster / vector image reference
 * - `line`      - straight line between two points
 * - `path`      - SVG path data (free-form curves, polygons)
 * - `edge`      - connection between two elements with a resolved route
 * - `container` - parent that holds child elements (layout already resolved)
 */
export type IRElementType =
  | 'shape'
  | 'text'
  | 'image'
  | 'line'
  | 'path'
  | 'edge'
  | 'container';

// ---------------------------------------------------------------------------
// Geometry primitives
// ---------------------------------------------------------------------------

/**
 * Axis-aligned bounding box.
 *
 * Every IR element has a bounding box. All values are in the 0-100
 * relative coordinate space of the canvas.
 */
export interface IRBounds {
  /** Top-left X coordinate (0-100). */
  x: number;
  /** Top-left Y coordinate (0-100). */
  y: number;
  /** Width (0-100, always a resolved concrete value). */
  w: number;
  /** Height (0-100, always a resolved concrete value). */
  h: number;
}

/**
 * A 2D point in the 0-100 relative coordinate space.
 */
export interface IRPoint {
  /** X coordinate (0-100). */
  x: number;
  /** Y coordinate (0-100). */
  y: number;
}

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------

/**
 * Spatial and visual transforms applied to an element.
 *
 * All values are resolved concrete numbers.
 */
export interface IRTransform {
  /** Rotation in degrees. */
  rotate?: number;
  /** Opacity from 0 (fully transparent) to 1 (fully opaque). */
  opacity?: number;
  /** Gaussian blur radius. */
  blur?: number;
}

// ---------------------------------------------------------------------------
// Origin (semantic provenance)
// ---------------------------------------------------------------------------

/**
 * Semantic provenance metadata.
 *
 * Records the original DSL primitive that produced this IR element so
 * the editor can offer smart editing (e.g. auto-relayout when a node
 * is added to a flow container).
 *
 * Removing `origin` from an element "detaches" it from its semantic
 * layout, switching to free-form editing.
 */
export interface IROrigin {
  /** The DSL primitive type that produced this element. */
  sourceType:
    | 'flow'
    | 'stack'
    | 'grid'
    | 'tree'
    | 'group'
    | 'layers'
    | 'canvas'
    | 'scene'
    | 'table'
    | 'chart'
    | 'scene-background'
    | 'scene-slot';
  /** DSL slot name for scene-slot containers (e.g. 'header', 'main', 'left'). */
  slotName?: string;
  /** Original DSL properties preserved for re-compilation. */
  sourceProps?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Style primitives
// ---------------------------------------------------------------------------

/**
 * Gradient definition used for fills and strokes.
 */
export interface IRGradient {
  /** Gradient type. */
  type: 'linear' | 'radial';
  /** Angle in degrees (for linear gradients). */
  angle?: number;
  /** Center X (0-1) for radial gradients. */
  cx?: number;
  /** Center Y (0-1) for radial gradients. */
  cy?: number;
  /** Color stops along the gradient. */
  stops: IRGradientStop[];
}

/**
 * A single color stop within a gradient.
 */
export interface IRGradientStop {
  /** Position along the gradient (0-1). */
  position: number;
  /** Resolved HEX color. */
  color: string;
}

/**
 * Drop shadow definition.
 */
export interface IRShadow {
  /** Horizontal offset. */
  offsetX: number;
  /** Vertical offset. */
  offsetY: number;
  /** Blur radius. */
  blur: number;
  /** Shadow color (resolved HEX or rgba). */
  color: string;
}

/**
 * Fully resolved style for an IR element.
 *
 * All values are concrete -- no semantic tokens such as "primary" or "md".
 */
export interface IRStyle {
  /** Fill color (resolved HEX) or gradient. */
  fill?: string | IRGradient;
  /** Stroke color (resolved HEX) or gradient. */
  stroke?: string | IRGradient;
  /** Stroke width. */
  strokeWidth?: number;
  /** Dash pattern array (e.g. `[5, 3]` for a dashed line). */
  dashPattern?: number[];
  /** Drop shadow. */
  shadow?: IRShadow;
}

// ---------------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------------

/**
 * Resolved background for the document or a scene.
 */
export interface IRBackground {
  /** Background type. */
  type: 'solid' | 'linear-gradient' | 'radial-gradient';
  /** Solid color (resolved HEX). Used when type is `solid`. */
  color?: string;
  /** Angle in degrees (for linear-gradient). */
  angle?: number;
  /** Center X (0-1) for radial-gradient. */
  cx?: number;
  /** Center Y (0-1) for radial-gradient. */
  cy?: number;
  /** Gradient stops. */
  stops?: IRGradientStop[];
}

// ---------------------------------------------------------------------------
// Inner text (text inside shapes)
// ---------------------------------------------------------------------------

/**
 * Text rendered inside a shape element.
 *
 * All values are fully resolved.
 */
export interface IRInnerText {
  /** Text content. */
  content: string;
  /** Resolved HEX color. */
  color: string;
  /** Resolved absolute font size. */
  fontSize: number;
  /** Font weight. */
  fontWeight?: 'normal' | 'bold';
  /** Font style. */
  fontStyle?: 'normal' | 'italic';
  /** Horizontal text alignment. */
  align?: 'left' | 'center' | 'right';
  /** Vertical text alignment. */
  valign?: 'top' | 'middle' | 'bottom';
}

// ---------------------------------------------------------------------------
// IRBase - common properties for all elements
// ---------------------------------------------------------------------------

/**
 * Common base properties shared by every IR element.
 *
 * Every value here is "resolved" -- concrete numbers instead of dynamic
 * sizing values, concrete HEX colors instead of semantic tokens.
 */
export interface IRBase {
  /** Unique element identifier (used for editor operations and edge references). */
  id: string;
  /** Element type discriminator. */
  type: IRElementType;
  /** Bounding box -- always present, always resolved. */
  bounds: IRBounds;
  /** Spatial and visual transforms. */
  transform?: IRTransform;
  /** Fully resolved visual style. */
  style: IRStyle;
  /** Semantic provenance metadata (for smart editing in the editor). */
  origin?: IROrigin;
}

// ---------------------------------------------------------------------------
// Shape types
// ---------------------------------------------------------------------------

/**
 * Supported geometric shape kinds.
 *
 * The renderer draws the specified shape within the element's bounding box.
 */
export type IRShapeType =
  | 'rect'
  | 'circle'
  | 'ellipse'
  | 'diamond'
  | 'pill'
  | 'hexagon'
  | 'triangle'
  | 'parallelogram';

/**
 * A geometric shape element.
 *
 * A unified shape type distinguished by the `shape` property
 * (rect, circle, ellipse, diamond, etc.).
 *
 * The renderer draws the requested shape within the element's bounding box.
 */
export interface IRShape extends IRBase {
  /** Discriminator -- always `'shape'`. */
  type: 'shape';
  /** The geometric shape to render. */
  shape: IRShapeType;
  /**
   * Corner radius (applicable to rect-family shapes).
   *
   * A single number applies uniformly; an object specifies per-corner radii.
   */
  cornerRadius?: number | { tl: number; tr: number; br: number; bl: number };
  /** Optional text rendered inside the shape. */
  innerText?: IRInnerText;
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/**
 * A standalone text element.
 */
export interface IRText extends IRBase {
  /** Discriminator -- always `'text'`. */
  type: 'text';
  /** Text content. */
  content: string;
  /** Resolved font size (canvas-relative). */
  fontSize: number;
  /** Resolved text color (HEX). */
  color: string;
  /** Font family name. */
  fontFamily?: string;
  /** Font weight. */
  fontWeight?: 'normal' | 'bold';
  /** Font style. */
  fontStyle?: 'normal' | 'italic';
  /** Text decoration. */
  textDecoration?: 'none' | 'underline' | 'line-through';
  /** Horizontal text alignment. */
  align?: 'left' | 'center' | 'right';
  /** Vertical text alignment. */
  valign?: 'top' | 'middle' | 'bottom';
  /** Line height multiplier. */
  lineHeight?: number;
  /** Resolved wrap width (absolute). */
  wrapWidth?: number;
}

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

/**
 * An image element.
 */
export interface IRImage extends IRBase {
  /** Discriminator -- always `'image'`. */
  type: 'image';
  /** Image source URL or data URI. */
  src: string;
  /** How the image fits within its bounding box. */
  fit?: 'contain' | 'cover' | 'fill';
  /** Corner radius for rounded image clipping. */
  cornerRadius?: number;
}

// ---------------------------------------------------------------------------
// Arrow types
// ---------------------------------------------------------------------------

/**
 * Arrow head styles for lines and edges.
 *
 * Includes standard shapes and UML-specific variants.
 */
export type IRArrowType =
  | 'none'
  | 'triangle'
  | 'diamond'
  | 'circle'
  | 'square'
  | 'open-triangle'    // UML generalization (hollow triangle)
  | 'filled-diamond'   // UML composition (filled diamond)
  | 'open-diamond';    // UML aggregation (hollow diamond)

// ---------------------------------------------------------------------------
// Line
// ---------------------------------------------------------------------------

/**
 * A straight line between two points.
 *
 * For complex paths use {@link IRPath}; for element-to-element
 * connections use {@link IREdge}.
 */
export interface IRLine extends IRBase {
  /** Discriminator -- always `'line'`. */
  type: 'line';
  /** Start point (absolute 0-100 coordinates). */
  from: IRPoint;
  /** End point (absolute 0-100 coordinates). */
  to: IRPoint;
  /** Arrow head at the start of the line. */
  arrowStart?: IRArrowType;
  /** Arrow head at the end of the line. */
  arrowEnd?: IRArrowType;
}

// ---------------------------------------------------------------------------
// Path
// ---------------------------------------------------------------------------

/**
 * An SVG path element for free-form curves, polygons, and resolved symbols.
 */
export interface IRPath extends IRBase {
  /** Discriminator -- always `'path'`. */
  type: 'path';
  /** SVG path data string (coordinates are absolute). */
  d: string;
  /** Whether the path is closed. */
  closed?: boolean;
}

// ---------------------------------------------------------------------------
// Edge (connection between elements)
// ---------------------------------------------------------------------------

/**
 * A cubic Bezier curve segment within an edge path.
 */
export interface IRBezierSegment {
  /** First control point. */
  cp1: IRPoint;
  /** Second control point. */
  cp2: IRPoint;
  /** End point of the segment. */
  end: IRPoint;
}

/**
 * A straight edge path (direct line from anchor to anchor).
 */
export interface IREdgePathStraight {
  /** Discriminator. */
  type: 'straight';
}

/**
 * A polyline edge path (series of waypoints).
 */
export interface IREdgePathPolyline {
  /** Discriminator. */
  type: 'polyline';
  /** Intermediate waypoints between the anchors. */
  points: IRPoint[];
}

/**
 * A Bezier curve edge path.
 */
export interface IREdgePathBezier {
  /** Discriminator. */
  type: 'bezier';
  /** Bezier curve segments. */
  controlPoints: IRBezierSegment[];
}

/**
 * Discriminated union for edge path representations.
 *
 * - `straight`  -- direct line from fromAnchor to toAnchor
 * - `polyline`  -- series of waypoints
 * - `bezier`    -- cubic Bezier curve segments
 */
export type IREdgePath =
  | IREdgePathStraight
  | IREdgePathPolyline
  | IREdgePathBezier;

/**
 * A text label attached to an edge.
 *
 * Used for UML multiplicity, role names, and general annotations.
 * Position is pre-computed.
 */
export interface IREdgeLabel {
  /** Label text content. */
  text: string;
  /** Resolved position (absolute 0-100 coordinates). */
  position: IRPoint;
  /** Where the label is placed relative to the edge. */
  placement: 'start' | 'middle' | 'end' | 'start-above' | 'end-above';
  /** Resolved font size. */
  fontSize: number;
  /** Resolved text color (HEX). */
  color: string;
}

/**
 * A connection between two elements with a fully resolved route.
 *
 * The path is pre-computed as concrete points. The renderer simply
 * draws along the path without any routing calculation.
 *
 * `fromId` and `toId` are retained so the editor can re-route when
 * elements are moved.
 */
export interface IREdge extends IRBase {
  /** Discriminator -- always `'edge'`. */
  type: 'edge';
  /** Source element ID (for editor re-routing). */
  fromId: string;
  /** Target element ID (for editor re-routing). */
  toId: string;
  /** Anchor point on the source element. */
  fromAnchor: IRPoint;
  /** Anchor point on the target element. */
  toAnchor: IRPoint;
  /** Pre-computed edge path. */
  path: IREdgePath;
  /** Arrow head at the start of the edge. */
  arrowStart?: IRArrowType;
  /** Arrow head at the end of the edge. */
  arrowEnd?: IRArrowType;
  /** Labels attached to the edge (positions resolved). */
  labels?: IREdgeLabel[];
}

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------

/**
 * A container that holds child elements.
 *
 * A container that groups child elements. All layout has been resolved:
 * children already have concrete bounding boxes. The renderer simply
 * draws them in order.
 *
 * If the container originated from a semantic layout (flow, stack, etc.),
 * the `origin` field preserves that information for smart editing.
 */
export interface IRContainer extends IRBase {
  /** Discriminator -- always `'container'`. */
  type: 'container';
  /** Child elements (z-order follows array order). */
  children: IRElement[];
  /** Whether child content is clipped to the container bounds. */
  clip?: boolean;
}

// ---------------------------------------------------------------------------
// Discriminated union of all element types
// ---------------------------------------------------------------------------

/**
 * Discriminated union of all IR element types.
 *
 * The `type` field serves as the discriminator:
 * - `'shape'`     -> {@link IRShape}
 * - `'text'`      -> {@link IRText}
 * - `'image'`     -> {@link IRImage}
 * - `'line'`      -> {@link IRLine}
 * - `'path'`      -> {@link IRPath}
 * - `'edge'`      -> {@link IREdge}
 * - `'container'` -> {@link IRContainer}
 */
export type IRElement =
  | IRShape
  | IRText
  | IRImage
  | IRLine
  | IRPath
  | IREdge
  | IRContainer;

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

/**
 * A single scene within the IR document.
 *
 * Each scene contains a flat (or nested via containers) list of elements.
 * Z-order is determined by array position.
 */
export interface IRScene {
  /** Unique scene identifier. */
  id: string;
  /** Optional per-scene background override. */
  background?: IRBackground;
  /** Top-level elements in the scene (z-order follows array order). */
  elements: IRElement[];
  /** Layout metadata from the DSL scene block (for editor use). */
  layout?: { type: string; ratio?: number; direction?: string };
}

// ---------------------------------------------------------------------------
// Transition
// ---------------------------------------------------------------------------

/**
 * A transition between two scenes.
 */
export interface IRTransition {
  /** Source scene ID. */
  from: string;
  /** Target scene ID. */
  to: string;
  /** Transition animation type. */
  type:
    | 'fade'
    | 'slide-left'
    | 'slide-right'
    | 'slide-up'
    | 'slide-down'
    | 'zoom-in'
    | 'zoom-out';
  /** Duration in milliseconds. */
  duration: number;
  /** Easing function. */
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

/**
 * Document-level metadata.
 */
export interface IRMeta {
  /** Canvas aspect ratio. */
  aspectRatio: { width: number; height: number };
  /** Resolved document background (HEX/gradient, not semantic). */
  background: IRBackground;
  /** Drawing style hint for the renderer. */
  drawingStyle: 'default' | 'sketch';
}

// ---------------------------------------------------------------------------
// Top-level IR document
// ---------------------------------------------------------------------------

/**
 * DepixIR -- the fully resolved scene description.
 *
 * All coordinates are 0-100 relative values.
 * All colors are HEX or rgba() (semantic colors resolved).
 * All layouts are computed (fill, hug, etc. converted to concrete numbers).
 * All edge paths are computed point arrays.
 *
 * This is the central data contract between the compiler, renderer, and editor.
 */
export interface DepixIR {
  /** Document metadata. */
  meta: IRMeta;
  /** List of scenes. */
  scenes: IRScene[];
  /** Transitions between scenes. */
  transitions: IRTransition[];
}
