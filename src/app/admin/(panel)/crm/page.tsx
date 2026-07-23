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

// "Contact" = an actual outreach/reply, not internal notes or system-generated
// rows (status changes, presentation-view tracking). Presentation delivery by
// email already lands as an EMAIL_OUT interaction (see PropertyMatching's
// "Send by email"), so it's covered without a separate case here.
const LAST_CONTACT_TYPES = ["CALL", "EMAIL_OUT", "EMAIL_IN", "WHATSAPP_OUT", "WHATSAPP_IN"] as const;
const LAST_CONTACT_LABEL: Record<string, string> = {
  CALL: "Call",
  EMAIL_OUT: "Email",
  EMAIL_IN: "Email",
  WHATSAPP_OUT: "WhatsApp",
  WHATSAPP_IN: "WhatsApp",
};

// Urgency traffic-light — visually aligned with the Action Center's dot +
// severity styling (ActionCenterPanel.tsx's DOT_COLOR), extended to 4 bands
// since leads need a neutral "nothing to do" state the Action Center doesn't.
const DAY_MS = 86_400_000;
type UrgencyBand = "RED" | "YELLOW" | "GREEN" | "GRAY";
const URGENCY_RANK: Record<UrgencyBand, number> = { RED: 0, YELLOW: 1, GREEN: 2, GRAY: 3 };
const URGENCY_STYLE: Record<UrgencyBand, { dot: string; border: string }> = {
  RED: { dot: "bg-red-600", border: "border-l-red-600" },
  YELLOW: { dot: "bg-amber-500", border: "border-l-amber-500" },
  GREEN: { dot: "bg-green-600", border: "border-l-green-600" },
  GRAY: { dot: "bg-[#9CA3AF]", border: "border-l-[#9CA3AF]" },
};

function agoLabel(ms: number): string {
  const days = Math.floor(ms / DAY_MS);
  return days <= 0 ? "less than a day" : days === 1 ? "1 day" : `${days} days`;
}

function computeUrgency(
  lead: { status: string; nextFollowUpAt: Date | null; autoFollowUpCount: number; createdAt: Date },
  hasContact: boolean,
  now: number,
): { band: UrgencyBand; reason: string; sortTime: number } {
  if (lead.status === "CLOSED" || lead.status === "LOST") {
    return { band: "GRAY", reason: `${lead.status === "CLOSED" ? "Closed" : "Lost"} — no active follow-up`, sortTime: lead.createdAt.getTime() };
  }
  if (lead.status === "NEW" && !hasContact) {
    const age = now - lead.createdAt.getTime();
    if (age > DAY_MS) {
      return { band: "RED", reason: `New lead — first contact overdue by ${agoLabel(age - DAY_MS)}`, sortTime: lead.createdAt.getTime() };
    }
    return { band: "YELLOW", reason: "New lead — first contact pending", sortTime: lead.createdAt.getTime() };
  }
  if (lead.autoFollowUpCount >= 3 && lead.nextFollowUpAt && lead.nextFollowUpAt.getTime() <= now) {
    return { band: "GRAY", reason: "Auto follow-up chain at cap (3/3), no reaction — needs manual reset", sortTime: lead.nextFollowUpAt.getTime() };
  }
  if (!lead.nextFollowUpAt) {
    return { band: "GRAY", reason: "No follow-up date scheduled", sortTime: lead.createdAt.getTime() };
  }
  const diff = lead.nextFollowUpAt.getTime() - now;
  if (diff < 0) {
    return { band: "RED", reason: `Follow-up overdue since ${agoLabel(-diff)}`, sortTime: lead.nextFollowUpAt.getTime() };
  }
  if (diff <= DAY_MS) {
    return { band: "YELLOW", reason: "Due today", sortTime: lead.nextFollowUpAt.getTime() };
  }
  return { band: "GREEN", reason: `Follow-up due in ${Math.ceil(diff / DAY_MS)} days`, sortTime: lead.nextFollowUpAt.getTime() };
}

