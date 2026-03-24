import { useState, useCallback, useRef, useEffect } from 'react';
import { DepixCanvas } from '@depix/react';
import { useLang } from '../i18n/context';
import { PLAYGROUND_DEFAULT } from '../data/playground-default';

export default function Playground() {
  const { t } = useLang();
  const [dsl, setDsl] = useState(PLAYGROUND_DEFAULT);
  const [rendered, setRendered] = useState(PLAYGROUND_DEFAULT);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(600);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDsl(value);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        setRendered(value);
        setError(null);
      } catch (err) {
        setError(String(err));
      }
    }, 300);
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
            <DepixCanvas data={rendered} width={canvasWidth} height={Math.round(canvasWidth / (16 / 9))} />
          </div>
        </div>
      </div>
    </section>
  );
}
