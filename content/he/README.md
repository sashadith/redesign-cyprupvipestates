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
  case-studies/<slug>.he.json        → CaseStudy     (language:"he", slug) + CaseStudyProject links
  singlepages/<slug>.he.json         → Singlepage    (language:"he", LEAF of slug) + parentSanityId
                                       + relatedLandingPages links
  singlepages/limassol/new-projects.he.json          … a nested page lives at its own path
```

**Pack slug ⇄ file path ⇄ DB slug.** A pack file's path relative to its kind
directory (minus `.he.json`) and the file's own `"slug"` field are both the
FULL served path — `singlepages/limassol/new-projects.he.json` ⇄ `"slug":
"limassol/new-projects"`. The two must be identical; the loaders read
recursively and a divergence is a hard error naming both (the seeder resolves
by path, `he-content-check.mjs` by field, so they must not drift). That full
path is what `docs/i18n/he-keyword-map.md`, `parentSlug`,
`relatedLandingPages` and the gate's `linkCheck` all reference.

What lands in the database is different: `Singlepage.slug` gets only the
**leaf** segment (`new-projects`) plus `parentSanityId` pointing at the hub
row, because that's what the public route reads back —
`_getSinglePageByLang(lang, slug)` looks a page up by the URL's last segment
and `getAllPathsForLang` / `src/lib/seo/pagePower/inventory.ts` reconstruct
the served path by walking `parentSanityId`. `sanityId` is the full path with
slashes turned into dashes (`he-limassol-new-projects`). Two pack pages whose
leaves would collide under different parents (`limassol/apartments` and
`paphos/apartments`) are refused at plan time: `Singlepage.slug` is unique per
`(language, slug)` and the route could not tell them apart.

```

scripts/faq-translations/he.json     → SiteDocument type="faqPage" — seeded identically by EITHER
                                        `node scripts/seed-faq-translations.mjs` (the original en/de/pl/ru
                                        script, extended to `he`) or `node scripts/he-content/seed.mjs
                                        --only faq` (rebuilds the same way, for a one-tool operator flow)
