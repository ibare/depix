#!/usr/bin/env tsx
/**
 * check-docs-sync.ts
 *
 * Compares H2 section checksums in docs/DEPIX_DSL_PROMPT.md against
 * the synced_with hashes stored in website docs content files.
 *
 * Usage:
 *   tsx scripts/check-docs-sync.ts          # check all
 *   tsx scripts/check-docs-sync.ts --update # update hashes after sync
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const MD_PATH = resolve(ROOT, 'docs/DEPIX_DSL_PROMPT.md');
const DOCS_DIR = resolve(ROOT, 'apps/website/src/docs');

// ---------------------------------------------------------------------------
// 1. Parse MD into H2 sections
// ---------------------------------------------------------------------------

interface Section {
  title: string;
  slug: string;
  content: string;
  hash: string;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 8);
}

function parseSections(md: string): Section[] {
  const lines = md.split('\n');
  const sections: Section[] = [];
  let current: { title: string; startLine: number } | null = null;
  const sectionLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ')) {
      if (current) {
        const content = sectionLines.join('\n').trim();
        sections.push({
          title: current.title,
          slug: slugify(current.title),
          content,
          hash: hashContent(content),
        });
        sectionLines.length = 0;
      }
      current = { title: line.slice(3).trim(), startLine: i };
    } else if (current) {
      sectionLines.push(line);
    }
  }

  if (current) {
    const content = sectionLines.join('\n').trim();
    sections.push({
      title: current.title,
      slug: slugify(current.title),
      content,
      hash: hashContent(content),
    });
  }

  return sections;
}

// ---------------------------------------------------------------------------
// 2. Read synced_with from docs content files
// ---------------------------------------------------------------------------

interface DocsFile {
  filename: string;
  slug: string;
  syncedWith: string | null; // "section-slug@hash" or null
  filePath: string;
  content: string;
}

function readDocsFiles(): DocsFile[] {
  let files: string[];
  try {
    files = readdirSync(DOCS_DIR).filter((f) => f.endsWith('.ts'));
  } catch {
    return [];
  }

  return files.map((f) => {
    const filePath = resolve(DOCS_DIR, f);
    const content = readFileSync(filePath, 'utf-8');
    const match = content.match(/synced_with:\s*["']([^"']+)["']/);
    return {
      filename: f,
      slug: basename(f, '.ts'),
      syncedWith: match ? match[1] : null,
      filePath,
      content,
    };
  });
}

// ---------------------------------------------------------------------------
// 3. Compare and report
// ---------------------------------------------------------------------------

const isUpdate = process.argv.includes('--update');

const md = readFileSync(MD_PATH, 'utf-8');
const sections = parseSections(md);
const docsFiles = readDocsFiles();

console.log('Depix Docs Sync Check');
console.log('═'.repeat(60));
console.log(`Source: docs/DEPIX_DSL_PROMPT.md (${sections.length} sections)\n`);

// Print section hashes
for (const section of sections) {
  console.log(`  ${section.slug.padEnd(25)} ${section.hash}`);
}
console.log('');

if (docsFiles.length === 0) {
  console.log('No docs content files found in apps/website/src/docs/');
  console.log('Run the docs content generator first.\n');

  // Print template for initial setup
  console.log('Expected files:');
  for (const section of sections) {
    console.log(`  apps/website/src/docs/${section.slug}.ts`);
  }
  process.exit(0);
}

let staleCount = 0;
let missingCount = 0;

for (const section of sections) {
  const docsFile = docsFiles.find((f) => f.slug === section.slug);

  if (!docsFile) {
    console.log(`  ✗ ${section.slug} — MISSING (no docs file)`);
    missingCount++;
    continue;
  }

  const expectedSync = `${section.slug}@${section.hash}`;

  if (docsFile.syncedWith === expectedSync) {
    console.log(`  ✓ ${section.slug} — up to date`);
  } else {
    console.log(`  ✗ ${section.slug} — STALE`);
    console.log(`      was: ${docsFile.syncedWith ?? '(none)'}`);
    console.log(`      now: ${expectedSync}`);
    staleCount++;

    if (isUpdate) {
      const oldSync = docsFile.syncedWith
        ? `synced_with: '${docsFile.syncedWith}'`
        : null;
      const newSync = `synced_with: '${expectedSync}'`;

      if (oldSync && docsFile.content.includes(oldSync)) {
        const updated = docsFile.content.replace(oldSync, newSync);
        writeFileSync(docsFile.filePath, updated, 'utf-8');
        console.log(`      → updated hash`);
      } else {
        console.log(`      → could not auto-update (manual edit needed)`);
      }
    }
  }
}

console.log('');
if (staleCount === 0 && missingCount === 0) {
  console.log('All docs are in sync! ✓');
} else {
  if (staleCount > 0) console.log(`${staleCount} section(s) need updating.`);
  if (missingCount > 0) console.log(`${missingCount} section(s) have no docs file.`);
  if (!isUpdate) console.log('\nRun with --update to update hashes after syncing content.');
}
