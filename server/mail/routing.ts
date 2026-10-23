import { env } from '@/server/env';

/**
 * Mail routing configuration (D2, closes the I-031 placeholder gap).
 *
 * Before D2 the sender/recipient were hardcoded placeholders in each
 * template (`noreply@ariot.example` → `[hello@ariot.example]`), which
 * Resend rejects for an unverified domain — contact/quote email could not
 * deliver in production. Routing is now environment-driven:
 *
 *   MAIL_FROM — sender, on a domain verified with Resend
 *               (`"ARIOT Technologies <no-reply@ariottech.com>"` or bare email)
 *   MAIL_TO   — owner-approved operational inbox (contact + quote notifications)
 *
 * Enforcement posture (mirrors RESEND_API_KEY):
 *   - Absent in development/test → the historical placeholder values are
 *     used, so local development never breaks without production mail
 *     configuration (the dev stub in `client.ts` still skips the actual
 *     send when no API key is present).
 *   - Absent in production → this module THROWS a MailRoutingError at send
 *     time. The throw propagates out of the send helpers exactly like the
 *     existing missing-RESEND_API_KEY failure: the API route surfaces an
 *     error (HTTP 500 / thrown) and the client form shows its error state.
 *     There is never a fake success response (AGENTS.md §9, I-031).
 *   - Malformed values fail fast at boot in every environment
 *     (`server/env.ts` Zod refinements).
 *
 * Never log or render these values in client-facing output; the error
 * messages below name the missing variable only — never any value.
 */

/** Dev/test-only fallbacks — the pre-D2 placeholder addresses (`.example` TLD). */
const DEV_MAIL_FROM = 'ARIOT <noreply@ariot.example>';
const DEV_MAIL_TO = '[hello@ariot.example]';

/** Non-PII configuration error: names the missing variable, never a value. */
export class MailRoutingError extends Error {
  readonly code = 'MAIL_ROUTING_NOT_CONFIGURED';

  constructor(missingVariable: 'MAIL_FROM' | 'MAIL_TO') {
    super(`${missingVariable} is not configured for production email delivery.`);
    this.name = 'MailRoutingError';
  }
}

function isProduction(): boolean {
  return env.NODE_ENV === 'production';
}

/** Sender for all transactional mail (contact, quote, newsletter welcome). */
export function resolveMailFrom(): string {
  if (env.MAIL_FROM) return env.MAIL_FROM;
  if (!isProduction()) return DEV_MAIL_FROM;
  throw new MailRoutingError('MAIL_FROM');
}

/** Owner-approved inbox for contact + quote notifications. */
export function resolveContactInbox(): string {
  if (env.MAIL_TO) return env.MAIL_TO;
  if (!isProduction()) return DEV_MAIL_TO;
  throw new MailRoutingError('MAIL_TO');
}
