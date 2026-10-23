import Link from 'next/link';
import type { Metadata } from 'next';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { CtaBand } from '@/components/marketing/cta-band';
import { FeatureCard } from '@/components/marketing/feature-card';
import { FeatureGrid } from '@/components/marketing/feature-grid';
import { FeatureStack } from '@/components/marketing/feature-stack';
import { HeroShell } from '@/components/marketing/hero-shell';
import { LogoStrip } from '@/components/marketing/logo-strip';
import { MetricBand } from '@/components/marketing/metric-band';
import { SectionHeader } from '@/components/marketing/section-header';
import { Hero3DClient } from '@/components/three/hero-3d-client';
import { Organization } from '@/components/seo/organization';
import { WebSite } from '@/components/seo/website';
import { defineMetadata } from '@/lib/seo/metadata';
import { blogCategoryIcon } from '@/components/marketing/blog-category-icon';
import { safeGetLatestPublishedPosts } from '@/server/public/blog';
import {
  BLOG_TEASERS,
  BUSINESS_AREAS,
  CAPABILITIES,
  COMPONENT_TEASERS,
  ENGINEERING_FULL_LIST,
  ENGINEERING_PILLARS,
  METRICS,
  PRODUCTS,
  SOLUTIONS,
} from './_home-content';
import { CLEANBOT_TECH } from './robotics/_data';

export const metadata: Metadata = defineMetadata({
  title: 'Building the Robotics Ecosystem of Bangladesh',
  description:
    'ARIOT Technologies researches autonomous robotics, develops connected IoT products, and is building the engineering workspace and component supply for innovators across South Asia.',
  path: '/',
});

