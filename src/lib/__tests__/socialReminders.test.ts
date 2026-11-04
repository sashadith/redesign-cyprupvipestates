import { test } from "node:test";
import assert from "node:assert/strict";
import type { DraftListResult, TypefullyDraft } from "@/lib/social/typefully";
import {
  runSocialReminders, planReminders, inQuietHours, triggerAt, sentKey, GRACE_MS, RECOVERY_MESSAGE,
  type ReminderDeps, type ClaimRow, type SendOutcome, type MonitorState,
} from "@/lib/social/socialReminders";
import { weekLabel, isoWeek, platformGroups, isNewsDraft, buildMessage, MESSAGE_BUDGET } from "@/lib/social/socialFormat";

/* Social reminders (2026-10-09). Typefully, Telegram and the ledger table are
   all in-memory fakes: nothing here can reach a real API or database. */

const MIN = 60_000;
// Cyprus is UTC+3 in October 2026 (EEST until 25 Oct).
const cy = (day: number, h: number, m = 0) => new Date(Date.UTC(2026, 9, day, h - 3, m));

let nextId = 5000;
function draft(scheduledAt: Date | null, extra: Partial<TypefullyDraft> = {}): TypefullyDraft {
  return {
    id: nextId++, status: "planned", scheduled_date: scheduledAt ? scheduledAt.toISOString() : null,
    draft_title: "2026-W42 · Mon · LinkedIn · Living in Limassol", linkedin_post_enabled: true,
    created_at: cy(10, 9).toISOString(), updated_at: cy(10, 9).toISOString(), ...extra,
  };
}

/** social_monitor_state in memory, with the same transitions as monitorState.ts. */
const freshState = (): MonitorState => ({ consecutiveFailures: 0, firstFailureAt: null, alertedAt: null, recoveryPending: false, upcomingPlannedAt: [] });
function stateDeps(state: MonitorState) {
  return {
    recordFailure: async (now: Date) => {
      if (state.recoveryPending) { state.recoveryPending = false; state.alertedAt = now; }
      state.consecutiveFailures++;
      state.firstFailureAt ??= now;
      return { ...state, upcomingPlannedAt: [...state.upcomingPlannedAt] };
    },
    recordSuccess: async (_now: Date, upcoming: Date[]) => {
      if (state.alertedAt) { state.alertedAt = null; state.recoveryPending = true; }
      state.consecutiveFailures = 0; state.firstFailureAt = null; state.upcomingPlannedAt = upcoming;
      return { recoveryPending: state.recoveryPending };
    },
    claimAlert: async (now: Date) => { if (state.alertedAt || state.consecutiveFailures < 1) return false; state.alertedAt = now; return true; },
    releaseAlert: async () => { state.alertedAt = null; },
    claimRecovery: async () => { if (!state.recoveryPending) return false; state.recoveryPending = false; return true; },
    releaseRecovery: async () => { state.recoveryPending = true; },
  };
}

/** A whole fake world: Typefully's planned list, the ledger, the monitor state, Telegram, the clock. */
function world(initial: TypefullyDraft[] | DraftListResult, opts: { telegram?: () => SendOutcome; state?: MonitorState } = {}) {
  let list: DraftListResult = Array.isArray(initial) ? { ok: true, drafts: initial, truncated: false } : initial;
  const state = opts.state ?? freshState();
  const ledger = new Set<string>();
  const messages: string[] = [];
  let clock = new Date(0);
  const deps: ReminderDeps = {
    listPlanned: async () => list,
    sentKeys: async (ids) => new Set(Array.from(ledger).filter((k) => ids.includes(Number(k.split(":")[0])))),
    claim: async (rows: ClaimRow[]) => rows.filter((r) => {
      const k = sentKey(r.draftId, r.kind);
      if (ledger.has(k)) return false;
      ledger.add(k);
      return true;
    }),
    release: async (rows) => { for (const r of rows) ledger.delete(sentKey(r.draftId, r.kind)); },
    send: async (text) => {
      const outcome = opts.telegram ? opts.telegram() : "sent";
      if (outcome === "sent") messages.push(text);
      return outcome;
    },
    now: () => clock,
    ...stateDeps(state),
  };
  return {
    deps, ledger, messages, state,
    setList(l: TypefullyDraft[] | DraftListResult) { list = Array.isArray(l) ? { ok: true, drafts: l, truncated: false } : l; },
    /** Run the cron every 5 minutes from `from` to `to` inclusive, like the crontab does. */
    async runEvery5(from: Date, to: Date) {
      for (let t = from.getTime(); t <= to.getTime(); t += 5 * MIN) {
        clock = new Date(t);
        await runSocialReminders(deps);
      }
    },
    async runAt(t: Date) { clock = t; return runSocialReminders(deps); },
  };
}

