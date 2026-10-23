import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, Calendar, Clock, MessageCircle, Package } from 'lucide-react';
import { Breadcrumb } from '@/components/marketing/breadcrumb';
import { CtaBand } from '@/components/marketing/cta-band';
import { FeatureCard } from '@/components/marketing/feature-card';
import { FeatureGrid } from '@/components/marketing/feature-grid';
import { SectionHeader } from '@/components/marketing/section-header';
import { TableOfContents } from '@/components/marketing/table-of-contents';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { Separator } from '@/components/ui/separator';
import { BreadcrumbList } from '@/components/seo/breadcrumb-list';
import { TechArticle } from '@/components/seo/tech-article';
import { defineMetadata, defineSupportArticleMetadata } from '@/lib/seo/metadata';
import {
  SUPPORT_ARTICLES,
  getSupportArticleBySlug,
  getRelatedArticles,
} from '@/features/support/_data';

interface SupportArticlePageProps {
  params: Promise<{ slug: string }>;
}

/** Static import map — Next.js statically analyses these to bundle the right chunks. */
async function getContent(slug: string) {
  switch (slug) {
    case 'floor-cleaning-robot-first-setup':
      return (await import('@/content/support/floor-cleaning-robot-first-setup.mdx')).default;
    case 'iot-gateway-node-deployment':
      return (await import('@/content/support/iot-gateway-node-deployment.mdx')).default;
    case 'home-safety-device-sensor-test':
      return (await import('@/content/support/home-safety-device-sensor-test.mdx')).default;
    default:
      return null;
  }
}

export function generateStaticParams(): Array<{ slug: string }> {
  return SUPPORT_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: SupportArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getSupportArticleBySlug(slug);

  if (!article) {
    return defineMetadata({
      title: 'Article not found',
      description: 'The requested support article could not be found.',
      path: `/support/article/${slug}`,
      noindex: true,
    });
  }

  return defineSupportArticleMetadata({
    title: article.title,
    description: article.excerpt,
    path: `/support/article/${slug}`,
    publishedTime: article.publishedAt,
    tags: article.relatedProducts,
  });
}

