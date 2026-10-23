'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NavLink } from './nav-link';
import { cn } from '@/lib/utils/cn';

interface NavItem {
  label: string;
  href: string;
}

interface MobileDrawerProps {
  navItems: ReadonlyArray<NavItem>;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * MobileDrawer — hamburger trigger + slide-in side drawer.
 *
 * ROOT CAUSE FIX (confirmed browser rendering):
 *   The sticky SiteHeader uses `backdrop-filter: blur(12px)` (`backdrop-blur-md`).
 *   In WebKit/Safari (and some Chromium paths), backdrop-filter on an ancestor
 *   creates a new containing block for position:fixed descendants, confining the
 *   fixed backdrop and panel to the header element (~60px) rather than the
 *   viewport. This produced the observed ~150px narrow strip + black panel.
 *
 *   Fix: render the overlay via createPortal to document.body, placing it
 *   OUTSIDE all ancestor stacking contexts, overflow, transform, and
 *   backdrop-filter. The panel is therefore always viewport-sized.
 *
 * Structure (all within the portal, positioned from document.body):
 *   Root   — fixed inset-0 z-[200]       full-viewport anchor layer
 *   Veil   — absolute inset-0             translucent backdrop (click-to-close)
 *   Panel  — absolute inset-y-0 right-0   88 vw, max 360 px, slides in from right
 *
 * Accessibility: role="dialog", aria-modal, focus trap, Escape close,
 * body scroll lock, focus-return-to-trigger, reduced-motion support.
 */
export function MobileDrawer({ navItems }: MobileDrawerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Portal mount guard — prevents SSR/hydration mismatch. The only legitimate
  // use of setState in an effect: external state sync (document.body availability).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Route change close — render-time derived state (avoids setState-in-effect).
  const [prevPath, setPrevPath] = useState(pathname);
  if (pathname !== prevPath) {
    setPrevPath(pathname);
    setOpen(false);
  }

  // Focus trap + scroll lock + Escape handler.
  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    if (!panel) return;

    const focusable = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusable.length > 0) focusable[0].focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key === 'Tab') {
        const all = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (!all.length) return;
        const first = all[0];
        const last = all[all.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const overlay = (
    <div className="fixed inset-0 z-[200]">
      {/* Translucent veil — clicking closes the drawer */}
      <div
        aria-hidden
        onClick={close}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
      />

      {/* Drawer panel — slides in from the right */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-label="Mobile navigation"
        className={cn(
          /* Light theme applied directly so the panel is light even
             outside the marketing layout's .theme-light wrapper. */
          'theme-light',
          'drawer-slide-in',
          'absolute inset-y-0 right-0',
          'flex h-dvh w-[88vw] max-w-[360px] flex-col',
          'border-steel-800 bg-bg-elevated text-steel-100 border-l',
          'shadow-[0_0_48px_rgba(15,23,42,0.18)]',
        )}
      >
        {/* Header row */}
        <div className="border-steel-800 flex h-16 shrink-0 items-center justify-between border-b px-5">
          <Link
            href="/"
            onClick={close}
            className="focus-visible:ring-offset-bg-base inline-flex items-center rounded-sm focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Image
              src="/media/brand/ariot-logo-icon.png"
              alt="ARIOT Technologies"
              width={370}
              height={100}
              className="h-7 w-auto"
            />
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            onClick={close}
            className="text-steel-400 hover:bg-bg-raised hover:text-steel-100 inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation — scrollable */}
        <nav className="flex-1 overflow-y-auto px-4 py-4" aria-label="Primary mobile">
          <ul className="flex flex-col gap-0.5">
            {navItems.map((item) => (
              <li key={item.href}>
                <NavLink
                  href={item.href}
                  className="block w-full rounded-lg px-3 py-3 text-base"
                  onClick={close}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* CTA area — always visible at the bottom */}
        <div className="border-steel-800 flex shrink-0 flex-col gap-3 border-t p-5">
          <Button asChild size="lg" variant="primary">
            <Link href="/quote" onClick={close}>
              Request a quote
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/contact" onClick={close}>
              Contact ARIOT
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Hamburger trigger — always rendered, never portaled */}
      <button
        ref={triggerRef}
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'inline-flex h-10 w-10 items-center justify-center rounded-md lg:hidden',
          'text-steel-100 hover:bg-bg-elevated hover:text-cyan-400',
          'ease-out-quart transition-colors duration-200',
          'focus-visible:ring-offset-bg-base focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:outline-none',
        )}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Portal: only renders client-side, only when open */}
      {mounted && open && createPortal(overlay, document.body)}
    </>
  );
}
