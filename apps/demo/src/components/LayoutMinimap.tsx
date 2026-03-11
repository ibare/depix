import React from 'react';

type LayoutNode =
  | { type: 'slot'; name: string }
  | { type: 'row'; children: LayoutNode[] }
  | { type: 'col'; children: LayoutNode[] }
  | { type: 'pad'; child: LayoutNode };

const S = (name: string): LayoutNode => ({ type: 'slot', name });
const Row = (...children: LayoutNode[]): LayoutNode => ({ type: 'row', children });
const Col = (...children: LayoutNode[]): LayoutNode => ({ type: 'col', children });
const Pad = (child: LayoutNode): LayoutNode => ({ type: 'pad', child });

const LAYOUTS: Record<string, LayoutNode> = {
  'full':            S('body'),
  'center':          Pad(S('body')),
  'split':           Row(S('left'), S('right')),
  'rows':            Col(S('top'), S('bottom')),
  'sidebar':         Row(S('main'), S('side')),
  'header':          Col(S('header'), S('body')),
  'header-split':    Col(S('header'), Row(S('left'), S('right'))),
  'header-rows':     Col(S('header'), S('top'), S('bottom')),
  'header-sidebar':  Col(S('header'), Row(S('main'), S('side'))),
  'grid':            Col(Row(S('cell'), S('cell')), Row(S('cell'), S('cell'))),
  'header-grid':     Col(S('header'), Row(S('cell'), S('cell'), S('cell'))),
  'focus':           Col(S('focus'), Row(S('cell'), S('cell'), S('cell'))),
  'header-focus':    Col(S('header'), S('focus'), Row(S('cell'), S('cell'), S('cell'))),
  'custom':          Col(S('cell'), S('cell'), S('cell')),
};

function renderNode(node: LayoutNode, key: number = 0): React.ReactElement {
  switch (node.type) {
    case 'slot':
      return <div key={key} className={`lm-slot lm-slot--${node.name}`}>{node.name}</div>;
    case 'row':
      return <div key={key} className="lm-row">{node.children.map((c, i) => renderNode(c, i))}</div>;
    case 'col':
      return <div key={key} className="lm-col">{node.children.map((c, i) => renderNode(c, i))}</div>;
    case 'pad':
      return <div key={key} className="lm-pad">{renderNode(node.child)}</div>;
  }
}

export function LayoutMinimap({ layout }: { layout: string }) {
  const node = LAYOUTS[layout];
  if (!node) return null;

  return (
    <div className="layout-minimap" title={layout}>
      {renderNode(node)}
    </div>
  );
}
