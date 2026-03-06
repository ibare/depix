import { useState, useCallback, useEffect, useRef } from 'react';
import { compile } from '@depix/core';
import type { DepixIR, DepixTheme } from '@depix/core';
import { lightTheme, darkTheme } from '@depix/core';
import { DepixCanvasEditable } from '@depix/react';
import { CodePanel } from './CodePanel';

interface LiveExampleProps {
  /** Initial DSL source code. */
  dsl: string;
  /** Show DSL code panel. Default: true */
  showCode?: boolean;
  /** Allow editing DSL text. Default: false */
  editable?: boolean;
  /** Layout direction. Default: 'row' */
  layout?: 'row' | 'col';
  /** Canvas width. Default: 480 */
  width?: number;
  /** Canvas height. Default: 270 */
  height?: number;
  /** Code panel max height (px). */
  codeMaxHeight?: number;
  /** CSS class for the root element. */
  className?: string;
  /** Theme name to use for compilation. */
  themeName?: 'light' | 'dark';
}

export function LiveExample({
  dsl: initialDsl,
  showCode = true,
  editable = false,
  layout = 'row',
  width = 480,
  height = 270,
  codeMaxHeight,
  className,
  themeName = 'light',
}: LiveExampleProps) {
  const [dsl, setDsl] = useState(initialDsl);
  const [ir, setIr] = useState<DepixIR | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width, height });
  const [isCanvasHovered, setIsCanvasHovered] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const theme: DepixTheme = themeName === 'dark' ? darkTheme : lightTheme;

  // Sync when parent DSL changes
  useEffect(() => {
    setDsl(initialDsl);
  }, [initialDsl]);

  // Compile DSL → IR
  useEffect(() => {
    try {
      const result = compile(dsl, { theme });
      setIr(result.ir);
      setErrors(result.errors.map((e) => `Line ${e.line}: ${e.message}`));
    } catch (e) {
      setErrors([(e as Error).message]);
      setIr(null);
    }
  }, [dsl, theme]);

  // Observe canvas container size for responsive rendering
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          setCanvasSize({ width: Math.floor(w), height: Math.floor(h) });
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleIRChange = useCallback((newIr: DepixIR) => {
    setIr(newIr);
  }, []);

  // Sync isFullscreen state with browser Fullscreen API events
  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const enterFullscreen = useCallback(() => {
    containerRef.current?.requestFullscreen();
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
  }, []);

  return (
    <div className={`live-example live-example--${layout} ${className ?? ''}`}>
      {showCode && (
        <div className="live-example__code">
          <CodePanel
            value={dsl}
            onChange={editable ? setDsl : undefined}
            editable={editable}
            maxHeight={codeMaxHeight}
          />
          {errors.length > 0 && (
            <div className="live-example__errors">{errors.join(' | ')}</div>
          )}
        </div>
      )}
      <div
        ref={containerRef}
        className={`live-example__canvas${isFullscreen ? ' live-example__canvas--fullscreen' : ''}`}
        onMouseEnter={() => setIsCanvasHovered(true)}
        onMouseLeave={() => setIsCanvasHovered(false)}
      >
        {ir ? (
          <DepixCanvasEditable
            ir={ir}
            onIRChange={handleIRChange}
            width={canvasSize.width}
            height={canvasSize.height}
          />
        ) : (
          <span className="text-muted">No preview</span>
        )}
        {ir && !isFullscreen && (
          <button
            type="button"
            className="live-example__fullscreen-btn"
            style={{ opacity: isCanvasHovered ? 1 : 0 }}
            onClick={enterFullscreen}
            title="전체 화면"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="8.5,1 13,1 13,5.5" />
              <polyline points="5.5,13 1,13 1,8.5" />
              <line x1="13" y1="1" x2="8.5" y2="5.5" />
              <line x1="1" y1="13" x2="5.5" y2="8.5" />
            </svg>
          </button>
        )}
        {isFullscreen && (
          <button
            type="button"
            className="live-example__fullscreen-close"
            onClick={exitFullscreen}
            title="전체 화면 종료 (ESC)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="5.5,1 1,1 1,5.5" />
              <polyline points="8.5,13 13,13 13,8.5" />
              <line x1="1" y1="1" x2="5.5" y2="5.5" />
              <line x1="13" y1="13" x2="8.5" y2="8.5" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
