import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { CtaBand } from '@/components/marketing/cta-band';
import { FeatureCard } from '@/components/marketing/feature-card';
import { FeatureGrid } from '@/components/marketing/feature-grid';
import { HeroShell } from '@/components/marketing/hero-shell';
import { SectionHeader } from '@/components/marketing/section-header';
import { Timeline } from '@/components/marketing/timeline';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { BreadcrumbList } from '@/components/seo/breadcrumb-list';
import { Organization } from '@/components/seo/organization';
import { defineMetadata } from '@/lib/seo/metadata';
import { blogCategoryIcon } from '@/components/marketing/blog-category-icon';
import { safeGetPublishedPostsByCategory } from '@/server/public/blog';
import { CLEANBOT_TECH, ROBOTICS_FUTURE_LINES, ROBOTICS_ROADMAP, ROBOTICS_TECH } from './_data';

export const metadata: Metadata = defineMetadata({
  title: 'Autonomous Robotics',
  description:
    'ARIOT engineers autonomous robots with ROS 2, LiDAR SLAM, sensor fusion, AI vision, and autonomous navigation — built and validated for real environments in Bangladesh.',
  path: '/robotics',
});
export const revalidate = 0;

export default async function RoboticsPage() {
  // TASK 8 — Robotics updates: published posts in the Robotics R&D category.
  // Section is omitted entirely when no matching posts exist (honest empty).
  const roboticsUpdates = await safeGetPublishedPostsByCategory('robotics-rd', 3);

  return (
    <>
      <Organization />
      <BreadcrumbList
        items={[
          { name: 'Home', url: '/' },
          { name: 'Robotics', url: '/robotics' },
        ]}
      />

      {/* Hero */}
      <HeroShell>
        <Section bg="base" spacing="loose">
          <Container className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_0.7fr] lg:items-center">
            <div className="flex flex-col gap-8">
              <Badge variant="cyan">Robotics · R&amp;D · Engineered in Bangladesh</Badge>
              <h1 className="text-steel-100 font-display max-w-4xl text-4xl leading-[1.04] font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl lg:text-7xl">
                ARIOT Autonomous <span className="text-cyan-400">Robotics.</span>
              </h1>
              <p className="text-steel-200 max-w-2xl text-base sm:text-lg md:text-xl">
                We build autonomous machines that work on real floors and real factory aisles —
                engineered around ROS 2, LiDAR SLAM, sensor fusion, and honest field validation.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild size="xl" variant="primary">
                  <Link href="#cleanbot">
                    Meet CleanBot
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

            {/* Engineering status panel */}
            <Card variant="glass">
              <CardBody className="flex h-full flex-col gap-5 p-6 md:p-8">
                <p className="font-mono text-[11px] tracking-[0.18em] text-cyan-400 uppercase">
                  Where the work stands
                </p>
                <ul className="flex flex-col gap-4">
                  {[
                    {
                      label: 'Autonomy stack',
                      value: 'Active development on ROS 2',
                    },
                    {
                      label: 'Flagship robot',
                      value: 'CleanBot — prototype stage',
                    },
                    {
                      label: 'Validation',
                      value: 'On-floor testing in progress',
                    },
                    {
                      label: 'Availability',
                      value: 'Not for sale until pilots clear',
                    },
                  ].map((row) => (
                    <li
                      key={row.label}
                      className="border-steel-800 flex flex-col gap-1 border-b pb-4 last:border-b-0 last:pb-0"
                    >
                      <span className="text-steel-400 font-mono text-[10px] tracking-[0.16em] uppercase">
                        {row.label}
                      </span>
                      <span className="text-steel-100 text-sm font-medium">{row.value}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </Container>
        </Section>
      </HeroShell>

      {/* Technology stack */}
      <Section bg="base" spacing="default">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            eyebrow="Technology"
            title="The autonomy stack we build on"
            subhead="Autonomy is a stack, not a feature. These are the layers our robots are engineered on — from sensing to planning to machine-level intelligence."
          />
          <FeatureGrid columns={3}>
            {ROBOTICS_TECH.map((tech) => (
              <FeatureCard
                key={tech.title}
                icon={tech.icon}
                eyebrow={tech.eyebrow}
                title={tech.title}
                description={tech.description}
                chips={tech.chips}
              />
            ))}
          </FeatureGrid>
        </Container>
      </Section>
      {/* Flagship — CleanBot */}
      <Section id="cleanbot" bg="raised" spacing="default">
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
                dedicated operator. Repetitive floor cleaning consumes thousands of operator hours a
                year in offices, factories, and institutions across Bangladesh; CleanBot is
                engineered to take on that cycle.
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
                CleanBot is in active prototype validation on real floors. We are not shipping units
                yet, and we will not take pre-orders until field trials clear.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="primary" size="lg">
                  <Link href="/quote">
                    Request a quote
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
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-400"
                    aria-hidden
                  />
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

      {/* Roadmap */}
      <Section bg="base" spacing="default">
        <Container className="grid grid-cols-1 gap-10 lg:grid-cols-[0.8fr_1fr] lg:items-start">
          <SectionHeader
            eyebrow="Roadmap"
            title="From bench prototype to field-ready machine"
            subhead="Each stage has an exit criterion. Nothing ships to customers until the previous stage is met."
            size="compact"
          />
          <Timeline items={ROBOTICS_ROADMAP} />
        </Container>
      </Section>
      {/* Future lines */}
      <Section bg="raised" spacing="default">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            eyebrow="Future directions"
            title="The robotics lines we are planning"
            subhead="These are planned directions, not commitments. They will open up as the core CleanBot platform matures."
          />
          <FeatureGrid columns={3}>
            {ROBOTICS_FUTURE_LINES.map((line) => (
              <FeatureCard
                key={line.title}
                icon={line.icon}
                eyebrow={line.eyebrow}
                title={line.title}
                description={line.description}
                chips={line.chips}
              />
            ))}
          </FeatureGrid>
        </Container>
      </Section>

      {/* Latest robotics updates (DB-backed) */}
      {roboticsUpdates.length > 0 && (
        <Section bg="base" spacing="default">
          <Container className="flex flex-col gap-12">
            <SectionHeader
              eyebrow="Build log"
              title="Latest robotics updates"
              subhead="Development logs, navigation testing, and field validation notes — published as the work happens."
            />
            <FeatureGrid columns={3}>
              {roboticsUpdates.map((post) => {
                const Icon = blogCategoryIcon(post.categorySlug);
                return (
                  <FeatureCard
                    key={post.slug}
                    icon={Icon}
                    eyebrow={`${post.categoryName} · ${post.readingTimeMinutes} min`}
                    title={post.title}
                    description={post.excerpt ?? ''}
                    href={`/blog/${post.slug}`}
                    cta="Read update"
                  />
                );
              })}
            </FeatureGrid>
          </Container>
        </Section>
      )}

      <CtaBand
        eyebrow="Build with us"
        title="Have a floor or aisle that needs automating?"
        subtitle="Tell us about the space, the duty cycle, and the outcome you need — we will scope the practical first step."
        primary={{ label: 'Request a quote', href: '/quote' }}
        secondary={{ label: 'Contact ARIOT', href: '/contact' }}
      />
    </>
  );
}
