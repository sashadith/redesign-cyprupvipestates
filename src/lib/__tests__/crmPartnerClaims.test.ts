import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PARTNER_MESSAGE_MAX, PROTECTION_ACTIVE_ERROR, SAME_PARTNER_ACTIVE_ERROR, acceptDecision, buildCockpitPartnerCard, buildReviewCard, claimOutcomeRefKey, dealPartnerShare, messagePartnerLabel,
  messageRefKey, normaliseOutcomeNote, pickCardClaim, protectionStatus, readSubmission, validatePartnerMessage, type RawReviewClaim,
} from "@/lib/crm/partnerClaims";
import { computeDealAmounts } from "@/lib/crm/commission";
import { activeSince, effectiveClaimState } from "@/lib/partner/claimState";

const t = (iso: string) => new Date(iso);
const now = t("2026-10-18T12:00:00Z");

// ── outbox ref keys ─────────────────────────────────────────────────────────
test("outbox ref keys follow decision 10", () => {
  assert.equal(claimOutcomeRefKey("c1", "ACTIVE"), "claim:c1:ACTIVE");
  assert.equal(claimOutcomeRefKey("c1", "REJECTED"), "claim:c1:REJECTED");
  assert.equal(messageRefKey("m9"), "msg:m9");
});

// ── accept precondition ────────────────────────────────────────────────────
test("acceptDecision: no other ACTIVE claim → accept", () => {
  assert.deepEqual(acceptDecision({ other: null }), { kind: "ACCEPT" });
});

test("acceptDecision: other claim effectively active (protected or committed) → blocked", () => {
  assert.deepEqual(acceptDecision({ other: { samePartner: false, effective: "ACTIVE" } }), { kind: "BLOCKED", error: PROTECTION_ACTIVE_ERROR });
  // the same partner's live claim: a distinct message, never a second claim
  assert.deepEqual(acceptDecision({ other: { samePartner: true, effective: "ACTIVE" } }), { kind: "BLOCKED", error: SAME_PARTNER_ACTIVE_ERROR });
  assert.equal(acceptDecision({ other: { samePartner: false, effective: "NOT_PROCEEDING" } }).kind, "BLOCKED");
});

test("acceptDecision: other claim effectively expired → expire it, then accept — also the same partner's own lapsed claim", () => {
  assert.deepEqual(acceptDecision({ other: { samePartner: false, effective: "EXPIRED" } }), { kind: "EXPIRE_OTHER_THEN_ACCEPT" });
  assert.deepEqual(acceptDecision({ other: { samePartner: true, effective: "EXPIRED" } }), { kind: "EXPIRE_OTHER_THEN_ACCEPT" });
});

test("acceptDecision fed by effectiveClaimState: committed never expires; accepted known contact counts from review", () => {
  const eff = (o: Partial<Parameters<typeof effectiveClaimState>[0]>) => effectiveClaimState({
    state: "ACTIVE", activeSince: t("2026-01-10T00:00:00Z"), lastRealContactAt: null, now, leadDeleted: false, leadStatus: "OFFER", hasLiveDeal: false, ...o,
  });
  assert.equal(acceptDecision({ other: { samePartner: false, effective: eff({}) } }).kind, "EXPIRE_OTHER_THEN_ACCEPT");
  assert.equal(acceptDecision({ other: { samePartner: false, effective: eff({ hasLiveDeal: true }) } }).kind, "BLOCKED");
  for (const leadStatus of ["RESERVED", "CLOSED"]) {
    assert.equal(acceptDecision({ other: { samePartner: false, effective: eff({ leadStatus }) } }).kind, "BLOCKED", leadStatus);
  }
  // submitted a year ago, accepted last month → activeSince is the review date → still protected
  const since = activeSince({ createdAt: t("2025-10-01T00:00:00Z"), reviewedAt: t("2026-09-20T00:00:00Z") });
  assert.equal(acceptDecision({ other: { samePartner: false, effective: eff({ activeSince: since }) } }).kind, "BLOCKED");
});

