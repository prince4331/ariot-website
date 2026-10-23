import { slugify } from './slugify';

/**
 * Extract h2 headings from a Markdown body for the article TOC sidebar.
 *
 * Framework-agnostic (no remark dependency) and deliberately lightweight:
 * scans ATX headings outside fenced code blocks, strips inline Markdown
 * syntax from the label, and reuses the shared `slugify` so IDs match the
 * anchor convention used across the site.
 */

export interface MarkdownTocItem {
  id: string;
  text: string;
}

const INLINE_MARKUP = /(\*\*|__|\*|_|`)/g;

export function extractMarkdownHeadings(body: string): ReadonlyArray<MarkdownTocItem> {
  const items: MarkdownTocItem[] = [];
  let inFence = false;

  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (!trimmed.startsWith('## ')) continue;

    const text = trimmed
      .slice(3)
      .replace(INLINE_MARKUP, '')
      .trim();
    if (!text) continue;
    items.push({ id: slugify(text), text });
  }

  return items;
}