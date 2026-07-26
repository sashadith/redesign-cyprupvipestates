// Booking calendar (Batch D, 2026-07-26) — the next step after Phase 3's
// booking model: instead of only reading bookings one lead at a time on the
// Cockpit page, this shows every CONFIRMED meeting (a real, blocked slot)
// and every still-open PROPOSED request (informational only — it blocks
// nothing) across all leads, in Cyprus time. No new schema: BookingRequest
// already carries everything needed (status, confirmedSlotUtc, meetingType,
// proposedSlots, zoomLinkSentAt).
import Link from "next/link";
import { Fragment } from "react";
import { prisma } from "@/lib/prisma";
import { formatInZone, cyprusWallTimeToUtc, CYPRUS_TZ } from "@/lib/booking/timezone";
import type { MeetingType } from "@prisma/client";

export const dynamic = "force-dynamic";

const MEETING_LABEL: Record<MeetingType, string> = { ZOOM: "Zoom", PHONE: "Phone" };

type ConfirmedEntry = {
  kind: "confirmed";
  bookingId: string;
  leadId: string;
  leadName: string;
  slotUtc: Date;
  meetingType: MeetingType;
  needsZoomLink: boolean;
};
type ProposedEntry = {
  kind: "proposed";
  bookingId: string;
  leadId: string;
  leadName: string;
  slotUtc: Date; // one specific candidate instant — a PROPOSED booking contributes one ProposedEntry per candidate slot
  meetingType: MeetingType;
  candidateIndex: number;
  candidateCount: number;
};
type Entry = ConfirmedEntry | ProposedEntry;

async function loadEntries(): Promise<{ confirmed: ConfirmedEntry[]; proposed: ProposedEntry[] }> {
  const bookings = await prisma.bookingRequest.findMany({
    where: { status: { in: ["CONFIRMED", "PROPOSED"] } },
    include: { lead: { select: { firstName: true, lastName: true } } },
  });

  const confirmed: ConfirmedEntry[] = bookings
    .filter((b) => b.status === "CONFIRMED" && b.confirmedSlotUtc)
    .map((b) => ({
      kind: "confirmed",
      bookingId: b.id,
      leadId: b.leadId,
      leadName: `${b.lead.firstName} ${b.lead.lastName}`.trim(),
      slotUtc: b.confirmedSlotUtc!,
      meetingType: b.meetingType,
      needsZoomLink: b.meetingType === "ZOOM" && !b.zoomLinkSentAt,
    }));

  const proposed: ProposedEntry[] = bookings
    .filter((b) => b.status === "PROPOSED" && Array.isArray(b.proposedSlots) && b.proposedSlots.length)
    .flatMap((b) => {
      const slots = b.proposedSlots as { utc: string }[];
      return slots.map((s, i) => ({
        kind: "proposed" as const,
        bookingId: b.id,
        leadId: b.leadId,
        leadName: `${b.lead.firstName} ${b.lead.lastName}`.trim(),
        slotUtc: new Date(s.utc),
        meetingType: b.meetingType,
        candidateIndex: i,
        candidateCount: slots.length,
      }));
    });

  return { confirmed, proposed };
}

