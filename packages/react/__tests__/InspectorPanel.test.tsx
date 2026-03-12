/**
 * InspectorPanel Tests
 *
 * Tests: shell, tab switching, drag, cancel/done, badges, companion panel.
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

  it('renders 4 tab buttons', () => {
    const { container } = render(<InspectorPanel {...defaultProps()} />);
    const tabButtons = container.querySelectorAll('[data-panel-tab]');
    expect(tabButtons).toHaveLength(4);

    const tabIds = Array.from(tabButtons).map((btn) => btn.getAttribute('data-panel-tab'));
    expect(tabIds).toEqual(['object', 'layers', 'canvas', 'scenes']);
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
  it('shows Object tab content by default', () => {
    const { getByTestId } = render(<InspectorPanel {...defaultProps()} />);
    expect(getByTestId('tab-content-object')).toBeDefined();
  });

  it('switches to Layers tab on click', () => {
    const { container, getByTestId, queryByTestId } = render(
      <InspectorPanel {...defaultProps()} />,
    );
    const layersTab = container.querySelector('[data-panel-tab="layers"]') as HTMLElement;
    fireEvent.click(layersTab);

    expect(getByTestId('tab-content-layers')).toBeDefined();
    expect(queryByTestId('tab-content-object')).toBeNull();
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
  it('shows element count badge on Layers tab', () => {
    const ir = {
      meta: { aspectRatio: { width: 16, height: 9 }, background: { type: 'solid' as const, color: '#fff' } },
      scenes: [
        {
          name: 'Scene 1',
          elements: [
            { id: 'el-1', type: 'shape' as const, bounds: { x: 0, y: 0, w: 10, h: 10 }, style: {} },
            { id: 'el-2', type: 'shape' as const, bounds: { x: 0, y: 0, w: 10, h: 10 }, style: {} },
          ],
        },
      ],
    };

    const { container } = render(<InspectorPanel {...defaultProps({ ir: ir as any })} />);
    const layersTab = container.querySelector('[data-panel-tab="layers"]') as HTMLElement;
    expect(layersTab.textContent).toContain('2');
  });

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
// Companion panel (side expansion)
// ---------------------------------------------------------------------------

describe('InspectorPanel — companion panel', () => {
  it('shows companion toggle on Object tab', () => {
    const { getByTestId } = render(<InspectorPanel {...defaultProps()} />);
    expect(getByTestId('companion-toggle')).toBeDefined();
  });

  it('shows companion toggle on Layers tab', () => {
    const { container, getByTestId } = render(<InspectorPanel {...defaultProps()} />);
    const layersTab = container.querySelector('[data-panel-tab="layers"]') as HTMLElement;
    fireEvent.click(layersTab);
    expect(getByTestId('companion-toggle')).toBeDefined();
  });

  it('hides companion toggle on Canvas tab', () => {
    const { container, queryByTestId } = render(<InspectorPanel {...defaultProps()} />);
    const canvasTab = container.querySelector('[data-panel-tab="canvas"]') as HTMLElement;
    fireEvent.click(canvasTab);
    expect(queryByTestId('companion-toggle')).toBeNull();
  });

  it('hides companion toggle on Scenes tab', () => {
    const { container, queryByTestId } = render(<InspectorPanel {...defaultProps()} />);
    const scenesTab = container.querySelector('[data-panel-tab="scenes"]') as HTMLElement;
    fireEvent.click(scenesTab);
    expect(queryByTestId('companion-toggle')).toBeNull();
  });

  it('opens companion panel on toggle click', () => {
    const { getByTestId, queryByTestId } = render(<InspectorPanel {...defaultProps()} />);

    // Initially no companion panel
    expect(queryByTestId('companion-panel')).toBeNull();

    // Click toggle
    fireEvent.click(getByTestId('companion-toggle'));

    // Companion panel appears
    expect(getByTestId('companion-panel')).toBeDefined();
  });

  it('closes companion panel on second toggle click', () => {
    const { getByTestId, queryByTestId } = render(<InspectorPanel {...defaultProps()} />);

    // Open
    fireEvent.click(getByTestId('companion-toggle'));
    expect(getByTestId('companion-panel')).toBeDefined();

    // Close
    fireEvent.click(getByTestId('companion-toggle'));
    expect(queryByTestId('companion-panel')).toBeNull();
  });
});
