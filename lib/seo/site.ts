import { env } from '@/server/env';

/**
 * Single-source site configuration. Imported wherever metadata, JSON-LD,
 * sitemap, robots, or analytics consume site-level identity.
 *
 * Bracketed values are intentional placeholders — replace with real values
 * before public launch (Phase 1 follow-up).
 */
export const siteConfig = {
  name: 'ARIOT',
  fullName: 'ARIOT — Autonomous Robotics and IoT',
  description:
    'ARIOT Technologies develops autonomous robotics and intelligent IoT systems for practical applications in Bangladesh.',
  url: env.NEXT_PUBLIC_SITE_URL,
  locale: 'en_US',
  defaultLocale: 'en',
  themeColor: '#08090B',
  keywords: [
    'robotics',
    'IoT',
    'autonomous robots',
    'industrial automation',
    'smart city',
    'sensors',
    'Bangladesh robotics',
    'Bangladesh IoT',
    'ARIOT',
  ],
  // Social profiles are added once accounts are live; empty values are
  // filtered out of structured data (see components/seo/organization.tsx).
  social: {
    twitter: '',
    linkedin: '',
    github: '',
  },
  contact: {
    // Public contact identity placeholder (structured data / footer). It is
    // bracketed, so `components/seo/organization.tsx` filters it out of
    // public JSON-LD — no placeholder address is ever published.
    // NOTE: this is NOT mail routing — operational notifications go to the
    // owner-approved inbox configured via MAIL_TO (server/mail/routing.ts).
    email: '[hello@ariot.example]',
    phone: '[+880-XX-XXXXXXX]',
    address: {
      country: 'Bangladesh',
    },
  },
} as const;

export type SiteConfig = typeof siteConfig;
