// One cron run must not outlive its own budget (2026-11-08).
//
// What went wrong before this: email-inbound declares `maxDuration = 60` but
// nothing enforced it. A run opens up to three IMAP sessions in series, each
// allowed connectionTimeout 20 s + socketTimeout 60 s, so the arithmetic
// alone permits a run far past a minute. One took 86 s and failed while the
// next 5-minute run was already due. The tests below pin the arithmetic that
// decides "start this mailbox" vs "leave it to the next run", and the wiring
// that shares ONE IMAP session per user instead of opening two.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createDeadline, runIsHealthy } from "@/lib/emailInbound/deadline";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** A clock the test moves by hand — no sleeping, no flakiness. */
function fakeClock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

test("the budget shrinks with the clock and floors at zero", () => {
  const c = fakeClock();
  const d = createDeadline(55_000, c.now);
  assert.equal(d.remainingMs(), 55_000);
  c.advance(20_000);
  assert.equal(d.remainingMs(), 35_000);
  c.advance(35_000);
  assert.equal(d.remainingMs(), 0);
  // Overrunning must not produce a negative budget that reads as "lots of room".
  c.advance(999_000);
  assert.equal(d.remainingMs(), 0);
});

test("hasRoomFor is the gate: a mailbox is only started while its minimum fits", () => {
  const c = fakeClock();
  const d = createDeadline(55_000, c.now);
  assert.equal(d.hasRoomFor(8_000), true);
  c.advance(47_000); // 8 s left — exactly the minimum, still allowed
  assert.equal(d.hasRoomFor(8_000), true);
  c.advance(1); // 7.999 s left — not enough, defer to the next run
  assert.equal(d.hasRoomFor(8_000), false);
});

test("budgetFor trims a phase to what is actually left, and never returns zero", () => {
  const c = fakeClock();
  const d = createDeadline(55_000, c.now);
  // Plenty of budget: the phase keeps its own cap, it is not handed the whole run.
  assert.equal(d.budgetFor(25_000), 25_000);
  c.advance(40_000); // 15 s left
  assert.equal(d.budgetFor(25_000), 15_000, "a phase may never outlive the run");
  c.advance(15_000); // nothing left
  // 0 would mean "expire immediately" to a timeout helper; callers gate on
  // hasRoomFor first, so this floor is the belt to that braces.
  assert.equal(d.budgetFor(25_000), 1);
});

test("the whole-run arithmetic: three mailboxes cannot exceed the route's maxDuration", () => {
  const route = read("src/app/api/cron/email-inbound/route.ts");
  const budget = Number(/const RUN_BUDGET_MS = ([0-9_]+)/.exec(route)?.[1].replace(/_/g, ""));
  const maxDuration = Number(/maxDuration = ([0-9]+)/.exec(route)?.[1]);
  assert.ok(Number.isFinite(budget) && Number.isFinite(maxDuration), "both constants must be readable");
  assert.ok(budget < maxDuration * 1000, `run budget ${budget} ms must stay under maxDuration ${maxDuration} s`);
});

test("wiring: one IMAP session per user covers inbox AND sent; the route enforces the deadline", () => {
  const route = read("src/app/api/cron/email-inbound/route.ts");
  // The old shape opened a second connection per user via pollSentForUser.
  assert.ok(!route.includes("pollSentForUser("), "the cron must not open a second session per user");
  assert.ok(route.includes("pollUserMailboxes("), "one combined poll per user");
  assert.ok(route.includes("createDeadline(RUN_BUDGET_MS)"), "the run is bounded");
  assert.ok(route.includes("hasRoomFor"), "each mailbox is gated on remaining budget");

  const poll = read("src/lib/emailInbound/pollUser.ts");
  assert.ok(poll.includes("withImapSession("), "inbox and sent share one connection");
  // No /s flag here: tsconfig sets no `target`, so dotAll (like \p{L}) is a TS error.
  assert.ok(poll.includes('open(async () => "INBOX")'), "the inbox is opened on that session");
  assert.ok(poll.includes("findSentMailbox"), "the sent folder is opened on the SAME session");
  // A sent-folder hiccup must never hide whether the inbox poll worked — the
  // reason the two were separate entries in the first place.
  assert.ok(poll.split("catch").length - 1 >= 2, "inbox and sent fail independently");

  // The read-only guarantee must survive the refactor: EXAMINE, not SELECT.
  const imap = read("src/lib/emailInbound/imapClient.ts");
  assert.ok(imap.includes("const mailbox = await client.mailboxOpen(path, { readOnly: true });"));
  assert.ok(imap.includes("readOnly !== true"), "the hard assertion stays");
});

test("a deferral is not a failure, but deferring everything is", () => {
  const polled = { ok: true };
  const deferred = { ok: true, deferred: true };
  const failed = { ok: false };

  assert.equal(runIsHealthy([polled, polled, polled]), true, "a normal run");
  assert.equal(runIsHealthy([polled, deferred, deferred]), true, "a slow mailbox pushing its neighbours along is fine");
  assert.equal(runIsHealthy([polled, failed]), false, "a real failure still fails");
  // The trap this closes: every mailbox deferred means no mail was read at all.
  // Reported as ok it would log green forever while the inbox silently stopped.
  assert.equal(runIsHealthy([deferred, deferred, deferred]), false, "total deferral is not healthy");
  // No mailboxes configured is not a failure — there is simply nothing to do.
  assert.equal(runIsHealthy([]), true);
});
