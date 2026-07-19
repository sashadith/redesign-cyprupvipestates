// Paths currently inside their title-sweep 42-day re-measurement window
// (docs/SEO-TITLE-SWEEP-LOG.md) — this block below only intercepts in LOCAL
// DEV. In production, nginx's own blanket "/en/" rule (see ops/nginx/) wins
// before this middleware ever runs, and has been permanently 301-redirecting
// every /en/{path} — including all 24 of these — since before either sweep
// batch was deployed (confirmed via access-log diagnosis, 2026-07-19; see
// the note in SEO-TITLE-SWEEP-LOG.md). So this exclude list does NOT
// currently protect anything in production; it exists so local-dev testing
// (no nginx there) doesn't misleadingly show these paths upgrading to 301
// when production's real behavior for them hasn't changed at all.
//
// A hand-curated snapshot, not a live parse of the log doc: middleware runs
// on the Edge runtime, which can't do the fs read titleSweepLog.ts relies on
// elsewhere (that module is Node-only, used by admin/cron code).
export const EN_REDIRECT_TITLE_SWEEP_EXCLUDE = new Set<string>([
  // 2026-07-18 batch — due 2026-08-15 to 2026-08-29
  "/blog/best-areas-to-live-in-cyprus-as-an-expat",
  "/off-plan-properties-in-limassol",
  "/off-plan-properties-cyprus",
  "/blog/why-uk-citizens-invest-in-cyprus-real-estate-post-brexit",
  "/blog/cyprus-vs-spain-and-portugal",
  "/blog/how-alexander-and-tatiana-found-their-dream-apartment-in-paphos",
  "/blog/moving-to-cyprus-with-school-age-children",
  "/developers/mito-developers",
  "/developers/agg-luxury-homes",
  "/developers/aristo-developers",
  "/developers/domenica-group",
  "/developers/korantina-homes",
  "/developers/g-and-v-hadjidemosthenous",
  "/developers/bbf",
  "/developers/sol-properties",
  "/developers/luma-development",
  "/developers/reiwa-development",
  "/developers/medousa-developers",
  "/developers/quality-home",
  "/developers/imperio-properties",
  // 2026-07-07 batch (prose-only entry in the log, not table-parsed) — due ~2026-08-18
  "/blog/health-insurance-in-cyprus",
  "/blog/difference-between-cyprus-and-northern-cyprus",
  "/blog/cyprus-property-vat-explained",
  "/blog/houses-in-cyprus",
]);