test("protectionStatus: committed beats expiry; otherwise six months from max(activeSince, latest real contact)", () => {
  const since = t("2026-01-10T00:00:00Z");
  assert.deepEqual(protectionStatus({ activeSince: since, lastRealContactAt: null, now, hasDeal: false, leadStatus: "OFFER" }), { kind: "expired", until: t("2026-07-10T00:00:00Z") });
  assert.deepEqual(protectionStatus({ activeSince: since, lastRealContactAt: t("2026-06-01T00:00:00Z"), now, hasDeal: false, leadStatus: "OFFER" }), { kind: "protected", until: t("2026-12-01T00:00:00Z") });
  assert.equal(protectionStatus({ activeSince: since, lastRealContactAt: null, now, hasDeal: true, leadStatus: "OFFER" }).kind, "committed");
  assert.equal(protectionStatus({ activeSince: since, lastRealContactAt: null, now, hasDeal: false, leadStatus: "RESERVED" }).kind, "committed");
});

// ── partner share on deals ─────────────────────────────────────────────────
const shares = { handoverShare: 30, fixShare: 50 };
const live = (partnerId: string) => ({ partnerId, effective: "ACTIVE" as const });

test("dealPartnerShare: no partner or no effectively active claim of that partner → null", () => {
  assert.equal(dealPartnerShare({ partnerId: null, partnerMode: null, activeClaim: null, partner: null }), null);
  assert.equal(dealPartnerShare({ partnerId: "p1", partnerMode: "HANDOVER", activeClaim: null, partner: shares }), null);
  // an ACTIVE claim of a different partner never pays the lead's (stale) partner
  assert.equal(dealPartnerShare({ partnerId: "p1", partnerMode: "HANDOVER", activeClaim: live("p2"), partner: shares }), null);
  // the partner's own claim whose protection ran out (or trashed) earns nothing on a new deal
  assert.equal(dealPartnerShare({ partnerId: "p1", partnerMode: "HANDOVER", activeClaim: { partnerId: "p1", effective: "EXPIRED" }, partner: shares }), null);
  assert.equal(dealPartnerShare({ partnerId: "p1", partnerMode: "HANDOVER", activeClaim: { partnerId: "p1", effective: "NOT_PROCEEDING" }, partner: shares }), null);
});

test("dealPartnerShare: the move's own deal does not rescue a lapsed claim (state judged before the move)", () => {
  // before the move: no deal, lead in OFFER, protection run out → EXPIRED (the deal created by this move is not counted)
  const before = effectiveClaimState({
    state: "ACTIVE", activeSince: t("2026-01-10T00:00:00Z"), lastRealContactAt: null, now, leadDeleted: false, leadStatus: "OFFER", hasLiveDeal: false,
  });
  assert.equal(before, "EXPIRED");
  assert.equal(dealPartnerShare({ partnerId: "p1", partnerMode: "HANDOVER", activeClaim: { partnerId: "p1", effective: before }, partner: shares }), null);
  // an existing live deal before the move commits the claim → share
  const committed = effectiveClaimState({
    state: "ACTIVE", activeSince: t("2026-01-10T00:00:00Z"), lastRealContactAt: null, now, leadDeleted: false, leadStatus: "OFFER", hasLiveDeal: true,
  });
  assert.equal(dealPartnerShare({ partnerId: "p1", partnerMode: "HANDOVER", activeClaim: { partnerId: "p1", effective: committed }, partner: shares }), 30);
});

test("dealPartnerShare: mode picks the share; missing mode is a handover; suspended partners keep their share", () => {
  assert.equal(dealPartnerShare({ partnerId: "p1", partnerMode: "FIX", activeClaim: live("p1"), partner: shares }), 50);
  assert.equal(dealPartnerShare({ partnerId: "p1", partnerMode: "HANDOVER", activeClaim: live("p1"), partner: shares }), 30);
  assert.equal(dealPartnerShare({ partnerId: "p1", partnerMode: null, activeClaim: live("p1"), partner: shares }), 30);
  assert.equal(dealPartnerShare({ partnerId: "p1", partnerMode: "FIX", activeClaim: live("p1"), partner: { ...shares, status: "SUSPENDED" } }), 50);
});

