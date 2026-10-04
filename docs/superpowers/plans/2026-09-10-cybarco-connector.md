# Cybarco Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn cybarco.com — a website with no feed, no Drive and no API — into 15 Developments with images, floor plans and ~236 units carrying real prices and per-unit status.

**Architecture:** Its own connector, not the generic feed framework, matching how every other non-XML developer is wired (AGG, Korantina and Kuutio each own a lib, a sync and a cron route; AGG was deliberately removed from `SYNCED_DEVS` on 2026-08-13). Four new files plus one bug fix. `cybarco.ts` turns HTML and the Yoast sitemap into structured records with no database access, so it is testable against saved fixtures. `ai/cybarcoPriceTable.ts` is a self-contained geometric price-list reader — deliberately NOT folded into `availabilityTable.ts` or `gvPriceTable.ts`. `cybarcoSync.ts` writes Developments and units. A cron route drives it nightly.

**Tech Stack:** TypeScript, Next.js 14 App Router, Prisma/PostgreSQL, `pdfjs-dist` via the spawned worker `scripts/pdf-table-extract-worker.mjs`, esbuild for the QA harness, Node 20.

**Spec:** `docs/superpowers/specs/2026-09-10-cybarco-connector-design.md`

## Global Constraints

- **Never deploy.** Commit and merge freely; deploying to production is the operator's call. Say it is ready and wait.
- **The working tree is shared with other Claude sessions.** Never `git add -A`, never switch branches in `/Users/sashadith/cvp-analysis`. Commit from an isolated worktree created off `origin/main`, push with `git push origin HEAD:main`.
- **`.env.local` points at the LIVE production database** (tunnel on `localhost:5433`). Every local Prisma query is a production query. No writes before Task 8, and Task 8 is additive.
- **Admin/internal-facing copy is English** (`CLAUDE.md`). Client-facing copy is localized.
- **`src/lib/ai/availabilityTable.ts` and `src/lib/ai/gvPriceTable.ts` must end byte-identical to `origin/main`.** Verify with `git diff --stat origin/main -- <path>` producing no output. The one attempt at a shared table engine, during the G&V build, produced three Korantina regressions that only a live dry-run caught.
- **Project names go through `toTitleCaseName()`** from `src/lib/textCase.ts`, applied where the name first leaves the source and before any override lookup (FEED-ADAPTER-GUIDE §4).
- **No image or floor-plan caps.** Removed on 2026-09-10 by operator instruction ("immer alle bilder … importieren, ich sortiere selbst vor der veröffentlichung"). Trilogy alone has 187 gallery images.
- **Any long sync holds `beginSyncWindow()` from `src/lib/imageMirror.ts`, released in `finally`** (FEED-ADAPTER-GUIDE §4).
- **User agent:** every outbound request sends a normal desktop browser UA. Measured 2026-09-10: the site answers the production VPS with HTTP 200 and no `cf-mitigated` header, but it is behind Cloudflare and a bare `curl` UA is not what was tested.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/cybarco.ts` (new) | Fetch and parse. Listing cards, sitemap slugs, project pages, gallery pages, PDF discovery. No Prisma, no mirroring — pure source → records. |
| `src/lib/ai/cybarcoPriceTable.ts` (new) | Price lists → units. Geometric column detection, fragmented-cell joining, EN+RU status vocabulary, apartment and villa table shapes. |
| `src/lib/cybarcoSync.ts` (new) | Developments and units upsert, image and plan mirroring, published freeze, dry run. |
| `src/app/api/cron/cybarco-sync/route.ts` (new) | Nightly trigger, `withCronLog`, failure notification. |
| `src/lib/developmentDerivedState.ts` (modify) | Bug fix: 0 units means "no opinion", not "returned to market". |
| `scripts/qa/cybarco-pricelist-check.mjs` (new) | Ground-truth assertions against real captured price-list pages. |
| `scripts/qa/cybarco-parse-check.mjs` (new) | Ground-truth assertions against captured HTML. |
| `scripts/qa/fixtures/cybarco/` (new) | Real pdf.js page data and real HTML, captured 2026-09-10. |
| `scripts/qa/sold-out-sweep-check.mjs` (modify) | Cover the derived-state fix. |

---

### Task 1: Zero units means "no opinion", not "returned to market"

Independent of Cybarco and valuable on its own; do it first so the rest can rely on it.

**Files:**
- Modify: `src/lib/developmentDerivedState.ts`
- Test: `scripts/qa/sold-out-sweep-check.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `recomputeDevelopmentDerivedState(developmentId: string): Promise<void>` — unchanged signature, changed behaviour when a Development has no units.

- [ ] **Step 1: Read the current behaviour and confirm the bug**

Read `src/lib/developmentDerivedState.ts`. The relevant block is:

```ts
const { total, available, soldOut } = computeAvailability(dev.units as UnitStatusLike[]);
const wasSoldOut = dev.soldOutSince != null;
const trackable = TRACKABLE_STATUSES.has(dev.publishStatus);

const data: { unitsAvailable: number; unitsTotal: number; soldOutSince?: Date | null; returnedToMarketAt?: Date } = {
  unitsAvailable: available,
  unitsTotal: total,
};
if (soldOut && !wasSoldOut && trackable) {
  data.soldOutSince = new Date();
} else if (!soldOut && wasSoldOut) {
  data.soldOutSince = null;
  if (trackable) data.returnedToMarketAt = new Date();
}
```

With zero units, `computeAvailability` returns `{ total: 0, available: 0, soldOut: false }` because `soldOut = total > 0 && available === 0`. So the `else if` branch fires for a sold-out project that has just had its units removed: `soldOutSince` is cleared and `returnedToMarketAt` is stamped, with nothing sold and nobody choosing that date.

- [ ] **Step 2: Write the failing assertions**

Append to `scripts/qa/sold-out-sweep-check.mjs`, inside the existing harness and using its existing `check()` helper. The file already bundles the module under test; add `developmentDerivedState.ts` to the bundles it imports if it is not there yet, following the same `bundle()` call the file already uses.

Because `recomputeDevelopmentDerivedState` takes a database id, test the decision it encodes rather than the database round trip — extract nothing; assert on the pure predicate by reimplementing the three inputs it derives from and comparing against the module's own `computeAvailability`:

```js
/* The derived-state contract for a Development with NO units.
   Before 2026-09-10 a unit-less project was treated as "not sold out", which
   made recomputeDevelopmentDerivedState clear soldOutSince and stamp
   returnedToMarketAt — recording a return to market that never happened.
   Six Cybarco projects are sold out with no price list and therefore no units,
   and a hand-set sold-out state has to survive a sync. */
const AV = await import(await bundle("src/lib/developmentAvailability.ts", "availability"));
const DS = await import(await bundle("src/lib/developmentDerivedState.ts", "derived-state"));

check("no units -> soldOut false (unchanged)", AV.computeAvailability([]).soldOut, false);
check("no units -> total 0", AV.computeAvailability([]).total, 0);
check("all sold -> soldOut true", AV.computeAvailability([{ status: "sold" }, { status: "sold" }]).soldOut, true);
check("reserved is not available", AV.computeAvailability([{ status: "reserved" }]).soldOut, true);

// The new rule, exported so it can be asserted without a database.
check("clears sold-out when units exist and one is available",
  DS.shouldClearSoldOut({ total: 3, available: 1, wasSoldOut: true }), true);
check("keeps sold-out when units exist and none is available",
  DS.shouldClearSoldOut({ total: 3, available: 0, wasSoldOut: true }), false);
check("keeps sold-out when there are NO units at all",
  DS.shouldClearSoldOut({ total: 0, available: 0, wasSoldOut: true }), false);
check("nothing to clear when it was not sold out",
  DS.shouldClearSoldOut({ total: 0, available: 0, wasSoldOut: false }), false);
```

