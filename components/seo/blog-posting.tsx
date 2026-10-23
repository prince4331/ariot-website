import { JsonLd } from './json-ld';
import { siteConfig } from '@/lib/seo/site';

interface BlogPostingProps {
  /** Article headline. */
  headline: string;
  /** Article summary / excerpt. */
  description: string;
  /** Absolute URL of the featured image. */
  image?: string;
  /** Author name(s). Defaults to site name. */
  author?: string[];
  /** ISO 8601 publication date. Omitted until the article is officially released. */
  datePublished?: string;
  /** ISO 8601 last modified date. */
  dateModified?: string;
  /** Page URL path. */
  url: string;
  /** Article tags / keywords. */
  tags?: ReadonlyArray<string>;
}

/**
 * Schema.org BlogPosting structured data.
 * Renders on `/blog/[slug]`. Enables article rich results (headline,
 * image, date, author) in Google search.
 */
export function BlogPosting({
  headline,
  description,
  image,
  author = [siteConfig.name],
  datePublished,
  dateModified,
  url,
  tags,
}: BlogPostingProps) {
  const fullUrl = new URL(url, siteConfig.url).toString();

  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline,
        description,
        ...(image ? { image } : {}),
        author: author.map((name) => ({
          '@type': 'Person',
          name,
        })),
        publisher: {
          '@type': 'Organization',
          name: siteConfig.fullName,
        },
        ...(datePublished ? { datePublished } : {}),
        ...(dateModified ? { dateModified } : {}),
        ...(tags && tags.length > 0 ? { keywords: [...tags] } : {}),
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': fullUrl,
        },
      }}
    />
  );
}
