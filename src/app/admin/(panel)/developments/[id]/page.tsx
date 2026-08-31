import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { aiConfigured } from "@/lib/ai/anthropic";
import { saveOverride, setStatus } from "./actions";
import PdfImport from "./PdfImport";
import AmenitiesField from "./AmenitiesField";
import DescriptionField from "./DescriptionField";
import SaveOverridesButton from "./SaveOverridesButton";
import BackLink from "../BackLink";
import UnitsEditor from "./UnitsEditor";
import GalleryManager from "./GalleryManager";
import FloorPlansManager from "./FloorPlansManager";
import SyncWithDriveButton from "./SyncWithDriveButton";
import ArchiveButton from "./ArchiveButton";
import MapLocationField from "./MapLocationField";
import SlugField from "@/app/admin/SlugField";
import { getDbProjectByFeedKey } from "@/lib/developmentRender";
import { autoMetaTitle, autoMetaDescription, developmentSlug, TITLE_MAX, DESC_MAX } from "@/lib/developmentSeo";
import { computePublishGate, areaSlugOf } from "@/lib/developmentPublishGate";
import { computeAvailability, availabilityContradiction } from "@/lib/developmentAvailability";
import { getSeoPromptTemplate } from "@/lib/ai/seoMeta";
import SeoMetaFields from "./SeoMetaFields";
import SyncControlPanel from "./SyncControlPanel";
import { SYNCED_DEVS, FORCE_SYNC_DEVS } from "@/lib/feedSync";

export const dynamic = "force-dynamic";

const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-[#F3F4F6] text-[#6B7280]",
  ready: "bg-[#FEF3C7] text-[#92400E]",
  published: "bg-[#DCFCE7] text-[#166534]",
  archived: "bg-[#FEE2E2] text-[#991B1B]",
};
const field = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#1B4B43] focus:outline-none";
const label = "block text-xs font-medium text-[#6B7280] mb-1";