test("deal amounts with the partner share; a missing rate leaves the partner commission open", () => {
  const share = dealPartnerShare({ partnerId: "p1", partnerMode: "HANDOVER", activeClaim: live("p1"), partner: shares });
  assert.deepEqual(computeDealAmounts({ price: 300_000, ourRatePercent: 5, partnerSharePercent: share }), { ourCommission: 15_000, partnerCommission: 4_500 });
  assert.deepEqual(computeDealAmounts({ price: 300_000, ourRatePercent: null, partnerSharePercent: share }), { ourCommission: null, partnerCommission: null });
});

// ── message + note validation ──────────────────────────────────────────────
test("validatePartnerMessage trims, rejects empty and over-long text", () => {
  assert.deepEqual(validatePartnerMessage("  Viewing on Friday  "), { ok: true, body: "Viewing on Friday" });
  assert.equal(validatePartnerMessage("   ").ok, false);
  assert.equal(validatePartnerMessage(42).ok, false);
  assert.equal(validatePartnerMessage("x".repeat(PARTNER_MESSAGE_MAX)).ok, true);
  assert.equal(validatePartnerMessage("x".repeat(PARTNER_MESSAGE_MAX + 1)).ok, false);
});

test("normaliseOutcomeNote: blank → null, long text capped", () => {
  assert.equal(normaliseOutcomeNote("  "), null);
  assert.equal(normaliseOutcomeNote(undefined), null);
  assert.equal(normaliseOutcomeNote(" known client "), "known client");
  assert.equal(normaliseOutcomeNote("y".repeat(5000))!.length, 1000);
});

test("readSubmission tolerates odd JSON", () => {
  assert.deepEqual(readSubmission(null), { firstName: "", lastName: "", email: null, phone: null, repName: null, repPhone: null, projects: null, comment: null });
  const s = readSubmission({ firstName: " Anna ", projects: [{ id: "d1", name: "Sea View" }, { id: "d2" }, "bad"], projectsText: "something in Paphos", email: 5 });
  assert.equal(s.firstName, "Anna");
  assert.equal(s.email, null);
  assert.equal(s.projects, "Sea View, something in Paphos");
});

// ── review card DTO ────────────────────────────────────────────────────────
const partner = (id: string, company: string | null = null) => ({ id, company, firstName: "Max", lastName: id.toUpperCase(), status: "ACTIVE" });

function raw(over: Partial<RawReviewClaim["lead"]> = {}): RawReviewClaim {
  return {
    id: "c-new", createdAt: t("2026-10-17T09:00:00Z"), mode: "FIX", contactMode: "VIA_PARTNER_REP",
    submission: {
      firstName: "Anna", lastName: "Berg", email: "anna@example.com", phone: "+357 99 000000", mode: "FIX",
      projects: [{ id: "d1", name: "Sea View" }], projectsText: null, repName: "Ivan", repPhone: "+49 1", comment: "Wants 2 beds",
    },
    partner: partner("p1", "Acme Realty"),
    lead: {
      id: "lead-1", firstName: "Anna", lastName: "Berg-Old", email: "anna@example.com", phone: null, status: "VIEWING_SCHEDULED", source: "CONTACT_FORM",
      createdAt: t("2026-03-01T00:00:00Z"), deletedAt: null, ownerName: "Eleni", hasDeal: false, lastRealContactAt: t("2026-09-01T00:00:00Z"),
      claims: [
        { id: "c-old", state: "ACTIVE", mode: "HANDOVER", createdAt: t("2026-02-01T00:00:00Z"), partner: partner("p2") },
        { id: "c-new", state: "IN_REVIEW", mode: "FIX", createdAt: t("2026-10-17T09:00:00Z"), partner: partner("p1", "Acme Realty") },
      ],
      ...over,
    },
  };
}