/* ── Exactly once ────────────────────────────────────────────────────────── */

test("a planned draft gets evening, T-90, T-30 and missed — each exactly once over a full day of runs", async () => {
  const d = draft(cy(13, 10, 0)); // Tue 13 Oct 10:00, created Sat 10 Oct
  const w = world([d]);
  await w.runEvery5(cy(12, 6, 33), cy(13, 13, 3)); // the cron's +3 offset, Mon 06:33 → Tue 13:03
  assert.equal(w.messages.length, 4, w.messages.join("\n---\n"));
  assert.match(w.messages[0], /^🔔 Tomorrow — not confirmed yet\n   💼 Tue 13 Oct 10:00 — 2026-W42 · Mon · LinkedIn · Living in Limassol\n   👉 https:\/\/typefully\.com\/\?d=\d+&a=339303\nNothing goes out unless you confirm\.$/);
  assert.match(w.messages[1], /^⏰ 90 minutes left — not confirmed yet\n/);
  assert.match(w.messages[2], /^🚨 Last reminder — 30 minutes\n/);
  assert.match(w.messages[3], /^❌ Missed — not published\n[\s\S]*\nReschedule in Typefully if still relevant\.$/);
  assert.deepEqual(Array.from(w.ledger).sort(), ["evening", "missed", "t30", "t90"].map((k) => sentKey(d.id, k)).sort());
});

test("running twice at the same instant sends nothing the second time", async () => {
  const d = draft(cy(13, 10, 0));
  const w = world([d]);
  await w.runAt(cy(13, 8, 33));
  await w.runAt(cy(13, 8, 33));
  await w.runAt(cy(13, 8, 38));
  assert.equal(w.messages.length, 1);
});

test("each kind fires at the right moment: evening 20:00 day before, T-90, T-30, missed at +15", () => {
  const s = cy(13, 10, 0);
  assert.deepEqual(triggerAt("evening", s), cy(12, 20, 0));
  assert.deepEqual(triggerAt("t90", s), cy(13, 8, 30));
  assert.deepEqual(triggerAt("t30", s), cy(13, 9, 30));
  assert.deepEqual(triggerAt("missed", s), cy(13, 10, 15));
  // Evening of a post just after midnight is the previous calendar day's 20:00.
  assert.deepEqual(triggerAt("evening", cy(14, 0, 15)), cy(13, 20, 0));
  // Across a month boundary.
  assert.deepEqual(triggerAt("evening", new Date(Date.UTC(2026, 10, 1, 8))), new Date(Date.UTC(2026, 9, 31, 18)));
});

test("missed fires at +15 min, not before, and never twice", async () => {
  const d = draft(cy(13, 10, 0));
  const w = world([d]);
  const r1 = await w.runAt(cy(13, 10, 13));
  assert.equal(r1.sent.missed, 0, "+13 min is too early");
  await w.runAt(cy(13, 10, 18));
  await w.runAt(cy(13, 10, 23));
  await w.runAt(cy(13, 11, 3));
  assert.equal(w.messages.filter((m) => m.startsWith("❌")).length, 1);
});

test("evening only if the draft already existed at 20:00", async () => {
  const late = draft(cy(13, 10, 0), { created_at: cy(12, 20, 1).toISOString() });
  const early = draft(cy(13, 10, 0), { created_at: cy(12, 19, 59).toISOString() });
  const unknown = draft(cy(13, 10, 0), { created_at: null });
  const groups = planReminders([late, early, unknown], new Set(), cy(12, 20, 3));
  assert.deepEqual(groups.map((g) => [g.kind, g.drafts.map((d) => d.id)]), [["evening", [early.id]]]);
});

