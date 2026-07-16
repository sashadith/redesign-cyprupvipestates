# Legacy scripts

One-off scripts kept for historical record — not part of any current workflow,
not run as part of build/deploy/CI.

- **`01-assets.mjs`**, **`02-content.mjs`** — the original Sanity → Postgres
  migration (Phase 2), run once against production to download all Sanity
  assets into `public/uploads` and populate `Media`/content tables. Ported
  from production's untracked `migration/` folder during the staging→
  production merge (see `MERGE_AUDIT.md`) purely so the repo has a record of
  how the initial migration was done. Idempotent by design (upsert by
  `sanityId`, skip-if-exists for assets) but there is no reason to run them
  again against the live database.
