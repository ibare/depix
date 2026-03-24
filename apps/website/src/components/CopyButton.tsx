import { useState, useCallback } from 'react';

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      style={{
        background: copied ? 'var(--color-accent)' : 'rgba(0,0,0,0.05)',
        color: copied ? '#fff' : 'var(--color-muted)',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        padding: '0.25em 0.6em',
        fontSize: '0.75em',
        cursor: 'pointer',
        transition: 'all 0.15s',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}
