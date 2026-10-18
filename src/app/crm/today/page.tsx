import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { CONTACT_TYPES } from "@/lib/mcp/leadRow";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { ACTIVE_LEAD_STATUSES, STATUS_LABEL, isLeadStatus } from "@/lib/crm/leadStatus";
import { CRM_TZ, buildToday, isAssignmentTo, todayGreeting, type TodayLead } from "@/lib/crm/today";

export const dynamic = "force-dynamic";

const LEAD_CAP = 1000;

const dateTime = new Intl.DateTimeFormat("en-GB", { timeZone: CRM_TZ, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dateOnly = new Intl.DateTimeFormat("en-GB", { timeZone: CRM_TZ, day: "2-digit", month: "short" });

type Section = { key: string; title: string; empty: string; rows: TodayLead[]; when: (l: TodayLead) => string };

export default async function TodayPage() {
  const user = await requireCrmUser();
  const now = new Date();

  const rows = await prisma.lead.findMany({
    where: {
      AND: [
        { assignedToId: user.id, deletedAt: null },
        EXCLUDE_NEWSLETTER,
        // Viewings are shown for any status; a day of slack on the lower bound
        // keeps the Cyprus midnight edge safe, buildToday does the exact cut.
        { OR: [{ status: { in: [...ACTIVE_LEAD_STATUSES] } }, { viewingScheduledAt: { gte: new Date(now.getTime() - 86_400_000) } }] },
      ],
    },
    orderBy: [{ nextFollowUpAt: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
    take: LEAD_CAP,
    select: {
      id: true, firstName: true, lastName: true, status: true, createdAt: true, nextFollowUpAt: true, viewingScheduledAt: true,
      projectInterest: { select: { title: true } },
      interactions: { where: { type: { in: CONTACT_TYPES } }, orderBy: { occurredAt: "desc" }, take: 1, select: { occurredAt: true } },
    },
  });

  // The latest "Assigned to <name>" row aimed at this user: when the lead landed with them.
  const assignRows = rows.length === 0 ? [] : await prisma.leadInteraction.findMany({
    where: { leadId: { in: rows.map((r) => r.id) }, type: "SYSTEM", body: { startsWith: "Assigned to" }, occurredAt: { gte: new Date(now.getTime() - 48 * 3_600_000) } },
    orderBy: { occurredAt: "desc" },
    select: { leadId: true, occurredAt: true, body: true, metadata: true },
  });
  const assignedAt = new Map<string, Date>();
  for (const a of assignRows) {
    if (!assignedAt.has(a.leadId) && isAssignmentTo(a, user)) assignedAt.set(a.leadId, a.occurredAt);
  }

  const leads: TodayLead[] = rows.map((r) => ({
    id: r.id, name: `${r.firstName} ${r.lastName}`.trim(), status: r.status,
    nextFollowUpAt: r.nextFollowUpAt, viewingScheduledAt: r.viewingScheduledAt,
    lastContactAt: r.interactions[0]?.occurredAt ?? null, createdAt: r.createdAt,
    assignedAt: assignedAt.get(r.id) ?? null, projectLabel: r.projectInterest?.title ?? null,
  }));
  const t = buildToday(leads, now);

  const sections: Section[] = [
    { key: "overdue", title: "Overdue follow-ups", empty: "No follow-ups overdue", rows: t.overdue, when: (l) => `due ${dateOnly.format(l.nextFollowUpAt!)}` },
    { key: "due", title: "Follow-ups due today", empty: "No follow-ups due today", rows: t.dueToday, when: (l) => dateTime.format(l.nextFollowUpAt!) },
    { key: "viewings", title: "Viewings today and tomorrow", empty: "No viewings today or tomorrow", rows: t.viewings, when: (l) => dateTime.format(l.viewingScheduledAt!) },
    { key: "fresh", title: "Newly assigned to you", empty: "Nothing newly assigned in the last 48 hours", rows: t.fresh, when: (l) => `assigned ${dateTime.format(l.assignedAt!)}` },
    { key: "stale", title: "Going quiet", empty: "No leads quiet for 7+ days", rows: t.stale, when: (l) => (l.lastContactAt ? `last contact ${dateOnly.format(l.lastContactAt)}` : `no contact since ${dateOnly.format(l.createdAt)}`) },
  ];
  const total = t.overdue.length + t.dueToday.length + t.viewings.length + t.fresh.length;
  const summary = [
    `${t.overdue.length} overdue`, `${t.dueToday.length} due today`, `${t.viewings.length} viewing${t.viewings.length === 1 ? "" : "s"}`, `${t.fresh.length} new`, `${t.stale.length} quiet`,
  ].join(" · ");

  return (
    <>
      <div className="crm-headrow">
        <div>
          <h1>{todayGreeting(now, user.name)}</h1>
          <p>{total === 0 && t.stale.length === 0 ? "Nothing needs you right now." : summary}</p>
        </div>
      </div>
      {leads.length >= LEAD_CAP && <p className="crm-notice" role="status">This list may be incomplete — showing {LEAD_CAP} leads.</p>}
      <div className="crm-today">
        {sections.map((s) => (
          <section key={s.key} className="crm-panel crm-today-sec" aria-labelledby={`today-${s.key}`}>
            <h2 id={`today-${s.key}`}>{s.title} <span className="cnt">{s.rows.length}</span></h2>
            {s.rows.length === 0 ? (
              <p className="crm-today-empty">{s.empty}</p>
            ) : (
              <ul>
                {s.rows.map((l) => (
                  <li key={l.id}>
                    <Link href={`/crm/leads/${l.id}`}>
                      <span className="who"><b>{l.name}</b>{l.projectLabel && <span className="proj">{l.projectLabel}</span>}</span>
                      <span className="st">{isLeadStatus(l.status) ? STATUS_LABEL[l.status] : l.status}</span>
                      <span className="when">{s.when(l)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