export default async function SupportArticlePage({ params }: SupportArticlePageProps) {
  const { slug } = await params;
  const article = getSupportArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const [MDXContent, relatedArticles] = await Promise.all([
    getContent(slug),
    Promise.resolve(getRelatedArticles(slug)),
  ]);

  const ArticleIcon = article.icon;

  return (
    <>
      <TechArticle
        headline={article.title}
        description={article.excerpt}
        datePublished={article.publishedAt}
        url={`/support/article/${article.slug}`}
        about={article.relatedProducts}
      />
      <BreadcrumbList
        items={[
          { name: 'Home', url: '/' },
          { name: 'Support', url: '/support' },
          { name: article.category, url: '/support' },
          { name: article.title, url: `/support/article/${article.slug}` },
        ]}
      />

      <Section bg="base" spacing="loose">
        <Container className="flex flex-col gap-8">
          <Breadcrumb
            items={[
              { label: 'Home', href: '/' },
              { label: 'Support', href: '/support' },
              { label: article.category, href: '/support' },
              { label: article.title },
            ]}
          />

          <div className="flex max-w-3xl flex-col gap-6">
            <div className="inline-flex items-center gap-3">
              <span
                aria-hidden
                className="bg-cyan-faint inline-flex h-10 w-10 items-center justify-center rounded-md text-cyan-400"
              >
                <ArticleIcon className="h-5 w-5" />
              </span>
              <p className="font-mono text-[11px] tracking-[0.18em] text-cyan-400 uppercase">
                {article.category}
              </p>
            </div>

            <h1 className="text-steel-100 font-display text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-4xl">
              {article.title}
            </h1>

            <div className="text-steel-400 flex flex-wrap items-center gap-4 font-mono text-[11px] tracking-[0.14em] uppercase">
              {article.publishedAt ? (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" aria-hidden />
                  {article.publishedAt}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {article.readingTimeMinutes} min read
              </span>
            </div>

            {article.relatedProducts.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-steel-400 inline-flex items-center gap-1 font-mono text-[11px] tracking-[0.14em] uppercase">
                  <Package className="h-3.5 w-3.5" aria-hidden />
                  Applies to:
                </span>
                {article.relatedProducts.map((product) => (
                  <span
                    key={product}
                    className="border-steel-700 bg-bg-elevated text-steel-200 rounded-sm border px-2 py-0.5 font-mono text-[11px]"
                  >
                    {product}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Container>
      </Section>

      <Separator />

      {/* Article body + TOC */}
      <Section bg="base" spacing="default">
        <Container>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_14rem] xl:grid-cols-[1fr_16rem]">
            {/* Body */}
            <article aria-label={article.title} className="min-w-0">
              <p className="text-steel-100 mb-10 text-lg leading-relaxed font-medium">
                {article.excerpt}
              </p>

              {MDXContent ? (
                <div className="prose-ariot">
                  <MDXContent />
                </div>
              ) : (
                <p className="text-steel-400 font-mono text-sm">
                  This article has not been published yet.
                </p>
              )}

              <Separator className="my-10" />

              {/* Helpful feedback */}
              <Card variant="glass">
                <CardBody className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-steel-200 font-medium">Was this article helpful?</p>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm">
                      Yes, it helped
                    </Button>
                    <Button variant="ghost" size="sm">
                      No, I need more help
                    </Button>
                  </div>
                </CardBody>
              </Card>

              <div className="mt-10">
                <Button asChild variant="ghost">
                  <Link href="/support">
                    <ArrowLeft className="h-4 w-4" />
                    Back to support hub
                  </Link>
                </Button>
              </div>
            </article>

            {/* Sticky sidebar: TOC + contact */}
            <aside className="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
              <TableOfContents items={article.toc} />

              <Card>
                <CardBody className="flex flex-col gap-4 p-6">
                  <h2 className="text-steel-100 font-display text-lg font-semibold">
                    Still stuck?
                  </h2>
                  <p className="text-steel-300 text-sm">
                    If this article did not resolve your issue, our support team is here to help.
                  </p>
                  <Button asChild variant="primary">
                    <Link href="/contact">
                      <MessageCircle className="h-4 w-4" />
                      Contact support
                    </Link>
                  </Button>
                </CardBody>
              </Card>

              {article.relatedProducts.length > 0 && (
                <Card>
                  <CardBody className="flex flex-col gap-3 p-6">
                    <h2 className="text-steel-400 font-mono text-[11px] tracking-[0.18em] uppercase">
                      Related products
                    </h2>
                    <ul className="flex flex-col gap-2">
                      {article.relatedProducts.map((product) => (
                        <li key={product}>
                          <Link
                            href="/products"
                            className="text-steel-200 text-sm transition-colors duration-200 hover:text-cyan-400"
                          >
                            {product}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              )}
            </aside>
          </div>
        </Container>
      </Section>

      {/* Related articles */}
      {relatedArticles.length > 0 && (
        <Section bg="raised" spacing="default">
          <Container className="flex flex-col gap-12">
            <SectionHeader
              eyebrow="Related articles"
              title="More support resources"
              size="compact"
            />
            <FeatureGrid columns={2}>
              {relatedArticles.map((related) => (
                <FeatureCard
                  key={related.slug}
                  icon={related.icon}
                  eyebrow={`${related.category} · ${related.readingTimeMinutes} min`}
                  title={related.title}
                  description={related.excerpt}
                  href={`/support/article/${related.slug}`}
                  cta="Read article"
                />
              ))}
            </FeatureGrid>
          </Container>
        </Section>
      )}

      <CtaBand
        eyebrow="Open a ticket"
        title="Could not find what you needed?"
        subtitle="Describe the issue, the product, and the steps already tried. Our support team will respond within the service window."
        primary={{ label: 'Contact support', href: '/contact' }}
        secondary={{ label: 'Browse all articles', href: '/support' }}
      />
    </>
  );
}
