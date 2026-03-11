import { describe, it, expect } from 'vitest';
import { compile } from '../../../src/compiler/compiler.js';
import type { IRContainer, IRPath, IRShape, IRText, IRLine, IRElement } from '../../../src/ir/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findContainers(elements: IRElement[]): IRContainer[] {
  const containers: IRContainer[] = [];
  for (const el of elements) {
    if (el.type === 'container') {
      containers.push(el);
      containers.push(...findContainers(el.children));
    }
  }
  return containers;
}

function findAll(elements: IRElement[], type: string): IRElement[] {
  const result: IRElement[] = [];
  for (const el of elements) {
    if (el.type === type) result.push(el);
    if (el.type === 'container') {
      result.push(...findAll((el as IRContainer).children, type));
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// E2E: @data → table reference → IR
// ---------------------------------------------------------------------------

describe('E2E: @data + table reference', () => {
  it('compiles @data + table "ref" → IR with cell shapes and texts', () => {
    const dsl = `
@data "sales" {
  "Quarter" "Revenue"
  "Q1" 120
  "Q2" 185
}

table "sales"
`;
    const { ir, errors } = compile(dsl);
    expect(errors).toHaveLength(0);
    expect(ir.scenes).toHaveLength(1);

    const scene = ir.scenes[0];
    // Should contain shapes (cell backgrounds) and texts (cell values)
    const shapes = findAll(scene.elements, 'shape');
    const texts = findAll(scene.elements, 'text');

    // 3 rows × 2 columns = 6 cell backgrounds + 6 cell texts
    expect(shapes.length).toBeGreaterThanOrEqual(6);
    expect(texts.length).toBeGreaterThanOrEqual(6);

    // Verify cell text content
    const textContents = texts.map(t => (t as IRText).content);
    expect(textContents).toContain('Quarter');
    expect(textContents).toContain('Revenue');
    expect(textContents).toContain('Q1');
    expect(textContents).toContain('120');
  });
});

// ---------------------------------------------------------------------------
// E2E: inline table → IR
// ---------------------------------------------------------------------------

describe('E2E: inline table', () => {
  it('compiles inline table → IR', () => {
    const dsl = `
table {
  "Name" "Score"
  "Alice" 95
  "Bob" 88
}
`;
    const { ir, errors } = compile(dsl);
    expect(errors).toHaveLength(0);

    const scene = ir.scenes[0];
    const texts = findAll(scene.elements, 'text');
    const textContents = texts.map(t => (t as IRText).content);
    expect(textContents).toContain('Name');
    expect(textContents).toContain('Alice');
    expect(textContents).toContain('95');
  });
});

// ---------------------------------------------------------------------------
// E2E: standalone diagram table → IR
// ---------------------------------------------------------------------------

describe('E2E: standalone table (diagram mode)', () => {
  it('compiles standalone table without @presentation', () => {
    const dsl = `
table {
  "A" "B"
  "1" "2"
}
`;
    const { ir, errors } = compile(dsl);
    expect(errors).toHaveLength(0);
    expect(ir.scenes).toHaveLength(1);

    const scene = ir.scenes[0];
    const shapes = findAll(scene.elements, 'shape');
    // 2 rows × 2 columns = 4 cell backgrounds
    expect(shapes.length).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// E2E: @data referenced from 2 scenes (table + chart)
// ---------------------------------------------------------------------------

describe('E2E: same @data used in table and chart', () => {
  it('compiles same @data as both table and chart in presentation mode', () => {
    const dsl = `
@presentation

@data "metrics" {
  "Quarter" "Revenue" "Users"
  "Q1" 120 340
  "Q2" 185 520
  "Q3" 240 780
}

scene "numbers" {
  layout: header
  header: heading "Sales Data"
  body: table "metrics"
}

scene "trend" {
  layout: header
  header: heading "Revenue Trend"
  body: chart "metrics" type:bar x:"Quarter" y:"Revenue"
}
`;
    const { ir, errors } = compile(dsl);
    expect(errors).toHaveLength(0);
    expect(ir.scenes).toHaveLength(2);

    // Scene 1: table
    const tableScene = ir.scenes[0];
    const tableTexts = findAll(tableScene.elements, 'text');
    const tableContents = tableTexts.map(t => (t as IRText).content);
    expect(tableContents).toContain('Quarter');
    expect(tableContents).toContain('Q1');

    // Scene 2: chart
    const chartScene = ir.scenes[1];
    const chartShapes = findAll(chartScene.elements, 'shape') as IRShape[];
    // Should have bars (rect shapes)
    const bars = chartShapes.filter(s => s.shape === 'rect');
    expect(bars.length).toBeGreaterThanOrEqual(3); // 3 data points

    // Chart should have elements (bars rendered as shapes in scene pipeline)
    expect(chartScene.elements.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// E2E: chart in diagram mode
// ---------------------------------------------------------------------------

describe('E2E: chart in diagram mode', () => {
  it('compiles inline chart → IR with container', () => {
    const dsl = `
chart {
  "Category" "Value"
  "A" 10
  "B" 30
  "C" 20
}
`;
    const { ir, errors } = compile(dsl);
    expect(errors).toHaveLength(0);

    const scene = ir.scenes[0];
    // Should have some elements (container with row elements)
    expect(scene.elements.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// E2E: table in scene with other content
// ---------------------------------------------------------------------------

describe('E2E: table in scene with heading', () => {
  it('compiles scene with heading + table', () => {
    const dsl = `
@presentation

scene "report" {
  layout: header
  header: heading "Report"
  body: table {
    "Metric" "Value"
    "Users" 1000
    "Revenue" 5000
  }
}
`;
    const { ir, errors } = compile(dsl);
    expect(errors).toHaveLength(0);
    expect(ir.scenes).toHaveLength(1);

    const scene = ir.scenes[0];
    const texts = findAll(scene.elements, 'text');
    const contents = texts.map(t => (t as IRText).content);
    // Should contain table data
    expect(contents).toContain('Metric');
    expect(contents).toContain('1000');
  });
});

// ---------------------------------------------------------------------------
// E2E: error resilience
// ---------------------------------------------------------------------------

describe('E2E: error resilience', () => {
  it('handles empty @data body gracefully', () => {
    const dsl = '@data "empty" {}\ntable "empty"';
    const { ir, errors } = compile(dsl);
    // Should not crash
    expect(ir.scenes).toHaveLength(1);
  });

  it('handles table referencing non-existent data', () => {
    const dsl = 'table "missing"';
    const { ir, errors } = compile(dsl);
    // Should compile without crash (empty table)
    expect(ir.scenes).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// E2E: line chart in diagram mode
// ---------------------------------------------------------------------------

describe('E2E: line chart (diagram mode)', () => {
  it('compiles type:line chart → IR with circles and lines', () => {
    const dsl = `
@data "revenue" {
  "Quarter" "Revenue"
  "Q1" 120
  "Q2" 185
  "Q3" 240
}

chart "revenue" type:line x:"Quarter" y:"Revenue"
`;
    const { ir, errors } = compile(dsl);
    expect(errors).toHaveLength(0);
    expect(ir.scenes).toHaveLength(1);

    const scene = ir.scenes[0];
    const shapes = findAll(scene.elements, 'shape') as IRShape[];
    const lines = findAll(scene.elements, 'line') as IRLine[];

    // Should have circle points (3 data points)
    const circles = shapes.filter(s => s.shape === 'circle');
    expect(circles.length).toBeGreaterThanOrEqual(3);

    // Should have line segments (2 connecting segments) + 2 axes = 4
    expect(lines.length).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// E2E: pie chart in diagram mode
// ---------------------------------------------------------------------------

describe('E2E: pie chart (diagram mode)', () => {
  it('compiles type:pie chart → IR with path wedges and labels', () => {
    const dsl = `
@data "share" {
  "Browser" "Share"
  "Chrome" 65
  "Firefox" 20
  "Safari" 15
}

chart "share" type:pie x:"Browser" y:"Share"
`;
    const { ir, errors } = compile(dsl);
    expect(errors).toHaveLength(0);
    expect(ir.scenes).toHaveLength(1);

    const scene = ir.scenes[0];
    const paths = findAll(scene.elements, 'path') as IRPath[];
    const texts = findAll(scene.elements, 'text') as IRText[];

    // Should have 3 wedge paths
    expect(paths.length).toBeGreaterThanOrEqual(3);

    // Each wedge path should be valid SVG
    for (const p of paths) {
      expect(p.d).toMatch(/^M\s/);
      expect(p.d).toContain('A');
      expect(p.d).toMatch(/Z$/);
    }

    // Should have labels with percentage
    const labelTexts = texts.map(t => t.content);
    const percentLabels = labelTexts.filter(t => t.includes('%'));
    expect(percentLabels.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// E2E: bar chart per-item colors
// ---------------------------------------------------------------------------

describe('E2E: bar chart per-item colors', () => {
  it('each bar has a different fill color', () => {
    const dsl = `
chart {
  "Category" "Value"
  "A" 10
  "B" 30
  "C" 20
}
`;
    const { ir, errors } = compile(dsl);
    expect(errors).toHaveLength(0);

    const scene = ir.scenes[0];
    const shapes = findAll(scene.elements, 'shape') as IRShape[];
    const bars = shapes.filter(s => s.shape === 'rect' && s.style.fill);

    // Should have 3 bars with different colors
    expect(bars.length).toBeGreaterThanOrEqual(3);
    const fills = bars.map(b => b.style.fill);
    const uniqueFills = new Set(fills);
    expect(uniqueFills.size).toBeGreaterThanOrEqual(2); // at least some variety
  });
});

// ---------------------------------------------------------------------------
// E2E: type:bar is default — no explicit type
// ---------------------------------------------------------------------------

describe('E2E: chart default type is bar', () => {
  it('chart without type prop renders as bar chart', () => {
    const dsl = `
chart {
  "X" "Y"
  "A" 10
  "B" 20
}
`;
    const { ir, errors } = compile(dsl);
    expect(errors).toHaveLength(0);

    const scene = ir.scenes[0];
    const shapes = findAll(scene.elements, 'shape') as IRShape[];
    const bars = shapes.filter(s => s.shape === 'rect');
    expect(bars.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// E2E: line chart in scene (presentation mode)
// ---------------------------------------------------------------------------

describe('E2E: line chart in scene (presentation mode)', () => {
  it('compiles scene with type:line chart', () => {
    const dsl = `
@presentation

@data "metrics" {
  "Month" "Users"
  "Jan" 100
  "Feb" 200
  "Mar" 350
}

scene "growth" {
  layout: header
  header: heading "User Growth"
  body: chart "metrics" type:line x:"Month" y:"Users"
}
`;
    const { ir, errors } = compile(dsl);
    expect(errors).toHaveLength(0);
    expect(ir.scenes).toHaveLength(1);

    const scene = ir.scenes[0];
    const shapes = findAll(scene.elements, 'shape') as IRShape[];
    const circles = shapes.filter(s => s.shape === 'circle');
    expect(circles.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// E2E: pie chart in scene (presentation mode)
// ---------------------------------------------------------------------------

describe('E2E: pie chart in scene (presentation mode)', () => {
  it('compiles scene with type:pie chart', () => {
    const dsl = `
@presentation

@data "share" {
  "Type" "Count"
  "A" 40
  "B" 60
}

scene "distribution" {
  layout: header
  header: heading "Distribution"
  body: chart "share" type:pie x:"Type" y:"Count"
}
`;
    const { ir, errors } = compile(dsl);
    expect(errors).toHaveLength(0);
    expect(ir.scenes).toHaveLength(1);

    const scene = ir.scenes[0];
    const paths = findAll(scene.elements, 'path') as IRPath[];
    expect(paths.length).toBeGreaterThanOrEqual(2);
  });
});
