import { prisma } from "@/lib/prisma";
import { nicosiaDayStart } from "@/lib/openwa/sendGuards";
import { isRegistrable, type RegChannel, type RegStatus } from "./core";

// "Registrations due" (2026-10-28): every developer whose projects went to the
// client in a personal selection must be registered by our team — also when a
// partner sent the selection. A pair is due while the selection is valid, the
// lead is open, there is no registration (a FAILED one counts as none; REJECTED
// means another agent has the client, so it is not due) and nobody skipped it.
// Shown on the lead cockpit and on Today; the crm-sla cron reminds on Telegram:
// first 2 h after the selection went out (08–21 Nicosia), then daily from 09:00.

export const FIRST_REMINDER_AFTER_MS = 2 * 3_600_000;
const FIRST_FROM_HOUR = 8;
const FIRST_UNTIL_HOUR = 21;
const DAILY_HOUR = 9;
export const SKIP_REASON_MAX = 200;
const CLOSED = new Set(["CLOSED", "LOST"]);

export type DueSelection = {
  createdAt: Date; expiresAt: Date | null; status: string;
  items: { developmentId: string; publicName: string; newAddedAt: Date | null; developerAccountId: string | null }[];
};
export type DueDeveloper = { id: string; name: string; channel: RegChannel; registrable: boolean };
export type DueFollowUp = { developerAccountId: string; skippedAt: Date | null; skippedByName: string | null; skipReason: string | null; lastRemindedAt: Date | null };

export type DuePair = {
  developerAccountId: string; developerName: string; channel: RegChannel; registrable: boolean;
  developmentIds: string[]; projects: string[];
  // When the first of its projects went to the client.
  since: Date;
  lastRemindedAt: Date | null;
};
export type SkippedPair = DuePair & { skippedAt: Date; skippedByName: string | null; skipReason: string | null };

export function isSelectionLive(s: Pick<DueSelection, "status" | "expiresAt">, now: Date): boolean {
  return s.status === "active" && (s.expiresAt == null || s.expiresAt.getTime() > now.getTime());
}

// Due and skipped pairs of one lead, oldest first.
export function computeDue(
  input: {
    leadStatus: string; selections: DueSelection[];
    registrations: { developerAccountId: string; status: RegStatus }[];
    followUps: DueFollowUp[]; developers: DueDeveloper[];
  },
  now: Date,
): { due: DuePair[]; skipped: SkippedPair[] } {
  if (CLOSED.has(input.leadStatus)) return { due: [], skipped: [] };
  const registered = new Set(input.registrations.filter((r) => r.status !== "FAILED").map((r) => r.developerAccountId));
  const devById = new Map(input.developers.map((d) => [d.id, d]));
  const fuById = new Map(input.followUps.map((f) => [f.developerAccountId, f]));
  const pairs = new Map<string, { ids: string[]; names: string[]; since: number }>();
  for (const s of input.selections) {
    if (!isSelectionLive(s, now)) continue;
    for (const it of s.items) {
      const dev = it.developerAccountId;
      if (!dev || registered.has(dev) || !devById.has(dev)) continue;
      const at = (it.newAddedAt ?? s.createdAt).getTime();
      const p = pairs.get(dev) ?? { ids: [], names: [], since: at };
      if (!p.ids.includes(it.developmentId)) { p.ids.push(it.developmentId); p.names.push(it.publicName); }
      p.since = Math.min(p.since, at);
      pairs.set(dev, p);
    }
  }
  const due: DuePair[] = [];
  const skipped: SkippedPair[] = [];
  for (const [devId, p] of Array.from(pairs)) {
    const d = devById.get(devId)!;
    const fu = fuById.get(devId);
    const pair: DuePair = {
      developerAccountId: devId, developerName: d.name, channel: d.channel, registrable: d.registrable,
      developmentIds: p.ids, projects: p.names, since: new Date(p.since), lastRemindedAt: fu?.lastRemindedAt ?? null,
    };
    if (fu?.skippedAt) skipped.push({ ...pair, skippedAt: fu.skippedAt, skippedByName: fu.skippedByName, skipReason: fu.skipReason });
    else due.push(pair);
  }
  const bySince = (a: DuePair, b: DuePair) => a.since.getTime() - b.since.getTime() || a.developerName.localeCompare(b.developerName);
  return { due: due.sort(bySince), skipped: skipped.sort(bySince) };
}

