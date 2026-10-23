import type { Metadata } from 'next';
import { LegalPage } from '@/components/marketing/legal-page';
import { defineMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = defineMetadata({
  title: 'Cookie policy',
  description: 'ARIOT cookie policy — what cookies we use and how to control them.',
  path: '/legal/cookies',
});

export default function CookiePolicyPage() {
  return (
    <LegalPage
      title="Cookie policy"
      status="Pre-commercial draft — pending legal review"
      sections={[
        {
          heading: 'What are cookies?',
          body: 'Cookies are small text files stored on your device when you visit a website. They are used to remember preferences, enable site functionality, and collect analytics data. This policy explains how ARIOT uses cookies on its website.',
        },
        {
          heading: 'Cookies we use',
          body: 'Essential cookies: required for the site to function (session management, security tokens). These cannot be disabled. Analytics cookies: used to understand how visitors interact with the site (page views, session duration, traffic sources). Analytics use aggregated data only. No personally identifiable analytics tracking without consent.',
        },
        {
          heading: 'Third-party cookies',
          body: "[We may use third-party services that set their own cookies (analytics, embedded content). These are governed by the respective providers' privacy policies. A full list of third-party cookie providers will be published once all integrations are confirmed.]",
        },
        {
          heading: 'Managing cookies',
          body: 'You can control cookies through your browser settings. Disabling essential cookies will affect site functionality. Disabling analytics cookies will not affect site functionality but will reduce our ability to improve the site. Browser-specific instructions for managing cookies are available from browser vendors.',
        },
        {
          heading: 'Cookie consent',
          body: 'A cookie consent banner will be implemented before commercial launch to allow users to manage cookie preferences per applicable regulations. This functionality is planned for a later development phase.',
        },
        {
          heading: 'Contact',
          body: 'For cookie policy questions, use the contact form on our Contact page. ARIOT Technologies, Bangladesh.',
        },
      ]}
    />
  );
}
