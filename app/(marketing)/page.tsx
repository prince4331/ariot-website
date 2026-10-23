import Link from 'next/link';
import type { Metadata } from 'next';
import Image from 'next/image';
import { ArrowRight, Bot, MapPin, Radio, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { CtaBand } from '@/components/marketing/cta-band';
import { FeatureCard } from '@/components/marketing/feature-card';
import { FeatureGrid } from '@/components/marketing/feature-grid';
import { HeroShell } from '@/components/marketing/hero-shell';
import { SectionHeader } from '@/components/marketing/section-header';
import { Organization } from '@/components/seo/organization';
import { WebSite } from '@/components/seo/website';
import { defineMetadata } from '@/lib/seo/metadata';
import { blogCategoryIcon } from '@/components/marketing/blog-category-icon';
import { safeGetLatestPublishedPosts } from '@/server/public/blog';
import { BLOG_TEASERS } from './_home-content';

export const metadata: Metadata = defineMetadata({
  title: 'Building the Robotics Ecosystem of Bangladesh',
  description:
    'ARIOT Technologies researches autonomous robotics, develops connected IoT products, and is building the engineering workspace and component supply for innovators in Bangladesh.',
  path: '/',
});

export const revalidate = 0;

export default async function HomePage() {
  // TASK 7 — homepage latest updates: the 3 newest published BlogPosts.
  // The page renders at request time (revalidate = 0) so the latest posts
  // are always read fresh from the database. With zero published posts the
  // section falls back to the static teaser cards below — an honest,
  // non-empty launch state (documented in docs/06_PROGRESS_LOG.md, L3).
  const latestPosts = await safeGetLatestPublishedPosts(3);
  const hasPosts = latestPosts.length > 0;

  return (
    <>
      <Organization />
      <WebSite />

      {/* 1 — Hero */}
      <HeroShell>
        <Section bg="base" spacing="default">
          <Container className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_0.85fr] lg:items-center">
            <div className="flex flex-col gap-8">
              <Badge variant="cyan">ARIOT Technologies · Bangladesh</Badge>

              <h1 className="text-steel-100 font-display text-4xl leading-[1.04] font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl lg:text-6xl xl:text-7xl">
                Engineering the future, right here{' '}
                <span className="text-cyan-400">in Bangladesh.</span>
              </h1>

              <p className="text-steel-200 max-w-2xl text-base sm:text-lg md:text-xl">
                We build autonomous robots, intelligent safety devices, and practical engineering
                solutions — turning local ideas into real-world technology.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Button asChild size="xl" variant="primary">
                  <Link href="/robotics">Explore our work</Link>
                </Button>
                <Button asChild size="xl" variant="secondary">
                  <Link href="/about">Meet ARIOT</Link>
                </Button>
              </div>

              <p className="text-steel-500 font-mono text-[11px] tracking-[0.18em] uppercase">
                Building the Robotics Ecosystem of Bangladesh.
              </p>

              <ul className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
                {[
                  {
                    title: 'Robotics',
                    subtitle: 'Autonomous systems',
                    icon: Bot,
                    href: '/robotics',
                  },
                  {
                    title: 'IoT Devices',
                    subtitle: 'Connected safety',
                    icon: Radio,
                    href: '/products/iot-home-safety-device',
                  },
                  {
                    title: 'Engineering Workspace',
                    subtitle: 'Planned maker space',
                    icon: Wrench,
                    href: '/workspace',
                  },
                  {
                    title: 'Local Impact',
                    subtitle: 'Built in Bangladesh',
                    icon: MapPin,
                    href: '/about',
                  },
                ].map(({ title, subtitle, icon: Icon, href }) => (
                  <li key={title}>
                    <Link
                      href={href}
                      className="group ease-out-quart focus-visible:ring-offset-bg-base flex flex-col gap-1.5 rounded-md transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 motion-reduce:transition-none"
                    >
                      <span className="bg-cyan-faint ease-out-quart group-hover:text-bg-base flex h-8 w-8 items-center justify-center rounded-md text-cyan-400 transition-colors duration-200 group-hover:bg-cyan-400 motion-reduce:transition-none">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="flex flex-col">
                        <span className="text-steel-100 text-sm font-semibold">{title}</span>
                        <span className="text-steel-400 text-[11px]">{subtitle}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right-side composition — compact overlapping product panels:
                large CleanBot card behind a smaller Gas Detector card. The
                image fills each card with an opaque label panel at the bottom. */}
            <div className="relative grid grid-cols-2 gap-4 lg:block lg:h-[500px]">
              <Link
                href="/robotics#cleanbot"
                className="group border-steel-700 bg-bg-raised ease-out-quart focus-visible:ring-offset-bg-base relative overflow-hidden rounded-2xl border transition-transform duration-300 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none max-lg:aspect-[4/5] lg:absolute lg:inset-y-0 lg:left-0 lg:w-[76%]"
              >
                <Image
                  src="/media/home/ariot-cleanbot-home.webp"
                  alt="ARIOT CleanBot — autonomous floor-cleaning robot"
                  fill
                  priority
                  sizes="(max-width: 1024px) 46vw, 38vw"
                  className="ease-out-quart object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transform-none motion-reduce:transition-none"
                />
                <div className="border-steel-800 bg-bg-elevated lg:bg-bg-elevated/95 lg:shadow-2 absolute inset-x-0 bottom-0 border-t px-4 py-3 lg:inset-x-3 lg:bottom-3 lg:rounded-xl lg:border lg:p-4 lg:backdrop-blur-md">
                  <p className="font-display text-steel-100 text-sm font-semibold sm:text-base">
                    ARIOT CleanBot
                  </p>
                  <p className="text-steel-300 text-xs sm:text-sm">
                    Autonomous floor-cleaning robot
                  </p>
                  <Badge variant="warning" className="mt-2 self-start">
                    Prototype development
                  </Badge>
                </div>
              </Link>

              <Link
                href="/products/iot-home-safety-device"
                className="group border-steel-700 bg-bg-raised ease-out-quart focus-visible:ring-offset-bg-base relative z-10 overflow-hidden rounded-xl border transition-transform duration-300 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none max-lg:aspect-[4/5] lg:absolute lg:top-5 lg:right-0 lg:h-[235px] lg:w-[55%]"
              >
                <Image
                  src="/media/home/ariot-gas-detector-home.webp"
                  alt="ARIOT Gas Detector — connected gas-safety monitoring device"
                  fill
                  sizes="(max-width: 1024px) 46vw, 28vw"
                  className="ease-out-quart object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transform-none motion-reduce:transition-none"
                />
                <div className="border-steel-800 bg-bg-elevated lg:bg-bg-elevated/95 lg:shadow-2 absolute inset-x-0 bottom-0 border-t p-3 lg:inset-x-3 lg:bottom-3 lg:rounded-xl lg:border lg:backdrop-blur-md">
                  <p className="font-display text-steel-100 text-sm font-semibold">
                    ARIOT Gas Detector
                  </p>
                  <p className="text-steel-300 text-xs">Connected gas-safety monitoring</p>
                  <Badge variant="warning" className="mt-1.5 self-start">
                    Pilot-stage development
                  </Badge>
                </div>
              </Link>
            </div>
          </Container>
        </Section>
      </HeroShell>

      {/* 3 — Who we are */}
      <Section bg="base" spacing="default">
        <Container>
          <div className="border-steel-800 grid grid-cols-1 gap-12 border-t pt-10 lg:grid-cols-[1fr_0.8fr] lg:gap-16 lg:pt-12">
            <div className="flex flex-col items-start gap-6">
              <p className="font-mono text-xs font-medium tracking-[0.18em] text-cyan-400 uppercase">
                WHO WE ARE
              </p>
              <h2 className="font-display text-steel-100 text-3xl leading-tight font-semibold tracking-tight text-balance md:text-4xl">
                From ideas to working technology.
              </h2>
              <p className="text-steel-200 max-w-xl text-base md:text-lg">
                ARIOT Technologies is a Bangladesh-based robotics and IoT engineering venture. We
                bring electronics, embedded systems, robotics, and software together to develop
                practical products for real-world needs.
              </p>
              <Button asChild variant="secondary">
                <Link href="/about">
                  Get to know ARIOT
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="flex flex-col">
              <p className="font-mono text-xs font-medium tracking-[0.18em] text-cyan-400 uppercase">
                HOW WE WORK
              </p>
              <ol className="divide-steel-800 flex flex-col divide-y">
                <li className="flex flex-col gap-1 py-5 first:pt-0 last:pb-0">
                  <span className="font-mono text-xs font-medium text-cyan-400">01</span>
                  <h3 className="font-display text-steel-100 text-base font-semibold">
                    Understand the problem
                  </h3>
                  <p className="text-steel-300 text-sm">
                    Start with practical challenges and real user needs.
                  </p>
                </li>
                <li className="flex flex-col gap-1 py-5 first:pt-0 last:pb-0">
                  <span className="font-mono text-xs font-medium text-cyan-400">02</span>
                  <h3 className="font-display text-steel-100 text-base font-semibold">
                    Engineer the solution
                  </h3>
                  <p className="text-steel-300 text-sm">
                    Build across hardware, firmware, and software.
                  </p>
                </li>
                <li className="flex flex-col gap-1 py-5 first:pt-0 last:pb-0">
                  <span className="font-mono text-xs font-medium text-cyan-400">03</span>
                  <h3 className="font-display text-steel-100 text-base font-semibold">
                    Prototype and improve
                  </h3>
                  <p className="text-steel-300 text-sm">Test, learn, and refine before scaling.</p>
                </li>
              </ol>
            </div>
          </div>
        </Container>
      </Section>

      {/* 4 — Featured products: concise previews, detailed stories on product pages */}
      <Section bg="raised" spacing="default">
        <Container className="flex flex-col gap-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="font-mono text-xs font-medium tracking-[0.18em] text-cyan-400 uppercase">
                WHAT WE ARE BUILDING
              </p>
              <h2 className="font-display text-steel-100 mt-3 text-3xl leading-tight font-semibold tracking-tight md:text-4xl">
                Real challenges. Thoughtful engineering.
              </h2>
              <p className="text-steel-300 mt-3 text-base md:text-lg">
                Meet two ARIOT products taking shape in Bangladesh.
              </p>
            </div>
            <Link
              href="/research"
              className="group focus-visible:ring-offset-bg-raised inline-flex w-fit items-center gap-2 rounded-sm text-sm font-semibold text-cyan-400 hover:underline focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2"
            >
              Explore our R&amp;D
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none"
                aria-hidden
              />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Link
              href="/robotics#cleanbot"
              className="group border-steel-700 bg-bg-base focus-visible:ring-offset-bg-raised hover:shadow-2 relative flex flex-col gap-6 rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none sm:p-8"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="bg-cyan-faint flex h-12 w-12 items-center justify-center rounded-xl text-cyan-400">
                  <Bot className="h-6 w-6" aria-hidden />
                </span>
                <Badge variant="warning">Prototype development</Badge>
              </div>
              <div className="flex flex-1 flex-col gap-3">
                <p className="text-steel-500 font-mono text-xs tracking-widest uppercase">
                  AUTONOMOUS ROBOTICS
                </p>
                <h3 className="font-display text-steel-100 text-2xl font-semibold md:text-3xl">
                  ARIOT CleanBot
                </h3>
                <p className="text-steel-300 max-w-md text-sm leading-relaxed md:text-base">
                  An autonomous floor-cleaning robot in development for large facilities — designed
                  to make repetitive cleaning easier to manage.
                </p>
              </div>
              <span className="flex items-center gap-2 text-sm font-semibold text-cyan-400">
                Discover CleanBot
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none"
                  aria-hidden
                />
              </span>
            </Link>
            <Link
              href="/products/iot-home-safety-device"
              className="group border-steel-700 bg-bg-base focus-visible:ring-offset-bg-raised hover:shadow-2 relative flex flex-col gap-6 rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none sm:p-8"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="bg-cyan-faint flex h-12 w-12 items-center justify-center rounded-xl text-cyan-400">
                  <Radio className="h-6 w-6" aria-hidden />
                </span>
                <Badge variant="warning">Pilot-stage development</Badge>
              </div>
              <div className="flex flex-1 flex-col gap-3">
                <p className="text-steel-500 font-mono text-xs tracking-widest uppercase">
                  CONNECTED SAFETY
                </p>
                <h3 className="font-display text-steel-100 text-2xl font-semibold md:text-3xl">
                  ARIOT Gas Detector
                </h3>
                <p className="text-steel-300 max-w-md text-sm leading-relaxed md:text-base">
                  A connected home gas-safety device with local alerts and mobile monitoring,
                  currently being prepared for pilot use.
                </p>
              </div>
              <span className="flex items-center gap-2 text-sm font-semibold text-cyan-400">
                Discover Gas Detector
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none"
                  aria-hidden
                />
              </span>
            </Link>
          </div>
        </Container>
      </Section>

      {/* 10 — Blog / innovation teaser (DB-backed latest updates) */}
      <Section bg="raised" spacing="default">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            eyebrow="From the lab"
            title="From our workbench"
            subhead={
              hasPosts
                ? 'A closer look at the ideas and prototypes we are developing.'
                : 'Build notes, engineering updates, and ideas from ARIOT.'
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
        subtitle="Have a robotics, IoT, or engineering challenge? Tell us what you are building."
        primary={{ label: 'Request a quote', href: '/quote' }}
        secondary={{ label: 'Contact ARIOT', href: '/contact' }}
      />
    </>
  );
}
