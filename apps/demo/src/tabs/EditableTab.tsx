import { useState, useRef, useCallback } from 'react';
import { compile } from '@depix/core';
import type { DepixIR } from '@depix/core';
import { DepixCanvasEditable } from '@depix/react';
import type { DepixCanvasEditableRef, ToolType } from '@depix/react';
import { EXAMPLES } from '../examples';

const TOOLS: { id: ToolType; label: string }[] = [
  { id: 'select', label: 'Select' },
  { id: 'rect', label: 'Rect' },
  { id: 'circle', label: 'Circle' },
  { id: 'text', label: 'Text' },
  { id: 'line', label: 'Line' },
];

const DEFAULT_DSL = EXAMPLES[0].dsl;

export function EditableTab() {
  const [dsl, setDsl] = useState(DEFAULT_DSL);
  const [ir, setIr] = useState<DepixIR>(() => compile(DEFAULT_DSL).ir);
  const [tool, setTool] = useState<ToolType>('select');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const editableRef = useRef<DepixCanvasEditableRef>(null);

  const applyDsl = useCallback(() => {
    try {
      const result = compile(dsl);
      if (result.errors.length === 0) {
        setIr(result.ir);
      }
    } catch {
      // ignore compile errors on manual apply
    }
  }, [dsl]);

  return (
    <div className="editor-layout">
      {/* Left panel: DSL input */}
      <div className="editor-panel">
        <div className="panel-header">
          <span className="panel-title">DSL Input</span>
          <button className="btn btn-sm btn-primary" onClick={applyDsl}>
            Apply
          </button>
        </div>
        <div className="panel-body">
          <textarea
            className="dsl-textarea"
            value={dsl}
            onChange={(e) => setDsl(e.target.value)}
            placeholder="Enter DSL v2 code and click Apply..."
            spellCheck={false}
          />
        </div>
      </div>

      {/* Right panel: editable canvas */}
      <div className="editor-panel">
        <div className="toolbar-row">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`tool-btn${tool === t.id ? ' active' : ''}`}
              onClick={() => setTool(t.id)}
            >
              {t.label}
            </button>
          ))}
          <div className="toolbar-divider" />
          <button className="btn btn-sm" onClick={() => editableRef.current?.undo()}>
            Undo
          </button>
          <button className="btn btn-sm" onClick={() => editableRef.current?.redo()}>
            Redo
          </button>
          <div className="toolbar-divider" />
          <button className="btn btn-sm" onClick={() => editableRef.current?.selectAll()}>
            Select All
          </button>
          <button
            className="btn btn-sm"
            disabled={selectedIds.length === 0}
            onClick={() => editableRef.current?.deleteSelected()}
          >
            Delete
          </button>
        </div>
        <div className="panel-body canvas-container">
          <DepixCanvasEditable
            ref={editableRef}
            ir={ir}
            onIRChange={setIr}
            onSelectionChange={setSelectedIds}
            tool={tool}
            width={560}
            height={400}
          />
        </div>
        {selectedIds.length > 0 && (
          <div className="panel-header">
            <span className="text-muted">{selectedIds.length} element(s) selected</span>
          </div>
        )}
      </div>
    </div>
  );
}