test("a draft created 60 minutes before its slot gets no '90 minutes left' — the grace window is short", async () => {
  const d = draft(cy(13, 10, 0), { created_at: cy(13, 9, 0).toISOString() });
  const w = world([]);
  await w.runEvery5(cy(13, 8, 3), cy(13, 8, 58)); // not in the list yet
  w.setList([d]);
  await w.runEvery5(cy(13, 9, 3), cy(13, 9, 58));
  assert.deepEqual(w.messages.map((m) => m.split("\n")[0]), ["🚨 Last reminder — 30 minutes"]);
  assert.equal(GRACE_MS, 10 * MIN);
});

/* ── Status changes ──────────────────────────────────────────────────────── */

test("scheduled and published drafts get no reminders at all", async () => {
  const scheduled = draft(cy(13, 10, 0), { status: "scheduled" });
  const published = draft(cy(13, 10, 0), { status: "published" });
  const w = world([scheduled, published]);
  await w.runEvery5(cy(12, 19, 58), cy(13, 11, 3));
  assert.deepEqual(w.messages, []);
});

test("a draft confirmed after the evening reminder gets nothing further", async () => {
  const d = draft(cy(13, 10, 0));
  const w = world([d]);
  await w.runEvery5(cy(12, 19, 58), cy(12, 21, 58));
  assert.equal(w.messages.length, 1);
  w.setList([]); // confirmed → no longer in the planned list
  await w.runEvery5(cy(13, 6, 33), cy(13, 12, 3));
  assert.equal(w.messages.length, 1);
});

/* ── Grouping ────────────────────────────────────────────────────────────── */

test("several drafts due at the same reminder moment → ONE message listing all of them", async () => {
  const a = draft(cy(13, 10, 0), { draft_title: "A" });
  const b = draft(cy(13, 10, 0), { draft_title: "B", linkedin_post_enabled: false, x_post_enabled: true });
  const c = draft(cy(13, 10, 5), { draft_title: "2026-W42 · Tue · News · C" });
  const w = world([c, b, a]);
  await w.runAt(cy(13, 8, 38)); // T-90 window of all three
  assert.equal(w.messages.length, 1);
  const lines = w.messages[0].split("\n");
  assert.equal(lines[0], "⏰ 90 minutes left — not confirmed yet");
  assert.deepEqual(lines.slice(1).filter((l) => l.includes(" — ")).map((l) => l.trim()), [
    "💼 Tue 13 Oct 10:00 — A", "🌐 Tue 13 Oct 10:00 — B", "🗞 Tue 13 Oct 10:05 — 2026-W42 · Tue · News · C",
  ]);
  assert.equal(lines.filter((l) => l.startsWith("   👉 ")).length, 3, "every draft has its link");
});

test("a very long batch is cut at whole drafts with '… and N more', never over Telegram's limit", () => {
  const many = Array.from({ length: 60 }, () => draft(cy(13, 10, 0), { draft_title: "x".repeat(80) }));
  const text = buildMessage("🔔 Tomorrow — not confirmed yet", many, "Nothing goes out unless you confirm.");
  assert.ok(text.length <= MESSAGE_BUDGET, `${text.length}`);
  assert.match(text, /… and \d+ more in Typefully\nNothing goes out unless you confirm\.$/);
});

/* ── Quiet hours ─────────────────────────────────────────────────────────── */

test("quiet hours are 22:00–06:30 Cyprus", () => {
  assert.equal(inQuietHours(cy(13, 21, 59)), false);
  assert.equal(inQuietHours(cy(13, 22, 0)), true);
  assert.equal(inQuietHours(cy(14, 3, 0)), true);
  assert.equal(inQuietHours(cy(14, 6, 29)), true);
  assert.equal(inQuietHours(cy(14, 6, 30)), false);
});

test("a reminder whose moment falls into quiet hours is skipped, not queued", async () => {
  const d = draft(cy(13, 7, 0)); // T-90 = 05:30 (quiet) → skipped; T-30 = 06:30 → sent
  const w = world([d]);
  await w.runEvery5(cy(13, 5, 3), cy(13, 7, 58));
  assert.deepEqual(w.messages.map((m) => m.split("\n")[0]), ["🚨 Last reminder — 30 minutes", "❌ Missed — not published"]);
  assert.ok(!w.ledger.has(sentKey(d.id, "t90")), "a skipped reminder is not recorded as sent");
});

test("nothing is sent inside quiet hours even if the trigger was just before 22:00", async () => {
  const d = draft(cy(13, 23, 25)); // T-90 = 21:55 → its grace runs into 22:00+
  const w = world([d]);
  await w.runAt(cy(13, 22, 3));
  assert.deepEqual(w.messages, []);
});

