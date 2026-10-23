import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Breadcrumb } from '@/components/marketing/breadcrumb';
import { CtaBand } from '@/components/marketing/cta-band';
import { FeatureCard } from '@/components/marketing/feature-card';
import { FeatureGrid } from '@/components/marketing/feature-grid';
import { FeatureStack } from '@/components/marketing/feature-stack';
import { HeroShell } from '@/components/marketing/hero-shell';
import { MetricBand } from '@/components/marketing/metric-band';
import { SectionHeader } from '@/components/marketing/section-header';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { BreadcrumbList } from '@/components/seo/breadcrumb-list';
import { Service } from '@/components/seo/service';
import { defineMetadata, defineSolutionMetadata } from '@/lib/seo/metadata';
import { SOLUTIONS, getSolutionBySlug } from '@/features/solutions/_data';
import { PRODUCTS } from '@/app/(marketing)/products/_data';

interface SolutionPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return SOLUTIONS.map((solution) => ({ slug: solution.slug }));
}

export async function generateMetadata({ params }: SolutionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const solution = getSolutionBySlug(slug);

  if (!solution) {
    return defineMetadata({
      title: 'Solution not found',
      description: 'The requested ARIOT solution could not be found.',
      path: `/solutions/${slug}`,
      noindex: true,
    });
  }

  return defineSolutionMetadata({
    title: solution.name,
    description: solution.description,
    path: `/solutions/${slug}`,
    industry: solution.industry,
  });
}

export default async function SolutionDetailPage({ params }: SolutionPageProps) {
  const { slug } = await params;
  const solution = getSolutionBySlug(slug);

  if (!solution) {
    notFound();
  }

  const SolutionIcon = solution.icon;
  const relatedProducts = PRODUCTS.filter((p) => solution.relatedProductSlugs.includes(p.slug));

  return (
    <>
      <Service
        name={solution.name}
        description={solution.description}
        url={`/solutions/${solution.slug}`}
        category={solution.industry}
        areaServed={['Bangladesh', 'South Asia']}
        hasOfferCatalog={solution.relatedProductSlugs.map(
          (slug) => PRODUCTS.find((p) => p.slug === slug)?.title ?? slug,
        )}
      />
      <BreadcrumbList
        items={[
          { name: 'Home', url: '/' },
          { name: 'Solutions', url: '/solutions' },
          { name: solution.name, url: `/solutions/${solution.slug}` },
        ]}
      />

      <HeroShell>
        <Section bg="base" spacing="loose">
          <Container className="flex flex-col gap-8">
            <Breadcrumb
              items={[
                { label: 'Home', href: '/' },
                { label: 'Solutions', href: '/solutions' },
                { label: solution.name },
              ]}
            />
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_auto] lg:items-start">
              <div className="flex max-w-4xl flex-col gap-6">
                <div className="inline-flex items-center gap-3">
                  <span
                    aria-hidden
                    className="bg-cyan-faint inline-flex h-12 w-12 items-center justify-center rounded-lg text-cyan-400"
                  >
                    <SolutionIcon className="h-6 w-6" />
                  </span>
                  <p className="text-steel-400 font-mono text-[11px] tracking-[0.18em] uppercase">
                    {solution.industry}
                  </p>
                </div>
                <h1 className="text-steel-100 font-display text-4xl leading-[1.04] font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
                  {solution.name}
                </h1>
                <p className="text-steel-200 max-w-2xl text-base sm:text-lg md:text-xl">
                  {solution.tagline}
                </p>
                <p className="text-steel-300 max-w-2xl text-base">{solution.description}</p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button asChild size="lg" variant="primary">
                    <Link href="/quote">
                      Request a quote
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="secondary">
                    <Link href="/contact">Talk to an engineer</Link>
                  </Button>
                </div>
              </div>
            </div>
          </Container>
        </Section>
      </HeroShell>

      {solution.stats.length > 0 && (
        <Section bg="raised" spacing="compact">
          <Container>
            <MetricBand
              metrics={solution.stats.map((s) => ({
                value: s.value,
                label: s.label,
              }))}
            />
          </Container>
        </Section>
      )}

      <Section bg="base" spacing="default">
        <Container className="flex flex-col gap-16">
          <SectionHeader
            eyebrow="How it works"
            title="The approach that makes it field-reliable"
            subhead="Approach details are refined as deployment evidence is approved for publication."
          />
          <FeatureStack
            items={solution.approach.map((item) => ({
              eyebrow: item.eyebrow,
              title: item.title,
              description: item.description,
              chips: [...item.chips],
            }))}
          />
        </Container>
      </Section>

      <Section bg="raised" spacing="default">
        <Container className="flex flex-col gap-8">
          <SectionHeader
            eyebrow="Technology stack"
            title="Components that make it work"
            subhead="Stack items are indicative — final selections depend on project requirements."
            size="compact"
          />
          <ul className="flex flex-wrap gap-3">
            {solution.techStack.map((item) => (
              <li
                key={item}
                className="border-steel-700 bg-bg-elevated text-steel-200 rounded-md border px-4 py-2 font-mono text-sm"
              >
                {item}
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section bg="base" spacing="default">
        <Container>
          <Card variant="glass">
            <CardBody className="grid grid-cols-1 gap-8 p-6 md:p-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
              <div>
                <p className="font-mono text-[11px] tracking-[0.18em] text-cyan-400 uppercase">
                  Case studies
                </p>
                <h2 className="text-steel-100 font-display mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                  Real {solution.name} deployments will be published here
                </h2>
                <p className="text-steel-300 mt-4 max-w-2xl text-base">
                  A full deployment narrative — problem, approach, environment, and measured outcome — will appear here once an approved case study is ready.
                </p>
              </div>
              <div className="border-steel-700 relative aspect-video overflow-hidden rounded-lg border">
                <Image
                  src="/media/solutions/solutions-custom-rd-scene-01-16x9.svg"
                  alt={`${solution.name} case study illustration`}
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
            </CardBody>
          </Card>
        </Container>
      </Section>

      {relatedProducts.length > 0 && (
        <Section bg="raised" spacing="default">
          <Container className="flex flex-col gap-12">
            <SectionHeader
              eyebrow="Related products"
              title="Hardware paths for this solution"
              subhead="Product cards link to individual detail pages."
            />
            <FeatureGrid columns={3}>
              {relatedProducts.map((product) => (
                <FeatureCard
                  key={product.slug}
                  icon={product.icon}
                  eyebrow={product.status}
                  title={product.title}
                  description={product.description}
                  chips={product.chips}
                  href={`/products/${product.slug}`}
                  cta="View product"
                />
              ))}
            </FeatureGrid>
          </Container>
        </Section>
      )}

      <CtaBand
        eyebrow={solution.name}
        title={`Start with a ${solution.name} scoping session`}
        subtitle="Describe your site, constraints, and target outcome — we will map the right first practical step."
        primary={{ label: 'Request a quote', href: '/quote' }}
        secondary={{ label: 'Contact sales', href: '/contact' }}
      />
    </>
  );
}
