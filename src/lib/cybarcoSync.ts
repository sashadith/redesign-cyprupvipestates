import { prisma } from "@/lib/prisma";
import {
  parseListing, parseProjectPage, parseGallery, priceListDate,
  type CybarcoCard, type CybarcoDetail, type CybarcoStatus,
} from "./cybarco";
import { cybarcoUnitsFromPages, type CybarcoUnit } from "./ai/cybarcoPriceTable";
import { readPdfPages } from "./ai/availabilityTable";
import { storeUploadedImage, devKeyFor, pdfPagesToJpegs, beginSyncWindow, scheduleAppRestart } from "./imageMirror";
import { recomputeDevelopmentDerivedState } from "./developmentDerivedState";
import { developmentSlug } from "./developmentSeo";

/* Cybarco's sync (2026-09-11).

   Cybarco have no feed of any kind — no Drive, no XML, no API, not even a
   usable WordPress REST endpoint (see src/lib/cybarco.ts). The source is the
   public website: one listing page of 15 cards, one page per project, one
   gallery page per project, and a dated PDF price list per project that is
   still selling. src/lib/cybarco.ts turns HTML into records and
   src/lib/ai/cybarcoPriceTable.ts turns a price list into units; this file is
   the only part that touches the database or the filesystem.

   Three properties of this source shaped everything below.

   1. FOUR OF THE SIX SOLD-OUT PROJECTS NO LONGER HAVE A PAGE, and Cybarco
      REDIRECTS their URLs rather than 404ing them: /project/aktea-residences-2/
      and -3 land on aktea-residences-4, /project/sea-gallery-villas/ and
      /project/the-oval/ land on a listing. A plain fetch follows the redirect
      and returns 200 with ANOTHER PROJECT'S markup — which would have given
      Aktea 2 and Aktea 3 Aktea 4's photos AND Aktea 4's price list, i.e. live
      units on two sold-out projects. Every page fetch here therefore compares
      the response's final URL with the one it asked for (`fetchSlugPage`) and
      treats a move as "no page", never as content.

   2. A PRICE LIST THAT READS AS ZERO UNITS IS A DEFECT, NOT AN EMPTY PROJECT.
      The reader yields nothing at all from a page whose header it cannot
      recognise (Task 6's finding, deliberate — guessing a column layout is
      worse), so a vocabulary change on Cybarco's side looks exactly like a
      project with no inventory. `unitWriteVerdict` refuses to wipe a project's
      units on such a collapse and reports it instead.

   3. SOLD OUT IS A MARK ON THE LISTING, NOT A DISAPPEARANCE. Cybarco keep a
      sold-out project on the listing page with a "Sold Out" mark. So this
      developer is NEVER wired into markProjectsMissingFromFeedSoldOut()
      (src/lib/soldOutSweeps.ts): "missing from the source" here means Cybarco
      removed the project from their own site, which is a different event and is
      reported, not acted on. The counterpart obligation is in this file: every
      project still on the listing gets its `syncedAt` stamped on every run,
      sold out or not, because that sweep is developer-agnostic and a Cybarco
      project left unstamped for five days would be swept by it regardless of
      anything written here.

   Everything writes DRAFT. A published Development keeps its curated gallery,
   plans and content fields (FROZEN_WHEN_PUBLISHED in feedSync.ts, restated
   locally — see `freezeForPublishedRow`); units and prices still sync. */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

const SITE = "https://www.cybarco.com";
const LISTING_URL = `${SITE}/project/`;
const SITEMAP_URL = `${SITE}/projects-sitemap.xml`;
const projectUrl = (slug: string) => `${SITE}/project/${slug}/`;
const galleryUrl = (slug: string) => `${SITE}/gallery/${slug}/`;

/* Every outbound request sends a normal desktop browser UA. Cybarco sit behind
   Cloudflare; what was measured on 2026-09-10 is that the production VPS gets
   HTTP 200 with no cf-mitigated header USING THIS UA. A bare Node or curl UA
   was never tested and must not be the thing a nightly cron depends on.

   Every request is also tried twice, a second apart. That is not defensive
   decoration: the first live dry run of this file lost 17 of Aktea Residences 2's
   18 photos to a single non-200 somewhere in a 45-request sweep, and the retry
   recovered all 18 on the next run. A whole run hangs off two of these calls (the
   listing and the sitemap), so a one-off refusal there would cost the night. */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
    return fn();
  }
}

async function get(url: string): Promise<string> {
  return withRetry(async () => {
    const r = await fetch(url, { headers: { "user-agent": UA }, cache: "no-store" });
    if (!r.ok) throw new Error(`Cybarco: ${r.status} for ${url}`);
    return r.text();
  });
}

