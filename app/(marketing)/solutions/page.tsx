import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  Building2,
  Factory,
  GraduationCap,
  House,
  Lightbulb,
  Settings2,
} from 'lucide-react';
import { CtaBand } from '@/components/marketing/cta-band';
import { FeatureCard } from '@/components/marketing/feature-card';
import { FeatureGrid } from '@/components/marketing/feature-grid';
import { FeatureStack } from '@/components/marketing/feature-stack';
import { HeroShell } from '@/components/marketing/hero-shell';
import { SectionHeader } from '@/components/marketing/section-header';
import { Timeline } from '@/components/marketing/timeline';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { BreadcrumbList } from '@/components/seo/breadcrumb-list';
import { defineMetadata } from '@/lib/seo/metadata';
import { blogCategoryIcon } from '@/components/marketing/blog-category-icon';
import { safeGetPublishedPostsByCategory } from '@/server/public/blog';

const industries = [
  {
    icon: Factory,
    title: 'Smart factory',
    description:
      'Machine telemetry, compact automation, and operator visibility for small production floors.',
    href: '/quote',
  },
  {
    icon: House,
    title: 'Smart homes',
    description:
      'Safety, appliance control, and energy visibility for connected residential spaces.',
    href: '/quote',
  },
  {
    icon: Building2,
    title: 'Smart offices',
    description:
      'Environment monitoring, access-aware workflows, and appliance control for SME offices.',
    href: '/quote',
  },
  {
    icon: GraduationCap,
    title: 'Education',
    description: 'Robotics labs, classroom kits, and guided hardware programmes for institutions.',
    href: '/quote',
  },
  {
    icon: Settings2,
    title: 'Energy & utilities',
    description:
      'Sensor networks and dashboards for usage visibility, alerts, and field diagnostics.',
    href: '/quote',
  },
  {
    icon: Lightbulb,
    title: 'Custom R&D',
    description: 'Prototype-to-deployment work for teams building new robotics or IoT products.',
    href: '/quote',
  },
] as const;

const engagementSteps = [
  {
    label: 'Discover',
    title: 'Map the environment',
    description:
      'We document the site, users, constraints, and the outcome that would make the deployment worth doing.',
  },
  {
    label: 'Design',
    title: 'Choose the right architecture',
    description:
      'We define hardware, connectivity, software, service paths, and risks before a pilot starts.',
  },
  {
    label: 'Pilot',
    title: 'Test with real operators',
    description:
      'A small deployment proves usability, reliability, and support needs before wider rollout.',
  },
  {
    label: 'Deploy',
    title: 'Scale with documentation',
    description:
      'Install plans, handover notes, and technician-ready documentation keep rollout predictable.',
  },
  {
    label: 'Support',
    title: 'Maintain the system',
    description:
      'Support paths, firmware planning, and field feedback loops keep the system useful after launch.',
  },
] as const;

export const revalidate = 0;

const approach = [
  {
    eyebrow: '01 · FIELD CONTEXT',
    title: 'Start with the site, not the device',
    description:
      'Power reliability, operator behaviour, dust, humidity, and network availability shape the architecture from day one — not as afterthoughts.',
    chips: ['Site survey', 'Risk log', 'Operator workflow'],
  },
  {
    eyebrow: '02 · SYSTEM DESIGN',
    title: 'Integrate hardware, firmware, and cloud cleanly',
    description:
      'We align sensors, controllers, connectivity, dashboards, and support documentation so the system has one engineering owner.',
    chips: ['Sensors', 'Firmware', 'MQTT / HTTPS'],
  },
  {
    eyebrow: '03 · SUPPORT MODEL',
    title: 'Design for maintenance before launch',
    description:
      'Deployment is not finished when the device powers on. We prepare the service path, spares documentation, and escalation notes before handover.',
    chips: ['Spares plan', 'Manuals', 'Support path'],
  },
] as const;

