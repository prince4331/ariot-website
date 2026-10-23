import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  Battery,
  BookOpen,
  Cpu,
  HardDrive,
  Package,
  Radio,
  Wrench,
  Zap,
} from 'lucide-react';
import { CtaBand } from '@/components/marketing/cta-band';
import { FeatureCard } from '@/components/marketing/feature-card';
import { FeatureGrid } from '@/components/marketing/feature-grid';
import { HeroShell } from '@/components/marketing/hero-shell';
import { SectionHeader } from '@/components/marketing/section-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { BreadcrumbList } from '@/components/seo/breadcrumb-list';
import { defineMetadata } from '@/lib/seo/metadata';

const categories = [
  {
    icon: Cpu,
    title: 'Development boards',
    description:
      'Microcontroller and microprocessor boards for prototyping embedded systems and robotics controllers.',
    status: 'Catalogue expanding',
  },
  {
    icon: Radio,
    title: 'Sensors',
    description:
      'Distance, environmental, motion, and vision sensors for robotics and IoT applications.',
    status: 'Catalogue expanding',
  },
  {
    icon: Zap,
    title: 'Motors & motor drivers',
    description: 'DC motors, stepper motors, servo motors, and their associated driver boards.',
    status: 'Catalogue expanding',
  },
  {
    icon: HardDrive,
    title: 'Robotics modules',
    description:
      'Chassis frames, wheels, drive systems, and mechanical parts for building mobile robots.',
    status: 'Catalogue expanding',
  },
  {
    icon: Radio,
    title: 'IoT modules',
    description: 'Wi-Fi, Bluetooth, LoRa, and cellular modules for connecting devices to networks.',
    status: 'Catalogue expanding',
  },
  {
    icon: Battery,
    title: 'Power & batteries',
    description:
      'LiPo packs, BMS boards, step-down converters, and power supply units for robotics builds.',
    status: 'Catalogue expanding',
  },
  {
    icon: Wrench,
    title: 'Electronic tools',
    description:
      'Soldering irons, multimeters, oscilloscope probes, and hand tools for the electronics bench.',
    status: 'Coming later',
  },
  {
    icon: Package,
    title: 'Mechanical parts',
    description:
      'Structural aluminium extrusions, 3D-printed parts, brackets, and fasteners for robot frames.',
    status: 'Coming later',
  },
  {
    icon: BookOpen,
    title: 'Education kits',
    description: 'Bundled learning kits for robotics courses, workshops, and maker programmes.',
    status: 'In development',
  },
] as const;

export const metadata: Metadata = defineMetadata({
  title: 'Electronics & robotics components',
  description:
    'ARIOT Technologies is building a components store for electronics, robotics parts, and development tools — currently in development.',
  path: '/components',
});

export default function ComponentsPage() {
  return (
    <>
      <BreadcrumbList
        items={[
          { name: 'Home', url: '/' },
          { name: 'Components', url: '/components' },
        ]}
      />

      <HeroShell>
        <Section bg="base" spacing="loose">
          <Container className="flex flex-col gap-8">
            <Badge variant="warning">Store in Development</Badge>
            <div className="max-w-4xl">
              <h1 className="text-steel-100 font-display text-4xl leading-[1.04] font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
                Electronics and robotics components for builders in Bangladesh
              </h1>
              <p className="text-steel-200 mt-5 max-w-2xl text-base sm:text-lg md:text-xl">
                ARIOT Technologies is developing a components business to supply development boards,
                sensors, motors, robotics parts, and IoT modules to students, engineers, and teams
                building hardware in Bangladesh.
              </p>
            </div>
            <p className="border-steel-700 bg-bg-raised text-steel-300 max-w-2xl rounded-lg border px-5 py-4 text-sm">
              <strong className="text-steel-100">Status:</strong> The online store is in
              development. The catalogue is expanding. Online ordering is coming later. You can
              request specific components now through our contact page.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="xl" variant="primary">
                <Link href="/contact">
                  Request a component
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="xl" variant="secondary">
                <Link href="/quote">Ask about availability</Link>
              </Button>
            </div>
          </Container>
        </Section>
      </HeroShell>

      {/* Categories */}
      <Section bg="raised" spacing="default">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            eyebrow="What we carry"
            title="Planned categories"
            subhead="The catalogue is growing. If you need something not listed, request it directly — we source to order."
          />
          <FeatureGrid columns={3}>
            {categories.map((cat) => (
              <FeatureCard
                key={cat.title}
                icon={cat.icon}
                eyebrow={cat.status}
                title={cat.title}
                description={cat.description}
              />
            ))}
          </FeatureGrid>
        </Container>
      </Section>

      {/* How to order */}
      <Section bg="base" spacing="default">
        <Container className="flex flex-col gap-10">
          <SectionHeader
            eyebrow="How to order today"
            title="Online ordering is coming — request now"
            subhead="While the store is being built, you can request specific components directly. We will confirm availability and pricing by email."
          />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="border-steel-700 bg-bg-raised flex flex-col gap-3 rounded-lg border p-6">
              <span className="font-mono text-3xl font-semibold text-cyan-400">01</span>
              <h3 className="text-steel-100 font-display text-base font-semibold">
                Send your list
              </h3>
              <p className="text-steel-300 text-sm">
                Use the contact form or email to describe what you need — part name, quantity, and
                what it is for.
              </p>
            </div>
            <div className="border-steel-700 bg-bg-raised flex flex-col gap-3 rounded-lg border p-6">
              <span className="font-mono text-3xl font-semibold text-cyan-400">02</span>
              <h3 className="text-steel-100 font-display text-base font-semibold">
                We confirm availability
              </h3>
              <p className="text-steel-300 text-sm">
                We check stock and sourcing options, then respond with pricing, lead time, and any
                alternatives.
              </p>
            </div>
            <div className="border-steel-700 bg-bg-raised flex flex-col gap-3 rounded-lg border p-6">
              <span className="font-mono text-3xl font-semibold text-cyan-400">03</span>
              <h3 className="text-steel-100 font-display text-base font-semibold">
                Confirm and collect
              </h3>
              <p className="text-steel-300 text-sm">
                Once confirmed, we arrange payment and delivery or collection. Full online ordering
                will follow when the store launches.
              </p>
            </div>
          </div>
          <div>
            <Button asChild size="lg" variant="primary">
              <Link href="/contact">
                Request a component
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Container>
      </Section>

      <CtaBand
        eyebrow="Wholesale & bulk"
        title="Need components for a course or team?"
        subtitle="Schools, universities, and robotics teams with bulk requirements can contact us directly for a tailored quote."
        primary={{ label: 'Request a quote', href: '/quote' }}
        secondary={{ label: 'Contact ARIOT', href: '/contact' }}
      />
    </>
  );
}