async function getBuffer(url: string): Promise<Buffer> {
  return withRetry(async () => {
    const r = await fetch(url, { headers: { "user-agent": UA }, cache: "no-store" });
    if (!r.ok) throw new Error(`Cybarco: ${r.status} for ${url}`);
    return Buffer.from(await r.arrayBuffer());
  });
}

/* One page for one slug, classified rather than reduced to a string.

   `moved` is the reason this exists at all (see header note 1). fetch follows
   redirects and reports where it ended up in `r.url`; a final path different
   from the one asked for means this slug's page is gone and the body belongs to
   some OTHER project. Returning that body would attribute another project's
   photos, brochure and PRICE LIST to this one. Path comparison only — a protocol
   or host change (http->https, www) is not a move.

   `missing` and `error` are held apart deliberately. 404 is a fact about
   Cybarco's site: measured 2026-09-11, only six of the fifteen projects have a
   /gallery/<slug>/ page at all, and reporting the other nine every night would
   be noise the real problems then hide in. Anything else is a fact
   about THIS RUN — and the first live dry run proved why that distinction is
   needed: Aktea Residences 2's gallery page answers 200 with 18 photos from
   curl, yet one run of the 45-request sweep got a non-200 for it and the project
   silently fell back to the single picture on its listing card. A transient
   refusal that costs 17 photos must be retried and, if it persists, SAID. */
type PageFetch =
  | { kind: "ok"; html: string }
  | { kind: "moved"; to: string }
  | { kind: "missing"; status: number }
  | { kind: "error"; detail: string };

const MISSING_STATUS = new Set([404, 410]);

async function fetchSlugPageOnce(url: string): Promise<PageFetch> {
  let r: Response;
  try {
    r = await fetch(url, { headers: { "user-agent": UA }, cache: "no-store" });
  } catch (e) {
    return { kind: "error", detail: (e as Error).message };
  }
  if (MISSING_STATUS.has(r.status)) return { kind: "missing", status: r.status };
  if (!r.ok) return { kind: "error", detail: `HTTP ${r.status}` };
  const want = new URL(url).pathname.replace(/\/+$/, "");
  const got = new URL(r.url).pathname.replace(/\/+$/, "");
  if (want !== got) return { kind: "moved", to: r.url };
  try {
    return { kind: "ok", html: await r.text() };
  } catch (e) {
    return { kind: "error", detail: `body: ${(e as Error).message}` };
  }
}

/* Retried only for `error`, never for `missing` or `moved` — those two are the
   site's settled answer and asking again cannot change them. Hand-rolled rather
   than routed through withRetry() above because a 404 here must NOT be retried
   and must not throw: nine of the fifteen gallery pages legitimately do not
   exist. Two attempts, a second apart: enough for a Cloudflare hiccup in the
   middle of a sweep, nowhere near enough to look like hammering. */
async function fetchSlugPage(url: string): Promise<PageFetch> {
  const first = await fetchSlugPageOnce(url);
  if (first.kind !== "error") return first;
  await new Promise((r) => setTimeout(r, 1000));
  return fetchSlugPageOnce(url);
}

/* Rasterising a floor-plan PDF is the one step in this sync that depends on a
   binary rather than on a library: imageMirror.pdfPagesToJpegs shells out to
   poppler's `pdftoppm` and returns [] — silently — when it is missing. It is
   present on the production VPS and absent on the operator's laptop, and that
   asymmetry has already cost a run: the first real Marfields import created
   four projects with zero floor plans and reported nothing wrong.

   The probe asks only whether the BINARY EXISTS, by whether the process could be
   spawned at all: an ENOENT is the one condition that makes every brochure in a
   run come back empty, and it is the only condition this answers for. Exit codes
   are deliberately ignored — poppler's own `-v` exits non-zero on some builds,
   and a version banner is not what this needs to know. */
export async function pdftoppmAvailable(): Promise<boolean> {
  const { spawn } = await import("child_process");
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const done = (v: boolean) => { if (!settled) { settled = true; resolve(v); } };
    try {
      const p = spawn("pdftoppm", ["-v"], { stdio: "ignore" });
      p.on("error", () => done(false)); // ENOENT — not installed
      p.on("close", () => done(true));
    } catch {
      done(false);
    }
  });
}

