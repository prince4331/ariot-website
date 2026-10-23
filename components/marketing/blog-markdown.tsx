import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * BlogMarkdown — DB-backed blog body renderer (L3 Minimal Marketing CMS).
 *
 * BlogPost.body is persisted as plain Markdown (never MDX). Rendering runs on
 * the server through react-markdown, which parses Markdown into React
 * elements — no arbitrary component evaluation, no MDX runtime, no JS
 * execution from database content. GFM (tables, strikethrough) is enabled
 * because the seeded engineering notes use those constructs.
 *
 * The wrapper carries the `prose-ariot` class shared with the legacy static
 * MDX pages so typography matches across both sources.
 */
export function BlogMarkdown({ body }: { body: string }) {
  return (
    <div className="prose-ariot">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
    </div>
  );
}