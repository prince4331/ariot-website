import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';
import createMDX from '@next/mdx';

/**
 * Security headers.
 *
 * CSP is structured to allow:
 *  - Self-hosted assets (scripts, styles, images, fonts)
 *  - Google Fonts (display font loading)
 *  - Vercel Analytics (privacy-friendly traffic measurement)
 *  - Plausible Analytics (privacy-friendly traffic measurement, no cookies)
 *  - Dynamic OG images (next/og fetches fonts from Google)
 *  - Inline styles (required by Next.js / Tailwind runtime injection)
 *  - Cloudflare R2 media (Step 2.4.4 / STORAGE-1R): the S3-compatible endpoint
 *    receives presigned PUTs from the admin upload flow; a configured
 *    R2_PUBLIC_BASE_URL hosts served media previews. Both entries are added
 *    only when the corresponding env is present, so a deploy without R2
 *    keeps a minimal CSP.
 *
 * 'unsafe-eval' is included for Next.js Turbopack dev HMR. In a strict
 * production CSP this would be removed, but Turbopack requires it at
 * build time. The trade-off is acceptable for a marketing site.
 *
 * The policy is intentionally permissive enough to avoid breakage while
 * still blocking the most dangerous injection vectors (external scripts,
 * untrusted frames, base tag hijacking).
 */
const r2AccountId = process.env.R2_ACCOUNT_ID;
const r2S3Endpoint = r2AccountId ? `https://${r2AccountId}.r2.cloudflarestorage.com` : null;
let r2PublicOrigin: string | null = null;
if (process.env.R2_PUBLIC_BASE_URL) {
  try {
    r2PublicOrigin = new URL(process.env.R2_PUBLIC_BASE_URL).origin;
  } catch {
    // Malformed URL is caught by the Zod env validation at app boot.
    r2PublicOrigin = null;
  }
}

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com https://plausible.io",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  `media-src 'self' blob:${r2PublicOrigin ? ` ${r2PublicOrigin}` : ''}`,
  `connect-src 'self' https://va.vercel-insights.com https://vitals.vercel-insights.com https://plausible.io${r2S3Endpoint ? ` ${r2S3Endpoint}` : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: csp,
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()',
  },
];

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/**
 * MDX configuration — no remark/rehype plugins passed here.
 *
 * Turbopack (used in production builds in Next.js 16) requires all loader
 * options to be JSON-serializable. Plugin functions are not serializable.
 *
 * Workarounds applied:
 *  - rehype-slug (heading IDs): IDs are computed from children text inside
 *    the custom h2/h3 components in `mdx-components.tsx` (same slugify logic).
 *  - remark-gfm (tables): MDX files use JSX table syntax (<table>, <tr>, etc.)
 *    instead of pipe-table syntax, which works without a GFM plugin.
 */
const withMDX = createMDX({});

const nextConfig: NextConfig = {
  // Self-hosted production deployment (D1): standalone output produces a
  // minimal server bundle for the Docker runtime image (see Dockerfile).
  output: 'standalone',
  // Allow .mdx files as pages and importable components
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default withBundleAnalyzer(withMDX(nextConfig));