function cyprusDateParts(d: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: CYPRUS_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  return {
    y: Number(parts.find((p) => p.type === "year")!.value),
    m: Number(parts.find((p) => p.type === "month")!.value),
    d: Number(parts.find((p) => p.type === "day")!.value),
  };
}
function cyprusHour(d: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: CYPRUS_TZ, hour: "2-digit", hour12: false }).format(d));
}
function dateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Pure calendar-day arithmetic on a Y-M-D triple (noon-UTC anchor sidesteps
// DST/date-line entirely) — not a timezone conversion, just "which date is
// the Monday of this date's week." The actual Cyprus<->UTC conversion for
// display/comparison still goes exclusively through cyprusWallTimeToUtc/
// formatInZone below.
function mondayOf(y: number, m: number, d: number): { y: number; m: number; d: number } {
  const anchor = new Date(Date.UTC(y, m - 1, d, 12));
  const dow = anchor.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(Date.UTC(y, m - 1, d + diffToMonday, 12));
  return { y: monday.getUTCFullYear(), m: monday.getUTCMonth() + 1, d: monday.getUTCDate() };
}
function addDays(y: number, m: number, d: number, n: number): { y: number; m: number; d: number } {
  const dt = new Date(Date.UTC(y, m - 1, d + n, 12));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

const WEEKDAY_LABEL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DEFAULT_HOUR_RANGE = [8, 19]; // 08:00-19:00 — covers the booking page's 9/11/13/15/17 slot grid with margin

function EntryCard({ entry }: { entry: Entry }) {
  const time = formatInZone(entry.slotUtc, CYPRUS_TZ);
  if (entry.kind === "confirmed") {
    return (
      <Link
        href={`/admin/crm/${entry.leadId}`}
        className="block rounded-md bg-[#1B4B43] text-white text-[11px] px-2 py-1.5 hover:bg-[#142E2D] leading-tight"
        title={`${entry.leadName} · ${time} Cyprus time · ${MEETING_LABEL[entry.meetingType]}`}
      >
        <div className="font-medium truncate">{entry.leadName}</div>
        <div className="opacity-80">{time} · {MEETING_LABEL[entry.meetingType]}</div>
        {entry.needsZoomLink && <div className="mt-0.5 text-[#FDBA74]">⚠ Zoom link not sent</div>}
      </Link>
    );
  }
  return (
    <Link
      href={`/admin/crm/${entry.leadId}`}
      className="block rounded-md border border-dashed border-[#D1D5DB] bg-[#F8F9FA] text-[#6B7280] text-[11px] px-2 py-1.5 hover:bg-[#F3F4F6] leading-tight"
      title={`${entry.leadName} proposed this time (${entry.candidateIndex + 1}/${entry.candidateCount}) — awaiting confirmation`}
    >
      <div className="font-medium truncate">{entry.leadName}</div>
      <div>{time} · proposed</div>
    </Link>
  );
}

function WeekView({ confirmed, proposed, weekStart }: { confirmed: ConfirmedEntry[]; proposed: ProposedEntry[]; weekStart: { y: number; m: number; d: number } }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart.y, weekStart.m, weekStart.d, i));
  const allEntries: Entry[] = [...confirmed, ...proposed];

  const hoursInRange = allEntries
    .map((e) => cyprusHour(e.slotUtc))
    .filter((h) => h < DEFAULT_HOUR_RANGE[0] || h > DEFAULT_HOUR_RANGE[1]);
  const hourStart = Math.min(DEFAULT_HOUR_RANGE[0], ...hoursInRange);
  const hourEnd = Math.max(DEFAULT_HOUR_RANGE[1], ...hoursInRange);
  const hours = Array.from({ length: hourEnd - hourStart + 1 }, (_, i) => hourStart + i);

  const byDayHour = new Map<string, Entry[]>();
  for (const e of allEntries) {
    const { y, m, d } = cyprusDateParts(e.slotUtc);
    const key = `${dateKey(y, m, d)}|${cyprusHour(e.slotUtc)}`;
    if (!byDayHour.has(key)) byDayHour.set(key, []);
    byDayHour.get(key)!.push(e);
  }

  const prevWeek = addDays(weekStart.y, weekStart.m, weekStart.d, -7);
  const nextWeek = addDays(weekStart.y, weekStart.m, weekStart.d, 7);
  const todayParts = cyprusDateParts(new Date());
  const todayKey = dateKey(todayParts.y, todayParts.m, todayParts.d);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-2">
          <Link href={`/admin/crm/calendar?view=week&weekStart=${dateKey(prevWeek.y, prevWeek.m, prevWeek.d)}`} className="rounded-md border border-[#E5E7EB] px-2 py-1 text-xs hover:bg-[#F8F9FA]">← Prev week</Link>
          <Link href="/admin/crm/calendar?view=week" className="rounded-md border border-[#E5E7EB] px-2 py-1 text-xs hover:bg-[#F8F9FA]">This week</Link>
          <Link href={`/admin/crm/calendar?view=week&weekStart=${dateKey(nextWeek.y, nextWeek.m, nextWeek.d)}`} className="rounded-md border border-[#E5E7EB] px-2 py-1 text-xs hover:bg-[#F8F9FA]">Next week →</Link>
        </div>
        <span className="text-xs text-[#6B7280]">All times Cyprus (Asia/Nicosia)</span>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[900px]" style={{ gridTemplateColumns: `64px repeat(7, 1fr)` }}>
          <div className="bg-[#F8F9FA] border-b border-[#E5E7EB]" />
          {days.map((day, i) => {
            const key = dateKey(day.y, day.m, day.d);
            const isToday = key === todayKey;
            return (
              <div key={key} className={`text-center text-xs font-medium px-2 py-2 border-b border-l border-[#E5E7EB] ${isToday ? "bg-[#EFF6F4] text-[#1B4B43]" : "bg-[#F8F9FA] text-[#374151]"}`}>
                {WEEKDAY_LABEL[i]}
                <div className="text-[10px] text-[#9CA3AF]">{String(day.d).padStart(2, "0")}.{String(day.m).padStart(2, "0")}</div>
              </div>
            );
          })}
          {hours.map((hour) => (
            <Fragment key={`h-${hour}`}>
              <div className="text-[11px] text-[#9CA3AF] text-right pr-2 py-2 border-b border-[#E5E7EB]">{String(hour).padStart(2, "0")}:00</div>
              {days.map((day) => {
                const key = `${dateKey(day.y, day.m, day.d)}|${hour}`;
                const cellEntries = byDayHour.get(key) ?? [];
                return (
                  <div key={key} className="border-b border-l border-[#E5E7EB] p-1 min-h-[44px] space-y-1">
                    {cellEntries.map((e, i) => <EntryCard key={`${e.bookingId}-${i}`} entry={e} />)}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

type ProposedGroup = { bookingId: string; leadId: string; leadName: string; meetingType: MeetingType; candidates: Date[] };

function ListView({ confirmed, proposed }: { confirmed: ConfirmedEntry[]; proposed: ProposedEntry[] }) {
  const now = Date.now();
  const upcomingConfirmed = confirmed.filter((e) => e.slotUtc.getTime() >= now).sort((a, b) => a.slotUtc.getTime() - b.slotUtc.getTime());

  const groups = new Map<string, ProposedGroup>();
  for (const e of proposed) {
    if (!groups.has(e.bookingId)) groups.set(e.bookingId, { bookingId: e.bookingId, leadId: e.leadId, leadName: e.leadName, meetingType: e.meetingType, candidates: [] });
    groups.get(e.bookingId)!.candidates.push(e.slotUtc);
  }
  const upcomingProposed = Array.from(groups.values())
    .map((g) => ({ ...g, candidates: g.candidates.sort((a, b) => a.getTime() - b.getTime()) }))
    .filter((g) => g.candidates.some((c) => c.getTime() >= now))
    .sort((a, b) => a.candidates[0].getTime() - b.candidates[0].getTime());

  if (!upcomingConfirmed.length && !upcomingProposed.length) {
    return <p className="text-sm text-[#6B7280]">No upcoming or proposed meetings.</p>;
  }

  return (
    <div className="space-y-6">
      {upcomingConfirmed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[#111827] mb-2">Confirmed ({upcomingConfirmed.length})</h2>
          <ul className="space-y-2">
            {upcomingConfirmed.map((e) => (
              <li key={e.bookingId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#E5E7EB] bg-white px-3 py-2">
                <div className="text-sm">
                  <Link href={`/admin/crm/${e.leadId}`} className="font-medium text-[#1B4B43] hover:underline">{e.leadName}</Link>
                  <span className="text-[#6B7280]"> · {formatInZone(e.slotUtc, CYPRUS_TZ)} Cyprus time · {MEETING_LABEL[e.meetingType]}</span>
                </div>
                {e.needsZoomLink && <span className="text-xs text-[#9A3412] bg-[#FFF7ED] border border-[#FED7AA] rounded-full px-2 py-0.5">⚠ Zoom link not sent</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {upcomingProposed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[#111827] mb-2">Proposed — awaiting confirmation ({upcomingProposed.length})</h2>
          <ul className="space-y-2">
            {upcomingProposed.map((g) => (
              <li key={g.bookingId} className="rounded-md border border-dashed border-[#D1D5DB] bg-[#F8F9FA] px-3 py-2">
                <div className="text-sm">
                  <Link href={`/admin/crm/${g.leadId}`} className="font-medium text-[#374151] hover:underline">{g.leadName}</Link>
                  <span className="text-[#6B7280]"> · {MEETING_LABEL[g.meetingType]} · proposed:</span>
                </div>
                <div className="text-xs text-[#6B7280] mt-1">
                  {g.candidates.map((c) => formatInZone(c, CYPRUS_TZ)).join("  ·  ")}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default async function CalendarPage({ searchParams }: { searchParams: { view?: string; weekStart?: string } }) {
  const view = searchParams.view === "list" ? "list" : "week";
  const { confirmed, proposed } = await loadEntries();

  const nowParts = cyprusDateParts(new Date());
  const weekStart = searchParams.weekStart && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.weekStart)
    ? mondayOf(...(searchParams.weekStart.split("-").map(Number) as [number, number, number]))
    : mondayOf(nowParts.y, nowParts.m, nowParts.d);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <div className="flex items-center gap-4">
          <div className="flex rounded-md border border-[#E5E7EB] overflow-hidden text-xs">
            <Link href="/admin/crm/calendar?view=week" className={`px-3 py-1.5 ${view === "week" ? "bg-[#1B4B43] text-white" : "bg-white text-[#374151] hover:bg-[#F8F9FA]"}`}>Week</Link>
            <Link href="/admin/crm/calendar?view=list" className={`px-3 py-1.5 border-l border-[#E5E7EB] ${view === "list" ? "bg-[#1B4B43] text-white" : "bg-white text-[#374151] hover:bg-[#F8F9FA]"}`}>List</Link>
          </div>
          <Link href="/admin/crm/board" className="text-sm text-[#1B4B43] hover:underline">Pipeline →</Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-4 text-xs text-[#6B7280]">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#1B4B43] inline-block" /> Confirmed</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-dashed border-[#9CA3AF] inline-block" /> Proposed (not yet confirmed)</span>
      </div>

      {view === "week"
        ? <WeekView confirmed={confirmed} proposed={proposed} weekStart={weekStart} />
        : <ListView confirmed={confirmed} proposed={proposed} />}
    </div>
  );
}
