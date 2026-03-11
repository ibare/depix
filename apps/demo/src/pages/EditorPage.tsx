import { useState, useCallback, useEffect } from 'react';
import { compile } from '@depix/core';
import type { DepixIR } from '@depix/core';
import { DepixCanvasEditable } from '@depix/react';
import { CodePanel } from '../components/CodePanel';

interface EditorPageProps {
  debug?: boolean;
}

const DEFAULT_DSL = `@presentation

scene "Welcome" {
  layout: header
  header: heading "DSL Editor"
  body: bullet "Edit DSL on the left, see changes on the right"
}

scene "Diagram" {
  layout: full
  body: flow {
    node "Start" #start
    node "Process" #proc
    node "End" #end
    #start -> #proc
    #proc -> #end
  }
}`;

export function EditorPage({ debug }: EditorPageProps) {
  const [dsl, setDsl] = useState(DEFAULT_DSL);
  const [ir, setIr] = useState<DepixIR | null>(null);

  const handleDSLChange = useCallback((newDsl: string) => {
    setDsl(newDsl);
  }, []);

  const handleIRChange = useCallback((newIr: DepixIR) => {
    setIr(newIr);
  }, []);

  useEffect(() => {
    try {
      const result = compile(dsl);
      setIr(result.ir);
    } catch {
      setIr(null);
    }
  }, [dsl]);

  return (
    <div style={{ display: 'flex', gap: 16, padding: 16, height: 'calc(100vh - 60px)' }}>
      {/* DSL Code Panel (left) */}
      <div
        style={{
          width: 400,
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: '#999',
            marginBottom: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>DSL Source</span>
          <button
            onClick={() => setDsl(DEFAULT_DSL)}
            style={{
              background: '#333',
              border: '1px solid #444',
              borderRadius: 4,
              color: '#999',
              padding: '2px 8px',
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>
        <CodePanel
          value={dsl}
          onChange={handleDSLChange}
          editable
          className="editor-code-panel"
        />
      </div>

      {/* Visual Editor (right) */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
          Visual Editor
        </div>
        {ir && (
          <DepixCanvasEditable
            ir={ir}
            onIRChange={handleIRChange}
            width={600}
            height={400}
            debug={debug}
            dsl={dsl}
            onDSLChange={handleDSLChange}
          />
        )}
      </div>
    </div>
  );
}
