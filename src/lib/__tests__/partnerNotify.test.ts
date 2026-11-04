import { test } from "node:test";
import assert from "node:assert/strict";
import { PARTNER_LOCALES, dict, type PartnerLocale } from "@/lib/partner/i18n";
import {
  BACKOFF_BASE_MS, MAX_ATTEMPTS, SENDING_MARK, STUCK_SENDING_MS, stuckSendingWhere, TRANSPORT_BREAKER, TransportStreak, beforeStart, buildClaimOutcomeEmail, buildMessageEmail, buildStageEmail,
  clientLink, deadWhere, dueWhere, firstNameOf, isDue, isUnchangedStage, messageIdFromRefKey, notificationGate, notifyStartFromEnv,
  planStageNotifications, retryAt, stageKeyFor, stageRefKey, truncateError, type StageRow,
} from "@/lib/partner/notify";

const LINK = clientLink("https://partner.example.com", "claim-123");
const common = { partnerFirstName: "Anna", clientName: "Jan Kowalski", link: LINK };
const builders = {
  stage: (l: PartnerLocale) => buildStageEmail(l, { ...common, stageKey: "stages.viewing" }),
  message: (l: PartnerLocale) => buildMessageEmail(l, { ...common, body: "Viewing on Friday.", authorFirstName: "Maria" }),
  accepted: (l: PartnerLocale) => buildClaimOutcomeEmail(l, { ...common, accepted: true }),
  rejected: (l: PartnerLocale) => buildClaimOutcomeEmail(l, { ...common, accepted: false }),
};

test("notify mail: link is the portal client page of the claim", () => {
  assert.equal(LINK, "https://partner.example.com/clients/claim-123");
  assert.equal(clientLink("https://p.x", "a/b"), "https://p.x/clients/a%2Fb");
});

test("notify mail: subjects non-empty, localized, contain the client name; link in text and html", () => {
  for (const [kind, build] of Object.entries(builders)) {
    const en = build("en");
    for (const l of PARTNER_LOCALES) {
      const m = build(l);
      assert.ok(m.subject.trim().length > 0, `${kind} ${l}`);
      assert.ok(m.subject.includes("Jan Kowalski"), `${kind} ${l}`);
      if (l !== "en") {
        assert.notEqual(m.subject, en.subject, `${kind} ${l}`);
        assert.notEqual(m.text, en.text, `${kind} ${l}`);
      }
      assert.ok(m.text.includes(LINK), `${kind} ${l}`);
      assert.ok(m.html.includes(`href="${LINK}"`), `${kind} ${l}`);
      assert.ok(m.text.includes(dict(l).mail.signature), `${kind} ${l}`);
      assert.doesNotMatch(m.subject + m.text + m.html, /\{\w+\}/, `${kind} ${l}: unfilled placeholder`);
      assert.doesNotMatch(m.subject + m.text + m.html, /[֐-׿]/);
    }
  }
});

test("notify mail: accepted and rejected differ; rejected is neutral", () => {
  for (const l of PARTNER_LOCALES) {
    assert.notEqual(builders.accepted(l).subject, builders.rejected(l).subject);
    assert.notEqual(builders.accepted(l).text, builders.rejected(l).text);
  }
  const r = builders.rejected("en").text.toLowerCase();
  for (const w of ["owner", "existing", "already", "another partner", "duplicate"]) assert.ok(!r.includes(w), w);
});

test("notify mail: stage label in the partner's language", () => {
  for (const l of PARTNER_LOCALES) {
    const m = buildStageEmail(l, { ...common, stageKey: "stages.reserved" });
    assert.ok(m.text.includes(dict(l).stages.reserved), l);
    assert.ok(m.html.includes(dict(l).stages.reserved), l);
  }
  // Unknown key falls back to a real label, never the raw key.
  const u = buildStageEmail("en", { ...common, stageKey: "stages.nope" });
  assert.ok(!u.text.includes("stages."));
});

test("notify mail: greeting with the partner's first name (PL formal, no name)", () => {
  assert.ok(builders.stage("en").text.startsWith("Dear Anna,"));
  assert.ok(builders.stage("de").text.startsWith("Guten Tag Anna,"));
  assert.ok(builders.stage("ru").text.startsWith("Здравствуйте, Anna!"));
  assert.ok(builders.stage("pl").text.startsWith("Szanowni Państwo,"));
});

