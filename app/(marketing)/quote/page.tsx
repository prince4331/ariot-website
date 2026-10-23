import type { Metadata } from 'next';
import { Briefcase, Package, UserRound } from 'lucide-react';
import { QuoteForm } from '@/features/forms/quote-form';
import { HeroShell } from '@/components/marketing/hero-shell';
import { Timeline } from '@/components/marketing/timeline';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { defineMetadata } from '@/lib/seo/metadata';

const steps = [
  { label: 'Project', icon: Briefcase },
  { label: 'Products', icon: Package },
  { label: 'Contact', icon: UserRound },
] as const;

const nextSteps = [
  {
    label: 'Confirmation',
    title: 'We confirm receipt',
    description:
      'You receive a quote reference and an expectation-setting response within one business day.',
  },
  {
    label: 'Engineer review',
    title: 'The right engineer reviews the scope',
    description:
      'A robotics, embedded, or IoT specialist is assigned based on the project requirements.',
  },
  {
    label: 'Discovery',
    title: 'We clarify constraints',
    description:
      'Site, duty cycle, environment, timeline, support, and procurement needs are documented before any proposal.',
  },
  {
    label: 'Proposal',
    title: 'You receive the next practical step',
    description: 'Proposal, pilot scope, or product recommendation — depending on the project fit.',
  },
] as const;

export const metadata: Metadata = defineMetadata({
  title: 'Request a quote',
  description:
    'Request an ARIOT quote for robotics products, IoT deployments, custom embedded systems, and field projects in Bangladesh.',
  path: '/quote',
});

export default function QuotePage() {
  return (
    <>
      <HeroShell>
        <Section bg="base" spacing="loose">
          <Container className="flex flex-col gap-6">
            <p className="font-mono text-[12px] font-medium tracking-[0.18em] text-cyan-400 uppercase">
              Quote
            </p>
            <div className="max-w-4xl">
              <h1 className="text-steel-100 font-display text-4xl leading-[1.04] font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
                Request a quote
              </h1>
              <p className="text-steel-200 mt-5 max-w-2xl text-base sm:text-lg md:text-xl">
                Tell us about your project. We will respond within one business day with the right
                engineer assigned to your enquiry.
              </p>
            </div>
          </Container>
        </Section>
      </HeroShell>

      <Section bg="raised" spacing="default">
        <Container className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-start">
          <Card>
            <CardHeader>
              <CardTitle>Quote request form</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-8">
              <ol className="grid grid-cols-3 gap-2" aria-label="Quote form steps">
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <li
                      key={step.label}
                      className="border-steel-700 bg-bg-elevated flex flex-col gap-2 rounded-md border p-3"
                    >
                      <span className="bg-cyan-faint inline-flex h-8 w-8 items-center justify-center rounded-md text-cyan-400">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="text-steel-400 font-mono text-[10px] tracking-[0.18em] uppercase">
                        Step {index + 1}
                      </span>
                      <span className="text-steel-100 text-sm font-medium">{step.label}</span>
                    </li>
                  );
                })}
              </ol>
              <QuoteForm />
            </CardBody>
          </Card>

          <div className="flex flex-col gap-8 lg:sticky lg:top-28">
            <Card variant="glass">
              <CardBody className="flex flex-col gap-5 p-6 md:p-8">
                <p className="font-mono text-[11px] tracking-[0.18em] text-cyan-400 uppercase">
                  What happens next
                </p>
                <h2 className="text-steel-100 font-display text-2xl font-semibold tracking-tight">
                  Engineering review, not just sales routing
                </h2>
                <p className="text-steel-300 text-base">
                  We route each request by technical fit — the engineer who reviews your quote
                  actually builds these systems.
                </p>
              </CardBody>
            </Card>
            <Timeline items={nextSteps} numbered />
          </div>
        </Container>
      </Section>
    </>
  );
}
