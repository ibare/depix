/**
 * Slide DSL — Tokenizer & Parser Tests
 *
 * Verifies that slide keywords are tokenized correctly and
 * the parser produces valid AST structures for slide DSL.
 */

import { describe, it, expect } from 'vitest';
import { tokenize } from '../../../src/compiler/tokenizer.js';
import { parse } from '../../../src/compiler/parser.js';

// ---------------------------------------------------------------------------
// Tokenizer tests
// ---------------------------------------------------------------------------

describe('Slide tokenizer', () => {
  function pairs(input: string): [string, string][] {
    return tokenize(input)
      .tokens.filter(t => t.type !== 'NEWLINE' && t.type !== 'EOF')
      .map(t => [t.type, t.value]);
  }

  it('tokenizes @presentation directive', () => {
    expect(pairs('@presentation')).toEqual([['DIRECTIVE', 'presentation']]);
  });

  it('tokenizes @ratio directive with value', () => {
    expect(pairs('@ratio 16:9')).toEqual([
      ['DIRECTIVE', 'ratio'],
      ['NUMBER', '16'],
      ['COLON', ':'],
      ['NUMBER', '9'],
    ]);
  });

  it('tokenizes @theme directive', () => {
    expect(pairs('@theme default')).toEqual([
      ['DIRECTIVE', 'theme'],
      ['IDENTIFIER', 'default'],
    ]);
  });

  it('tokenizes slide as BLOCK_TYPE', () => {
    expect(pairs('slide')).toEqual([['BLOCK_TYPE', 'slide']]);
  });

  it('tokenizes column as BLOCK_TYPE', () => {
    expect(pairs('column')).toEqual([['BLOCK_TYPE', 'column']]);
  });

  it('tokenizes heading as ELEMENT_TYPE', () => {
    expect(pairs('heading')).toEqual([['ELEMENT_TYPE', 'heading']]);
  });

  it('tokenizes bullet as ELEMENT_TYPE', () => {
    expect(pairs('bullet')).toEqual([['ELEMENT_TYPE', 'bullet']]);
  });

  it('tokenizes stat as ELEMENT_TYPE', () => {
    expect(pairs('stat')).toEqual([['ELEMENT_TYPE', 'stat']]);
  });

  it('tokenizes quote as ELEMENT_TYPE', () => {
    expect(pairs('quote')).toEqual([['ELEMENT_TYPE', 'quote']]);
  });

  it('tokenizes item as ELEMENT_TYPE', () => {
    expect(pairs('item')).toEqual([['ELEMENT_TYPE', 'item']]);
  });

  it('produces no errors for valid slide DSL', () => {
    const input = `@presentation
@ratio 16:9

slide "intro" {
  layout: title
  heading "Hello World"
  label "Subtitle"
}`;
    const result = tokenize(input);
    expect(result.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Parser tests
// ---------------------------------------------------------------------------

describe('Slide parser', () => {
  it('parses @presentation directive', () => {
    const { ast, errors } = parse('@presentation');
    expect(errors).toEqual([]);
    expect(ast.directives).toHaveLength(1);
    expect(ast.directives[0].key).toBe('presentation');
  });

  it('parses @ratio directive', () => {
    const { ast } = parse('@ratio 16:9');
    expect(ast.directives).toHaveLength(1);
    expect(ast.directives[0].key).toBe('ratio');
    expect(ast.directives[0].value).toBe('16:9');
  });

  it('parses a slide block with layout prop', () => {
    const input = `slide "intro" {
  layout: title
  heading "Hello"
}`;
    const { ast, errors } = parse(input);
    expect(errors).toEqual([]);
    expect(ast.scenes).toHaveLength(1);
    const slide = ast.scenes[0].children[0];
    expect(slide.kind).toBe('block');
    if (slide.kind === 'block') {
      expect(slide.blockType).toBe('slide');
      expect(slide.label).toBe('intro');
      expect(slide.props.layout).toBe('title');
      expect(slide.children).toHaveLength(1);
      expect(slide.children[0].kind).toBe('element');
    }
  });

  it('parses heading with level prop', () => {
    const { ast } = parse('slide { heading "Title" { level: 2 } }');
    const slide = ast.scenes[0].children[0];
    if (slide.kind === 'block') {
      const heading = slide.children[0];
      if (heading.kind === 'element') {
        expect(heading.elementType).toBe('heading');
        expect(heading.label).toBe('Title');
        expect(heading.props.level).toBe(2);
      }
    }
  });

  it('parses bullet with nested items', () => {
    const input = `slide {
  bullet {
    item "First"
    item "Second"
  }
}`;
    const { ast, errors } = parse(input);
    expect(errors).toEqual([]);
    const slide = ast.scenes[0].children[0];
    if (slide.kind === 'block') {
      const bullet = slide.children[0];
      if (bullet.kind === 'element') {
        expect(bullet.elementType).toBe('bullet');
        expect(bullet.children).toHaveLength(2);
        expect(bullet.children[0].kind).toBe('element');
        if (bullet.children[0].kind === 'element') {
          expect(bullet.children[0].elementType).toBe('item');
          expect(bullet.children[0].label).toBe('First');
        }
      }
    }
  });

  it('parses stat with label prop', () => {
    const { ast } = parse('slide { stat "340%" { label: "Growth" } }');
    const slide = ast.scenes[0].children[0];
    if (slide.kind === 'block') {
      const stat = slide.children[0];
      if (stat.kind === 'element') {
        expect(stat.elementType).toBe('stat');
        expect(stat.label).toBe('340%');
        expect(stat.props.label).toBe('Growth');
      }
    }
  });

  it('parses quote with attribution', () => {
    const { ast } = parse('slide { quote "Speed matters." { attribution: "John" } }');
    const slide = ast.scenes[0].children[0];
    if (slide.kind === 'block') {
      const quote = slide.children[0];
      if (quote.kind === 'element') {
        expect(quote.elementType).toBe('quote');
        expect(quote.label).toBe('Speed matters.');
        expect(quote.props.attribution).toBe('John');
      }
    }
  });

  it('parses column blocks inside a slide', () => {
    const input = `slide {
  layout: two-column
  heading "Title"
  column { heading "Col 1" }
  column { heading "Col 2" }
}`;
    const { ast, errors } = parse(input);
    expect(errors).toEqual([]);
    const slide = ast.scenes[0].children[0];
    if (slide.kind === 'block') {
      expect(slide.props.layout).toBe('two-column');
      const blocks = slide.children.filter(c => c.kind === 'block');
      expect(blocks).toHaveLength(2);
      expect(blocks[0].kind === 'block' && blocks[0].blockType).toBe('column');
    }
  });

  it('parses multiple slides in sequence', () => {
    const input = `@presentation

slide "s1" { heading "Slide 1" }
slide "s2" { heading "Slide 2" }
slide "s3" { heading "Slide 3" }`;
    const { ast, errors } = parse(input);
    expect(errors).toEqual([]);
    expect(ast.directives[0].key).toBe('presentation');
    const slides = ast.scenes[0].children.filter(c => c.kind === 'block');
    expect(slides).toHaveLength(3);
  });
});
