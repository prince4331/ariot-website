import { JsonLd } from './json-ld';
import { siteConfig } from '@/lib/seo/site';

interface OrganizationProps {
  /** Override the default organization name. */
  name?: string;
  /** Override the default URL. */
  url?: string;
  /** Logo image URL (absolute). */
  logo?: string;
}

/**
 * Schema.org Organization structured data.
 * Renders on the homepage and about page to establish entity identity
 * for Google Knowledge Panel and rich results.
 */
export function Organization({
  name = siteConfig.fullName,
  url = siteConfig.url,
  logo,
}: OrganizationProps) {
  // Only emit contact details that are real — placeholder/empty values are
  // filtered so structured data never carries pending config values.
  const email = siteConfig.contact.email && !siteConfig.contact.email.startsWith('[')
    ? siteConfig.contact.email
    : undefined;
  const phone = siteConfig.contact.phone && !siteConfig.contact.phone.startsWith('[')
    ? siteConfig.contact.phone
    : undefined;

  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name,
        url,
        ...(logo ? { logo } : {}),
        sameAs: [
          siteConfig.social.linkedin,
          siteConfig.social.github,
          siteConfig.social.twitter,
        ].filter((v) => v.length > 0),
        ...(email || phone
          ? {
              contactPoint: {
                '@type': 'ContactPoint',
                ...(email ? { email } : {}),
                ...(phone ? { telephone: phone } : {}),
                contactType: 'customer service',
              },
            }
          : {}),
        address: {
          '@type': 'PostalAddress',
          addressCountry: siteConfig.contact.address.country,
        },
      }}
    />
  );
}
