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
import { normalizeRef } from "./unitRef";

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
      project with no inventory. `unitPlan` refuses to wipe a project's units on
      such a collapse AND refuses to rewrite the price range that was derived
      from the same unreadable list, and reports it instead.

   3. SOLD OUT IS A MARK ON THE LISTING, NOT A DISAPPEARANCE. Cybarco keep a
      sold-out project on the listing page with a "Sold Out" mark, and pull its
      price list. That mark is therefore the only live availability evidence
      there is, and the units a transitioning project keeps are a stale snapshot
      — so a sold-out project's feed units are set to sold and the sold-out date
      is stamped only against what the recompute leaves behind (the last block of
      syncCybarco). So this
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
   once qualified.

   THE QUALIFIER HAS TO SURVIVE normalizeRef(), AND A CYRILLIC ONE DOES NOT.
   That is the whole reason for the transliteration below, and it is a real
   collision class rather than a theoretical one. normalizeRef (src/lib/unitRef.ts)
   ends in `.replace(/[^a-z0-9]+/g, "")` — an ASCII class with no `u` flag — so
   it reduces "Б 101" to "101" and "В 101" to "101" as well. Today Centro's two
   headings happen to be ЗДАНИЕ + a LATIN "A" (a homoglyph typo on page 1) and
   ЗДАНИЕ + a Cyrillic "Б", giving keys "a101" and "101", so nothing collides by
   luck. Two ordinary events break that: Cybarco adding a ЗДАНИЕ В, or Cybarco
   CORRECTING the page-1 typo to a Cyrillic А. Either one makes two different
   flats share one matcher key, and the consequence is not a sync detail — the
   Client Presentation matcher resolves `unitRefs` through normalizeRef
   (src/app/admin/(panel)/crm/[id]/presentations/[presentationId]/edit/page.tsx),
   so an advisor who ticks Centro Б-101 would ship В-101 alongside it.

   unitRef.ts is deliberately NOT the place to fix that: normalizeRef is shared
   by every developer's sync and by the presentation matcher, and widening it
   would silently re-key units across the whole system. So the fix is here, and
   it is two-sided:

   - `cybarcoUnitRef` transliterates, so the distinction is carried in
     characters normalizeRef keeps: "Б 101" becomes "B 101" (key "b101") and a
     "В 101" would become "V 101" (key "v101"). Folding the WHOLE reference, not
     only the tag, is what makes it hold when the document prints the building
     letter inside the reference itself ("Б101"): leaving that one alone would
     drop the letter at normalisation and put the collision straight back.
     It also makes the homoglyph harmless, because a Cyrillic А and a Latin A
     both fold to "A" — the key no longer moves if Cybarco fix the typo.
   - `duplicateRefs` now counts normalizeRef() keys rather than raw strings, so
     the checker measures exactly what the matcher will do. Counting the raw
     qualified string is what made the old check report zero while the matcher
     saw two rows for one ref — the collision class it exists for was the one
     case it could not see.

   `label` keeps the document's own spelling (ЗДАНИЕ Б · 101), so nothing a
   human reads is transliterated; only the machine key is.

   A collision is still REPORTED, never silently written: transliteration covers
   the Cyrillic and Greek letters a Cyprus price list actually uses, and
   duplicateRefs is the net under everything it does not. */
const blockTag = (block: string) => block.replace(/^(?:BUILDING|ЗДАНИЕ)\s+/i, "").trim();

/* Cyrillic and Greek to Latin, capitals keyed (lowercase folds onto the same
   entry). Cyrillic is what Cybarco's Russian price lists print today; Greek is
   here because a Greek-language list is the next most likely vocabulary change
   on a Cypriot developer's site, and an unmapped letter is exactly the silent
   case this guards. Standard transliteration, not an invented scheme — the
   point is that a human reading "B 101" in the admin can find ЗДАНИЕ Б in the
   PDF. A few pairs are not injective (Cyrillic Е/Э both give E, Greek Η/Ι both
   give I); duplicateRefs is what catches that, which is why it runs on the
   transliterated key rather than being trusted away. */