test("buildReviewCard: submission vs our lead, other claims with protection, accept blocked while protected", () => {
  const c = buildReviewCard(raw(), now);
  assert.equal(c.partner, "Acme Realty (Max P1)");
  assert.deepEqual(c.submission, {
    name: "Anna Berg", email: "anna@example.com", phone: "+357 99 000000", mode: "Fix", contactMode: "Via the partner's representative",
    rep: "Ivan · +49 1", projects: "Sea View", comment: "Wants 2 beds",
  });
  assert.equal(c.lead.owner, "Eleni");
  assert.equal(c.lead.stage, "Viewing scheduled");
  assert.equal(c.lead.source, "Website");
  assert.equal(c.lead.lastRealContact, "2026-09-01T00:00:00.000Z");
  // the card's own claim is not listed among the others
  assert.deepEqual(c.others.map((o) => o.id), ["c-old"]);
  assert.match(c.others[0].protection ?? "", /^Protected until /);
  assert.deepEqual(c.accept, { blocked: true, note: PROTECTION_ACTIVE_ERROR });
});

test("buildReviewCard: expired other claim → accept allowed with a note; committed lead → blocked; trash → blocked", () => {
  const expired = buildReviewCard(raw({ lastRealContactAt: null }), now);
  assert.match(expired.others[0].protection ?? "", /^Protection expired /);
  assert.equal(expired.accept.blocked, false);
  assert.ok(expired.accept.note);

  const committed = buildReviewCard(raw({ lastRealContactAt: null, status: "RESERVED" }), now);
  assert.equal(committed.others[0].protection, "Secured — reserved, closed or a live deal");
  assert.equal(committed.accept.blocked, true);

  const trashed = buildReviewCard(raw({ deletedAt: t("2026-10-01T00:00:00Z"), claims: [] }), now);
  assert.equal(trashed.lead.trashed, true);
  assert.equal(trashed.accept.blocked, true);

  const free = buildReviewCard(raw({ claims: [] }), now);
  assert.deepEqual(free.accept, { blocked: false, note: null });
  assert.deepEqual(free.others, []);
});

test("buildReviewCard: non-ACTIVE other claims carry no protection line", () => {
  const c = buildReviewCard(raw({ claims: [{ id: "c-x", state: "REJECTED", mode: "HANDOVER", createdAt: t("2026-05-01T00:00:00Z"), partner: partner("p3") }] }), now);
  assert.equal(c.others[0].state, "Rejected");
  assert.equal(c.others[0].protection, null);
  assert.equal(c.accept.blocked, false);
});

test("buildReviewCard: the same partner's own claim — live blocks with its own message, lapsed is replaced", () => {
  const own = (lastRealContactAt: Date | null) => raw({
    lastRealContactAt,
    claims: [{ id: "c-own", state: "ACTIVE", mode: "HANDOVER", createdAt: t("2026-02-01T00:00:00Z"), partner: partner("p1", "Acme Realty") }],
  });
  assert.deepEqual(buildReviewCard(own(t("2026-09-01T00:00:00Z")), now).accept, { blocked: true, note: SAME_PARTNER_ACTIVE_ERROR });
  assert.equal(buildReviewCard(own(null), now).accept.blocked, false);
});

test("buildReviewCard: an accepted known contact's protection runs from the review, not the submission", () => {
  const c = buildReviewCard(raw({
    lastRealContactAt: null,
    claims: [{ id: "c-old", state: "ACTIVE", mode: "HANDOVER", createdAt: t("2025-09-01T00:00:00Z"), reviewedAt: t("2026-09-01T00:00:00Z"), partner: partner("p2") }],
  }), now);
  assert.match(c.others[0].protection ?? "", /^Protected until /);
  assert.equal(c.accept.blocked, true);
});

