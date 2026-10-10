import type { Prisma } from "@prisma/client";
import { imagesFor, type BridgeImage } from "./images";
import { resolveDevelopmentPrice } from "@/lib/developmentCard";
import { computeAvailability, listedUnits } from "@/lib/developmentAvailability";

/**
 * The shape Task 4's query must select. Declared here, next to the allowlist
 * it feeds, so the query cannot quietly start fetching a column this file
 * would then pass through untouched.
 */
export const BRIDGE_INCLUDE = {
  override: true,
  units: { orderBy: { sortIndex: "asc" } },
  developerAccount: { select: { slug: true } },
  // A RELATION, not a JSON array — DevelopmentSlugHistory rows, one per
  // retired slug. Verified against the schema 2026-10-09, because treating it
  // as a scalar array would have silently delivered [] for every project and
  // left Xellex unable to build redirects for anything ever renamed here.
  slugHistory: { select: { slug: true }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.DevelopmentInclude;

export type DevelopmentWithRelations = Prisma.DevelopmentGetPayload<{ include: typeof BRIDGE_INCLUDE }>;

/**
 * WITHHELD, by allowlist rather than by omission.
 *
 * The first draft of this feature said "deliver the whole row". That would
 * have exported `driveFolderId`, and on this site a Drive folder id IS an
 * access token: those folders are shared by anonymous link (see the Drive and
 * Korantina connectors). It would have handed a second portal read access to
 * developers' source folders.
 *
 *   driveFolderId, driveImagesModified  — the credential above, plus its clock
 *   developerAccountId, dev, feedProjectId, feedKey — internal source identity;
 *       feedKey is literally "<vendor>:<id>". Withheld as fields, but note
 *       (measured 2026-10-09) that this is tidiness rather than secrecy for
 *       three of them: imageMirror names folders "<pipeline>-<accountId>-<slug>"
 *       or "<dev>-<feedProjectId>", so those values ride inside the image URLs
 *       of 53 of 350 payloads — and are already in the live public HTML of
 *       cyprusvipestates.com, so the bridge discloses nothing a visitor cannot
 *       read. `driveFolderId` is the one that is genuinely a credential, and it
 *       appears in no payload and in no image path (0 hits for all 39 distinct
 *       values across all 350 projects)
 *   syncedAt, imageDriftDetectedAt, newFromFeed — sync bookkeeping
 *   presentationItems, supersedesProjects — CRM and migration relations
 *   publishStatus, createdAt — withheld as noise rather than as secrets, and
 *       named here only because an allowlist whose withheld list is incomplete
 *       cannot be audited: every row this API can return is "published" by
 *       construction, and createdAt is when CVE first synced the row, not
 *       anything about the project — publishedAt is the date that travels.
 *
 * An allowlist also fails safe forward: a column added to Development next
 * year is withheld until someone decides it should travel, instead of
 * appearing on a public portal the week it is created.
 */
export type BridgeUnit = {
  id: string; ref: string | null; name: string | null; label: string | null; type: string | null;
  status: string | null; price: number | null; currency: string | null;
  beds: string | null; baths: string | null;
  areaBuilt: string | null; areaInternal: string | null; areaPlot: string | null;
  areaVeranda: string | null; areaVerandaOpen: string | null;
  floor: string | null; unitNumber: string | null; storage: string | null; guestWc: string | null;
  orientation: string | null; latitude: number | null; longitude: number | null;
  attrs: unknown; amenities: unknown; sortIndex: number | null;
  photos: BridgeImage[]; plans: BridgeImage[];
};

export type BridgeProject = {
  id: string;
  slug: string | null;
  slugHistory: string[];
  publicName: string;
  developerName: string;
  developer: string | null;
  developerAccount: { slug: string };
  category: string | null; status: string | null; stage: string | null;
  completion: string | null; energy: string | null;
  district: string | null; town: string | null; area: string | null;
  priceFrom: number | null; priceTo: number | null; currency: string | null;
  latitude: number | null; longitude: number | null;
  unitsTotal: number; unitsAvailable: number;
  soldOutSince: string | null; returnedToMarketAt: string | null;
  description: string | null;
  amenities: string[]; distances: unknown; extraFacts: unknown;
  publishedAt: string | null;
  updatedAt: string;
  override: {
    alias: string | null; heroVideo: string | null;
    descriptionEN: string | null; descriptionDE: string | null;
    descriptionPL: string | null; descriptionRU: string | null; descriptionHE: string | null;
    promoBlocksEN: unknown; promoBlocksDE: unknown;
    promoBlocksPL: unknown; promoBlocksRU: unknown; promoBlocksHE: unknown;
    seo: unknown; vatApplies: boolean | null;
  } | null;
  mainImage: BridgeImage | null;
  gallery: BridgeImage[];
  plans: BridgeImage[];
  units: BridgeUnit[];
};

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
// The same stored URL can appear twice in one gallery — a source-data fault,
// measured 2026-10-10 on 3 of 350 published projects (plus-39 holds 58 entries
// for 45 distinct images) and on 3 unit photo lists. cyprusvipestates.com
// renders the duplicate too, so this is not a divergence from the page so much
// as a decision not to propagate the fault: a repeated URL carries no
// information, and a consumer that re-hosts would download and publish the
// same picture twice. Order is preserved, so the hero stays first.
const uniq = (urls: string[]): string[] => Array.from(new Set(urls));

/**
 * How many /uploads/ references a row HOLDS, versus how many images the built
 * payload DELIVERS. The route compares the two per page.
 *
 * Why this exists: `imagesFor` drops an image whose files cannot be stat'd,
 * which is right for one missing photo and catastrophic for all of them.
 * `public/uploads` is a per-release symlink to /var/www/shared-uploads; if
 * that link is missing, every stat fails, every array comes back empty, and
 * the route would answer 200 / complete / ok with `gallery: []` for all 350
 * projects. Xellex re-hosts the images and syncs incrementally, so it would
 * read that as "these projects have no images now" and could drop the 11 GiB
 * it mirrored — never delivered, never reported, one level below the row.
 */
export function countStoredRefs(row: DevelopmentWithRelations): number {
  const o = row.override;
  const base = strings(o?.gallery).length > 0 ? strings(o?.gallery) : strings(row.gallery);
  const main = o?.mainImage ?? null;
  // Counted after de-duplication, because that is what buildProject delivers —
  // comparing a raw count against a de-duplicated one would make the route's
  // image guard read a shortfall that is not one.
  let n = uniq(main ? [main, ...base.filter((u) => u !== main)] : base).length + uniq(strings(row.plans)).length;
  for (const u of listedUnits(row.units)) n += uniq(strings(u.photos)).length + uniq(strings(u.plans)).length;
  return n;
}

export function countDeliveredImages(p: BridgeProject): number {
  let n = p.gallery.length + p.plans.length;
  for (const u of p.units) n += u.photos.length + u.plans.length;
  return n;
}

export async function buildProject(row: DevelopmentWithRelations): Promise<BridgeProject> {
  const o = row.override;
  // The override's images win over the development's when set — same precedence
  // mapRowToVM (src/lib/developmentRender.ts) applies for the public project
  // page, so Xellex shows what cyprusvipestates.com shows rather than the raw
  // feed gallery an admin already replaced. Length-checked, not null-checked,
  // for the same reason the page does it: an empty admin gallery means "never
  // curated", not "deliberately blank".
  const baseGallery = strings(o?.gallery).length > 0 ? strings(o?.gallery) : strings(row.gallery);
  // The hero is the FIRST element of the gallery, not a separate image beside
  // it — mapRowToVM builds `main ? [main, ...gallery.filter(u => u !== main)]
  // : gallery`, and this now does the same. The earlier version delivered
  // `mainImage` as its own field and left the gallery untouched, which
  // measured badly in both directions on 2026-10-09: for 300 of 350 published
  // projects the hero was ALSO an element of the gallery, so a consumer
  // rendering [mainImage, ...gallery] drew it twice; and the 50 projects with
  // no `override.mainImage` arrived with no nominated hero at all, while CVE
  // shows gallery[0]. No published project has a mainImage outside its
  // gallery, so the prepend only ever de-duplicates.
  const main = o?.mainImage ?? null;
  const galleryUrls = uniq(main ? [main, ...baseGallery.filter((u) => u !== main)] : baseGallery);
  const [gallery, plans] = await Promise.all([
    imagesFor(galleryUrls),
    imagesFor(uniq(strings(row.plans))),
  ]);

  // `unlisted` units do not travel. CVE keeps them as full rows — price, area,
  // photos — but the public site never renders one (`listedUnits()`, and the
  // type comment in UnitsView.tsx says so outright: "kept in the DB with its
  // full row but never shown on the public site"). 215 of the 4,921 units on
  // published projects are unlisted, measured 2026-10-09. Delivering them with
  // nothing but an opaque status string would put stock CVE deliberately
  // withdrew back on sale on a second public domain — and it would leave
  // `units.length` disagreeing with the counts below.
  const visibleUnits = listedUnits(row.units);
  const availability = computeAvailability(visibleUnits);
  const units: BridgeUnit[] = [];
  for (const u of visibleUnits) {
    const [photos, unitPlans] = await Promise.all([imagesFor(uniq(strings(u.photos))), imagesFor(uniq(strings(u.plans)))]);
    units.push({
      id: u.id, ref: u.ref, name: u.name, label: u.label, type: u.type,
      status: u.status, price: u.price, currency: u.currency,
      beds: u.beds, baths: u.baths,
      areaBuilt: u.areaBuilt, areaInternal: u.areaInternal, areaPlot: u.areaPlot,
      areaVeranda: u.areaVeranda, areaVerandaOpen: u.areaVerandaOpen,
      floor: u.floor, unitNumber: u.unitNumber, storage: u.storage, guestWc: u.guestWc,
      orientation: u.orientation, latitude: u.latitude, longitude: u.longitude,
      attrs: u.attrs, amenities: u.amenities, sortIndex: u.sortIndex,
      photos, plans: unitPlans,
    });
  }

  return {
    id: row.id,
    slug: row.slug,
    // Xellex builds its own URLs and needs the retired slugs to set up its own
    // redirects when a project is renamed on this side. Empty for every
    // project today — the table holds 0 rows as of 2026-10-09 because it only
    // records renames from its own introduction onward — so this travels for
    // the renames that have yet to happen, not for history.
    slugHistory: row.slugHistory.map((h) => h.slug),
    publicName: o?.alias || row.publicName,
    developerName: row.developerName,
    developer: row.developer,
    // The SLUG only, deliberately: `DeveloperAccount.name` is an admin label,
    // not a public name. Measured 2026-10-09: 277 of 350 published projects sit
    // under an account whose name encodes the integration — "BBF (API)",
    // "Aristo (XML)", "Korantina Homes (SharePoint)", "AGG (CC)" — or is a
    // bucket rather than a developer ("Misc Projects"). Delivering it would put
    // CVE's internal plumbing on a public portal and would defeat the stated
    // reason for withholding `dev` and `feedKey` two lines up. The slug is a
    // stable grouping key and carries no label; `developer` above is the public
    // name, the one cyprusvipestates.com itself displays.
    developerAccount: { slug: row.developerAccount.slug },
    category: row.category, status: row.status,
    stage: o?.stage ?? row.stage,
    completion: o?.completion ?? row.completion,
    energy: o?.energy ?? row.energy,
    district: o?.district ?? row.district,
    town: o?.town ?? row.town,
    area: o?.area ?? row.area,
    // Price is RECOMPUTED from the units, not read off the row. The columns are
    // a cache that `resolveDevelopmentPrice` (src/lib/developmentCard.ts) only
    // falls back to when no unit carries a price; every CVE surface displays
    // the recomputed range. Measured 2026-10-09 across all 350 published
    // projects, the row columns alone would have delivered a different range
    // for 100 of them, no `priceFrom` at all for 33 that CVE prices, and no
    // `priceTo` for 79 — venara would have gone out at "from 305,000" against
    // its real entry price of 245,000, i.e. 60,000 too high, on a second
    // public portal.
    ...resolveDevelopmentPrice(row.priceFrom, row.priceTo, visibleUnits),
    currency: row.currency,
    latitude: o?.latitude ?? row.latitude,
    longitude: o?.longitude ?? row.longitude,
    // Counts are RECOMPUTED too, and the schema says why in terms this feature
    // cannot argue with: `unitsTotal`/`unitsAvailable` carry "May be stale —
    // NEVER read for display or logic, always use computeAvailability() ...
    // instead", written after the Trinity Residences incident of 2026-07-31.
    // Measured 2026-10-09: 26 of 350 published projects have cached counts
    // that disagree with their own unit rows, and two disagree dangerously —
    // azalea-villas caches 8 available with `soldOutSince` set and all 8 units
    // sold, serenity-court the same with 1. Shipping that would have
    // advertised sold villas as available on a public portal, in a payload
    // that contradicted itself.
    //
    // Taken over the LISTED population, which is what every public count must
    // use (see isListedUnit's comment: GALAXY RESIDENCES once said "29 Units"
    // above a list of 27) and what keeps `unitsTotal` equal to `units.length`
    // in the delivered payload.
    unitsTotal: availability.total,
    unitsAvailable: availability.available,
    soldOutSince: iso(row.soldOutSince),
    returnedToMarketAt: iso(row.returnedToMarketAt),
    description: row.description,
    // Amenities are the UNION of the admin's and the feed's, not
    // override-wins like every field above. The schema calls this column
    // "admin-checked amenities merged with feed ones", and mapRowToVM builds
    // exactly that union for the public page. An earlier draft of this file
    // used `??`: measured against production on 2026-10-09 that under-
    // delivered 30 of 350 published projects and 96 amenities in total —
    // Elpez would have shipped 19 of the 31 its own page lists, Blossom Park
    // 6 of 12 — because an admin who ticks boxes in the editor saves only
    // their own list, never a copy of the feed's.
    amenities: Array.from(new Set([...strings(o?.amenities), ...strings(row.amenities)])),
    distances: row.distances,
    extraFacts: row.extraFacts,
    publishedAt: iso(row.publishedAt),
    updatedAt: row.updatedAt.toISOString(),
    override: o
      ? {
          alias: o.alias, heroVideo: o.heroVideo,
          descriptionEN: o.descriptionEN, descriptionDE: o.descriptionDE,
          descriptionPL: o.descriptionPL, descriptionRU: o.descriptionRU, descriptionHE: o.descriptionHE,
          promoBlocksEN: o.promoBlocksEN, promoBlocksDE: o.promoBlocksDE,
          promoBlocksPL: o.promoBlocksPL, promoBlocksRU: o.promoBlocksRU, promoBlocksHE: o.promoBlocksHE,
          seo: o.seo, vatApplies: o.vatApplies,
        }
      : null,
    mainImage: gallery[0] ?? null,
    gallery,
    plans,
    units,
  };
}