const TRANSLIT: Record<string, string> = {
  А: "A", Б: "B", В: "V", Г: "G", Д: "D", Е: "E", Ё: "E", Ж: "Zh", З: "Z", И: "I", Й: "Y",
  К: "K", Л: "L", М: "M", Н: "N", О: "O", П: "P", Р: "R", С: "S", Т: "T", У: "U", Ф: "F",
  Х: "H", Ц: "Ts", Ч: "Ch", Ш: "Sh", Щ: "Sch", Ы: "Y", Э: "E", Ю: "Yu", Я: "Ya",
  Α: "A", Β: "V", Γ: "G", Δ: "D", Ε: "E", Ζ: "Z", Η: "I", Θ: "Th", Ι: "I", Κ: "K", Λ: "L",
  Μ: "M", Ν: "N", Ξ: "X", Ο: "O", Π: "P", Ρ: "R", Σ: "S", Τ: "T", Υ: "Y", Φ: "F", Χ: "Ch",
  Ψ: "Ps", Ω: "O",
};

/** Cyrillic/Greek letters to Latin, everything else untouched. Exported so the
 *  mapping can be asserted without a database or a PDF. */
export function transliterate(s: string): string {
  return Array.from(s)
    .map((ch) => {
      const upper = ch.toUpperCase();
      const mapped = TRANSLIT[upper];
      if (mapped === undefined) return ch;
      return ch === upper ? mapped : mapped.toLowerCase();
    })
    .join("");
}

export function cybarcoUnitRef(u: CybarcoUnit): string {
  const ref = transliterate(u.ref);
  if (!u.block) return ref;
  const tag = transliterate(blockTag(u.block));
  if (!tag) return ref;
  const already = ref.toLowerCase().startsWith(tag.toLowerCase());
  return already ? ref : `${tag} ${ref}`;
}

/** Human display label: the block as the document prints it, then the reference. */
const cybarcoUnitLabel = (u: CybarcoUnit) => (u.block ? `${u.block} · ${u.ref}` : u.ref);

/** Qualified references that share one normalizeRef() key — i.e. units a Client
 *  Presentation could not tell apart. Keyed the way the matcher keys them,
 *  project name included, because that is the only question worth answering;
 *  each entry reads "<key> (<ref> + <ref>)". Empty across all 332 live units on
 *  2026-09-11; reported, never written around. */
