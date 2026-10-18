import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLIENT_FILTERS, activeClaimsWhere, claimWhere, classifyClaim, clientsWhere, commissionTotals, dealView, formatResponse,
  latestMilestones, matchesQuery, messagesWhere, overviewCountWheres, parseClientFilter, publicProjectUrl, submissionView,
  toClientDetail, toListItem, visibleName, type Activity, type RawClaim, type RawDeal, type RawMessage,
} from "@/lib/partner/clientDto";
import { PARTNER_LOCALES, lookup } from "@/lib/partner/i18n";

const P = "partner-1";
const OTHER = "partner-2";
const t = (iso: string) => new Date(iso);
const claimAt = t("2026-05-01T10:00:00Z");
const now = t("2026-06-01T00:00:00Z");

// ── (a) where-builders always carry the partnerId ───────────────────────────
test("every where-builder includes the partnerId at the top level", () => {
  for (const f of CLIENT_FILTERS) assert.equal(clientsWhere(P, f).partnerId, P, f);
  assert.deepEqual(claimWhere(P, "c1"), { id: "c1", partnerId: P });
  assert.equal(messagesWhere(P, ["l1"]).partnerId, P);
  assert.equal(activeClaimsWhere(P).partnerId, P);
  for (const w of Object.values(overviewCountWheres(P))) assert.equal(w.partnerId, P);
});
test("where-builders refuse an empty partnerId", () => {
  assert.throws(() => clientsWhere("", "all"));
  assert.throws(() => claimWhere(" ", "c1"));
  assert.throws(() => messagesWhere("", []));
  assert.throws(() => overviewCountWheres(""));
});

// ── fixtures with everything a partner must NOT see ─────────────────────────
const SECRETS = [
  "lead-secret@example.com", "+35799000111", "internal note text", "call body secret", "whatsapp body secret",
  "ourCommission", "ourRatePercent", "99999", "other partner message", "outcome note secret", "lostNote secret",
  "Leadname", "Crmstored",
];

const leadWithSecrets = {
  status: "VIEWING_SCHEDULED",
  lostReason: null,
  // The CRM lead's stored name differs from what the partner typed (accepted duplicate): never shown.
  firstName: "Leadname",
  lastName: "Crmstored",
  deletedAt: null,
  email: "lead-secret@example.com",
  phone: "+35799000111",
  notes: "internal note text",
  lostNote: "lostNote secret",
  assignedTo: { name: "Maria Advisor", email: "maria@cve.example", phone: "+35722000000", isActive: true, passwordHash: "x" },
};

function activeClaim(over: Partial<RawClaim> = {}): RawClaim {
  return {
    id: "claim-1",
    partnerId: P,
    leadId: "lead-1",
    state: "ACTIVE",
    createdAt: claimAt,
    submission: { firstName: "Anna", lastName: "Schmidt", email: "anna@partner-typed.example", phone: "+4911111", projects: [{ id: "d1", name: "Sea View" }] },
    lead: leadWithSecrets as unknown as RawClaim["lead"],
    outcomeNote: "outcome note secret",
    ...over,
  } as RawClaim;
}

const deal = (over: Partial<RawDeal> & Record<string, unknown> = {}): RawDeal =>
  ({
    id: "deal-1", leadId: "lead-1", createdAt: t("2026-05-20T00:00:00Z"), projectName: "Sea View", unitLabel: "A12", price: 300000,
    partnerCommission: 4500, rateSource: "PROJECT", commissionStatus: "EARNED", expectedAt: t("2026-05-20T00:00:00Z"),
    earnedAt: t("2026-05-25T00:00:00Z"), developerPaidAt: null, paidOutAt: null, cancelledAt: null,
    ourCommission: 99999, ourRatePercent: 5, ...over,
  }) as RawDeal;

const interactionsWithBodies = [
  { type: "STATUS_CHANGE", occurredAt: t("2026-05-03T00:00:00Z"), metadata: { toStatus: "VIEWING_SCHEDULED", note: "internal note text" }, body: "call body secret" },
  { type: "CALL", occurredAt: t("2026-05-01T10:42:00Z"), metadata: null, body: "call body secret" },
  { type: "WHATSAPP_IN", occurredAt: t("2026-05-02T00:00:00Z"), metadata: null, body: "whatsapp body secret" },
];