export default async function HomePage() {
  // TASK 7 — homepage latest updates: the 3 newest published BlogPosts.
  // The page remains static (indefinite ISR, refreshed via revalidatePath
  // from the admin blog routes). With zero published posts the section falls
  // back to the static teaser cards below — an honest, non-empty launch state
  // (documented in docs/06_PROGRESS_LOG.md, L3).
  const latestPosts = await safeGetLatestPublishedPosts(3);
  const hasPosts = latestPosts.length > 0;

  return (
    <>
      <Organization />
      <WebSite />

      {/* 1 — Hero */}
      <HeroShell>
        <Section bg="base" spacing="loose">
          <Container className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_0.7fr] lg:items-center">
            <div className="flex flex-col gap-8">
              <Badge variant="cyan">Robotics · IoT · Engineered in Bangladesh</Badge>

              <h1 className="text-steel-100 font-display max-w-4xl text-4xl leading-[1.04] font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl lg:text-7xl">
                Building the Robotics Ecosystem{' '}
                <span className="text-cyan-400">of Bangladesh.</span>
              </h1>

              <p className="text-steel-200 max-w-2xl text-base sm:text-lg md:text-xl">
                ARIOT Technologies researches autonomous robotics, develops connected IoT products,
                and is building the engineering workspace and component supply that local innovators
                need.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Button asChild size="xl" variant="primary">
                  <Link href="/quote">
                    Request a quote
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="xl" variant="secondary">
                  <Link href="/research">Explore R&amp;D</Link>
                </Button>
              </div>

              <div
                aria-hidden
                className="text-steel-500 flex items-center gap-3 font-mono text-[11px] tracking-[0.18em] uppercase"
              >
                <span className="bg-steel-700 h-px w-12" />
                Scroll
              </div>
            </div>

            {/* 3D hero — lazy-loaded, mobile fallback at < 768px.
                Wrapped in a relative container so the glass status card
                can overlay as an absolute-positioned panel. */}
            <div className="relative hidden h-[420px] overflow-hidden rounded-2xl md:block lg:h-[520px]">
              <Hero3DClient className="h-full w-full" />
              {/* Glass engineering status overlay — frames the 3D as a
                  live prototype, not a finished product. */}
              <div className="glass-panel absolute right-4 bottom-4 left-4 flex items-start gap-3 px-4 py-3">
                <span
                  className="mt-1 flex h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-400"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-steel-400 font-mono text-[10px] font-medium tracking-[0.16em] uppercase">
                    Active R&amp;D · Prototype stage
                  </p>
                  <p className="font-display text-steel-100 mt-0.5 truncate text-sm font-semibold">
                    Autonomous floor-cleaning system
                  </p>
                </div>
              </div>
            </div>
          </Container>
        </Section>
      </HeroShell>

      {/* 2 — Capability strip */}
      <Section bg="raised" spacing="compact">
        <Container>
          <LogoStrip eyebrow="What we do" items={CAPABILITIES} />
        </Container>
      </Section>

      {/* 3 — Business areas */}
      <Section bg="base" spacing="default">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            eyebrow="Business areas"
            title="Five directions, one ecosystem"
            subhead="From autonomous R&D to the workspace and components that support every builder in Bangladesh."
          />
          <FeatureGrid columns={3}>
            {BUSINESS_AREAS.map((area) => (
              <FeatureCard key={area.title} {...area} cta="Learn more" />
            ))}
          </FeatureGrid>
        </Container>
      </Section>

      {/* 4 — CleanBot flagship */}
      <Section bg="raised" spacing="default">
        <Container>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_0.85fr] lg:items-center">
            <div className="flex flex-col gap-6">
              <SectionHeader
                eyebrow="Flagship program"
                title="ARIOT CleanBot — the robot we are building first"
                subhead="A self-mapping, low-noise floor-cleaning robot designed for industrial and commercial floors."
              />
              <p className="text-steel-300 max-w-2xl text-base md:text-lg">
                CleanBot is our first autonomous platform. It learns the layout of a space, plans
                efficient cleaning routes, and returns to its charging dock — no tether, no
                dedicated operator. Repetitive floor cleaning consumes thousands of operator hours
                a year in offices, factories, and institutions across Bangladesh; CleanBot is
                engineered to take on that cycle from the ground up.
              </p>
              <ul className="flex flex-wrap gap-2">
                {CLEANBOT_TECH.map((chip) => (
                  <li
                    key={chip}
                    className="border-steel-700 bg-bg-elevated text-steel-200 rounded-sm border px-2 py-0.5 font-mono text-[11px]"
                  >
                    {chip}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="warning">Active R&amp;D · Prototype stage</Badge>
              </div>
              <p className="text-steel-300 max-w-2xl text-sm">
                CleanBot is in active prototype validation on real floors. We are not shipping
                units yet, and we will not take pre-orders until field trials clear.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="primary" size="lg">
                  <Link href="/robotics#cleanbot">
                    Meet CleanBot
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <Link href="/blog">Read the build log</Link>
                </Button>
              </div>
            </div>

            <div className="relative">
              <div className="border-steel-700 relative aspect-[4/5] w-full overflow-hidden rounded-xl border">
                <Image
                  src="/media/products/autonomous-floor-cleaning-robot/products-autonomous-floor-cleaning-robot-hero-01-4x5.svg"
                  alt="ARIOT CleanBot — autonomous floor-cleaning robot concept render"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 45vw"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: 'linear-gradient(180deg, transparent 55%, var(--bg-base) 100%)',
                  }}
                />
                <div className="glass-panel absolute right-4 bottom-4 left-4 flex items-start gap-3 px-4 py-3">
                  <span className="bg-cyan-400 mt-1 h-2.5 w-2.5 shrink-0 rounded-full" aria-hidden />
                  <div>
                    <p className="text-steel-400 font-mono text-[10px] font-medium tracking-[0.16em] uppercase">
                      Prototype · In active R&amp;D
                    </p>
                    <p className="font-display text-steel-100 mt-0.5 text-sm font-semibold">
                      CleanBot — mapping a real floor
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* 5 — R&D and engineering proof */}
      <Section bg="raised" spacing="default">
        <Container className="flex flex-col gap-16 md:gap-20">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <SectionHeader
              eyebrow="Research & development"
              title="Real engineering across the stack"
              subhead="From the embedded board to the cloud dashboard — we own the full chain and test in real conditions."
            />
            <Button asChild variant="ghost" className="shrink-0">
              <Link href="/research">
                View all R&amp;D
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <FeatureStack items={ENGINEERING_PILLARS} />
          <ul
            aria-label="All engineering capabilities"
            className="border-steel-800 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t pt-8"
          >
            {ENGINEERING_FULL_LIST.map((item) => (
              <li
                key={item}
                className="text-steel-300 font-mono text-[11px] tracking-[0.18em] uppercase"
              >
                · {item}
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* 6 — Robotics workspace */}
      <Section bg="base" spacing="default">
        <Container>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div className="flex flex-col gap-6">
              <SectionHeader
                eyebrow="Planned initiative"
                title="A shared engineering space for Bangladesh builders"
                subhead="We are building a robotics co-working workspace for students, engineers, and research teams who need proper bench space, tools, and a technical community."
              />
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="primary" size="lg">
                  <Link href="/workspace">
                    About the workspace
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <Link href="/contact">Register interest</Link>
                </Button>
              </div>
            </div>
            <div className="border-steel-700 bg-bg-raised flex flex-col gap-4 rounded-xl border p-6">
              <h3 className="text-steel-100 font-display text-base font-semibold">
                Planned facilities
              </h3>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
                {[
                  'Electronics workbench',
                  'Soldering station',
                  'Bench power supplies',
                  'Hand & assembly tools',
                  'Meeting area',
                  'High-speed internet',
                  'Engineering support',
                  'Robot assembly space',
                ].map((f) => (
                  <li key={f} className="text-steel-200 flex items-center gap-2 text-sm">
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-400"
                    />
                    {f}
                  </li>
                ))}
              </ul>
              <Badge variant="warning">Opening details to be announced</Badge>
            </div>
          </div>
        </Container>
      </Section>

      {/* 7 — Components and electronics */}
      <Section bg="raised" spacing="default">
        <Container className="flex flex-col gap-12">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <SectionHeader
              eyebrow="Store in development"
              title="Electronics and robotics components"
              subhead="We are building a components supply for development boards, sensors, motors, and IoT modules — available for request now, online ordering coming later."
            />
            <Button asChild variant="ghost" className="shrink-0">
              <Link href="/components">
                Browse components
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <FeatureGrid columns={4}>
            {COMPONENT_TEASERS.map((cat) => (
              <FeatureCard key={cat.title} {...cat} cta="Explore" />
            ))}
          </FeatureGrid>
        </Container>
      </Section>

      {/* 8 — IoT products and solutions */}
      <Section bg="base" spacing="default">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            eyebrow="Products"
            title="IoT products and robotics systems in development"
            subhead="Our current product line — from early concept to prototype validation. Status labels reflect where each product actually stands."
          />
          <FeatureGrid columns={4}>
            {PRODUCTS.map((product) => (
              <FeatureCard key={product.title} {...product} cta="View details" />
            ))}
          </FeatureGrid>
          <div>
            <Button asChild variant="ghost">
              <Link href="/products">
                View all products
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Container>
      </Section>

      {/* Solutions sub-section */}
      <Section bg="raised" spacing="default">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            eyebrow="Where it deploys"
            title="Engineered for the spaces South Asia actually uses"
            subhead="From single homes to small factory floors — hardware designed for the environment, not just the demo."
          />
          <FeatureGrid columns={3}>
            {SOLUTIONS.map((solution) => (
              <FeatureCard key={solution.title} {...solution} cta="See solution" />
            ))}
          </FeatureGrid>
        </Container>
      </Section>

      {/* 9 — Status metrics */}
      <Section bg="base" spacing="default">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            eyebrow="Where we stand"
            title="Honest status indicators"
            subhead="We use status labels, not invented statistics. Numbers will appear when we have verified evidence to share."
            size="compact"
          />
          <MetricBand metrics={METRICS} />
        </Container>
      </Section>

      {/* 10 — Blog / innovation teaser (DB-backed latest updates) */}
      <Section bg="raised" spacing="default">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            eyebrow="From the lab"
            title={hasPosts ? 'Latest from the workbench' : 'Notes from the workbench'}
            subhead={
              hasPosts
                ? 'The newest published engineering notes — build logs, R&D findings, and field reports.'
                : 'Field reports, R&D logs, and tutorials from the ARIOT engineering team.'
            }
          />
          <FeatureGrid columns={3}>
            {(hasPosts
              ? latestPosts.map((post) => {
                  const Icon = blogCategoryIcon(post.categorySlug);
                  return {
                    key: post.slug,
                    icon: Icon,
                    eyebrow: `${post.categoryName} · ${post.readingTimeMinutes} min`,
                    title: post.title,
                    description: post.excerpt ?? '',
                    href: `/blog/${post.slug}`,
                    cta: 'Read on',
                  };
                })
              : BLOG_TEASERS.map((post) => ({ key: post.title, ...post }))
            ).map(({ key, ...card }) => (
              <FeatureCard key={key} {...card} />
            ))}
          </FeatureGrid>
        </Container>
      </Section>

      {/* 11 — Final CTA band */}
      <CtaBand
        eyebrow="Get involved"
        title="Build something real with us"
        subtitle="Whether it is a quote request, a workspace enquiry, a component order, or a research collaboration — get in touch and we will route you to the right person."
        primary={{ label: 'Request a quote', href: '/quote' }}
        secondary={{ label: 'Contact ARIOT', href: '/contact' }}
      />
    </>
  );
}
