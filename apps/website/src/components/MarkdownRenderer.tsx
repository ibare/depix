import { useMemo } from 'react';
import DepixLive from './DepixLive';

interface MarkdownRendererProps {
  content: string;
}

/**
 * Minimal markdown-to-React renderer.
 * Handles: headings, paragraphs, code blocks (with depix live rendering),
 * inline code, bold, tables, lists, horizontal rules, and links.
 */
export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const elements = useMemo(() => parseMarkdown(content), [content]);
  return <div className="md-content">{elements}</div>;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

function parseMarkdown(md: string): React.ReactNode[] {
  const lines = md.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={key++} className="md-hr" />);
      i++;
      continue;
    }

    // Code block
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```

      const code = codeLines.join('\n');

      if (lang === 'depix') {
        nodes.push(
          <div key={key++} className="md-depix-live">
            <DepixLive dsl={code} />
          </div>,
        );
      } else {
        nodes.push(
          <pre key={key++} className="md-code-block">
            <code>{code}</code>
          </pre>,
        );
      }
      continue;
    }

    // Table
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      nodes.push(renderTable(tableLines, key++));
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const heading = renderInline(text);
      const cls = `md-h${level}`;
      if (level === 1) nodes.push(<h2 key={key++} className={cls}>{heading}</h2>);
      else if (level === 2) nodes.push(<h3 key={key++} className={cls}>{heading}</h3>);
      else if (level === 3) nodes.push(<h4 key={key++} className={cls}>{heading}</h4>);
      else nodes.push(<h5 key={key++} className={cls}>{heading}</h5>);
      i++;
      continue;
    }

    // List (unordered or ordered)
    if (/^[-*]\s/.test(line.trim()) || /^\d+\.\s/.test(line.trim())) {
      const listItems: string[] = [];
      const isOrdered = /^\d+\.\s/.test(line.trim());
      while (i < lines.length && (/^[-*]\s/.test(lines[i].trim()) || /^\d+\.\s/.test(lines[i].trim()))) {
        listItems.push(lines[i].trim().replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''));
        i++;
      }
      const ListTag = isOrdered ? 'ol' : 'ul';
      nodes.push(
        <ListTag key={key++} className="md-list">
          {listItems.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ListTag>,
      );
      continue;
    }

    // Paragraph (collect consecutive non-empty, non-special lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('|') &&
      !/^---+$/.test(lines[i].trim()) &&
      !/^[-*]\s/.test(lines[i].trim()) &&
      !/^\d+\.\s/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      nodes.push(<p key={key++} className="md-p">{renderInline(paraLines.join(' '))}</p>);
    }
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Inline rendering
// ---------------------------------------------------------------------------

function renderInline(text: string): React.ReactNode {
  // Split on inline code, bold, and links
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let idx = 0;

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/`([^`]+)`/);
    // Bold
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    // Link
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

    // Find earliest match
    const matches = [
      codeMatch ? { type: 'code', match: codeMatch } : null,
      boldMatch ? { type: 'bold', match: boldMatch } : null,
      linkMatch ? { type: 'link', match: linkMatch } : null,
    ].filter(Boolean) as { type: string; match: RegExpMatchArray }[];

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    const earliest = matches.reduce((a, b) =>
      (a.match.index ?? Infinity) < (b.match.index ?? Infinity) ? a : b,
    );

    const matchIdx = earliest.match.index ?? 0;
    if (matchIdx > 0) {
      parts.push(remaining.slice(0, matchIdx));
    }

    if (earliest.type === 'code') {
      parts.push(<code key={idx++} className="md-inline-code">{earliest.match[1]}</code>);
    } else if (earliest.type === 'bold') {
      parts.push(<strong key={idx++}>{earliest.match[1]}</strong>);
    } else if (earliest.type === 'link') {
      parts.push(
        <a key={idx++} href={earliest.match[2]} target="_blank" rel="noopener noreferrer">
          {earliest.match[1]}
        </a>,
      );
    }

    remaining = remaining.slice(matchIdx + earliest.match[0].length);
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
}

// ---------------------------------------------------------------------------
// Table rendering
// ---------------------------------------------------------------------------

function renderTable(lines: string[], key: number): React.ReactNode {
  const parseRow = (line: string) =>
    line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());

  const rows = lines.filter((l) => !/^[|\s:-]+$/.test(l)).map(parseRow);
  if (rows.length === 0) return null;

  const header = rows[0];
  const body = rows.slice(1);

  return (
    <div key={key} className="md-table-wrap">
      <table className="md-table">
        <thead>
          <tr>
            {header.map((cell, i) => (
              <th key={i}>{renderInline(cell)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci}>{renderInline(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