export function duplicateRefs(units: CybarcoUnit[], projectName = ""): string[] {
  const byKey = new Map<string, string[]>();
  for (const u of units) {
    const ref = cybarcoUnitRef(u);
    const key = normalizeRef(ref, projectName);
    const at = byKey.get(key);
    if (at) at.push(ref);
    else byKey.set(key, [ref]);
  }
  return Array.from(byKey.entries())
    .filter(([, refs]) => refs.length > 1)
    .map(([key, refs]) => `${key} (${refs.join(" + ")})`);
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

/* ── One decision for the units AND the price range ────────────────────────

   priceFrom/priceTo are derived from the very unit list the guard above may
   refuse, so they cannot be decided separately from it. They used to be: the
   row was written with a freshly computed range before the guard ran, so a
   vocabulary change that made the reader return zero units left the stored
   units intact (correct) while priceFrom had already been rewritten off the
   listing card and priceTo set to null (wrong) — the same run both declared the
   read untrustworthy and published a price range taken from it.
   `keepStored` is the one flag that governs both: when it is set, neither the
   unit rows nor the range they produced are touched. */
export type UnitPlan = { write: boolean; keepStored: boolean; reason: string | null };

/** What to do with a project's units and, with them, its price range. Pure. */
export function unitPlan(input: { hasPriceList: boolean; fresh: number; stored: number; force?: boolean }): UnitPlan {
  /* No price list at all: Cybarco pull it when a project sells out, so what is
     stored is the last full statement of the inventory and the only record of
     what was there. Kept, range included — a stored range read off 60 real
     units must not be replaced by the listing card's single "from" figure and a
     null "to". */
  if (!input.hasPriceList) {
    return {
      write: false,
      keepStored: input.stored > 0,
      reason: input.stored > 0 ? `no price list any more — ${input.stored} stored unit(s) and their price range left untouched` : null,
    };
  }
  const verdict = unitWriteVerdict(input.fresh, input.stored, input.force);
  return { write: verdict.write, keepStored: !verdict.write && input.stored > 0, reason: verdict.reason };
}

/* ── What still has to be fetched for a project ────────────────────────────

   Asked per asset kind, because "the gallery is not empty" was standing in for
   "this project has everything" and the two come apart on the one machine
   difference this connector has. pdftoppm is absent on the operator's laptop
   and present on the VPS, so a first run from the laptop stores every photo and
   ZERO floor plans; with an empty gallery as the only proxy, the corrective run
   on the VPS then saw a full gallery, asked for nothing, and never fetched a
   brochure again — the documented remedy ("run the first import on the VPS")
   only worked with force. The same latch made the listing-card fallback
   permanent: one transient refusal on a project page stored the card's single
   photo, and no later run replaced it. That is the degradation the fetch layer
   was fixed for (Aktea 2, 17 of 18 photos), surviving in the write path.

   Plans are exact rather than heuristic: they come from ONE document whose page
   count is known from the same run (`brochurePages`, capped identically), so
   "fewer stored than the PDF has" is a fact. `brochurePages` of 0 means the PDF
   could not be read THIS run, and asking for nothing then is right — there is
   nothing to compare against and the unreadable brochure is already reported.

   Images have no such count (a source URL can repeat or refuse), so the test is
   a TIER jump rather than any shortfall: measured on 2026-09-11 the three
   sources are the listing card (1 photo), the project page (4-5) and the
   gallery page (16-187), so a richer source always offers at least three times
   what the poorer one did, while a photo or two failing to store is a handful.
   Doubling separates those cleanly and keeps a 187-image project from being
   re-downloaded every night over one missing file. */
const GALLERY_TIER_FACTOR = 2;

/* Plans being "exact" cut the other way too, and this is the finding this
   constant fixes: `storeUploadedImage` returns null on any image-processing or
   disk error, so with a bare `storedPlans < brochurePages` a SINGLE rasterised
   page that fails to store (one `sharp` throw, one full-disk moment) left the
   project needing plans forever — every 01:00 run re-reads the brochure just to
   count its pages (see gatherOne), re-rasterises up to 100 pages, restores them
   all, sets `mediaChanged`, and that calls scheduleAppRestart(), a hard pm2
   restart, nightly, for a gap that was never going to close.

   The gap this tolerates is COUNT, not proportion, deliberately mirroring what
   actually fails: one page out of 51 (Trilogy) and one page out of 3 are the
   same failure (one `storeUploadedImage` call returning null), not a
   proportional shortfall, so a flat page count is the honest measure — a
   percentage would forgive more on a long brochure than a short one for the
   identical failure.

   Zero stored is deliberately NOT covered by the tolerance: it means the
   brochure was never rasterised at all THIS project (a laptop run with no
   pdftoppm, a whole-run disk failure, or simply the first run ever), which is
   "we got nothing", not "we got nearly everything" — and that must keep being
   retried every night until it produces something, which is also what makes
   the VPS's first honest run fetch all fifteen projects' plans even though
   PLANS_PAGE_TOLERANCE is nonzero. */
const PLANS_PAGE_TOLERANCE = 1;

/* ── Whether a sold-out date may be stamped ────────────────────────────────

   Read AFTER recomputeDevelopmentDerivedState has run, against what it left
   behind, which is the whole point: stamping first and recomputing second is
   what let a stamp be cleared two lines later and a "back in stock" reminder
   fire nightly for a project the developer lists as Sold Out. A date is written
   only when nothing can clear it again — `available === 0` is exactly
   shouldClearSoldOut's condition for leaving it alone, which is why this asks
   for that number and not for the unit rows. Pure. */
export function soldOutStamp(input: { soldOutSince: Date | null; available: number }): { stamp: boolean; contradiction: boolean } {
  if (input.soldOutSince != null) return { stamp: false, contradiction: false };
  /* Available units on a project the developer marks Sold Out can only be
     manual rows by this point, i.e. an admin's own assertion. Reported for a
     human, never resolved by stamping a date the next recompute would clear. */
  if (input.available > 0) return { stamp: false, contradiction: true };
  return { stamp: true, contradiction: false };
}

export function contentNeeds(input: {
  published: boolean;
  force?: boolean;
  offeredImages: number;
  storedImages: number;
  hasBrochure: boolean;
  brochurePages: number;
  storedPlans: number;
}): { gallery: boolean; plans: boolean } {
  /* A published Development's media is the admin's, curated; never re-gathered. */
  if (input.published) return { gallery: false, plans: false };
  return {
    gallery: input.offeredImages > 0 && (!!input.force || input.offeredImages > input.storedImages * GALLERY_TIER_FACTOR),
    /* force always wins, even against an unreadable brochure this run
       (brochurePages 0) — see PLANS_PAGE_TOLERANCE above for everything else:
       nothing stored yet always needs fetching, and a shortfall no bigger than
       the tolerance is treated as already done. */
    plans: input.hasBrochure && (
      !!input.force ||
      (input.brochurePages > 0 && (input.storedPlans === 0 || input.storedPlans < input.brochurePages - PLANS_PAGE_TOLERANCE))
    ),
  };
}

/* ── Was this run healthy, or did the site refuse it? ──────────────────────

   Cybarco rate-limit in practice. Two of the three acceptance dry runs each lost
   ONE brochure to a transient 429, and every such refusal lands in `notes` as a
   per-project line — which is the right place for it, but notes alone never
   reached the cron log: the run summary counted created/touched/written and
   nothing else, so a night where the site refused EVERY fetch wrote the same
   "0 created, 15 project(s) touched, 0 unit(s) written" row as a night where
   there was genuinely nothing new. Indistinguishable, and therefore invisible.

   So a run is judged on the share of its fetch attempts the site refused, and a
   systemic refusal resolves ok:false — which is what arms the two things that
   can actually reach a human: shouldNotifyFailureStreak() in the route, and the
   Action Center's "cron failed its last run" URGENT item (rules/system.ts).

   The threshold is a MAJORITY, deliberately, and not "any failure at all":

   - One lost brochure out of ~50 fetches is the measured NORMAL state of this
     source (runs 1 and 2 of acceptance), and those runs were healthy — 15
     projects, 380 images, 332 units. Failing them would put an URGENT item and
     a Telegram message in front of the operator most nights, and an alarm that
     cries wolf nightly is one that gets ignored by the time it matters.
   - A genuinely rate-limited night is not marginal: the two page fetches every
     project makes are the floor of ~30 attempts per run, and Cloudflare
     refusing the sweep refuses nearly all of them. Measured shapes sit at
     either end, not near 50%.

   `attempted` below the floor is NOT judged: a run that somehow made almost no
   requests has no denominator worth dividing by, and gatherCybarco already
   throws outright when the listing parses to zero cards. */
const SYSTEMIC_REFUSAL_SHARE = 0.5;
const MIN_FETCHES_TO_JUDGE = 10;

export type RunVerdict = { ok: boolean; reason: string | null };

/** Whether a run counts as FAILED, from how much of it the site refused. Pure:
 *  `attempted` is every page/PDF fetch the run actually tried, `failed` the ones
 *  that still errored after their retry. A reason is returned only when the
 *  verdict is a failure — each individual refusal is already its own note. */
export function runVerdict(input: { attempted: number; failed: number }): RunVerdict {
  if (input.attempted < MIN_FETCHES_TO_JUDGE) return { ok: true, reason: null };
  if (input.failed <= input.attempted * SYSTEMIC_REFUSAL_SHARE) return { ok: true, reason: null };
  return {
    ok: false,
    reason: `the site refused ${input.failed} of ${input.attempted} fetch(es) this run — rate-limited or blocked, NOT a quiet night`,
  };
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
  /** Page/PDF fetches this project tried (the denominator runVerdict divides). */
  fetchAttempts: number;
  /** Of those, the ones that still errored after their retry. A 404 or a
   *  redirect is NOT counted: both are the site's settled answer and expected
   *  here (nine projects have no gallery page, four sold-out ones redirect). */
  fetchFailures: number;
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
  /* Counted alongside the notes, not derived from them afterwards: most notes
     here are expected states (a redirect, a missing gallery page, a sold-out
     project with no price list) and only the `error`/throw paths below are a
     refusal. Counting notes would make a healthy night look like a refused one. */
  let fetchAttempts = 0;
  let fetchFailures = 0;

  fetchAttempts++;
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
    fetchFailures++;
    notes.push(`${card.slug}: project page could not be fetched (${page.detail}) — no brochure, no price list THIS RUN`);
  }

  fetchAttempts++;
  const gallery = await fetchSlugPage(galleryUrl(card.slug));
  const galleryImages = gallery.kind === "ok" ? parseGallery(gallery.html) : [];
  if (gallery.kind === "moved") notes.push(`${card.slug}: gallery page redirects to ${gallery.to} — ignored`);
  /* A 404 here is deliberately NOT reported: nine of the fifteen projects have
     no gallery page at all and the project page is the designed fallback. */
  if (gallery.kind === "error") {
    fetchFailures++;
    notes.push(`${card.slug}: gallery page could not be fetched (${gallery.detail}) — its photos are missing from THIS RUN`);
  }
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
    /* Downloaded and page-counted every run, even for a project whose stored
       plans are already complete — gatherOne has no DB access (this whole
       function reads only the live site, see the section header above) and
       so cannot know a project is already satisfied before fetching. Threading
       "already has enough plans" in here would mean either gatherCybarco takes
       a DB-derived skip list (and then the DRY RUN — which has no sync state
       to compare against and must report every project's true current page
       count, see dryRunCybarcoSyncDetailed) has to fetch anyway, or the two
       callers diverge in what `brochurePages` means. Left as the ~11 needless
       downloads a night the review noted — real, but a shared-gather-stage
       redesign, not a one-file fix for a nightly-restart bug. PLANS_PAGE_TOLERANCE
       above fixes the restart; this comment is the "not fixed, and why" for the
       download cost that rides along with it. */
    fetchAttempts++;
    try {
      brochurePages = Math.min((await readPdfPages(await getBuffer(detail.brochureUrl))).length, MAX_BROCHURE_PAGES);
      if (!brochurePages) notes.push(`${card.slug}: brochure ${detail.brochureUrl} has no readable page`);
    } catch (e) {
      fetchFailures++;
      notes.push(`${card.slug}: brochure could not be read (${(e as Error).message})`);
    }
  }

  let units: CybarcoUnit[] = [];
  if (detail?.priceListUrl) {
    fetchAttempts++;
    try {
      units = cybarcoUnitsFromPages(await readPdfPages(await getBuffer(detail.priceListUrl)));
      if (!units.length) notes.push(`${card.slug}: price list ${detail.priceListUrl} yielded 0 units — its header vocabulary is not recognised`);
      /* Keyed the way the Client Presentation matcher keys it — normalizeRef,
         project name included — so this sees a collision the matcher would see
         rather than only one the raw strings show. */
      const dupes = duplicateRefs(units, card.name);
      if (dupes.length) notes.push(`${card.slug}: ${dupes.length} unit reference(s) collide after block qualification and normalizeRef (${dupes.slice(0, 5).join(", ")}) — identity is ambiguous`);
    } catch (e) {
      fetchFailures++;
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
    fetchAttempts,
    fetchFailures,
  };
}

