// An uncaught throw inside a Server Action bubbles up as Next's generic redacted
// production message ("An error occurred in the Server Components render...") —
// useless for telling a real outage (e.g. the Anthropic account run out of credits,
// or a Google OAuth token expired) apart from any other failure. Surface the actual
// cause in the returned message instead of letting it throw. Shared by every admin
// Server Action that calls an external API (Drive/feed sync, AI extraction) — see
// src/app/admin/(panel)/developments/actions.ts and .../developments/[id]/actions.ts.
export function syncErrorMessage(e: unknown): string {
  const raw = String((e as any)?.message ?? e);
  if (/credit balance is too low/i.test(raw)) {
    return "The Anthropic API account has run out of credit — add credits in Plans & Billing, then retry.";
  }
  return `Sync failed: ${raw.slice(0, 300)}`;
}
