import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, BadgeCheck, Cog, Globe } from 'lucide-react';
import { CtaBand } from '@/components/marketing/cta-band';
import { FeatureCard } from '@/components/marketing/feature-card';
import { FeatureGrid } from '@/components/marketing/feature-grid';
import { HeroShell } from '@/components/marketing/hero-shell';
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
    label: 'Our beginnings',
    title: 'An ambition to build locally',
    description:
      'ARIOT began with a vision to bring together engineering talent and develop practical technology in Bangladesh.',
  },
  {
    label: 'First steps',
    title: 'Turning ideas into prototypes',
    description:
      'We started bringing hardware, embedded systems, and software together to explore solutions to real-world challenges.',
  },
  {
    label: 'Where we are',
    title: 'Building the foundations of ARIOT',
    description:
      'Product development is underway, alongside plans for an engineering workspace and access to electronic components.',
  },
  {
    label: 'Where we are going',
    title: 'Growing a technology ecosystem',
    description:
      'Our long-term ambition is to make local innovation more accessible through useful products, engineering resources, collaboration, and support.',
  },
] as const;

const focusAreas = [
  {
    icon: Cog,
    title: 'Practical impact',
    description:
      'We focus on useful solutions to real challenges and aim to make engineering relevant to everyday needs in Bangladesh.',
  },
  {
    icon: Globe,
    title: 'Local opportunity',
    description:
      'We want more people in Bangladesh to have access to the tools, knowledge, and collaboration needed to turn ideas into working technology.',
  },
  {
    icon: BadgeCheck,
    title: 'Learning with integrity',
    description:
      'We test ideas, communicate development stages clearly, and improve through feedback rather than making unverified promises.',
  },
] as const;

const leadership = [
  {
    name: 'Md Abdullah Al Sad',
    role: 'CEO',
    description: 'EEE graduate, United International University',
    image: '/media/about/md-abdullah-al-sad.webp',
  },
  {
    name: 'Md Shamsuzzaman',
    role: 'CTO',
    description: 'EEE graduate, United International University',
    image: '/media/about/md-shamsuzzaman-profile.webp',
  },
  {
    name: 'Provat Kundu Shawon',
    role: 'COO',
    description: 'CSE student, United International University',
    image: '/media/about/provat-kundu-shawon.webp',
  },
] as const;

const aboutHeroPortraits = [
  ...leadership.map((person) =>
    person.name === 'Md Shamsuzzaman'
      ? { ...person, image: '/media/about/md-shamsuzzaman-profile.webp' }
      : person,
  ),
  {
    name: 'Dr. Sadid Muneer',
    image: '/media/about/dr-sadid-muneer-profile.webp',
  },
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
                ABOUT ARIOT TECHNOLOGIES
              </p>
              <div>
                <h1 className="text-steel-100 font-display text-4xl leading-[1.04] font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
                  Building technology. Growing possibilities.
                </h1>
                <p className="text-steel-200 mt-5 max-w-2xl text-base sm:text-lg md:text-xl">
                  ARIOT Technologies is a Bangladesh-based engineering venture bringing people,
                  ideas, and disciplines together. We&apos;re developing practical products and
                  working toward an ecosystem where local innovators have better access to tools,
                  knowledge, and support.
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
              <CardBody className="p-3 sm:p-4">
                <figure className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {aboutHeroPortraits.map((person) => (
                      <div
                        key={person.name}
                        className="bg-bg-raised relative aspect-square overflow-hidden rounded-xl"
                      >
                        <Image
                          src={person.image}
                          alt={`Portrait of ${person.name}`}
                          fill
                          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 43vw, 24vw"
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                  <figcaption className="text-steel-400 font-mono text-[11px] tracking-[0.16em] uppercase">
                    The people behind ARIOT · Bangladesh
                  </figcaption>
                </figure>
              </CardBody>
            </Card>
          </Container>
        </Section>
      </HeroShell>

      <Section bg="raised" spacing="compact">
        <Container>
          <p className="text-steel-100 font-display mx-auto max-w-4xl text-center text-2xl leading-snug font-semibold tracking-tight md:text-4xl">
            Our purpose is to help Bangladesh build and sustain its own technology capabilities —
            through practical engineering, locally developed products, and opportunities for the
            next generation of innovators.
          </p>
        </Container>
      </Section>

      <Section bg="base" spacing="default">
        <Container className="grid grid-cols-1 gap-10 lg:grid-cols-[0.8fr_1fr] lg:items-start">
          <SectionHeader
            eyebrow="Our journey"
            title="Every great idea starts somewhere."
            subhead="From an engineering ambition to building practical technology in Bangladesh — our journey is just beginning."
            size="compact"
          />
          <Timeline items={story} />
        </Container>
      </Section>

      <Section bg="raised" spacing="default">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            eyebrow="Our values"
            title="What guides ARIOT."
            subhead="Practical impact, local opportunity, and a commitment to learning responsibly."
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
            eyebrow="Our team"
            title="The people building ARIOT."
            subhead="Meet the team bringing robotics, electronics, software, and operations together."
          />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <article className="group border-steel-800 bg-bg-raised ease-out-quart hover:shadow-2 flex w-full flex-col overflow-hidden rounded-2xl border transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none sm:col-span-2 sm:mx-auto sm:max-w-[390px] lg:col-span-1 lg:col-start-2 lg:max-w-none">
              <div className="relative aspect-square w-full overflow-hidden">
                <Image
                  src="/media/about/dr-sadid-muneer-profile.webp"
                  alt="Portrait of Dr. Sadid Muneer"
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 390px, 33vw"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-col gap-1 p-5">
                <p className="font-mono text-[11px] font-medium tracking-[0.18em] text-cyan-400 uppercase">
                  Advisor
                </p>
                <h3 className="font-display text-steel-100 text-lg font-semibold">
                  <Link
                    href="https://eee.uiu.ac.bd/faculty/muneer-sadid/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="focus-visible:ring-offset-bg-base ease-out-quart rounded-sm transition-colors duration-200 hover:text-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    Dr. Sadid Muneer
                  </Link>
                </h3>
                <p className="text-steel-300 text-sm">
                  Professor &amp; Undergraduate Program Coordinator, EEE, United International
                  University
                </p>
              </div>
            </article>
          </div>

          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {leadership.map((person) => (
              <li key={person.name}>
                <article className="group border-steel-800 bg-bg-raised ease-out-quart hover:shadow-2 flex h-full flex-col overflow-hidden rounded-2xl border transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none">
                  <div className="relative aspect-square w-full overflow-hidden">
                    <Image
                      src={person.image}
                      alt={`Portrait of ${person.name}`}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-col gap-1 p-5">
                    <p className="font-mono text-[11px] font-medium tracking-[0.18em] text-cyan-400 uppercase">
                      {person.role}
                    </p>
                    <h3 className="font-display text-steel-100 text-lg font-semibold">
                      {person.name}
                    </h3>
                    <p className="text-steel-300 text-sm">{person.description}</p>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <CtaBand
        eyebrow="Connect with ARIOT"
        title="Be part of what comes next."
        subtitle="Interested in collaborating, sharing an idea, or learning more about ARIOT? We'd love to hear from you."
        primary={{ label: 'Contact ARIOT', href: '/contact' }}
        secondary={{ label: 'Request a quote', href: '/quote' }}
      />
    </>
  );
}