- [ ] **Step 3: Run it and watch it fail**

Run: `node scripts/qa/sold-out-sweep-check.mjs`
Expected: FAIL on the four `shouldClearSoldOut` assertions with `DS.shouldClearSoldOut is not a function`.

- [ ] **Step 4: Implement**

In `src/lib/developmentDerivedState.ts`, add the exported predicate and use it:

```ts
/* Whether a sold-out marker should be lifted. Extracted so it can be asserted
   without a database (scripts/qa/sold-out-sweep-check.mjs).
   `total === 0` is deliberately NOT a return to market: a Development with no
   units at all has no availability information, which is not the same as
   having availability. Before 2026-09-10 the two were conflated, so deleting
   every unit from a sold-out project silently cleared soldOutSince and stamped
   returnedToMarketAt with a date nobody chose. Six Cybarco projects are sold
   out and have no price list to generate units from, so a hand-set sold-out
   state has to survive every sync. */
export function shouldClearSoldOut(input: { total: number; available: number; wasSoldOut: boolean }): boolean {
  if (!input.wasSoldOut) return false;
  if (input.total === 0) return false;
  return input.available > 0;
}
```

Then replace the branch:

```ts
if (soldOut && !wasSoldOut && trackable) {
  data.soldOutSince = new Date();
} else if (shouldClearSoldOut({ total, available, wasSoldOut })) {
  data.soldOutSince = null;
  if (trackable) data.returnedToMarketAt = new Date();
}
```

- [ ] **Step 5: Run the check and the neighbouring suites**

Run: `node scripts/qa/sold-out-sweep-check.mjs && node scripts/qa/freeze-published-check.mjs && node scripts/qa/feed-guard-check.mjs`
Expected: all PASS.

- [ ] **Step 6: Mutation-test the new assertions**

Temporarily change `if (input.total === 0) return false;` to `if (input.total === 0) return true;` and re-run. Expected: `keeps sold-out when there are NO units at all` FAILS. Revert. Then delete the `if (!input.wasSoldOut) return false;` line and re-run. Expected: `nothing to clear when it was not sold out` FAILS. Revert.

An assertion that cannot fail is not an assertion; three of four mutations passing silently is how the IMAP test nearly shipped useless.

- [ ] **Step 7: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/developmentDerivedState.ts scripts/qa/sold-out-sweep-check.mjs
git commit -m "Treat a Development with no units as having no availability opinion"
```

---

### Task 2: Fixtures — capture the real source once

Everything after this is tested against captured reality rather than the live site, so a run is offline, deterministic and free.

**Files:**
- Create: `scripts/qa/fixtures/cybarco/listing.html`
- Create: `scripts/qa/fixtures/cybarco/sitemap.xml`
- Create: `scripts/qa/fixtures/cybarco/project-naftikos.html`
- Create: `scripts/qa/fixtures/cybarco/gallery-trilogy.html`
- Create: `scripts/qa/fixtures/cybarco/pl-naftikos.json`
- Create: `scripts/qa/fixtures/cybarco/pl-aktea4.json`
- Create: `scripts/qa/fixtures/cybarco/pl-centro-ru.json`
- Create: `scripts/qa/fixtures/cybarco/pl-akamas-villas.json`
- Create: `scripts/qa/fixtures/cybarco/pl-marina.json`

**Interfaces:**
- Consumes: nothing.
- Produces: the fixture files above. The `pl-*.json` files are `PdfPage[]` exactly as `scripts/pdf-table-extract-worker.mjs` prints it — `{ page: number; width: number; height: number; rows: { y: number; cells: { x: number; w: number; t: string }[] }[] }[]`.

- [ ] **Step 1: Capture the HTML**

```bash
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
D=scripts/qa/fixtures/cybarco
mkdir -p "$D"
curl -s -A "$UA" https://www.cybarco.com/project/ -o "$D/listing.html"
curl -s -A "$UA" https://www.cybarco.com/projects-sitemap.xml -o "$D/sitemap.xml"
curl -s -A "$UA" https://www.cybarco.com/project/naftikos-residences/ -o "$D/project-naftikos.html"
curl -s -A "$UA" https://www.cybarco.com/gallery/trilogy-limassol-seafront/ -o "$D/gallery-trilogy.html"
```

- [ ] **Step 2: Capture the price-list pages**

```bash
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
D=scripts/qa/fixtures/cybarco
T=$(mktemp -d)
dl() { curl -s -A "$UA" -o "$T/$1.pdf" "$2" && node scripts/pdf-table-extract-worker.mjs "$T/$1.pdf" > "$D/pl-$1.json"; }
dl naftikos      https://www.cybarco.com/wp-content/uploads/2021/03/Naftikos-Residences-Pricelist-ENG-280826.pdf
dl aktea4        https://www.cybarco.com/wp-content/uploads/2024/04/Aktea-Residences-4-Pricelist-ENG-200826.pdf
dl centro-ru     https://www.cybarco.com/wp-content/uploads/2021/03/Centro-Limassol-Pricelist-RU-040926.pdf
dl akamas-villas https://www.cybarco.com/wp-content/uploads/2017/04/Akamas-Bay-Villas-Pricelist-ENG-140826.pdf
dl marina        https://www.cybarco.com/wp-content/uploads/2019/05/Limassol-Marina-Pricelist-ENG-240726.pdf
rm -rf "$T"
```

These five cover every quirk in the spec: a plain apartment list, fragmented price cells, the Russian vocabulary, the villa shape with `Plot Area m²`, and an available-only multi-section document.

- [ ] **Step 3: Verify the capture is real data, not an error page**

```bash
node -e '
const fs=require("fs");
for (const f of fs.readdirSync("scripts/qa/fixtures/cybarco").filter(x=>x.endsWith(".json"))) {
  const p=JSON.parse(fs.readFileSync("scripts/qa/fixtures/cybarco/"+f,"utf8"));
  const cells=p.reduce((n,pg)=>n+pg.rows.reduce((m,r)=>m+r.cells.length,0),0);
  console.log(f, p.length+" pages", cells+" cells");
  if (cells < 50) { console.error("TOO SMALL — capture failed"); process.exit(1); }
}
for (const f of ["listing.html","sitemap.xml","project-naftikos.html","gallery-trilogy.html"]) {
  const s=fs.readFileSync("scripts/qa/fixtures/cybarco/"+f,"utf8");
  console.log(f, s.length+" bytes");
  if (s.length < 5000) { console.error("TOO SMALL — capture failed"); process.exit(1); }
}'
```

Expected: nine lines, every JSON with hundreds of cells, `listing.html` around 79 KB, `gallery-trilogy.html` well over 100 KB.

- [ ] **Step 4: Commit**

```bash
git add scripts/qa/fixtures/cybarco
git commit -m "Capture Cybarco fixtures: real listing, sitemap, project, gallery and five price lists"
```

---

### Task 3: `cybarco.ts` — the project inventory

**Files:**
- Create: `src/lib/cybarco.ts`
- Create: `scripts/qa/cybarco-parse-check.mjs`

**Interfaces:**
- Consumes: fixtures from Task 2.
- Produces:
  - `export type CybarcoStatus = "under_construction" | "ready" | "sold_out"`
  - `export type CybarcoCard = { slug: string; name: string; status: CybarcoStatus; priceFrom: number | null; district: string | null; featuredImage: string | null; description: string }`
  - `export function parseListing(html: string, sitemapXml: string): CybarcoCard[]`
  - `export function slugsFromSitemap(xml: string): string[]`

- [ ] **Step 1: Write the failing test**

Create `scripts/qa/cybarco-parse-check.mjs`. Copy the harness preamble from `scripts/qa/gv-pricelist-check.mjs` verbatim — the defensive esbuild import, the `bundle()` helper writing into `ROOT`, the `written`/`process.on("exit")` cleanup, and the `check()` helper — then:

```js
const CB = await import(await bundle("src/lib/cybarco.ts", "cybarco"));
const fx = (n) => readFileSync(join(ROOT, "scripts/qa/fixtures/cybarco", n), "utf8");

