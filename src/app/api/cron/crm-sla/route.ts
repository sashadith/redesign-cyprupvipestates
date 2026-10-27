// CRM v2 SLA reminders — unassigned and uncontacted leads (Phase 2c). ENGLISH.
// Rules and thresholds: src/lib/crm/sla.ts (CRM_SLA_UNASSIGNED_MIN /
// CRM_SLA_UNCONTACTED_MIN / CRM_SLA_ESCALATE_MIN, defaults 30 / 120 / 240).
//   UNASSIGNED  — one office Telegram listing the leads, link to /crm/inbox
//   UNCONTACTED — one email per lead to its owner
//   ESCALATE    — one office Telegram naming owner + lead + lead link
// Also: developer registrations unconfirmed after 2 days (registration/reminders.ts),
// one email to owner(s) + assigned staff, one office Telegram per run.
// Idempotent: every sent notice writes a SYSTEM "SLA reminder: <rule>" row with
// metadata.sla, written only after the send succeeded, so a failed or
// unconfigured channel is retried on the next run and a sent one never repeats.
// Deactivated owners get no email (ESCALATE still names them, "(inactive)").
// Not-a-failure conditions (Telegram unconfigured, owner inactive / no email)
// are returned under `skipped` and do not mark the cron run as failed.
//
// Set CRM_SLA_START to the deploy time first (ISO, e.g. 2026-10-18T12:00:00Z):
// only leads created after it are considered, and without it the job does nothing.
// Leads created more than 7 days ago get no SLA reminders, even if assigned later.
// Crontab:
//   */10 * * * * curl -s "http://127.0.0.1:3000/api/cron/crm-sla?key=$CRON_SECRET" >/dev/null
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCronLog } from "@/lib/cronLog";
import { sendTelegramMessage } from "@/lib/telegram";
import { sendEmail } from "@/lib/sendEmail";
import { EXCLUDE_NEWSLETTER, EXCLUDE_PARTNER_ENQUIRY } from "@/lib/crm/leadBucket";
import { ACTIVE_LEAD_STATUSES } from "@/lib/crm/leadStatus";
import {
  SLA_OUTBOUND_TYPES, dueSlaNotices, latestAssignedAt, sendSlaNotices, slaNoticesFromRows,
  slaStartFromEnv, slaThresholdsFromEnv, type SlaLead, type SlaRule, type SlaSendResult,
} from "@/lib/crm/sla";
import { loadUnconfirmedRegistrations, sendRegistrationReminders } from "@/lib/crm/registration/reminders";

export const dynamic = "force-dynamic";

const LOOKBACK_MS = 7 * 86_400_000;
const LEAD_CAP = 500;

type SlaResult =
  | { skipped: string }
  | ({ ok: true } & SlaSendResult);
type RegistrationResult = { reminded: number; errors: string[] };
type CronResult = { sla: SlaResult; registrations: RegistrationResult };

async function markSent(leads: SlaLead[], rule: SlaRule) {
  await prisma.leadInteraction.createMany({
    data: leads.map((l) => ({ leadId: l.id, type: "SYSTEM" as const, channel: "SYSTEM" as const, body: `SLA reminder: ${rule}`, metadata: { sla: rule } })),
  });
}

