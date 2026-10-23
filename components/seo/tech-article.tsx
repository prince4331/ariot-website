import { JsonLd } from './json-ld';
import { siteConfig } from '@/lib/seo/site';

interface TechArticleProps {
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
  /** Product names this article is about. */
  about?: ReadonlyArray<string>;
}

/**
 * Schema.org TechArticle structured data.
 * Renders on `/support/article/[slug]`. TechArticle is the correct type
 * for technical documentation — it signals "instructional content" to
 * Google, enabling how-to rich results and featured snippet eligibility.
 */
export function TechArticle({
  headline,
  description,
  image,
  author = [siteConfig.name],
  datePublished,
  dateModified,
  url,
  about,
}: TechArticleProps) {
  const fullUrl = new URL(url, siteConfig.url).toString();

  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
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
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': fullUrl,
        },
        ...(about && about.length > 0
          ? {
              about: about.map((name) => ({
                '@type': 'Product',
                name,
              })),
            }
          : {}),
      }}
    />
  );
}
