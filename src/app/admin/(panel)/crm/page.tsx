import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/app/admin/status-badge";
import DeleteLeadButton from "./DeleteLeadButton";
import CollapsibleLeadsPanel from "./CollapsibleLeadsPanel";
import LeadBlockRows from "./LeadBlockRows";
import LeadFilterBar from "./LeadFilterBar";
import { COUNTRY_NAME_BY_CODE, countryCodeToFlagEmoji } from "@/lib/countries";
import {
  buildLeadWhere, orderForSort, leadQueryString,
  LEAD_STATUSES, LEAD_SOURCES, LEAD_LOCALES, type LeadSearchParams,
} from "./filters";

const LOST_CAP = 200;
const CLOSED_CAP = 200;
const BLOCK_PREVIEW = 6;

export const dynamic = "force-dynamic";

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

// 2026-08-11 lead-list rebuild — urgency now only decides which of the three
// active COLOR blocks (Red/Yellow/Green) a lead lands in; it's no longer a
// per-row sort key or a separate "Urgency" dropdown sort (block grouping
// already conveys that, a redundant sort added no information). HOT and
// KEEP_CONTACT leads are pulled out of this classification entirely before
// it's ever called — see the bucketing loop below.
const DAY_MS = 86_400_000;
type ColorBand = "RED" | "YELLOW" | "GREEN";
const BAND_STYLE: Record<ColorBand, { dot: string; border: string }> = {
  RED: { dot: "bg-red-600", border: "border-l-red-600" },
  YELLOW: { dot: "bg-amber-500", border: "border-l-amber-500" },
  GREEN: { dot: "bg-green-600", border: "border-l-green-600" },
};

function agoLabel(ms: number): string {
  const days = Math.floor(ms / DAY_MS);
  return days <= 0 ? "less than a day" : days === 1 ? "1 day" : `${days} days`;
}

function computeBand(
  lead: { status: string; nextFollowUpAt: Date | null; autoFollowUpCount: number; createdAt: Date },
  hasContact: boolean,
  now: number,
): { band: ColorBand; reason: string } {
  if (lead.status === "NEW" && !hasContact) {
    const age = now - lead.createdAt.getTime();
    if (age > DAY_MS) {
      return { band: "RED", reason: `New lead — first contact overdue by ${agoLabel(age - DAY_MS)}` };
    }
    return { band: "YELLOW", reason: "New lead — first contact pending" };
  }
  // Cadence-cap → RED: the automatic chain gave up: this is an action item,
  // not neutral, and the Action Center has no rule covering it either (it
  // never references autoFollowUpCount), so the color is this lead's only
  // signal that something needs a human. No-date → YELLOW: a lead an admin
  // hasn't yet scheduled anything for — a gap, not a rest state, but not as
  // sharp as an exhausted automatic chain.
  if (lead.autoFollowUpCount >= 3 && lead.nextFollowUpAt && lead.nextFollowUpAt.getTime() <= now) {
    return { band: "RED", reason: "Automatic follow-ups exhausted — needs your decision" };
  }
  if (!lead.nextFollowUpAt) {
    return { band: "YELLOW", reason: "No follow-up scheduled" };
  }
  const diff = lead.nextFollowUpAt.getTime() - now;
  if (diff < 0) {
    return { band: "RED", reason: `Follow-up overdue since ${agoLabel(-diff)}` };
  }
  if (diff <= DAY_MS) {
    return { band: "YELLOW", reason: "Due today" };
  }
  return { band: "GREEN", reason: `Follow-up due in ${Math.ceil(diff / DAY_MS)} days` };
}

type LeadRowData = {
  id: string; firstName: string; lastName: string;
  languagePreference: string | null; sourceLocale: string | null;
  countryOfResidence: string | null; status: string; createdAt: Date;
  hotAt: Date | null; budgetMax: number | null;
  assignedTo: { name: string } | null;
  interactions: { occurredAt: Date; type: string }[];
};

const money = (n: number | null) => (n == null ? "—" : `€${n.toLocaleString("en-GB")}`);