/* ── Identity: a unit is (block, ref), never ref alone ──────────────────────

   Centro Limassol prints apartments 101-106 in BOTH of its buildings, so 36 of
   its 60 units share a reference with another unit in the same document
   (measured on the committed fixture, 2026-09-11: 18 references twice each).
   Three separate things break if the bare printed reference becomes the row's
   identity:

   - `ref` is what a Client Presentation selects units by (ClientPresentationItem.
     unitRefs, matched through normalizeRef in src/app/admin/.../edit/page.tsx),
     so two rows reading "101" can never be picked apart by an advisor — ticking
     one ticks both.
   - `feedRef` is the anchor every re-sync and statusOnlySync matches on
     (FEED-ADAPTER-GUIDE §4). Two rows with the same anchor make "which one did
     the developer mean?" unanswerable, and the published diff path would unlist
     one of them every night.
   - a human reading the admin list has no way to tell which building a row is.

   So both fields are written BLOCK-QUALIFIED, and they are written with the
   SAME string: `ref` is the display reference and stays admin-editable after
   creation, `feedRef` is the machine anchor and is refreshed on every sync, and
   starting them equal means normalizeRef() gives the same key whichever of the
   two a consumer reaches for.

   The qualifier is the block heading minus its "BUILDING"/"ЗДАНИЕ" word, so
   Naftikos' "BUILDING A" contributes "A" and Centro's "ЗДАНИЕ Б" contributes
   "Б", while a named section keeps its whole name ("Castle Residences"). It is
   only prefixed when the printed reference does not already start with it:
   Naftikos prints "A 101" under "BUILDING A" and must not become "A A 101",
   while Centro prints a bare "101" and must become "Б 101".

   Measured on 2026-09-11 over ALL NINE live price lists — 332 units, not just
   the five committed fixtures: 18 duplicate bare references, zero duplicates
   once qualified. Two shapes came out of that measurement and are the reason
   `duplicateRefs` keeps checking instead of the measurement being trusted:

   - Trilogy's sections are "EAST TOWER", "NORTH RESIDENCES (A)" and "NORTH
     RESIDENCES (B)", none of which cybarcoPriceTable's BLOCK_RE matches, so all
     seven of its units carry block null. Harmless today (its references are 1701
     and 304-1105, all distinct) but the tower is lost, and if Trilogy ever
     repeats an apartment number between towers the qualification has nothing to
     work with.
   - Centro's page 1 heading spells the building letter with a LATIN "A" inside
     the Cyrillic word ЗДАНИЕ while page 2 uses a Cyrillic "Б". The tag is taken
     verbatim, so if Cybarco ever corrects that typo the whole building's
     references change key — which costs nothing on the wipe-and-recreate path
     below, and would matter to anything matching across runs.

   Either way a collision is REPORTED, never silently written. */
const blockTag = (block: string) => block.replace(/^(?:BUILDING|ЗДАНИЕ)\s+/i, "").trim();

export function cybarcoUnitRef(u: CybarcoUnit): string {
  if (!u.block) return u.ref;
  const tag = blockTag(u.block);
  if (!tag) return u.ref;
  const already = u.ref.toLowerCase().startsWith(tag.toLowerCase());
  return already ? u.ref : `${tag} ${u.ref}`;
}

/** Human display label: the block as the document prints it, then the reference. */
const cybarcoUnitLabel = (u: CybarcoUnit) => (u.block ? `${u.block} · ${u.ref}` : u.ref);

/** References that appear more than once after qualification — empty across all
 *  332 live units on 2026-09-11; reported, never written around. */
export function duplicateRefs(units: CybarcoUnit[]): string[] {
  const seen = new Map<string, number>();
  for (const u of units) {
    const r = cybarcoUnitRef(u);
    seen.set(r, (seen.get(r) ?? 0) + 1);
  }
  return Array.from(seen.entries()).filter(([, n]) => n > 1).map(([r]) => r);
}

/* ── The unit-count collapse guard ─────────────────────────────────────────

   A Cybarco price list prints a sold unit as "SOLD" rather than dropping its
   row, so rows do not normally leave a list at all: the nine live lists run 5 to
   90 rows and a sale moves a row between statuses, never out. A large drop is
   therefore a reading failure, not a sales event — and the reader's own design
   makes the worst case silent (an unrecognised header yields zero units, Task 6).

   Trilogy is the one list that is availability-only (7 rows for a 3-tower
   project, verified page by page on 2026-09-11), and it is the reason the guard
   is a percentage of what is STORED rather than an expectation about size: a
   short list is legitimate, a shrinking one is not.

   Expressed as a fraction rather than feedSync's absolute floor of 20, because
   Limassol Marina's whole list is 5 rows and an absolute floor could never trip
   on it. The absolute floor of 2 is the other half: without it, one row
   vanishing from Marina's 5 would block the run at 20%. */
const UNIT_COLLAPSE_PCT = 0.25;
const UNIT_COLLAPSE_MIN = 2;

export type UnitWriteVerdict = { write: boolean; reason: string | null };

/** Whether a fresh unit list may replace what is already stored. Pure so it can
 *  be reasoned about (and asserted) without a database. */