```

Every `*.he.json` file carries pack-only metadata keys that have no database
counterpart and are stripped (or split off into a relation, for the two link
fields) before diffing/writing:

- `"review": "pending"` — Pass C (native review) status; Phase 5 ships with
  this deferred, so every file starts `"pending"`.
- `"translationGroupSlugEn"` — the EN row (same kind, `language:"en"`) whose
  slug names the translation group this Hebrew row's `translationGroupId`
  should join. Resolved by the seeder: if given, that EN row's
  `translationGroupId` is reused (minting and persisting one onto the EN row
  first if it doesn't have one yet — the same "generate + persist if missing"
  convention `createTranslation` in `src/app/admin/actions.ts` uses); if
  omitted, a fresh group id is minted for the Hebrew row alone (and reused on
  every later re-seed of that same row, so re-running the seeder never forks
  the group).
- `"parentSlug"` (singlepages only) — for a nested landing page (e.g.
  `limassol/new-projects`), the pack slug of its hub, resolved to
  `parentSanityId`. The parent is derived from the page's own path
  (`limassol/new-projects` → `limassol`); `parentSlug`, when present, is
  cross-checked against it and a disagreement is a hard error naming both (a
  top-level page must not declare one). It resolves against every OTHER
  `*.he.json` row in the same seeder run (by its deterministic
  `sanityId: "he-<slug-with-dashes>"`, no DB round trip needed) as well as any
  hub already seeded to `he` in an earlier run (whose full path is
  reconstructed from its leaf slug by walking `parentSanityId`). A parent that
  resolves to neither is a hard error naming the slug.
- `"relatedLandingPages"` (singlepages only) — an array of PACK slugs (not
  `_ref`s) for the editor-curated cross-links between Hebrew landing pages.
  Resolved the same way as `parentSlug` (this run's rows + already-seeded `he`
  rows) into `[{_ref: sanityId}]` and written in a SECOND pass, after every
  row in the run has been inserted/updated — a hub and a spoke seeded in the
  same run can link to each other in either direction. An unresolvable slug
  is a hard error naming it.
- `"relatedProjects"` (case-studies only) — an array of EN **Development**
  slugs (not the legacy `Project` model `CaseStudyProject` actually joins to
  — see the "case-studies" section below). Resolved against
  `Development.slug` at plan time (unknown slug → hard error naming it) and
  linked in a second pass, same idea as `relatedLandingPages`.

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
   For an **empty** pack (no DB-backed rows across every selected kind —
   `legal-check` never counts, since it never touches the DB), no
   `PrismaClient` is ever constructed and no env var is needed. Without the
   env var and a non-empty pack, the script prints a `set
   CVP_ALLOW_DB_READ=yes to read existing rows` hint and exits **0** — that's
   an expected stopping point for an operator running this from the wrong
   place, not a failure of the pack.
4. **Row guard:**
   - **site-documents/faq** (keyed by `type`): if an existing row for the
     SAME `type` has `language` other than `"he"`, the whole run refuses
     rather than silently upserting past it.
   - **case-studies/singlepages** (keyed by `slug`, LEAF for singlepages):
     existing-row matching is `(language: "he", slug)` ONLY. A same-slug row
     of another language is **expected, not a hazard** — under decision A
     (see above) a `he` page deliberately shares its Latin slug with its EN
     sibling, and `CaseStudy`/`Singlepage` are unique per `(language, slug)`,
     so that EN row can never be the target of this seeder's upsert anyway.
     `translationGroupSlugEn` still resolves the EN sibling explicitly by
     `(language: "en", slug)` for the translation-group id, unrelated to this
     match. What the seeder still refuses to do — as an internal assertion,
     not a plan-time "refuse" a run can hit — is update a row that turns out
     not to be `"he"`, or insert where a `"he"` row already exists; either
     would indicate a corrupted read from the database, not a normal pack.
5. `--only <kind>` restricts to one kind. Kinds: `site-documents`, `faq`,
   `case-studies`, `singlepages`, `legal-check` — all implemented.

### Case studies: how `relatedProjects` actually links

`CaseStudy.relatedProjects` is a many-to-many through `CaseStudyProject`,
which joins to the **legacy `Project` model** (per-language, pre-`Development`),
not to `Development` directly — confirmed against `prisma/schema.prisma` and
`_getCaseStudyByLang`/`mapProjectRowsToLang` in `src/sanity/sanity.utils.ts`,
what the public `/case-studies/<slug>` page actually reads. A content file's
`relatedProjects` (EN Development slugs) is resolved at PLAN time to
`Development.id` (unknown slug → hard error), then at APPLY time (real DB
access) to whichever legacy `Project` row(s) have `supersededByDevelopmentId`
pointing at that Development — the field the Phase 5 legacy/Development
overlap-review admin flow sets. A Development with no corresponding legacy
`Project` (the common case for anything created after the `Development`
model existed) has nothing to link to; `applyPlan` logs a warning and skips
just that link rather than failing the whole run.

There are no `he` rows in the legacy `Project` model and nothing creates any
(Hebrew content is seeded as `Development`/`CaseStudy`/`Singlepage` only), so
`mapProjectRowsToLang` — which normally maps a linked project row to its
same-language sibling — would drop every card on a `he` case-study page. It
therefore carries a Hebrew-only fallback to the **EN** sibling
(`src/sanity/sanity.utils.ts`): the card link is `/he/projects/<slug>` and
project slugs are Latin and locale-agnostic, so the EN row's slug resolves
under `/he` exactly as under `/en`. en/de/pl/ru behaviour is unchanged.

Recommended operator sequence once content lands (`docs/i18n/acceptance/phase-5.md`,
Task 9 step 4, documents the full runbook):

```
# on staging, in the repo checkout
CVP_ALLOW_DB_READ=yes node scripts/he-content/seed.mjs --dry-run   # read the plan
CVP_ALLOW_DB_READ=yes CVP_CONFIRM_CONTENT_SEED=yes node scripts/he-content/seed.mjs --yes
CVP_CONFIRM_CONTENT_SEED=yes node scripts/seed-faq-translations.mjs
```

(`seed.mjs`'s own `faq` kind produces the same `he` row and can be used
instead of the last line — the two are kept in parallel deliberately; see the
"faq" section above.)

The seeder is idempotent: running it again with unchanged files (and
unchanged related-page/related-project links) produces a plan of all
`skip (unchanged)` entries and writes nothing.
