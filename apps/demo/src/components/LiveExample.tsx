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
      <div ref={containerRef} className="live-example__canvas">
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
      </div>
    </div>
  );
}
