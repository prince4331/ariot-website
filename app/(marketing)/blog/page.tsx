import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { ArrowRight, Calendar, Clock } from 'lucide-react';
import { FeatureCard } from '@/components/marketing/feature-card';
import { FeatureGrid } from '@/components/marketing/feature-grid';
import { HeroShell } from '@/components/marketing/hero-shell';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { NewsletterForm } from '@/features/forms/newsletter-form';
import { BreadcrumbList } from '@/components/seo/breadcrumb-list';
import { defineMetadata } from '@/lib/seo/metadata';
import { blogCategoryIcon } from '@/components/marketing/blog-category-icon';
import { formatDate } from '@/lib/utils/format-date';
import { safeListPublishedPosts } from '@/server/public/blog';

/**
 * /blog — DB-backed blog listing (L3 Minimal Marketing CMS).
 *
 * Render strategy (TASK 18): the page is statically prerendered with an
 * indefinite ISR cache (`revalidate = false`) and refreshed on demand via
 * `revalidatePath` from the admin blog mutation API routes — newly published
 * posts appear without a rebuild, and nothing goes stale indefinitely.
 * Only PUBLISHED, non-deleted posts with a published category are returned
 * by the query layer; with zero posts the page renders an honest empty state.
 */

export const revalidate = false;

export const metadata: Metadata = defineMetadata({
  title: 'Blog — engineering notes',
  description:
    'Read ARIOT engineering notes, robotics R&D logs, IoT deployment thinking, and tutorials for South Asian hardware teams.',
  path: '/blog',
});

export default async function BlogPage() {
  const posts = await safeListPublishedPosts({ limit: 50 });
  const [featured, ...rest] = posts;

  return (
    <>
      <BreadcrumbList
        items={[
          { name: 'Home', url: '/' },
          { name: 'Blog', url: '/blog' },
        ]}
      />
      <HeroShell>
        <Section bg="base" spacing="loose">
          <Container className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div className="flex flex-col gap-6">
              <p className="font-mono text-[12px] font-medium tracking-[0.18em] text-cyan-400 uppercase">
                Blog
              </p>
              <div>
                <h1 className="text-steel-100 font-display text-4xl leading-[1.04] font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
                  Notes from the engineering floor
                </h1>
                <p className="text-steel-200 mt-5 max-w-2xl text-base sm:text-lg md:text-xl">
                  Build logs, field notes, and practical tutorials from ARIOT robotics and IoT work.
                  Published when there is something real to share.
                </p>
              </div>
              {featured && (
                <Button asChild size="xl" variant="primary" className="w-fit">
                  <Link href={`/blog/${featured.slug}`}>
                    Read featured post
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>

            {featured ? (
              <Card variant="glass">
                <CardBody className="p-6 md:p-8">
                  <p className="font-mono text-[11px] tracking-[0.18em] text-cyan-400 uppercase">
                    {featured.categoryName} · {featured.readingTimeMinutes} min
                  </p>
                  <h2 className="text-steel-100 font-display mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
                    {featured.title}
                  </h2>
                  <p className="text-steel-300 mt-4 text-base">{featured.excerpt}</p>
                  <div className="text-steel-400 mt-6 flex flex-wrap gap-4 font-mono text-[11px] tracking-[0.14em] uppercase">
                    {featured.publishedAt && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(featured.publishedAt)}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {featured.readingTimeMinutes} min read
                    </span>
                  </div>
                  <Button asChild variant="ghost" className="mt-6">
                    <Link href={`/blog/${featured.slug}`}>
                      Read the note
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardBody>
              </Card>
            ) : (
              <Card variant="glass">
                <CardBody className="p-6 md:p-8">
                  <p className="font-mono text-[11px] tracking-[0.18em] text-cyan-400 uppercase">
                    Nothing published yet
                  </p>
                  <h2 className="text-steel-100 font-display mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
                    Engineering notes are in progress
                  </h2>
                  <p className="text-steel-300 mt-4 text-base">
                    The first build logs and field notes are being written and reviewed. They will
                    appear here — and on the homepage, Robotics, and Research sections — as soon as
                    they are approved for publication.
                  </p>
                </CardBody>
              </Card>
            )}
          </Container>
        </Section>
      </HeroShell>

      {rest.length > 0 && (
        <Section bg="raised" spacing="default">
          <Container className="flex flex-col gap-12">
            <div className="text-center">
              <p className="font-mono text-[12px] font-medium tracking-[0.18em] text-cyan-400 uppercase">
                All notes
              </p>
              <h2 className="text-steel-100 font-display mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
                Everything published so far
              </h2>
              <p className="text-steel-300 mx-auto mt-4 max-w-2xl text-base">
                Published when there is genuine engineering insight to share — not on a
                content-marketing schedule.
              </p>
            </div>
            <FeatureGrid columns={3}>
              {rest.map((post) => {
                const Icon = blogCategoryIcon(post.categorySlug);
                return (
                  <FeatureCard
                    key={post.slug}
                    icon={Icon}
                    eyebrow={`${post.categoryName} · ${post.readingTimeMinutes} min`}
                    title={post.title}
                    description={post.excerpt ?? ''}
                    href={`/blog/${post.slug}`}
                    cta="Read"
                  />
                );
              })}
            </FeatureGrid>
          </Container>
        </Section>
      )}

      <Section bg="raised" spacing="default">
        <Container>
          <Card variant="glass">
            <CardBody className="grid grid-cols-1 gap-8 p-6 md:p-8 lg:grid-cols-[0.7fr_1fr] lg:items-center">
              <div className="border-steel-700 relative aspect-video overflow-hidden rounded-lg border">
                <Image
                  src="/media/blog/blog-build-log-feature-01-16x9.svg"
                  alt="Build log — workbench session"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: 'linear-gradient(180deg, transparent 50%, var(--bg-base) 100%)',
                  }}
                />
              </div>
              <div>
                <p className="font-mono text-[11px] tracking-[0.18em] text-cyan-400 uppercase">
                  Build logs
                </p>
                <h2 className="text-steel-100 font-display mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                  Longer-form engineering content coming
                </h2>
                <p className="text-steel-300 mt-4 text-base">
                  Build logs, teardowns, and tutorial series will be published here as ARIOT
                  production and lab work produces content worth sharing in depth.
                </p>
              </div>
            </CardBody>
          </Card>
        </Container>
      </Section>

      <Section bg="raised" spacing="default" className="relative isolate overflow-hidden">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 50% 0%, var(--cyan-faint) 0%, transparent 60%)',
          }}
        />
        <Container>
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
            <p className="font-mono text-[12px] font-medium tracking-[0.18em] text-cyan-400 uppercase">
              Newsletter
            </p>
            <h2 className="text-steel-100 font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-5xl">
              Get engineering notes when they ship
            </h2>
            <p className="text-steel-300 max-w-xl text-base sm:text-lg">
              Build logs, IoT field notes, and the occasional teardown — sent only when there is
              something engineered worth reading.
            </p>
            <NewsletterForm source="blog" variant="inline" className="mt-2 w-full max-w-lg" />
          </div>
        </Container>
      </Section>
    </>
  );
}
