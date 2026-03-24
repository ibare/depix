import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { compile } from '@depix/core';
import { DepixCanvasEditable } from '@depix/react';
import type { DepixIR } from '@depix/core';

interface DepixLiveProps {
  dsl: string;
  className?: string;
  aspectRatio?: number;
}

export default function DepixLive({ dsl, className = '', aspectRatio = 16 / 9 }: DepixLiveProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const initialIR = useMemo(() => {
    try {
      return compile(dsl).ir;
    } catch {
      return null;
    }
  }, [dsl]);

  const [ir, setIr] = useState<DepixIR | null>(initialIR);

  useEffect(() => {
    setIr(initialIR);
  }, [initialIR]);

  const handleIRChange = useCallback((newIr: DepixIR) => {
    setIr(newIr);
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

  if (!ir) return null;

  return (
    <div
      ref={containerRef}
      className={`depix-live ${className}`}
      style={{ aspectRatio: `${aspectRatio}`, width: '100%' }}
    >
      {size && (
        <DepixCanvasEditable
          ir={ir}
          onIRChange={handleIRChange}
          width={size.width}
          height={size.height}
        />
      )}
    </div>
  );
}