test("notify mail: client name and message body are HTML-escaped", () => {
  const evil = `<script>alert("x")</script>`;
  const mails = [
    buildStageEmail("en", { ...common, clientName: `Jan ${evil}`, stageKey: "stages.offer" }),
    buildMessageEmail("en", { ...common, clientName: `Jan ${evil}`, body: `Hi ${evil} & bye`, authorFirstName: `<b>Mo</b>` }),
    buildClaimOutcomeEmail("en", { ...common, clientName: `Jan ${evil}`, accepted: true }),
  ];
  for (const m of mails) {
    assert.ok(!m.html.includes("<script>"), m.subject);
    assert.ok(m.html.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"));
  }
  assert.ok(!mails[1].html.includes("<b>Mo</b>"));
  assert.ok(mails[1].html.includes("Hi &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; bye"));
  // Plain text stays plain.
  assert.ok(mails[1].text.includes(`Hi ${evil} & bye`));
});

test("notify mail: message body newlines → <br> in html, kept in text; CRLF normalised", () => {
  const m = buildMessageEmail("de", { ...common, body: "Line one\nLine two\r\nLine three", authorFirstName: "Maria" });
  assert.ok(m.html.includes("Line one<br>Line two<br>Line three"));
  assert.ok(m.text.includes("Line one\nLine two\nLine three"));
  assert.ok(!m.text.includes("\r"));
  assert.ok(m.text.includes("Maria"));
});

test("notify mail: message without an author uses the team wording", () => {
  for (const l of PARTNER_LOCALES) {
    const m = buildMessageEmail(l, { ...common, body: "x", authorFirstName: null });
    assert.ok(m.text.includes(dict(l).mail.message.introTeam.replace("{client}", "Jan Kowalski")), l);
    assert.ok(!m.text.includes("{author}"));
  }
});

test("notify mail: no internal fields leak", () => {
  for (const build of Object.values(builders)) {
    for (const l of PARTNER_LOCALES) {
      const all = (({ subject, text, html }) => subject + text + html)(build(l));
      for (const w of ["ourCommission", "commission", "Provision", "prowizj", "комисси", "owner", "lead", "@cyprusvipestates"]) {
        assert.ok(!all.includes(w), `${l}: ${w}`);
      }
    }
  }
});

test("notify helpers: stage key, first name, refKey parsing, error truncation, start env", () => {
  assert.equal(stageKeyFor("VIEWING_SCHEDULED"), "stages.viewing");
  assert.equal(stageKeyFor("LOST"), "stages.lost");
  assert.equal(stageKeyFor("NOPE"), null);
  assert.equal(stageKeyFor(undefined), null);
  assert.equal(firstNameOf("  Maria  Ivanova "), "Maria");
  assert.equal(firstNameOf(null), null);
  assert.equal(firstNameOf("  "), null);
  assert.equal(messageIdFromRefKey("msg:abc"), "abc");
  assert.equal(messageIdFromRefKey("msg:"), null);
  assert.equal(messageIdFromRefKey("stage:abc"), null);
  assert.equal(stageRefKey("i1"), "stage:i1");
  assert.equal(truncateError(new Error("x".repeat(900))).length, 500);
  assert.equal(truncateError("boom"), "boom");
  assert.equal(notifyStartFromEnv({}), null);
  assert.equal(notifyStartFromEnv({ PARTNER_NOTIFY_START: "garbage" }), null);
  assert.equal(notifyStartFromEnv({ PARTNER_NOTIFY_START: "2026-10-19T12:00:00Z" })?.toISOString(), "2026-10-19T12:00:00.000Z");
});

// ── Planner ─────────────────────────────────────────────────────────────────

const NOW = new Date("2026-10-20T12:00:00Z");
const START = new Date("2026-10-19T00:00:00Z");
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000);
const CLAIM_AT = new Date("2026-10-19T06:00:00Z");
const row = (id: string, minAgo: number, toStatus: unknown = "CONTACTED", over: Partial<StageRow> = {}): StageRow => ({
  interactionId: id, leadId: "L1", occurredAt: ago(minAgo), toStatus, claimId: "C1", partnerId: "P1", claimActiveSince: CLAIM_AT, ...over,
});
const plan = (rows: StageRow[], existing: string[] = []) =>
  planStageNotifications({ rows, existingRefKeys: existing, now: NOW, start: START });