const HOUR_FMT = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Nicosia", hour: "2-digit", hourCycle: "h23" });
const nicosiaHour = (d: Date) => Number(HOUR_FMT.format(d));

// Whether a due pair gets a Telegram reminder in this run.
export function reminderDue(p: Pick<DuePair, "since" | "lastRemindedAt">, now: Date): boolean {
  if (now.getTime() - p.since.getTime() < FIRST_REMINDER_AFTER_MS) return false;
  const h = nicosiaHour(now);
  if (!p.lastRemindedAt) return h >= FIRST_FROM_HOUR && h < FIRST_UNTIL_HOUR;
  return h >= DAILY_HOUR && p.lastRemindedAt.getTime() < nicosiaDayStart(now).getTime();
}

export function cleanSkipReason(raw: unknown): { ok: true; reason: string } | { ok: false; error: string } {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, error: "Add a short reason." };
  const reason = raw.replace(/\s+/g, " ").trim();
  if (reason.length > SKIP_REASON_MAX) return { ok: false, error: `The reason is too long (${SKIP_REASON_MAX} characters max).` };
  return { ok: true, reason };
}

// ---- Telegram text (admin-facing, English) ----

export type DueLeadGroup = { leadId: string; leadName: string; ownerName: string | null; pairs: DuePair[] };
export const DUE_TELEGRAM_LEADS_MAX = 10;
const DEVS_PER_LINE = 5;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function ago(d: Date, now: Date): string {
  const h = Math.max(1, Math.floor((now.getTime() - d.getTime()) / 3_600_000));
  return h < 48 ? `${h} h ago` : `${Math.floor(h / 24)} days ago`;
}

export function dueTelegram(groups: DueLeadGroup[], now: Date, siteUrl: string): string {
  const shown = groups.slice(0, DUE_TELEGRAM_LEADS_MAX);
  const lines = [`⚠️ <b>Client${groups.length === 1 ? "" : "s"} not registered with developers yet</b>`];
  for (const g of shown) {
    const names = g.pairs.map((p) => p.developerName);
    const devs = names.slice(0, DEVS_PER_LINE).map(esc).join(", ") + (names.length > DEVS_PER_LINE ? ` +${names.length - DEVS_PER_LINE} more` : "");
    const since = new Date(Math.min(...g.pairs.map((p) => p.since.getTime())));
    const owner = g.ownerName ? ` (${esc(g.ownerName)})` : "";
    lines.push(`• You still didn't register <a href="${siteUrl}/crm/leads/${g.leadId}">${esc(g.leadName)}</a>${owner} at ${devs} — selection sent ${ago(since, now)}`);
  }
  if (groups.length > shown.length) lines.push(`and ${groups.length - shown.length} more client${groups.length - shown.length === 1 ? "" : "s"}`);
  return lines.join("\n");
}

// ---- loading ----

export type DueLead = { leadId: string; leadName: string; ownerId: string | null; ownerName: string | null; due: DuePair[]; skipped: SkippedPair[] };

