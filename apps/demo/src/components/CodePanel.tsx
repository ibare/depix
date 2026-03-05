import { useRef, useEffect } from 'react';

interface CodePanelProps {
  value: string;
  onChange?: (value: string) => void;
  editable?: boolean;
  className?: string;
  maxHeight?: number;
}

export function CodePanel({ value, onChange, editable = false, className, maxHeight }: CodePanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea to fit content
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const scrollH = el.scrollHeight;
    el.style.height = `${maxHeight ? Math.min(scrollH, maxHeight) : scrollH}px`;
  }, [value, maxHeight]);

  if (!editable) {
    return (
      <pre className={`code-panel ${className ?? ''}`}>
        <code>{value}</code>
      </pre>
    );
  }

  return (
    <textarea
      ref={textareaRef}
      className={`code-panel code-panel--editable ${className ?? ''}`}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      spellCheck={false}
      style={maxHeight ? { maxHeight } : undefined}
    />
  );
}