export function unitWriteVerdict(fresh: number, stored: number, force = false): UnitWriteVerdict {
  if (stored === 0) return { write: true, reason: null };
  if (fresh === 0) {
    return force
      ? { write: true, reason: `price list now reads as 0 units (was ${stored}) — written anyway because --force was given` }
      : { write: false, reason: `price list read as 0 units but ${stored} are stored — units left untouched, the reader or the document changed` };
  }
  const lost = stored - fresh;
  if (lost >= UNIT_COLLAPSE_MIN && lost / stored > UNIT_COLLAPSE_PCT) {
    return force
      ? { write: true, reason: `unit count fell ${stored} → ${fresh} — written anyway because --force was given` }
      : { write: false, reason: `unit count fell ${stored} → ${fresh} (more than ${Math.round(UNIT_COLLAPSE_PCT * 100)}%) — units left untouched, a Cybarco list prints sold units rather than dropping them` };
  }
  return { write: true, reason: null };
}

/* ── Gathering (reads the live site; no database writes) ───────────────────── */

export type CybarcoPlan = {
  card: CybarcoCard;
  /** Parsed project page, or null when Cybarco no longer serves one. */
  detail: CybarcoDetail | null;
  /** Where /project/<slug>/ redirected to, when it did. */
  movedTo: string | null;
  /** The gallery a real run would mirror, in order. */
  images: string[];
  imageSource: "gallery page" | "project page" | "listing card" | "none";
  priceListUrl: string | null;
  priceListDate: string | null;
  brochureUrl: string | null;
  /** Pages in the brochure — what a run rasterises into floor plans. */
  brochurePages: number;
  units: CybarcoUnit[];
  notes: string[];
};

/* A brochure longer than this is not rasterised. NOT a curation cap — the
   operator's instruction of 2026-09-10 is to import every picture and select
   before publishing, and that rule stands; pdfPagesToJpegs' own default of 6
   pages would break it, which is why the bound is passed explicitly everywhere
   in this file. It is a runaway guard: each page becomes three WebP files on
   disk, and a document of several hundred pages is a shape this connector has
   never seen rather than a project's floor plans. Measured across the eleven
   live brochures on 2026-09-11 the longest is Trilogy's at 51 pages (then
   Limassol Marina 44, Limassol Greens 35), so 100 leaves room for a brochure to
   grow without ever being the thing that silently truncates one.

   Worth knowing before reading the numbers this produces: a Cybarco brochure is
   a MARKETING document, not a floor-plan sheet — Trilogy's 51 pages are mostly
   renders and copy. The operator curates `plans` before publishing, so importing
   all of it is the instruction being followed rather than a claim that 51 floor
   plans exist. */
const MAX_BROCHURE_PAGES = 100;

/** Fetch and parse everything for one card. Reads the site only. */
async function gatherOne(card: CybarcoCard): Promise<CybarcoPlan> {
  const notes: string[] = [];

  const page = await fetchSlugPage(projectUrl(card.slug));
  let detail: CybarcoDetail | null = null;
  let movedTo: string | null = null;
  if (page.kind === "ok") detail = parseProjectPage(page.html);
  else if (page.kind === "moved") {
    movedTo = page.to;
    /* Not an error: four sold-out projects are expected to be in this state. It
       is reported because the ALTERNATIVE — following the redirect — would
       attribute another project's price list to this one. */
    notes.push(`${card.slug}: project page redirects to ${page.to} — treated as gone, not followed`);
  } else if (page.kind === "missing") {
    notes.push(`${card.slug}: project page is gone (HTTP ${page.status}) — no brochure, no price list`);
  } else {
    notes.push(`${card.slug}: project page could not be fetched (${page.detail}) — no brochure, no price list THIS RUN`);
  }

  const gallery = await fetchSlugPage(galleryUrl(card.slug));
  const galleryImages = gallery.kind === "ok" ? parseGallery(gallery.html) : [];
  if (gallery.kind === "moved") notes.push(`${card.slug}: gallery page redirects to ${gallery.to} — ignored`);
  /* A 404 here is deliberately NOT reported: nine of the fifteen projects have
     no gallery page at all and the project page is the designed fallback. */
  if (gallery.kind === "error") notes.push(`${card.slug}: gallery page could not be fetched (${gallery.detail}) — its photos are missing from THIS RUN`);
  if (gallery.kind === "ok" && !galleryImages.length) notes.push(`${card.slug}: gallery page exists but holds no image`);

  /* Gallery page first, then the project page, then the listing card's own
     picture. Order is by richness: a gallery page carries every photo Cybarco
     publish, a project page a handful, and the card exactly one. */
  let images = galleryImages;
  let imageSource: CybarcoPlan["imageSource"] = "gallery page";
  if (!images.length && detail?.images.length) { images = detail.images; imageSource = "project page"; }
  if (!images.length && card.featuredImage) { images = [card.featuredImage]; imageSource = "listing card"; }
  if (!images.length) { imageSource = "none"; notes.push(`${card.slug}: no image from any source`); }

  let brochurePages = 0;
  if (detail?.brochureUrl) {
    try {
      brochurePages = Math.min((await readPdfPages(await getBuffer(detail.brochureUrl))).length, MAX_BROCHURE_PAGES);
      if (!brochurePages) notes.push(`${card.slug}: brochure ${detail.brochureUrl} has no readable page`);
    } catch (e) {
      notes.push(`${card.slug}: brochure could not be read (${(e as Error).message})`);
    }
  }

  let units: CybarcoUnit[] = [];
  if (detail?.priceListUrl) {
    try {
      units = cybarcoUnitsFromPages(await readPdfPages(await getBuffer(detail.priceListUrl)));
      if (!units.length) notes.push(`${card.slug}: price list ${detail.priceListUrl} yielded 0 units — its header vocabulary is not recognised`);
      const dupes = duplicateRefs(units);
      if (dupes.length) notes.push(`${card.slug}: ${dupes.length} duplicate unit reference(s) after block qualification (${dupes.slice(0, 5).join(", ")}) — identity is ambiguous`);
    } catch (e) {
      notes.push(`${card.slug}: price list could not be read (${(e as Error).message})`);
    }
  } else if (card.status !== "sold_out") {
    notes.push(`${card.slug}: on sale but no price list found — no units`);
  }

  return {
    card, detail, movedTo,
    images, imageSource,
    priceListUrl: detail?.priceListUrl ?? null,
    priceListDate: detail?.priceListUrl ? priceListDate(detail.priceListUrl) : null,
    brochureUrl: detail?.brochureUrl ?? null,
    brochurePages,
    units,
    notes,
  };
}

