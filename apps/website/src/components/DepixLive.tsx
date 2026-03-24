import { useRef, useState, useEffect } from 'react';
import { DepixCanvas } from '@depix/react';

interface DepixLiveProps {
  dsl: string;
  className?: string;
  aspectRatio?: number;
}

export default function DepixLive({ dsl, className = '', aspectRatio = 16 / 9 }: DepixLiveProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

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

  return (
    <div
      ref={containerRef}
      className={`depix-live ${className}`}
      style={{ aspectRatio: `${aspectRatio}`, width: '100%' }}
    >
      {size && <DepixCanvas data={dsl} width={size.width} height={size.height} />}
    </div>
  );
}
