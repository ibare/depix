import { describe, it, expect } from 'vitest';
import { parse } from '@depix/core';
import type { ASTBlock, ASTElement } from '@depix/core';
import {
  addScene,
  changeSceneTitle,
  removeScene,
  reorderScenes,
  changeLayout,
  addSlotContent,
  changeElementLabel,
  removeElementDSL,
  changeElementStyle,
  upsertOverride,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseScenes(dsl: string) {
  return parse(dsl).ast.scenes;
}

function parseDirectives(dsl: string) {
  return parse(dsl).ast.directives;
}

// ===========================================================================
// Scene mutations
// ===========================================================================

describe('addScene', () => {
  it('adds a scene to empty document', () => {
    const result = addScene('', 'New Scene');
    const scenes = parseScenes(result);
    expect(scenes.length).toBeGreaterThanOrEqual(1);
    const last = scenes[scenes.length - 1];
    expect(last.label).toBe('New Scene');
  });

  it('adds a scene after existing scenes', () => {
    const dsl = 'scene "First" {\n  node "A"\n}';
    const result = addScene(dsl, 'Second');
    const scenes = parseScenes(result);
    expect(scenes).toHaveLength(2);
    expect(scenes[1].label).toBe('Second');
  });
});

describe('changeSceneTitle', () => {
  it('changes scene title', () => {
    const dsl = 'scene "Original" {\n  node "A"\n}';
    const result = changeSceneTitle(dsl, 0, 'Updated');
    const scenes = parseScenes(result);
    expect(scenes[0].label).toBe('Updated');
  });

  it('returns original DSL for invalid index', () => {
    const dsl = 'scene "A" {\n  node "1"\n}';
    expect(changeSceneTitle(dsl, 5, 'New')).toBe(dsl);
  });
});

describe('removeScene', () => {
  it('removes a scene by index', () => {
    const dsl = 'scene "A" {\n  node "1"\n}\n\nscene "B" {\n  node "2"\n}';
    const result = removeScene(dsl, 0);
    const scenes = parseScenes(result);
    expect(scenes).toHaveLength(1);
    expect(scenes[0].label).toBe('B');
  });

  it('returns original DSL for invalid index', () => {
    const dsl = 'scene "A" {\n  node "1"\n}';
    expect(removeScene(dsl, 5)).toBe(dsl);
    expect(removeScene(dsl, -1)).toBe(dsl);
  });
});

describe('reorderScenes', () => {
  it('moves scene from index 0 to index 1', () => {
    const dsl = 'scene "A" {\n  node "1"\n}\n\nscene "B" {\n  node "2"\n}';
    const result = reorderScenes(dsl, 0, 1);
    const scenes = parseScenes(result);
    expect(scenes[0].label).toBe('B');
    expect(scenes[1].label).toBe('A');
  });

  it('returns original DSL for same indices', () => {
    const dsl = 'scene "A" {\n  node "1"\n}';
    expect(reorderScenes(dsl, 0, 0)).toBe(dsl);
  });
});

// ===========================================================================
// Layout mutations
// ===========================================================================

describe('changeLayout', () => {
  it('sets layout property on a scene', () => {
    const dsl = 'scene "Slide" {\n  node "A"\n}';
    const result = changeLayout(dsl, 0, 'header');
    const scenes = parseScenes(result);
    expect(scenes[0].props.layout).toBe('header');
  });

  it('changes existing layout property', () => {
    const dsl = 'scene "Slide" {\n  layout: full\n  node "A"\n}';
    const result = changeLayout(dsl, 0, 'split');
    const scenes = parseScenes(result);
    expect(scenes[0].props.layout).toBe('split');
  });

  it('returns original DSL for invalid scene index', () => {
    const dsl = 'scene "A" {\n  node "1"\n}';
    expect(changeLayout(dsl, 5, 'grid')).toBe(dsl);
  });
});

// ===========================================================================
// Slot mutations
// ===========================================================================

describe('addSlotContent', () => {
  it('adds element to a slot', () => {
    const dsl = 'scene "Slide" {\n  layout: header\n}';
    const result = addSlotContent(dsl, 0, 'header', 'heading "Title"');
    const scenes = parseScenes(result);
    const children = scenes[0].children;
    const slotChild = children.find(
      c => c.kind === 'element' && (c as ASTElement).slot === 'header',
    );
    expect(slotChild).toBeDefined();
  });
});

// ===========================================================================
// Element mutations
// ===========================================================================

describe('changeElementLabel', () => {
  it('changes element label', () => {
    const dsl = 'flow {\n  node "Old"\n}';
    const result = changeElementLabel(dsl, 0, 0, 'New');
    const { ast } = parse(result);
    const flow = ast.scenes[0].children[0] as ASTBlock;
    const el = flow.children[0] as ASTElement;
    expect(el.label).toBe('New');
  });

  it('returns original DSL for invalid index', () => {
    const dsl = 'flow {\n  node "A"\n}';
    expect(changeElementLabel(dsl, 0, 99, 'X')).toBe(dsl);
  });
});

describe('removeElementDSL', () => {
  it('removes an element', () => {
    const dsl = 'flow {\n  node "A"\n  node "B"\n}';
    const result = removeElementDSL(dsl, 0, 0);
    const { ast } = parse(result);
    const flow = ast.scenes[0].children[0] as ASTBlock;
    const elements = flow.children.filter(c => c.kind === 'element');
    expect(elements).toHaveLength(1);
    expect((elements[0] as ASTElement).label).toBe('B');
  });
});

describe('changeElementStyle', () => {
  it('sets style property on element', () => {
    const dsl = 'flow {\n  node "A"\n}';
    const result = changeElementStyle(dsl, 0, 0, 'background', '#ff0000');
    const { ast } = parse(result);
    const flow = ast.scenes[0].children[0] as ASTBlock;
    const el = flow.children[0] as ASTElement;
    expect(el.style.background).toBe('#ff0000');
  });
});

// ===========================================================================
// Override mutations
// ===========================================================================

describe('upsertOverride', () => {
  it('creates @overrides directive and entry', () => {
    const dsl = 'flow {\n  node "A" #a\n}';
    const result = upsertOverride(dsl, 'a', { x: 50, y: 60 });
    const directives = parseDirectives(result);
    const overrides = directives.find(d => d.key === 'overrides');
    expect(overrides).toBeDefined();
    expect(overrides!.body).toHaveLength(1);
    const entry = overrides!.body![0] as ASTElement;
    expect(entry.id).toBe('a');
    expect(entry.props.x).toBe(50);
    expect(entry.props.y).toBe(60);
  });

  it('updates existing override entry', () => {
    const dsl = '@overrides {\n  #a { x: 10, y: 20 }\n}\nflow {\n  node "A" #a\n}';
    const result = upsertOverride(dsl, 'a', { x: 99 });
    const directives = parseDirectives(result);
    const overrides = directives.find(d => d.key === 'overrides');
    const entry = overrides!.body![0] as ASTElement;
    expect(entry.props.x).toBe(99);
    expect(entry.props.y).toBe(20); // preserved
  });

  it('adds new entry to existing @overrides', () => {
    const dsl = '@overrides {\n  #a { x: 10 }\n}\nflow {\n  node "A" #a\n  node "B" #b\n}';
    const result = upsertOverride(dsl, 'b', { y: 70 });
    const directives = parseDirectives(result);
    const overrides = directives.find(d => d.key === 'overrides');
    expect(overrides!.body).toHaveLength(2);
  });
});