const messages: RawMessage[] = [
  { leadId: "lead-1", partnerId: P, createdAt: t("2026-05-04T00:00:00Z"), body: "Viewing went well" },
  { leadId: "lead-1", partnerId: OTHER, createdAt: t("2026-05-05T00:00:00Z"), body: "other partner message" },
  { leadId: "lead-2", partnerId: P, createdAt: t("2026-05-05T00:00:00Z"), body: "other partner message" },
];

const ctx = () => ({
  partnerId: P,
  activity: new Map<string, Activity>([["lead-1", {
    events: interactionsWithBodies.filter((i) => i.type === "STATUS_CHANGE") as never[],
    firstRealContactAt: t("2026-05-01T10:42:00Z"),
    lastRealContactAt: t("2026-05-02T00:00:00Z"),
    firstOutboundAt: t("2026-05-01T10:42:00Z"),
  }]]),
  deals: [deal(), deal({ id: "deal-2", leadId: "lead-9" })],
  messages,
  office: { email: "office@cve.example", phone: "+357 1" },
  now,
});

const noSecrets = (o: unknown) => {
  const json = JSON.stringify(o);
  for (const s of SECRETS) assert.ok(!json.includes(s), `DTO leaks "${s}": ${json}`);
};

// ── (b) mappers drop everything private ─────────────────────────────────────
test("detail DTO of an ACTIVE claim carries no lead contact data, bodies, our commission or other partners' messages", () => {
  const d = toClientDetail(activeClaim(), ctx());
  noSecrets(d);
  assert.equal(d.kind, "active");
  if (d.kind !== "active") return;
  assert.equal(d.name, "Anna Schmidt");
  assert.deepEqual(d.contact, { kind: "owner", name: "Maria Advisor", email: "maria@cve.example", phone: "+35722000000" });
  assert.equal(d.deals.length, 1, "deal of another lead is not shown");
  assert.equal(d.deals[0].commission, 4500);
  assert.deepEqual(Object.keys(d.deals[0]).sort(), ["commission", "id", "price", "project", "status", "statusAt", "unit"]);
  const bodies = d.milestones.filter((m) => m.body).map((m) => m.body);
  assert.deepEqual(bodies, ["Viewing went well"]);
  assert.deepEqual(d.response, { unit: "min", n: 42 });
  assert.equal(d.protection.until.toISOString(), "2026-11-02T00:00:00.000Z");
  assert.equal(d.stage.step, 4);
});
test("list DTO carries no lead contact data and only this claim's commission", () => {
  const item = toListItem(activeClaim(), ctx());
  noSecrets(item);
  assert.equal(item.chipKey, "stages.viewing");
  assert.equal(item.contactName, "Maria Advisor");
  assert.deepEqual(item.commission, { EXPECTED: 0, EARNED: 4500, DEVELOPER_PAID: 0, PAID_OUT: 0 });
  assert.equal(item.lastUpdateAt?.toISOString(), "2026-05-25T00:00:00.000Z", "commission earned is the latest milestone");
  assert.ok(!JSON.stringify(item).includes("maria@cve.example"), "list shows only the contact name");
});
test("mappers refuse a claim of another partner", () => {
  assert.throws(() => toClientDetail(activeClaim({ partnerId: OTHER }), ctx()));
  assert.throws(() => toListItem(activeClaim({ partnerId: OTHER }), ctx()));
  assert.throws(() => latestMilestones([activeClaim({ partnerId: OTHER })], ctx()));
});
test("events before the claim are ignored; inactive owner falls back to the office, none to 'being assigned'", () => {
  const c = ctx();
  c.activity.get("lead-1")!.events = [{ type: "STATUS_CHANGE", occurredAt: t("2026-04-01T00:00:00Z"), metadata: { toStatus: "OFFER" } }] as never[];
  c.activity.get("lead-1")!.firstRealContactAt = t("2026-04-01T00:00:00Z");
  c.activity.get("lead-1")!.firstOutboundAt = t("2026-04-01T00:00:00Z");
  const lead = { ...leadWithSecrets, assignedTo: { ...leadWithSecrets.assignedTo, isActive: false } };
  const d = toClientDetail(activeClaim({ lead: lead as never }), { ...c, deals: [], messages: [] });
  assert.equal(d.kind, "active");
  if (d.kind !== "active") return;
  assert.deepEqual(d.milestones, []);
  assert.equal(d.response, null);
  assert.deepEqual(d.contact, { kind: "office", email: "office@cve.example", phone: "+357 1" });
  const d2 = toClientDetail(activeClaim({ lead: { ...lead, assignedTo: null } as never }), { ...c, office: null });
  assert.equal(d2.kind === "active" && d2.contact.kind, "pending");
});
test("lost leads show the neutral category only", () => {
  const lead = { ...leadWithSecrets, status: "LOST", lostReason: "BOUGHT_ELSEWHERE" };
  const d = toClientDetail(activeClaim({ lead: lead as never }), ctx());
  assert.equal(d.kind === "active" && d.lostKey, "lost.other_choice");
  noSecrets(d);
});
test("deal without a rate or partner commission is 'being calculated'; status date follows the status", () => {
  assert.equal(dealView(deal({ rateSource: "MISSING" })).commission, null);
  assert.equal(dealView(deal({ partnerCommission: null })).commission, null);
  assert.equal(dealView(deal({ commissionStatus: "PAID_OUT", paidOutAt: t("2026-07-01T00:00:00Z") })).statusAt?.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.equal(dealView(deal({ commissionStatus: "EXPECTED" })).statusAt?.toISOString(), "2026-05-20T00:00:00.000Z");
});
test("overview milestones carry no message bodies and no lead contact data", () => {
  const m = latestMilestones([activeClaim()], ctx(), 5);
  noSecrets(m);
  assert.ok(!JSON.stringify(m).includes("Viewing went well"));
  assert.ok(m.length <= 5 && m.length > 0);
  assert.equal(m[0].claimId, "claim-1");
});

// ── (c) non-ACTIVE claims expose only the submission ────────────────────────
test("non-ACTIVE detail exposes only submission fields and a state message", () => {
  for (const state of ["IN_REVIEW", "REJECTED", "EXPIRED"] as const) {
    const row = activeClaim({
      state,
      submission: {
        firstName: "Typed", lastName: "Name", email: "typed@partner.example", phone: "+4922222", mode: "HANDOVER",
        contactMode: "DIRECT", projects: [{ id: "d1", name: "Sea View", secret: "internal note text" }], injected: "call body secret",
      },
    });
    const d = toClientDetail(row, ctx());
    noSecrets(d);
    assert.equal(d.kind, "submission");
    assert.deepEqual(Object.keys(d).sort(), ["chipKey", "id", "kind", "name", "state", "stateKey", "submission", "submittedAt"]);
    assert.equal(d.name, "Typed Name");
    assert.ok(!JSON.stringify(d).includes("Maria Advisor"));
    assert.ok(!JSON.stringify(d).includes("Anna"));
    assert.deepEqual(d.submission.projects, ["Sea View"]);
    const item = toListItem(row, ctx());
    noSecrets(item);
    assert.equal(item.name, "Typed Name");
    assert.equal(item.contactName, null);
    assert.equal(item.commission, null);
    assert.equal(item.lastUpdateAt, null);
  }
  const keys = (s: string) => toClientDetail(activeClaim({ state: s as never }), ctx());
  assert.equal(keys("IN_REVIEW").kind === "submission" && (keys("IN_REVIEW") as { stateKey: string }).stateKey, "clients.stateReview");
});
test("submissionView whitelists fields and types", () => {
  const v = submissionView({ firstName: "A", budgetMin: "100", mode: "X", contactMode: "VIA_PARTNER", extra: 1 });
  assert.deepEqual(Object.keys(v).sort(), [
    "budgetMax", "budgetMin", "comment", "contactMode", "email", "firstName", "language", "lastName", "mode", "phone", "projects",
    "projectsText", "repName", "repPhone",
  ]);
  assert.equal(v.budgetMin, null);
  assert.equal(v.mode, null);
  assert.equal(v.contactMode, "VIA_PARTNER");
  assert.equal(submissionView(null).firstName, "");
});

// ── filters, search, response time ──────────────────────────────────────────
test("classifyClaim splits active / closed / lost", () => {
  assert.equal(classifyClaim("IN_REVIEW", null), "active");
  assert.equal(classifyClaim("ACTIVE", "OFFER"), "active");
  assert.equal(classifyClaim("ACTIVE", "KEEP_CONTACT"), "active");
  assert.equal(classifyClaim("ACTIVE", "CLOSED"), "closed");
  assert.equal(classifyClaim("ACTIVE", "LOST"), "lost");
  assert.equal(classifyClaim("REJECTED", null), "lost");
  assert.equal(classifyClaim("EXPIRED", "CLOSED"), "lost");
});
test("filter where-clauses match the classification", () => {
  const json = (f: (typeof CLIENT_FILTERS)[number]) => JSON.stringify(clientsWhere(P, f, now));
  assert.deepEqual(clientsWhere(P, "all", now), { partnerId: P });
  // live ACTIVE claims: lead not trashed, protection cutoff 6 months before now
  for (const f of ["active", "closed"] as const) {
    assert.ok(json(f).includes('"deletedAt":null'), f);
    assert.ok(json(f).includes('"gte":"2025-12-01T00:00:00.000Z"'), f);
  }
  assert.ok(json("active").includes('"IN_REVIEW"'));
  assert.ok(json("closed").includes('"status":"CLOSED"'));
  const lost = clientsWhere(P, "lost", now).OR as object[];
  assert.deepEqual(lost[0], { state: { in: ["REJECTED", "EXPIRED"] } });
  assert.ok(JSON.stringify(lost).includes('"status":"LOST"'));
  assert.ok(JSON.stringify(lost).includes('"none"'), "expired-protection ACTIVE claims are lost");
  assert.ok(JSON.stringify(lost).includes('"deletedAt":{"not":null}'), "trashed leads are lost");
  for (const w of Object.values(overviewCountWheres(P, now)).filter((x) => !("state" in x)))
    assert.ok(JSON.stringify(w).includes('"deletedAt":null'), "KPIs exclude trashed leads");
  assert.equal(parseClientFilter("lost"), "lost");
  assert.equal(parseClientFilter("LOST"), null);
  assert.equal(parseClientFilter(undefined), null);
});
test("ACTIVE claim with expired protection is shown like EXPIRED: submission only, no stage/deals/messages", () => {
  const old = activeClaim({ createdAt: t("2025-01-01T00:00:00Z") });
  const c = { ...ctx(), activity: new Map([["lead-1", {
    events: [{ type: "STATUS_CHANGE", occurredAt: t("2025-01-05T00:00:00Z"), metadata: { toStatus: "OFFER" } }] as never[],
    firstRealContactAt: t("2025-01-02T00:00:00Z"), lastRealContactAt: t("2025-02-01T00:00:00Z"), firstOutboundAt: t("2025-01-02T00:00:00Z"),
  }]]), deals: [deal({ createdAt: t("2025-01-10T00:00:00Z") })], messages: [{ leadId: "lead-1", partnerId: P, createdAt: t("2025-01-06T00:00:00Z"), body: "Viewing went well" }] };
  const d = toClientDetail(old, c);
  assert.equal(d.kind, "submission");
  assert.equal(d.state, "EXPIRED");
  assert.equal(d.chipKey, "clients.chipExpired");
  assert.equal(d.kind === "submission" && d.stateKey, "clients.stateExpired");
  noSecrets(d);
  assert.ok(!JSON.stringify(d).includes("Viewing went well") && !JSON.stringify(d).includes("Maria Advisor"));
  const item = toListItem(old, c);
  assert.equal(item.state, "EXPIRED");
  assert.equal(item.category, "lost");
  assert.equal(item.commission, null);
  assert.equal(item.contactName, null);
  assert.deepEqual(latestMilestones([old], c), []);
  // a recent real contact keeps it protected
  c.activity.get("lead-1")!.lastRealContactAt = t("2026-03-01T00:00:00Z");
  assert.equal(toClientDetail(old, c).kind, "active");
});
test("soft-deleted lead behind an ACTIVE claim reads as neutral 'Not proceeding' with no details", () => {
  const trashed = activeClaim({ lead: { ...leadWithSecrets, deletedAt: t("2026-05-10T00:00:00Z") } as never });
  const d = toClientDetail(trashed, ctx());
  assert.equal(d.kind, "submission");
  assert.equal(d.state, "NOT_PROCEEDING");
  assert.equal(d.chipKey, "clients.chipNotProceeding");
  assert.equal(d.kind === "submission" && d.stateKey, "clients.stateNotProceeding");
  noSecrets(d);
  assert.ok(!JSON.stringify(d).includes("Maria Advisor"));
  const item = toListItem(trashed, ctx());
  assert.equal(item.category, "lost");
  assert.equal(item.chipKey, "clients.chipNotProceeding");
  assert.deepEqual(latestMilestones([trashed], ctx()), []);
  assert.equal(classifyClaim("NOT_PROCEEDING", "OFFER"), "lost");
});
test("response time counts only outbound first contact; protection keeps inbound contacts", () => {
  const c = ctx();
  const a = c.activity.get("lead-1")!;
  a.firstRealContactAt = t("2026-05-01T10:05:00Z"); // client wrote first (WHATSAPP_IN)
  a.firstOutboundAt = t("2026-05-01T11:55:00Z"); // our call
  a.lastRealContactAt = t("2026-05-20T00:00:00Z"); // inbound email
  const d = toClientDetail(activeClaim(), c);
  assert.equal(d.kind, "active");
  if (d.kind !== "active") return;
  assert.deepEqual(d.response, { unit: "h", n: 2 });
  assert.equal(d.protection.until.toISOString(), "2026-11-20T00:00:00.000Z");
  assert.ok(d.milestones.some((m) => m.key === "milestones.firstContact" && m.at.toISOString() === "2026-05-01T10:05:00.000Z"));
  a.firstOutboundAt = null;
  const d2 = toClientDetail(activeClaim(), c);
  assert.equal(d2.kind === "active" && d2.response, null, "no outbound contact yet → no response time");
});
test("search uses the partner-visible name, case- and accent-insensitive", () => {
  const active = activeClaim({ submission: { firstName: "Typed" } });
  assert.equal(visibleName(active), "Typed", "ACTIVE claims also show the submitted name, not the CRM lead's");
  assert.equal(visibleName({ ...active, state: "IN_REVIEW" } as RawClaim), "Typed");
  assert.equal(toListItem(active, ctx()).name, "Typed");
  assert.ok(matchesQuery("Zoë Müller", "zoe mul"));
  assert.ok(matchesQuery("Anna Schmidt", "  SCHMIDT "));
  assert.ok(!matchesQuery("Anna Schmidt", "anna x"));
  assert.ok(matchesQuery("Anna", ""));
});
test("response time: minutes, hours, days", () => {
  assert.deepEqual(formatResponse(0), { unit: "min", n: 0 });
  assert.deepEqual(formatResponse(42), { unit: "min", n: 42 });
  assert.deepEqual(formatResponse(60), { unit: "h", n: 1 });
  assert.deepEqual(formatResponse(150), { unit: "h", n: 3 });
  assert.deepEqual(formatResponse(47 * 60 + 59), { unit: "h", n: 48 });
  assert.deepEqual(formatResponse(48 * 60), { unit: "d", n: 2 });
  assert.deepEqual(formatResponse(10 * 1440 + 100), { unit: "d", n: 10 });
  assert.equal(formatResponse(null), null);
  assert.equal(formatResponse(-5), null);
});
test("commission totals per stage leave out cancelled and uncalculated deals", () => {
  assert.deepEqual(
    commissionTotals([
      { commissionStatus: "EXPECTED", partnerCommission: 1000 },
      { commissionStatus: "EXPECTED", partnerCommission: 500 },
      { commissionStatus: "PAID_OUT", partnerCommission: 200 },
      { commissionStatus: "CANCELLED", partnerCommission: 9000 },
      { commissionStatus: "EARNED", partnerCommission: null },
    ]),
    { EXPECTED: 1500, EARNED: 0, DEVELOPER_PAID: 0, PAID_OUT: 200 },
  );
});
test("public project URL: en without prefix, no slug no link", () => {
  assert.equal(publicProjectUrl("en", "sea-view"), "https://cyprusvipestates.com/projects/sea-view");
  assert.equal(publicProjectUrl("de", "sea-view"), "https://cyprusvipestates.com/de/projects/sea-view");
  assert.equal(publicProjectUrl("ru", null), null);
});
test("every dictionary key the DTOs produce exists in all locales", () => {
  const keys = [
    "clients.chipReview", "clients.chipRejected", "clients.chipExpired", "clients.stateReview", "clients.stateRejected",
    "clients.stateExpired", "clients.responseMin", "clients.responseHours", "clients.responseDays",
    "lost.budget", "lost.timing", "lost.other_choice", "lost.unreachable", "lost.other",
    "commission.EXPECTED", "commission.EARNED", "commission.DEVELOPER_PAID", "commission.PAID_OUT", "commission.CANCELLED",
  ];
  for (const l of PARTNER_LOCALES) for (const k of keys) assert.ok(lookup(l, k), `${l} ${k}`);
});
