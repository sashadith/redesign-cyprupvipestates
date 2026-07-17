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
import { getDbProject } from "@/lib/developmentRender";
import { autoMetaTitle, autoMetaDescription, developmentSlug, TITLE_MAX, DESC_MAX } from "@/lib/developmentSeo";
import { computePublishGate, areaSlugOf } from "@/lib/developmentPublishGate";
import { getSeoPromptTemplate } from "@/lib/ai/seoMeta";
import SeoMetaFields from "./SeoMetaFields";

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

  const gallery = arr(ov?.gallery).length ? arr(ov?.gallery) : arr(d.gallery);
  const area = ov?.area || d.area || "";
  const district = ov?.district || d.district || "";
  const lat = ov?.latitude ?? d.latitude;
  const lng = ov?.longitude ?? d.longitude;
  const areaDesc = area ? await prisma.areaDescription.findFirst({ where: { areaSlug: areaSlugOf(area), status: "approved" } }) : null;
  const description = ov?.descriptionEN || d.description || "";

  const gate = computePublishGate({
    description, area, district, lat, lng, stage: d.stage,
    hasAreaDescription: !!areaDesc, gallery, mainImage: ov?.mainImage,
  });
  const canPublish = gate.every((g) => g.ok);

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
  const vmForSeo = await getDbProject(d.dev, d.feedProjectId);
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <BackLink label="← Back" />
          <h1 className="text-xl font-semibold text-[#111827] mt-1 flex items-center gap-2 flex-wrap">
            {ov?.alias || d.publicName}
            {d.developer && <span className="text-sm font-normal text-[#6B7280]">— {d.developer}</span>}
          </h1>
          <p className="text-sm text-[#6B7280]">{d.dev} · {d.developerName} · <span className={`rounded px-2 py-0.5 text-xs capitalize ${STATUS_STYLE[d.publishStatus]}`}>{d.publishStatus}</span>{d.dev === "drive" && !d.driveFolderId && (
            <span title="Kein passender Google-Drive-Ordner — keine Bilder/Grundrisse" className="ml-1.5 inline-block rounded px-2 py-0.5 text-xs border border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]">No folder</span>
          )}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {d.dev === "drive" && <SyncWithDriveButton developmentId={d.id} />}
          {driveViewHref && (
            <a href={driveViewHref} target="_blank" rel="noopener noreferrer" className="rounded-md border border-[#E5E7EB] text-sm px-4 py-2 hover:bg-[#F8F9FA]">View in Drive ↗</a>
          )}
          <a href={previewHref} target="_blank" className="rounded-md border border-[#E5E7EB] text-sm px-4 py-2 hover:bg-[#F8F9FA]">View page ↗</a>
        </div>
      </div>

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
            <label className={label}>Status <span className="font-normal text-[#9CA3AF]">— shown as a badge on the public page</span></label>
            <select name="stage" defaultValue={d.stage ?? ""} className={field}>
              <option value="">—</option>
              {d.stage && !["Available", "Under Construction", "Key-Ready", "Sold"].includes(d.stage) && <option value={d.stage}>{d.stage}</option>}
              <option value="Available">Available</option>
              <option value="Under Construction">Under Construction</option>
              <option value="Key-Ready">Key-Ready</option>
              <option value="Sold">Sold</option>
            </select>
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
                <label className={label}>URL slug</label>
                <input name="slug" defaultValue={d.slug ?? ""} placeholder={d.slug ? undefined : `auto: ${slugPlaceholder}`} className={field} />
                <p className="text-xs text-[#9CA3AF] mt-1">
                  {d.slug
                    ? <>Live at <code>/projects/{d.slug}</code>. Assigned automatically on first publish — changing it moves the public URL, so only do this deliberately.</>
                    : "Assigned automatically the first time this project is published. Set one now to reserve a specific URL."}
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
            <div className="flex justify-between"><span className="text-[#6B7280]">Stage</span><span>{d.stage || "—"}</span></div>
            <div className="flex justify-between"><span className="text-[#6B7280]">Completion</span><span>{d.completion || "—"}</span></div>
            <div className="flex justify-between"><span className="text-[#6B7280]">Category</span><span>{d.category || "—"}</span></div>
            <div className="flex justify-between"><span className="text-[#6B7280]">Units</span><span>{d._count.units}</span></div>
            <div className="flex justify-between"><span className="text-[#6B7280]">Images</span><span>{gallery.length}</span></div>
            <div className="flex justify-between"><span className="text-[#6B7280]">Feed key</span><span className="text-xs text-[#9CA3AF]">{d.feedKey}</span></div>
          </div>
        </div>
      </div>

      <GalleryManager developmentId={d.id} initial={gallery} initialHero={ov?.mainImage ?? ""} isDriveSynced={d.dev === "drive"} />

      <FloorPlansManager developmentId={d.id} initial={arr(d.plans)} isDriveSynced={d.dev === "drive"} />

      <UnitsEditor
        developmentId={d.id}
        isDriveSynced={d.dev === "drive"}
        initial={d.units.map((u) => ({
          id: u.id,
          label: u.label || u.ref || "",
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
          attrs: (Array.isArray(u.attrs) ? u.attrs : []) as { name: string; value: string }[],
        }))}
      />
    </div>
  );
}
