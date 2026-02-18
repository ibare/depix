import type { IRBounds } from '@depix/core';
import type { SnapPoint, SnapResult, GuideLine, SnapPointType } from './types.js';

/**
 * Pure-math snap calculator for the guide system.
 *
 * All coordinates are in IRBounds 0-100 relative space.
 */
export class SnapCalculator {
  private threshold: number;

  constructor(threshold: number = 1.0) {
    this.threshold = threshold;
  }

  /** Update the snap threshold. */
  setThreshold(threshold: number): void {
    this.threshold = threshold;
  }

  /** Extract all 6 snap points from a single element's bounds. */
  extractSnapPoints(elementId: string, bounds: IRBounds): SnapPoint[] {
    return [
      { value: bounds.x, type: 'left' as SnapPointType, elementId },
      { value: bounds.x + bounds.w / 2, type: 'center-x' as SnapPointType, elementId },
      { value: bounds.x + bounds.w, type: 'right' as SnapPointType, elementId },
      { value: bounds.y, type: 'top' as SnapPointType, elementId },
      { value: bounds.y + bounds.h / 2, type: 'center-y' as SnapPointType, elementId },
      { value: bounds.y + bounds.h, type: 'bottom' as SnapPointType, elementId },
    ];
  }

  /** Extract snap points from multiple elements, separated by axis. */
  extractAllSnapPoints(elements: Array<{ id: string; bounds: IRBounds }>): {
    vertical: SnapPoint[];
    horizontal: SnapPoint[];
  } {
    const vertical: SnapPoint[] = [];
    const horizontal: SnapPoint[] = [];

    for (const el of elements) {
      const points = this.extractSnapPoints(el.id, el.bounds);
      for (const p of points) {
        if (p.type === 'left' || p.type === 'center-x' || p.type === 'right') {
          vertical.push(p);
        } else {
          horizontal.push(p);
        }
      }
    }

    return { vertical, horizontal };
  }

  /**
   * Calculate snap result for a dragging element against other elements.
   *
   * @param draggingBounds - Current bounds of the element being dragged
   * @param otherElements - Other elements to snap against
   * @param canvasWidth - Canvas width for edge snapping (default 100)
   * @param canvasHeight - Canvas height for edge snapping (default 100)
   * @returns SnapResult with snapped position and guide lines
   */
  calculateSnap(
    draggingBounds: IRBounds,
    otherElements: Array<{ id: string; bounds: IRBounds }>,
    canvasWidth: number = 100,
    canvasHeight: number = 100,
  ): SnapResult {
    // 1. Extract snap points from other elements
    const { vertical: otherVertical, horizontal: otherHorizontal } =
      this.extractAllSnapPoints(otherElements);

    // 2. Add canvas edge snap points
    const canvasId = '__canvas__';
    otherVertical.push(
      { value: 0, type: 'left', elementId: canvasId },
      { value: canvasWidth / 2, type: 'center-x', elementId: canvasId },
      { value: canvasWidth, type: 'right', elementId: canvasId },
    );
    otherHorizontal.push(
      { value: 0, type: 'top', elementId: canvasId },
      { value: canvasHeight / 2, type: 'center-y', elementId: canvasId },
      { value: canvasHeight, type: 'bottom', elementId: canvasId },
    );

    // 3. Extract snap points from dragging element
    const draggingPoints = this.extractSnapPoints('__dragging__', draggingBounds);
    const draggingVertical = draggingPoints.filter(
      (p) => p.type === 'left' || p.type === 'center-x' || p.type === 'right',
    );
    const draggingHorizontal = draggingPoints.filter(
      (p) => p.type === 'top' || p.type === 'center-y' || p.type === 'bottom',
    );

    // 4. Find closest X match
    let bestXDelta: number | undefined;
    let bestXDistance = Infinity;
    let bestXDraggingPoint: SnapPoint | undefined;
    let bestXTargetPoint: SnapPoint | undefined;

    for (const dp of draggingVertical) {
      for (const tp of otherVertical) {
        const distance = Math.abs(dp.value - tp.value);
        if (distance < bestXDistance && distance <= this.threshold) {
          bestXDistance = distance;
          bestXDelta = tp.value - dp.value;
          bestXDraggingPoint = dp;
          bestXTargetPoint = tp;
        }
      }
    }

    // 5. Find closest Y match
    let bestYDelta: number | undefined;
    let bestYDistance = Infinity;
    let bestYDraggingPoint: SnapPoint | undefined;
    let bestYTargetPoint: SnapPoint | undefined;

    for (const dp of draggingHorizontal) {
      for (const tp of otherHorizontal) {
        const distance = Math.abs(dp.value - tp.value);
        if (distance < bestYDistance && distance <= this.threshold) {
          bestYDistance = distance;
          bestYDelta = tp.value - dp.value;
          bestYDraggingPoint = dp;
          bestYTargetPoint = tp;
        }
      }
    }

    // 6. Build guide lines
    const guides: GuideLine[] = [];

    if (bestXDelta !== undefined && bestXDraggingPoint && bestXTargetPoint) {
      const snappedBounds = {
        ...draggingBounds,
        x: draggingBounds.x + bestXDelta,
      };
      guides.push(
        this.buildVerticalGuide(bestXTargetPoint.value, snappedBounds, bestXTargetPoint, otherElements),
      );
    }

    if (bestYDelta !== undefined && bestYDraggingPoint && bestYTargetPoint) {
      const snappedBounds = {
        ...draggingBounds,
        y: draggingBounds.y + (bestYDelta ?? 0),
      };
      guides.push(
        this.buildHorizontalGuide(bestYTargetPoint.value, snappedBounds, bestYTargetPoint, otherElements),
      );
    }

    // 7. Build result
    const deltaX = bestXDelta ?? 0;
    const deltaY = bestYDelta ?? 0;

    return {
      snappedX: bestXDelta !== undefined ? draggingBounds.x + deltaX : undefined,
      snappedY: bestYDelta !== undefined ? draggingBounds.y + deltaY : undefined,
      deltaX,
      deltaY,
      guides,
    };
  }

