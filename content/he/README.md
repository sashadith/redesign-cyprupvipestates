# Hebrew content pack (`content/he/**`)

Hebrew localization Phase 5. This directory is the **authored-in-git** source
of the Hebrew content that gets seeded into the shared database from the
staging server — never written from a laptop. See
`docs/superpowers/plans/2026-09-13-hebrew-phase5-content.md` (the Phase 5
plan) and `docs/superpowers/specs/2026-09-13-hebrew-localization-design.md`
(§1.3, §6) for the full design; this file is the short operator-facing
version.

**Why git, not the CMS:** the local `DATABASE_URL` on every laptop in this
repo IS the production database (see the repo's "Local DB is production"
note). A content pipeline that let a laptop write Hebrew rows directly would
mean an editing mistake ships to production immediately. Authoring as
reviewable JSON files, gated by `scripts/qa/he-content-check.mjs`, and seeded
only from the staging server behind an explicit confirmation flag keeps every
step reviewable and reversible before it reaches the live (launch-gated) `he`
locale.

## Layout

```
content/he/
  source/                      EN snapshots (export-en.mjs output; read-only reference, committed)
    site-documents/<type>.en.json
    case-studies/<slug>.en.json
    singlepages/<slug>.en.json
    developers.en.json
    inventory.json
  site-documents/<type>.he.json      → SiteDocument  (type_language: {type, language:"he"})
  case-studies/<slug>.he.json        → CaseStudy     (language:"he", slug)
  singlepages/<slug>.he.json         → Singlepage    (language:"he", slug)

scripts/faq-translations/he.json     → SiteDocument type="faqPage" (seeded by
                                        scripts/seed-faq-translations.mjs, not seed.mjs)
```

Every `*.he.json` file carries three pack-only metadata keys that have no
database counterpart and are stripped before diffing/writing:

- `"review": "pending"` — Pass C (native review) status; Phase 5 ships with
  this deferred, so every file starts `"pending"`.
- `"translationGroupSlugEn"` — the EN row this Hebrew row's `translationGroupId`
  should join, resolved by the seeder (Task 9).
- `"parentSlug"` — for a nested landing page (e.g. `limassol/new-projects`),
  the pack slug of its hub, resolved to `parentSanityId` by the seeder.

A file under `content/he/source/**` is an English **snapshot**, not a live
read — it is written once by `export-en.mjs` and committed, so translation
agents and `scripts/qa/he-content-check.mjs`'s `mirrorCheck` have something
stable to diff against even as the live DB keeps changing. A `content/he/**`
file with no matching `content/he/source/**` counterpart (a freshly authored
landing page with no English equivalent, e.g. most of the keyword-map pages)
is expected — the gate skips `mirrorCheck` for it and says so.

## The gate

```
node scripts/qa/he-content-check.mjs                  # whole pack
node scripts/qa/he-content-check.mjs --only <path>     # only files whose repo-relative
                                                        # path starts with <path>
```

Runs, for every `content/he/**/*.he.json` file and `scripts/faq-translations/he.json`:

- `mirrorCheck` against the matching EN source (skipped when none exists) —
  same keys/array-lengths/`_type`s/portable-text structure, Hebrew script
  present wherever the EN string had letters.
- `styleCheck` — forbidden punctuation/wording (em/en dash, `!`, curly
  quotes, gender-slash forms, banned words, unquoted `נדלן`).
- `linkCheck` — every `href`/`url` must be a `/he/...` route (code route or a
  pack slug), an EN `/blog/<slug>` article, or `mailto:`/`tel:`/`wa.me`/the
  absolute `cyprusvipestates.com/he/...` domain.
- `metaCheck` — `seo.metaTitle` ≤ 60 graphemes, `seo.metaDescription` ≤ 155.

Prints `he-content: OK (N files, M strings)` and exits 0 when clean; otherwise
prints every violation with its file and path and exits 1. Run this before
every content commit.

The pure checks it calls (`mirrorCheck`, `styleCheck`, `linkCheck`,
`metaCheck`, `walkStrings`, and the `STYLE_RULES` list) live in
`scripts/he-content/lib.mjs` — no I/O, no DB, safe to unit-test directly (see
`scripts/qa/__tests__/he-content.test.mjs`). `STYLE_RULES` is asserted equal
to a TypeScript copy in `src/lib/heStyleRules.ts` (Task 7) so the file-based
gate and the AI translation queue can never silently diverge.

## Exporting the EN source (controller only, read-only)

```
node scripts/he-content/export-en.mjs [--out content/he/source]
```

Prints a `READ-ONLY EXPORT` banner and only ever calls
`findMany`/`findUnique`/`count`/`groupBy` — never a write, never raw SQL (a
static test greps the script's source for the mutating call shapes). This is
still a **declared production read**: run it once, from the controller, not
from inside an implementer task, and commit the result.

## Seeding (staging server only)

```
node scripts/he-content/seed.mjs [--only <kind>] [--yes]
```

**Never run this on a laptop.** It is meant for the staging server, where the
DB access is the intended target rather than an accident. Every safety gate
below exists because the local `DATABASE_URL` in this repo is production:

1. **Dry run is the default.** No flag needed — just `node scripts/he-content/seed.mjs`.
2. **A real run** needs both `CVP_CONFIRM_CONTENT_SEED=yes` in the
   environment **and** the `--yes` flag. Either one missing refuses to write.
3. **Reading existing rows requires `CVP_ALLOW_DB_READ=yes`**, even for a dry
   run — planning insert/update/skip means querying the database, and that is
   itself a production read. The controller decides when that's appropriate.
   For an **empty** pack, no `PrismaClient` is ever constructed and no env
   var is needed — the empty plan is printed and the process exits 0.
4. **Row guard:** if an existing row this would touch has `language` other
   than `"he"`, the whole run refuses with a clear message rather than
   silently upserting past it.
5. `--only <kind>` restricts to one kind. Kinds: `site-documents` (fully
   implemented), `faq` | `case-studies` | `singlepages` | `legal-check`
   (Task 9 — calling any of these, explicitly or because their content
   already exists on disk, throws `not implemented (Task 9)`).

Recommended operator sequence once content lands (Task 9 documents the full
runbook in `docs/i18n/acceptance/phase-5.md`):

```
# on staging, in the repo checkout
CVP_ALLOW_DB_READ=yes node scripts/he-content/seed.mjs --dry-run   # read the plan
CVP_ALLOW_DB_READ=yes CVP_CONFIRM_CONTENT_SEED=yes node scripts/he-content/seed.mjs --yes
CVP_CONFIRM_CONTENT_SEED=yes node scripts/seed-faq-translations.mjs
```

The seeder is idempotent: running it again with unchanged files produces a
plan of all `skip (unchanged)` entries and writes nothing.
