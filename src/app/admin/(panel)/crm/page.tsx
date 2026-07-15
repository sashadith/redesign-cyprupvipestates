import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/app/admin/status-badge";
import DeleteLeadButton from "./DeleteLeadButton";
import {
  buildLeadWhere, orderForSort, leadQueryString,
  LEAD_STATUSES, LEAD_SOURCES, LEAD_LOCALES, LEAD_PAGE_SIZE, type LeadSearchParams,
} from "./filters";

export const dynamic = "force-dynamic";

const sel = "rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm bg-white";

export default async function CrmList({ searchParams }: { searchParams: LeadSearchParams }) {
  const where = buildLeadWhere(searchParams);
  const orderBy = orderForSort(searchParams);
  const pageNum = Math.max(1, parseInt(String(searchParams.page ?? "1"), 10) || 1);
  const val = (k: string) => (Array.isArray(searchParams[k]) ? (searchParams[k] as string[])[0] : (searchParams[k] as string)) ?? "";

  const [total, leads, users] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where, orderBy,
      skip: (pageNum - 1) * LEAD_PAGE_SIZE, take: LEAD_PAGE_SIZE,
      include: { assignedTo: { select: { name: true } } },
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / LEAD_PAGE_SIZE));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">CRM / Leads <span className="text-base font-normal text-[#6B7280]">({total})</span></h1>
        <div className="flex items-center gap-4">
          <Link href={`/admin/crm/export${leadQueryString(searchParams, { page: "" })}`} className="text-sm text-[#1B4B43] hover:underline">Export CSV ↓</Link>
          <Link href="/admin/crm/board" className="text-sm text-[#1B4B43] hover:underline">Pipeline view →</Link>
          <Link href="/admin/crm/new" className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-4 py-2 hover:bg-[#142E2D]">+ New lead</Link>
        </div>
      </div>

      {/* Filters (GET form) */}
      <form method="get" className="flex flex-wrap items-end gap-2 mb-4 bg-white border border-[#E5E7EB] rounded-lg p-3">
        <input name="q" defaultValue={val("q")} placeholder="Search name / email / phone" className={`${sel} min-w-[220px]`} />
        <select name="status" defaultValue={val("status")} className={sel}><option value="">All statuses</option>{LEAD_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select>
        <select name="source" defaultValue={val("source")} className={sel}><option value="">All sources</option>{LEAD_SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select>
        <select name="lang" defaultValue={val("lang")} className={sel}><option value="">All langs</option>{LEAD_LOCALES.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}</select>
        <select name="assignee" defaultValue={val("assignee")} className={sel}><option value="">Any assignee</option><option value="unassigned">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <select name="sort" defaultValue={val("sort")} className={sel}><option value="">Newest</option><option value="oldest">Oldest</option><option value="updated">Recently updated</option><option value="name">Name A–Z</option></select>
        <button className="rounded-md bg-[#1B4B43] text-white text-sm px-4 py-1.5 hover:bg-[#142E2D]">Apply</button>
        <Link href="/admin/crm" className="text-sm text-[#6B7280] hover:underline px-2 py-1.5">Reset</Link>
      </form>

      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[#6B7280]">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Name</th>
              <th className="text-left font-medium px-4 py-2.5">Contact</th>
              <th className="text-left font-medium px-4 py-2.5">Source</th>
              <th className="text-left font-medium px-4 py-2.5">Lang</th>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
              <th className="text-left font-medium px-4 py-2.5">Assigned</th>
              <th className="text-left font-medium px-4 py-2.5">Received</th>
              <th className="text-right font-medium px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {leads.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-[#6B7280]">No leads match these filters.</td></tr>
            ) : leads.map((l) => (
              <tr key={l.id} className="hover:bg-[#F8F9FA]">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/crm/${l.id}`} className="text-[#1B4B43] font-medium hover:underline">{l.firstName} {l.lastName}</Link>
                </td>
                <td className="px-4 py-2.5 text-[#6B7280]">{l.email}<br />{l.phone}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">{l.source.replace(/_/g, " ")}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">{l.languagePreference?.toUpperCase() ?? "—"}</td>
                <td className="px-4 py-2.5"><StatusBadge status={l.status} /></td>
                <td className="px-4 py-2.5 text-[#6B7280]">{l.assignedTo?.name ?? "—"}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">{new Date(l.createdAt).toLocaleDateString("en-GB")}</td>
                <td className="px-4 py-2.5 text-right"><DeleteLeadButton id={l.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-[#6B7280]">
          <span>Page {pageNum} of {pages} · {total} leads</span>
          <div className="flex gap-2">
            {pageNum > 1 && <Link href={`/admin/crm${leadQueryString(searchParams, { page: String(pageNum - 1) })}`} className="rounded-md border border-[#E5E7EB] px-3 py-1.5 hover:bg-[#F8F9FA]">← Prev</Link>}
            {pageNum < pages && <Link href={`/admin/crm${leadQueryString(searchParams, { page: String(pageNum + 1) })}`} className="rounded-md border border-[#E5E7EB] px-3 py-1.5 hover:bg-[#F8F9FA]">Next →</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