/* ── Failures ────────────────────────────────────────────────────────────── */

const DOWN: DraftListResult = { ok: false, status: 503, message: "Service Unavailable" };
const TIMEOUT: DraftListResult = { ok: false, status: null, message: "request failed: The operation was aborted due to timeout" };

test("one failed check (a timeout that survived the retries) → logged, no alert", async () => {
  const w = world(TIMEOUT);
  const r = await w.runAt(cy(13, 9, 3));
  assert.equal(r.apiOk, false);
  assert.equal(r.apiAlert, "below-threshold");
  assert.equal(r.consecutiveFailures, 1);
  assert.deepEqual(w.messages, []);
  // …and the next good check clears it without any message.
  w.setList([]);
  const ok = await w.runAt(cy(13, 9, 8));
  assert.equal(ok.recovery, null);
  assert.equal(w.state.consecutiveFailures, 0);
  assert.deepEqual(w.messages, []);
});

test("three failed checks are not enough until they span 15 minutes → then exactly ONE alert", async () => {
  const w = world(DOWN);
  await w.runEvery5(cy(13, 9, 3), cy(13, 9, 13)); // 09:03, 09:08, 09:13 — 3 failures, 10 minutes
  assert.deepEqual(w.messages, []);
  const r = await w.runAt(cy(13, 9, 18)); // 4th failure, 15 minutes after the first
  assert.equal(r.apiAlert, "sent");
  assert.equal(w.messages.length, 1);
  assert.match(w.messages[0], /^🚨 Typefully unreachable \(HTTP 503\)\nFailing since 09:03 — 4 checks in a row, each retried twice\./);
  assert.doesNotMatch(w.messages[0], /due at/);
  // The outage goes on for two hours: still that one alert.
  await w.runEvery5(cy(13, 9, 23), cy(13, 11, 23));
  assert.equal(w.messages.length, 1);
});

test("15 minutes alone is not enough either: 2 failed checks far apart do not alert", async () => {
  const w = world(DOWN);
  await w.runAt(cy(13, 9, 3));
  await w.runAt(cy(13, 9, 40)); // the cron skipped (e.g. a deploy) — only 2 checks
  assert.deepEqual(w.messages, []);
  await w.runAt(cy(13, 9, 45));
  assert.equal(w.messages.length, 1);
});

test("recovery after an alert → exactly ONE recovery message; the next outage alerts again", async () => {
  const w = world(DOWN);
  await w.runEvery5(cy(13, 9, 3), cy(13, 9, 33));
  assert.equal(w.messages.length, 1);
  w.setList([]);
  const r = await w.runAt(cy(13, 9, 38));
  assert.equal(r.recovery, "sent");
  await w.runEvery5(cy(13, 9, 43), cy(13, 11, 3));
  assert.deepEqual(w.messages.slice(1), [RECOVERY_MESSAGE]);
  // A new outage is a new incident: threshold again, alert again, recovery again.
  w.setList(DOWN);
  await w.runEvery5(cy(13, 11, 8), cy(13, 11, 23));
  w.setList([]);
  await w.runAt(cy(13, 11, 28));
  assert.deepEqual(w.messages.map((m) => m.split("\n")[0]), [
    "🚨 Typefully unreachable (HTTP 503)", RECOVERY_MESSAGE, "🚨 Typefully unreachable (HTTP 503)", RECOVERY_MESSAGE,
  ]);
});

test("no alert was sent → no recovery message", async () => {
  const w = world(DOWN);
  await w.runEvery5(cy(13, 9, 3), cy(13, 9, 13));
  w.setList([]);
  await w.runEvery5(cy(13, 9, 18), cy(13, 9, 38));
  assert.deepEqual(w.messages, []);
});

test("a planned draft due within 2 hours → alert after the FIRST failed check", async () => {
  const d = draft(cy(13, 11, 0));
  const w = world([d]);
  await w.runAt(cy(13, 9, 3)); // good check: remembers the 11:00 draft
  assert.deepEqual(w.messages, []);
  w.setList(TIMEOUT);
  const r = await w.runAt(cy(13, 9, 8));
  assert.equal(r.apiAlert, "sent");
  assert.equal(r.consecutiveFailures, 1);
  assert.equal(w.messages.length, 1);
  assert.match(w.messages[0], /^🚨 Typefully unreachable \(request failed: .*\)\nFailing since 09:08 — 1 check, each retried twice\.\n⏰ A planned draft is due at 11:00/);
  await w.runEvery5(cy(13, 9, 13), cy(13, 10, 3));
  assert.equal(w.messages.length, 1, "still one alert per outage");
});