// Shared row markup for every block (HOT/color/KEEP_CONTACT/LOST/CLOSED) —
// `band` is only ever passed for the three color blocks; every other block
// is visually flat (its own section heading already carries the meaning),
// same as the old table's `muted` LOST/CLOSED rows.
function LeadRow({ lead: l, band, muted }: { lead: LeadRowData; band: { band: ColorBand; reason: string } | null; muted?: boolean }) {
  return (
    <tr className={`hover:bg-[#F8F9FA] ${muted ? "bg-[#FAFAFA] text-[#9CA3AF]" : ""}`}>
      <td className={`pl-3 pr-4 py-2.5 border-l-4 ${band ? BAND_STYLE[band.band].border : "border-l-transparent"}`}>
        <div className="flex items-center gap-2">
          {band && (
            <span className={`w-2 h-2 rounded-full shrink-0 ${BAND_STYLE[band.band].dot}`} title={band.reason} aria-label={band.reason} role="img" />
          )}
          <Link href={`/admin/crm/${l.id}`} className={`font-medium hover:underline ${muted ? "" : "text-[#1B4B43]"}`}>{l.firstName} {l.lastName}</Link>
        </div>
      </td>
      <td className="px-4 py-2.5 text-center text-base" title={l.hotAt ? `Hot since ${new Date(l.hotAt).toLocaleDateString("en-GB")}` : undefined}>
        {l.hotAt ? "🔥" : ""}
      </td>
      <td className={`px-4 py-2.5 ${muted ? "" : "text-[#6B7280]"}`}>
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
      <td className={`px-4 py-2.5 ${muted ? "" : "text-[#6B7280]"}`}>{money(l.budgetMax)}</td>
      <td className="px-4 py-2.5"><StatusBadge status={l.status} /></td>
      <td className="px-4 py-2.5 text-center text-base" title={l.countryOfResidence ? COUNTRY_NAME_BY_CODE[l.countryOfResidence] ?? l.countryOfResidence : undefined}>
        {l.countryOfResidence ? countryCodeToFlagEmoji(l.countryOfResidence) : ""}
      </td>
      <td className={`px-4 py-2.5 ${muted ? "" : "text-[#6B7280]"}`}>{l.assignedTo?.name ?? "—"}</td>
      <td className={`px-4 py-2.5 text-xs ${muted ? "" : ""}`}>
        <div title="Received (site locale at intake)">{l.sourceLocale ? l.sourceLocale.toUpperCase() : "—"}</div>
        <div className="text-[#9CA3AF]" title="Preferred (editable)">{l.languagePreference ? l.languagePreference.toUpperCase() : "—"}</div>
      </td>
      <td className="px-4 py-2.5 text-right"><DeleteLeadButton id={l.id} /></td>
    </tr>
  );
}

const TABLE_HEAD = (
  <thead className="bg-[#F8F9FA] text-[#6B7280]">
    <tr>
      <th className="text-left font-medium px-4 py-2.5">Name</th>
      <th className="text-center font-medium px-4 py-2.5">Hot</th>
      <th className="text-left font-medium px-4 py-2.5">Last contact</th>
      <th className="text-left font-medium px-4 py-2.5">Max budget</th>
      <th className="text-left font-medium px-4 py-2.5">Status</th>
      <th className="text-center font-medium px-4 py-2.5">Country</th>
      <th className="text-left font-medium px-4 py-2.5">Assigned</th>
      <th className="text-left font-medium px-4 py-2.5">Received / Preferred</th>
      <th className="text-right font-medium px-4 py-2.5"></th>
    </tr>
  </thead>
);