// Due pairs for the given leads, or for every lead with a live selection (leadIds = null).
export async function loadRegistrationDue(leadIds: string[] | null, now: Date): Promise<DueLead[]> {
  const selections = await prisma.clientPresentation.findMany({
    where: {
      status: "active", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      lead: { deletedAt: null, status: { notIn: ["CLOSED", "LOST"] } },
      ...(leadIds ? { leadId: { in: leadIds } } : {}),
    },
    select: {
      leadId: true, createdAt: true, expiresAt: true, status: true,
      items: { select: { developmentId: true, newAddedAt: true, development: { select: { publicName: true, developerAccountId: true } } } },
    },
  });
  if (selections.length === 0) return [];
  const ids = Array.from(new Set(selections.map((s) => s.leadId)));
  const devIds = Array.from(new Set(selections.flatMap((s) => s.items.map((i) => i.development.developerAccountId)).filter((x): x is string => !!x)));
  const [leads, regs, fus, devs] = await Promise.all([
    prisma.lead.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, status: true, assignedTo: { select: { id: true, name: true } } } }),
    prisma.developerRegistration.findMany({ where: { leadId: { in: ids } }, select: { leadId: true, developerAccountId: true, status: true } }),
    prisma.registrationFollowUp.findMany({ where: { leadId: { in: ids } }, select: { leadId: true, developerAccountId: true, skippedAt: true, skippedById: true, skipReason: true, lastRemindedAt: true } }),
    prisma.developerAccount.findMany({
      where: { id: { in: devIds } },
      select: { id: true, name: true, registrationChannel: true, registrationEmailTo: true, registrationWhatsApp: true, registrationWhatsAppGroupId: true },
    }),
  ]);
  const skipperIds = Array.from(new Set(fus.map((f) => f.skippedById).filter((x): x is string => !!x)));
  const skippers = skipperIds.length ? await prisma.user.findMany({ where: { id: { in: skipperIds } }, select: { id: true, name: true } }) : [];
  const skipperName = new Map(skippers.map((u) => [u.id, u.name]));
  const developers: DueDeveloper[] = devs.map((d) => ({ id: d.id, name: d.name, channel: d.registrationChannel, registrable: isRegistrable(d) }));

  const out: DueLead[] = [];
  for (const l of leads) {
    const r = computeDue({
      leadStatus: l.status,
      selections: selections.filter((s) => s.leadId === l.id).map((s) => ({
        createdAt: s.createdAt, expiresAt: s.expiresAt, status: s.status,
        items: s.items.map((i) => ({ developmentId: i.developmentId, publicName: i.development.publicName, newAddedAt: i.newAddedAt, developerAccountId: i.development.developerAccountId })),
      })),
      registrations: regs.filter((x) => x.leadId === l.id),
      followUps: fus.filter((f) => f.leadId === l.id).map((f) => ({ ...f, skippedByName: f.skippedById ? skipperName.get(f.skippedById) ?? null : null })),
      developers,
    }, now);
    if (r.due.length || r.skipped.length) {
      out.push({ leadId: l.id, leadName: `${l.firstName} ${l.lastName ?? ""}`.trim(), ownerId: l.assignedTo?.id ?? null, ownerName: l.assignedTo?.name ?? null, ...r });
    }
  }
  return out.sort((a, b) => (a.due[0]?.since.getTime() ?? Infinity) - (b.due[0]?.since.getTime() ?? Infinity));
}

// ---- cron ----

export type DueReminderDeps = {
  load(): Promise<DueLead[]>;
  // Resolves null when Telegram is not configured.
  sendTelegram(text: string): Promise<unknown>;
  markReminded(pairs: { leadId: string; developerAccountId: string }[], at: Date): Promise<void>;
  now(): Date;
  siteUrl: string;
};

export async function sendDueReminders(deps: DueReminderDeps): Promise<{ reminded: number; skipped?: string }> {
  const now = deps.now();
  const groups: DueLeadGroup[] = [];
  for (const l of await deps.load()) {
    const pairs = l.due.filter((p) => reminderDue(p, now));
    if (pairs.length) groups.push({ leadId: l.leadId, leadName: l.leadName, ownerName: l.ownerName, pairs });
  }
  if (groups.length === 0) return { reminded: 0 };
  // Only the leads named in the message are marked; the rest wait for the next run.
  const shown = groups.slice(0, DUE_TELEGRAM_LEADS_MAX);
  const res = await deps.sendTelegram(dueTelegram(groups, now, deps.siteUrl));
  if (res == null) return { reminded: 0, skipped: "Telegram not configured" };
  await deps.markReminded(shown.flatMap((g) => g.pairs.map((p) => ({ leadId: g.leadId, developerAccountId: p.developerAccountId }))), now);
  return { reminded: shown.length };
}

export async function markDueReminded(pairs: { leadId: string; developerAccountId: string }[], at: Date): Promise<void> {
  await prisma.$transaction(pairs.map((p) => prisma.registrationFollowUp.upsert({
    where: { leadId_developerAccountId: p },
    create: { ...p, lastRemindedAt: at },
    update: { lastRemindedAt: at },
  })));
}
