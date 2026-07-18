// Shared shape for future SEO/local-search data providers, so the eventual
// "Advisor" layer (recommendations synthesized across multiple signals) can
// plug in a new source without refactoring existing callers — every adapter
// exposes the same getStatus() so a settings/admin screen can list "configured
// / not configured" uniformly regardless of provider.
//
// FOUNDATION ONLY: the two adapters in this directory (dataforseo.ts, gbp.ts)
// are typed interfaces + a "not configured" status check — no HTTP calls, no
// API credentials wired up, nothing spent. Implementing them is a separate,
// explicit future task.
export type SeoSourceStatus = { configured: boolean; reason?: string };

export interface SeoSourceAdapter {
  readonly name: string;
  getStatus(): SeoSourceStatus;
}