/** Listing + sitemap + every project's page, gallery, brochure and price list. */
export async function gatherCybarco(): Promise<{ plans: CybarcoPlan[]; notes: string[] }> {
  const [listing, sitemap] = await Promise.all([get(LISTING_URL), get(SITEMAP_URL)]);
  const cards = parseListing(listing, sitemap);
  const notes: string[] = [];
  if (!cards.length) throw new Error("Cybarco: the listing page parsed to zero cards — the markup changed");

  /* Sequential on purpose. Each project costs two HTML fetches and up to two
     PDF reads through the pdf.js worker, and this runs against a Cloudflare-
     fronted site we do not own: fifteen projects in parallel is a burst of ~60
     requests, which is how a scraper gets itself rate-limited. */
  const plans: CybarcoPlan[] = [];
  for (const card of cards) plans.push(await gatherOne(card));
  for (const p of plans) notes.push(...p.notes);

  /* One line rather than one per project. Nine of the fifteen have no gallery
     page and fall back to the four or five pictures on their project page —
     expected, but worth stating once, because "Seaview Heights: 90 units, 4
     photos" looks like a bug until you know why. */
  const fallback = plans.filter((p) => p.imageSource === "project page" || p.imageSource === "listing card");
  if (fallback.length) {
    notes.push(`no usable gallery page: ${fallback.map((p) => `${p.card.slug} (${p.images.length} image(s) from the ${p.imageSource})`).join(", ")}`);
  }
  return { plans, notes };
}

/* ── Dry run (reads the live site AND the production DB; writes nothing) ───── */

export type CybarcoDryRun = {
  slug: string;
  name: string;
  status: CybarcoStatus;
  district: string | null;
  images: number;
  plans: number;
  units: number;
  available: number;
  reserved: number;
  sold: number;
  priceListDate: string | null;
  slugFree: boolean;
}[];

/* Slugs already taken by a Development or by a legacy Sanity-era Project.

   BOTH candidate slugs are checked per project, because the one Cybarco uses and
   the one this system would mint are not the same string. Development.slug is set
   on PUBLISH by uniqueDevelopmentSlug(), which slugifies the PUBLIC NAME — so
   "Seaview Heights" becomes `seaview-heights` while Cybarco's own URL is
   `seaview-heights-limassol`. Checking only one of the two would report a free
   slug for a project that will collide the day it is published, which is exactly
   the question this column exists to answer.

   Note what uniqueDevelopmentSlug does and does not do: it dedupes against other
   Developments only, never against the legacy Project table — so a clash with an
   old Sanity-era page is NOT resolved automatically, and Task 9 has to deal with
   it deliberately (Development.supersedesProjects is the mechanism for it). */
