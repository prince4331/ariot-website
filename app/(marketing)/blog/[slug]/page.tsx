import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CtaBand } from '@/components/marketing/cta-band';
import { FeatureCard } from '@/components/marketing/feature-card';
import { FeatureGrid } from '@/components/marketing/feature-grid';
import { SectionHeader } from '@/components/marketing/section-header';
import { TableOfContents } from '@/components/marketing/table-of-contents';
import { BlogMarkdown } from '@/components/marketing/blog-markdown';
import { blogCategoryIcon } from '@/components/marketing/blog-category-icon';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { Separator } from '@/components/ui/separator';
import { BreadcrumbList } from '@/components/seo/breadcrumb-list';
import { BlogPosting } from '@/components/seo/blog-posting';
import { defineMetadata, defineBlogMetadata } from '@/lib/seo/metadata';
import { formatDate } from '@/lib/utils/format-date';
import { extractMarkdownHeadings } from '@/lib/utils/markdown-toc';
import {
  getPublishedPostBySlug,
  getPublishedPostsByCategory,
  listPublishedPosts,
  type PublicBlogPostDetail,
  type PublicBlogPostListItem,
} from '@/server/public/blog';

/**
 * /blog/[slug] — DB-backed blog detail (L3 Minimal Marketing CMS).
 *
 * Visibility: the query layer returns PUBLISHED, non-deleted posts with a
 * published category only. Anything else (draft, archived, soft-deleted,
 * unknown slug) renders notFound() — drafts are never exposed publicly.
 *
 * Render strategy: the page is rendered at request time (`revalidate = 0`)
 * so the published post is always read fresh from the database. This
 * prevents the empty build-time prerender from being served indefinitely
 * when the Docker image is built without database access (issue I-034).
 * `dynamicParams = true` allows any slug to be resolved on demand.
 * Admin mutations invalidate the tagged public reads so subsequent
 * requests reflect the change immediately.
 */

export const revalidate = 0;
export const dynamicParams = true;

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  try {
    const posts = await listPublishedPosts({ limit: 50 });
    return posts.map((post) => ({ slug: post.slug }));
  } catch {
    // Build without a reachable database: no slugs prerendered; the rest
    // are handled on demand via dynamicParams.
    return [];
  }
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    return defineMetadata({
      title: 'Post not found',
      description: 'The requested blog post could not be found.',
      path: `/blog/${slug}`,
      noindex: true,
    });
  }

  return defineBlogMetadata({
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt ?? post.title,
    path: `/blog/${post.slug}`,
    author: post.authorName,
    publishedTime: post.publishedAt ?? undefined,
    modifiedTime: post.updatedAt,
    tags: post.tags,
  });
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const categoryPosts = await getPublishedPostsByCategory(post.categorySlug, 3);
  const related = categoryPosts.filter((p) => p.slug !== post.slug).slice(0, 2);
  const tocItems = extractMarkdownHeadings(post.body);
  const Icon = blogCategoryIcon(post.categorySlug);

  return <BlogDetailView post={post} related={related} tocItems={tocItems} Icon={Icon} />;
}

interface BlogDetailViewProps {
  post: PublicBlogPostDetail;
  related: ReadonlyArray<PublicBlogPostListItem>;
  tocItems: ReadonlyArray<{ id: string; text: string }>;
  Icon: LucideIcon;
}

