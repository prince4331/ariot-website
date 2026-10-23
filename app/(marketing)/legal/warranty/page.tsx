import type { Metadata } from 'next';
import { LegalPage } from '@/components/marketing/legal-page';
import { defineMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = defineMetadata({
  title: 'Warranty policy',
  description: 'ARIOT warranty policy — product coverage, claim procedures, and exclusions.',
  path: '/legal/warranty',
});

export default function WarrantyPolicyPage() {
  return (
    <LegalPage
      title="Warranty policy"
      status="Pre-commercial draft — pending legal review"
      sections={[
        {
          heading: 'Warranty status',
          body: 'ARIOT hardware is in the pre-commercial research and development phase. No commercial warranty is currently offered. The terms below are placeholders for the warranty policy that will apply once products are commercially available. All warranty commitments will be reviewed by legal counsel before commercial launch.',
        },
        {
          heading: 'Coverage (planned)',
          body: 'ARIOT hardware will carry a limited warranty against defects in materials and workmanship under normal use. This warranty will cover: hardware failures not caused by misuse; manufacturing defects identified within the warranty period; failures attributable to ARIOT design or production errors.',
        },
        {
          heading: 'Exclusions (planned)',
          body: 'The planned warranty will not cover: damage from misuse, accidents, or modifications; normal wear and tear (consumables, cleaning pads, battery degradation); damage from operating outside the specified environmental range; damage from power surges or improper installation; unauthorized firmware modifications.',
        },
        {
          heading: 'Claim procedure (planned)',
          body: 'To make a warranty claim (once commercial): contact support with the product serial number, purchase record, and description of the defect. ARIOT will assess the claim and, if valid, offer repair, replacement, or refund at our discretion. Return shipping costs for valid warranty claims will be covered by ARIOT within Bangladesh.',
        },
        {
          heading: 'Limitation',
          body: 'The planned warranty will be the exclusive remedy for hardware defects. ARIOT will not be liable for consequential damages arising from hardware failure. Specific liability caps will be defined in the final warranty terms.',
        },
        {
          heading: 'Contact',
          body: 'For warranty questions, use the contact form on our Contact page. ARIOT Technologies, Bangladesh.',
        },
      ]}
    />
  );
}