export default async function CrmList({ searchParams }: { searchParams: LeadSearchParams }) {
  const where = buildLeadWhere(searchParams);
  const orderBy = orderForSort(searchParams);
  const pageNum = Math.max(1, parseInt(String(searchParams.page ?? "1"), 10) || 1);
  const val = (k: string) => (Array.isArray(searchParams[k]) ? (searchParams[k] as string[])[0] : (searchParams[k] as string)) ?? "";
  const isUrgencySort = val("sort") === "urgency";

  const leadInclude = {
    assignedTo: { select: { name: true } },
    interactions: {
      where: { type: { in: [...LAST_CONTACT_TYPES] } },
      orderBy: { occurredAt: "desc" as const },
      take: 1,
      select: { occurredAt: true, type: true },
    },
  };

  // Urgency isn't a stored column, so it can't be pushed into the DB's
  // ORDER BY/LIMIT — fetch every filtered row and sort/paginate in JS instead.
  // Fine at this table's scale (low hundreds of leads); revisit if that changes.
  const [total, rawLeads, users] = await Promise.all([
    prisma.lead.count({ where }),
    isUrgencySort
      ? prisma.lead.findMany({ where, include: leadInclude })
      : prisma.lead.findMany({ where, orderBy, skip: (pageNum - 1) * LEAD_PAGE_SIZE, take: LEAD_PAGE_SIZE, include: leadInclude }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / LEAD_PAGE_SIZE));

  const now = Date.now();
  const withUrgency = rawLeads.map((l) => ({ lead: l, urgency: computeUrgency(l, l.interactions.length > 0, now) }));
  if (isUrgencySort) {
    withUrgency.sort((a, b) => URGENCY_RANK[a.urgency.band] - URGENCY_RANK[b.urgency.band] || a.urgency.sortTime - b.urgency.sortTime);
  }
  const leads = isUrgencySort
    ? withUrgency.slice((pageNum - 1) * LEAD_PAGE_SIZE, (pageNum - 1) * LEAD_PAGE_SIZE + LEAD_PAGE_SIZE).map((x) => x.lead)
    : withUrgency.map((x) => x.lead);
  const urgencyById = new Map(withUrgency.map((x) => [x.lead.id, x.urgency]));

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
        <select name="sort" defaultValue={val("sort")} className={sel}><option value="">Newest</option><option value="oldest">Oldest</option><option value="updated">Recently updated</option><option value="name">Name A–Z</option><option value="urgency">Urgency</option></select>
        <button className="rounded-md bg-[#1B4B43] text-white text-sm px-4 py-1.5 hover:bg-[#142E2D]">Apply</button>
        <Link href="/admin/crm" className="text-sm text-[#6B7280] hover:underline px-2 py-1.5">Reset</Link>
      </form>

      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[#6B7280]">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Name</th>
              <th className="text-left font-medium px-4 py-2.5">Contact</th>
              <th className="text-left font-medium px-4 py-2.5">Last contact</th>
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
            ) : leads.map((l) => {
              const urgency = urgencyById.get(l.id)!;
              return (
              <tr key={l.id} className="hover:bg-[#F8F9FA]">
                <td className={`pl-3 pr-4 py-2.5 border-l-4 ${URGENCY_STYLE[urgency.band].border}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${URGENCY_STYLE[urgency.band].dot}`} title={urgency.reason} aria-label={urgency.reason} role="img" />
                    <Link href={`/admin/crm/${l.id}`} className="text-[#1B4B43] font-medium hover:underline">{l.firstName} {l.lastName}</Link>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-[#6B7280]">{l.email}<br />{l.phone}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">
                  {l.interactions[0] ? (
                    <>
                      {new Date(l.interactions[0].occurredAt).toLocaleDateString("en-GB")}
                      <br />
                      <span className="text-xs text-[#9CA3AF]">{LAST_CONTACT_LABEL[l.interactions[0].type]}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2.5 text-[#6B7280]">{l.languagePreference?.toUpperCase() ?? "—"}</td>
                <td className="px-4 py-2.5"><StatusBadge status={l.status} /></td>
                <td className="px-4 py-2.5 text-[#6B7280]">{l.assignedTo?.name ?? "—"}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">{new Date(l.createdAt).toLocaleDateString("en-GB")}</td>
                <td className="px-4 py-2.5 text-right"><DeleteLeadButton id={l.id} /></td>
              </tr>
              );
            })}
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