// One block = a heading (with a count) + its own table. Skipped entirely
// when empty (same "don't render empty sections" rule the old Lost/Closed
// panels already followed).
function LeadBlockSection({
  title, dot, leads, bandById,
}: {
  title: string;
  dot?: string;
  leads: LeadRowData[];
  bandById?: Map<string, { band: ColorBand; reason: string }>;
}) {
  if (!leads.length) return null;
  return (
    <div className="mb-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[#374151] mb-2">
        {dot && <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />}
        {title} <span className="font-normal text-[#9CA3AF]">({leads.length})</span>
      </h2>
      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
        <table className="w-full text-sm">
          {TABLE_HEAD}
          <tbody className="divide-y divide-[#E5E7EB]">
            <LeadBlockRows previewCount={BLOCK_PREVIEW}>
              {leads.map((l) => (
                <LeadRow key={l.id} lead={l} band={bandById?.get(l.id) ?? null} />
              ))}
            </LeadBlockRows>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function CrmList({ searchParams }: { searchParams: LeadSearchParams }) {
  const orderBy = orderForSort(searchParams);
  const val = (k: string) => (Array.isArray(searchParams[k]) ? (searchParams[k] as string[])[0] : (searchParams[k] as string)) ?? "";
  const statusParam = val("status");
  const hasActiveFilter = !!(val("q") || val("status") || val("source") || val("lang") || val("assignee"));

  // LOST and CLOSED leads each live in their own collapsed section (never
  // the main blocks below), so the shared filters (q/source/lang/assignee)
  // need to fan out into three status conditions instead of one. Whichever
  // side the user's explicit status filter doesn't match is skipped entirely
  // (query -> null -> []) — e.g. filtering status=LOST empties every active
  // block and the Closed section on purpose (spec).
  const baseWhere = buildLeadWhere(searchParams);
  let activeWhere: Prisma.LeadWhereInput | null = null;
  let lostWhere: Prisma.LeadWhereInput | null = null;
  let closedWhere: Prisma.LeadWhereInput | null = null;
  if (statusParam === "LOST") {
    lostWhere = baseWhere;
  } else if (statusParam === "CLOSED") {
    closedWhere = baseWhere;
  } else if (statusParam) {
    activeWhere = baseWhere; // an explicit other status already excludes LOST/CLOSED
  } else {
    activeWhere = { ...baseWhere, status: { notIn: ["LOST", "CLOSED"] } };
    lostWhere = { ...baseWhere, status: "LOST" };
    closedWhere = { ...baseWhere, status: "CLOSED" };
  }

  const leadInclude = {
    assignedTo: { select: { name: true } },
    interactions: {
      where: { type: { in: [...LAST_CONTACT_TYPES] } },
      orderBy: { occurredAt: "desc" as const },
      take: 1,
      select: { occurredAt: true, type: true },
    },
  };

  // Pagination removed (2026-08-11 spec) — every active lead is fetched and
  // sorted into its block below; only Lost/Closed keep a hard cap (they're
  // terminal, already collapsed by default, and can genuinely run into the
  // thousands over time in a way the active pipeline never should).
  const [activeTotal, rawActiveLeads, lostTotal, rawLostLeads, closedTotal, rawClosedLeads, users] = await Promise.all([
    activeWhere ? prisma.lead.count({ where: activeWhere }) : Promise.resolve(0),
    activeWhere ? prisma.lead.findMany({ where: activeWhere, orderBy, include: leadInclude }) : Promise.resolve([]),
    lostWhere ? prisma.lead.count({ where: lostWhere }) : Promise.resolve(0),
    lostWhere ? prisma.lead.findMany({ where: lostWhere, orderBy, take: LOST_CAP, include: leadInclude }) : Promise.resolve([]),
    closedWhere ? prisma.lead.count({ where: closedWhere }) : Promise.resolve(0),
    closedWhere ? prisma.lead.findMany({ where: closedWhere, orderBy, take: CLOSED_CAP, include: leadInclude }) : Promise.resolve([]),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  // Bucketing order matters and IS the spec: HOT is checked first (a hot
  // lead appears only there, never duplicated in its color block — see
  // hotAt's schema comment), then KEEP_CONTACT (its own block, deliberately
  // outside the urgency cadence — see WARM_CONTACT_STATUSES in crm.ts), and
  // only leads reaching neither get classified into Red/Yellow/Green.
  const now = Date.now();
  const hot: LeadRowData[] = [];
  const keepContact: LeadRowData[] = [];
  const red: LeadRowData[] = [];
  const yellow: LeadRowData[] = [];
  const green: LeadRowData[] = [];
  const bandById = new Map<string, { band: ColorBand; reason: string }>();
  for (const l of rawActiveLeads) {
    if (l.hotAt) {
      hot.push(l);
    } else if (l.status === "KEEP_CONTACT") {
      keepContact.push(l);
    } else {
      const b = computeBand(l, l.interactions.length > 0, now);
      bandById.set(l.id, b);
      (b.band === "RED" ? red : b.band === "YELLOW" ? yellow : green).push(l);
    }
  }
  const shownActive = hot.length + red.length + yellow.length + green.length + keepContact.length;
  const lostDefaultOpen = hasActiveFilter && lostTotal > 0;
  const closedDefaultOpen = hasActiveFilter && closedTotal > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">CRM / Leads <span className="text-base font-normal text-[#6B7280]">({activeTotal})</span></h1>
        <div className="flex items-center gap-4">
          <Link href={`/admin/crm/export${leadQueryString(searchParams, { page: "" })}`} className="text-sm text-[#1B4B43] hover:underline">Export CSV ↓</Link>
          <Link href="/admin/crm/board" className="text-sm text-[#1B4B43] hover:underline">Pipeline view →</Link>
          <Link href="/admin/crm/calendar" className="text-sm text-[#1B4B43] hover:underline">Calendar →</Link>
          <Link href="/admin/crm/new" className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-4 py-2 hover:bg-[#142E2D]">+ New lead</Link>
        </div>
      </div>

      <LeadFilterBar statuses={LEAD_STATUSES} sources={LEAD_SOURCES} locales={LEAD_LOCALES} users={users} />

      {/* 2026-08-11 — legend extended with HOT and KEEP CONTACT; the dot's
          meaning was previously only ever visible via hover (title attribute
          on the dot itself), this makes the scheme legible without hovering
          every row. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-xs text-[#6B7280]">
        <span className="flex items-center gap-1.5">🔥 Hot</span>
        <span className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${BAND_STYLE.RED.dot}`} />Overdue</span>
        <span className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${BAND_STYLE.YELLOW.dot}`} />Due soon / not yet scheduled</span>
        <span className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${BAND_STYLE.GREEN.dot}`} />On track</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500" />Keep contact</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#9CA3AF]" />Lost / Closed</span>
      </div>

      {shownActive === 0 && lostTotal === 0 && closedTotal === 0 ? (
        <div className="bg-white rounded-lg border border-[#E5E7EB] px-4 py-8 text-center text-[#6B7280] text-sm">
          No leads match these filters.
        </div>
      ) : shownActive === 0 ? (
        <div className="bg-white rounded-lg border border-[#E5E7EB] px-4 py-8 text-center text-[#6B7280] text-sm mb-6">
          No active leads match these filters.
        </div>
      ) : (
        <>
          <LeadBlockSection title="Hot leads" leads={hot} />
          <LeadBlockSection title="Overdue" dot={BAND_STYLE.RED.dot} leads={red} bandById={bandById} />
          <LeadBlockSection title="Due soon" dot={BAND_STYLE.YELLOW.dot} leads={yellow} bandById={bandById} />
          <LeadBlockSection title="On track" dot={BAND_STYLE.GREEN.dot} leads={green} bandById={bandById} />
          <LeadBlockSection title="Keep contact" dot="bg-purple-500" leads={keepContact} />
        </>
      )}

      {lostTotal > 0 && (
        <CollapsibleLeadsPanel key={`lost-${leadQueryString(searchParams)}`} label="Lost leads" count={lostTotal} defaultOpen={lostDefaultOpen}>
          <table className="w-full text-sm border-t border-[#E5E7EB]">
            {TABLE_HEAD}
            <tbody className="divide-y divide-[#E5E7EB]">
              {rawLostLeads.map((l) => (
                <LeadRow key={l.id} lead={l} band={null} muted />
              ))}
            </tbody>
          </table>
          {lostTotal > LOST_CAP && (
            <p className="px-4 py-2 text-xs text-[#9CA3AF] border-t border-[#E5E7EB]">
              Showing the first {LOST_CAP} of {lostTotal} lost leads.
            </p>
          )}
        </CollapsibleLeadsPanel>
      )}

      {closedTotal > 0 && (
        <CollapsibleLeadsPanel key={`closed-${leadQueryString(searchParams)}`} label="Closed leads" count={closedTotal} defaultOpen={closedDefaultOpen}>
          <table className="w-full text-sm border-t border-[#E5E7EB]">
            {TABLE_HEAD}
            <tbody className="divide-y divide-[#E5E7EB]">
              {rawClosedLeads.map((l) => (
                <LeadRow key={l.id} lead={l} band={null} muted />
              ))}
            </tbody>
          </table>
          {closedTotal > CLOSED_CAP && (
            <p className="px-4 py-2 text-xs text-[#9CA3AF] border-t border-[#E5E7EB]">
              Showing the first {CLOSED_CAP} of {closedTotal} closed leads.
            </p>
          )}
        </CollapsibleLeadsPanel>
      )}
    </div>
  );
}
