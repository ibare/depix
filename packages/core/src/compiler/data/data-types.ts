/**
 * Data DSL Type Definitions
 *
 * Types for structured data (tables, charts) defined via @data directives
 * or inline within table/chart blocks.
 */

// ---------------------------------------------------------------------------
// Data row
// ---------------------------------------------------------------------------

export interface DataRow {
  values: (string | number)[];
}

// ---------------------------------------------------------------------------
// Data set
// ---------------------------------------------------------------------------

export interface DataSet {
  /** Identifier from @data "name" */
  id: string;
  /** Column headers (extracted from first row) */
  columns: string[];
  /** Data rows (excluding header row) */
  rows: DataRow[];
}

// ---------------------------------------------------------------------------
// Data map
// ---------------------------------------------------------------------------

/** Map of dataset name → DataSet, populated from @data directives. */
export type DataMap = Map<string, DataSet>;
