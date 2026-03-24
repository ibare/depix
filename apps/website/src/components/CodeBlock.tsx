import CopyButton from './CopyButton';

interface CodeBlockProps {
  code: string;
  copyable?: boolean;
}

export default function CodeBlock({ code, copyable = true }: CodeBlockProps) {
  return (
    <div className="code-block" style={{ position: 'relative' }}>
      {copyable && (
        <div style={{ position: 'absolute', top: '0.5em', right: '0.5em' }}>
          <CopyButton text={code} />
        </div>
      )}
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
