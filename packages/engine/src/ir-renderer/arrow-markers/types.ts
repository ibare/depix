/**
 * Arrow Marker — Types & Context
 *
 * 플러그블 화살표 렌더러의 공통 타입 정의.
 * 새 마커 구현은 ArrowMarkerRenderer 시그니처를 따르고 index.ts의 REGISTRY에 등록한다.
 */

import type Konva from 'konva';
import type { IRStyle } from '@depix/core';
import type { CoordinateTransform } from '../../coordinate-transform.js';

/**
 * Context passed to an ArrowMarkerRenderer.
 * All geometry is pre-computed in absolute (pixel) coordinates so individual
 * renderers only focus on their own shape.
 */
export interface ArrowMarkerContext {
  /** Arrow tip position (absolute pixels). */
  tip: { x: number; y: number };
  /** Unit vector along arrow direction (tail → tip). */
  direction: { x: number; y: number };
  /** Forward length tip → base in pixels. */
  length: number;
  /** IR style for stroke color / width. */
  style: IRStyle;
  /** Coordinate transform for IR → pixel scaling. */
  transform: CoordinateTransform;
}

/**
 * Union of Konva nodes a marker can return — Shape for primitive markers
 * (Path, Line, Circle…) or Group for composite markers.
 * This is what `Konva.Group.add()` accepts, so callers can drop the result
 * directly into an edge group.
 */
export type ArrowMarkerNode = Konva.Shape | Konva.Group;

/**
 * Renders one arrow marker variant.
 * Returns null when the marker is unrenderable (zero-length, invalid style, ...).
 */
export type ArrowMarkerRenderer = (ctx: ArrowMarkerContext) => ArrowMarkerNode | null;