test("messagePartnerLabel: company, else the person", () => {
  assert.equal(messagePartnerLabel({ company: " Acme ", firstName: "Max", lastName: "Muster" }), "Acme");
  assert.equal(messagePartnerLabel({ company: null, firstName: "Max", lastName: "Muster" }), "Max Muster");
  assert.equal(messagePartnerLabel({ company: "", firstName: "", lastName: "" }), "Partner");
});

// ── cockpit partner card ───────────────────────────────────────────────────
const ck = (id: string, state: "ACTIVE" | "IN_REVIEW" | "REJECTED" | "EXPIRED", createdAt: string) => ({
  id, state, mode: "HANDOVER" as const, contactMode: "DIRECT", createdAt: t(createdAt), submission: { repName: "Sub Rep" },
  partner: { ...partner(id), type: "BANK" },
});
const leadCtx = { status: "OFFER", hasDeal: false, lastRealContactAt: null, contactRepName: "Lead Rep", contactRepPhone: null };

test("pickCardClaim prefers ACTIVE, else the newest decided claim, never IN_REVIEW", () => {
  assert.equal(pickCardClaim([ck("a", "REJECTED", "2026-01-01T00:00:00Z"), ck("b", "ACTIVE", "2025-01-01T00:00:00Z")])?.id, "b");
  assert.equal(pickCardClaim([ck("a", "REJECTED", "2026-01-01T00:00:00Z"), ck("b", "EXPIRED", "2026-05-01T00:00:00Z")])?.id, "b");
  assert.equal(pickCardClaim([ck("a", "IN_REVIEW", "2026-01-01T00:00:00Z")]), null);
});

test("buildCockpitPartnerCard: null without claims; ACTIVE card uses the lead's rep and protection; in-review listed apart", () => {
  assert.equal(buildCockpitPartnerCard({ claims: [], lead: leadCtx, now }), null);
  const v = buildCockpitPartnerCard({ claims: [ck("act", "ACTIVE", "2026-09-01T00:00:00Z"), ck("rev", "IN_REVIEW", "2026-10-10T00:00:00Z")], lead: leadCtx, now })!;
  assert.equal(v.hasActive, true);
  assert.equal(v.card?.type, "Bank");
  assert.equal(v.card?.rep, "Lead Rep");
  assert.equal(v.card?.state, "Active");
  assert.match(v.card?.protection ?? "", /^Protected until /);
  assert.deepEqual(v.inReview.map((r) => r.id), ["rev"]);

  const onlyReview = buildCockpitPartnerCard({ claims: [ck("rev", "IN_REVIEW", "2026-10-10T00:00:00Z")], lead: leadCtx, now })!;
  assert.equal(onlyReview.card, null);
  assert.equal(onlyReview.hasActive, false);

  const rejected = buildCockpitPartnerCard({ claims: [ck("rej", "REJECTED", "2026-10-10T00:00:00Z")], lead: leadCtx, now })!;
  assert.equal(rejected.card?.rep, "Sub Rep");
  assert.equal(rejected.card?.protection, null);
  assert.equal(rejected.hasActive, false);
});

test("buildCockpitPartnerCard: an ACTIVE claim whose protection ran out cannot be messaged; committed or recently reviewed can", () => {
  const old = ck("act", "ACTIVE", "2025-09-01T00:00:00Z");
  const lapsed = buildCockpitPartnerCard({ claims: [old], lead: leadCtx, now })!;
  assert.equal(lapsed.card?.state, "Active");
  assert.match(lapsed.card?.protection ?? "", /^Protection expired /);
  assert.equal(lapsed.hasActive, false);
  assert.equal(buildCockpitPartnerCard({ claims: [old], lead: { ...leadCtx, hasDeal: true }, now })!.hasActive, true);
  assert.equal(buildCockpitPartnerCard({ claims: [{ ...old, reviewedAt: t("2026-09-01T00:00:00Z") }], lead: leadCtx, now })!.hasActive, true);
});