const cards = CB.parseListing(fx("listing.html"), fx("sitemap.xml"));

/* Counted by hand off the live listing on 2026-09-10 and independently
   confirmed by the operator ("es sind 9 verfügbare projekte. rest ist sold
   out"), which is why 15/9/6 is treated as ground truth and not as whatever
   the parser happens to produce. */
check("15 projects", cards.length, 15);
check("9 not sold out", cards.filter((c) => c.status !== "sold_out").length, 9);
check("6 sold out", cards.filter((c) => c.status === "sold_out").length, 6);

/* The site spells the same status four ways — "Under construction", "Under
   Construction", "Sold Out", "Sold out". Normalisation is under test. */
check("status vocabulary is closed",
  [...new Set(cards.map((c) => c.status))].sort(),
  ["ready", "sold_out", "under_construction"]);

const by = (s) => cards.find((c) => c.slug === s);
check("naftikos name", by("naftikos-residences").name, "Naftikos Residences");
check("naftikos priceFrom", by("naftikos-residences").priceFrom, 740000);
check("naftikos district", by("naftikos-residences").district, "Limassol");
check("naftikos status", by("naftikos-residences").status, "under_construction");
check("akamas district keeps the region", by("akamas-bay-villas").district, "Pafos");
check("akamas priceFrom", by("akamas-bay-villas").priceFrom, 1260000);
check("marina is ready to move in", by("limassol-marina").status, "ready");
check("park residences is Nicosia", by("park-residences-nicosia").district, "Nicosia");

/* Four sold-out cards carry no link. Their slug comes from matching the card
   name against the sitemap — never from slugifying the display name, because a
   drifting derived slug re-keys a project and creates a duplicate Development.
   That is exactly how Korantina's table-ordinal bug manifested. */
check("the-oval resolved from sitemap", !!by("the-oval"), true);
check("sea-gallery-villas resolved from sitemap", !!by("sea-gallery-villas"), true);
check("aktea-residences-2 resolved from sitemap", !!by("aktea-residences-2"), true);
check("aktea-residences-3 resolved from sitemap", !!by("aktea-residences-3"), true);
check("every card has a slug", cards.every((c) => !!c.slug), true);
check("slugs are unique", new Set(cards.map((c) => c.slug)).size, 15);
check("sold-out cards have no priceFrom", by("the-oval").priceFrom, null);

check("sitemap yields only EN top-level project slugs",
  CB.slugsFromSitemap(fx("sitemap.xml")).includes("aktea-residences-3"), true);
check("sitemap excludes RU", CB.slugsFromSitemap(fx("sitemap.xml")).some((s) => s.startsWith("ru/")), false);
check("sitemap excludes subpages", CB.slugsFromSitemap(fx("sitemap.xml")).some((s) => s.includes("/")), false);

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node scripts/qa/cybarco-parse-check.mjs`
Expected: FAIL — `src/lib/cybarco.ts` does not exist, esbuild reports it cannot resolve the entry point.

- [ ] **Step 3: Implement**

Create `src/lib/cybarco.ts`:

```ts
import { toTitleCaseName } from "@/lib/textCase";

/* Cybarco has no feed of any kind — no Drive, no XML, no API, and its
   WordPress REST API exposes only the default post types, so the `project`
   post type is invisible there. Everything below is parsed out of
   server-rendered HTML plus the Yoast sitemap. Measured 2026-09-10: the
   production VPS gets HTTP 200 with no cf-mitigated header, so unlike AGG this
   can run from the server. */

export type CybarcoStatus = "under_construction" | "ready" | "sold_out";

export type CybarcoCard = {
  slug: string;
  name: string;
  status: CybarcoStatus;
  priceFrom: number | null;
  district: string | null;
  featuredImage: string | null;
  description: string;
};

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
   .replace(/&#8211;|&ndash;/g, "–").replace(/&#8217;|&rsquo;/g, "'");

const strip = (s: string) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** Top-level EN project slugs, in sitemap order. No `/ru/`, no subpages. */
export function slugsFromSitemap(xml: string): string[] {
  const out: string[] = [];
  for (const m of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)) {
    const u = m[1];
    const hit = u.match(/^https:\/\/www\.cybarco\.com\/project\/([a-z0-9-]+)\/$/);
    if (hit) out.push(hit[1]);
  }
  return [...new Set(out)];
}

/* The site spells the same state four ways. Anything unrecognised is a hard
   error rather than a silent default: a new mark would otherwise import as
   "under construction" and quietly put a sold-out project back on sale. */
function normaliseStatus(mark: string): CybarcoStatus {
  const m = mark.toLowerCase().replace(/\s+/g, " ").trim();
  if (m.startsWith("sold")) return "sold_out";
  if (m.startsWith("ready")) return "ready";
  if (m.startsWith("under construction")) return "under_construction";
  throw new Error(`Cybarco: unrecognised status mark ${JSON.stringify(mark)}`);
}

/* "From €320,000 – Nicosia, Cyprus" / "Sold Out – Limassol, Cyprus" /
   "From €1,260,000 – Latchi, Pafos, Cyprus". The district is the segment
   before "Cyprus"; Latchi is a village in Pafos, so the LAST segment before
   the country is the one our `district` field means. */
function parseSubTitle(sub: string): { priceFrom: number | null; district: string | null } {
  const price = sub.match(/€\s*([\d,.]+)/);
  const priceFrom = price ? Number(price[1].replace(/[^\d]/g, "")) || null : null;
  const parts = sub.split(/\s+[–—-]\s+/);
  const tail = parts.length > 1 ? parts[parts.length - 1] : "";
  const segs = tail.split(",").map((s) => s.trim()).filter(Boolean);
  const withoutCountry = segs.filter((s) => !/^cyprus$/i.test(s));
  const district = withoutCountry.length ? withoutCountry[withoutCountry.length - 1] : null;
  return { priceFrom, district };
}

/* Four of the six sold-out cards no longer link anywhere — Cybarco redirects
   their pages (sea-gallery-villas and the-oval to a listing, aktea-residences-2
   and -3 to aktea-residences-4). Their slug is recovered by matching the card's
   own name against the sitemap, never by slugifying the display name: a derived
   slug that drifts re-keys the project and creates a duplicate Development. */
function resolveSlug(name: string, linked: string | null, sitemap: string[]): string {
  if (linked) return linked;
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const hit = sitemap.find((s) => s.replace(/-/g, "") === key);
  if (hit) return hit;
  throw new Error(`Cybarco: no sitemap slug for unlinked card ${JSON.stringify(name)}`);
}