export const metadata: Metadata = defineMetadata({
  title: 'IoT and robotics solutions',
  description:
    'Explore ARIOT robotics and IoT solution patterns for homes, offices, institutions, factories, and custom R&D projects.',
  path: '/solutions',
});

export default async function SolutionsPage() {
  // TASK 9 — Latest IoT updates: published posts in the IoT in Bangladesh
  // category. The static Solutions core page remains untouched; the section
  // is omitted when nothing matching is published yet.
  const iotUpdates = await safeGetPublishedPostsByCategory('iot-in-bangladesh', 3);

  return (
    <>
      <BreadcrumbList
        items={[
          { name: 'Home', url: '/' },
          { name: 'Solutions', url: '/solutions' },
        ]}
      />
      <HeroShell>
        <Section bg="base" spacing="loose">
          <Container className="flex flex-col gap-8">
            <p className="font-mono text-[12px] font-medium tracking-[0.18em] text-cyan-400 uppercase">
              Solutions
            </p>
            <div className="max-w-4xl">
              <h1 className="text-steel-100 font-display text-4xl leading-[1.04] font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
                Designed for the spaces Bangladesh actually uses
              </h1>
              <p className="text-steel-200 mt-5 max-w-2xl text-base sm:text-lg md:text-xl">
                Industry-aware robotics and IoT systems for homes, offices, institutions, and small
                industries — built for local conditions, not just the demo environment.
              </p>
            </div>
            <div>
              <Button asChild size="xl" variant="primary">
                <Link href="/quote">
                  Discuss your project
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Container>
        </Section>
      </HeroShell>

      <Section bg="raised" spacing="default">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            eyebrow="Industries"
            title="Choose a deployment context"
            subhead="Select an industry pattern to discuss a solution. We scope each engagement individually based on the real site."
          />
          <FeatureGrid columns={3}>
            {industries.map((industry) => (
              <FeatureCard key={industry.title} {...industry} cta="Discuss this" />
            ))}
          </FeatureGrid>
        </Container>
      </Section>

      <Section bg="base" spacing="default">
        <Container className="flex flex-col gap-16">
          <SectionHeader
            eyebrow="Approach"
            title="How we turn a requirement into a working system"
            subhead="A practical engagement model for hardware projects that need field reliability, not just a working demo."
          />
          <FeatureStack items={approach} />
        </Container>
      </Section>

      <Section bg="raised" spacing="default">
        <Container className="grid grid-cols-1 gap-10 lg:grid-cols-[0.8fr_1fr] lg:items-start">
          <SectionHeader
            eyebrow="Process"
            title="A deployment workflow operators can follow"
            subhead="Each step produces documentation that is used in project plans, quotes, and handover packages."
            size="compact"
          />
          <Timeline items={engagementSteps} numbered />
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
                  Deployment stories will appear here
                </h2>
                <p className="text-steel-300 mt-4 max-w-2xl text-base">
                  Real customer stories — environment, approach, and measured outcome — will be
                  published here once deployments are complete and approved for sharing.
                </p>
              </div>
              <div className="border-steel-700 relative aspect-video overflow-hidden rounded-lg border">
                <Image
                  src="/media/solutions/solutions-homes-scene-01-16x9.svg"
                  alt="Solutions deployment context — ARIOT systems in real environments"
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

      {/* Latest IoT updates (DB-backed) */}
      {iotUpdates.length > 0 && (
        <Section bg="raised" spacing="default">
          <Container className="flex flex-col gap-12">
            <SectionHeader
              eyebrow="Field telemetry"
              title="Latest IoT updates"
              subhead="Deployment notes, sensing work, and connected-device field learnings."
            />
            <FeatureGrid columns={3}>
              {iotUpdates.map((post) => {
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
        eyebrow="Project fit"
        title="Have a site or workflow in mind?"
        subtitle="Send us the environment, target outcome, and deployment timeline. We will help scope the first practical step."
        primary={{ label: 'Request a quote', href: '/quote' }}
        secondary={{ label: 'Contact sales', href: '/contact' }}
      />
    </>
  );
}