test("planner: a single settled change becomes one pending row", () => {
  const p = plan([row("i1", 30, "OFFER")]);
  assert.equal(p.pending, 1);
  assert.deepEqual(p.rows, [{
    kind: "STAGE", refKey: "stage:i1", partnerId: "P1", leadId: "L1", claimId: "C1",
    payload: { toStatus: "OFFER" }, sentAt: null, error: null,
  }]);
});

test("planner: debounce — a lead with a change in the last 10 minutes is skipped entirely", () => {
  const p = plan([row("i1", 60), row("i2", 5, "COMMUNICATING")]);
  assert.deepEqual(p.rows, []);
  assert.equal(p.settlingLeads, 1);
  // exactly at the boundary (10 min ago) counts as settled
  assert.equal(plan([row("i3", 10)]).pending, 1);
  // a future-dated change also means "still settling"
  assert.deepEqual(plan([row("i4", -5)]).rows, []);
});

test("planner: several changes of one lead collapse into the newest", () => {
  const p = plan([row("i1", 90, "CONTACTED"), row("i3", 20, "VIEWING_SCHEDULED"), row("i2", 60, "COMMUNICATING")]);
  assert.equal(p.pending, 1);
  assert.equal(p.collapsed, 2);
  const pending = p.rows.filter((r) => r.sentAt === null);
  assert.deepEqual(pending.map((r) => [r.refKey, r.payload.toStatus]), [["stage:i3", "VIEWING_SCHEDULED"]]);
  for (const r of p.rows.filter((r) => r.sentAt !== null)) {
    assert.equal(r.error, "collapsed");
    assert.equal(r.sentAt?.getTime(), NOW.getTime());
  }
});

test("planner: changes before PARTNER_NOTIFY_START or before the claim are ignored", () => {
  const beforeStart = row("i1", 0, "OFFER", { occurredAt: new Date("2026-10-18T23:00:00Z"), claimActiveSince: new Date("2026-10-01T00:00:00Z") });
  const beforeClaim = row("i2", 0, "OFFER", { occurredAt: new Date("2026-10-19T05:00:00Z") });
  assert.deepEqual(plan([beforeStart, beforeClaim]).rows, []);
  // a pre-claim change never makes a lead "settling" nor collapses into the claim's own changes
  const p = plan([row("i3", 30, "RESERVED"), beforeClaim]);
  assert.deepEqual(p.rows.map((r) => r.refKey), ["stage:i3"]);
  // a change at exactly the claim time counts
  assert.equal(plan([row("i4", 0, "OFFER", { occurredAt: CLAIM_AT, claimActiveSince: CLAIM_AT })]).pending, 1);
});

test("planner: rows already in the outbox are never planned again", () => {
  assert.deepEqual(plan([row("i1", 30)], ["stage:i1"]).rows, []);
  const p = plan([row("i1", 60), row("i2", 30, "OFFER")], ["stage:i1"]);
  assert.deepEqual(p.rows.map((r) => [r.refKey, r.sentAt]), [["stage:i2", null]]);
});

test("planner: an older change that turns up after a newer one was recorded is collapsed, not mailed", () => {
  const p = plan([row("i1", 60, "CONTACTED"), row("i2", 30, "OFFER")], ["stage:i2"]);
  assert.equal(p.pending, 0);
  assert.deepEqual(p.rows.map((r) => [r.refKey, r.error]), [["stage:i1", "collapsed"]]);
});

test("planner: settling lead whose rows are all recorded is not counted", () => {
  const p = plan([row("i1", 5)], ["stage:i1"]);
  assert.equal(p.settlingLeads, 0);
  assert.deepEqual(p.rows, []);
});

test("planner: leads are independent", () => {
  const p = plan([
    row("a1", 60, "CONTACTED"), row("a2", 30, "OFFER"),
    row("b1", 40, "COMMUNICATING", { leadId: "L2", claimId: "C2", partnerId: "P2" }),
    row("c1", 2, "OFFER", { leadId: "L3", claimId: "C3" }),
  ]);
  const pending = p.rows.filter((r) => r.sentAt === null).map((r) => [r.leadId, r.claimId, r.partnerId, r.payload.toStatus]).sort();
  assert.deepEqual(pending, [["L1", "C1", "P1", "OFFER"], ["L2", "C2", "P2", "COMMUNICATING"]]);
  assert.equal(p.collapsed, 1);
  assert.equal(p.settlingLeads, 1);
});