/** Listing + sitemap + every project's page, gallery, brochure and price list. */
export async function gatherCybarco(): Promise<{
  plans: CybarcoPlan[];
  notes: string[];
  fetchAttempts: number;
  fetchFailures: number;
  verdict: RunVerdict;
}> {
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

  /* Judged here rather than in syncCybarco so the DRY RUN sees the same verdict
     the nightly run does — the dry run is the gate, and "the site refused this
     whole sweep" is the one line that invalidates every count under it. */
  const fetchAttempts = plans.reduce((a, p) => a + p.fetchAttempts, 0);
  const fetchFailures = plans.reduce((a, p) => a + p.fetchFailures, 0);
  const verdict = runVerdict({ attempted: fetchAttempts, failed: fetchFailures });
  if (verdict.reason) notes.push(verdict.reason);

  return { plans, notes, fetchAttempts, fetchFailures, verdict };
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

  /* Stated in the NOTES, not only in whatever runner prints the table. The `plans`
     column is pdf.js' page count, identical on a laptop and on the VPS — so a dry
     run on a machine with no poppler reports "263 floor-plan pages" while a real
     run there would produce zero, and nothing in the output said so. The real
     sync has warned about this since it was written; the gate did not, which is
     the asymmetry that let the Marfields import create four projects with zero
     floor plans and report nothing wrong. Reported either way: "present" is the
     line that makes the page counts trustworthy, and its absence is not evidence. */
  notes.push(
    (await pdftoppmAvailable())
      ? "pdftoppm (poppler-utils) IS available on this machine — a real run here would rasterise each row's `plans` page count into floor plans"
      : "pdftoppm (poppler-utils) is NOT available on this machine — each row's `plans` is the brochure's PAGE count, and a real run HERE would produce ZERO floor plans for every project",
  );

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

/* `ok` is no longer always true. It is false for exactly ONE condition — the site
   refused a MAJORITY of this run's fetches (runVerdict above) — and for nothing
   else. A single lost brochure, an unreadable price list, a slug clash, a
   sold-out contradiction: all still resolve ok:true with their note, because each
   is a normal night on this source and an alarm that fires on a normal night is
   an alarm nobody reads. Everything that throws (the listing parsing to zero
   cards, a dead database) already produces ok:false through withCronLog. */
export async function syncCybarco(
  accountId: string,
  opts: { force?: boolean } = {},
): Promise<{
  ok: boolean;
  projects: number;
  units: number;
  created: number;
  notes: string[];
  fetchAttempts: number;
  fetchFailures: number;
}> {
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
    const { plans, notes: gatherNotes, fetchAttempts, fetchFailures, verdict } = await gatherCybarco();
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
        select: { id: true, dev: true, publicName: true, publishStatus: true, gallery: true, plans: true, district: true },
      });

      /* Another adapter's row under our own key would be a key collision, not a
         re-sync. Never overwritten — the same rule every other per-developer
         sync applies (aggSync, sharepointAvailabilitySync). */
      if (existing && existing.dev !== "cybarco") {
        notes.push(`${card.slug}: feedKey ${feedKey} already belongs to "${existing.publicName}" (dev:${existing.dev}) — skipped untouched`);
        continue;
      }

      const published = existing?.publishStatus === "published";
      /* "What is still MISSING", asked per asset kind — see contentNeeds. A
         project created by an earlier run that failed before its media was
         stored must still get it, a laptop run's zero floor plans must still be
         fetched by the next VPS run, and a project left holding the single photo
         off its listing card must be re-gathered once its gallery page answers
         again. A published project is never re-gathered at all. */
      const storedGallery = (existing?.gallery as string[] | null) ?? [];
      const storedPlans = (existing?.plans as string[] | null) ?? [];
      const needs = contentNeeds({
        published,
        force: opts.force,
        offeredImages: plan.images.length,
        storedImages: storedGallery.length,
        hasBrochure: !!plan.brochureUrl,
        brochurePages: plan.brochurePages,
        storedPlans: storedPlans.length,
      });
      if (needs.gallery && storedGallery.length) {
        notes.push(`${card.slug}: ${plan.images.length} image(s) now offered from the ${plan.imageSource} against ${storedGallery.length} stored — re-gathering`);
      }
      if (needs.plans && storedPlans.length < plan.brochurePages && storedPlans.length) {
        notes.push(`${card.slug}: brochure has ${plan.brochurePages} readable page(s) against ${storedPlans.length} stored plan(s) — re-rasterising`);
      }

      const gallery: string[] = [];
      const plansImages: string[] = [];
      if (needs.gallery) {
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
      }

      if (needs.plans && plan.brochureUrl) {
        const brochureUrl = plan.brochureUrl;
        try {
          const pages = await pdfPagesToJpegs(await getBuffer(brochureUrl), MAX_BROCHURE_PAGES);
          /* Per-PDF, as the brief requires: pdfPagesToJpegs returns [] for a
             missing binary, a corrupt file and an unreadable page alike, and
             all three used to look like "this brochure simply has no pages". */
          if (!pages.length) {
            notes.push(`${card.slug}: brochure ${brochureUrl} produced no page (${plan.brochurePages} readable page(s) in the PDF${canRasterise ? "" : ", and pdftoppm is missing on this machine"})`);
          }
          for (const page of pages) {
            const stored = await storeUploadedImage(page, devKey);
            if (stored) { plansImages.push(stored); mediaChanged = true; }
          }
        } catch (e) {
          notes.push(`${card.slug}: brochure could not be rasterised (${(e as Error).message})`);
        }
      }

      const units = plan.units;

      /* The units and the price range are decided TOGETHER, and before the row
         below is written — see unitPlan. Counting the stored feed units needs
         the existing row's id, which is why this sits above the write rather
         than next to the delete it governs. */
      const storedFeedUnits = existing
        ? await prisma.developmentUnit.count({ where: { developmentId: existing.id, source: "feed" } })
        : 0;
      const unitDecision = unitPlan({
        hasPriceList: !!plan.priceListUrl,
        fresh: units.length,
        stored: storedFeedUnits,
        force: opts.force,
      });
      if (unitDecision.reason) notes.push(`${card.slug}: ${unitDecision.reason}`);

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
        syncedAt: new Date(),
        /* The price range rides with the unit list: both keys are omitted when
           the stored units are being kept, because this range was computed from
           the list that decision just rejected. Omitting rather than writing
           null is what lets the stored range survive — see unitPlan. */
        ...(unitDecision.keepStored ? {} : { priceFrom, priceTo }),
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

      if (unitDecision.write) {
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

           READ THE THIRD ONE AGAIN BEFORE CHANGING HOW A REF IS BUILT. It
           holds only while the ref a unit is given is STABLE — and the ref is
           the block heading plus the printed reference, so anything that
           changes either changes it. Widening cybarcoPriceTable's BLOCK_RE is
           the live example: recognising Trilogy's "EAST TOWER" /
           "NORTH RESIDENCES (A)" headings turns its unit 1701 into
           "EAST TOWER 1701", and every ClientPresentationItem.unitRefs entry
           pinning that unit stops matching. Because `unitIds` is null for
           units that have a ref, the fallback cannot catch them either: the
           units simply DISAPPEAR from a presentation an advisor already sent,
           silently, on the next sync. The same goes for touching
           cybarcoUnitRef's qualification or its transliteration.

           Harmless today only because Cybarco has never been synced, so no
           presentation references any of these units yet. Once one does, a
           change to the ref shape is a MIGRATION — re-key the stored
           unitRefs alongside it — not an improvement to the reader.

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

      /* ── Sold out, as Cybarco's own listing says ───────────────────────────

         Two facts, and the order of what follows comes entirely out of them.
         Cybarco mark a sold-out project on the listing page and PULL ITS PRICE
         LIST, so the mark is the only live evidence of availability there is.
         And a project that transitions on-sale -> sold out KEEPS its stored
         units (the branch above: the last list is the only record of what was
         there) — units whose statuses are a snapshot of a list that still
         showed rows available.

         That snapshot is stale the moment the mark appears, and leaving it
         alone is what produced a nightly oscillation: stamp soldOutSince, then
         recomputeDevelopmentDerivedState counts 3 of 24 available, clears the
         stamp via shouldClearSoldOut and stamps returnedToMarketAt, and
         backInStockReminders() announces "back in stock" for a project the
         developer lists as Sold Out — every night, because the next run finds
         soldOutSince null again and starts over. The old comment here claimed a
         sold-out project has no units; that is true of the six that were
         already sold out, not of the nine that will get there.

         So the stale rows are corrected rather than the sweep being fought.
         `source: "feed"` only: a feed row is OUR reading of the developer's
         document and the developer now says the project is sold, while a manual
         row is an admin's own assertion and is never overwritten by a sync. */
      if (card.status === "sold_out") {
        const corrected = await prisma.developmentUnit.updateMany({
          where: { developmentId: dev.id, source: "feed", status: { in: ["available", "reserved"] } },
          data: { status: "sold" },
        });
        if (corrected.count) {
          notes.push(`${card.slug}: Cybarco mark it Sold Out — ${corrected.count} stored feed unit(s) still read available/reserved and were set to sold`);
        }
      }

      await recomputeDevelopmentDerivedState(dev.id);

      /* Stamped AFTER the recompute, never before, and only against the state
         the recompute actually left behind. Stamping first is what let the
         stamp be undone two lines later; reading the row back means a date is
         only ever written when nothing can clear it. shouldClearSoldOut is
         deliberately untouched — it is shared by every developer and its
         total === 0 rule is what makes the six already-sold-out projects stick.

         `unitsAvailable > 0` here can only come from MANUAL rows (every feed row
         was just set to sold), i.e. an admin asserting a unit is available on a
         project the developer lists as Sold Out. That contradiction is reported
         and left to the human — availabilityContradiction() already surfaces it
         in the admin — rather than being resolved by stamping a sold-out date
         the next recompute would clear again. */
      if (card.status === "sold_out") {
        const after = await prisma.development.findUnique({
          where: { id: dev.id },
          select: { soldOutSince: true, unitsAvailable: true, unitsTotal: true },
        });
        const decision = after
          ? soldOutStamp({ soldOutSince: after.soldOutSince, available: after.unitsAvailable ?? 0 })
          : { stamp: false, contradiction: false };
        if (decision.contradiction) {
          notes.push(`${card.slug}: Cybarco mark it Sold Out but ${after?.unitsAvailable} of ${after?.unitsTotal} unit(s) are available in manual rows — soldOutSince NOT stamped, the units need a human`);
        }
        /* Stamped only when absent, so the date stays the FIRST time we saw it
           sold out. With zero available units nothing can clear it again. */
        if (decision.stamp) {
          await prisma.development.update({ where: { id: dev.id }, data: { soldOutSince: new Date() } });
        }
      }
    }

    if (mediaChanged) scheduleAppRestart();
    await prisma.developerAccount.update({ where: { id: accountId }, data: { driveSyncedAt: new Date() } });

    /* Writes still happen on a refused run: unitPlan() keeps stored units against
       a 0-unit read and contentNeeds() keeps stored media, so the night is
       harmless — it is the REPORTING of it as healthy that was the gap. */
    return { ok: verdict.ok, projects: plans.length, units: unitsWritten, created, notes, fetchAttempts, fetchFailures };
  } finally {
    release();
  }
}
