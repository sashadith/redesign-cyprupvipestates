// Telegram reminders for "planned" Typefully drafts (2026-10-09 brief, part 3).
//
// A planned draft never publishes until Sascha confirms it in Typefully; if he
// forgets, nothing goes out and nothing complains. So for every planned draft
// with a future date, each of these fires exactly once:
//   evening — 20:00 Cyprus on the day before the scheduled day, only if the
//             draft already existed at that 20:00
//   t90     — 90 minutes before
//   t30     — 30 minutes before
//   missed  — 15 minutes after, if it is still planned
// A draft that becomes scheduled/published simply leaves the planned list, so
// it gets nothing further. Drafts due at the same reminder kind in one run go
// into ONE message. Quiet hours 22:00–06:30 Cyprus: a reminder whose moment
// falls inside is skipped, never queued.
//
// Window, not instant: the job runs every 5 minutes, so a reminder fires when
// trigger ≤ now < trigger + GRACE_MS (two runs). The grace is short on purpose:
// a draft created 60 minutes before its slot must not get "90 minutes left",
// and a cron outage must not produce a burst of stale reminders afterwards.
//
// Exactly-once is held in the database (social_reminders_sent, unique on
// draft_id + reminder_kind): rows are CLAIMED before sending, so two
// overlapping runs cannot both send, and released again if Telegram fails, so
// the next run (still inside the grace) retries.
//
// Read-only towards Typefully: the only call is the client's list GET.
import { CYPRUS_TZ, cyprusWallTimeToUtc } from "@/lib/booking/timezone";
import type { DraftListResult, TypefullyDraft } from "./typefully";
import { buildMessage } from "./socialFormat";

const MIN = 60_000;
export const GRACE_MS = 10 * MIN;

export type ReminderKind = "evening" | "t90" | "t30" | "missed";
export const REMINDER_KINDS: ReminderKind[] = ["evening", "t90", "t30", "missed"];
/** Marker kind for "the Typefully-unreachable alert for the current outage was sent". */
export const API_DOWN_KIND = "api-unreachable";
export const API_DOWN_DRAFT_ID = 0;

function cyprusClock(date: Date): { y: number; m: number; d: number; hour: number; minute: number } {
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat("en-GB", {
    timeZone: CYPRUS_TZ, year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date)) p[x.type] = x.value;
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), hour: Number(p.hour) % 24, minute: Number(p.minute) };
}

/** 22:00 ≤ Cyprus time < 06:30. */
export function inQuietHours(date: Date): boolean {
  const { hour, minute } = cyprusClock(date);
  const mins = hour * 60 + minute;
  return mins >= 22 * 60 || mins < 6 * 60 + 30;
}

export function triggerAt(kind: ReminderKind, scheduled: Date): Date {
  switch (kind) {
    case "evening": {
      const { y, m, d } = cyprusClock(scheduled);
      // Date.UTC inside rolls day 0 back into the previous month correctly.
      return cyprusWallTimeToUtc(y, m, d - 1, 20, 0);
    }
    case "t90": return new Date(scheduled.getTime() - 90 * MIN);
    case "t30": return new Date(scheduled.getTime() - 30 * MIN);
    case "missed": return new Date(scheduled.getTime() + 15 * MIN);
  }
}

export const sentKey = (draftId: number, kind: string) => `${draftId}:${kind}`;

export type ReminderGroup = { kind: ReminderKind; drafts: TypefullyDraft[] };

/** What is due right now and not yet sent — one group per kind, drafts by date. */
export function planReminders(drafts: TypefullyDraft[], sent: Set<string>, now: Date): ReminderGroup[] {
  if (inQuietHours(now)) return [];
  const t = now.getTime();
  const groups = new Map<ReminderKind, TypefullyDraft[]>();
  for (const d of drafts) {
    if (d.status !== "planned" || !d.scheduled_date) continue;
    const scheduled = new Date(d.scheduled_date);
    if (Number.isNaN(scheduled.getTime())) continue;
    for (const kind of REMINDER_KINDS) {
      const trigger = triggerAt(kind, scheduled);
      if (t < trigger.getTime() || t >= trigger.getTime() + GRACE_MS) continue;
      if (inQuietHours(trigger)) continue;
      if (sent.has(sentKey(d.id, kind))) continue;
      if (kind !== "missed" && t >= scheduled.getTime()) continue;
      if (kind === "evening") {
        // "Only if the draft already existed at 20:00 that day." No creation
        // time → cannot prove it, so no evening reminder (t90/t30 still come).
        const created = d.created_at ? new Date(d.created_at) : null;
        if (!created || Number.isNaN(created.getTime()) || created.getTime() > trigger.getTime()) continue;
      }
      groups.set(kind, [...(groups.get(kind) ?? []), d]);
    }
  }
  const byDate = (a: TypefullyDraft, b: TypefullyDraft) => new Date(a.scheduled_date!).getTime() - new Date(b.scheduled_date!).getTime() || a.id - b.id;
  return REMINDER_KINDS.filter((k) => groups.has(k)).map((kind) => ({ kind, drafts: groups.get(kind)!.sort(byDate) }));
}