test("planner: invalid toStatus is recorded as done and never chosen as the newest", () => {
  const p = plan([row("i1", 60, "OFFER"), row("i2", 30, "BOGUS"), row("i3", 20, null)]);
  const byKey = Object.fromEntries(p.rows.map((r) => [r.refKey, r]));
  assert.equal(byKey["stage:i1"].sentAt, null);
  assert.equal(byKey["stage:i2"].error, "invalid status");
  assert.equal(byKey["stage:i3"].error, "invalid status");
  assert.equal(byKey["stage:i2"].payload.toStatus, null);
  assert.equal(p.pending, 1);
  assert.equal(p.collapsed, 0);
});

test("planner: identical timestamps pick one deterministic newest", () => {
  const p1 = plan([row("i1", 30, "CONTACTED"), row("i2", 30, "OFFER")]);
  const p2 = plan([row("i2", 30, "OFFER"), row("i1", 30, "CONTACTED")]);
  const pick = (p: typeof p1) => p.rows.find((r) => r.sentAt === null)?.refKey;
  assert.equal(pick(p1), pick(p2));
  assert.equal(p1.pending, 1);
  assert.equal(p1.collapsed, 1);
});

test("planner: custom debounce", () => {
  const p = planStageNotifications({ rows: [row("i1", 3)], existingRefKeys: [], now: NOW, start: START, debounceMs: 60_000 });
  assert.equal(p.pending, 1);
});

test("planner: stage changes between submission and review of an accepted known contact are not the partner's", () => {
  // claimActiveSince = reviewedAt; a change after submission but before the review is ignored
  const reviewedAt = ago(60);
  const p = plan([row("i1", 120, "OFFER", { claimActiveSince: reviewedAt }), row("i2", 30, "RESERVED", { claimActiveSince: reviewedAt })]);
  assert.deepEqual(p.rows.map((r) => r.refKey), ["stage:i2"]);
});

// ── Outbox robustness ───────────────────────────────────────────────────────

test("backoff: 10 min · 2^(attempts−1), at most 6 attempts", () => {
  assert.equal(MAX_ATTEMPTS, 6);
  const failedAt = new Date("2026-10-20T12:00:00Z");
  assert.equal(retryAt({ attempts: 0, failedAt: null }), null);
  assert.equal(retryAt({ attempts: 0, failedAt }), null);
  assert.deepEqual([1, 2, 3, 4, 5].map((attempts) => (retryAt({ attempts, failedAt })!.getTime() - failedAt.getTime()) / 60_000), [10, 20, 40, 80, 160]);
  const at = (min: number) => new Date(failedAt.getTime() + min * 60_000);
  assert.equal(isDue({ sentAt: null, attempts: 0, failedAt: null }, failedAt), true);
  assert.equal(isDue({ sentAt: null, attempts: 1, failedAt }, at(9)), false);
  assert.equal(isDue({ sentAt: null, attempts: 1, failedAt }, at(10)), true);
  assert.equal(isDue({ sentAt: null, attempts: 3, failedAt }, at(39)), false);
  assert.equal(isDue({ sentAt: null, attempts: 3, failedAt }, at(40)), true);
  assert.equal(isDue({ sentAt: null, attempts: 6, failedAt }, at(100_000)), false, "dead rows are never due");
  assert.equal(isDue({ sentAt: failedAt, attempts: 0, failedAt: null }, at(1)), false, "sent / claimed rows are never due");
});

test("dueWhere mirrors isDue: one branch per attempt count with its own backoff cutoff", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  const w = dueWhere(now);
  assert.equal(w.sentAt, null);
  const [attemptsClause, holdClause] = w.AND as { OR: unknown[] }[];
  const or = attemptsClause.OR as { attempts: unknown; failedAt?: { lte: Date } | null }[];
  assert.deepEqual(holdClause.OR, [{ notBefore: null }, { notBefore: { lte: now } }], "quiet-hour holds are not due before notBefore");
  assert.deepEqual(or[0], { attempts: 0 });
  assert.deepEqual(or[1], { attempts: { gt: 0, lt: MAX_ATTEMPTS }, failedAt: null });
  const branches = or.slice(2);
  assert.deepEqual(branches.map((b) => b.attempts), [1, 2, 3, 4, 5]);
  assert.deepEqual(branches.map((b) => (now.getTime() - b.failedAt!.lte.getTime()) / BACKOFF_BASE_MS), [1, 2, 4, 8, 16]);
  assert.deepEqual(deadWhere(), { sentAt: null, attempts: { gte: MAX_ATTEMPTS } });
});

