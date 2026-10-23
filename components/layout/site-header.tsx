import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { NavLink } from './nav-link';
import { MobileDrawer } from './mobile-drawer';
import { MoreMenu } from './more-menu';

const NAV_ITEMS = [
  { label: 'Home', href: '/' },
  { label: 'R&D', href: '/research' },
  { label: 'Robotics', href: '/robotics' },
  { label: 'Workspace', href: '/workspace' },
  { label: 'Components', href: '/components' },
  { label: 'Solutions', href: '/solutions' },
  { label: 'About', href: '/about' },
] as const;

// Mobile drawer includes the secondary routes (Blog, Support) too, since
// there is room to scroll and they must remain reachable on small screens.
const MOBILE_NAV_ITEMS = [
  ...NAV_ITEMS,
  { label: 'Blog', href: '/blog' },
  { label: 'Support', href: '/support' },
] as const;

/**
 * SiteHeader — sticky public-website header.
 *
 * Server component. The two interactive bits (active link detection,
 * mobile drawer, More menu) are isolated client islands (NavLink,
 * MobileDrawer, MoreMenu) so the header itself ships zero client JS.
 *
 * Primary navigation follows the approved public IA:
 *   Home · R&D · Robotics · Workspace · Components · Solutions · About
 * Blog and Support live under the "More" menu (secondary navigation),
 * with footer links as a second entry point.
 *
 * Translucent bg + backdrop blur reads premium over light hero stills;
 * a 1px steel border keeps the boundary visible (DESIGN_SYSTEM §13).
 */
export function SiteHeader() {
  return (
    <header
      role="banner"
      className="border-steel-800 bg-bg-base/80 sticky top-0 z-30 border-b backdrop-blur-md"
    >
      <Container className="flex h-[60px] items-center justify-between gap-3 md:h-[72px]">
        <Link
          href="/"
          aria-label="ARIOT — home"
          className="focus-visible:ring-offset-bg-base inline-flex items-center rounded-sm focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <Image
            src="/media/brand/ariot-logo-icon.png"
            alt=""
            width={370}
            height={100}
            className="h-7 w-auto md:h-9"
            priority
          />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
            </NavLink>
          ))}
          <MoreMenu />
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Button asChild size="sm" variant="ghost">
            <Link href="/contact">Contact</Link>
          </Button>
          <Button asChild size="sm" variant="primary">
            <Link href="/quote">Request a quote</Link>
          </Button>
        </div>

        <MobileDrawer navItems={MOBILE_NAV_ITEMS} />
      </Container>
    </header>
  );
}
