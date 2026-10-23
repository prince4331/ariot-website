import type { Metadata } from 'next';
import Link from 'next/link';
import { env } from '@/server/env';
import { isGoogleProviderEnabled } from '@/server/auth/google-provider';
import { SignInForm } from './sign-in-form';

export const metadata: Metadata = {
  title: 'Admin sign in',
  description: 'Internal access sign-in for ARIOT Technologies.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/sign-in' },
};

// User-safe messages mapped from Better Auth error codes. Never echo raw
// provider errors, tokens, or stack traces to the visitor.
const SAFE_ERRORS: Record<string, string> = {
  oauth: 'Google sign-in could not be completed. Please try again.',
  access_denied: 'Access was denied. Contact an administrator if you believe this is an error.',
  signup_disabled: 'Account creation is disabled. Contact an administrator for access.',
  default: 'Something went wrong during sign-in. Please try again.',
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const providerEnabled = isGoogleProviderEnabled(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
  const initialError = error ? (SAFE_ERRORS[error] ?? SAFE_ERRORS.default) : null;

  return (
    <main className="theme-light bg-bg-raised text-steel-100 flex min-h-dvh flex-col items-center justify-center px-6 py-12 font-sans antialiased">
      {/* Subtle blueprint grid */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(var(--bg-grid) 1px, transparent 1px), linear-gradient(90deg, var(--bg-grid) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="w-full max-w-md">
        <SignInForm providerEnabled={providerEnabled} initialError={initialError} />
        <p className="text-steel-400 mt-6 text-center text-sm">
          <Link
            href="/"
            className="focus-visible:ring-offset-bg-raised rounded-sm text-cyan-400 underline-offset-4 hover:text-cyan-500 hover:underline focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Return to the public website
          </Link>
        </p>
      </div>
    </main>
  );
}
