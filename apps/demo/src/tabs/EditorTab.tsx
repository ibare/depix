import { useState, useRef, useCallback, useEffect } from 'react';
import { compile, lightTheme, darkTheme } from '@depix/core';
import type { DepixIR, DepixTheme } from '@depix/core';
import { DepixCanvasEditable } from '@depix/react';
import { ExportButton } from '../components/ExportButton';

interface EditorTabProps {
  initialDsl: string;
}

const MIN_LEFT_WIDTH = 280;
const MAX_LEFT_WIDTH = 800;
const DEFAULT_LEFT_WIDTH = 400;

export function EditorTab({ initialDsl }: EditorTabProps) {
  const [dsl, setDsl] = useState(initialDsl);
  const [themeName, setThemeName] = useState<'light' | 'dark'>('light');
  const [ir, setIr] = useState<DepixIR | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [showIr, setShowIr] = useState(true);

  // ---- Resize bar state ----
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // ---- Preview container size ----
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewSize, setPreviewSize] = useState({ width: 560, height: 315 });

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
    setDsl(initialDsl);
  }, [initialDsl]);

  // ---- Resize bar drag handlers ----

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      dragStartRef.current = { startX: e.clientX, startWidth: leftWidth };
    },
    [leftWidth],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const delta = e.clientX - dragStartRef.current.startX;
      const newWidth = Math.min(
        MAX_LEFT_WIDTH,
        Math.max(MIN_LEFT_WIDTH, dragStartRef.current.startWidth + delta),
      );
      setLeftWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // ---- Observe preview container size ----

  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setPreviewSize({ width: Math.floor(width), height: Math.floor(height) });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleIRChange = useCallback((newIr: DepixIR) => {
    setIr(newIr);
  }, []);

  return (
    <div className="editor-layout">
      {/* Left panel: DSL editor + IR viewer */}
      <div className="editor-panel editor-panel--left" style={{ width: leftWidth }}>
        <div className="panel-header">
          <span className="panel-title">DSL</span>
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
        <div className="panel-header ir-toggle-header">
          <button
            className="ir-toggle-btn"
            onClick={() => setShowIr(!showIr)}
          >
            {showIr ? '\u25BC' : '\u25B6'} IR
          </button>
        </div>
        {showIr && (
          <div className="panel-body ir-viewer">
            <pre className="ir-json">
              {ir ? JSON.stringify(ir, null, 2) : 'No IR available'}
            </pre>
          </div>
        )}
      </div>

      {/* Resize bar */}
      <div
        className={`resize-bar${isDragging ? ' active' : ''}`}
        onMouseDown={handleResizeStart}
      />

      {/* Right panel: preview */}
      <div className="editor-panel editor-panel--right">
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
            {ir && <ExportButton ir={ir} sceneIndex={0} />}
          </div>
        </div>
        <div ref={previewContainerRef} className="panel-body canvas-container">
          {ir ? (
            <DepixCanvasEditable
              ir={ir}
              onIRChange={handleIRChange}
              width={previewSize.width}
              height={previewSize.height}
            />
          ) : (
            <span className="text-muted">No preview available</span>
          )}
        </div>
      </div>

      {/* Prevent text selection while dragging */}
      {isDragging && (
        <div style={{
          position: 'fixed',
          inset: 0,
          cursor: 'col-resize',
          zIndex: 9999,
        }} />
      )}
    </div>
  );
}