function BlogDetailView({ post, related, tocItems, Icon }: BlogDetailViewProps) {
  return (
    <>
      <BlogPosting
        headline={post.title}
        description={post.excerpt ?? post.title}
        image={post.ogImageUrl ?? post.coverUrl ?? undefined}
        datePublished={post.publishedAt ?? undefined}
        dateModified={post.updatedAt}
        url={`/blog/${post.slug}`}
        author={[post.authorName]}
        tags={[...post.tags]}
      />
      <BreadcrumbList
        items={[
          { name: 'Home', url: '/' },
          { name: 'Blog', url: '/blog' },
          { name: post.categoryName, url: '/blog' },
          { name: post.title, url: `/blog/${post.slug}` },
        ]}
      />

      {/* Header */}
      <Section bg="base" spacing="default">
        <Container>
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            <div className="flex flex-wrap items-center gap-4">
              <span className="bg-cyan-faint inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 px-3 py-1 font-mono text-[11px] tracking-[0.14em] text-cyan-400 uppercase">
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {post.categoryName}
              </span>
              {post.isLab && (
                <span className="border-steel-700 text-steel-300 inline-flex items-center rounded-full border px-3 py-1 font-mono text-[11px] tracking-[0.14em] uppercase">
                  R&amp;D Lab
                </span>
              )}
            </div>
            <h1 className="text-steel-100 font-display text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-4xl md:text-5xl">
              {post.title}
            </h1>
            <div className="text-steel-400 flex flex-wrap items-center gap-5 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-6 w-6 rounded-full bg-cyan-400/80" aria-hidden />
                {post.authorName}
              </span>
              {post.publishedAt && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" aria-hidden />
                  <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {post.readingTimeMinutes} min read
              </span>
            </div>
          </div>
        </Container>
      </Section>

      {/* Body + TOC */}
      <Section bg="base" spacing="default">
        <Container>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_14rem] xl:grid-cols-[1fr_16rem]">
            <article aria-label={post.title} className="min-w-0">
              {post.excerpt && (
                <p className="text-steel-100 mb-10 text-lg leading-relaxed font-medium sm:text-xl">
                  {post.excerpt}
                </p>
              )}

              <BlogMarkdown body={post.body} />

              <Separator className="my-12" />

              {/* Author bio */}
              <Card variant="glass">
                <CardBody className="flex items-start gap-4 p-6">
                  <div
                    role="img"
                    aria-label={`${post.authorName} avatar placeholder`}
                    className="border-steel-700 bg-bg-base h-12 w-12 flex-shrink-0 rounded-full border"
                  />
                  <div>
                    <p className="text-steel-100 font-display font-semibold">{post.authorName}</p>
                    <p className="text-steel-300 mt-2 text-sm">
                      [Author bio pending — will appear once engineering team profiles are
                      approved.]
                    </p>
                  </div>
                </CardBody>
              </Card>

              <div className="mt-10">
                <Button asChild variant="ghost">
                  <Link href="/blog">
                    <ArrowLeft className="h-4 w-4" />
                    Back to blog
                  </Link>
                </Button>
              </div>
            </article>

            {/* Sticky TOC sidebar */}
            {tocItems.length > 0 && (
              <aside className="lg:sticky lg:top-28 lg:self-start">
                <TableOfContents items={tocItems} />
              </aside>
            )}
          </div>
        </Container>
      </Section>

      {/* Related posts */}
      {related.length > 0 && (
        <Section bg="raised" spacing="default">
          <Container className="flex flex-col gap-12">
            <SectionHeader
              eyebrow="Keep reading"
              title="Related engineering notes"
              size="compact"
            />
            <FeatureGrid columns={2}>
              {related.map((relatedPost) => {
                const RelatedIcon = blogCategoryIcon(relatedPost.categorySlug);
                return (
                  <FeatureCard
                    key={relatedPost.slug}
                    icon={RelatedIcon}
                    eyebrow={`${relatedPost.categoryName} · ${relatedPost.readingTimeMinutes} min`}
                    title={relatedPost.title}
                    description={relatedPost.excerpt ?? ''}
                    href={`/blog/${relatedPost.slug}`}
                    cta="Read"
                  />
                );
              })}
            </FeatureGrid>
          </Container>
        </Section>
      )}

      <CtaBand
        eyebrow="Newsletter"
        title="Get engineering notes when they ship"
        subtitle="Build logs and field notes from the ARIOT team — sent only when there is something worth reading."
        primary={{ label: 'Subscribe', href: '/blog' }}
        secondary={{ label: 'Browse all posts', href: '/blog' }}
      />
    </>
  );
}
