import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { deleteDeveloperAccount } from "@/app/admin/actions";
import { createManualDevelopment, runSync } from "../../actions";
import AnalyzeForm from "./analyze-form";
import DeveloperContact from "./DeveloperContact";
import DriveSyncButton from "./DriveSyncButton";
import DriveIntervalSelect from "./DriveIntervalSelect";
import BackLink from "../../BackLink";

export const dynamic = "force-dynamic";

const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#1B4B43]";
const fmt = (d: Date) => new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const STATUS_STYLE: Record<string, string> = {
  draft: "bg-[#F3F4F6] text-[#6B7280]", ready: "bg-[#FEF3C7] text-[#92400E]",
  published: "bg-[#DCFCE7] text-[#166534]", archived: "bg-[#FEE2E2] text-[#991B1B]",
};

export default async function DeveloperDetailPage({ params }: { params: { id: string } }) {
  const dev = await prisma.developerAccount.findUnique({
    where: { id: params.id },
    include: {
      analyses: { orderBy: { createdAt: "desc" } },
      developments: {
        orderBy: [{ publicName: "asc" }],
        include: { _count: { select: { units: true } }, override: { select: { alias: true } } },
      },
    },
  });
  if (!dev) notFound();

  const hasFeed = dev.analyses.some((a) => a.sourceType === "URL" || a.sourceType === "API")
    || dev.developments.some((d) => d.dev && d.dev !== "manual");
  const activeDevelopments = dev.developments.filter((d) => d.publishStatus !== "archived");
  const archivedDevelopments = dev.developments.filter((d) => d.publishStatus === "archived");
  const availableUnits = await prisma.developmentUnit.count({
    where: { status: "available", development: { developerAccountId: dev.id, publishStatus: { not: "archived" } } },
  });
  const del = deleteDeveloperAccount.bind(null, dev.id);
  const addDev = createManualDevelopment.bind(null, dev.id);
  const feedDevKey = dev.developments.find((d) => d.dev && d.dev !== "manual")?.dev ?? null;
  const lastSynced = dev.developments.map((d) => d.syncedAt).filter(Boolean).sort((a, b) => (a! < b! ? 1 : -1))[0] ?? null;

  return (
    <div className="space-y-6 max-w-5xl">
      <BackLink label="← Back" />

      <DeveloperContact
        dev={{ id: dev.id, name: dev.name, website: dev.website, contactPerson: dev.contactPerson, phone: dev.phone, email: dev.email, developerCloudUrl: dev.developerCloudUrl, driveFolderUrl: dev.driveFolderUrl, contactInfo: dev.contactInfo, notes: dev.notes }}
        badge={<span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${hasFeed ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#F3F4F6] text-[#6B7280]"}`}>{hasFeed ? "With feed" : "No feed"}</span>}
      />

      {/* Developments */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] p-6 space-y-4">
        <h2 className="text-sm font-semibold text-[#111827]">
          Developments <span className="text-[#9CA3AF] font-normal">· {activeDevelopments.length}</span>
          <span className="text-[#9CA3AF] font-normal ml-3">Units · {availableUnits}</span>
        </h2>
        {activeDevelopments.length > 0 ? (
          <div className="border border-[#E5E7EB] rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#F8F9FA] text-[#6B7280] text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Public name</th>
                  <th className="px-3 py-2 font-medium">Feed name <span className="font-normal text-[#9CA3AF]">(original)</span></th>
                  <th className="px-3 py-2 font-medium">Location</th>
                  <th className="px-3 py-2 font-medium text-right">Units</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {activeDevelopments.map((r) => {
                  const alias = r.override?.alias;
                  return (
                    <tr key={r.id} className="hover:bg-[#F8F9FA]">
                      <td className="px-3 py-2">
                        <Link href={`/admin/developments/${r.id}`} className="font-medium text-[#111827] hover:text-[#1B4B43] hover:underline">
                          {alias || r.publicName}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-[#9CA3AF]">{alias ? r.publicName : "—"}</td>
                      <td className="px-3 py-2 text-[#6B7280]">{[r.district, r.area].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="px-3 py-2 text-right text-[#6B7280] whitespace-nowrap">{r._count.units || "—"} units</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block rounded px-2 py-0.5 text-xs capitalize ${STATUS_STYLE[r.publishStatus] ?? "bg-[#F3F4F6] text-[#6B7280]"}`}>{r.publishStatus}</span>
                        {r.dev === "drive" && !r.driveFolderId && (
                          <span title="Kein passender Google-Drive-Ordner — keine Bilder/Grundrisse" className="ml-1.5 inline-block rounded px-2 py-0.5 text-xs border border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]">No folder</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[#6B7280]">No developments yet.</p>
        )}

        {archivedDevelopments.length > 0 && (
          <details className="pt-2">
            <summary className="text-sm font-semibold text-[#6B7280] cursor-pointer select-none">
              Archived <span className="text-[#9CA3AF] font-normal">· {archivedDevelopments.length}</span>
            </summary>
            <div className="border border-[#E5E7EB] rounded-md overflow-hidden mt-3 opacity-75">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-[#F3F4F6]">
                  {archivedDevelopments.map((r) => (
                    <tr key={r.id} className="hover:bg-[#F8F9FA]">
                      <td className="px-3 py-2">
                        <Link href={`/admin/developments/${r.id}`} className="font-medium text-[#111827] hover:text-[#1B4B43] hover:underline">
                          {r.override?.alias || r.publicName}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-[#6B7280]">{[r.district, r.area].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="px-3 py-2 text-right text-[#6B7280] whitespace-nowrap">{r._count.units || "—"} units</td>
                      <td className="px-3 py-2">
                        <span className="inline-block rounded px-2 py-0.5 text-xs capitalize bg-[#FEE2E2] text-[#991B1B]">archived</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        <form action={addDev} className="flex items-end gap-2 pt-1">
          <div className="flex-1 max-w-sm">
            <label className="block text-xs text-[#6B7280] mb-1">New development (manual)</label>
            <input name="name" required placeholder="Project name" className={input} />
          </div>
          <button className="rounded-md border border-[#1B4B43] text-[#1B4B43] text-sm font-medium px-4 py-2 hover:bg-[#1B4B43]/8 whitespace-nowrap">+ Create &amp; edit</button>
        </form>
        <p className="text-xs text-[#9CA3AF]">After creating, open the development to scan a developer PDF with Claude — it fills the description and units automatically.</p>
      </div>

      {/* Drive availability sync */}
      {dev.driveFolderUrl && (
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-6 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-[#111827]">Drive sync</h2>
            <div className="flex items-center gap-3 flex-wrap">
              <DriveIntervalSelect developerAccountId={dev.id} value={dev.driveSyncInterval ?? "daily"} />
              <DriveSyncButton developerAccountId={dev.id} />
            </div>
          </div>
          <p className="text-xs text-[#6B7280]">
            “Sync Drive now” does a full import — price list + project folders → developments, units, amenities, description &amp; images (as drafts). The scheduled job (interval above) then refreshes availability. Last synced: {dev.driveSyncedAt ? fmt(dev.driveSyncedAt) : "never"}.
          </p>
        </div>
      )}

      {/* Feed */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-[#111827]">Feed{hasFeed ? "" : " (optional)"}</h2>
          {feedDevKey && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#9CA3AF]">Last synced: {lastSynced ? fmt(lastSynced) : "never"} · feed <code>{feedDevKey}</code></span>
              <form action={runSync}>
                <input type="hidden" name="dev" value={feedDevKey} />
                <button className="rounded-md border border-[#1B4B43] text-[#1B4B43] text-sm font-medium px-3 py-1.5 hover:bg-[#1B4B43]/8 whitespace-nowrap">↻ Sync now</button>
              </form>
            </div>
          )}
        </div>
        <p className="text-xs text-[#6B7280]">Upload an XML file or provide a feed URL. We parse the structure and build a field-mapping table — nothing is imported.</p>
        <AnalyzeForm developerAccountId={dev.id} />
        {dev.analyses.length > 0 && (
          <div className="border border-[#E5E7EB] rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#F8F9FA] text-[#6B7280]">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Date</th>
                  <th className="text-left font-medium px-3 py-2">Source</th>
                  <th className="text-left font-medium px-3 py-2">Items</th>
                  <th className="text-left font-medium px-3 py-2">Fields</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {dev.analyses.map((a) => {
                  const fc = Array.isArray(a.fields) ? (a.fields as any[]).length : 0;
                  return (
                    <tr key={a.id} className="hover:bg-[#F8F9FA]">
                      <td className="px-3 py-2">
                        <Link href={`/admin/developments/developers/${dev.id}/analysis/${a.id}`} className="text-[#1B4B43] font-medium hover:underline">{fmt(a.createdAt)}</Link>
                      </td>
                      <td className="px-3 py-2 text-[#6B7280]">{a.sourceType === "URL" ? (a.sourceUrl ?? "URL") : (a.sourceFileName ?? "file")}</td>
                      <td className="px-3 py-2">{a.itemCount}</td>
                      <td className="px-3 py-2">{fc}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Danger */}
      <form action={del} className="pt-1">
        <button className="text-sm text-[#C0392B] hover:underline">Delete developer and all analyses</button>
      </form>
    </div>
  );
}
