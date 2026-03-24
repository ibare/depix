import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { compile } from '@depix/core';
import { DepixCanvasEditable } from '@depix/react';
import type { DepixIR } from '@depix/core';

interface DepixLiveProps {
  dsl: string;
  className?: string;
  aspectRatio?: number;
}

export default function DepixLive({ dsl: initialDsl, className = '', aspectRatio = 16 / 9 }: DepixLiveProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const [dsl, setDsl] = useState(initialDsl);

  const ir = useMemo<DepixIR | null>(() => {
    try {
      return compile(dsl).ir;
    } catch {
      return null;
    }
  }, [dsl]);

  const [editableIr, setEditableIr] = useState<DepixIR | null>(ir);

  useEffect(() => {
    setEditableIr(ir);
  }, [ir]);

  // Reset when parent DSL changes (e.g. tab switch in Examples)
  useEffect(() => {
    setDsl(initialDsl);
  }, [initialDsl]);

  const handleIRChange = useCallback((newIr: DepixIR) => {
    setEditableIr(newIr);
  }, []);

  const handleDSLChange = useCallback((newDsl: string) => {
    setDsl(newDsl);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) {
        setSize({ width: w, height: Math.round(w / aspectRatio) });
      }
    };

    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, [aspectRatio]);

  if (!editableIr) return null;

  return (
    <div
      ref={containerRef}
      className={`depix-live ${className}`}
      style={{ aspectRatio: `${aspectRatio}`, width: '100%' }}
    >
      {size && (
        <DepixCanvasEditable
          ir={editableIr}
          onIRChange={handleIRChange}
          dsl={dsl}
          onDSLChange={handleDSLChange}
          width={size.width}
          height={size.height}
        />
      )}
    </div>
  );
}
