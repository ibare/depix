/**
 * InspectorPanel Tests
 *
 * Tests: shell, tab switching, drag, cancel/done, badges,
 * object card sliding, edge handle.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { InspectorPanel } from '../src/components/editor/InspectorPanel.js';
import type { InspectorPanelProps } from '../src/components/editor/InspectorPanel.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultProps(overrides: Partial<InspectorPanelProps> = {}): InspectorPanelProps {
  return {
    ir: null,
    dsl: '',
    onDSLChange: vi.fn(),
    activeSceneIndex: 0,
    onActiveSceneIndexChange: vi.fn(),
    selectedElementId: null,
    onSelectElement: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
}

const irWithElement = {
  meta: { aspectRatio: { width: 16, height: 9 }, background: { type: 'solid' as const, color: '#fff' } },
  scenes: [
    {
      name: 'Scene 1',
      elements: [
        { id: 'el-1', type: 'shape' as const, bounds: { x: 0, y: 0, w: 10, h: 10 }, style: {} },
      ],
    },
  ],
};

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('InspectorPanel — rendering', () => {
  it('renders with region role and aria-label', () => {
    const { getByRole } = render(<InspectorPanel {...defaultProps()} />);
    const panel = getByRole('region');
    expect(panel).toBeDefined();
    expect(panel.getAttribute('aria-label')).toBe('Inspector panel');
  });

  it('renders 3 tab buttons (Layers, Canvas, Scenes)', () => {
    const { container } = render(<InspectorPanel {...defaultProps()} />);
    const tabButtons = container.querySelectorAll('[data-panel-tab]');
    expect(tabButtons).toHaveLength(3);

    const tabIds = Array.from(tabButtons).map((btn) => btn.getAttribute('data-panel-tab'));
    expect(tabIds).toEqual(['layers', 'canvas', 'scenes']);
  });

  it('renders Cancel and Done buttons', () => {
    const { getByTestId } = render(<InspectorPanel {...defaultProps()} />);
    expect(getByTestId('inspector-cancel')).toBeDefined();
    expect(getByTestId('inspector-done')).toBeDefined();
  });

  it('renders drag handle', () => {
    const { getByTestId } = render(<InspectorPanel {...defaultProps()} />);
    expect(getByTestId('inspector-drag-handle')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------

describe('InspectorPanel — tab switching', () => {
  it('shows Layers tab content by default', () => {
    const { getByTestId } = render(<InspectorPanel {...defaultProps()} />);
    expect(getByTestId('tab-content-layers')).toBeDefined();
  });

  it('switches to Canvas tab on click', () => {
    const { container, getByTestId } = render(<InspectorPanel {...defaultProps()} />);
    const canvasTab = container.querySelector('[data-panel-tab="canvas"]') as HTMLElement;
    fireEvent.click(canvasTab);
    expect(getByTestId('tab-content-canvas')).toBeDefined();
  });

  it('switches to Scenes tab on click', () => {
    const { container, getByTestId } = render(<InspectorPanel {...defaultProps()} />);
    const scenesTab = container.querySelector('[data-panel-tab="scenes"]') as HTMLElement;
    fireEvent.click(scenesTab);
    expect(getByTestId('tab-content-scenes')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Callbacks
// ---------------------------------------------------------------------------

describe('InspectorPanel — callbacks', () => {
  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    const { getByTestId } = render(<InspectorPanel {...defaultProps({ onCancel })} />);
    fireEvent.click(getByTestId('inspector-cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onConfirm when Done is clicked', () => {
    const onConfirm = vi.fn();
    const { getByTestId } = render(<InspectorPanel {...defaultProps({ onConfirm })} />);
    fireEvent.click(getByTestId('inspector-done'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Tab badges
// ---------------------------------------------------------------------------

describe('InspectorPanel — badges', () => {
  it('shows scene count badge on Scenes tab', () => {
    const ir = {
      meta: { aspectRatio: { width: 16, height: 9 }, background: { type: 'solid' as const, color: '#fff' } },
      scenes: [
        { name: 'Scene 1', elements: [] },
        { name: 'Scene 2', elements: [] },
        { name: 'Scene 3', elements: [] },
      ],
    };

    const { container } = render(<InspectorPanel {...defaultProps({ ir: ir as any })} />);
    const scenesTab = container.querySelector('[data-panel-tab="scenes"]') as HTMLElement;
    expect(scenesTab.textContent).toContain('3');
  });
});

// ---------------------------------------------------------------------------
// Object card (sliding behind main panel)
// ---------------------------------------------------------------------------

describe('InspectorPanel — object card', () => {
  it('object card is hidden (translateX 0) when no selection', () => {
    const { getByTestId } = render(<InspectorPanel {...defaultProps()} />);
    const card = getByTestId('object-card');
    expect(card.style.transform).toBe('translateX(0)');
  });

  it('object card slides out when element is selected', () => {
    const { getByTestId } = render(
      <InspectorPanel {...defaultProps({ ir: irWithElement as any, selectedElementId: 'el-1' })} />,
    );
    const card = getByTestId('object-card');
    expect(card.style.transform).toContain('translateX(-');
  });

  it('object card stays hidden on Canvas tab even with selection', () => {
    const { container, getByTestId } = render(
      <InspectorPanel {...defaultProps({ ir: irWithElement as any, selectedElementId: 'el-1' })} />,
    );
    const canvasTab = container.querySelector('[data-panel-tab="canvas"]') as HTMLElement;
    fireEvent.click(canvasTab);
    const card = getByTestId('object-card');
    expect(card.style.transform).toBe('translateX(0)');
  });
});

// ---------------------------------------------------------------------------
// Edge handle
// ---------------------------------------------------------------------------

describe('InspectorPanel — edge handle', () => {
  it('renders edge handle on Layers tab', () => {
    const { getByTestId } = render(<InspectorPanel {...defaultProps()} />);
    expect(getByTestId('object-edge-handle')).toBeDefined();
  });

  it('hides edge handle on non-Layers tabs', () => {
    const { container, queryByTestId } = render(<InspectorPanel {...defaultProps()} />);
    const canvasTab = container.querySelector('[data-panel-tab="canvas"]') as HTMLElement;
    fireEvent.click(canvasTab);
    expect(queryByTestId('object-edge-handle')).toBeNull();
  });

  it('edge handle click with selection calls onSelectElement(null)', () => {
    const onSelectElement = vi.fn();
    const { getByTestId } = render(
      <InspectorPanel {...defaultProps({ ir: irWithElement as any, selectedElementId: 'el-1', onSelectElement })} />,
    );
    fireEvent.click(getByTestId('object-edge-handle'));
    expect(onSelectElement).toHaveBeenCalledWith(null);
  });

  it('edge handle click without selection toggles object card open', () => {
    const { getByTestId } = render(<InspectorPanel {...defaultProps()} />);
    // Initially hidden
    expect(getByTestId('object-card').style.transform).toBe('translateX(0)');
    // Click edge handle to open
    fireEvent.click(getByTestId('object-edge-handle'));
    expect(getByTestId('object-card').style.transform).toContain('translateX(-');
  });

  it('edge handle is inside object card (moves together)', () => {
    const { getByTestId } = render(
      <InspectorPanel {...defaultProps({ ir: irWithElement as any, selectedElementId: 'el-1' })} />,
    );
    const card = getByTestId('object-card');
    const handle = getByTestId('object-edge-handle');
    // Card slides and handle is a child of card
    expect(card.style.transform).toContain('translateX(-');
    expect(card.contains(handle)).toBe(true);
  });
});
