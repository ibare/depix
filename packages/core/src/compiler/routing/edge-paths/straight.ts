/**
 * Straight Edge Path
 *
 * 가장 단순한 경로: from → to 직선.
 */

import type { IREdgePathStraight } from '../../../ir/types.js';

export function createStraightPath(): IREdgePathStraight {
  return { type: 'straight' };
}
