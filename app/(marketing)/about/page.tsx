import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, BadgeCheck, Cog, Globe } from 'lucide-react';
import { CtaBand } from '@/components/marketing/cta-band';
import { FeatureCard } from '@/components/marketing/feature-card';
import { FeatureGrid } from '@/components/marketing/feature-grid';
import { HeroShell } from '@/components/marketing/hero-shell';
import { LogoStrip } from '@/components/marketing/logo-strip';
import { SectionHeader } from '@/components/marketing/section-header';
import { Timeline } from '@/components/marketing/timeline';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { BreadcrumbList } from '@/components/seo/breadcrumb-list';
import { Organization } from '@/components/seo/organization';
import { defineMetadata } from '@/lib/seo/metadata';

const story = [
  {
    label: 'Founded',
    title: 'ARIOT Technologies established',
    description:
      'A robotics and IoT engineering venture founded in Bangladesh, developing autonomous systems and connected devices for local needs.',
  },
  {
    label: 'First prototypes',
    title: 'Autonomous robot prototyping begins',
    description:
      'Engineering work on the autonomous floor-cleaning system starts — prototype development, sensor integration, and navigation research.',
  },
  {
    label: 'Today',
    title: 'Active R&D, workspace & components planned',
    description:
      'Prototype testing continues. Plans for a shared robotics workspace and an electronics components store are in development.',
  },
  {
    label: 'Next',
    title: 'Strengthen our presence in Bangladesh',
    description:
      'Pilot collaborations, local support, and additional product lines are planned as engineering milestones are reached.',
  },
] as const;

const focusAreas = [
  {
    icon: Cog,
    title: 'Engineering ownership',
    description:
      'We align mechanics, electronics, firmware, cloud, and service documentation around the same product goal — no hand-offs to separate vendors.',
  },
  {
    icon: Globe,
    title: 'Bangladesh-first design',
    description:
      'Power reliability, network conditions, climate, operator behaviour, and support access are treated as design constraints from day one.',
  },
  {
    icon: BadgeCheck,
    title: 'Evidence-led claims',
    description:
      'We state what each product actually is — prototype, R&D, or in development. No commercial claims are made before a system is validated.',
  },
] as const;

const partnerPlaceholders = [
  { label: 'Certifications pending' },
  { label: 'Institutional partners' },
  { label: 'Industry collaborators' },
  { label: 'Details to be announced' },
] as const;

export const metadata: Metadata = defineMetadata({
  title: 'About ARIOT',
  description:
    'Learn about ARIOT Technologies — a Bangladesh-based robotics and IoT engineering venture developing practical technology for local needs.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <>
      <Organization />
      <BreadcrumbList
        items={[
          { name: 'Home', url: '/' },
          { name: 'About', url: '/about' },
        ]}
      />

      <HeroShell>
        <Section bg="base" spacing="loose">
          <Container className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div className="flex flex-col gap-6">
              <p className="font-mono text-[12px] font-medium tracking-[0.18em] text-cyan-400 uppercase">
                Our story
              </p>
              <div>
                <h1 className="text-steel-100 font-display text-4xl leading-[1.04] font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
                  Building autonomy for the environments we know
                </h1>
                <p className="text-steel-200 mt-5 max-w-2xl text-base sm:text-lg md:text-xl">
                  We develop robotics and connected systems for Bangladesh&apos;s practical needs —
                  hardware and software designed for local conditions, not imported assumptions.
                </p>
              </div>
              <Button asChild size="xl" variant="primary" className="w-fit">
                <Link href="/contact">
                  Work with us
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <Card variant="glass">
              <CardBody className="p-4 md:p-6">
                <div className="border-steel-700 relative aspect-[4/3] overflow-hidden rounded-lg border">
                  <Image
                    src="/media/about/about-hero-lab-01-4x3.svg"
                    alt="ARIOT engineering lab — workbench with oscilloscope, tools, and PCB"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background: 'linear-gradient(180deg, transparent 60%, var(--bg-base) 100%)',
                    }}
                  />
                </div>
              </CardBody>
            </Card>
          </Container>
        </Section>
      </HeroShell>

      <Section bg="raised" spacing="compact">
        <Container>
          <p className="text-steel-100 font-display mx-auto max-w-4xl text-center text-2xl leading-snug font-semibold tracking-tight md:text-4xl">
            ARIOT exists to engineer practical robotics and connected systems that can be built,
            serviced, and trusted in Bangladesh.
          </p>
        </Container>
      </Section>

      <Section bg="base" spacing="default">
        <Container className="grid grid-cols-1 gap-10 lg:grid-cols-[0.8fr_1fr] lg:items-start">
          <SectionHeader
            eyebrow="Story"
            title="Milestones, not mythology"
            subhead="We tell the story as it actually is — no fabricated deployment history, no unverified dates."
            size="compact"
          />
          <Timeline items={story} />
        </Container>
      </Section>

      <Section bg="raised" spacing="default">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            eyebrow="Engineering focus"
            title="What makes ARIOT credible"
            subhead="Capability claims stay concrete and evidence-led."
          />
          <FeatureGrid columns={3}>
            {focusAreas.map((area) => (
              <FeatureCard key={area.title} {...area} />
            ))}
          </FeatureGrid>
        </Container>
      </Section>

      <Section bg="base" spacing="default">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            eyebrow="Team"
            title="People behind the systems"
            subhead="Team profiles, bios, and photographs will be published once reviewed and approved by the founders."
          />
          <p className="text-steel-300 max-w-2xl text-base">
            ARIOT Technologies is an engineering-led company based in Bangladesh. Team details will
            be listed here once they are ready for publication.
          </p>
        </Container>
      </Section>

      <Section bg="raised" spacing="compact">
        <Container>
          <LogoStrip eyebrow="Certifications & partners" items={partnerPlaceholders} />
        </Container>
      </Section>

      <Section bg="base" spacing="default">
        <Container>
          <Card variant="glass">
            <CardBody className="flex flex-col gap-4 p-6 md:p-8">
              <p className="font-mono text-[11px] tracking-[0.18em] text-cyan-400 uppercase">
                Press & news
              </p>
              <h2 className="text-steel-100 font-display text-3xl font-semibold tracking-tight">
                News and press mentions
              </h2>
              <p className="text-steel-300 max-w-2xl text-base">
                Press links, institution announcements, and founder updates will appear here as they
                are published and verified.
              </p>
            </CardBody>
          </Card>
        </Container>
      </Section>

      <CtaBand
        eyebrow="Get in touch"
        title="Build with a team that owns the whole system"
        subtitle="Tell us what you are trying to automate, monitor, or prototype — and we will help scope the right approach."
        primary={{ label: 'Contact ARIOT', href: '/contact' }}
        secondary={{ label: 'Request a quote', href: '/quote' }}
      />
    </>
  );
}
