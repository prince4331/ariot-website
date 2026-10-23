/**
 * formatDate — shared public-site date rendering (L3 blog wiring).
 *
 * Returns '' for absent values so callers can omit the date node entirely —
 * undated posts never render a fabricated date (AGENTS.md §12 rule 9).
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}