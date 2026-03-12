/**
 * FieldGrid
 *
 * A CSS grid wrapper for laying out property controls in columns.
 */

import React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FieldGridProps {
  /** Number of columns. Default: 1 */
  columns?: 1 | 2 | 3 | 4;
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FieldGrid: React.FC<FieldGridProps> = ({
  columns = 1,
  children,
}) => {
  const style: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap: 4,
  };

  return (
    <div data-grid-columns={columns} style={style}>
      {children}
    </div>
  );
};