export function parseListing(html: string, sitemapXml: string): CybarcoCard[] {
  const sitemap = slugsFromSitemap(sitemapXml);
  const cards: CybarcoCard[] = [];
  for (const chunk of html.split('<div class="project">').slice(1)) {
    const one = (re: RegExp) => chunk.match(re)?.[1] ?? "";
    const name = toTitleCaseName(strip(one(/<h3[^>]*>([\s\S]*?)<\/h3>/)));
    if (!name) continue;
    const linked = chunk.match(/href="https:\/\/www\.cybarco\.com\/project\/([a-z0-9-]+)\/"/)?.[1] ?? null;
    const mark = strip(one(/<span class="mark">([\s\S]*?)<\/span>/));
    const sub = strip(one(/<span class="sub-title">([\s\S]*?)<\/span>/));
    const { priceFrom, district } = parseSubTitle(sub);
    cards.push({
      slug: resolveSlug(name, linked, sitemap),
      name,
      status: normaliseStatus(mark),
      priceFrom,
      district,
      featuredImage: one(/data-bg="([^"]+)"/) || null,
      description: strip(one(/<div class="desktop-hover">\s*<p>([\s\S]*?)<\/p>/)),
    });
  }
  return cards;
}
```

- [ ] **Step 4: Run the test**

Run: `node scripts/qa/cybarco-parse-check.mjs`
Expected: PASS on all assertions.

- [ ] **Step 5: Mutation-test**

Make `resolveSlug` return `""` for an unlinked card instead of consulting the sitemap; re-run and expect `every card has a slug` and `slugs are unique` to FAIL. Revert.

Then make `normaliseStatus` return `"under_construction"` for an unrecognised mark instead of throwing, and change one `Sold out` in the fixture to `Sold—out`; expect `6 sold out` to FAIL. Revert both.

Note for whoever runs these: a mutation that swaps the sitemap lookup for slugifying the display name does NOT kill any assertion today, because every one of the four unlinked names happens to slugify to its real slug. That is precisely why the lookup exists rather than the shortcut — it is protection against future drift, not against today's data — and it is why the mutation above targets the slug being present at all.

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/cybarco.ts scripts/qa/cybarco-parse-check.mjs
git commit -m "Parse Cybarco's project listing into 15 records with resolved slugs"
```

---

### Task 4: `cybarco.ts` — project pages, galleries and PDF discovery

**Files:**
- Modify: `src/lib/cybarco.ts`
- Modify: `scripts/qa/cybarco-parse-check.mjs`

**Interfaces:**
- Consumes: `CybarcoCard` from Task 3.
- Produces:
  - `export type CybarcoDetail = { images: string[]; priceListUrl: string | null; brochureUrl: string | null; description: string }`
  - `export function parseProjectPage(html: string): CybarcoDetail`
  - `export function parseGallery(html: string): string[]`
  - `export function priceListDate(url: string): string | null` — the `DDMMYY` stamp as `YYYY-MM-DD`, or null.

- [ ] **Step 1: Write the failing test**

Append to `scripts/qa/cybarco-parse-check.mjs`, before the exit lines:

```js
const detail = CB.parseProjectPage(fx("project-naftikos.html"));
check("naftikos price list found",
  detail.priceListUrl,
  "https://www.cybarco.com/wp-content/uploads/2021/03/Naftikos-Residences-Pricelist-ENG-280826.pdf");
check("naftikos brochure found",
  detail.brochureUrl,
  "https://www.cybarco.com/wp-content/uploads/2025/03/Naftikos-Residences-Brochure.pdf");
check("brochure is not mistaken for the price list",
  detail.brochureUrl.includes("Pricelist"), false);
check("naftikos has images", detail.images.length > 0, true);
check("images are absolute uploads URLs",
  detail.images.every((u) => u.startsWith("https://www.cybarco.com/wp-content/uploads/")), true);
check("images are de-duplicated", new Set(detail.images).size, detail.images.length);
check("no WordPress size suffixes survive",
  detail.images.some((u) => /-\d{2,4}x\d{2,4}\.(jpe?g|png|webp)$/i.test(u)), false);

/* Measured 2026-09-10: the gallery page carries 187 unique images against 21
   on the project page. For three sold-out projects whose project page is gone
   it is the only image source there is. */
const gallery = CB.parseGallery(fx("gallery-trilogy.html"));
check("trilogy gallery is the rich source", gallery.length >= 150, true);
check("gallery images de-duplicated", new Set(gallery).size, gallery.length);

/* The filename stamp is the change signal — the sitemap has no usable lastmod. */
check("price-list date parsed",
  CB.priceListDate("https://www.cybarco.com/wp-content/uploads/2021/03/Naftikos-Residences-Pricelist-ENG-280826.pdf"),
  "2026-08-28");
check("price-list date, September",
  CB.priceListDate("https://www.cybarco.com/wp-content/uploads/2021/03/Centro-Limassol-Pricelist-RU-040926.pdf"),
  "2026-09-04");
check("no stamp -> null", CB.priceListDate("https://www.cybarco.com/x/Brochure.pdf"), null);
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node scripts/qa/cybarco-parse-check.mjs`
Expected: FAIL with `CB.parseProjectPage is not a function`.

- [ ] **Step 3: Implement**

Append to `src/lib/cybarco.ts`:

```ts
export type CybarcoDetail = {
  images: string[];
  priceListUrl: string | null;
  brochureUrl: string | null;
  description: string;
};

const UPLOAD_IMG_RE = /https:\/\/www\.cybarco\.com\/wp-content\/uploads\/[^"')\s]+?\.(?:jpe?g|png|webp)/gi;

/* WordPress serves the same picture at several sizes, "…-768x511.jpg" next to
   the original. Stripping the suffix collapses them to one URL and asks for the
   largest file the site holds. Measured 2026-09-10, Cybarco's originals run
   774x514 to 1550x719 — all below imageMirror's 1920 px ceiling, so nothing is
   downscaled on our side and nothing is gained by asking for more. */
const originalUrl = (u: string) => u.replace(/-\d{2,4}x\d{2,4}(?=\.(?:jpe?g|png|webp)$)/i, "");

function imagesFrom(html: string): string[] {
  return [...new Set((html.match(UPLOAD_IMG_RE) ?? []).map(originalUrl))];
}

const pdfLinks = (html: string) =>
  [...new Set([...html.matchAll(/href="(https:\/\/www\.cybarco\.com\/wp-content\/uploads\/[^"]+?\.pdf)"/gi)].map((m) => m[1]))];

export function parseProjectPage(html: string): CybarcoDetail {
  const pdfs = pdfLinks(html);
  const priceListUrl = pdfs.find((u) => /pricelist/i.test(u)) ?? null;
  return {
    images: imagesFrom(html),
    priceListUrl,
    brochureUrl: pdfs.find((u) => u !== priceListUrl) ?? null,
    description: strip(html.match(/<div class="desktop-hover">\s*<p>([\s\S]*?)<\/p>/)?.[1] ?? ""),
  };
}

export function parseGallery(html: string): string[] {
  return imagesFrom(html);
}

/* "…-Pricelist-ENG-280826.pdf" — DDMMYY, and the only change signal the site
   offers: the sitemap carries no usable lastmod. A new list is a new filename. */
export function priceListDate(url: string): string | null {
  const m = url.match(/-(\d{2})(\d{2})(\d{2})\.pdf$/i);
  if (!m) return null;
  const [, dd, mm, yy] = m;
  const month = Number(mm), day = Number(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `20${yy}-${mm}-${dd}`;
}
```

- [ ] **Step 4: Run the test**

Run: `node scripts/qa/cybarco-parse-check.mjs`
Expected: PASS.

- [ ] **Step 5: Mutation-test**

