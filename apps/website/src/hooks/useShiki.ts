import { useState, useEffect } from 'react';

// Shiki loaded from CDN — no bundle impact
const SHIKI_CDN = 'https://esm.sh/shiki@3.7.0';
const GRAMMAR_PATH = '/depix/depix.tmLanguage.json';

interface ShikiHighlighter {
  codeToHtml: (code: string, options: { lang: string; theme: string }) => string;
}

let highlighterPromise: Promise<ShikiHighlighter> | null = null;
let cachedHighlighter: ShikiHighlighter | null = null;

async function loadHighlighter(): Promise<ShikiHighlighter> {
  if (cachedHighlighter) return cachedHighlighter;

  // Fetch our custom grammar
  const grammarResp = await fetch(GRAMMAR_PATH);
  const grammar = await grammarResp.json();

  // Dynamic import from CDN
  const shiki = await import(/* @vite-ignore */ SHIKI_CDN);

  const highlighter = await shiki.createHighlighter({
    themes: ['github-light'],
    langs: [],
  });

  // Register the custom grammar explicitly
  await highlighter.loadLanguage(grammar);

  cachedHighlighter = highlighter;
  return highlighter;
}

/**
 * Returns a function that highlights Depix DSL code to HTML.
 * Returns null while Shiki is loading — caller should show plain code as fallback.
 */
export function useShiki(): ((code: string) => string) | null {
  const [highlight, setHighlight] = useState<((code: string) => string) | null>(
    cachedHighlighter
      ? () => (code: string) =>
          cachedHighlighter!.codeToHtml(code, { lang: 'depix', theme: 'github-light' })
      : null,
  );

  useEffect(() => {
    if (cachedHighlighter) return;

    if (!highlighterPromise) {
      highlighterPromise = loadHighlighter();
    }

    highlighterPromise.then((hl) => {
      setHighlight(
        () => (code: string) => hl.codeToHtml(code, { lang: 'depix', theme: 'github-light' }),
      );
    }).catch(() => {
      // Shiki failed to load — keep plain text fallback
    });
  }, []);

  return highlight;
}
