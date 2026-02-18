/**
 * ToolIcons
 *
 * SVG tool icons for the Depix editor toolbar.
 * All icons are 16x16, use currentColor, and are designed as React components.
 */

import React from 'react';

const svgProps: React.SVGProps<SVGSVGElement> = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
};

export const SelectIcon: React.FC = () => (
  <svg {...svgProps}>
    <path d="M3 2L3 13L6.5 9.5L10 13L12 11L8.5 7.5L13 5L3 2Z" fill="currentColor" />
  </svg>
);

export const RectIcon: React.FC = () => (
  <svg {...svgProps}>
    <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export const CircleIcon: React.FC = () => (
  <svg {...svgProps}>
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export const TextIcon: React.FC = () => (
  <svg {...svgProps}>
    <path d="M4 4H12M8 4V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M6 13H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const LineIcon: React.FC = () => (
  <svg {...svgProps}>
    <path d="M3 13L13 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const ConnectorIcon: React.FC = () => (
  <svg {...svgProps}>
    <circle cx="3" cy="8" r="2" stroke="currentColor" strokeWidth="1" />
    <circle cx="13" cy="8" r="2" stroke="currentColor" strokeWidth="1" />
    <path d="M5 8H9" stroke="currentColor" strokeWidth="1.5" />
    <path d="M9 6L11 8L9 10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ImageIcon: React.FC = () => (
  <svg {...svgProps}>
    <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="5.5" cy="6" r="1.5" fill="currentColor" />
    <path d="M2 11L5 8L8 11L10 9L14 13" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
  </svg>
);

export const UndoIcon: React.FC = () => (
  <svg {...svgProps}>
    <path d="M4 7H10C11.6569 7 13 8.3431 13 10C13 11.6569 11.6569 13 10 13H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M7 4L4 7L7 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const RedoIcon: React.FC = () => (
  <svg {...svgProps}>
    <path d="M12 7H6C4.34315 7 3 8.3431 3 10C3 11.6569 4.34315 13 6 13H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M9 4L12 7L9 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const DeleteIcon: React.FC = () => (
  <svg {...svgProps}>
    <path d="M5 4V3C5 2.44772 5.44772 2 6 2H10C10.5523 2 11 2.44772 11 3V4" stroke="currentColor" strokeWidth="1.2" />
    <path d="M3 4H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M4 4L5 14H11L12 4" stroke="currentColor" strokeWidth="1.2" />
    <path d="M7 7V11M9 7V11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

/** Map tool type strings to icon components. */
export const TOOL_ICON_MAP: Record<string, React.FC> = {
  select: SelectIcon,
  rect: RectIcon,
  circle: CircleIcon,
  text: TextIcon,
  line: LineIcon,
  connector: ConnectorIcon,
  image: ImageIcon,
  undo: UndoIcon,
  redo: RedoIcon,
  delete: DeleteIcon,
};
