/**
 * Vitest global setup for @depix/core tests.
 *
 * - Registers custom IR matchers (toHaveBoundsCloseTo, toMatchIRStructure)
 * - Resets test ID counter before each test for deterministic IDs
 */

import { beforeEach } from 'vitest';
import { registerMatchers } from './helpers/matchers.js';
import { resetTestIds } from './helpers/ir-builders.js';

// Register custom matchers globally
registerMatchers();

// Reset test ID counter before each test for deterministic, independent tests
beforeEach(() => {
  resetTestIds();
});
