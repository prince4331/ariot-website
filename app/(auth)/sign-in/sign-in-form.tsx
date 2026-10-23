'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from '@/components/ui/card';
import { authClient } from '@/lib/auth-client';

interface SignInFormProps {
  /** True only when both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set. */
  providerEnabled: boolean;
  /** User-safe error message derived from the `?error=` query param. */
  initialError: string | null;
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" role="img" focusable="false">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export function SignInForm({ providerEnabled, initialError }: SignInFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  async function handleGoogleSignIn() {
    setError(null);
    setLoading(true);
    try {
      await authClient.signIn.social({
        provider: 'google',
        // Land in the admin dashboard on the host that initiated sign-in
        // (the admin subdomain in production, localhost in development).
        // Relative URLs only — Better Auth validates them against the
        // trusted-origins list (D-082/D2).
        callbackURL: '/admin',
        errorCallbackURL: '/sign-in?error=oauth',
      });
      // On success Better Auth performs a full-page redirect to Google; this
      // point is only reached if navigation does not occur (e.g. a thrown error).
    } catch {
      setLoading(false);
      setError('Unable to start Google sign-in. Please try again or contact support.');
    }
  }

  return (
    <Card variant="glass">
      <CardHeader>
        <span className="font-display text-steel-100 text-xl font-semibold tracking-tight">
          ARIOT
        </span>
        <p className="text-steel-400 mt-0.5 font-mono text-[10px] tracking-[0.16em] uppercase">
          Technologies
        </p>
        <CardTitle className="mt-4">Admin sign in</CardTitle>
        <CardDescription>
          Internal access only. ARIOT Technologies team members authenticate with Google. New
          accounts are disabled — contact an administrator if you need access.
        </CardDescription>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        {error && (
          <p
            role="alert"
            aria-live="polite"
            className="border-danger/40 bg-danger/10 text-danger rounded-md border px-3 py-2 text-sm"
          >
            {error}
          </p>
        )}

        <Button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={!providerEnabled || loading}
          variant="secondary"
          aria-label="Continue with Google"
          className="w-full"
        >
          <GoogleMark />
          {loading ? 'Redirecting to Google…' : 'Continue with Google'}
        </Button>

        {!providerEnabled && (
          <p className="text-steel-400 text-sm" role="status">
            Google sign-in is not configured in this environment. Set GOOGLE_CLIENT_ID and
            GOOGLE_CLIENT_SECRET to enable it.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
