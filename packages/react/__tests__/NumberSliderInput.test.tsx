import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { NumberInput } from '../src/components/property-controls/NumberInput.js';
import { SliderInput } from '../src/components/property-controls/SliderInput.js';

afterEach(cleanup);

// ---------------------------------------------------------------------------
// NumberInput — inlineLabel
// ---------------------------------------------------------------------------

describe('NumberInput inlineLabel', () => {
  it('renders label inside the field when inlineLabel is true', () => {
    const { container } = render(
      <NumberInput label="X" value={10} onChange={() => {}} inlineLabel />,
    );
    // No outer <label> wrapper — uses div
    const control = container.querySelector('[data-control="number"]');
    expect(control?.tagName).toBe('DIV');
    expect(screen.getByText('X')).toBeTruthy();
  });

  it('renders classic layout when inlineLabel is false', () => {
    const { container } = render(
      <NumberInput label="Width" value={100} onChange={() => {}} />,
    );
    const control = container.querySelector('[data-control="number"]');
    expect(control?.tagName).toBe('LABEL');
  });
});

// ---------------------------------------------------------------------------
// NumberInput — reset button
// ---------------------------------------------------------------------------

describe('NumberInput reset', () => {
  it('shows reset button when value differs from defaultValue', () => {
    render(
      <NumberInput label="Size" value={20} defaultValue={10} onChange={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /Reset Size/ })).toBeTruthy();
  });

  it('hides reset button when value equals defaultValue', () => {
    render(
      <NumberInput label="Size" value={10} defaultValue={10} onChange={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: /Reset Size/ })).toBeNull();
  });

  it('calls onChange with defaultValue on reset click', () => {
    const onChange = vi.fn();
    render(
      <NumberInput label="Size" value={20} defaultValue={10} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Reset Size/ }));
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('shows reset button in inlineLabel mode', () => {
    render(
      <NumberInput label="Y" value={50} defaultValue={0} onChange={() => {}} inlineLabel />,
    );
    expect(screen.getByRole('button', { name: /Reset Y/ })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// SliderInput — ticks
// ---------------------------------------------------------------------------

describe('SliderInput ticks', () => {
  it('renders tick labels below the slider', () => {
    render(
      <SliderInput
        label="Size"
        value={3}
        min={1}
        max={6}
        ticks={['XS', 'S', 'M', 'L', 'XL', 'XXL']}
        onChange={() => {}}
      />,
    );
    const ticks = screen.getByTestId('slider-ticks');
    expect(ticks).toBeTruthy();
    expect(screen.getByText('XS')).toBeTruthy();
    expect(screen.getByText('XXL')).toBeTruthy();
  });

  it('does not render ticks when not provided', () => {
    render(
      <SliderInput label="Opacity" value={50} min={0} max={100} onChange={() => {}} />,
    );
    expect(screen.queryByTestId('slider-ticks')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SliderInput — tooltip
// ---------------------------------------------------------------------------

describe('SliderInput tooltip', () => {
  it('shows tooltip while dragging when showTooltip is true', () => {
    render(
      <SliderInput
        label="Zoom"
        value={75}
        min={0}
        max={100}
        showTooltip
        onChange={() => {}}
      />,
    );
    const slider = screen.getByRole('slider');

    // tooltip hidden before drag
    expect(screen.queryByTestId('slider-tooltip')).toBeNull();

    // start drag
    fireEvent.mouseDown(slider);
    expect(screen.getByTestId('slider-tooltip')).toBeTruthy();
    expect(screen.getByTestId('slider-tooltip').textContent).toBe('75');

    // end drag
    fireEvent.mouseUp(slider);
    expect(screen.queryByTestId('slider-tooltip')).toBeNull();
  });

  it('does not show tooltip when showTooltip is false', () => {
    render(
      <SliderInput label="Vol" value={50} min={0} max={100} onChange={() => {}} />,
    );
    const slider = screen.getByRole('slider');
    fireEvent.mouseDown(slider);
    expect(screen.queryByTestId('slider-tooltip')).toBeNull();
  });
});
