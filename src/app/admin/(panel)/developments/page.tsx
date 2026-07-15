import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { runSync } from "./actions";
import DevelopmentsTable from "./DevelopmentsTable";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtPrice = (n: number | null) => (n == null ? "—" : "€" + n.toLocaleString("en-US"));

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-[#F3F4F6] text-[#6B7280]",
  ready: "bg-[#FEF3C7] text-[#92400E]",
  published: "bg-[#DCFCE7] text-[#166534]",
  archived: "bg-[#FEE2E2] text-[#991B1B]",
};

export default async function DevelopmentsPage({ searchParams }: { searchParams?: { dev?: string; status?: string } }) {
  const dev = searchParams?.dev || "";
  const status = searchParams?.status || "";
  // "All statuses" (no explicit filter) excludes archived — archived projects only
  // show up via the dedicated Archived pill, never mixed into the default list/search.
  const where = { ...(dev ? { dev } : {}), ...(status ? { publishStatus: status } : { publishStatus: { not: "archived" } }) };

  const [rows, byDev, byStatus, total] = await Promise.all([
    prisma.development.findMany({
      where,
      orderBy: [{ dev: "asc" }, { publicName: "asc" }],
      include: { _count: { select: { units: true } }, override: { select: { alias: true } } },
    }),
    prisma.development.groupBy({ by: ["dev"], _count: { _all: true }, orderBy: { dev: "asc" } }),
    prisma.development.groupBy({ by: ["publishStatus"], _count: { _all: true } }),
    prisma.development.count(),
  ]);

  const statusCount = Object.fromEntries(byStatus.map((s) => [s.publishStatus, s._count._all]));
  const qp = (o: Record<string, string>) => {
    const p = new URLSearchParams({ ...(dev ? { dev } : {}), ...(status ? { status } : {}), ...o });
    Object.entries(o).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    return "?" + p.toString();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#111827]">Developments</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            {total} projects synced from developer feeds. Edit the public alias, location, images and description per project, then publish.
          </p>
        </div>
        <form action={runSync}>
          <input type="hidden" name="dev" value={dev || "all"} />
          <button className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-5 py-2.5 hover:bg-[#142E2D]">
            ↻ Sync {dev ? dev : "all feeds"} now
          </button>
        </form>
      </div>

      {/* developer filter */}
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href={qp({ dev: "" })} className={`rounded-full px-3 py-1 border ${!dev ? "bg-[#1B4B43] text-white border-[#1B4B43]" : "border-[#E5E7EB] text-[#374151] hover:bg-[#F8F9FA]"}`}>
          All · {total}
        </Link>
        {byDev.map((g) => (
          <Link key={g.dev} href={qp({ dev: g.dev })} className={`rounded-full px-3 py-1 border ${dev === g.dev ? "bg-[#1B4B43] text-white border-[#1B4B43]" : "border-[#E5E7EB] text-[#374151] hover:bg-[#F8F9FA]"}`}>
            {g.dev} · {g._count._all}
          </Link>
        ))}
      </div>

      {/* status filter */}
      <div className="flex flex-wrap gap-2 text-xs">
        <Link href={qp({ status: "" })} className={`rounded px-2.5 py-1 ${!status ? "bg-[#111827] text-white" : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"}`}>All statuses</Link>
        {["draft", "ready", "published", "archived"].map((s) => (
          <Link key={s} href={qp({ status: s })} className={`rounded px-2.5 py-1 capitalize ${status === s ? "bg-[#111827] text-white" : (STATUS_STYLE[s] ?? "bg-[#F3F4F6]") + " hover:opacity-80"}`}>
            {s} · {statusCount[s] ?? 0}
          </Link>
        ))}
      </div>

      <DevelopmentsTable
        rows={rows.map((r) => ({
          id: r.id,
          name: r.override?.alias || r.publicName,
          feedName: r.override?.alias && r.override.alias !== r.publicName ? r.publicName : null,
          dev: r.dev,
          developer: r.developer || r.dev,
          location: [r.district, r.town, r.area].filter(Boolean).join(" · ") || "—",
          priceFrom: fmtPrice(r.priceFrom),
          units: r._count.units ? String(r._count.units) : "—",
          status: r.publishStatus,
          noFolder: r.dev === "drive" && !r.driveFolderId,
          synced: fmtDate(r.syncedAt),
        }))}
      />
    </div>
  );
}
