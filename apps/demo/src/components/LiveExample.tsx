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
  /** Show debug overlay with element bounding boxes. */
  debug?: boolean;
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
  debug = false,
}: LiveExampleProps) {
  const [dsl, setDsl] = useState(initialDsl);
  const [ir, setIr] = useState<DepixIR | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(width);

  const theme: DepixTheme = themeName === 'dark' ? darkTheme : lightTheme;

  // Sync when parent DSL changes
  useEffect(() => {
    setDsl(initialDsl);
  }, [initialDsl]);

  // Compile DSL → IR (debounced to avoid rapid recompilation on every keystroke)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const result = compile(dsl, { theme });
        setIr(result.ir);
        setErrors(result.errors.map((e) => `Line ${e.line}: ${e.message}`));
      } catch (e) {
        setErrors([(e as Error).message]);
        setIr(null);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [dsl, theme]);

  // Compute canvas size from container width + IR aspect ratio (no letterbox)
  const ar = ir?.meta.aspectRatio ?? { width: 16, height: 9 };
  const canvasWidth = Math.floor(containerWidth);
  const canvasHeight = Math.floor(containerWidth * (ar.height / ar.width));

  // Observe container width only
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setContainerWidth(w);
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
      <div
        ref={containerRef}
        className="live-example__canvas"
      >
        {ir ? (
          <DepixCanvasEditable
            ir={ir}
            onIRChange={handleIRChange}
            width={canvasWidth}
            height={canvasHeight}
            debug={debug}
          />
        ) : (
          <span className="text-muted">No preview</span>
        )}
      </div>
    </div>
  );
}