async function takenSlugs(slugs: string[]): Promise<Set<string>> {
  const [devs, projects] = await Promise.all([
    prisma.development.findMany({ where: { slug: { in: slugs } }, select: { slug: true } }),
    prisma.project.findMany({ where: { slug: { in: slugs } }, select: { slug: true } }),
  ]);
  const out = new Set<string>();
  for (const d of devs) if (d.slug) out.add(d.slug);
  for (const p of projects) out.add(p.slug);
  return out;
}

/* The gate. It reads the live site and the production database and writes
   nothing at all — the same shape that caught three regressions in the G&V
   build after every synthetic test was green.

   `plans` is the brochure's PAGE COUNT as pdf.js reads it, not the number of
   JPEGs a run would produce, and that is deliberate: the rasterising step is
   poppler's `pdftoppm`, which is absent on a developer machine, so counting
   rasterised pages here would report 0 plans for every project on a laptop and
   the real figure on the VPS. The page count is the same number on both, and
   pdftoppmAvailable() reports the machine's own state separately. */
export async function dryRunCybarcoSync(): Promise<CybarcoDryRun> {
  return (await dryRunCybarcoSyncDetailed()).rows;
}

/* The same run, with the notes it produced. A table of counts cannot say "this
   project's page redirects elsewhere" or "this price list read as zero units",
   and those are exactly the lines a reader has to see before trusting the
   counts — so the plain, spec-shaped dryRunCybarcoSync() above is a view of
   this, not a second gathering pass. */
export async function dryRunCybarcoSyncDetailed(): Promise<{ rows: CybarcoDryRun; notes: string[] }> {
  const { plans, notes } = await gatherCybarco();
  const candidates = (p: CybarcoPlan) => Array.from(new Set([p.card.slug, developmentSlug(p.card.name)]));
  const taken = await takenSlugs(Array.from(new Set(plans.flatMap(candidates))));
  const clashOf = (p: CybarcoPlan) => candidates(p).filter((s) => taken.has(s));
  const rows: CybarcoDryRun = plans.map((p) => ({
    slug: p.card.slug,
    name: p.card.name,
    status: p.card.status,
    district: p.card.district,
    images: p.images.length,
    plans: p.brochurePages,
    units: p.units.length,
    available: p.units.filter((u) => u.status === "available").length,
    reserved: p.units.filter((u) => u.status === "reserved").length,
    sold: p.units.filter((u) => u.status === "sold").length,
    priceListDate: p.priceListDate,
    slugFree: clashOf(p).length === 0,
  }));
  for (const p of plans) {
    const clash = clashOf(p);
    if (clash.length) notes.push(`${p.card.slug}: slug already taken in Development or Project — ${clash.join(", ")}`);
  }
  return { rows, notes };
}

/* ── Write (DRAFT) ────────────────────────────────────────────────────────── */

const STAGE: Partial<Record<CybarcoStatus, string>> = {
  under_construction: "Under construction",
  ready: "Ready to move in",
};

/* FROZEN_WHEN_PUBLISHED (feedSync.ts) restated for this adapter rather than
   imported, for the same reason aggSync.ts and sharepointAvailabilitySync.ts
   restate it: importing feedSync pulls @/app/preview-project/feeds and with it
   every other developer's adapter into this module's graph, which a nightly
   cron route for one website has no business loading.

   What the rule says: once a Development is published, an admin's curated name,
   description and media win over anything the source offers, and the district
   it is filed under may not move because a page had a thin night. Prices,
   stage, unit counts and the units themselves are NOT frozen — a published page
   advertising a stale price is the failure that freezing them would cause. */
const FROZEN_WHEN_PUBLISHED = ["publicName", "description", "gallery", "plans"] as const;
const FROZEN_WHEN_PUBLISHED_IF_SET = ["district"] as const;

function freezeForPublishedRow<T extends Record<string, unknown>>(data: T, existing: Record<string, unknown>): Partial<T> {
  const out: Partial<T> = { ...data };
  for (const k of FROZEN_WHEN_PUBLISHED) delete (out as Record<string, unknown>)[k];
  for (const k of FROZEN_WHEN_PUBLISHED_IF_SET) {
    const current = existing[k];
    if (current != null && current !== "") delete (out as Record<string, unknown>)[k];
  }
  return out;
}