async function runSlaNotices(): Promise<SlaResult> {
  const start = slaStartFromEnv(process.env);
  if (!start) return { skipped: "CRM_SLA_START not set" };
  const now = new Date();
  const since = new Date(Math.max(start.getTime(), now.getTime() - LOOKBACK_MS));
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://72.60.89.239";

  const rows = await prisma.lead.findMany({
    where: { AND: [EXCLUDE_NEWSLETTER, EXCLUDE_PARTNER_ENQUIRY, { deletedAt: null, status: { in: [...ACTIVE_LEAD_STATUSES] }, createdAt: { gte: since } }] },
    orderBy: { createdAt: "desc" }, // the cap drops the oldest, never the newest
    take: LEAD_CAP,
    select: {
      id: true, firstName: true, lastName: true, status: true, createdAt: true, assignedToId: true,
      assignedTo: { select: { id: true, name: true, email: true, isActive: true } },
      interactions: { where: { type: { in: [...SLA_OUTBOUND_TYPES] } }, orderBy: { occurredAt: "desc" }, take: 1, select: { occurredAt: true } },
    },
  });
  if (rows.length === 0) return { ok: true, sent: { UNASSIGNED: 0, UNCONTACTED: 0, ESCALATE: 0 }, skipped: [], errors: [] };

  // Assignment rows and earlier SLA notices; metadata.sla is checked in JS.
  const systemRows = await prisma.leadInteraction.findMany({
    where: {
      leadId: { in: rows.map((r) => r.id) }, type: "SYSTEM",
      OR: [{ body: { startsWith: "Assigned to" } }, { body: { startsWith: "SLA reminder:" } }],
    },
    select: { leadId: true, body: true, metadata: true, occurredAt: true },
  });
  const byLead = new Map<string, typeof systemRows>();
  for (const r of systemRows) byLead.set(r.leadId, [...(byLead.get(r.leadId) ?? []), r]);

  const leads: SlaLead[] = rows.map((r) => {
    const sys = byLead.get(r.id) ?? [];
    const owner = r.assignedToId && r.assignedTo ? r.assignedTo : null;
    return {
      id: r.id, name: `${r.firstName} ${r.lastName}`.trim(), status: r.status, createdAt: r.createdAt,
      assignedToId: r.assignedToId, ownerName: owner?.name ?? null, ownerEmail: owner?.email ?? null, ownerActive: owner?.isActive ?? true,
      assignedAt: owner ? latestAssignedAt(sys, owner) : null,
      lastOutboundContactAt: r.interactions[0]?.occurredAt ?? null,
      notified: slaNoticesFromRows(sys),
    };
  });

  const due = dueSlaNotices(leads, now, start, slaThresholdsFromEnv(process.env));
  const result = await sendSlaNotices(due, now, base, {
    sendTelegram: (text) => sendTelegramMessage(text),
    sendEmail: (mail) => sendEmail(mail),
    markSent,
  });
  if (result.errors.length) console.error("[crm-sla]", result.errors);
  return { ok: true, ...result };
}

// Developer registrations without a preliminary confirmation after 2 days
// (spec 2026-10-27 §7.7). Independent of CRM_SLA_START.
async function runRegistrationReminders(): Promise<RegistrationResult> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://72.60.89.239";
  const r = await sendRegistrationReminders({
    load: () => loadUnconfirmedRegistrations(new Date()),
    owners: () => prisma.user.findMany({ where: { isOwner: true }, select: { id: true, email: true, isActive: true } }),
    sendEmail: (m) => sendEmail(m),
    sendTelegram: async (t) => { await sendTelegramMessage(t); },
    markReminded: async (id, at) => { await prisma.developerRegistration.update({ where: { id }, data: { reminderSentAt: at } }); },
    now: () => new Date(),
    siteUrl: base,
  });
  if (r.errors.length) console.error("[crm-sla] registration reminders", r.errors);
  return r;
}

async function runAll(): Promise<CronResult> {
  // Guarded: a reminder failure must never stop the SLA notices below.
  const registrations = await runRegistrationReminders().catch((e): RegistrationResult => {
    console.error("[crm-sla] registration reminders failed", e);
    return { reminded: 0, errors: [e instanceof Error ? e.message : String(e)] };
  });
  const sla = await runSlaNotices();
  return { sla, registrations };
}

const summarizeSla = (r: SlaResult) =>
  !("ok" in r) ? `skipped: ${r.skipped}`
    : `sent U${r.sent.UNASSIGNED}/C${r.sent.UNCONTACTED}/E${r.sent.ESCALATE}${r.skipped.length ? `, ${r.skipped.length} skipped` : ""}${r.errors.length ? `, ${r.errors.length} error(s)` : ""}`;
const summarize = (r: CronResult) =>
  `${summarizeSla(r.sla)}; registrations reminded ${r.registrations.reminded}${r.registrations.errors.length ? `, ${r.registrations.errors.length} error(s)` : ""}`;
const okFrom = (r: CronResult) => (!("ok" in r.sla) || r.sla.errors.length === 0) && r.registrations.errors.length === 0;

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await withCronLog("crm-sla", runAll, summarize, okFrom);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
