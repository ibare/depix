/**
 * FloatingPropertyPanel Tests
 *
 * Tests the floating property panel for:
 * - Rendering states (no selection, single, multiple)
 * - Element type-specific editors (shape, text, line, edge, container, image)
 * - Style change callbacks
 * - Text change callbacks
 * - Bounds change callbacks
 * - Individual property control components
 * - className/style passthrough
 * - Draggable behavior
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { FloatingPropertyPanel } from '../src/components/FloatingPropertyPanel.js';
import type { FloatingPropertyPanelProps } from '../src/components/FloatingPropertyPanel.js';
import { ColorInput } from '../src/components/property-controls/ColorInput.js';
import { NumberInput } from '../src/components/property-controls/NumberInput.js';
import { SliderInput } from '../src/components/property-controls/SliderInput.js';
import { SelectInput } from '../src/components/property-controls/SelectInput.js';
import { TextInput } from '../src/components/property-controls/TextInput.js';
import type {
  IRElement,
  IRShape,
  IRText,
  IRLine,
  IREdge,
  IRContainer,
  IRImage,
  IRPath,
} from '@depix/core';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeShape(overrides: Partial<IRShape> = {}): IRShape {
  return {
    id: 'shape-1',
    type: 'shape',
    shape: 'rect',
    bounds: { x: 10, y: 20, w: 30, h: 40 },
    style: { fill: '#ff0000', stroke: '#000000', strokeWidth: 2 },
    ...overrides,
  };
}

function makeText(overrides: Partial<IRText> = {}): IRText {
  return {
    id: 'text-1',
    type: 'text',
    bounds: { x: 10, y: 20, w: 30, h: 40 },
    style: { fill: '#ffffff' },
    content: 'Hello World',
    fontSize: 16,
    color: '#333333',
    ...overrides,
  };
}

function makeLine(overrides: Partial<IRLine> = {}): IRLine {
  return {
    id: 'line-1',
    type: 'line',
    bounds: { x: 0, y: 0, w: 100, h: 100 },
    style: { stroke: '#000000', strokeWidth: 2 },
    from: { x: 10, y: 10 },
    to: { x: 90, y: 90 },
    arrowStart: 'none',
    arrowEnd: 'triangle',
    ...overrides,
  };
}

function makeEdge(overrides: Partial<IREdge> = {}): IREdge {
  return {
    id: 'edge-1',
    type: 'edge',
    bounds: { x: 0, y: 0, w: 100, h: 100 },
    style: { stroke: '#555555' },
    fromId: 'a',
    toId: 'b',
    fromAnchor: { x: 50, y: 50 },
    toAnchor: { x: 80, y: 80 },
    path: { type: 'straight' },
    labels: [{ text: 'label', position: { x: 60, y: 60 }, placement: 'middle', fontSize: 12, color: '#000' }],
    ...overrides,
  };
}

function makeContainer(overrides: Partial<IRContainer> = {}): IRContainer {
  return {
    id: 'container-1',
    type: 'container',
    bounds: { x: 0, y: 0, w: 50, h: 50 },
    style: { fill: '#eeeeee' },
    children: [],
    clip: true,
    ...overrides,
  };
}

function makeImage(overrides: Partial<IRImage> = {}): IRImage {
  return {
    id: 'image-1',
    type: 'image',
    bounds: { x: 5, y: 5, w: 20, h: 20 },
    style: {},
    src: 'https://example.com/img.png',
    fit: 'cover',
    ...overrides,
  };
}

function makePath(overrides: Partial<IRPath> = {}): IRPath {
  return {
    id: 'path-1',
    type: 'path',
    bounds: { x: 0, y: 0, w: 50, h: 50 },
    style: { fill: '#00ff00', stroke: '#000000' },
    d: 'M 0 0 L 50 50',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPanel(overrides: Partial<FloatingPropertyPanelProps> = {}) {
  const defaultProps: FloatingPropertyPanelProps = {
    elements: [],
    onStyleChange: vi.fn(),
    ...overrides,
  };
  return {
    ...render(<FloatingPropertyPanel {...defaultProps} />),
    props: defaultProps,
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

// ===========================================================================
// Tests
// ===========================================================================

describe('FloatingPropertyPanel', () => {
  // ---- Rendering states ---------------------------------------------------

  describe('rendering - no selection', () => {
    it('renders with role="region"', () => {
      const { container } = renderPanel();
      const panel = container.querySelector('[role="region"]');

      expect(panel).not.toBeNull();
    });

    it('renders aria-label on the panel', () => {
      const { container } = renderPanel();
      const panel = container.querySelector('[role="region"]');

      expect(panel!.getAttribute('aria-label')).toBe('Property panel');
    });

    it('shows "No selection" when no elements provided', () => {
      const { container } = renderPanel({ elements: [] });

      expect(container.textContent).toContain('No selection');
    });
  });

  describe('rendering - single selection', () => {
    it('shows element type header for a shape', () => {
      const { container } = renderPanel({ elements: [makeShape()] });

      expect(container.textContent).toContain('Shape');
    });

    it('shows element type header for text', () => {
      const { container } = renderPanel({ elements: [makeText()] });

      expect(container.textContent).toContain('Text');
    });

    it('shows common style section for any element', () => {
      const { container } = renderPanel({ elements: [makeShape()] });
      const styleSection = container.querySelector('[data-section="style"]');

      expect(styleSection).not.toBeNull();
    });

    it('shows bounds section for any element', () => {
      const { container } = renderPanel({ elements: [makeShape()] });
      const boundsSection = container.querySelector('[data-section="bounds"]');

      expect(boundsSection).not.toBeNull();
    });
  });

  describe('rendering - multi selection', () => {
    it('shows element count header', () => {
      const { container } = renderPanel({
        elements: [makeShape(), makeText()],
      });

      expect(container.textContent).toContain('2 elements selected');
    });

    it('shows common style section for multi-selection', () => {
      const { container } = renderPanel({
        elements: [makeShape(), makeText()],
      });
      const multiSection = container.querySelector('[data-section="multi-style"]');

      expect(multiSection).not.toBeNull();
    });

    it('does not show type-specific sections for multi-selection', () => {
      const { container } = renderPanel({
        elements: [makeShape(), makeText()],
      });
      const shapeSection = container.querySelector('[data-section="shape"]');
      const textSection = container.querySelector('[data-section="text"]');

      expect(shapeSection).toBeNull();
      expect(textSection).toBeNull();
    });
  });

  // ---- Type-specific editors -----------------------------------------------

  describe('shape editor', () => {
    it('shows shape section for shape elements', () => {
      const { container } = renderPanel({ elements: [makeShape()] });
      const section = container.querySelector('[data-section="shape"]');

      expect(section).not.toBeNull();
    });

    it('displays corner radius input', () => {
      const shape = makeShape({ cornerRadius: 8 });
      const { container } = renderPanel({ elements: [shape] });

      expect(container.textContent).toContain('Corner Radius');
    });

    it('displays inner text input', () => {
      const shape = makeShape({
        innerText: { content: 'Hello', color: '#000', fontSize: 14 },
      });
      const { container } = renderPanel({ elements: [shape] });

      expect(container.textContent).toContain('Inner Text');
    });
  });

  describe('text editor', () => {
    it('shows text section for text elements', () => {
      const { container } = renderPanel({ elements: [makeText()] });
      const section = container.querySelector('[data-section="text"]');

      expect(section).not.toBeNull();
    });

    it('displays content, font size, font weight, and text align', () => {
      const { container } = renderPanel({ elements: [makeText()] });

      expect(container.textContent).toContain('Content');
      expect(container.textContent).toContain('Font Size');
      expect(container.textContent).toContain('Font Weight');
      expect(container.textContent).toContain('Text Align');
    });
  });

  describe('line editor', () => {
    it('shows line section for line elements', () => {
      const { container } = renderPanel({ elements: [makeLine()] });
      const section = container.querySelector('[data-section="line"]');

      expect(section).not.toBeNull();
    });

    it('displays stroke width and arrow controls', () => {
      const { container } = renderPanel({ elements: [makeLine()] });

      expect(container.textContent).toContain('Arrow Start');
      expect(container.textContent).toContain('Arrow End');
    });
  });

  describe('edge editor', () => {
    it('shows edge section for edge elements', () => {
      const { container } = renderPanel({ elements: [makeEdge()] });
      const section = container.querySelector('[data-section="edge"]');

      expect(section).not.toBeNull();
    });

    it('displays path type and label', () => {
      const { container } = renderPanel({ elements: [makeEdge()] });

      expect(container.textContent).toContain('Path Type');
      expect(container.textContent).toContain('Label');
    });
  });

  describe('container editor', () => {
    it('shows container section for container elements', () => {
      const { container } = renderPanel({ elements: [makeContainer()] });
      const section = container.querySelector('[data-section="container"]');

      expect(section).not.toBeNull();
    });

    it('displays background and clip controls', () => {
      const { container } = renderPanel({ elements: [makeContainer()] });

      expect(container.textContent).toContain('Background');
      expect(container.textContent).toContain('Clip');
    });
  });

  describe('image editor', () => {
    it('shows image section for image elements', () => {
      const { container } = renderPanel({ elements: [makeImage()] });
      const section = container.querySelector('[data-section="image"]');

      expect(section).not.toBeNull();
    });

    it('displays source and fit controls', () => {
      const { container } = renderPanel({ elements: [makeImage()] });

      expect(container.textContent).toContain('Source');
      expect(container.textContent).toContain('Fit');
    });
  });

  describe('path element', () => {
    it('shows common style for path elements (no type-specific section)', () => {
      const { container } = renderPanel({ elements: [makePath()] });
      const styleSection = container.querySelector('[data-section="style"]');

      expect(styleSection).not.toBeNull();
    });
  });

  // ---- Style change callbacks -----------------------------------------------

  describe('style change callbacks', () => {
    it('calls onStyleChange when fill color is changed', () => {
      const onStyleChange = vi.fn();
      const shape = makeShape();
      const { container } = renderPanel({ elements: [shape], onStyleChange });

      // Find the first color input in the style section
      const styleSection = container.querySelector('[data-section="style"]');
      const colorInputs = styleSection!.querySelectorAll('input[type="color"]');
      const fillInput = colorInputs[0] as HTMLInputElement;

      fireEvent.change(fillInput, { target: { value: '#00ff00' } });

      expect(onStyleChange).toHaveBeenCalledWith('shape-1', { fill: '#00ff00' });
    });

    it('calls onStyleChange when stroke color is changed', () => {
      const onStyleChange = vi.fn();
      const shape = makeShape();
      const { container } = renderPanel({ elements: [shape], onStyleChange });

      const styleSection = container.querySelector('[data-section="style"]');
      const colorInputs = styleSection!.querySelectorAll('input[type="color"]');
      const strokeInput = colorInputs[1] as HTMLInputElement;

      fireEvent.change(strokeInput, { target: { value: '#0000ff' } });

      expect(onStyleChange).toHaveBeenCalledWith('shape-1', { stroke: '#0000ff' });
    });

    it('calls onStyleChange when stroke width is changed', () => {
      const onStyleChange = vi.fn();
      const shape = makeShape();
      const { container } = renderPanel({ elements: [shape], onStyleChange });

      const styleSection = container.querySelector('[data-section="style"]');
      const numberInputs = styleSection!.querySelectorAll('input[type="number"]');
      const strokeWidthInput = numberInputs[0] as HTMLInputElement;

      fireEvent.change(strokeWidthInput, { target: { value: '5' } });

      expect(onStyleChange).toHaveBeenCalledWith('shape-1', { strokeWidth: 5 });
    });

    it('calls onStyleChange for all elements in multi-selection', () => {
      const onStyleChange = vi.fn();
      const s1 = makeShape({ id: 'a' });
      const s2 = makeShape({ id: 'b' });
      const { container } = renderPanel({ elements: [s1, s2], onStyleChange });

      const multiSection = container.querySelector('[data-section="multi-style"]');
      const colorInputs = multiSection!.querySelectorAll('input[type="color"]');
      const fillInput = colorInputs[0] as HTMLInputElement;

      fireEvent.change(fillInput, { target: { value: '#abcdef' } });

      expect(onStyleChange).toHaveBeenCalledTimes(2);
      expect(onStyleChange).toHaveBeenCalledWith('a', { fill: '#abcdef' });
      expect(onStyleChange).toHaveBeenCalledWith('b', { fill: '#abcdef' });
    });
  });

  // ---- Text change callbacks ------------------------------------------------

  describe('text change callbacks', () => {
    it('calls onTextChange when text content is changed', () => {
      const onTextChange = vi.fn();
      const text = makeText();
      const { container } = renderPanel({
        elements: [text],
        onTextChange,
      });

      const textSection = container.querySelector('[data-section="text"]');
      const textarea = textSection!.querySelector('textarea') as HTMLTextAreaElement;

      fireEvent.change(textarea, { target: { value: 'New text' } });

      expect(onTextChange).toHaveBeenCalledWith('text-1', 'New text');
    });

    it('calls onTextChange when shape inner text is changed', () => {
      const onTextChange = vi.fn();
      const shape = makeShape({
        innerText: { content: 'Old', color: '#000', fontSize: 14 },
      });
      const { container } = renderPanel({
        elements: [shape],
        onTextChange,
      });

      const shapeSection = container.querySelector('[data-section="shape"]');
      const textInput = shapeSection!.querySelector('input[type="text"]') as HTMLInputElement;

      fireEvent.change(textInput, { target: { value: 'New inner text' } });

      expect(onTextChange).toHaveBeenCalledWith('shape-1', 'New inner text');
    });
  });

  // ---- Bounds change callbacks -----------------------------------------------

  describe('bounds change callbacks', () => {
    it('calls onBoundsChange when X is changed', () => {
      const onBoundsChange = vi.fn();
      const shape = makeShape();
      const { container } = renderPanel({
        elements: [shape],
        onBoundsChange,
      });

      const boundsSection = container.querySelector('[data-section="bounds"]');
      const numberInputs = boundsSection!.querySelectorAll('input[type="number"]');
      const xInput = numberInputs[0] as HTMLInputElement;

      fireEvent.change(xInput, { target: { value: '50' } });

      expect(onBoundsChange).toHaveBeenCalledWith('shape-1', { x: 50 });
    });
  });

  // ---- className / style ---------------------------------------------------

  describe('className and style', () => {
    it('passes className to the panel element', () => {
      const { container } = renderPanel({ className: 'my-panel' });
      const panel = container.querySelector('[role="region"]') as HTMLElement;

      expect(panel.className).toBe('my-panel');
    });

    it('passes style to the panel element', () => {
      const { container } = renderPanel({
        style: { top: '50px', right: '20px' },
      });
      const panel = container.querySelector('[role="region"]') as HTMLElement;

      expect(panel.style.top).toBe('50px');
      expect(panel.style.right).toBe('20px');
    });
  });

  // ---- Draggable -----------------------------------------------------------

  describe('draggable', () => {
    it('has data-draggable="true" by default', () => {
      const { container } = renderPanel();
      const panel = container.querySelector('[role="region"]') as HTMLElement;

      expect(panel.getAttribute('data-draggable')).toBe('true');
    });

    it('has data-draggable="false" when draggable=false', () => {
      const { container } = renderPanel({ draggable: false });
      const panel = container.querySelector('[role="region"]') as HTMLElement;

      expect(panel.getAttribute('data-draggable')).toBe('false');
    });

    it('applies transform when draggable is true', () => {
      const { container } = renderPanel({ draggable: true });
      const panel = container.querySelector('[role="region"]') as HTMLElement;

      expect(panel.style.transform).toContain('translate(0px, 0px)');
    });

    it('does not apply transform when draggable is false', () => {
      const { container } = renderPanel({ draggable: false });
      const panel = container.querySelector('[role="region"]') as HTMLElement;

      expect(panel.style.transform).toBe('');
    });
  });
});

// ===========================================================================
// Property Control Component Tests
// ===========================================================================

describe('ColorInput', () => {
  afterEach(() => cleanup());

  it('renders a color input with correct value', () => {
    const { container } = render(
      <ColorInput label="Test Color" value="#ff0000" onChange={vi.fn()} />,
    );
    const input = container.querySelector('input[type="color"]') as HTMLInputElement;

    expect(input).not.toBeNull();
    expect(input.value).toBe('#ff0000');
  });

  it('renders the label text', () => {
    const { container } = render(
      <ColorInput label="Fill Color" value="#000000" onChange={vi.fn()} />,
    );

    expect(container.textContent).toContain('Fill Color');
  });

  it('calls onChange with new color value', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ColorInput label="Test" value="#000000" onChange={onChange} />,
    );
    const input = container.querySelector('input[type="color"]') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '#00ff00' } });

    expect(onChange).toHaveBeenCalledWith('#00ff00');
  });

  it('has aria-label for accessibility', () => {
    const { container } = render(
      <ColorInput label="My Color" value="#000000" onChange={vi.fn()} />,
    );
    const input = container.querySelector('input[type="color"]') as HTMLInputElement;

    expect(input.getAttribute('aria-label')).toBe('My Color');
  });
});

describe('NumberInput', () => {
  afterEach(() => cleanup());

  it('renders a number input with correct value', () => {
    const { container } = render(
      <NumberInput label="Width" value={42} onChange={vi.fn()} />,
    );
    const input = container.querySelector('input[type="number"]') as HTMLInputElement;

    expect(input).not.toBeNull();
    expect(input.value).toBe('42');
  });

  it('renders the label text', () => {
    const { container } = render(
      <NumberInput label="Stroke Width" value={2} onChange={vi.fn()} />,
    );

    expect(container.textContent).toContain('Stroke Width');
  });

  it('calls onChange with parsed number', () => {
    const onChange = vi.fn();
    const { container } = render(
      <NumberInput label="Test" value={0} onChange={onChange} />,
    );
    const input = container.querySelector('input[type="number"]') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '10' } });

    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('respects min and max attributes', () => {
    const { container } = render(
      <NumberInput label="Test" value={5} onChange={vi.fn()} min={0} max={100} step={1} />,
    );
    const input = container.querySelector('input[type="number"]') as HTMLInputElement;

    expect(input.getAttribute('min')).toBe('0');
    expect(input.getAttribute('max')).toBe('100');
    expect(input.getAttribute('step')).toBe('1');
  });

  it('has aria-label for accessibility', () => {
    const { container } = render(
      <NumberInput label="My Number" value={0} onChange={vi.fn()} />,
    );
    const input = container.querySelector('input[type="number"]') as HTMLInputElement;

    expect(input.getAttribute('aria-label')).toBe('My Number');
  });
});

describe('SliderInput', () => {
  afterEach(() => cleanup());

  it('renders a range input with correct value', () => {
    const { container } = render(
      <SliderInput label="Opacity" value={75} min={0} max={100} onChange={vi.fn()} />,
    );
    const input = container.querySelector('input[type="range"]') as HTMLInputElement;

    expect(input).not.toBeNull();
    expect(input.value).toBe('75');
  });

  it('renders the label text', () => {
    const { container } = render(
      <SliderInput label="Opacity" value={50} min={0} max={100} onChange={vi.fn()} />,
    );

    expect(container.textContent).toContain('Opacity');
  });

  it('displays the current value', () => {
    const { container } = render(
      <SliderInput label="Opacity" value={42} min={0} max={100} onChange={vi.fn()} />,
    );

    expect(container.textContent).toContain('42');
  });

  it('calls onChange with new value', () => {
    const onChange = vi.fn();
    const { container } = render(
      <SliderInput label="Test" value={50} min={0} max={100} onChange={onChange} />,
    );
    const input = container.querySelector('input[type="range"]') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '80' } });

    expect(onChange).toHaveBeenCalledWith(80);
  });

  it('has aria-label for accessibility', () => {
    const { container } = render(
      <SliderInput label="My Slider" value={0} min={0} max={100} onChange={vi.fn()} />,
    );
    const input = container.querySelector('input[type="range"]') as HTMLInputElement;

    expect(input.getAttribute('aria-label')).toBe('My Slider');
  });
});

describe('SelectInput', () => {
  afterEach(() => cleanup());

  const options = [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
    { value: 'right', label: 'Right' },
  ];

  it('renders a select element with correct value', () => {
    const { container } = render(
      <SelectInput label="Align" value="center" options={options} onChange={vi.fn()} />,
    );
    const select = container.querySelector('select') as HTMLSelectElement;

    expect(select).not.toBeNull();
    expect(select.value).toBe('center');
  });

  it('renders all options', () => {
    const { container } = render(
      <SelectInput label="Align" value="left" options={options} onChange={vi.fn()} />,
    );
    const optionElements = container.querySelectorAll('option');

    expect(optionElements.length).toBe(3);
  });

  it('renders the label text', () => {
    const { container } = render(
      <SelectInput label="Alignment" value="left" options={options} onChange={vi.fn()} />,
    );

    expect(container.textContent).toContain('Alignment');
  });

  it('calls onChange with selected value', () => {
    const onChange = vi.fn();
    const { container } = render(
      <SelectInput label="Test" value="left" options={options} onChange={onChange} />,
    );
    const select = container.querySelector('select') as HTMLSelectElement;

    fireEvent.change(select, { target: { value: 'right' } });

    expect(onChange).toHaveBeenCalledWith('right');
  });

  it('has aria-label for accessibility', () => {
    const { container } = render(
      <SelectInput label="My Select" value="left" options={options} onChange={vi.fn()} />,
    );
    const select = container.querySelector('select') as HTMLSelectElement;

    expect(select.getAttribute('aria-label')).toBe('My Select');
  });
});

describe('TextInput', () => {
  afterEach(() => cleanup());

  it('renders a text input with correct value', () => {
    const { container } = render(
      <TextInput label="Name" value="hello" onChange={vi.fn()} />,
    );
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;

    expect(input).not.toBeNull();
    expect(input.value).toBe('hello');
  });

  it('renders a textarea when multiline=true', () => {
    const { container } = render(
      <TextInput label="Content" value="some text" onChange={vi.fn()} multiline />,
    );
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;

    expect(textarea).not.toBeNull();
    expect(textarea.value).toBe('some text');
  });

  it('renders the label text', () => {
    const { container } = render(
      <TextInput label="Description" value="" onChange={vi.fn()} />,
    );

    expect(container.textContent).toContain('Description');
  });

  it('calls onChange with new text for single-line', () => {
    const onChange = vi.fn();
    const { container } = render(
      <TextInput label="Test" value="" onChange={onChange} />,
    );
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'new value' } });

    expect(onChange).toHaveBeenCalledWith('new value');
  });

  it('calls onChange with new text for multiline', () => {
    const onChange = vi.fn();
    const { container } = render(
      <TextInput label="Test" value="" onChange={onChange} multiline />,
    );
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'line1\nline2' } });

    expect(onChange).toHaveBeenCalledWith('line1\nline2');
  });

  it('has aria-label for accessibility', () => {
    const { container } = render(
      <TextInput label="My Text" value="" onChange={vi.fn()} />,
    );
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;

    expect(input.getAttribute('aria-label')).toBe('My Text');
  });
});
