# Pre-change snapshot — stale SEO overrides (unit counts, prices, truncation)

Taken by `apply-seo.mjs` immediately before the production write on
2026-08-20, which merged new `seo` keys into `DevelopmentOverride` for six
developments: royal-residences, ridge-residences, salt, onero-residences,
balance, galaxy-residences.

## Why

The hand-authored SEO descriptions duplicated live data and had gone stale:

1. **Unit counts** — every one named a hardcoded total that counted `unlisted`
   units (rows that vanished from the developer's feed and never render). The
   worst two were sold-out projects: royal-residences advertised "13 exclusive
   units available" and ridge-residences "Only 4 villas in total" while ALL of
   their units are unlisted and both pages show SOLD OUT.
2. **Stale prices** — `:salt` named €289,000 (live: €262,400) in its
   description AND all four titles; `:balance` named €173,000 (live: €162,000).
3. **Mid-word truncation** — `:salt` in all four languages and ridge's German
   description were stored at exactly 160 chars (DESC_MAX in
   src/lib/developmentSeo.ts) ending in "…", cut mid-word, live in search
   results.

The rewrite drops unit counts entirely rather than re-syncing them by hand —
they are the recurring failure mode, since no code path updates a manual
override. Prices were corrected; sold-out projects got sold-out copy pointing
at the alternatives their pages actually render. onero-residences lost the
"Maisonettes" keyword from its title and descriptions, matching the same-day
code fix to resolveDevelopmentType (all three of its maisonette units are
unlisted); it can come back if the feed re-lists them.

## Reversal

- `seo-overrides-before.json` — the complete `seo` blob per slug, as stored
  immediately before the write.
- `seo-overrides-after.json` — the keys that were merged in.
- `restore-seo.mjs` — writes `seo-overrides-before.json` back:

      node --env-file=.env.local restore-seo.mjs seo-overrides-before.json

The write merged only the keys listed in the "after" file; every other key on
each blob was preserved, and that was verified afterwards against this
snapshot.