test("a planned draft due in more than 2 hours does not shorten the threshold", async () => {
  const w = world([draft(cy(13, 12, 0))]);
  await w.runAt(cy(13, 9, 3));
  w.setList(DOWN);
  await w.runAt(cy(13, 9, 8)); // 11:00 would be within 2h, 12:00 is not
  assert.deepEqual(w.messages, []);
});

test("the failure count survives a worker restart (state is durable, not in the process)", async () => {
  const state = freshState();
  const a = world(DOWN, { state });
  await a.runEvery5(cy(13, 9, 3), cy(13, 9, 13));
  // pm2 restart: a brand-new process, same DB row.
  const b = world(DOWN, { state });
  const r = await b.runAt(cy(13, 9, 18));
  assert.equal(r.consecutiveFailures, 4);
  assert.equal(r.apiAlert, "sent");
  assert.equal(a.messages.length + b.messages.length, 1);
});

test("an outage that earns its alert at night is said at 06:30, once", async () => {
  const w = world(DOWN);
  const r = await w.runAt(cy(13, 21, 58));
  assert.equal(r.apiAlert, "below-threshold");
  await w.runEvery5(cy(13, 22, 3), cy(14, 6, 28));
  assert.deepEqual(w.messages, []);
  await w.runEvery5(cy(14, 6, 33), cy(14, 7, 3));
  assert.equal(w.messages.length, 1);
  assert.match(w.messages[0], /Failing since Tue 13 Oct 21:58/);
});

test("a recovery inside quiet hours is held until 06:30, then sent once", async () => {
  const w = world(DOWN);
  await w.runEvery5(cy(13, 21, 3), cy(13, 21, 23));
  assert.equal(w.messages.length, 1);
  w.setList([]);
  const r = await w.runAt(cy(13, 23, 3));
  assert.equal(r.recovery, "quiet-hours");
  await w.runEvery5(cy(13, 23, 8), cy(14, 7, 3));
  assert.deepEqual(w.messages.slice(1), [RECOVERY_MESSAGE]);
});

test("checks a few ms short of 15 minutes still alert at the 4th check (cron jitter)", async () => {
  const w = world(DOWN);
  await w.runAt(new Date(cy(13, 9, 3).getTime() + 140));
  await w.runAt(new Date(cy(13, 9, 8).getTime() + 90));
  await w.runAt(new Date(cy(13, 9, 13).getTime() + 70));
  assert.deepEqual(w.messages, []);
  await w.runAt(new Date(cy(13, 9, 18).getTime() + 90)); // 14:59.95 after the first
  assert.equal(w.messages.length, 1);
});

test("a held recovery is not lost when Typefully fails once more: the incident just continues", async () => {
  const w = world(DOWN);
  await w.runEvery5(cy(13, 21, 3), cy(13, 21, 23)); // alert 21:18
  w.setList([]);
  await w.runAt(cy(13, 22, 8)); // back, recovery held (quiet hours)
  w.setList(DOWN);
  const r = await w.runAt(cy(14, 2, 13)); // one more failed check at night
  assert.equal(r.apiAlert, "already-sent", "same incident, no second alert");
  w.setList([]);
  await w.runEvery5(cy(14, 2, 18), cy(14, 7, 3));
  assert.deepEqual(w.messages.map((m) => m.split("\n")[0]), ["🚨 Typefully unreachable (HTTP 503)", RECOVERY_MESSAGE]);
});

test("a failed Telegram send of the alert or the recovery is retried, never doubled", async () => {
  let fail = true;
  const w = world(DOWN, { telegram: () => (fail ? "failed" : "sent") });
  await w.runEvery5(cy(13, 9, 3), cy(13, 9, 18));
  assert.equal(w.state.alertedAt, null, "released for the next run");
  fail = false;
  await w.runEvery5(cy(13, 9, 23), cy(13, 9, 33));
  assert.equal(w.messages.length, 1);
  fail = true;
  w.setList([]);
  const r = await w.runAt(cy(13, 9, 38));
  assert.equal(r.recovery, "failed");
  fail = false;
  await w.runEvery5(cy(13, 9, 43), cy(13, 9, 53));
  assert.deepEqual(w.messages.slice(1), [RECOVERY_MESSAGE]);
});

