interface AsciiPanelProps {
  content: string;
  className?: string;
}

export function AsciiPanel({ content, className }: AsciiPanelProps) {
  return (
    <pre className={`ascii-panel ${className ?? ''}`}>
      <code>{content}</code>
    </pre>
  );
}
