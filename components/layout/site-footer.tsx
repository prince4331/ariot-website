import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils/cn';

const PRODUCT_LINKS = [
  { label: 'ARIOT CleanBot', href: '/robotics#cleanbot' },
  { label: 'ARIOT Gas Detector', href: '/products/iot-home-safety-device' },
  { label: 'Components', href: '/components' },
] as const;

const EXPLORE_LINKS = [
  { label: 'Research & Development', href: '/research' },
  { label: 'Solutions', href: '/solutions' },
  { label: 'Engineering Workspace', href: '/workspace' },
] as const;

const COMPANY_LINKS = [
  { label: 'About ARIOT', href: '/about' },
  { label: 'Blog', href: '/blog' },
  { label: 'Support', href: '/support' },
  { label: 'Contact', href: '/contact' },
] as const;

const LEGAL_LINKS = [
  { label: 'Privacy', href: '/legal/privacy' },
  { label: 'Terms', href: '/legal/terms' },
  { label: 'Cookies', href: '/legal/cookies' },
  { label: 'Warranty', href: '/legal/warranty' },
  { label: 'Shipping & returns', href: '/legal/shipping' },
] as const;

const footerLinkClass = cn(
  'rounded-sm text-sm text-steel-200 hover:text-cyan-400',
  'transition-colors duration-200 ease-out-quart',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base',
);

/**
 * SiteFooter — public-website footer.
 * Server-rendered footer with company information, navigation, and legal links.
 *
 * Link columns follow a concise three-group information architecture:
 *   Products · Explore · Company
 * Only verified/real routes are linked — no placeholder or unverified
 * destinations.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer role="contentinfo" className="border-steel-800 bg-bg-base border-t">
      <Container className="py-16 md:py-20">
        {/* Brand + contact CTA */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <Link
              href="/"
              className="focus-visible:ring-offset-bg-base inline-flex items-center rounded-sm focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <Image
                src="/media/brand/ariot-logo-icon.png"
                alt="ARIOT Technologies"
                width={370}
                height={100}
                className="h-9 w-auto"
              />
            </Link>
            <p className="font-display text-steel-100 max-w-lg text-lg leading-snug font-semibold sm:text-xl">
              Building the Robotics Ecosystem of Bangladesh.
            </p>
            <p className="text-steel-300 max-w-md text-sm leading-relaxed">
              ARIOT Technologies is developing practical products and engineering resources to help
              ideas take shape in Bangladesh.
            </p>
          </div>
          <div className="flex flex-col gap-4 lg:items-end">
            <h3 className="text-steel-400 font-mono text-xs font-medium tracking-[0.18em] uppercase">
              LET&apos;S CONNECT
            </h3>
            <p className="font-display text-steel-100 max-w-md text-xl leading-snug font-semibold lg:text-right">
              Have an idea worth building?
            </p>
            <p className="text-steel-300 max-w-md text-sm leading-relaxed lg:text-right">
              Connect with ARIOT about projects, partnerships, or collaboration.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
              <Button asChild variant="primary" size="md">
                <Link href="/quote">Request a quote</Link>
              </Button>
              <Button asChild variant="secondary" size="md">
                <Link href="/contact">Contact ARIOT</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Link columns */}
        <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3">
          <FooterColumn title="Products" links={PRODUCT_LINKS} />
          <FooterColumn title="Explore" links={EXPLORE_LINKS} />
          <FooterColumn title="Company" links={COMPANY_LINKS} />
        </div>

        <Separator className="my-10" />

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-steel-400 font-mono text-xs">
            © {year} ARIOT Technologies. All rights reserved.
          </p>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {LEGAL_LINKS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(footerLinkClass, 'text-steel-400 hover:text-steel-200 text-xs')}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  );
}

function FooterColumnTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-steel-400 font-mono text-xs font-medium tracking-[0.18em] uppercase">
      {children}
    </h3>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<{ label: string; href: string }>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <FooterColumnTitle>{title}</FooterColumnTitle>
      <ul className="flex flex-col gap-2">
        {links.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className={footerLinkClass}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