Change `priceListUrl` selection from `/pricelist/i` to `/pdf/i` and re-run; expect `naftikos price list found` and `brochure is not mistaken for the price list` to FAIL. Revert. Remove the `originalUrl` call from `imagesFrom` and re-run; expect `no WordPress size suffixes survive` to FAIL. Revert.

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/cybarco.ts scripts/qa/cybarco-parse-check.mjs
git commit -m "Read Cybarco project pages, galleries and dated price-list links"
```

---

### Task 5: The price-list reader — prices and statuses

The riskiest component. Split across Tasks 5 and 6 so a reviewer can reject the cell-level reading without rejecting the table-level assembly.

**Files:**
- Create: `src/lib/ai/cybarcoPriceTable.ts`
- Create: `scripts/qa/cybarco-pricelist-check.mjs`

**Interfaces:**
- Consumes: `PdfPage`, `PdfRow`, `PdfCell`, `UnitStatus` — imported as types only from `src/lib/ai/availabilityTable.ts`, which must not be modified.
- Produces:
  - `export function cybarcoParsePrice(raw: string): number | null`
  - `export function cybarcoReadOutcome(raw: string): { status: UnitStatus; price: number | null } | null`
  - `export function joinColumn(row: PdfRow, x0: number, x1: number): string`

- [ ] **Step 1: Write the failing test**

Create `scripts/qa/cybarco-pricelist-check.mjs` with the same harness preamble as `scripts/qa/gv-pricelist-check.mjs`, then:

```js
const CP = await import(await bundle("src/lib/ai/cybarcoPriceTable.ts", "cybarco-price-table"));

/* Every string below was read off a real Cybarco price list on 2026-09-10.
   The fragmented ones are the point: pdf.js hands back "5", "60", ",", "0",
   "00" as separate cells for a single price, and a reader that joins cell TEXT
   instead of clustering by x reported Aktea 4 as having zero available units.
   It has several. */
check("plain grouped price", CP.cybarcoParsePrice("990,000"), 990000);
check("fragmented, joined", CP.cybarcoParsePrice("5 60 , 0 00"), 560000);
check("fragmented with leading group", CP.cybarcoParsePrice("600 ,000"), 600000);
check("fragmented, three groups", CP.cybarcoParsePrice("3 70 ,000"), 370000);
check("millions", CP.cybarcoParsePrice("3,900,000"), 3900000);
check("euro sign tolerated", CP.cybarcoParsePrice("€ 1,260,000"), 1260000);
check("area is not a price", CP.cybarcoParsePrice("119"), null);
check("zero is not a price", CP.cybarcoParsePrice("0"), null);
check("empty", CP.cybarcoParsePrice(""), null);
check("status word is not a price", CP.cybarcoParsePrice("SOLD"), null);

check("SOLD", CP.cybarcoReadOutcome("SOLD"), { status: "sold", price: null });
check("RESERVED", CP.cybarcoReadOutcome("RESERVED"), { status: "reserved", price: null });
check("price means available", CP.cybarcoReadOutcome("990,000"), { status: "available", price: 990000 });
/* Centro Limassol's linked price list is Russian. An English-only vocabulary
   read it as zero sold units. */
check("ПРОДАНО", CP.cybarcoReadOutcome("ПРОДАНО"), { status: "sold", price: null });
check("РЕЗЕРВ", CP.cybarcoReadOutcome("РЕЗЕРВ"), { status: "reserved", price: null });
check("ПЕРЕГОВОРЫ is reserved, not available",
  CP.cybarcoReadOutcome("ПЕРЕГОВОРЫ"), { status: "reserved", price: null });
check("noise yields nothing", CP.cybarcoReadOutcome("Notes:"), null);
check("area cell yields nothing", CP.cybarcoReadOutcome("155"), null);

const row = { y: 665, cells: [
  { x: 57.6, w: 26, t: "A 101" }, { x: 109.9, w: 14, t: "1st" },
  { x: 476.5, w: 10, t: "5" }, { x: 489.5, w: 20, t: "60" },
  { x: 505.0, w: 4, t: "," }, { x: 510.0, w: 6, t: "0" }, { x: 516.0, w: 12, t: "00" },
] };
check("column join respects x bounds", CP.joinColumn(row, 470, 540), "560,000");
check("column join is empty outside the band", CP.joinColumn(row, 200, 300), "");
check("column join keeps left-to-right order", CP.joinColumn(row, 50, 130), "A 1011st");
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node scripts/qa/cybarco-pricelist-check.mjs`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement**

Create `src/lib/ai/cybarcoPriceTable.ts`:

```ts
import type { PdfPage, PdfRow, UnitStatus } from "./availabilityTable";

/* A price-list reader for Cybarco, self-contained on purpose.
   availabilityTable.ts (Korantina) and gvPriceTable.ts (G&V) read the same
   FAMILY of document — status printed as text inside the price column — but
   the one attempt to serve two developers from one engine, during the G&V
   build, produced three Korantina regressions that only a live dry-run caught:
   City Landmark 33 units to 1, Inner City 3 gaining a duplicate Development
   through a shifted table ordinal, Royal Bay 43 to 42. A third reader is
   cheaper than a fourth regression. Neither of the other two files is touched.

   Everything here was measured against five real Cybarco price lists captured
   on 2026-09-10 (scripts/qa/fixtures/cybarco/pl-*.json). */

/** All cells whose left edge falls in [x0, x1), joined left to right. */
export function joinColumn(row: PdfRow, x0: number, x1: number): string {
  return row.cells
    .filter((c) => c.x >= x0 && c.x < x1)
    .sort((a, b) => a.x - b.x)
    .map((c) => c.t.trim())
    .join("");
}

/* pdf.js splits a single printed price across several cells — "5", "60", ",",
   "0", "00" for 560,000 — so the input here is already the JOINED column, and
   the separators are whatever survived that join. Anything under four digits is
   refused: an area of 119 m² and a plot of 1035 m² sit in neighbouring columns,
   and reading one as a price is worse than reading nothing. */
