import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { compile } from '@depix/core';
import { DepixCanvasEditable } from '@depix/react';
import type { DepixIR } from '@depix/core';
import { useLang } from '../i18n/context';
import { PLAYGROUND_DEFAULT } from '../data/playground-default';

export default function Playground() {
  const { t } = useLang();
  const [dsl, setDsl] = useState(PLAYGROUND_DEFAULT);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(600);

  const [compiledDsl, setCompiledDsl] = useState(PLAYGROUND_DEFAULT);

  const ir = useMemo<DepixIR | null>(() => {
    try {
      const result = compile(compiledDsl);
      setError(null);
      return result.ir;
    } catch (err) {
      setError(String(err));
      return null;
    }
  }, [compiledDsl]);

  const [editableIr, setEditableIr] = useState<DepixIR | null>(ir);

  useEffect(() => {
    setEditableIr(ir);
  }, [ir]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDsl(value);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCompiledDsl(value);
    }, 300);
  }, []);

  const handleIRChange = useCallback((newIr: DepixIR) => {
    setEditableIr(newIr);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setCanvasWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="section" style={{ paddingTop: '2em' }}>
      <div className="container">
        <h1 style={{ fontSize: '1.5em', marginBottom: '1em' }}>{t.playground.title}</h1>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1.5em',
            minHeight: '70vh',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <textarea
              value={dsl}
              onChange={handleChange}
              spellCheck={false}
              style={{
                flex: 1,
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85em',
                lineHeight: 1.6,
                padding: '1.25em',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                background: 'var(--color-bg-alt)',
                color: 'var(--color-text)',
                resize: 'none',
                outline: 'none',
              }}
            />
            {error && (
              <div
                style={{
                  marginTop: '0.5em',
                  padding: '0.5em 0.75em',
                  fontSize: '0.8em',
                  color: '#dc2626',
                  background: '#fef2f2',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {t.playground.error_label}: {error}
              </div>
            )}
          </div>
          <div ref={containerRef} className="depix-live">
            {editableIr && (
              <DepixCanvasEditable
                ir={editableIr}
                onIRChange={handleIRChange}
                width={canvasWidth}
                height={Math.round(canvasWidth / (16 / 9))}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
