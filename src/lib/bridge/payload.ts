import type { Prisma } from "@prisma/client";
import { imagesFor, type BridgeImage } from "./images";

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

export async function buildProject(row: DevelopmentWithRelations): Promise<BridgeProject> {
  const o = row.override;
  // The override's images win over the development's when set — same precedence
  // mapRowToVM (src/lib/developmentRender.ts) applies for the public project
  // page, so Xellex shows what cyprusvipestates.com shows rather than the raw
  // feed gallery an admin already replaced. Length-checked, not null-checked,
  // for the same reason the page does it: an empty admin gallery means "never
  // curated", not "deliberately blank".
  const galleryUrls = strings(o?.gallery).length > 0 ? strings(o?.gallery) : strings(row.gallery);
  const [mainImage, gallery, plans] = await Promise.all([
    o?.mainImage ? imagesFor([o.mainImage]) : Promise.resolve([]),
    imagesFor(galleryUrls),
    imagesFor(strings(row.plans)),
  ]);

  const units: BridgeUnit[] = [];
  for (const u of row.units) {
    const [photos, unitPlans] = await Promise.all([imagesFor(strings(u.photos)), imagesFor(strings(u.plans))]);
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
    priceFrom: row.priceFrom, priceTo: row.priceTo, currency: row.currency,
    latitude: o?.latitude ?? row.latitude,
    longitude: o?.longitude ?? row.longitude,
    unitsTotal: row.unitsTotal, unitsAvailable: row.unitsAvailable,
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
    mainImage: mainImage[0] ?? null,
    gallery,
    plans,
    units,
  };
}