test("a failed Telegram send is released and retried on the next run, then sent once", async () => {
  let fail = true;
  const d = draft(cy(13, 10, 0));
  const w = world([d], { telegram: () => (fail ? "failed" : "sent") });
  const r = await w.runAt(cy(13, 8, 33));
  assert.equal(r.failed, 1);
  assert.ok(!w.ledger.has(sentKey(d.id, "t90")));
  fail = false;
  await w.runAt(cy(13, 8, 38));
  await w.runAt(cy(13, 8, 43));
  assert.equal(w.messages.length, 1);
});

test("a draft claimed by an overlapping run is not sent again", async () => {
  const d = draft(cy(13, 10, 0));
  const w = world([d]);
  w.ledger.add(sentKey(d.id, "t90")); // the other run's claim
  await w.runAt(cy(13, 8, 33));
  assert.deepEqual(w.messages, []);
});

/* ── Format ──────────────────────────────────────────────────────────────── */

test("week label: 'KW <ISO week> (<Mon day> - <Fri day> <Mon>)'", () => {
  assert.equal(weekLabel(cy(19, 12)), "KW 43 (19 - 23 Oct)");
  assert.equal(weekLabel(cy(25, 12)), "KW 43 (19 - 23 Oct)", "Sunday belongs to the week before");
  assert.equal(weekLabel(new Date("2026-09-30T09:00:00Z")), "KW 40 (28 Sep - 2 Oct)");
  assert.equal(isoWeek(new Date("2027-01-01T12:00:00Z")), 53, "1 Jan 2027 is in 2026's week 53");
  // 21:30 UTC on Sunday 18 Oct is already 00:30 Monday in Cyprus: the label follows Cyprus.
  assert.equal(weekLabel(new Date("2026-10-18T21:30:00Z")), "KW 43 (19 - 23 Oct)", "00:30 Monday in Cyprus");
});

test("platform icons: News by title segment, then LinkedIn / Social / Substack", () => {
  const base = { id: 1, status: "planned", scheduled_date: null } as TypefullyDraft;
  assert.deepEqual(platformGroups({ ...base, draft_title: "2026-W43 · Mon · News · Rates", x_post_enabled: true }).map((g) => g.icon), ["🗞"]);
  assert.equal(isNewsDraft({ ...base, draft_title: "2026-W43 · Mon · LinkedIn · Market news today" }), false, "the word alone is not the segment");
  assert.deepEqual(platformGroups({ ...base, linkedin_post_enabled: true }).map((g) => g.icon), ["💼"]);
  for (const k of ["x", "threads", "bluesky"]) assert.deepEqual(platformGroups({ ...base, [`${k}_post_enabled`]: true }).map((g) => g.icon), ["🌐"]);
  assert.deepEqual(platformGroups({ ...base, substack_post_enabled: true }).map((g) => g.icon), ["📰"]);
  assert.deepEqual(platformGroups({ ...base, linkedin_post_enabled: true, x_post_enabled: true, threads_post_enabled: true }).map((g) => g.label), ["LinkedIn", "Social"]);
});

/* ── Planner guards on their own (the runner adds a second layer for each) ── */

test("a reminder triggered at 06:25 is skipped even though the 06:33 run is outside quiet hours", () => {
  const d = draft(cy(13, 6, 55)); // T-30 = 06:25 → falls into quiet hours
  assert.deepEqual(planReminders([d], new Set(), cy(13, 6, 33)), []);
});

test("the planner itself skips anything already in the ledger", () => {
  const d = draft(cy(13, 10, 0));
  assert.deepEqual(planReminders([d], new Set([sentKey(d.id, "t90")]), cy(13, 8, 33)), []);
  assert.equal(planReminders([d], new Set(), cy(13, 8, 33)).length, 1);
});

test("the planner itself ignores every status other than planned", () => {
  const drafts = ["scheduled", "published", "publishing", "error", "draft"].map((status) => draft(cy(13, 10, 0), { status }));
  assert.deepEqual(planReminders(drafts, new Set(), cy(13, 8, 33)), []);
});
