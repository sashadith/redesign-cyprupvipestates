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

- **`landing-imports/`** — the DE/PL/RU landing-page import (21 markdown
  content files + 3 CSVs mapping content to slugs/metadata + 3
  `importLandingsPrisma*.cjs` scripts, one per language). Recovered from the
  `wip/content-imports` branch (2026-07-18 Phase 6 audit) — the import had
  already run against the shared production database before this branch's
  code was ever committed to `main`; all 21 pages are live today (verified:
  `/de/immobilien-in-limassol`, `/pl/mieszkania-w-limassol`,
  `/ru/kvartiry-v-limassole`, and the rest, all 200). Kept for record —
  what was imported, and how — not because there's any reason to re-run it
  against the live database.