test("transport streak: three consecutive send errors stop the batch uncharged; a success charges the held rows", () => {
  assert.equal(TRANSPORT_BREAKER, 3);
  const a = new TransportStreak();
  assert.equal(a.fail("r1"), false);
  assert.deepEqual(a.succeed(), ["r1"], "the mail server works — r1 itself failed and is charged");
  assert.deepEqual(a.succeed(), []);
  assert.equal(a.fail("r2"), false);
  assert.equal(a.fail("r3"), false);
  assert.equal(a.fail("r4"), true, "third in a row trips");
  assert.deepEqual(a.finish(true), [], "tripped: transport failure, no attempt counted");
  const b = new TransportStreak();
  b.fail("r5");
  assert.deepEqual(b.finish(false), ["r5"], "batch ended without tripping: charged");
});

test("before start: MESSAGE / CLAIM_OUTCOME rows written before PARTNER_NOTIFY_START are not mailed; STAGE is filtered at collect", () => {
  const start = new Date("2026-10-19T00:00:00Z");
  const before = new Date("2026-10-18T23:59:59Z");
  assert.equal(beforeStart({ kind: "MESSAGE", createdAt: before }, start), true);
  assert.equal(beforeStart({ kind: "CLAIM_OUTCOME", createdAt: before }, start), true);
  assert.equal(beforeStart({ kind: "STAGE", createdAt: before }, start), false);
  assert.equal(beforeStart({ kind: "MESSAGE", createdAt: start }, start), false);
});

test("unchanged stage: a row repeating the last mailed stage is skipped", () => {
  assert.equal(isUnchangedStage("OFFER", "OFFER"), true);
  assert.equal(isUnchangedStage("OFFER", "VIEWING_SCHEDULED"), false);
  assert.equal(isUnchangedStage("OFFER", undefined), false, "nothing mailed yet");
  assert.equal(isUnchangedStage("NOPE", "NOPE"), false);
});

test("notification gate: rejection is told regardless of the lead; everything else needs an effectively ACTIVE claim", () => {
  const g = (kind: "STAGE" | "MESSAGE" | "CLAIM_OUTCOME", accepted: boolean, claim: Parameters<typeof notificationGate>[0]["claim"]) =>
    notificationGate({ kind, accepted, claim });
  const mine = (effective: "ACTIVE" | "EXPIRED" | "NOT_PROCEEDING" | "REJECTED" | "IN_REVIEW") => ({ ownedByPartner: true, effective });
  // rejection: sent even on a trashed lead
  assert.equal(g("CLAIM_OUTCOME", false, mine("REJECTED")), null);
  assert.equal(g("CLAIM_OUTCOME", false, mine("NOT_PROCEEDING")), null);
  // acceptance: only while still effectively active
  assert.equal(g("CLAIM_OUTCOME", true, mine("ACTIVE")), null);
  assert.equal(g("CLAIM_OUTCOME", true, mine("NOT_PROCEEDING")), "lead trashed");
  assert.equal(g("CLAIM_OUTCOME", true, mine("EXPIRED")), "protection ended");
  assert.equal(g("CLAIM_OUTCOME", true, mine("REJECTED")), "claim inactive");
  for (const kind of ["STAGE", "MESSAGE"] as const) {
    assert.equal(g(kind, false, mine("ACTIVE")), null, kind);
    assert.equal(g(kind, false, mine("EXPIRED")), "protection ended", kind);
    assert.equal(g(kind, false, mine("NOT_PROCEEDING")), "lead trashed", kind);
    assert.equal(g(kind, false, mine("IN_REVIEW")), "claim inactive", kind);
    assert.equal(g(kind, false, null), "claim inactive", kind);
    assert.equal(g(kind, false, { ownedByPartner: false, effective: "ACTIVE" }), "claim inactive", kind);
  }
  assert.equal(g("CLAIM_OUTCOME", false, null), "claim missing");
  assert.equal(g("CLAIM_OUTCOME", false, { ownedByPartner: false, effective: "REJECTED" }), "claim missing");
});

test("stuck rows: only rows still at 'sending' and claimed over an hour ago are recovered", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  assert.equal(STUCK_SENDING_MS, 60 * 60_000);
  assert.deepEqual(stuckSendingWhere(now), { error: SENDING_MARK, sentAt: { lt: new Date("2026-10-20T11:00:00Z") } });
  assert.equal(SENDING_MARK, "sending");
});
