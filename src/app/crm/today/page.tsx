import Link from "next/link";
import { lastManualStatusChanges } from "@/lib/crm/statusTouch";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { CONTACT_TYPES } from "@/lib/mcp/leadRow";
import { EXCLUDE_NEWSLETTER, EXCLUDE_PARTNER_ENQUIRY } from "@/lib/crm/leadBucket";
import { ACTIVE_LEAD_STATUSES, STATUS_LABEL, isLeadStatus } from "@/lib/crm/leadStatus";
import { temperaturesFor } from "@/lib/crm/insights/temperatureQuery";
import { sortByTemperature, toPublicTemperature } from "@/lib/crm/insights/temperatureWiring";
import { TemperatureDot } from "../components/TemperatureDot";
import { CRM_TZ, buildToday, isAssignmentTo, todayGreeting, type TodayLead } from "@/lib/crm/today";
import { loadRegistrationDue } from "@/lib/crm/registration/due";
import { loadHotSelections } from "@/lib/crm/presentations/hot";
import { ago } from "@/lib/crm/timeline";
import { ExtendSelectionButton } from "../components/ExtendSelectionButton";

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
        EXCLUDE_PARTNER_ENQUIRY,
        // Viewings are shown for any status; a day of slack on the lower bound
        // keeps the Cyprus midnight edge safe, buildToday does the exact cut.
        { OR: [{ status: { in: [...ACTIVE_LEAD_STATUSES] } }, { viewingScheduledAt: { gte: new Date(now.getTime() - 86_400_000) } }] },
      ],
    },
    orderBy: [{ nextFollowUpAt: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
    take: LEAD_CAP,
    select: {
      id: true, firstName: true, lastName: true, status: true, createdAt: true, timeline: true, budgetMin: true, budgetMax: true, nextFollowUpAt: true, viewingScheduledAt: true,
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

  const [temps, moved] = await Promise.all([temperaturesFor(rows, now), lastManualStatusChanges(rows.map((r) => r.id))]);
  const leads: TodayLead[] = rows.map((r) => ({
    id: r.id, name: `${r.firstName} ${r.lastName}`.trim(), status: r.status,
    nextFollowUpAt: r.nextFollowUpAt, viewingScheduledAt: r.viewingScheduledAt,
    lastContactAt: r.interactions[0]?.occurredAt ?? null, createdAt: r.createdAt, lastStatusChangeAt: moved.get(r.id) ?? null,
    assignedAt: assignedAt.get(r.id) ?? null, projectLabel: r.projectInterest?.title ?? null,
    temperature: toPublicTemperature(temps.get(r.id)),
  }));
  const built = buildToday(leads, now);
  // Registrations due: the owner sees every lead, staff their own.
  const regDue = (await loadRegistrationDue(null, now)).filter((l) => l.due.length > 0 && (user.isOwner || l.ownerId === user.id));
  const hot = await loadHotSelections(user, now).catch((e) => { console.error("Hot selections failed:", e instanceof Error ? e.name : "error"); return []; });
  const hotCount = hot.filter((h) => h.kind === "hot").length;
  // Hot leads first only in the two lists with no time order (Newly assigned, Going quiet); Overdue, Due today and Viewings keep their time order.
  const hotFirst = (rs: TodayLead[]) => sortByTemperature(rs, (l) => l.temperature);
  const t = { ...built, fresh: hotFirst(built.fresh), stale: hotFirst(built.stale) };

  const sections: Section[] = [
    { key: "overdue", title: "Overdue follow-ups", empty: "No follow-ups overdue", rows: t.overdue, when: (l) => `due ${dateOnly.format(l.nextFollowUpAt!)}` },
    { key: "due", title: "Follow-ups due today", empty: "No follow-ups due today", rows: t.dueToday, when: (l) => dateTime.format(l.nextFollowUpAt!) },
    { key: "viewings", title: "Viewings today and tomorrow", empty: "No viewings today or tomorrow", rows: t.viewings, when: (l) => dateTime.format(l.viewingScheduledAt!) },
    { key: "fresh", title: "Newly assigned to you", empty: "Nothing newly assigned in the last 48 hours", rows: t.fresh, when: (l) => `assigned ${dateTime.format(l.assignedAt!)}` },
    { key: "stale", title: "Going quiet", empty: "No leads quiet for 7+ days", rows: t.stale, when: (l) => (l.lastContactAt ? `last contact ${dateOnly.format(l.lastContactAt)}` : `no contact since ${dateOnly.format(l.createdAt)}`) },
  ];
  const total = regDue.length + t.overdue.length + t.dueToday.length + t.viewings.length + t.fresh.length;
  const summary = [
    ...(regDue.length ? [`${regDue.length} to register`] : []),
    ...(hotCount ? [`${hotCount} hot`] : []),
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
        <section className="crm-panel crm-today-sec crm-today-due" aria-labelledby="today-regdue">
          <h2 id="today-regdue">Register with developers <span className="cnt">{regDue.length}</span></h2>
          {regDue.length === 0 ? (
            <p className="crm-today-empty">Every client is registered with the developers from their selections</p>
          ) : (
            <ul>
              {regDue.map((l) => {
                const names = l.due.map((p) => p.developerName);
                const since = new Date(Math.min(...l.due.map((p) => p.since.getTime())));
                return (
                  <li key={l.leadId}>
                    <Link href={`/crm/leads/${l.leadId}?register=due`}>
                      <span className="who"><b>{l.leadName}</b><span className="proj">{names.slice(0, 4).join(", ")}{names.length > 4 ? ` +${names.length - 4} more` : ""}</span></span>
                      <span className="st">{user.isOwner && l.ownerName ? l.ownerName : `${names.length} developer${names.length === 1 ? "" : "s"}`}</span>
                      <span className="when">selection {dateOnly.format(since)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        {hot.length > 0 && (
          <section className="crm-panel crm-today-sec" aria-labelledby="today-hot">
            <h2 id="today-hot">Hot selections <span className="cnt">{hot.length}</span></h2>
            <ul>
              {hot.map((h) => {
                const days = h.expiresAt ? Math.max(1, Math.ceil((h.expiresAt.getTime() - now.getTime()) / 86_400_000)) : 1;
                return (
                  <li key={h.presentationId} className="crm-today-hotrow">
                    <Link href={`/crm/leads/${h.leadId}#presentations`}>
                      <span className="who"><b>{h.leadName}</b><span className="proj">{h.reasons.filter((r) => !r.startsWith("expires in")).join(" · ")}</span></span>
                      {user.isOwner && h.ownerName && <span className="st">{h.ownerName}</span>}
                      <span className="when" title={dateTime.format(h.signalAt)}>
                        {h.kind === "expiring" ? `expires in ${days} day${days === 1 ? "" : "s"} · ` : ""}{ago(h.signalAt, now)}
                      </span>
                    </Link>
                    {h.kind === "expiring" && <ExtendSelectionButton presentationId={h.presentationId} />}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
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
                      <span className="who"><b>{l.temperature && <TemperatureDot temperature={l.temperature} />}{l.name}</b>{l.projectLabel && <span className="proj">{l.projectLabel}</span>}</span>
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
