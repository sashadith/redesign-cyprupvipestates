# SEO Title/Meta Sweep — Change Log

Tracks every title/meta change made under the SEO Growth Roadmap's Part 1 (CTR title/meta sweep),
so results can be re-measured against fresh GSC exports in 4–6 weeks.

## 2026-07-18 — Batch 1: 17 approved candidates + 13-page developer template fix

**Source data:** GSC exports at `/Users/sashadith/cyprusvipestates/gsc-exports/` (last 3 months,
per locale, pulled 2026-07-18). Full before/after draft reviewed and approved by user same day.

**Re-measure after:** 2026-08-15 to 2026-08-29 (4–6 weeks from deploy). Pull a fresh GSC export
with the same filter shape (Pages report, last 3 months, per locale) and compare position/CTR for
each URL below against the baseline captured at approval time.

### 17 approved title/meta rewrites

| # | Locale | URL | Baseline pos | Baseline CTR |
|---|--------|-----|--------------|--------------|
| 1 | en | `/blog/best-areas-to-live-in-cyprus-as-an-expat` | 14.1 | 0.23% |
| 2 | en | `/off-plan-properties-in-limassol` | 14.4 | 0.24% |
| 3 | en | `/off-plan-properties-cyprus` | 12.8 | 0.67% |
| 4 | en | `/blog/why-uk-citizens-invest-in-cyprus-real-estate-post-brexit` | 7.9 | 0.11% |
| 5 | en | `/blog/cyprus-vs-spain-and-portugal` | 11.5 | 0.66% |
| 6 | en | `/blog/how-alexander-and-tatiana-found-their-dream-apartment-in-paphos` | 3.8 | 0.08% |
| 7 | en | `/blog/moving-to-cyprus-with-school-age-children` | 9.1 | 0.57% |
| 8 | de | `/de/blog/wo-leben-die-meisten-deutschen-auf-zypern` | 4.2 | 1.13% |
| 9 | de | `/de/blog/warum-wandern-so-viele-nach-zypern-aus` | 7.1 | 0.25% |
| 10 | de | `/de/blog/immobilienmarkt-zypern-prognose` | 8.7 | 0.97% |
| 11 | de | `/de/blog/mieteinnahmen-aus-deutschland-in-zypern-versteuern` | 3.8 | 0.60% |
| 12 | de | `/de/blog/steuern-auf-immobilien-in-zypern` | 7.9 | 0.81% |
| 13 | pl | `/pl/blog/ubezpieczenie-zdrowotne-na-cyprze` | 9.3 | 1.05% |
| 14 | pl | `/pl/blog/cypr-a-cypr-polnocny` | 18.4 | 0.73% |
| 15 | ru | `/ru/blog/sravnenie-nedvizhimost-kipra-vs-ispanii-i-portugalii` | 7.1 | 0.58% |
| 16 | ru | `/ru/blog/kak-stat-nalogovym-rezidentom-kipra` | 19.5 | 0.00% |
| 17 | ru | `/ru/blog/raznica-mezhdu-kiprom-i-severnym-kiprom` | 12.7 | 0.00% |

Full before/after title + meta description text for each row is in the approved artifact
(chat history, 2026-07-18) — not duplicated here to avoid drift between two copies.

### 13-page developer-profile template fix

Same generic "{Name} – Luxury [X] Developer in Cyprus" pattern replaced with one formula —
`{Name}: {N} Projects in {City}, Cyprus` — driven by each developer's real published-project
count and dominant city (published EN projects only, at time of fix):

| # | Slug | New title | Projects | City |
|---|------|-----------|----------|------|
| 1 | `mito-developers` | Mito Developers: 3 Projects in Paphos, Cyprus | 3 | Paphos |
| 2 | `agg-luxury-homes` | AGG Luxury Homes: 14 Projects in Paphos, Cyprus | 14 | Paphos |
| 3 | `aristo-developers` | Aristo Developers: 7 Projects in Paphos, Cyprus | 7 | Paphos |
| 4 | `domenica-group` | Domenica Group: 13 Projects in Paphos, Cyprus | 13 | Paphos |
| 5 | `korantina-homes` | Korantina Homes: 13 Projects in Paphos, Cyprus | 13 | Paphos |
| 6 | `g-and-v-hadjidemosthenous` | G&V Hadjidemosthenous: 4 Projects in Paphos, Cyprus | 4 | Paphos |
| 7 | `bbf` | BBF: 21 Projects in Limassol, Cyprus | 21 | Limassol |
| 8 | `sol-properties` | Sol Properties: 4 Projects in Limassol, Cyprus | 4 | Limassol |
| 9 | `luma-development` | Luma Development: 1 Project in Paphos, Cyprus | 1 | Paphos |
| 10 | `reiwa-development` | Reiwa Development: 2 Projects in Paphos, Cyprus | 2 | Paphos |
| 11 | `medousa-developers` | Medousa Developers: 10 Projects in Paphos, Cyprus | 10 | Paphos |
| 12 | `quality-home` | Quality Home Developers: 3 Projects in Paphos, Cyprus | 3 | Paphos |
| 13 | `imperio-properties` | Imperio Properties: 4 Projects in Limassol, Cyprus | 4 | Limassol |

All at `/developers/{slug}` (EN only — DE/PL/RU versions of these developer pages were not
measured or touched in this pass).

**Note:** project counts will drift as developers add/complete projects; these titles are a
point-in-time snapshot, not auto-regenerating. Re-check counts before re-measuring, or before
using this as a template for future developer onboarding.

### Held / deferred (not part of this batch)

- The 4 pages fixed 2026-07-07 (`health-insurance-in-cyprus`, `difference-between-cyprus-and-northern-cyprus`,
  `cyprus-property-vat-explained`, `houses-in-cyprus`) — left untouched, insufficient signal window
  (11 days old at analysis time). Re-measure alongside this batch in 4–6 weeks.
- 10 unmatched legacy developer pages — deliberate no-action deferral (user decision, 2026-07-17).

### Implementation notes

- All changes are CMS content only (`Blog.seo` / `Singlepage.seo` / `Developer.seo` JSON,
  `{metaTitle, metaDescription}`) — no code changes, no migration.
- Deployed via `./scripts/deploy-prod.sh --yes` to force an app restart and bust the Next.js ISR
  cache (`blog/[slug]` and `developers/[slug]` both cache for 1h; catch-all landing pages for 60s).
