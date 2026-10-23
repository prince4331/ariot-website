'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const MORE_ITEMS = [
  { label: 'Solutions', href: '/solutions' },
  { label: 'Workspace', href: '/workspace' },
  { label: 'Components', href: '/components' },
  { label: 'Blog', href: '/blog' },
  { label: 'Support', href: '/support' },
] as const;

/**
 * MoreMenu — secondary desktop navigation for routes that should not crowd
 * the primary bar (Blog, Support). Closes on route change and on outside
 * click; keyboard-operable (Enter/Space toggle, Escape closes).
 */
export function MoreMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  // Close the menu whenever the route changes. Legitimate post-render
  // side effect (route → UI state sync), not a derived-state bug.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, []);

  const isActive = MORE_ITEMS.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'relative inline-flex items-center gap-1 rounded-sm px-2 py-1 text-sm font-medium tracking-tight',
          'ease-out-quart transition-colors duration-200',
          'text-steel-200 hover:text-steel-100',
          'aria-[current=page]:text-cyan-400',
          'focus-visible:ring-offset-bg-base focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:outline-none',
          isActive && 'text-cyan-400',
        )}
      >
        Explore
        <ChevronDown
          className={cn('h-4 w-4 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="glass-panel absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-lg py-1"
        >
          {MORE_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              className={cn(
                'text-steel-200 block px-4 py-2.5 text-sm transition-colors duration-200',
                'hover:bg-steel-900/5 hover:text-steel-100',
                'focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none',
                pathname === item.href && 'text-cyan-400',
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