export default async function DevelopmentDetail({ params }: { params: { id: string } }) {
  const d = await prisma.development.findUnique({
    where: { id: params.id },
    include: {
      override: true,
      _count: { select: { units: true } },
      units: { orderBy: [{ sortIndex: "asc" }] },
      developerAccount: { select: { driveFolderUrl: true } },
    },
  });
  if (!d) notFound();
  const ov = d.override;

  // Sync control panel (Teil 1-3): a Development is "feed-managed" (editor
  // read-only, see UnitsEditor) only while it's a real synced dev AND none
  // of its units have been frozen to manual yet — the exact same condition
  // syncDeveloperCore checks before it wipes+recreates units. manualUnits
  // summary feeds the manual→auto switch's data-loss warning (Teil 3) with
  // real numbers, computed here from data already being fetched.
  const isSyncedDev = SYNCED_DEVS.includes(d.dev);
  const manualUnits = d.units.filter((u) => u.source === "manual");
  const isFeedManaged = isSyncedDev && manualUnits.length === 0;
  const jsonArrLen = (v: unknown) => (Array.isArray(v) ? v.length : 0);
  const manualSummary = {
    count: manualUnits.length,
    photos: manualUnits.reduce((n, u) => n + jsonArrLen(u.photos), 0),
    attrs: manualUnits.reduce((n, u) => n + jsonArrLen(u.attrs), 0),
    amenities: manualUnits.reduce((n, u) => n + jsonArrLen(u.amenities), 0),
  };

  const gallery = arr(ov?.gallery).length ? arr(ov?.gallery) : arr(d.gallery);
  // "New in feed" picks — locally-mirrored images from the last "Reload
  // images" click that aren't in the curated gallery/plans yet (see
  // Development.newFromFeed's schema comment, feedSync.ts). Empty for the
  // common case (no drift, or drift not yet acted on) — GalleryManager/
  // FloorPlansManager only render the section when it's non-empty.
  const newFromFeed = d.newFromFeed as { gallery?: string[]; plans?: string[] } | null;
  const newGalleryFromFeed = arr(newFromFeed?.gallery);
  const newPlansFromFeed = arr(newFromFeed?.plans);
  const area = ov?.area || d.area || "";
  const district = ov?.district || d.district || "";
  const lat = ov?.latitude ?? d.latitude;
  const lng = ov?.longitude ?? d.longitude;
  const areaDesc = area ? await prisma.areaDescription.findFirst({ where: { areaSlug: areaSlugOf(area), status: "approved" } }) : null;
  const description = ov?.descriptionEN || d.description || "";

  // Override wins — see DevelopmentOverride.stage's schema comment for why this
  // moved off Development.stage (feedSync.ts silently reverted admin choices).
  const resolvedStage = ov?.stage || d.stage;
  const { soldOut, available } = computeAvailability(d.units);
  const gate = computePublishGate({
    description, area, district, lat, lng, stage: resolvedStage,
    hasAreaDescription: !!areaDesc, gallery, mainImage: ov?.mainImage, soldOut,
  });
  const canPublish = gate.every((g) => g.ok);
  const availabilityWarning = availabilityContradiction(resolvedStage, d.status, soldOut, available);

  // Reconstruct the id from the feedKey (minus the "dev:" prefix) so getDbProject
  // rebuilds the EXACT stored key. Drive feedKeys are 3-part (drive:<accountId>:<slug>),
  // so passing only feedProjectId (the slug) would miss and fall back to the live feed.
  // Once a slug exists, link straight to the real SEO-facing URL — the ?dev=&id=
  // route now just 301s there anyway.
  const previewHref = d.slug
    ? `/projects/${encodeURIComponent(d.slug)}`
    : `/preview-project?dev=${d.dev}&id=${encodeURIComponent(d.feedKey.slice(d.dev.length + 1))}`;

  // Auto-generated title/description per language, shown as placeholders so the
  // admin can see exactly what ships without typing anything — see
  // src/lib/developmentSeo.ts. Needs the full render VM (units drive the
  // beds/type/price computations), so reuse the same lookup the public page uses.
  const vmForSeo = await getDbProjectByFeedKey(d.feedKey);
  const seoLangs = ["en", "de", "pl", "ru"] as const;
  const autoTitle = Object.fromEntries(seoLangs.map((l) => [l, vmForSeo ? autoMetaTitle(vmForSeo, l) : ""])) as Record<string, string>;
  const autoDesc = Object.fromEntries(seoLangs.map((l) => [l, vmForSeo ? autoMetaDescription(vmForSeo, l) : ""])) as Record<string, string>;
  const seoOv = (ov?.seo as Record<string, string> | null) ?? null;
  const slugPlaceholder = developmentSlug(ov?.alias || d.publicName);
  const seoInitial = Object.fromEntries(
    seoLangs.flatMap((l) => [
      [`title${l.toUpperCase()}`, seoOv?.[`title${l.toUpperCase()}`] || autoTitle[l]],
      [`desc${l.toUpperCase()}`, seoOv?.[`desc${l.toUpperCase()}`] || autoDesc[l]],
    ]),
  ) as Record<string, string>;
  const seoPrompt = await getSeoPromptTemplate();
  // The project's own Drive media subfolder if we've already resolved one, else
  // the developer's root Drive folder (the project may not have a subfolder yet).
  const driveViewHref = d.dev === "drive"
    ? (d.driveFolderId ? `https://drive.google.com/drive/folders/${d.driveFolderId}` : d.developerAccount.driveFolderUrl)
    : null;

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header card. One left axis for everything: the previous header pinned
          the buttons to the right edge while the text stayed left, which on a
          phone read as two competing columns and wrapped 2+1+2. */}
      <div className="relative overflow-hidden rounded-lg border border-[#E5E7EB] bg-white px-4 py-4 sm:px-5">
        {/* Bronze edges on both sides — they frame the card, they do not encode
            state; the publish status is the chip's job alone. */}
        <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[var(--bronze)]" />
        <span aria-hidden className="absolute inset-y-0 right-0 w-1 bg-[var(--bronze)]" />

        <BackLink label="← Back" />
        <h1 className="mt-1 text-[length:var(--text-h3)] font-semibold leading-tight text-[#111827]">{ov?.alias || d.publicName}</h1>

        {/* Facts. A filled chip is a state someone chose (the publish status);
            an outlined chip is a fact derived from the data (source, units).
            Keeping the two apart stops the row reading as five equal blobs. */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {/* The developer leads the row: it is the only chip you can click, so
              it carries the brand bronze and an arrow rather than a status
              colour. Text is the darker step #826238, not --bronze itself —
              #8E6B3D measures 4.42:1 on this tint, just under the AA floor. */}
          {d.developer && (
            <Link
              href={`/admin/developments/developers/${d.developerAccountId}`}
              className="inline-flex items-center gap-1 rounded-full border border-[#E3D2B4] bg-[#FDF3E3] px-2.5 py-1 text-xs font-medium text-[#826238] hover:border-[var(--bronze)] hover:bg-[#F8EAD3]"
            >
              {d.developer}
              <span aria-hidden>↗</span>
            </Link>
          )}
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLE[d.publishStatus]}`}>
            {d.publishStatus}
          </span>
          <span
            title={`Data source — this project is managed by the "${d.dev}" connector`}
            className="rounded-full border border-[#E5E7EB] px-2.5 py-1 text-xs text-[#6B7280]"
          >
            {d.dev}
          </span>
          {/* Sold out is the one derived fact that changes what you do next, so
              it escalates from an outlined chip to the site's own sold badge —
              carmine #8C2F2F on ivory, the same pair as .prj__badge--sold. */}
          {soldOut ? (
            <span
              title="Computed from unit data — updates with every sync"
              className="rounded-full bg-[#8C2F2F] px-2.5 py-1 text-xs font-medium text-[var(--ivory)]"
            >
              Sold out
            </span>
          ) : (
            <span
              title="Computed from unit data — updates with every sync"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] px-2.5 py-1 text-xs text-[#374151]"
            >
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${d.units.length === 0 ? "bg-[#D1D5DB]" : "bg-[#16A34A]"}`}
              />
              {d.units.length === 0 ? "No unit data" : `${available}/${d.units.length} available`}
            </span>
          )}
          {/* The feed's own project name, shown only when it differs from the
              name on screen — it was printed unconditionally before, which on
              most projects just repeated the heading word for word. */}
          {d.developerName !== (ov?.alias || d.publicName) && (
            <span
              title="The project's original name in the feed"
              className="rounded-full border border-dashed border-[#E5E7EB] px-2.5 py-1 text-xs text-[#9CA3AF]"
            >
              feed: {d.developerName}
            </span>
          )}
          {d.dev === "drive" && !d.driveFolderId && (
            <span
              title="No matching Google Drive folder — no photos/floor plans"
              className="rounded-full border border-[#FCD34D] bg-[#FFFBEB] px-2.5 py-1 text-xs text-[#92400E]"
            >
              No folder
            </span>
          )}
        </div>

        {/* Actions. One left-aligned row that wraps as a whole, so the left edge
            stays straight at every width. Every control is h-9 — the old row
            mixed text-sm and text-xs buttons and sat visibly uneven. The
            navigation pair is its own group behind a divider: it leaves the
            admin for another app, the others stay inside the tool. */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#F3F4F6] pt-3">
          {d.dev === "drive" && <SyncWithDriveButton developmentId={d.id} />}
          {driveViewHref && (
            <a href={driveViewHref} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-md border border-[#C7A87A] px-4 text-sm text-[#826238] hover:border-[var(--bronze)] hover:bg-[#FDF3E3]">View in Drive ↗</a>
          )}
          <a href={previewHref} target="_blank" className="inline-flex h-9 items-center rounded-md border border-[#C7A87A] px-4 text-sm text-[#826238] hover:border-[var(--bronze)] hover:bg-[#FDF3E3]">View page ↗</a>

          {/* Turn-by-turn navigation to the project. Both are https universal
              links, not waze:// or comgooglemaps:// — those dead-end when the
              app is missing, while these open the app when it is installed and
              the web version otherwise (which is all a desktop admin can do). */}
          {lat != null && lng != null && (
            <>
              <span aria-hidden className="mx-1 hidden h-5 w-px bg-[#E5E7EB] sm:block" />
              <a
                href={`https://waze.com/ul?ll=${lat}%2C${lng}&navigate=yes`}
                target="_blank"
                rel="noopener noreferrer"
                title={`Navigate to ${lat}, ${lng} with Waze`}
                className="inline-flex h-9 items-center rounded-md bg-[#33CCFF] px-4 text-xs font-semibold tracking-wide text-[#04264A] hover:bg-[#12BEEF]"
              >
                WAZE ROUTE ↗
              </a>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${lat}%2C${lng}&travelmode=driving`}
                target="_blank"
                rel="noopener noreferrer"
                title={`Navigate to ${lat}, ${lng} with Google Maps`}
                className="inline-flex h-9 items-center rounded-md bg-[#4285F4] px-4 text-xs font-semibold tracking-wide text-white hover:bg-[#3367D6]"
              >
                GOOGLE ROUTE ↗
              </a>
            </>
          )}
        </div>
      </div>

      {availabilityWarning && (
        <div className="rounded-md border border-[#FCD34D] bg-[#FFFBEB] text-[#92400E] text-sm px-4 py-2.5">
          ⚠ {availabilityWarning}
        </div>
      )}

      {aiConfigured() && <PdfImport id={d.id} />}

      <div className="grid md:grid-cols-3 gap-5">
        {/* ── EDIT (overrides) ── */}
        <form action={saveOverride} className="md:col-span-2 space-y-4 bg-white rounded-lg border border-[#E5E7EB] p-5">
          <input type="hidden" name="id" value={d.id} />
          <h2 className="text-sm font-semibold text-[#111827]">Overrides <span className="font-normal text-[#9CA3AF]">— win over feed values on the public page</span></h2>

          <div>
            <label className={label}>Public name (alias)</label>
            <input name="alias" defaultValue={ov?.alias ?? ""} placeholder={d.publicName} className={field} />
          </div>

          <div>
            <label className={label}>Construction stage</label>
            <select name="stage" defaultValue={ov?.stage ?? ""} className={field}>
              <option value="">—</option>
              {resolvedStage && !["Available", "Under Construction", "Key-Ready", "Sold"].includes(resolvedStage) && <option value={resolvedStage}>{resolvedStage}</option>}
              <option value="Available">Available</option>
              <option value="Under Construction">Under Construction</option>
              <option value="Key-Ready">Key-Ready</option>
              <option value="Sold">Sold</option>
            </select>
            <p className="text-xs text-[#9CA3AF] mt-1">
              Availability ({d.units.length === 0 ? "no unit data" : soldOut ? "sold out" : `${available} available`}) is computed from units automatically and cannot be set manually.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><label className={label}>District</label><input name="district" defaultValue={ov?.district ?? ""} placeholder={d.district ?? ""} className={field} /></div>
            <div><label className={label}>Locality</label><input name="town" defaultValue={ov?.town ?? ""} placeholder={d.town ?? ""} className={field} /></div>
            <div><label className={label}>Area</label><input name="area" defaultValue={ov?.area ?? ""} placeholder={d.area ?? ""} className={field} /></div>
          </div>

          <MapLocationField
            developmentId={d.id}
            initialLat={ov?.latitude ?? d.latitude}
            initialLng={ov?.longitude ?? d.longitude}
          />

          <div>
            <label className={label}>Description</label>
            <DescriptionField
              developmentId={d.id}
              aiReady={aiConfigured()}
              initial={{
                en: ov?.descriptionEN ?? d.description ?? "",
                de: ov?.descriptionDE ?? "",
                pl: ov?.descriptionPL ?? "",
                ru: ov?.descriptionRU ?? "",
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><label className={label}>Completion</label><input name="completion" defaultValue={ov?.completion ?? ""} placeholder={d.completion ?? ""} className={field} /></div>
            <div><label className={label}>Energy</label><input name="energy" defaultValue={ov?.energy ?? ""} placeholder={d.energy ?? ""} className={field} /></div>
            <div><label className={label}>Hero video URL</label><input name="heroVideo" defaultValue={ov?.heroVideo ?? ""} placeholder="upload later" className={field} /></div>
          </div>

          <div>
            <label className={label}>Amenities</label>
            <AmenitiesField selected={arr(ov?.amenities).length ? arr(ov?.amenities) : arr(d.amenities)} />
          </div>

          <details className="rounded-md border border-[#E5E7EB] p-3">
            <summary className="text-sm font-semibold text-[#111827] cursor-pointer select-none">
              SEO <span className="font-normal text-[#9CA3AF]">(pre-filled with the auto-generated text — edit in place, or leave as-is)</span>
            </summary>
            <div className="mt-3 space-y-3">
              <div>
                <SlugField
                  name="slug"
                  titleFieldName="alias"
                  fallbackTitle={d.publicName}
                  initialValue={d.slug ?? ""}
                  label="URL slug"
                  helpText={null}
                />
                <p className="text-xs text-[#9CA3AF] mt-1">
                  {d.slug
                    ? <>Live at <code>/projects/{d.slug}</code>. Assigned automatically on first publish — changing it moves the public URL, so only do this deliberately.</>
                    : `Assigned automatically the first time this project is published (auto: ${slugPlaceholder}). Set one now to reserve a specific URL, or use Generate.`}
                </p>
              </div>
              <SeoMetaFields
                developmentId={d.id}
                initial={seoInitial as any}
                titleMax={TITLE_MAX}
                descMax={DESC_MAX}
                aiReady={aiConfigured()}
                initialPrompt={seoPrompt}
              />
            </div>
          </details>

          <SaveOverridesButton />
        </form>

        {/* ── SIDEBAR: publication + feed reference ── */}
        <div className="space-y-5">
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[#111827]">Publication</h2>
            <ul className="space-y-1.5 text-sm">
              {gate.map((g) => (
                <li key={g.label} className="flex items-start gap-2">
                  <span className={g.ok ? "text-[#16A34A]" : "text-[#DC2626]"}>{g.ok ? "✓" : "✗"}</span>
                  <span className={g.ok ? "text-[#374151]" : "text-[#DC2626]"}>{g.label}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 pt-1 flex-wrap">
              {d.publishStatus !== "published" ? (
                <form action={setStatus}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="status" value="published" />
                  <button disabled={!canPublish} className="rounded-md bg-[#166534] text-white text-sm font-medium px-4 py-2 disabled:bg-[#D1D5DB] disabled:cursor-not-allowed hover:bg-[#14532D]">Publish</button>
                </form>
              ) : (
                <form action={setStatus}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="status" value="draft" />
                  <button className="rounded-md border border-[#E5E7EB] text-sm px-4 py-2 hover:bg-[#F8F9FA]">Unpublish</button>
                </form>
              )}
              <ArchiveButton id={d.id} archived={d.publishStatus === "archived"} />
            </div>
            {!canPublish && <p className="text-xs text-[#9CA3AF]">Fill the required fields above to enable publishing.</p>}
          </div>

          <div className="bg-[#F8F9FA] rounded-lg border border-[#E5E7EB] p-5 space-y-2 text-sm">
            <h2 className="text-sm font-semibold text-[#111827] mb-2">Feed data (reference)</h2>
            <div className="flex justify-between"><span className="text-[#6B7280]">Location</span><span>{[d.district, d.town, d.area].filter(Boolean).join(" · ") || "—"}</span></div>
            <div className="flex justify-between"><span className="text-[#6B7280]">Price from</span><span>{d.priceFrom ? "€" + d.priceFrom.toLocaleString("en-US") : "—"}</span></div>
            <div className="flex justify-between"><span className="text-[#6B7280]">Stage</span><span>{resolvedStage || "—"}</span></div>
            <div className="flex justify-between"><span className="text-[#6B7280]">Completion</span><span>{d.completion || "—"}</span></div>
            <div className="flex justify-between"><span className="text-[#6B7280]">Category</span><span>{d.category || "—"}</span></div>
            <div className="flex justify-between"><span className="text-[#6B7280]">Units</span><span>{d._count.units}</span></div>
            <div className="flex justify-between"><span className="text-[#6B7280]">Images</span><span>{gallery.length}</span></div>
            <div className="flex justify-between"><span className="text-[#6B7280]">Feed key</span><span className="text-xs text-[#9CA3AF]">{d.feedKey}</span></div>
          </div>
        </div>
      </div>

      <GalleryManager developmentId={d.id} initial={gallery} initialHero={ov?.mainImage ?? ""} isDriveSynced={d.dev === "drive"} newInFeed={newGalleryFromFeed} />

      <FloorPlansManager developmentId={d.id} initial={arr(d.plans)} isDriveSynced={d.dev === "drive"} newInFeed={newPlansFromFeed} />

      <SyncControlPanel
        developmentId={d.id}
        dev={d.dev}
        canForceSync={FORCE_SYNC_DEVS.includes(d.dev)}
        canToggle={isSyncedDev}
        isFeedManaged={isFeedManaged}
        manualSummary={manualSummary}
      />

      <UnitsEditor
        developmentId={d.id}
        isDriveSynced={d.dev === "drive"}
        isFeedManaged={isFeedManaged}
        initial={d.units.map((u) => ({
          id: u.id,
          label: u.label || u.ref || "",
          ref: u.ref || "",
          feedRef: u.feedRef || "",
          source: u.source || "feed",
          type: u.type || "",
          beds: u.beds || "",
          baths: u.baths || "",
          areaBuilt: u.areaBuilt || "",
          areaInternal: u.areaInternal || "",
          areaPlot: u.areaPlot || "",
          areaVeranda: u.areaVeranda || "",
          areaVerandaOpen: u.areaVerandaOpen || "",
          floor: u.floor || "",
          unitNumber: u.unitNumber || "",
          storage: u.storage || "",
          guestWc: u.guestWc || "",
          orientation: u.orientation || "",
          price: u.price != null ? String(u.price) : "",
          status: u.status || "available",
          amenities: arr(u.amenities),
          photos: arr(u.photos),
          plans: arr(u.plans),
          attrs: (Array.isArray(u.attrs) ? u.attrs : []) as { name: string; value: string }[],
        }))}
      />
    </div>
  );
}
