import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { FeatureCard } from '@/components/marketing/feature-card';
import { FeatureGrid } from '@/components/marketing/feature-grid';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { defineMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = defineMetadata({
  title: 'Legal',
  description:
    'ARIOT legal policies — privacy, terms of service, cookie policy, warranty, and shipping & returns.',
  path: '/legal',
});

const legalPages = [
  {
    title: 'Privacy policy',
    description:
      'How ARIOT collects, uses, and protects personal data from website visitors and customers.',
    href: '/legal/privacy',
  },
  {
    title: 'Terms of service',
    description: 'The terms that govern use of the ARIOT website, products, and services.',
    href: '/legal/terms',
  },
  {
    title: 'Cookie policy',
    description: 'What cookies and tracking technologies ARIOT uses, and how to control them.',
    href: '/legal/cookies',
  },
  {
    title: 'Warranty policy',
    description:
      'Product warranty coverage, claim procedures, and exclusions for ARIOT hardware.',
    href: '/legal/warranty',
  },
  {
    title: 'Shipping & returns',
    description:
      'Delivery terms, return windows, and refund procedures for ARIOT product orders.',
    href: '/legal/shipping',
  },
] as const;

export default function LegalIndexPage() {
  return (
    <>
      <Section bg="base" spacing="default">
        <Container className="flex flex-col gap-10">
          <div className="max-w-3xl">
            <p className="font-mono text-[12px] font-medium tracking-[0.18em] text-cyan-400 uppercase">
              Legal
            </p>
            <h1 className="text-steel-100 font-display mt-4 text-4xl leading-[1.04] font-semibold tracking-tight sm:text-5xl">
              Legal policies
            </h1>
            <p className="text-steel-200 mt-5 text-base sm:text-lg">
              ARIOT is in the research and development stage. The policies below describe how we operate today and how we plan to operate at commercial launch; all will be reviewed by qualified legal counsel before launch.
            </p>
          </div>

          <FeatureGrid columns={3}>
            {legalPages.map((page) => (
              <FeatureCard
                key={page.href}
                title={page.title}
                description={page.description}
                href={page.href}
                cta="Read policy"
              />
            ))}
          </FeatureGrid>

          <div className="flex items-center gap-4">
            <Button asChild variant="ghost">
              <Link href="/">
                Back to home
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
