import type { Metadata } from 'next';
import { LegalPage } from '@/components/marketing/legal-page';
import { defineMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = defineMetadata({
  title: 'Privacy policy',
  description: 'ARIOT privacy policy — how we collect, use, and protect personal data.',
  path: '/legal/privacy',
});

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      status="Pre-commercial draft — pending legal review"
      sections={[
        {
          heading: 'Introduction',
          body: 'ARIOT Technologies ("we", "our", "us") is committed to protecting the personal data of everyone who interacts with our website and products. This policy explains what we collect, how we use it, and the choices available to you. ARIOT is currently in the research and development stage; this policy will be reviewed by qualified legal counsel before commercial operations begin.',
        },
        {
          heading: 'Data we collect',
          body: 'We collect the information you give us directly: contact details submitted through our contact and quote forms (name, email, company, phone) and email addresses for newsletter subscriptions. We also collect aggregated website usage data through privacy-respecting analytics, and IP address data for security and rate-limiting. We do not collect payment card data on this site.',
        },
        {
          heading: 'How we use your data',
          body: 'We use your data to respond to quote and contact requests, send newsletters to subscribers who opted in, improve the website based on aggregated analytics, and protect the site from abuse. We do not sell your personal data to third parties.',
        },
        {
          heading: 'Data retention',
          body: 'Contact and quote submissions are retained for as long as needed to follow up and deliver the requested service. Newsletter subscriptions are kept until you unsubscribe. Aggregated analytics data is retained according to the analytics provider\'s retention policy.',
        },
        {
          heading: 'Your rights',
          body: 'Depending on your jurisdiction, you may have the right to access, correct, delete, or restrict processing of your personal data. To exercise any of these rights, reach us through the contact form on our Contact page and we will respond promptly.',
        },
        {
          heading: 'Cookies',
          body: 'We use cookies and similar technologies for essential site functions and aggregated analytics. See our Cookie Policy for details.',
        },
        {
          heading: 'Contact',
          body: 'For privacy questions, use the contact form on our Contact page. ARIOT Technologies, Bangladesh.',
        },
      ]}
    />
  );
}