export async function syncCybarco(
  accountId: string,
  opts: { force?: boolean } = {},
): Promise<{ ok: boolean; projects: number; units: number; created: number; notes: string[] }> {
  const acct = await prisma.developerAccount.findUnique({ where: { id: accountId }, select: { id: true, name: true } });
  if (!acct) throw new Error(`Cybarco: no DeveloperAccount ${accountId}`);

  /* Held across the whole run and released in finally. scheduleAppRestart() does
     a hard pm2 restart and cuts every in-flight request; on 2026-08-25 the 04:00
     feed-sync killed a manual Drive import at project 11 of 16. A long import
     must neither be killed nor kill (FEED-ADAPTER-GUIDE §4). Not awaited —
     beginSyncWindow writes its lock file synchronously and returns the release
     function directly, exactly as aggSync.ts and sharepointAvailabilitySync.ts
     call it. */
  const release = beginSyncWindow("cybarco-sync");
  try {
    const { plans, notes: gatherNotes } = await gatherCybarco();
    const notes = [...gatherNotes];

    /* Probed once per run, not per PDF, and reported loudly: without this a run
       on a machine with no poppler writes every project with zero floor plans
       and looks entirely successful. */
    const canRasterise = await pdftoppmAvailable();
    if (!canRasterise) notes.push("pdftoppm (poppler-utils) is NOT available on this machine — no floor plan will be produced from any brochure on this run");

    let created = 0;
    let unitsWritten = 0;
    let mediaChanged = false;

    for (const plan of plans) {
      const card = plan.card;
      const feedKey = `cybarco:${card.slug}`;
      const devKey = devKeyFor(feedKey);

      const existing = await prisma.development.findUnique({
        where: { feedKey },
        select: { id: true, dev: true, publicName: true, publishStatus: true, gallery: true, district: true, soldOutSince: true },
      });

      /* Another adapter's row under our own key would be a key collision, not a
         re-sync. Never overwritten — the same rule every other per-developer
         sync applies (aggSync, sharepointAvailabilitySync). */
      if (existing && existing.dev !== "cybarco") {
        notes.push(`${card.slug}: feedKey ${feedKey} already belongs to "${existing.publicName}" (dev:${existing.dev}) — skipped untouched`);
        continue;
      }

      const published = existing?.publishStatus === "published";
      /* "Needs content gathering", not "is new": a project created by an earlier
         run that failed before its media was stored must still get it. An empty
         gallery is the proxy — once a project has real photos this run is done
         with it, and a published project is never re-gathered at all. */
      const storedGallery = (existing?.gallery as string[] | null) ?? [];
      const needsContent = !published && (!!opts.force || !existing || !storedGallery.length);

      let gallery: string[] = [];
      let plansImages: string[] = [];
      if (needsContent) {
        /* Mirrored by downloading here and handing the buffer to
           storeUploadedImage, rather than through imageMirror.mirrorAll: that
           helper fetches with no custom headers, and this site is behind
           Cloudflare with only the desktop UA above actually measured. A photo
           silently refused as HTML is worse than one downloaded twice. */
        for (const url of plan.images) {
          try {
            const stored = await storeUploadedImage(await getBuffer(url), devKey);
            if (stored) { gallery.push(stored); mediaChanged = true; }
          } catch { /* one photo failing must not abort the project */ }
        }
        if (plan.images.length && !gallery.length) notes.push(`${card.slug}: ${plan.images.length} image(s) offered, none could be stored`);

        if (plan.brochureUrl) {
          try {
            const pages = await pdfPagesToJpegs(await getBuffer(plan.brochureUrl), MAX_BROCHURE_PAGES);
            /* Per-PDF, as the brief requires: pdfPagesToJpegs returns [] for a
               missing binary, a corrupt file and an unreadable page alike, and
               all three used to look like "this brochure simply has no pages". */
            if (!pages.length) {
              notes.push(`${card.slug}: brochure ${plan.brochureUrl} produced no page (${plan.brochurePages} readable page(s) in the PDF${canRasterise ? "" : ", and pdftoppm is missing on this machine"})`);
            }
            for (const page of pages) {
              const stored = await storeUploadedImage(page, devKey);
              if (stored) { plansImages.push(stored); mediaChanged = true; }
            }
          } catch (e) {
            notes.push(`${card.slug}: brochure could not be rasterised (${(e as Error).message})`);
          }
        }
      }

      const units = plan.units;
      const prices = units.map((u) => u.price).filter((p): p is number => typeof p === "number");
      const priceFrom = prices.length ? Math.min(...prices) : card.priceFrom;
      const priceTo = prices.length ? Math.max(...prices) : null;
      const stage = STAGE[card.status] ?? null;
      const description = plan.detail?.description || card.description || null;

      const row = {
        developerAccountId: acct.id,
        dev: "cybarco",
        feedProjectId: card.slug,
        feedKey,
        developerName: card.name,
        /* Refreshed on a draft and frozen once published, the same rule
           feedSync.ts applies: an admin's display alias lives in
           DevelopmentOverride, which no sync ever writes. */
        publicName: card.name, // already title-cased by parseListing
        developer: acct.name,
        district: card.district,
        /* `town` is deliberately not written at all. Cybarco's subtitle names a
           district ("Nicosia", "Limassol", "Pafos"), never a town inside it, and
           a guessed town is a wrong filter facet — so it is left for an admin,
           and omitting the key means a re-sync cannot erase what they set. */
        currency: "EUR",
        description,
        priceFrom,
        priceTo,
        syncedAt: new Date(),
        /* A sold-out project's stage is whatever it already said. Cybarco stop
           publishing a completion claim once a project sells out, and writing
           "Ready to move in" over it would be inventing one. */
        ...(stage ? { stage, status: stage } : {}),
        ...(gallery.length ? { gallery } : {}),
        ...(plansImages.length ? { plans: plansImages } : {}),
      };

      const dev = existing
        ? await prisma.development.update({
            where: { feedKey },
            data: published ? freezeForPublishedRow(row, existing as Record<string, unknown>) : row,
          })
        : await prisma.development.create({ data: { ...row, publishStatus: "draft" } });
      if (!existing) created++;

      /* recomputeDevelopmentDistances is deliberately not called: Cybarco
         publish no coordinates at all, so there is nothing to compute from, and
         the admin map-location save already recomputes the day someone pins
         one. */

      const storedFeedUnits = await prisma.developmentUnit.count({ where: { developmentId: dev.id, source: "feed" } });
      if (!plan.priceListUrl) {
        /* Only projects with a price list get units. A project that HAD one and
           no longer does keeps what is stored — it may have sold out (Cybarco
           pull the list then), and deleting the inventory would throw away the
           only record of what was there. Reported so it is a decision, not a
           silence. */
        if (storedFeedUnits) notes.push(`${card.slug}: no price list any more — ${storedFeedUnits} stored unit(s) left untouched`);
      } else {
        const verdict = unitWriteVerdict(units.length, storedFeedUnits, opts.force);
        if (verdict.reason) notes.push(`${card.slug}: ${verdict.reason}`);
        if (verdict.write) {
          /* Wipe and recreate, source:"feed" ONLY. Three things make that safe
             here, where feedSync deliberately diffs instead:

             - A Cybarco price list is the COMPLETE statement of a project's
               inventory on every run: a sold unit stays on the list, printed
               SOLD, so a row does not disappear when it sells and there is no
               "vanished, therefore unlisted" case to preserve. `sortIndex` then
               reproduces the document's own order exactly.
             - Anything a human has touched is already source:"manual" — both
               saveUnits() and setUnitPhotos() flip the row when they write it
               (developments/[id]/actions.ts) — so no admin edit is inside the
               delete's scope.
             - A Client Presentation pins its units by REF STRING, not by row id
               (ClientPresentationItem.unitRefs; unitIds is only the fallback for
               units with no ref, and every Cybarco unit has one). Recreating a
               row regenerates the identical ref, so a presentation an advisor
               already sent keeps resolving to the same units.

             The guard above is what keeps this from being dangerous: the delete
             only runs when the fresh list is credible. */
          await prisma.developmentUnit.deleteMany({ where: { developmentId: dev.id, source: "feed" } });
          if (units.length) {
            await prisma.developmentUnit.createMany({
              data: units.map((u, i) => ({
                developmentId: dev.id,
                ref: cybarcoUnitRef(u),
                feedRef: cybarcoUnitRef(u),
                label: cybarcoUnitLabel(u),
                status: u.status,
                /* null for every sold and reserved unit — the document prints a
                   word where the price would be. That is "not for sale", not
                   "price unknown". */
                price: typeof u.price === "number" ? Math.round(u.price) : null,
                currency: "EUR",
                beds: u.beds,
                floor: u.floor,
                areaInternal: u.areaInternal,
                areaVeranda: u.areaVeranda,
                areaBuilt: u.areaBuilt,
                areaPlot: u.areaPlot,
                sortIndex: i,
              })),
            });
            unitsWritten += units.length;
          }
        }
      }

      /* A sold-out project has no price list and therefore no units, so nothing
         can derive its state — the mark on Cybarco's own listing is the only
         evidence there is. Stamped only when absent, so the date stays the
         FIRST time we saw it sold out. Task 1's shouldClearSoldOut is what makes
         it survive the recompute below: a Development with zero units has no
         availability information, which is not the same as having availability. */
      if (card.status === "sold_out" && existing?.soldOutSince == null) {
        await prisma.development.update({ where: { id: dev.id }, data: { soldOutSince: new Date() } });
      }

      await recomputeDevelopmentDerivedState(dev.id);
    }

    if (mediaChanged) scheduleAppRestart();
    await prisma.developerAccount.update({ where: { id: accountId }, data: { driveSyncedAt: new Date() } });

    return { ok: true, projects: plans.length, units: unitsWritten, created, notes };
  } finally {
    release();
  }
}
