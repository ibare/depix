import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PropertySection } from '../src/components/property-controls/PropertySection.js';
import { FieldGrid } from '../src/components/property-controls/FieldGrid.js';

afterEach(cleanup);

// ---------------------------------------------------------------------------
// PropertySection
// ---------------------------------------------------------------------------

describe('PropertySection', () => {
  it('renders title and children when expanded (default)', () => {
    render(
      <PropertySection title="Position">
        <span>child content</span>
      </PropertySection>,
    );
    expect(screen.getByText('Position')).toBeTruthy();
    expect(screen.getByText('child content')).toBeTruthy();
  });

  it('hides children when defaultCollapsed is true', () => {
    render(
      <PropertySection title="Style" defaultCollapsed>
        <span>hidden content</span>
      </PropertySection>,
    );
    expect(screen.getByText('Style')).toBeTruthy();
    expect(screen.queryByText('hidden content')).toBeNull();
  });

  it('toggles collapsed state on header click', () => {
    render(
      <PropertySection title="Layout">
        <span>toggle me</span>
      </PropertySection>,
    );
    expect(screen.getByText('toggle me')).toBeTruthy();

    // collapse
    fireEvent.click(screen.getByRole('button', { name: /Layout section/ }));
    expect(screen.queryByText('toggle me')).toBeNull();

    // expand
    fireEvent.click(screen.getByRole('button', { name: /Layout section/ }));
    expect(screen.getByText('toggle me')).toBeTruthy();
  });

  it('toggles on Enter key', () => {
    render(
      <PropertySection title="Keys">
        <span>keyboard content</span>
      </PropertySection>,
    );
    const header = screen.getByRole('button', { name: /Keys section/ });
    fireEvent.keyDown(header, { key: 'Enter' });
    expect(screen.queryByText('keyboard content')).toBeNull();
  });

  it('toggles on Space key', () => {
    render(
      <PropertySection title="Space">
        <span>space content</span>
      </PropertySection>,
    );
    const header = screen.getByRole('button', { name: /Space section/ });
    fireEvent.keyDown(header, { key: ' ' });
    expect(screen.queryByText('space content')).toBeNull();
  });

  it('sets aria-expanded correctly', () => {
    render(
      <PropertySection title="Aria">
        <span>aria child</span>
      </PropertySection>,
    );
    const header = screen.getByRole('button', { name: /Aria section/ });
    expect(header.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(header);
    expect(header.getAttribute('aria-expanded')).toBe('false');
  });

  it('applies data-section attribute when sectionId is provided', () => {
    const { container } = render(
      <PropertySection title="Test" sectionId="bounds">
        <span>content</span>
      </PropertySection>,
    );
    expect(container.querySelector('[data-section="bounds"]')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// FieldGrid
// ---------------------------------------------------------------------------

describe('FieldGrid', () => {
  it('renders children in a grid with default 1 column', () => {
    const { container } = render(
      <FieldGrid>
        <span>A</span>
        <span>B</span>
      </FieldGrid>,
    );
    const grid = container.querySelector('[data-grid-columns]') as HTMLElement;
    expect(grid).toBeTruthy();
    expect(grid.getAttribute('data-grid-columns')).toBe('1');
    expect(grid.style.gridTemplateColumns).toBe('repeat(1, 1fr)');
  });

  it('renders with 2 columns', () => {
    const { container } = render(
      <FieldGrid columns={2}>
        <span>A</span>
        <span>B</span>
      </FieldGrid>,
    );
    const grid = container.querySelector('[data-grid-columns="2"]') as HTMLElement;
    expect(grid).toBeTruthy();
    expect(grid.style.gridTemplateColumns).toBe('repeat(2, 1fr)');
  });

  it('renders with 4 columns', () => {
    const { container } = render(
      <FieldGrid columns={4}>
        <span>A</span>
        <span>B</span>
        <span>C</span>
        <span>D</span>
      </FieldGrid>,
    );
    const grid = container.querySelector('[data-grid-columns="4"]') as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('repeat(4, 1fr)');
  });
});
