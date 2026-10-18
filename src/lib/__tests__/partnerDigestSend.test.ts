import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DIGEST_NOTHING_NEW, DIGEST_NO_RECIPIENT, DIGEST_SENDING, digestCandidates, digestLogAction, digestStartFromEnv, digestTotals,
  isTerminalDigestError, isoWeekKey, newProjectUrl,
} from "@/lib/partner/digest";

const now = new Date("2026-10-19T05:00:00Z"); // Monday 08:00 Cyprus
const week = isoWeekKey(now);

const row = (o: Partial<Parameters<typeof digestCandidates>[0][number]> = {}) => ({
  id: "p1", status: "ACTIVE", digestOptIn: true, createdAt: new Date("2026-01-01T00:00:00Z"), digestLogs: [], ...o,
});

test("week key of the run date (Cyprus calendar)", () => {
  assert.equal(week, "2026-W43");
  // Sunday 23:30 UTC is already Monday in Cyprus → next week
  assert.equal(isoWeekKey(new Date("2026-10-25T22:30:00Z")), "2026-W44");
});

test("isTerminalDigestError", () => {
  assert.equal(isTerminalDigestError(DIGEST_NOTHING_NEW), true);
  assert.equal(isTerminalDigestError(DIGEST_NO_RECIPIENT), true);
  assert.equal(isTerminalDigestError(DIGEST_SENDING), false);
  assert.equal(isTerminalDigestError("SMTP 421 try later"), false);
  assert.equal(isTerminalDigestError(null), false);
  assert.equal(isTerminalDigestError(""), false);
});

test("digestLogAction: create / retry / skip", () => {
  assert.equal(digestLogAction(null), "create");
  assert.equal(digestLogAction(undefined), "create");
  assert.equal(digestLogAction({ sentAt: new Date(), error: null }), "skip");
  assert.equal(digestLogAction({ sentAt: new Date(), error: "anything" }), "skip");
  assert.equal(digestLogAction({ sentAt: null, error: DIGEST_NOTHING_NEW }), "skip");
  assert.equal(digestLogAction({ sentAt: null, error: DIGEST_NO_RECIPIENT }), "skip");
  assert.equal(digestLogAction({ sentAt: null, error: DIGEST_SENDING }), "skip"); // another run may be mailing
  assert.equal(digestLogAction({ sentAt: null, error: "connection refused" }), "retry");
  assert.equal(digestLogAction({ sentAt: null, error: null }), "retry");
});

test("digestCandidates: recipient filter", () => {
  const rows = [
    row({ id: "ok" }),
    row({ id: "pending", status: "PENDING" }),
    row({ id: "suspended", status: "SUSPENDED" }),
    row({ id: "optout", digestOptIn: false }),
    row({ id: "new", createdAt: now }),
    row({ id: "sent", digestLogs: [{ weekKey: week, sentAt: new Date(), error: null }] }),
    row({ id: "nothing", digestLogs: [{ weekKey: week, sentAt: null, error: DIGEST_NOTHING_NEW }] }),
    row({ id: "norcpt", digestLogs: [{ weekKey: week, sentAt: null, error: DIGEST_NO_RECIPIENT }] }),
    row({ id: "busy", digestLogs: [{ weekKey: week, sentAt: null, error: DIGEST_SENDING }] }),
    row({ id: "retry", digestLogs: [{ weekKey: week, sentAt: null, error: "timeout" }] }),
    row({ id: "lastweek", digestLogs: [{ weekKey: "2026-W42", sentAt: new Date(), error: null }] }),
  ];
  assert.deepEqual(digestCandidates(rows, week, now).map((r) => r.id), ["ok", "retry", "lastweek"]);
});

test("newProjectUrl: partner language prefix, en and unknown without", () => {
  assert.equal(newProjectUrl("en", "sea-view"), "https://cyprusvipestates.com/projects/sea-view");
  assert.equal(newProjectUrl("de", "sea-view"), "https://cyprusvipestates.com/de/projects/sea-view");
  assert.equal(newProjectUrl("ru", "a b"), "https://cyprusvipestates.com/ru/projects/a%20b");
  assert.equal(newProjectUrl("he", "x"), "https://cyprusvipestates.com/projects/x");
  assert.equal(newProjectUrl(null, "x"), "https://cyprusvipestates.com/projects/x");
});

test("digestStartFromEnv gates the job", () => {
  assert.equal(digestStartFromEnv({}), null);
  assert.equal(digestStartFromEnv({ PARTNER_DIGEST_START: "" }), null);
  assert.equal(digestStartFromEnv({ PARTNER_DIGEST_START: "soon" }), null);
  assert.equal(digestStartFromEnv({ PARTNER_DIGEST_START: "2026-10-26T00:00:00Z" })?.toISOString(), "2026-10-26T00:00:00.000Z");
});

test("digestTotals maps the stages", () => {
  assert.deepEqual(digestTotals({ EXPECTED: 1, EARNED: 2, DEVELOPER_PAID: 3, PAID_OUT: 4 }), { expected: 1, earned: 2, developerPaid: 3, paidOut: 4 });
});