export function reminderMessage(group: ReminderGroup): string {
  switch (group.kind) {
    case "evening": return buildMessage("🔔 Tomorrow — not confirmed yet", group.drafts, "Nothing goes out unless you confirm.");
    case "t90": return buildMessage("⏰ 90 minutes left — not confirmed yet", group.drafts);
    case "t30": return buildMessage("🚨 Last reminder — 30 minutes", group.drafts);
    case "missed": return buildMessage("❌ Missed — not published", group.drafts, "Reschedule in Typefully if still relevant.");
  }
}

export function apiDownMessage(r: Extract<DraftListResult, { ok: false }>): string {
  return [
    `🚨 Typefully unreachable (${r.status !== null ? `HTTP ${r.status}` : r.message.slice(0, 120)})`,
    "Social reminders cannot be checked until this is fixed — planned drafts may go unconfirmed without a warning.",
    r.status !== null ? r.message.slice(0, 200) : "",
  ].filter(Boolean).join("\n");
}

/* ── Runner ─────────────────────────────────────────────────────────────── */

export type ClaimRow = { draftId: number; kind: string };
export type SendOutcome = "sent" | "skipped" | "failed";

/** Everything that leaves the process, so tests can mock Typefully, Telegram and the table. */
export type ReminderDeps = {
  listPlanned(): Promise<DraftListResult>;
  /** Already-sent keys (sentKey) for these draft ids. */
  sentKeys(draftIds: number[]): Promise<Set<string>>;
  /** Insert rows that do not exist yet; returns only the rows THIS call inserted. */
  claim(rows: ClaimRow[]): Promise<ClaimRow[]>;
  release(rows: ClaimRow[]): Promise<void>;
  /** "skipped" = Telegram not configured on this server (staging): not a failure. */
  send(text: string): Promise<SendOutcome>;
  now(): Date;
};

export type ReminderRunResult = {
  apiOk: boolean;
  apiStatus?: number | null;
  planned: number;
  sent: Record<ReminderKind, number>;
  failed: number;
  apiAlert: "sent" | "already-sent" | "quiet-hours" | "failed" | null;
};

export async function runSocialReminders(deps: ReminderDeps): Promise<ReminderRunResult> {
  const now = deps.now();
  const result: ReminderRunResult = { apiOk: true, planned: 0, sent: { evening: 0, t90: 0, t30: 0, missed: 0 }, failed: 0, apiAlert: null };
  const marker: ClaimRow = { draftId: API_DOWN_DRAFT_ID, kind: API_DOWN_KIND };

  const list = await deps.listPlanned();
  if (!list.ok) {
    // An outage is said out loud — once per outage, never every 5 minutes —
    // and never turns into "no drafts, nothing to remind".
    result.apiOk = false;
    result.apiStatus = list.status;
    if (inQuietHours(now)) { result.apiAlert = "quiet-hours"; return result; }
    const claimed = await deps.claim([marker]);
    if (!claimed.length) { result.apiAlert = "already-sent"; return result; }
    const outcome = await deps.send(apiDownMessage(list));
    if (outcome === "failed") { await deps.release(claimed); result.apiAlert = "failed"; }
    else result.apiAlert = "sent";
    return result;
  }
  // Reachable again: the next outage gets its own alert.
  await deps.release([marker]);

  const planned = list.drafts.filter((d) => d.status === "planned");
  result.planned = planned.length;
  if (!planned.length) return result;

  const sent = await deps.sentKeys(planned.map((d) => d.id));
  for (const group of planReminders(planned, sent, now)) {
    const claimed = await deps.claim(group.drafts.map((d) => ({ draftId: d.id, kind: group.kind })));
    const mine = new Set(claimed.map((c) => c.draftId));
    const drafts = group.drafts.filter((d) => mine.has(d.id));
    if (!drafts.length) continue; // another run got there first
    const outcome = await deps.send(reminderMessage({ kind: group.kind, drafts }));
    if (outcome === "failed") {
      await deps.release(claimed);
      result.failed++;
    } else if (outcome === "sent") {
      result.sent[group.kind] += drafts.length;
    }
  }
  return result;
}
