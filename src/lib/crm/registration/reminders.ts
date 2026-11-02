import { prisma } from "@/lib/prisma";
import { REMINDER_AFTER_MS, devLabel, type RegStatus } from "./core";

// Reminder for a registration the developer has not confirmed (spec 2026-10-27
// §7.7, §12.5): 2 days after sending, still SENT → one email to the owner(s)
// and the lead's assigned staff member, plus one office Telegram per run.
// reminderSentAt makes it once-only; the Action Center item stays as long as
// the registration is unconfirmed (registrationUnconfirmed in actionCenter/rules/crm.ts).

type Person = { id: string; email: string; isActive: boolean };
export type ReminderRow = {
  id: string; status: RegStatus; sentAt: Date | null; reminderSentAt: Date | null; developerName: string;
  lead: { id: string; name: string; status: string; deletedAt: Date | null; assignedTo: Person | null };
};

const CLOSED = new Set(["CLOSED", "LOST"]);

export function isUnconfirmed(r: Omit<ReminderRow, "reminderSentAt">, now: Date): boolean {
  return r.status === "SENT" && r.sentAt != null && now.getTime() - r.sentAt.getTime() >= REMINDER_AFTER_MS
    && r.lead.deletedAt == null && !CLOSED.has(r.lead.status);
}

export function dueReminders(rows: ReminderRow[], now: Date): ReminderRow[] {
  return rows.filter((r) => r.reminderSentAt == null && isUnconfirmed(r, now));
}

export function reminderRecipients(owners: Person[], assignee: Person | null): string[] {
  const out: string[] = [];
  const add = (e: string) => { const k = e.trim().toLowerCase(); if (k && !out.includes(k)) out.push(k); };
  const ownerIds = new Set(owners.map((o) => o.id));
  for (const o of owners) if (o.isActive) add(o.email);
  if (assignee && assignee.isActive && !ownerIds.has(assignee.id)) add(assignee.email);
  return out;
}

const DATE = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Nicosia", day: "2-digit", month: "2-digit", year: "numeric" });
export const reminderDate = (d: Date) => DATE.format(d);

export function reminderMail(r: ReminderRow, siteUrl: string): { subject: string; text: string } {
  const sent = r.sentAt ? reminderDate(r.sentAt) : "?";
  return {
    subject: `Registration not confirmed: ${r.lead.name} – ${r.developerName}`,
    text: [
      `The registration of ${r.lead.name} with ${r.developerName} was sent on ${sent} and has no preliminary confirmation yet.`,
      "",
      "Follow up with the developer, then mark it preliminary in the lead's Developer registrations block.",
      "",
      `${siteUrl}/crm/leads/${r.lead.id}`,
    ].join("\n"),
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function reminderTelegram(rows: ReminderRow[], siteUrl: string): string {
  const lines = rows.map((r) => `👤 <b><a href="${siteUrl}/crm/leads/${r.lead.id}">${esc(r.lead.name)}</a></b> · ${esc(devLabel(r.developerName))} · <i>sent ${r.sentAt ? reminderDate(r.sentAt) : "?"}</i>`);
  return [`⏳ <b>Registration not confirmed after 2 days</b>`, `<i>Follow up with the developer, then mark it preliminary</i>`, "", ...lines].join("\n");
}

export type ReminderDeps = {
  load(): Promise<ReminderRow[]>;
  owners(): Promise<Person[]>;
  sendEmail(m: { to: string; subject: string; text: string }): Promise<void>;
  sendTelegram(t: string): Promise<void>;
  markReminded(id: string, at: Date): Promise<void>;
  now(): Date;
  siteUrl: string;
};

export async function sendRegistrationReminders(deps: ReminderDeps): Promise<{ reminded: number; errors: string[] }> {
  const now = deps.now();
  const due = dueReminders(await deps.load(), now);
  if (due.length === 0) return { reminded: 0, errors: [] };
  const owners = await deps.owners();
  const errors: string[] = [];
  const reminded: ReminderRow[] = [];
  for (const r of due) {
    const to = reminderRecipients(owners, r.lead.assignedTo);
    const mail = reminderMail(r, deps.siteUrl);
    let delivered = 0;
    for (const addr of to) {
      try { await deps.sendEmail({ to: addr, ...mail }); delivered++; }
      catch (e) { errors.push(`${r.id} → ${addr}: ${e instanceof Error ? e.message : String(e)}`); }
    }
    // Nobody reached → retry next run. No recipients at all → nothing to retry.
    if (to.length > 0 && delivered === 0) continue;
    await deps.markReminded(r.id, now);
    reminded.push(r);
  }
  if (reminded.length) {
    try { await deps.sendTelegram(reminderTelegram(reminded, deps.siteUrl)); }
    catch (e) { console.error("registration reminders: Telegram failed", e); }
  }
  return { reminded: reminded.length, errors };
}

// Rows the reminder and the Action Center both look at: SENT and older than 2 days.
export async function loadUnconfirmedRegistrations(now: Date): Promise<ReminderRow[]> {
  const rows = await prisma.developerRegistration.findMany({
    where: { status: "SENT", sentAt: { lte: new Date(now.getTime() - REMINDER_AFTER_MS) }, lead: { deletedAt: null, status: { notIn: ["CLOSED", "LOST"] } } },
    orderBy: { sentAt: "asc" },
    take: 200,
    select: {
      id: true, status: true, sentAt: true, reminderSentAt: true, developerAccount: { select: { name: true } },
      lead: { select: { id: true, firstName: true, lastName: true, status: true, deletedAt: true, assignedTo: { select: { id: true, email: true, isActive: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id, status: r.status, sentAt: r.sentAt, reminderSentAt: r.reminderSentAt, developerName: r.developerAccount.name,
    lead: { id: r.lead.id, name: `${r.lead.firstName} ${r.lead.lastName ?? ""}`.trim(), status: r.lead.status, deletedAt: r.lead.deletedAt, assignedTo: r.lead.assignedTo },
  }));
}
