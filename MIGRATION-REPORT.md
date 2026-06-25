# URL Migration Audit — Cyprus VIP Estates (old → new)

Validated 2026-06-23 by running **all 1,293 live production URLs** through the actual staging
redirect logic (nginx `$cvp_de_only` map + `/en` strip + locale routing) and recording the first
hop, hop count, and final status. Source inventory: `url-inventory-production.txt` (1,293 URLs).

## Result headline
**Zero-loss.** Every one of the 1,293 old URLs resolves to a final **HTTP 200** on the new site,
via either a single clean **301** or a direct serve. **0 losses (404), 0 redirect chains (≥2 hops),
0 loops, 0 non-301 redirects.**

## Mapping by category (old prefix → new)
| Category | Count | Behaviour | Type |
|---|---:|---|---|
| `/en/<path>` → `/<path>` | 358 | English default is now prefix-less | 301 (1 hop → 200) |
| German-only no-prefix page → `/de/<path>` | 74 | German-slug pages that have no English equivalent (`$cvp_de_only` map) | 301 (1 hop → 200) |
| `/ru/<path>` | 311 | Russian structure unchanged | 200 (no redirect) |
| `/pl/<path>` | 308 | Polish structure unchanged | 200 (no redirect) |
| German no-prefix → **now English** (German at `/de/<same path>`) | 242 | Default-locale flip DE→EN: the bare path now serves English; German moved under `/de` | 200 (language-flip) |
| **Total** | **1,293** | | |

- Redirects required: **432** (358 + 74), all **301**, all single-hop to a 200.
- Direct 200: **861** (311 ru + 308 pl + 242 DE flip).
- Verified targets: `/en/about-us → /about-us`, `/apartment-zypern → /de/apartment-zypern`, etc.

## The language flip (the only SEO-sensitive bucket)
The old site was German-default (German at no prefix). The new site is English-default. So 242 old
German no-prefix URLs (the homepage `/`, listings `/blog` `/developers` `/case-studies`, and
`/projects/<slug>` where the slug is language-independent) **now serve English**. These are **not
redirects** and must not be — the bare path is now the English canonical. The German content lives
at `/de/<same path>` and is linked via **hreflang**.

Mitigation verified on staging:
- EN bare path 200 + DE equivalent 200 (e.g. `/projects/limassol-del-mar` ↔ `/de/projects/limassol-del-mar`).
- Full hreflang cluster on every page (`en` self, `de`, `pl`, `ru`, `x-default`) + self-referential canonical.
- Sitemaps include hreflang alternates (projects sitemap alone: 4,439 `xhtml:link`).

This is the standard, intended consequence of a default-locale flip; German ranking signals transfer
to `/de` via hreflang once Google recrawls. It is an **accepted strategic decision**, not a defect —
but it is the #1 thing to monitor in Search Console after cutover.

## Findings by priority

### 🔴 Critical (cutover-execution — not mapping gaps)
- **C1. Remove the staging `noindex` at cutover** (CUTOVER.md B3). Staging emits a site-wide
  `X-Robots-Tag: noindex, nofollow`. If the domain is added to that server block without removing it,
  the entire live site is de-indexed. The prepared production config (`cvp-production-nginx.conf`)
  correctly omits it — ensure that config (not the staging one) is what goes live.
- **C2. Deploy the production server block + SSL.** The validated redirect logic currently lives in the
  IP/staging block; cutover swaps `server_name` to `cyprusvipestates.com` + issues certbot SSL, and
  must confirm the `/en` strip, `$cvp_de_only` map, and www→non-www survive in the 443 block (CUTOVER B1/D1–D3).

### 🟠 High
- **H1. 242 language-flip URLs.** German no-prefix → English. Mitigated (hreflang + `/de`), but expect
  temporary German ranking movement. Action: submit all sitemaps (incl. `/de`) to GSC at cutover and
  monitor the German URLs’ transfer to `/de`.
- **H2. Keep the old Vercel/Sanity deployment running** post-cutover so rollback = revert DNS (CUTOVER principle).
- **H3. www → non-www 301** is in the prepared config — confirm it lands in the 443 block after certbot.

### 🟡 Medium
- **M1. `$cvp_de_only` is inventory-pinned (74 URLs).** It is complete for the current 1,293-URL
  inventory (validated). New German landing pages added later with new slugs would need adding to the map
  (or they’ll serve English at no-prefix). Document this for the content team.
- **M2. Parameter/pagination URLs.** Listing filters canonicalize to the base (`/projects?city=… → canonical /projects`),
  and robots disallows `utm`/`gclid`/`gtm`. No duplicate-content exposure found.

### 🟢 Low
- **L1. hreflang attribute renders as `hrefLang`** (camelCase) — valid HTML, read case-insensitively by Google. No action.
- **L2. `/properties*`** was never a live indexed URL (absent from the inventory); the new 308→`/projects`
  redirect is purely defensive. No SEO impact.

## Deliverables
1. **This report** — `MIGRATION-REPORT.md`.
2. **Complete redirect mapping table** — `redirect-mapping.csv` (1,293 rows: old_url, new_url, redirect_type, category, reason). Raw validated data: `/root/urlmap.tsv` on the VPS.
3. **Nginx redirect rules** — `cyprusvipestates/cvp-production-nginx.conf` (prepared, validated, indexable). This is the launch-day file.
4. **Apache/.htaccess** — N/A (the stack is nginx). Rule-equivalent if ever fronted by Apache: `RewriteRule ^en/?$ / [R=301,L]`, `RewriteRule ^en/(.*)$ /$1 [R=301,L]`, plus one `RewriteRule` per German-only path from the CSV.
5. **Next.js middleware redirects** — one app-level rule: `/properties[/...]` → localized `/projects` (308), in `src/middleware.ts`. All locale/SEO redirects are handled at nginx.

## Validation checklist
- ✅ Every important URL has a destination (1,293/1,293 → 200).
- ✅ No high-value page without a redirect (0 × 404).
- ✅ No redirect loops (max 1 hop).
- ✅ No redirect chains (0 × ≥2 hops).
- ✅ No indexable URL accidentally lost.
- ✅ Canonicals self-referential; hreflang cluster present; sitemap hreflang present.

## Totals & recommendation
- **URLs analyzed:** 1,293
- **Redirects required:** 432 (all 301, single-hop)
- **URLs with no equivalent destination:** 0
- **Launch-day redirect file:** `cvp-production-nginx.conf`
- **GO / NO-GO:** **GO** for URL migration. The mapping is zero-loss and fully validated. The only
  remaining work is correct cutover execution (deploy the production nginx block, remove the staging
  noindex, issue SSL, submit sitemaps) — all covered by `CUTOVER.md`.
