/**
 * Runtime validation functions for DepixIR structures.
 *
 * These validators work on `unknown` inputs and produce structured
 * error reports, making them suitable for validating untrusted JSON
 * (e.g. data loaded from storage or received from an LLM).
 *
 * @module @depix/core/ir/validators
 */

import type {
  DepixIR,
  IRBackground,
  IRBase,
  IRBezierSegment,
  IRBounds,
  IRContainer,
  IREdge,
  IREdgeLabel,
  IREdgePath,
  IRElement,
  IRElementType,
  IRGradient,
  IRGradientStop,
  IRImage,
  IRInnerText,
  IRLine,
  IRMeta,
  IRPath,
  IRPoint,
  IRScene,
  IRShadow,
  IRShape,
  IRStyle,
  IRText,
  IRTransform,
  IRTransition,
} from './types.js';

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

/**
 * Result of a validation operation.
 */
export interface ValidationResult {
  /** Whether the input is valid. */
  valid: boolean;
  /** List of human-readable error descriptions. Empty when valid. */
  errors: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** All valid element type discriminators. */
const ELEMENT_TYPES: ReadonlySet<string> = new Set<IRElementType>([
  'shape',
  'text',
  'image',
  'line',
  'path',
  'edge',
  'container',
]);

/** All valid shape kinds. */
const SHAPE_TYPES: ReadonlySet<string> = new Set([
  'rect',
  'circle',
  'ellipse',
  'diamond',
  'pill',
  'hexagon',
  'triangle',
  'parallelogram',
]);

/** All valid arrow types. */
const ARROW_TYPES: ReadonlySet<string> = new Set([
  'none',
  'triangle',
  'diamond',
  'circle',
  'square',
  'open-triangle',
  'filled-diamond',
  'open-diamond',
]);

/** All valid edge path types. */
const EDGE_PATH_TYPES: ReadonlySet<string> = new Set([
  'straight',
  'polyline',
  'bezier',
]);

/** All valid transition types. */
const TRANSITION_TYPES: ReadonlySet<string> = new Set([
  'fade',
  'slide-left',
  'slide-right',
  'slide-up',
  'slide-down',
  'zoom-in',
  'zoom-out',
]);

/** All valid easing types. */
const EASING_TYPES: ReadonlySet<string> = new Set([
  'linear',
  'ease-in',
  'ease-out',
  'ease-in-out',
]);

/** All valid drawing styles. */
const DRAWING_STYLES: ReadonlySet<string> = new Set(['default', 'sketch']);

/** All valid background types. */
const BACKGROUND_TYPES: ReadonlySet<string> = new Set([
  'solid',
  'linear-gradient',
  'radial-gradient',
]);

/** All valid font weights. */
const FONT_WEIGHTS: ReadonlySet<string> = new Set(['normal', 'bold']);

/** All valid font styles. */
const FONT_STYLES: ReadonlySet<string> = new Set(['normal', 'italic']);

/** All valid horizontal alignments. */
const H_ALIGNS: ReadonlySet<string> = new Set(['left', 'center', 'right']);

/** All valid vertical alignments. */
const V_ALIGNS: ReadonlySet<string> = new Set(['top', 'middle', 'bottom']);

/** All valid text decorations. */
const TEXT_DECORATIONS: ReadonlySet<string> = new Set([
  'none',
  'underline',
  'line-through',
]);

/** All valid image fit modes. */
const IMAGE_FITS: ReadonlySet<string> = new Set(['contain', 'cover', 'fill']);

/** All valid edge label placements. */
const LABEL_PLACEMENTS: ReadonlySet<string> = new Set([
  'start',
  'middle',
  'end',
  'start-above',
  'end-above',
]);

/** All valid origin source types. */
const ORIGIN_SOURCE_TYPES: ReadonlySet<string> = new Set([
  'flow',
  'stack',
  'grid',
  'tree',
  'group',
  'layers',
  'canvas',
]);

/** All valid gradient types. */
const GRADIENT_TYPES: ReadonlySet<string> = new Set(['linear', 'radial']);

/**
 * Type guard: is the value a plain object (not null, not an array)?
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Collects errors into an array using a path prefix for context.
 */
function prefixErrors(prefix: string, errors: string[]): string[] {
  return errors.map((e) => `${prefix}: ${e}`);
}

// ---------------------------------------------------------------------------
// Color validation
// ---------------------------------------------------------------------------

/** Regular expression matching #rgb, #rrggbb, and #rrggbbaa hex colors. */
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * Check whether a string is a valid hex color.
 *
 * Accepted formats: `#rgb`, `#rrggbb`, `#rrggbbaa`.
 *
 * @param color - The string to test.
 * @returns `true` if the string is a valid hex color.
 */
export function isValidHexColor(color: string): boolean {
  return HEX_COLOR_RE.test(color);
}

/**
 * Check whether a value is a valid IR color.
 *
 * A valid color is either a hex string (`#rgb`, `#rrggbb`, `#rrggbbaa`)
 * or an {@link IRGradient} object.
 *
 * @param value - The value to test.
 * @returns `true` if the value is a valid color or gradient.
 */
export function isValidColor(value: unknown): boolean {
  if (typeof value === 'string') {
    return isValidHexColor(value);
  }
  if (isObject(value)) {
    return validateGradientInternal(value).length === 0;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Granular validators (internal, return error arrays)
// ---------------------------------------------------------------------------

function validatePointInternal(
  value: unknown,
  path: string,
): string[] {
  const errors: string[] = [];
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  if (typeof value['x'] !== 'number') errors.push(`${path}.x must be a number`);
  if (typeof value['y'] !== 'number') errors.push(`${path}.y must be a number`);
  return errors;
}

function validateBoundsInternal(
  value: unknown,
  path: string,
): string[] {
  const errors: string[] = [];
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  const b = value as Record<string, unknown>;
  if (typeof b['x'] !== 'number') {
    errors.push(`${path}.x must be a number`);
  }
  if (typeof b['y'] !== 'number') {
    errors.push(`${path}.y must be a number`);
  }
  if (typeof b['w'] !== 'number') {
    errors.push(`${path}.w must be a number`);
  } else if ((b['w'] as number) < 0) {
    errors.push(`${path}.w must be non-negative`);
  }
  if (typeof b['h'] !== 'number') {
    errors.push(`${path}.h must be a number`);
  } else if ((b['h'] as number) < 0) {
    errors.push(`${path}.h must be non-negative`);
  }
  return errors;
}

function validateTransformInternal(
  value: unknown,
  path: string,
): string[] {
  const errors: string[] = [];
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  const t = value as Record<string, unknown>;
  if (t['rotate'] !== undefined && typeof t['rotate'] !== 'number') {
    errors.push(`${path}.rotate must be a number`);
  }
  if (t['opacity'] !== undefined && typeof t['opacity'] !== 'number') {
    errors.push(`${path}.opacity must be a number`);
  }
  if (t['blur'] !== undefined && typeof t['blur'] !== 'number') {
    errors.push(`${path}.blur must be a number`);
  }
  return errors;
}

function validateOriginInternal(
  value: unknown,
  path: string,
): string[] {
  const errors: string[] = [];
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  const o = value as Record<string, unknown>;
  if (typeof o['sourceType'] !== 'string' || !ORIGIN_SOURCE_TYPES.has(o['sourceType'])) {
    errors.push(`${path}.sourceType must be one of: ${[...ORIGIN_SOURCE_TYPES].join(', ')}`);
  }
  if (o['sourceProps'] !== undefined && !isObject(o['sourceProps'])) {
    errors.push(`${path}.sourceProps must be an object if provided`);
  }
  return errors;
}

function validateGradientStopInternal(
  value: unknown,
  path: string,
): string[] {
  const errors: string[] = [];
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  const s = value as Record<string, unknown>;
  if (typeof s['position'] !== 'number') {
    errors.push(`${path}.position must be a number`);
  }
  if (typeof s['color'] !== 'string') {
    errors.push(`${path}.color must be a string`);
  }
  return errors;
}

function validateGradientInternal(
  value: unknown,
  path: string = 'gradient',
): string[] {
  const errors: string[] = [];
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  const g = value as Record<string, unknown>;
  if (typeof g['type'] !== 'string' || !GRADIENT_TYPES.has(g['type'])) {
    errors.push(`${path}.type must be 'linear' or 'radial'`);
  }
  if (g['angle'] !== undefined && typeof g['angle'] !== 'number') {
    errors.push(`${path}.angle must be a number`);
  }
  if (g['cx'] !== undefined && typeof g['cx'] !== 'number') {
    errors.push(`${path}.cx must be a number`);
  }
  if (g['cy'] !== undefined && typeof g['cy'] !== 'number') {
    errors.push(`${path}.cy must be a number`);
  }
  if (!Array.isArray(g['stops'])) {
    errors.push(`${path}.stops must be an array`);
  } else {
    (g['stops'] as unknown[]).forEach((stop, i) => {
      errors.push(...validateGradientStopInternal(stop, `${path}.stops[${i}]`));
    });
  }
  return errors;
}

function validateShadowInternal(
  value: unknown,
  path: string,
): string[] {
  const errors: string[] = [];
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  const s = value as Record<string, unknown>;
  if (typeof s['offsetX'] !== 'number') errors.push(`${path}.offsetX must be a number`);
  if (typeof s['offsetY'] !== 'number') errors.push(`${path}.offsetY must be a number`);
  if (typeof s['blur'] !== 'number') errors.push(`${path}.blur must be a number`);
  if (typeof s['color'] !== 'string') errors.push(`${path}.color must be a string`);
  return errors;
}

function validateColorOrGradientInternal(
  value: unknown,
  path: string,
): string[] {
  if (typeof value === 'string') return [];
  if (isObject(value)) return validateGradientInternal(value, path);
  return [`${path} must be a string or gradient object`];
}

function validateStyleInternal(
  value: unknown,
  path: string,
): string[] {
  const errors: string[] = [];
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  const s = value as Record<string, unknown>;
  if (s['fill'] !== undefined) {
    errors.push(...validateColorOrGradientInternal(s['fill'], `${path}.fill`));
  }
  if (s['stroke'] !== undefined) {
    errors.push(...validateColorOrGradientInternal(s['stroke'], `${path}.stroke`));
  }
  if (s['strokeWidth'] !== undefined && typeof s['strokeWidth'] !== 'number') {
    errors.push(`${path}.strokeWidth must be a number`);
  }
  if (s['dashPattern'] !== undefined) {
    if (!Array.isArray(s['dashPattern'])) {
      errors.push(`${path}.dashPattern must be an array`);
    } else if (!(s['dashPattern'] as unknown[]).every((v) => typeof v === 'number')) {
      errors.push(`${path}.dashPattern must contain only numbers`);
    }
  }
  if (s['shadow'] !== undefined) {
    errors.push(...validateShadowInternal(s['shadow'], `${path}.shadow`));
  }
  return errors;
}

function validateInnerTextInternal(
  value: unknown,
  path: string,
): string[] {
  const errors: string[] = [];
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  const t = value as Record<string, unknown>;
  if (typeof t['content'] !== 'string') errors.push(`${path}.content must be a string`);
  if (typeof t['color'] !== 'string') errors.push(`${path}.color must be a string`);
  if (typeof t['fontSize'] !== 'number') errors.push(`${path}.fontSize must be a number`);
  if (t['fontWeight'] !== undefined && !FONT_WEIGHTS.has(t['fontWeight'] as string)) {
    errors.push(`${path}.fontWeight must be 'normal' or 'bold'`);
  }
  if (t['fontStyle'] !== undefined && !FONT_STYLES.has(t['fontStyle'] as string)) {
    errors.push(`${path}.fontStyle must be 'normal' or 'italic'`);
  }
  if (t['align'] !== undefined && !H_ALIGNS.has(t['align'] as string)) {
    errors.push(`${path}.align must be 'left', 'center', or 'right'`);
  }
  if (t['valign'] !== undefined && !V_ALIGNS.has(t['valign'] as string)) {
    errors.push(`${path}.valign must be 'top', 'middle', or 'bottom'`);
  }
  return errors;
}

function validateBaseInternal(
  value: Record<string, unknown>,
  path: string,
): string[] {
  const errors: string[] = [];
  if (typeof value['id'] !== 'string' || value['id'] === '') {
    errors.push(`${path}.id must be a non-empty string`);
  }
  if (typeof value['type'] !== 'string' || !ELEMENT_TYPES.has(value['type'])) {
    errors.push(`${path}.type must be one of: ${[...ELEMENT_TYPES].join(', ')}`);
  }
  if (value['bounds'] === undefined) {
    errors.push(`${path}.bounds is required`);
  } else {
    errors.push(...validateBoundsInternal(value['bounds'], `${path}.bounds`));
  }
  if (value['transform'] !== undefined) {
    errors.push(...validateTransformInternal(value['transform'], `${path}.transform`));
  }
  if (value['style'] === undefined) {
    errors.push(`${path}.style is required`);
  } else {
    errors.push(...validateStyleInternal(value['style'], `${path}.style`));
  }
  if (value['origin'] !== undefined) {
    errors.push(...validateOriginInternal(value['origin'], `${path}.origin`));
  }
  return errors;
}

function validateArrowTypeInternal(
  value: unknown,
  path: string,
): string[] {
  if (typeof value !== 'string' || !ARROW_TYPES.has(value)) {
    return [`${path} must be one of: ${[...ARROW_TYPES].join(', ')}`];
  }
  return [];
}

function validateEdgePathInternal(
  value: unknown,
  path: string,
): string[] {
  const errors: string[] = [];
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  const p = value as Record<string, unknown>;
  if (typeof p['type'] !== 'string' || !EDGE_PATH_TYPES.has(p['type'])) {
    errors.push(`${path}.type must be 'straight', 'polyline', or 'bezier'`);
    return errors;
  }
  if (p['type'] === 'polyline') {
    if (!Array.isArray(p['points'])) {
      errors.push(`${path}.points must be an array`);
    } else {
      (p['points'] as unknown[]).forEach((pt, i) => {
        errors.push(...validatePointInternal(pt, `${path}.points[${i}]`));
      });
    }
  }
  if (p['type'] === 'bezier') {
    if (!Array.isArray(p['controlPoints'])) {
      errors.push(`${path}.controlPoints must be an array`);
    } else {
      (p['controlPoints'] as unknown[]).forEach((seg, i) => {
        errors.push(...validateBezierSegmentInternal(seg, `${path}.controlPoints[${i}]`));
      });
    }
  }
  return errors;
}

function validateBezierSegmentInternal(
  value: unknown,
  path: string,
): string[] {
  const errors: string[] = [];
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  const s = value as Record<string, unknown>;
  errors.push(...validatePointInternal(s['cp1'], `${path}.cp1`));
  errors.push(...validatePointInternal(s['cp2'], `${path}.cp2`));
  errors.push(...validatePointInternal(s['end'], `${path}.end`));
  return errors;
}

function validateEdgeLabelInternal(
  value: unknown,
  path: string,
): string[] {
  const errors: string[] = [];
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  const l = value as Record<string, unknown>;
  if (typeof l['text'] !== 'string') errors.push(`${path}.text must be a string`);
  errors.push(...validatePointInternal(l['position'], `${path}.position`));
  if (typeof l['placement'] !== 'string' || !LABEL_PLACEMENTS.has(l['placement'])) {
    errors.push(`${path}.placement must be one of: ${[...LABEL_PLACEMENTS].join(', ')}`);
  }
  if (typeof l['fontSize'] !== 'number') errors.push(`${path}.fontSize must be a number`);
  if (typeof l['color'] !== 'string') errors.push(`${path}.color must be a string`);
  return errors;
}

function validateElementInternal(
  value: unknown,
  path: string,
): string[] {
  const errors: string[] = [];
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  const el = value as Record<string, unknown>;

  // Validate base properties
  errors.push(...validateBaseInternal(el, path));

  // Type-specific validation
  switch (el['type']) {
    case 'shape': {
      if (typeof el['shape'] !== 'string' || !SHAPE_TYPES.has(el['shape'])) {
        errors.push(`${path}.shape must be one of: ${[...SHAPE_TYPES].join(', ')}`);
      }
      if (el['cornerRadius'] !== undefined) {
        if (typeof el['cornerRadius'] !== 'number' && !isObject(el['cornerRadius'])) {
          errors.push(`${path}.cornerRadius must be a number or an object with tl, tr, br, bl`);
        } else if (isObject(el['cornerRadius'])) {
          const cr = el['cornerRadius'] as Record<string, unknown>;
          for (const key of ['tl', 'tr', 'br', 'bl']) {
            if (typeof cr[key] !== 'number') {
              errors.push(`${path}.cornerRadius.${key} must be a number`);
            }
          }
        }
      }
      if (el['innerText'] !== undefined) {
        errors.push(...validateInnerTextInternal(el['innerText'], `${path}.innerText`));
      }
      break;
    }
    case 'text': {
      if (typeof el['content'] !== 'string') errors.push(`${path}.content must be a string`);
      if (typeof el['fontSize'] !== 'number') errors.push(`${path}.fontSize must be a number`);
      if (typeof el['color'] !== 'string') errors.push(`${path}.color must be a string`);
      if (el['fontFamily'] !== undefined && typeof el['fontFamily'] !== 'string') {
        errors.push(`${path}.fontFamily must be a string`);
      }
      if (el['fontWeight'] !== undefined && !FONT_WEIGHTS.has(el['fontWeight'] as string)) {
        errors.push(`${path}.fontWeight must be 'normal' or 'bold'`);
      }
      if (el['fontStyle'] !== undefined && !FONT_STYLES.has(el['fontStyle'] as string)) {
        errors.push(`${path}.fontStyle must be 'normal' or 'italic'`);
      }
      if (el['textDecoration'] !== undefined && !TEXT_DECORATIONS.has(el['textDecoration'] as string)) {
        errors.push(`${path}.textDecoration must be 'none', 'underline', or 'line-through'`);
      }
      if (el['align'] !== undefined && !H_ALIGNS.has(el['align'] as string)) {
        errors.push(`${path}.align must be 'left', 'center', or 'right'`);
      }
      if (el['valign'] !== undefined && !V_ALIGNS.has(el['valign'] as string)) {
        errors.push(`${path}.valign must be 'top', 'middle', or 'bottom'`);
      }
      if (el['lineHeight'] !== undefined && typeof el['lineHeight'] !== 'number') {
        errors.push(`${path}.lineHeight must be a number`);
      }
      if (el['wrapWidth'] !== undefined && typeof el['wrapWidth'] !== 'number') {
        errors.push(`${path}.wrapWidth must be a number`);
      }
      break;
    }
    case 'image': {
      if (typeof el['src'] !== 'string') errors.push(`${path}.src must be a string`);
      if (el['fit'] !== undefined && !IMAGE_FITS.has(el['fit'] as string)) {
        errors.push(`${path}.fit must be 'contain', 'cover', or 'fill'`);
      }
      if (el['cornerRadius'] !== undefined && typeof el['cornerRadius'] !== 'number') {
        errors.push(`${path}.cornerRadius must be a number`);
      }
      break;
    }
    case 'line': {
      if (el['from'] === undefined) {
        errors.push(`${path}.from is required`);
      } else {
        errors.push(...validatePointInternal(el['from'], `${path}.from`));
      }
      if (el['to'] === undefined) {
        errors.push(`${path}.to is required`);
      } else {
        errors.push(...validatePointInternal(el['to'], `${path}.to`));
      }
      if (el['arrowStart'] !== undefined) {
        errors.push(...validateArrowTypeInternal(el['arrowStart'], `${path}.arrowStart`));
      }
      if (el['arrowEnd'] !== undefined) {
        errors.push(...validateArrowTypeInternal(el['arrowEnd'], `${path}.arrowEnd`));
      }
      break;
    }
    case 'path': {
      if (typeof el['d'] !== 'string') errors.push(`${path}.d must be a string`);
      if (el['closed'] !== undefined && typeof el['closed'] !== 'boolean') {
        errors.push(`${path}.closed must be a boolean`);
      }
      break;
    }
    case 'edge': {
      if (typeof el['fromId'] !== 'string') errors.push(`${path}.fromId must be a string`);
      if (typeof el['toId'] !== 'string') errors.push(`${path}.toId must be a string`);
      if (el['fromAnchor'] === undefined) {
        errors.push(`${path}.fromAnchor is required`);
      } else {
        errors.push(...validatePointInternal(el['fromAnchor'], `${path}.fromAnchor`));
      }
      if (el['toAnchor'] === undefined) {
        errors.push(`${path}.toAnchor is required`);
      } else {
        errors.push(...validatePointInternal(el['toAnchor'], `${path}.toAnchor`));
      }
      if (el['path'] === undefined) {
        errors.push(`${path}.path is required`);
      } else {
        errors.push(...validateEdgePathInternal(el['path'], `${path}.path`));
      }
      if (el['arrowStart'] !== undefined) {
        errors.push(...validateArrowTypeInternal(el['arrowStart'], `${path}.arrowStart`));
      }
      if (el['arrowEnd'] !== undefined) {
        errors.push(...validateArrowTypeInternal(el['arrowEnd'], `${path}.arrowEnd`));
      }
      if (el['labels'] !== undefined) {
        if (!Array.isArray(el['labels'])) {
          errors.push(`${path}.labels must be an array`);
        } else {
          (el['labels'] as unknown[]).forEach((label, i) => {
            errors.push(...validateEdgeLabelInternal(label, `${path}.labels[${i}]`));
          });
        }
      }
      break;
    }
    case 'container': {
      if (!Array.isArray(el['children'])) {
        errors.push(`${path}.children must be an array`);
      } else {
        (el['children'] as unknown[]).forEach((child, i) => {
          errors.push(...validateElementInternal(child, `${path}.children[${i}]`));
        });
      }
      if (el['clip'] !== undefined && typeof el['clip'] !== 'boolean') {
        errors.push(`${path}.clip must be a boolean`);
      }
      break;
    }
    default:
      // Unknown type -- already reported by validateBaseInternal
      break;
  }

  return errors;
}

function validateBackgroundInternal(
  value: unknown,
  path: string,
): string[] {
  const errors: string[] = [];
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  const bg = value as Record<string, unknown>;
  if (typeof bg['type'] !== 'string' || !BACKGROUND_TYPES.has(bg['type'])) {
    errors.push(`${path}.type must be 'solid', 'linear-gradient', or 'radial-gradient'`);
  }
  if (bg['color'] !== undefined && typeof bg['color'] !== 'string') {
    errors.push(`${path}.color must be a string`);
  }
  if (bg['angle'] !== undefined && typeof bg['angle'] !== 'number') {
    errors.push(`${path}.angle must be a number`);
  }
  if (bg['cx'] !== undefined && typeof bg['cx'] !== 'number') {
    errors.push(`${path}.cx must be a number`);
  }
  if (bg['cy'] !== undefined && typeof bg['cy'] !== 'number') {
    errors.push(`${path}.cy must be a number`);
  }
  if (bg['stops'] !== undefined) {
    if (!Array.isArray(bg['stops'])) {
      errors.push(`${path}.stops must be an array`);
    } else {
      (bg['stops'] as unknown[]).forEach((stop, i) => {
        errors.push(...validateGradientStopInternal(stop, `${path}.stops[${i}]`));
      });
    }
  }
  return errors;
}

function validateMetaInternal(
  value: unknown,
  path: string,
): string[] {
  const errors: string[] = [];
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  const m = value as Record<string, unknown>;

  // aspectRatio
  if (!isObject(m['aspectRatio'])) {
    errors.push(`${path}.aspectRatio must be an object`);
  } else {
    const ar = m['aspectRatio'] as Record<string, unknown>;
    if (typeof ar['width'] !== 'number') errors.push(`${path}.aspectRatio.width must be a number`);
    if (typeof ar['height'] !== 'number') errors.push(`${path}.aspectRatio.height must be a number`);
  }

  // background
  if (m['background'] === undefined) {
    errors.push(`${path}.background is required`);
  } else {
    errors.push(...validateBackgroundInternal(m['background'], `${path}.background`));
  }

  // drawingStyle
  if (typeof m['drawingStyle'] !== 'string' || !DRAWING_STYLES.has(m['drawingStyle'])) {
    errors.push(`${path}.drawingStyle must be 'default' or 'sketch'`);
  }

  return errors;
}

function validateSceneInternal(
  value: unknown,
  path: string,
): string[] {
  const errors: string[] = [];
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  const s = value as Record<string, unknown>;
  if (typeof s['id'] !== 'string' || s['id'] === '') {
    errors.push(`${path}.id must be a non-empty string`);
  }
  if (s['background'] !== undefined) {
    errors.push(...validateBackgroundInternal(s['background'], `${path}.background`));
  }
  if (!Array.isArray(s['elements'])) {
    errors.push(`${path}.elements must be an array`);
  } else {
    (s['elements'] as unknown[]).forEach((el, i) => {
      errors.push(...validateElementInternal(el, `${path}.elements[${i}]`));
    });
  }
  return errors;
}

function validateTransitionInternal(
  value: unknown,
  path: string,
): string[] {
  const errors: string[] = [];
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return errors;
  }
  const t = value as Record<string, unknown>;
  if (typeof t['from'] !== 'string') errors.push(`${path}.from must be a string`);
  if (typeof t['to'] !== 'string') errors.push(`${path}.to must be a string`);
  if (typeof t['type'] !== 'string' || !TRANSITION_TYPES.has(t['type'])) {
    errors.push(`${path}.type must be one of: ${[...TRANSITION_TYPES].join(', ')}`);
  }
  if (typeof t['duration'] !== 'number') errors.push(`${path}.duration must be a number`);
  if (typeof t['easing'] !== 'string' || !EASING_TYPES.has(t['easing'])) {
    errors.push(`${path}.easing must be one of: ${[...EASING_TYPES].join(', ')}`);
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Public validation functions
// ---------------------------------------------------------------------------

/**
 * Validate a bounding box value.
 *
 * Checks that x, y, w, h are all numbers and that w and h are non-negative.
 *
 * @param bounds - The value to validate (typically `unknown` from parsed JSON).
 * @returns Validation result with error messages.
 */
export function validateBounds(bounds: unknown): ValidationResult {
  const errors = validateBoundsInternal(bounds, 'bounds');
  return { valid: errors.length === 0, errors };
}

/**
 * Validate a single IR element.
 *
 * Performs deep validation of base properties and type-specific fields,
 * including recursive validation of container children.
 *
 * @param element - The value to validate (typically `unknown` from parsed JSON).
 * @returns Validation result with error messages.
 */
export function validateElement(element: unknown): ValidationResult {
  const errors = validateElementInternal(element, 'element');
  return { valid: errors.length === 0, errors };
}

/**
 * Validate a complete DepixIR document.
 *
 * Performs deep validation of meta, all scenes and their elements
 * (recursively through containers), and all transitions.
 *
 * @param ir - The value to validate (typically `unknown` from parsed JSON).
 * @returns Validation result with error messages.
 */
export function validateIR(ir: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(ir)) {
    return { valid: false, errors: ['IR must be an object'] };
  }

  const doc = ir as Record<string, unknown>;

  // meta
  if (doc['meta'] === undefined) {
    errors.push('meta is required');
  } else {
    errors.push(...validateMetaInternal(doc['meta'], 'meta'));
  }

  // scenes
  if (!Array.isArray(doc['scenes'])) {
    errors.push('scenes must be an array');
  } else {
    (doc['scenes'] as unknown[]).forEach((scene, i) => {
      errors.push(...validateSceneInternal(scene, `scenes[${i}]`));
    });
  }

  // transitions
  if (!Array.isArray(doc['transitions'])) {
    errors.push('transitions must be an array');
  } else {
    (doc['transitions'] as unknown[]).forEach((t, i) => {
      errors.push(...validateTransitionInternal(t, `transitions[${i}]`));
    });
  }

  return { valid: errors.length === 0, errors };
}
