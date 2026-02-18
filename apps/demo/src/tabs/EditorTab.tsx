import { useState, useRef, useCallback, useEffect } from 'react';
import { compile, lightTheme, darkTheme } from '@depix/core';
import type { DepixIR, DepixTheme } from '@depix/core';
import { DepixCanvas } from '@depix/react';
import type { DepixCanvasRef } from '@depix/react';
import { ExportButton } from '../components/ExportButton';
import { EXAMPLES } from '../examples';

interface EditorTabProps {
  initialDsl?: string;
}

export function EditorTab({ initialDsl }: EditorTabProps) {
  const [dsl, setDsl] = useState(initialDsl ?? EXAMPLES[0].dsl);
  const [themeName, setThemeName] = useState<'light' | 'dark'>('light');
  const [ir, setIr] = useState<DepixIR | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [sceneInfo, setSceneInfo] = useState({ index: 0, count: 1 });
  const canvasRef = useRef<DepixCanvasRef>(null);

  const theme: DepixTheme = themeName === 'dark' ? darkTheme : lightTheme;

  const doCompile = useCallback(
    (source: string) => {
      try {
        const result = compile(source, { theme });
        setIr(result.ir);
        setErrors(result.errors.map((e) => `Line ${e.line}: ${e.message}`));
      } catch (e) {
        setErrors([(e as Error).message]);
        setIr(null);
      }
    },
    [theme],
  );

  useEffect(() => {
    doCompile(dsl);
  }, [dsl, doCompile]);

  useEffect(() => {
    if (initialDsl) setDsl(initialDsl);
  }, [initialDsl]);

  const updateSceneInfo = () => {
    if (!canvasRef.current) return;
    setSceneInfo({
      index: canvasRef.current.getSceneIndex(),
      count: canvasRef.current.getSceneCount(),
    });
  };

  return (
    <div className="editor-layout">
      {/* Left panel: examples + textarea */}
      <div className="editor-panel">
        <div className="example-list">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.id}
              className={`example-item${dsl === ex.dsl ? ' active' : ''}`}
              onClick={() => setDsl(ex.dsl)}
            >
              {ex.title}
            </button>
          ))}
        </div>
        <div className="panel-body">
          <textarea
            className="dsl-textarea"
            value={dsl}
            onChange={(e) => setDsl(e.target.value)}
            placeholder="Enter DSL v2 code..."
            spellCheck={false}
          />
        </div>
        {errors.length > 0 && (
          <div className="error-bar">{errors.join(' | ')}</div>
        )}
      </div>

      {/* Right panel: preview */}
      <div className="editor-panel">
        <div className="panel-header">
          <span className="panel-title">Preview</span>
          <div className="panel-actions">
            <select
              className="theme-switcher"
              value={themeName}
              onChange={(e) => setThemeName(e.target.value as 'light' | 'dark')}
            >
              <option value="light">Light Theme</option>
              <option value="dark">Dark Theme</option>
            </select>
            <ExportButton ir={ir} sceneIndex={sceneInfo.index} />
          </div>
        </div>
        <div className="panel-body canvas-container">
          {ir ? (
            <DepixCanvas
              ref={canvasRef}
              data={ir}
              width={560}
              height={315}
              onSceneChange={updateSceneInfo}
            />
          ) : (
            <span className="text-muted">No preview available</span>
          )}
        </div>
        {sceneInfo.count > 1 && (
          <div className="panel-header">
            <div className="scene-nav">
              <button
                className="btn btn-sm"
                disabled={sceneInfo.index === 0}
                onClick={() => {
                  canvasRef.current?.prevScene();
                  updateSceneInfo();
                }}
              >
                Prev
              </button>
              <span>
                Scene {sceneInfo.index + 1} / {sceneInfo.count}
              </span>
              <button
                className="btn btn-sm"
                disabled={sceneInfo.index >= sceneInfo.count - 1}
                onClick={() => {
                  canvasRef.current?.nextScene();
                  updateSceneInfo();
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
