import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Separator } from '@/components/ui/separator';
import { NewsletterForm } from '@/features/forms/newsletter-form';
import { cn } from '@/lib/utils/cn';

const COMPANY_LINKS = [
  { label: 'About', href: '/about' },
  { label: 'Blog', href: '/blog' },
] as const;

const RD_LINKS = [
  { label: 'Autonomous robotics', href: '/robotics' },
  { label: 'Research & development', href: '/research' },
] as const;

const WORKSPACE_LINKS = [{ label: 'Robotics workspace', href: '/workspace' }] as const;

const COMPONENTS_LINKS = [{ label: 'Components store', href: '/components' }] as const;

const SOLUTIONS_LINKS = [
  { label: 'Smart Factory', href: '/solutions/smart-factory' },
  { label: 'Smart Agriculture', href: '/solutions/smart-agriculture' },
  { label: 'Smart City', href: '/solutions/smart-city' },
  { label: 'Energy & Utilities', href: '/solutions/energy-utilities' },
  { label: 'Education', href: '/solutions/education' },
] as const;

const RESOURCES_LINKS = [
  { label: 'Support hub', href: '/support' },
  { label: 'Manuals', href: '/support/manuals' },
  { label: 'Firmware', href: '/support/firmware' },
  { label: 'Blog', href: '/blog' },
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
 * Server component shell with a small client island for the newsletter form.
 *
 * Link columns follow the approved public IA:
 *   Company · R&D · Workspace · Components · Solutions · Resources
 * Blog and Support remain reachable (Resources / More menu) without crowding
 * the primary nav. Only verified/real routes are linked — no placeholder or
 * unverified destinations.
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
            <p className="text-steel-300 max-w-md text-sm">
              ARIOT Technologies researches autonomous robotics, develops connected IoT products,
              and is building the engineering workspace and component supply that local innovators
              need — designed for practical needs in Bangladesh.
            </p>
          </div>
          <div className="flex flex-col gap-4 lg:items-end">
            <h3 className="text-steel-400 font-mono text-xs font-medium tracking-[0.18em] uppercase">
              Get in touch
            </h3>
            <p className="text-steel-300 max-w-md text-sm lg:text-right">
              Tell us what you are automating, monitoring, or prototyping — we will route you to the
              right engineer.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
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
        <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-6">
          <FooterColumn title="Company" links={COMPANY_LINKS} />
          <FooterColumn title="R&D" links={RD_LINKS} />
          <FooterColumn title="Workspace" links={WORKSPACE_LINKS} />
          <FooterColumn title="Components" links={COMPONENTS_LINKS} />
          <FooterColumn title="Solutions" links={SOLUTIONS_LINKS} />
          <FooterColumn title="Resources" links={RESOURCES_LINKS} />
        </div>

        {/* Newsletter */}
        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-[1.1fr_1fr] md:items-end">
          <div className="flex flex-col gap-2">
            <h3 className="text-steel-400 font-mono text-xs font-medium tracking-[0.18em] uppercase">
              Newsletter
            </h3>
            <p className="text-steel-300 max-w-md text-sm">
              Quiet engineering notes from the ARIOT team — build logs, IoT field notes, and the
              occasional product update.
            </p>
          </div>
          <NewsletterForm source="footer" variant="footer" />
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