  /**
   * Build a vertical guide line (for X-axis snapping).
   * The line extends vertically from the topmost to bottommost relevant edge.
   */
  private buildVerticalGuide(
    xPosition: number,
    snappedDraggingBounds: IRBounds,
    targetPoint: SnapPoint,
    otherElements: Array<{ id: string; bounds: IRBounds }>,
  ): GuideLine {
    const relevantYValues: number[] = [
      snappedDraggingBounds.y,
      snappedDraggingBounds.y + snappedDraggingBounds.h,
    ];

    // Add the matched element's Y extents (if not canvas)
    if (targetPoint.elementId !== '__canvas__') {
      const matchedEl = otherElements.find((e) => e.id === targetPoint.elementId);
      if (matchedEl) {
        relevantYValues.push(matchedEl.bounds.y, matchedEl.bounds.y + matchedEl.bounds.h);
      }
    }

    return {
      isVertical: true,
      position: xPosition,
      start: Math.min(...relevantYValues),
      end: Math.max(...relevantYValues),
    };
  }

  /**
   * Build a horizontal guide line (for Y-axis snapping).
   * The line extends horizontally from the leftmost to rightmost relevant edge.
   */
  private buildHorizontalGuide(
    yPosition: number,
    snappedDraggingBounds: IRBounds,
    targetPoint: SnapPoint,
    otherElements: Array<{ id: string; bounds: IRBounds }>,
  ): GuideLine {
    const relevantXValues: number[] = [
      snappedDraggingBounds.x,
      snappedDraggingBounds.x + snappedDraggingBounds.w,
    ];

    // Add the matched element's X extents (if not canvas)
    if (targetPoint.elementId !== '__canvas__') {
      const matchedEl = otherElements.find((e) => e.id === targetPoint.elementId);
      if (matchedEl) {
        relevantXValues.push(matchedEl.bounds.x, matchedEl.bounds.x + matchedEl.bounds.w);
      }
    }

    return {
      isVertical: false,
      position: yPosition,
      start: Math.min(...relevantXValues),
      end: Math.max(...relevantXValues),
    };
  }
}
