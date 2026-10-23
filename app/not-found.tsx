import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, House } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

/**
 * Global 404 surface. Renders outside the marketing layout so it stays
 * usable even if the layout itself fails to load. Maintains the premium
 * dark visual identity (token-driven) so a dropped link still feels
 * on-brand.
 */
export default function NotFound() {
  return (
    <main
      id="main"
      className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden py-24"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse at top, var(--cyan-faint) 0%, transparent 55%)',
        }}
      />
      <Container className="text-center">
        <Badge variant="cyan">ERROR · 404</Badge>

        <h1 className="mt-6 font-display text-5xl font-semibold tracking-tight text-steel-100 md:text-7xl">
          Off the map.
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg text-steel-200">
          The page you were looking for has been moved, retired, or never
          existed in the first place.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" variant="primary">
            <Link href="/">
              <House className="h-4 w-4" />
              Back to home
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/products">
              View products
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <p className="mt-12 font-mono text-xs text-steel-400">
          If you believe this is a mistake, contact support.
        </p>
      </Container>
    </main>
  );
}
