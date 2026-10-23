import type { Metadata } from 'next';
import { LegalPage } from '@/components/marketing/legal-page';
import { defineMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = defineMetadata({
  title: 'Terms of service',
  description:
    'ARIOT terms of service — the terms that govern use of the ARIOT website and products.',
  path: '/legal/terms',
});

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      status="Pre-commercial draft — pending legal review"
      sections={[
        {
          heading: 'Acceptance',
          body: 'By accessing the ARIOT website and using our products or services, you agree to these terms. If you do not agree, do not use the site or products. These terms are pre-commercial placeholders and will be reviewed by qualified legal counsel before ARIOT begins commercial operations.',
        },
        {
          heading: 'Products and services',
          body: 'ARIOT is in the research and development stage. Products shown on this website are in various stages of development: concept, prototype, and early production. Availability dates, pricing, and specifications are subject to change. No purchase is possible at this time — quote requests are for scoping only.',
        },
        {
          heading: 'Intellectual property',
          body: 'All content on this website — including text, images, designs, code, and product descriptions — is the property of ARIOT unless otherwise credited. You may not reproduce, distribute, or adapt our content without written permission.',
        },
        {
          heading: 'Limitation of liability',
          body: 'ARIOT provides the website and product information "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from use of the website or reliance on product information. Specific liability limits will be defined in the commercial-launch terms.',
        },
        {
          heading: 'Governing law',
          body: 'These terms are governed by the laws of Bangladesh. Disputes will be resolved in [JURISDICTION PENDING] courts. [Additional governing law details to be added after legal review.',
        },
        {
          heading: 'Changes to these terms',
          body: 'We may update these terms as ARIOT evolves toward commercial operation. Significant changes will be communicated via the website. Continued use of the site after an update constitutes acceptance of the new terms.',
        },
        {
          heading: 'Contact',
          body: 'For questions about these terms, use the contact form on our Contact page. ARIOT Technologies, Bangladesh.',
        },
      ]}
    />
  );
}
