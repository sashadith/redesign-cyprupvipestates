import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { FaFire } from "react-icons/fa";
import { prisma } from "@/lib/prisma";
import { ELEVATED_NO_CONTACT_STATUSES } from "@/lib/actionCenter/rules/crm";
import { bucketOf } from "@/lib/crm/leadBucket";
import CollapsibleLeadsPanel from "./CollapsibleLeadsPanel";
import LeadBlockRows from "./LeadBlockRows";
import LeadRow from "./LeadRow";
import LeadFilterBar from "./LeadFilterBar";
import {
  buildLeadWhere, orderForSort, leadQueryString,
  LEAD_STATUSES, LEAD_LIST_SOURCES, LEAD_LOCALES, type LeadSearchParams,
} from "./filters";
import {
  LAST_CONTACT_TYPES,
  HUMAN_TOUCH_TYPES,
  isUntouchedNewLead, BAND_STYLE, computeBand, type ColorBand, type LeadRowData,
} from "./leadListShared";
import { STATUS_STYLES } from "@/app/admin/status-badge";

const LOST_CAP = 200;
const CLOSED_CAP = 200;
const BLOCK_PREVIEW = 6;

export const dynamic = "force-dynamic";

/* Every block on this page renders its own <table>, and with the browser's
   automatic layout each one sized its columns to its own content — so "Status"
   sat in a different place in Hot leads than in Overdue, and the eye had to
   re-find each column per block. One shared colgroup plus table-fixed makes
   the geometry identical everywhere. The percentages are the shared contract;
   min-w keeps them from crushing on a narrow window, where the wrapper's
   overflow-x-auto takes over. */
/* Secondary action button: quiet by default, fills in on hover so it is
   obvious the whole shape is the target and not just the words. */
const SECONDARY_BTN =
  "inline-flex items-center rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-[#1B4B43] transition-colors " +
  "hover:bg-[#F3F6F5] hover:border-[#1B4B43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B4B43] focus-visible:ring-offset-2";

const TABLE_COLS = (
  <colgroup>
    <col className="w-[18%]" />{/* Name */}
    <col className="w-[5%]" />{/* Hot */}
    <col className="w-[11%]" />{/* Last contact */}
    <col className="w-[10%]" />{/* Max budget */}
    <col className="w-[13%]" />{/* Status */}
    {/* 10%, not 8%: the two-word header needs the room or it wraps. */}
    <col className="w-[10%]" />{/* Country / Lang */}
    <col className="w-[10%]" />{/* Assigned */}
    <col className="w-[10%]" />{/* Received */}
    {/* Holds the move button and the delete button side by side. Since the
        move menu shrank to a 32px square this needs 13%, not the 18% the
        labelled dropdown used to demand. */}
    <col className="w-[13%]" />{/* actions */}
  </colgroup>
);

const TABLE_HEAD = (
  <thead className="bg-[#F8F9FA] text-[#6B7280]">
    <tr>
      <th className="text-left font-medium px-4 py-2.5">Name</th>
      <th className="text-center font-medium px-4 py-2.5">Hot</th>
      <th className="text-left font-medium px-4 py-2.5">Last contact</th>
      <th className="text-right font-medium px-4 py-2.5">Max budget</th>
      <th className="text-left font-medium px-4 py-2.5">Status</th>
      <th className="text-center font-medium px-4 py-2.5">Country / Lang</th>
      <th className="text-left font-medium px-4 py-2.5">Assigned</th>
      <th className="text-left font-medium px-4 py-2.5">Received</th>
      <th className="text-right font-medium px-4 py-2.5"></th>
    </tr>
  </thead>
);

