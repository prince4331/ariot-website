import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Bot, Cpu, FlaskConical, Radar, Ruler, Wifi } from 'lucide-react';
import { CtaBand } from '@/components/marketing/cta-band';
import { FeatureCard } from '@/components/marketing/feature-card';
import { FeatureGrid } from '@/components/marketing/feature-grid';
import { HeroShell } from '@/components/marketing/hero-shell';
import { SectionHeader } from '@/components/marketing/section-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { BreadcrumbList } from '@/components/seo/breadcrumb-list';
import { defineMetadata } from '@/lib/seo/metadata';
import { blogCategoryIcon } from '@/components/marketing/blog-category-icon';
import { safeGetPublishedPostsByCategory } from '@/server/public/blog';

const researchAreas = [
  {
    icon: Radar,
    title: 'Autonomous navigation',
    description:
      'Mapping, localization, and obstacle handling for real floors and factory aisles — not perfect simulations.',
    status: 'Research & Development',
  },
  {
    icon: Cpu,
    title: 'Embedded control',
    description:
      'Board selection, PCB layout, and firmware tuned to how a device actually runs in the field.',
    status: 'Prototype Stage',
  },
  {
    icon: Bot,
    title: 'Robotics systems',
    description: 'Mechanical design, actuation, and integration of complete autonomous machines.',
    status: 'Prototype Stage',
  },
  {
    icon: Wifi,
    title: 'IoT product development',
    description:
      'Connected sensors, gateways, and apps designed for flaky regional networks and offline fallback.',
    status: 'In Development',
  },
  {
    icon: FlaskConical,
    title: 'Prototype development',
    description: 'Fast, low-volume builds that prove a concept before any production commitment.',
    status: 'Active',
  },
  {
    icon: Ruler,
    title: 'Testing & validation',
    description:
      'Bench, environmental, and field testing that confirms a machine is safe and useful before handover.',
    status: 'Active',
  },
] as const;

export const metadata: Metadata = defineMetadata({
  title: 'Research & development',
  description:
    'ARIOT Technologies researches autonomous robotics, embedded control, and IoT product development — from prototype to validated field machine.',
  path: '/research',
});

export default async function ResearchPage() {
  // TASK 10 — Research page: recent published engineering notes. The static
  // core page remains; the section is omitted when nothing is published yet.
  const researchNotes = await safeGetPublishedPostsByCategory('engineering-notes', 3);

  return (
    <>
      <BreadcrumbList
        items={[
          { name: 'Home', url: '/' },
          { name: 'R&D', url: '/research' },
        ]}
      />

      <HeroShell>
        <Section bg="base" spacing="loose">
          <Container className="flex flex-col gap-8">
            <Badge variant="cyan">Research &amp; Development</Badge>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_0.55fr] lg:items-start">
              <div className="flex flex-col gap-6">
                <h1 className="text-steel-100 font-display text-4xl leading-[1.04] font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
                  Research that ships as real machines
                </h1>
                <p className="text-steel-200 max-w-2xl text-base sm:text-lg md:text-xl">
                  ARIOT Technologies builds the engineering capability behind autonomous robotics
                  and connected IoT products — from early prototypes through validated field
                  testing. We own the full chain: mechanics, electronics, firmware, and cloud.
                </p>
                <div>
                  <Button asChild size="xl" variant="primary">
                    <Link href="/contact">
                      Talk to our research team
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
              {/* Glass status panel */}
              <div className="glass-panel-strong flex flex-col gap-4 p-5">
                <p className="text-steel-400 font-mono text-[11px] tracking-[0.16em] uppercase">
                  Current status
                </p>
                {[
                  { label: 'Autonomous navigation', status: 'Active R&D' },
                  { label: 'Embedded control', status: 'Prototype stage' },
                  { label: 'IoT development', status: 'In development' },
                  { label: 'Testing & validation', status: 'Active' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3">
                    <span className="text-steel-200 text-sm">{item.label}</span>
                    <Badge variant="warning">{item.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </Container>
        </Section>
      </HeroShell>

      <Section bg="raised" spacing="default">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            eyebrow="What we work on"
            title="Research areas"
            subhead="Each area is honest about where it stands today — prototype, testing, or early development."
          />
          <FeatureGrid columns={3}>
            {researchAreas.map((area) => (
              <FeatureCard
                key={area.title}
                icon={area.icon}
                eyebrow={area.status}
                title={area.title}
                description={area.description}
                variant="steel"
              />
            ))}
          </FeatureGrid>
        </Container>
      </Section>

      <Section bg="base" spacing="default">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            eyebrow="How we validate"
            title="From prototype to proven machine"
            subhead="We do not claim commercial availability until a system has cleared real testing. Status is stated plainly."
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card variant="steel">
              <CardBody className="flex flex-col gap-3 p-6">
                <Badge variant="warning">Prototype Stage</Badge>
                <h3 className="text-steel-100 font-display text-lg font-semibold tracking-tight">
                  Build and iterate
                </h3>
                <p className="text-steel-300 text-sm">
                  Low-volume prototypes prove the concept and surface the mechanical, electrical,
                  and software issues early.
                </p>
              </CardBody>
            </Card>
            <Card variant="steel">
              <CardBody className="flex flex-col gap-3 p-6">
                <Badge variant="warning">Testing &amp; Validation</Badge>
                <h3 className="text-steel-100 font-display text-lg font-semibold tracking-tight">
                  Test in the field
                </h3>
                <p className="text-steel-300 text-sm">
                  Bench, environmental, and on-site testing confirm safety, reliability, and
                  real-world usefulness.
                </p>
              </CardBody>
            </Card>
            <Card variant="steel">
              <CardBody className="flex flex-col gap-3 p-6">
                <Badge variant="steel">In Development</Badge>
                <h3 className="text-steel-100 font-display text-lg font-semibold tracking-tight">
                  Prepare for scale
                </h3>
                <p className="text-steel-300 text-sm">
                  Documentation, service paths, and manufacturability are designed before any
                  production decision.
                </p>
              </CardBody>
            </Card>
          </div>
        </Container>
      </Section>

      {/* Recent engineering notes (DB-backed) */}
      {researchNotes.length > 0 && (
        <Section bg="raised" spacing="default">
          <Container className="flex flex-col gap-12">
            <SectionHeader
              eyebrow="Field notes"
              title="Recent engineering notes"
              subhead="Published findings and build decisions from ongoing R&D work."
            />
            <FeatureGrid columns={3}>
              {researchNotes.map((post) => {
                const Icon = blogCategoryIcon(post.categorySlug);
                return (
                  <FeatureCard
                    key={post.slug}
                    icon={Icon}
                    eyebrow={`${post.categoryName} · ${post.readingTimeMinutes} min`}
                    title={post.title}
                    description={post.excerpt ?? ''}
                    href={`/blog/${post.slug}`}
                    cta="Read note"
                  />
                );
              })}
            </FeatureGrid>
          </Container>
        </Section>
      )}

      <CtaBand
        eyebrow="Collaborate"
        title="Have a hard robotics or IoT problem?"
        subtitle="We partner with institutions, integrators, and industry pilots on prototype-to-product work."
        primary={{ label: 'Request a quote', href: '/quote' }}
        secondary={{ label: 'Contact ARIOT', href: '/contact' }}
      />
    </>
  );
}