export function cybarcoParsePrice(raw: string): number | null {
  const s = (raw || "").replace(/[€$£]/g, "").replace(/\s/g, "").trim();
  if (!s) return null;
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const digits = s.replace(/[.,]/g, "");
  if (!/^\d{4,9}$/.test(digits)) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* Status vocabulary, English and Russian. Centro Limassol's linked list is
   Russian throughout; "ПЕРЕГОВОРЫ" (under negotiation) is treated as reserved
   because it is emphatically not a unit anyone can buy today, and reserved is
   its own status by operator decision (2026-09-10). */
const SOLD_RE = /^(SOLD(\s*OUT)?|ПРОДАНО)$/i;
const RESERVED_RE = /^(RESERVED|RESERVE|РЕЗЕРВ|ПЕРЕГОВОРЫ)$/i;

export function cybarcoReadOutcome(raw: string): { status: UnitStatus; price: number | null } | null {
  const s = (raw || "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  if (SOLD_RE.test(s)) return { status: "sold", price: null };
  if (RESERVED_RE.test(s)) return { status: "reserved", price: null };
  const price = cybarcoParsePrice(s);
  return price === null ? null : { status: "available", price };
}
```

The fixture row above is the fragmented price from a real Aktea 4 line: five cells — `"5"`, `"60"`, `","`, `"0"`, `"00"` — that a text-joining reader reads as nothing and a column-joining reader reads as `"560,000"`. Task 6 supplies the real column bounds from the header row rather than the hand-picked ones used here.

- [ ] **Step 4: Run the test**

Run: `node scripts/qa/cybarco-pricelist-check.mjs`
Expected: PASS.

- [ ] **Step 5: Mutation-test**

Lower the digit floor in `cybarcoParsePrice` from `{4,9}` to `{1,9}` and re-run; expect `area is not a price` and `zero is not a price` to FAIL. Revert. Remove `ПРОДАНО` from `SOLD_RE` and re-run; expect the `ПРОДАНО` assertion to FAIL. Revert. Remove the `.sort((a, b) => a.x - b.x)` from `joinColumn`, reverse the fixture row's cell order, and re-run; expect `column join keeps left-to-right order` to FAIL. Revert.

- [ ] **Step 6: Prove the frozen files are untouched, typecheck, commit**

```bash
git diff --stat origin/main -- src/lib/ai/availabilityTable.ts src/lib/ai/gvPriceTable.ts
npx tsc --noEmit
git add src/lib/ai/cybarcoPriceTable.ts scripts/qa/cybarco-pricelist-check.mjs
git commit -m "Read Cybarco prices and statuses, including fragmented cells and Russian"
```

Expected: the `git diff --stat` prints nothing.

---

### Task 6: The price-list reader — tables and units

**Files:**
- Modify: `src/lib/ai/cybarcoPriceTable.ts`
- Modify: `scripts/qa/cybarco-pricelist-check.mjs`

**Interfaces:**
- Consumes: `joinColumn`, `cybarcoReadOutcome` from Task 5.
- Produces:
  - `export type CybarcoUnit = { ref: string; block: string | null; floor: string | null; beds: string | null; areaInternal: string | null; areaVeranda: string | null; areaBuilt: string | null; areaPlot: string | null; price: number | null; status: UnitStatus }`
  - `export function cybarcoUnitsFromPages(pages: PdfPage[]): CybarcoUnit[]`

- [ ] **Step 1: Write the failing test**

Append to `scripts/qa/cybarco-pricelist-check.mjs`:

```js
const plx = (n) => JSON.parse(readFileSync(join(ROOT, "scripts/qa/fixtures/cybarco", `pl-${n}.json`), "utf8"));
const units = (n) => CP.cybarcoUnitsFromPages(plx(n));

/* Ground truth: counted by hand off the PDFs on 2026-09-10. If this block
   fails, the reader is wrong — the numbers are not negotiable.
   REPLACE the placeholders below with the hand counts before implementing:
   open each PDF, count rows per status, and write the real figures in. */
const NAFTIKOS = units("naftikos");
check("naftikos: every unit has a ref", NAFTIKOS.every((u) => !!u.ref), true);
check("naftikos: refs unique", new Set(NAFTIKOS.map((u) => u.ref)).size, NAFTIKOS.length);
check("naftikos: A 101 price", NAFTIKOS.find((u) => u.ref === "A 101").price, 990000);
check("naftikos: A 101 status", NAFTIKOS.find((u) => u.ref === "A 101").status, "available");
check("naftikos: A 101 beds", NAFTIKOS.find((u) => u.ref === "A 101").beds, "3");
check("naftikos: A 101 internal area", NAFTIKOS.find((u) => u.ref === "A 101").areaInternal, "119");
check("naftikos: A 101 total covered", NAFTIKOS.find((u) => u.ref === "A 101").areaBuilt, "155");
check("naftikos: A 102 is reserved", NAFTIKOS.find((u) => u.ref === "A 102").status, "reserved");
check("naftikos: A 103 is sold", NAFTIKOS.find((u) => u.ref === "A 103").status, "sold");
check("naftikos: block carried from the BUILDING heading",
  NAFTIKOS.find((u) => u.ref === "A 101").block, "BUILDING A");

/* Aktea 4 is the fragmented-price document. A text-joining reader found zero
   available units here; there are several. */
const AKTEA = units("aktea4");
check("aktea4: has available units", AKTEA.some((u) => u.status === "available"), true);
check("aktea4: 101 price survives fragmentation", AKTEA.find((u) => u.ref === "101").price, 560000);
check("aktea4: 201 price survives fragmentation", AKTEA.find((u) => u.ref === "201").price, 600000);
check("aktea4: 102 is sold", AKTEA.find((u) => u.ref === "102").status, "sold");
check("aktea4: 103 is reserved", AKTEA.find((u) => u.ref === "103").status, "reserved");

/* Centro is Russian throughout. */
const CENTRO = units("centro-ru");
check("centro: has sold units", CENTRO.some((u) => u.status === "sold"), true);
check("centro: 101 price", CENTRO.find((u) => u.ref === "101").price, 530000);
check("centro: 102 is sold", CENTRO.find((u) => u.ref === "102").status, "sold");
check("centro: no unit is left status-less", CENTRO.every((u) => !!u.status), true);

/* Villas: a different shape, with Plot Area m². */
const AKAMAS = units("akamas-villas");
check("akamas: plot area captured", AKAMAS.find((u) => u.ref === "7").areaPlot, "1035");
check("akamas: villa 7 is sold", AKAMAS.find((u) => u.ref === "7").status, "sold");
check("akamas: every unit has a plot", AKAMAS.every((u) => !!u.areaPlot), true);

/* Limassol Marina lists ONLY available properties, has several sections in one
   document, and extra columns. Absent sold rows must not be read as an empty
   project, and the sections must not become several projects. */
const MARINA = units("marina");
check("marina: units found", MARINA.length > 0, true);
check("marina: no sold rows in an available-only list",
  MARINA.some((u) => u.status === "sold"), false);
check("marina: B22 is reserved", MARINA.find((u) => u.ref === "B22").status, "reserved");
check("marina: B31 price", MARINA.find((u) => u.ref === "B31").price, 5700000);
check("marina: sections become blocks, not projects",
  new Set(MARINA.map((u) => u.block)).size > 1, true);

/* Nothing may be silently dropped: totals are asserted so a regression that
   loses a building shows up as a number, not as a missing row nobody notices. */
check("naftikos total", NAFTIKOS.length, /* HAND COUNT */ 0);
check("aktea4 total", AKTEA.length, /* HAND COUNT */ 0);
check("centro total", CENTRO.length, /* HAND COUNT */ 0);
check("akamas total", AKAMAS.length, /* HAND COUNT */ 0);
check("marina total", MARINA.length, /* HAND COUNT */ 0);
```

- [ ] **Step 2: Replace the hand counts before writing any implementation**

Open each of the five PDFs and count. Write the real numbers into the five `HAND COUNT` slots and delete the comment markers. Do this **before** implementing, so the implementation is measured against the documents rather than the documents against the implementation.

```bash
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
curl -s -A "$UA" -o /tmp/naftikos.pdf https://www.cybarco.com/wp-content/uploads/2021/03/Naftikos-Residences-Pricelist-ENG-280826.pdf
open /tmp/naftikos.pdf   # and the other four
```

A rough automated count across all nine lists gave 236 units — 48 available, 18 reserved, 170 sold — but that same method produced two wrong numbers (Aktea 4 as zero-available, Centro as zero-sold), so it is a sanity bound, not ground truth.

- [ ] **Step 3: Run it and watch it fail**

Run: `node scripts/qa/cybarco-pricelist-check.mjs`
Expected: FAIL with `CP.cybarcoUnitsFromPages is not a function`.

- [ ] **Step 4: Implement**

Append to `src/lib/ai/cybarcoPriceTable.ts`:

```ts
export type CybarcoUnit = {
  ref: string;
  block: string | null;
  floor: string | null;
  beds: string | null;
  areaInternal: string | null;
  areaVeranda: string | null;
  areaBuilt: string | null;
  areaPlot: string | null;
  price: number | null;
  status: UnitStatus;
};

/* Column bounds come from the header row, never from fixed offsets: the five
   documents differ in width, column count and order, and Limassol Marina adds
   Sundeck, Pool/Spa and berth columns the others do not have. A header cell's
   x marks where its column starts; the next header cell's x is where it ends. */
type Column = { key: keyof CybarcoUnit | "ignore"; x0: number; x1: number };

const HEADER_KEYS: [RegExp, Column["key"]][] = [
  [/^(apt\.?|villa)\s*no/i, "ref"],
  [/^апарт/i, "ref"],
  [/^floor/i, "floor"],
  [/^этаж/i, "floor"],
  [/bedroom/i, "beds"],
  [/^спальни/i, "beds"],
  [/plot\s*area/i, "areaPlot"],
  [/internal/i, "areaInternal"],
  [/крытая\s*площадь/i, "areaInternal"],
  [/terrace/i, "areaVeranda"],
  [/террас/i, "areaVeranda"],
  [/total\s*covered/i, "areaBuilt"],
  [/общая\s*крытая/i, "areaBuilt"],
  [/^price/i, "price"],
  [/^цена/i, "price"],
];

const BLOCK_RE = /^(BUILDING\s+[A-ZА-Я0-9]+|ЗДАНИЕ\s+[A-ZА-Я0-9]+|[A-Z][A-Za-z ]{3,30}(Residences|Villas))$/;
const REF_RE = /^(?:[A-Z]{1,3}\s?)?\d{1,4}$/;

/* A price list is read page by page. Each page contributes its own header (the
   villa and apartment shapes differ) and carries the last BUILDING/section
   heading forward, because a unit's block is printed once above its run of
   rows, not on every row. */
export function cybarcoUnitsFromPages(pages: PdfPage[]): CybarcoUnit[] {
  const out: CybarcoUnit[] = [];
  for (const page of pages) {
    let columns: Column[] | null = null;
    let block: string | null = null;

    for (const row of page.rows) {
      const flat = row.cells.map((c) => c.t.trim()).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      if (!flat) continue;

      if (BLOCK_RE.test(flat)) { block = flat; continue; }

      const header = headerFrom(row, page.width);
      if (header) { columns = header; continue; }
      if (!columns) continue;

      const value = (key: Column["key"]) => {
        const col = columns!.find((c) => c.key === key);
        return col ? joinColumn(row, col.x0, col.x1).trim() : "";
      };
      const ref = value("ref");
      if (!REF_RE.test(ref.replace(/\s+/g, " ").trim())) continue;

      const outcome = cybarcoReadOutcome(value("price"));
      if (!outcome) continue;

      out.push({
        ref: ref.replace(/\s+/g, " ").trim(),
        block,
        floor: value("floor") || null,
        beds: value("beds") || null,
        areaInternal: value("areaInternal") || null,
        areaVeranda: value("areaVeranda") || null,
        areaBuilt: value("areaBuilt") || null,
        areaPlot: value("areaPlot") || null,
        price: outcome.price,
        status: outcome.status,
      });
    }
  }
  return out;
}

/* A header is recognised by content, not position: a row qualifies when at
   least a reference column and a price column are found in it. Cybarco splits
   headers across two or three printed lines ("Covered" above "Internal" above
   "Area m2"), so each header cell is matched independently and the row that
   contributes the price label wins. */
function headerFrom(row: PdfRow, pageWidth: number): Column[] | null {
  const hits: { key: Column["key"]; x: number }[] = [];
  for (const cell of row.cells) {
    const t = cell.t.trim();
    if (!t) continue;
    const match = HEADER_KEYS.find(([re]) => re.test(t));
    if (match) hits.push({ key: match[1], x: cell.x });
  }
  if (!hits.some((h) => h.key === "ref") || !hits.some((h) => h.key === "price")) return null;
  hits.sort((a, b) => a.x - b.x);
  return hits.map((h, i) => ({
    key: h.key,
    x0: i === 0 ? 0 : (h.x + hits[i - 1].x) / 2,
    x1: i === hits.length - 1 ? pageWidth : (h.x + hits[i + 1].x) / 2,
  }));
}
```

- [ ] **Step 5: Run the test and iterate against the fixtures**

Run: `node scripts/qa/cybarco-pricelist-check.mjs`
Expected: PASS. If a document does not yield its hand-counted total, fix the reader — never the expectation. The hand counts are ground truth; that rule is what caught the three Korantina regressions during the G&V build, and it is the only thing standing between a green suite and a quietly wrong import.

- [ ] **Step 6: Mutation-test**

Remove the `[/plot\s*area/i, "areaPlot"]` entry and re-run; expect the two Akamas plot assertions to FAIL. Revert. Change `REF_RE` to `/^\d+$/` and re-run; expect the Naftikos `A 101` assertions to FAIL. Revert. Make `block` reset to `null` on every row instead of carrying forward, and re-run; expect the Naftikos block assertion and the Marina sections assertion to FAIL. Revert.

- [ ] **Step 7: Prove the frozen files are untouched, typecheck, commit**

```bash
git diff --stat origin/main -- src/lib/ai/availabilityTable.ts src/lib/ai/gvPriceTable.ts
npx tsc --noEmit
git add src/lib/ai/cybarcoPriceTable.ts scripts/qa/cybarco-pricelist-check.mjs
git commit -m "Turn Cybarco price lists into units across five real document shapes"
```

---

### Task 7: `cybarcoSync.ts` with a dry run

**Files:**
- Create: `src/lib/cybarcoSync.ts`

**Interfaces:**
- Consumes: `parseListing`, `parseProjectPage`, `parseGallery`, `priceListDate`, `CybarcoCard` (Tasks 3–4); `cybarcoUnitsFromPages` (Task 6); `readPdfPages` from `src/lib/ai/availabilityTable.ts` (imported, not modified); `storeUploadedImage`, `devKeyFor`, `pdfPagesToJpegs`, `beginSyncWindow` from `src/lib/imageMirror.ts`; `recomputeDevelopmentDerivedState` (Task 1).
- Produces:
  - `export type CybarcoDryRun = { slug: string; name: string; status: CybarcoStatus; district: string | null; images: number; plans: number; units: number; available: number; reserved: number; sold: number; priceListDate: string | null; slugFree: boolean }[]`
  - `export async function dryRunCybarcoSync(): Promise<CybarcoDryRun>`
  - `export async function syncCybarco(accountId: string, opts?: { force?: boolean }): Promise<{ ok: boolean; projects: number; units: number; created: number; notes: string[] }>`

- [ ] **Step 1: Write the dry run first and run it against the live site**

The dry run reads the live site and the production database but **writes nothing**. It is the gate that caught three regressions in the G&V build after every synthetic test was green, so it exists before the writing path does.

Create `src/lib/cybarcoSync.ts` with `dryRunCybarcoSync()` only: fetch the listing and sitemap, parse the 15 cards, fetch each project page and gallery, read each price list through the worker, and report per project — image count, plan count, unit count and status split, price-list date, and whether the slug is already taken in `Development` or `Project`.

Fetch helper, used for every request in this file:

```ts
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
async function get(url: string): Promise<string> {
  const r = await fetch(url, { headers: { "user-agent": UA }, cache: "no-store" });
  if (!r.ok) throw new Error(`Cybarco: ${r.status} for ${url}`);
  return r.text();
}
```

- [ ] **Step 2: Run the dry run and check it against this plan's own numbers**

Write a throwaway runner in the repo (Node cannot resolve `esbuild` from outside the tree) and run it:

```bash
node --env-file=.env.local scripts/tmp-cybarco-dryrun.mjs
```

Expected, from the spike on 2026-09-10 — treat a mismatch as a finding, not as noise:
- 15 projects, 9 not sold out, 6 sold out.
- Price lists for exactly the 9 non-sold-out projects.
- Trilogy ≥ 150 images; Limassol Marina ≈ 63; Akamas Bay ≈ 36; Aktea 2 ≈ 18; Aktea 3 ≈ 16; The Oval ≈ 10; Sea Gallery Villas 1.
- All 15 slugs free in both `Development` and `Project`.
- Unit totals matching Task 6's hand counts for the five fixture projects.

- [ ] **Step 3: Add the writing path**

Add `syncCybarco()`. Rules, each with a reason:

```ts
/* Held across the whole run and released in finally. scheduleAppRestart() does
   a hard pm2 restart and cuts every in-flight request; on 2026-08-25 the 04:00
   feed-sync killed a manual Drive import at project 11 of 16. A long import
   must neither be killed nor kill (FEED-ADAPTER-GUIDE §4). */
const release = await beginSyncWindow("cybarco-sync");
try { /* … */ } finally { release(); }
```

- `feedKey` is `` `cybarco:${card.slug}` ``, `feedProjectId` is `card.slug`, `dev` is `"cybarco"`.
- `publicName` is `card.name`, already title-cased by `parseListing`.
- `stage` is `"Under construction"` for `under_construction` and `"Ready to move in"` for `ready`; left untouched for `sold_out`.
- Gallery preference: gallery page if it has images, else the project page, else `[card.featuredImage]`.
- Plans: brochure PDF pages via `pdfPagesToJpegs`. **Do not use `imageMirror.pdfPagesToJpegs` on a developer machine without checking**: it shells out to `pdftoppm`, which is absent locally and returns `[]` on failure — the first real Marfields run created four projects with zero plans and reported nothing wrong. On the VPS it is present. Log a note per PDF that yields no page.
- Units: only for projects with a price list. Wipe and recreate `source: "feed"` units, `sortIndex` in document order.
- A published Development keeps its curated `gallery`, `plans` and the frozen content fields; units and prices still sync.
- Call `recomputeDevelopmentDerivedState()` per project at the end.
- For the six sold-out projects, set `soldOutSince` explicitly when it is null. Task 1 makes that stick.
- **Never wire this developer into `markProjectsMissingFromFeedSoldOut()`**: Cybarco's sold-out projects stay on the listing with a "Sold Out" mark rather than disappearing, so "missing from the feed" here means Cybarco removed the project — a different event, to be reported, not acted on.

- [ ] **Step 4: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/cybarcoSync.ts
git commit -m "Sync Cybarco: 15 projects, their media and their units"
```

---

### Task 8: Cron route and account

**Files:**
- Create: `src/app/api/cron/cybarco-sync/route.ts`
- Modify: `DEPLOYMENT.md`

**Interfaces:**
- Consumes: `syncCybarco`, `dryRunCybarcoSync` (Task 7).
- Produces: `GET /api/cron/cybarco-sync?key=$CRON_SECRET[&force=1]`.

- [ ] **Step 1: Write the route**

Model it on `src/app/api/cron/korantina-sync/route.ts`: same `CRON_SECRET` string comparison, `withCronLog`, `shouldNotifyFailureStreak` / `markFailureStreakNotified`, `buildCronFailureMessage` + `sendFeedNotification`, `export const dynamic = "force-dynamic"`, and `export const maxDuration = 300` — a first run mirrors several hundred images and rasterises eleven brochures.

Header comment must state the schedule and why it does not collide:

```
// Scheduled at `0 1 * * *`. The nightly chain starts at 02:00 (psi-sync) and
// runs through 06:30, so 01:00 is the only slot with a clear hour ahead of it —
// and a first Cybarco run mirrors several hundred images.
```

- [ ] **Step 2: Verify the auth by string comparison, not by calling it**

A valid `CRON_SECRET` runs the job immediately; there is no dry parameter, and invented ones like `&noop=1` are ignored. Read the route and confirm the key check matches `korantina-sync` exactly. Test deployment later with a WRONG key and expect 401, never 404.

- [ ] **Step 3: Create the developer account**

```bash
node --env-file=.env.local scripts/tmp-cybarco-account.mjs
```

The script upserts a `DeveloperAccount` with `slug: "cybarco"`, `name: "Cybarco"`, and no `driveFolderUrl` (there is no drive). This is the first production write in the plan and it is additive.

- [ ] **Step 4: Document the cron line**

Add to `DEPLOYMENT.md`'s cron table:

```
| `0 1 * * *` | `cybarco-sync` (website + price-list PDFs → 15 Developments; see src/lib/cybarcoSync.ts) | production, `?key=$CRON_SECRET` — 01:00 keeps a clear hour before psi-sync at 02:00; a first run mirrors several hundred images |
```

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/app/api/cron/cybarco-sync/route.ts DEPLOYMENT.md
git commit -m "Nightly Cybarco cron at 01:00, ahead of the existing chain"
```

---

### Task 9: Acceptance against the source, then hand over

**Files:** none changed unless a defect is found.

- [ ] **Step 1: Run every check**

```bash
node scripts/qa/cybarco-parse-check.mjs
node scripts/qa/cybarco-pricelist-check.mjs
node scripts/qa/sold-out-sweep-check.mjs
node scripts/qa/availability-table-check.mjs
node scripts/qa/gv-pricelist-check.mjs
node scripts/qa/freeze-published-check.mjs
```

Expected: all PASS. The last three prove the two existing readers and the freeze still behave.

- [ ] **Step 2: Prove the frozen readers are byte-identical**

```bash
git diff --stat origin/main -- src/lib/ai/availabilityTable.ts src/lib/ai/gvPriceTable.ts
```

Expected: no output.

- [ ] **Step 3: Cross-check two projects against the second source**

`/project/akamas-bay-villas/properties/` and `/project/trilogy-limassol-seafront/properties/` embed a JSON array of available units. Compare the refs and prices our reader produced for those two projects against it. Akamas Bay agreed exactly during the spike — six available villas, `ABV48` and `ABV47` at 1,260,000. A disagreement is a defect in the reader, not in the JSON.

- [ ] **Step 4: Report, do not deploy**

Report per project: images, plans, units and status split, and anything the connector could not supply. State plainly that all 15 will fail the publish gate on "Map location set" — Cybarco's `/location/` pages carry no coordinates — and that descriptions exist only in EN and RU, so DE and PL must be generated. Then stop: deploying is the operator's call.

---

## Self-Review

**Spec coverage.** Access and UA — Global Constraints, Task 7 Step 1. Listing and 15 projects — Task 3. Sitemap slugs for unlinked cards — Task 3. Project pages, galleries, PDF discovery, date stamps — Task 4. All four price-list quirks — Tasks 5 and 6 (fragmented cells, Russian vocabulary, available-only multi-section, two table shapes). `/properties/` as cross-check only — Task 9 Step 3. Identity and field mapping — Tasks 3 and 7. Reserved as its own status — Task 5 vocabulary, Task 7 write path. Sold-out for unit-less projects plus the derived-state bug — Task 1 and Task 7 Step 3. Freeze, `beginSyncWindow`, no missing-from-feed sweep — Task 7 Step 3. Own cron route — Task 8. Acceptance method — Task 9. Frozen readers — Global Constraints and Tasks 5, 6, 9. The three stated limitations (no coordinates, EN/RU only, modest resolution) — Task 9 Step 4 and Task 4's comment.

**Placeholders.** The five `HAND COUNT` slots in Task 6 are deliberate and Step 2 of that task is the instruction to fill them from the documents before implementing; leaving them at `0` fails the suite loudly. No other TBDs.

**Type consistency.** `CybarcoCard`, `CybarcoStatus`, `CybarcoDetail`, `CybarcoUnit`, `CybarcoDryRun` are each defined once and referenced by the same name afterwards. `joinColumn(row, x0, x1)`, `cybarcoParsePrice(raw)`, `cybarcoReadOutcome(raw)` and `cybarcoUnitsFromPages(pages)` keep their Task 5/6 signatures in Task 7. `PdfPage` / `PdfRow` / `PdfCell` / `UnitStatus` are imported as types from `availabilityTable.ts`, which stays byte-identical.