// One block = a heading (with a count) + its own table. Skipped entirely
// when empty (same "don't render empty sections" rule the old Lost/Closed
// panels already followed).
function LeadBlockSection({
  title, dot, badge, leads, bandById, contactImplyingStatuses,
}: {
  title: string;
  dot?: string;
  /** Small pill next to the heading — used by the New-leads block. */
  badge?: string;
  leads: LeadRowData[];
  bandById?: Map<string, { band: ColorBand; reason: string }>;
  contactImplyingStatuses: readonly string[];
}) {
  if (!leads.length) return null;
  return (
    /* More air above a section than inside it, so the eye groups rows into
       blocks instead of reading one continuous stream. */
    <div className="mb-6 mt-8 first:mt-0">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[#111827] tracking-[-0.01em] mb-2.5">
        {dot && <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />}
        {title}
        {/* Same blue as the NEW status pill in the rows below — the two say the
            same word about the same leads, so a second colour for it would read
            as a second meaning. Taken from STATUS_STYLES rather than restated,
            so the block follows if that palette ever moves. */}
        {badge && (
          <span className={`rounded-full text-[10px] font-semibold tracking-wide px-2 py-0.5 ${STATUS_STYLES.NEW}`}>
            {badge}
          </span>
        )}
        <span className="rounded-full bg-[#F3F4F6] px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-[#6B7280]">{leads.length}</span>
      </h2>
      {/* overflow-x-auto, not overflow-hidden: the actions column now carries a
          move menu as well as the delete button, and this table sizes its columns
          automatically. Clipping would put a control out of reach on a narrow
          window; scrolling only makes it a scroll away. */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-x-auto">
        <table className="w-full min-w-[1040px] table-fixed text-sm">
          {TABLE_COLS}
          {TABLE_HEAD}
          <tbody className="divide-y divide-[#E5E7EB]">
            <LeadBlockRows previewCount={BLOCK_PREVIEW}>
              {leads.map((l) => (
                <LeadRow key={l.id} lead={l} band={bandById?.get(l.id) ?? null} contactImplyingStatuses={contactImplyingStatuses} />
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
    // Counted, not listed: the New-leads block only needs to know whether a
    // person has touched this lead at all, and the interaction list above is
    // capped at one row and filtered to contact types, so it cannot answer it.
    _count: {
      select: {
        interactions: { where: { type: { in: [...HUMAN_TOUCH_TYPES] } } },
        presentations: true,
      },
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
  //
  // Urgency is computed for every non-KEEP_CONTACT active lead, hot ones
  // included (2026-08-11 fix) — being pulled out of the color block into HOT
  // doesn't mean a lead stops being overdue/due-soon/on-track; the dot still
  // needs to say which, right there in the HOT block.
  const now = Date.now();
  const fresh: LeadRowData[] = [];
  const hot: LeadRowData[] = [];
  const keepContact: LeadRowData[] = [];
  const partner: LeadRowData[] = [];
  const red: LeadRowData[] = [];
  const yellow: LeadRowData[] = [];
  const green: LeadRowData[] = [];
  const bandById = new Map<string, { band: ColorBand; reason: string }>();
  for (const l of rawActiveLeads) {
    if (l.status === "KEEP_CONTACT") {
      keepContact.push(l);
      continue;
    }
    const b = computeBand(l, l.interactions.length > 0, now);
    bandById.set(l.id, b);
    if (l.hotAt) {
      hot.push(l);
    } else if (isUntouchedNewLead(l)) {
      // HOT wins over New, on the operator's call (2026-09-06): a lead marked
      // hot is already the strongest signal on the page, and moving it into a
      // block that empties out would bury it the moment someone worked it.
      // New-leads therefore holds only leads that are not hot and not partner —
      // the ones nothing else would surface.
      fresh.push(l);
    } else if (bucketOf(l.source) === "partner") {
      // Partner leads get their own block rather than scattering across the
      // colour bands — same exclusivity rule as HOT and KEEP_CONTACT above.
      // Placed AFTER the hotAt check on purpose: hot is the stronger signal,
      // so a hot partner lead still surfaces at the top of the page. Urgency
      // is still computed and the dot still rendered (bandById above), so an
      // overdue partner lead is visibly overdue inside this block instead of
      // silently dropping out of "Overdue".
      partner.push(l);
    } else {
      (b.band === "RED" ? red : b.band === "YELLOW" ? yellow : green).push(l);
    }
  }
  const shownActive = fresh.length + hot.length + red.length + yellow.length + green.length + partner.length + keepContact.length;
  const lostDefaultOpen = hasActiveFilter && lostTotal > 0;
  const closedDefaultOpen = hasActiveFilter && closedTotal > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">CRM / Leads <span className="text-base font-normal text-[#6B7280]">({activeTotal})</span></h1>
        {/* Buttons, not underlined links: these three sit next to a primary
            button and do the same kind of thing (go somewhere / take something
            away), so they read as a set of secondary actions with a visible
            hover and focus state rather than as running text. */}
        <div className="flex items-center gap-2">
          <Link href={`/admin/crm/export${leadQueryString(searchParams, { page: "" })}`} className={SECONDARY_BTN}>Export CSV ↓</Link>
          <Link href="/admin/crm/board" className={SECONDARY_BTN}>Pipeline view →</Link>
          <Link href="/admin/crm/calendar" className={SECONDARY_BTN}>Calendar →</Link>
          <Link href="/admin/crm/new" className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-4 py-2 transition-colors hover:bg-[#142E2D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B4B43] focus-visible:ring-offset-2">+ New lead</Link>
        </div>
      </div>

      <LeadFilterBar statuses={LEAD_STATUSES} sources={LEAD_LIST_SOURCES} locales={LEAD_LOCALES} users={users} />

      {/* 2026-08-11 — legend extended with HOT and KEEP CONTACT; the dot's
          meaning was previously only ever visible via hover (title attribute
          on the dot itself), this makes the scheme legible without hovering
          every row. */}
      {/* Folded away by default. It explains a colour scheme that takes two
          days to learn and then never needs reading again, but it sat at full
          width above every list forever. <details> keeps it one click away
          with no client JS. */}
      <details className="mb-3 group">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[11px] text-[#9CA3AF] hover:text-[#6B7280]">
          <span className="transition-transform group-open:rotate-90">›</span>
          What the colours mean
        </summary>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-[#9CA3AF]">
        <span className="flex items-center gap-1.5"><FaFire size={12} className="text-[#D2410A]" />Hot</span>
        <span className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${BAND_STYLE.RED.dot}`} />Overdue</span>
        <span className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${BAND_STYLE.YELLOW.dot}`} />Due soon / not yet scheduled</span>
        <span className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${BAND_STYLE.GREEN.dot}`} />On track</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" />Partner lead</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500" />Keep contact</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#9CA3AF]" />Lost / Closed</span>
        </div>
      </details>

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
          <LeadBlockSection title="New leads" badge="NEW" leads={fresh} bandById={bandById} contactImplyingStatuses={ELEVATED_NO_CONTACT_STATUSES} />
          <LeadBlockSection title="Hot leads" leads={hot} bandById={bandById} contactImplyingStatuses={ELEVATED_NO_CONTACT_STATUSES} />
          <LeadBlockSection title="Overdue" dot={BAND_STYLE.RED.dot} leads={red} bandById={bandById} contactImplyingStatuses={ELEVATED_NO_CONTACT_STATUSES} />
          <LeadBlockSection title="Due soon" dot={BAND_STYLE.YELLOW.dot} leads={yellow} bandById={bandById} contactImplyingStatuses={ELEVATED_NO_CONTACT_STATUSES} />
          <LeadBlockSection title="On track" dot={BAND_STYLE.GREEN.dot} leads={green} bandById={bandById} contactImplyingStatuses={ELEVATED_NO_CONTACT_STATUSES} />
          <LeadBlockSection title="Partner leads" dot="bg-blue-500" leads={partner} bandById={bandById} contactImplyingStatuses={ELEVATED_NO_CONTACT_STATUSES} />
          <LeadBlockSection title="Keep contact" dot="bg-purple-500" leads={keepContact} contactImplyingStatuses={ELEVATED_NO_CONTACT_STATUSES} />
        </>
      )}

      {lostTotal > 0 && (
        <CollapsibleLeadsPanel key={`lost-${leadQueryString(searchParams)}`} label="Lost leads" count={lostTotal} defaultOpen={lostDefaultOpen}>
          <table className="w-full min-w-[1040px] table-fixed text-sm border-t border-[#E5E7EB]">
            {TABLE_COLS}
            {TABLE_HEAD}
            <tbody className="divide-y divide-[#E5E7EB]">
              {rawLostLeads.map((l) => (
                <LeadRow key={l.id} lead={l} band={null} muted contactImplyingStatuses={ELEVATED_NO_CONTACT_STATUSES} />
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
          <table className="w-full min-w-[1040px] table-fixed text-sm border-t border-[#E5E7EB]">
            {TABLE_COLS}
            {TABLE_HEAD}
            <tbody className="divide-y divide-[#E5E7EB]">
              {rawClosedLeads.map((l) => (
                <LeadRow key={l.id} lead={l} band={null} muted contactImplyingStatuses={ELEVATED_NO_CONTACT_STATUSES} />
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
