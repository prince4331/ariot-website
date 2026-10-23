import type { Metadata } from 'next';
import { Mail, MessageCircle, Newspaper } from 'lucide-react';
import { ContactForm } from '@/features/forms/contact-form';
import { FeatureCard } from '@/components/marketing/feature-card';
import { FeatureGrid } from '@/components/marketing/feature-grid';
import { HeroShell } from '@/components/marketing/hero-shell';
import { SectionHeader } from '@/components/marketing/section-header';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { defineMetadata } from '@/lib/seo/metadata';

const channels = [
  {
    icon: Mail,
    title: 'Sales enquiries',
    description:
      'Use for product questions, quote routing, partnership discussions, and component requests. Response target: 1 business day.',
  },
  {
    icon: MessageCircle,
    title: 'Technical support',
    description:
      'Use for setup help, manuals, firmware questions, and warranty direction. Support workflow is being established.',
  },
  {
    icon: Newspaper,
    title: 'Press & media',
    description:
      'Use for media requests, founder background, and approved company information. Please identify your publication.',
  },
] as const;

export const metadata: Metadata = defineMetadata({
  title: 'Contact ARIOT',
  description:
    'Contact ARIOT Technologies for robotics products, IoT systems, support questions, partnerships, and press inquiries.',
  path: '/contact',
});

export default function ContactPage() {
  return (
    <>
      <HeroShell>
        <Section bg="base" spacing="loose">
          <Container className="flex flex-col gap-6">
            <p className="font-mono text-[12px] font-medium tracking-[0.18em] text-cyan-400 uppercase">
              Contact
            </p>
            <div className="max-w-4xl">
              <h1 className="text-steel-100 font-display text-4xl leading-[1.04] font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
                Talk to us
              </h1>
              <p className="text-steel-200 mt-5 max-w-2xl text-base sm:text-lg md:text-xl">
                Reach the right ARIOT team for sales, technical support, workspace enquiries,
                component requests, or press.
              </p>
            </div>
          </Container>
        </Section>
      </HeroShell>

      <Section bg="raised" spacing="default">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            eyebrow="Route your message"
            title="Choose the right channel"
            subhead="Use the form below if you are unsure — we will route it correctly."
          />
          <FeatureGrid columns={3}>
            {channels.map((channel) => (
              <FeatureCard key={channel.title} {...channel} />
            ))}
          </FeatureGrid>
        </Container>
      </Section>

      <Section bg="base" spacing="default">
        <Container className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_0.75fr]">
          <Card>
            <CardHeader>
              <CardTitle>Send a message</CardTitle>
            </CardHeader>
            <CardBody>
              <ContactForm />
            </CardBody>
          </Card>

          <Card variant="glass">
            <CardBody className="flex flex-col gap-6 p-6 md:p-8">
              <div>
                <p className="font-mono text-[11px] tracking-[0.18em] text-cyan-400 uppercase">
                  Bangladesh
                </p>
                <h2 className="text-steel-100 font-display mt-3 text-3xl font-semibold tracking-tight">
                  ARIOT Technologies
                </h2>
                <p className="text-steel-300 mt-4 text-base">
                  An engineering company building robotics and IoT systems for Bangladeshi
                  conditions. Office address and contact details will be listed once confirmed for
                  publication.
                </p>
              </div>
              <div className="border-steel-700 bg-bg-raised rounded-lg border px-4 py-3">
                <p className="text-steel-400 font-mono text-[11px] tracking-[0.16em] uppercase">
                  Prefer email?
                </p>
                <p className="text-steel-200 mt-1 text-sm">
                  Use the form to the left — messages are routed to the right team within one
                  business day.
                </p>
              </div>
              <div
                role="img"
                aria-label="Bangladesh location"
                className="border-steel-700 bg-bg-raised relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border"
              >
                <div className="text-center">
                  <div className="bg-cyan-faint mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-cyan-400/30">
                    <span className="font-mono text-[10px] font-medium text-cyan-400">BD</span>
                  </div>
                  <p className="text-steel-500 mt-2 font-mono text-[10px] tracking-[0.16em] uppercase">
                    Bangladesh — location to be published
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </Container>
      </Section>
    </>
  );
}
