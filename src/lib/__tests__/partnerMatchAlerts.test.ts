import { test } from "node:test";
import assert from "node:assert/strict";
import { planMatchAlerts, MATCH_TOLERANCE, MAX_ALERTS_PER_CLAIM, type MatchClaim, type MatchChange } from "@/lib/partner/matchAlerts";

const LIM = { district: "Limassol", town: "Limassol", area: "Germasogeia" };
const PAF = { district: "Paphos", town: "Paphos", area: "Kato Paphos" };

function claim(over: Partial<MatchClaim> = {}): MatchClaim {
  return {
    claimId: "c1", partnerId: "p1", leadId: "l1", budgetMin: 200_000, budgetMax: 400_000,
    projects: [{ developmentId: "d-own", ...LIM }], interest: null, ...over,
  };
}
function change(over: Partial<MatchChange> = {}): MatchChange {
  return { type: "published", developmentId: "d-own", name: "Own Project", location: LIM, price: 300_000, url: "https://x/en/projects/own", ...over };
}
const today = "2026-10-18";

test("own project within budget matches; refKey and payload shape", () => {
  const out = planMatchAlerts({ claims: [claim()], changes: [change()], today });
  assert.equal(out.length, 1);
  assert.deepEqual(out[0], {
    claimId: "c1", partnerId: "p1", leadId: "l1", developmentId: "d-own",
    refKey: "match:c1:d-own:2026-10-18",
    payload: { projectName: "Own Project", changeType: "published", priceFrom: 300_000, url: "https://x/en/projects/own" },
  });
});

test("tolerance: exactly +10% on the max matches, just above does not", () => {
  assert.equal(MATCH_TOLERANCE, 0.1);
  assert.equal(planMatchAlerts({ claims: [claim()], changes: [change({ price: 440_000 })], today }).length, 1);
  assert.equal(planMatchAlerts({ claims: [claim()], changes: [change({ price: 440_001 })], today }).length, 0);
});

test("below min does not match; min is not widened", () => {
  assert.equal(planMatchAlerts({ claims: [claim()], changes: [change({ price: 199_999 })], today }).length, 0);
  assert.equal(planMatchAlerts({ claims: [claim()], changes: [change({ price: 200_000 })], today }).length, 1);
});

test("missing min → 0; missing max → no upper bound; no budget → none", () => {
  assert.equal(planMatchAlerts({ claims: [claim({ budgetMin: null })], changes: [change({ price: 10_000 })], today }).length, 1);
  assert.equal(planMatchAlerts({ claims: [claim({ budgetMax: null })], changes: [change({ price: 9_000_000 })], today }).length, 1);
  assert.equal(planMatchAlerts({ claims: [claim({ budgetMin: null, budgetMax: null })], changes: [change()], today }).length, 0);
});

test("null price never matches", () => {
  assert.equal(planMatchAlerts({ claims: [claim()], changes: [change({ price: null })], today }).length, 0);
});

test("price changes: decrease only", () => {
  for (const type of ["price_from_changed", "unit_price_changed"] as const) {
    assert.equal(planMatchAlerts({ claims: [claim()], changes: [change({ type, price: 300_000, previousPrice: 320_000 })], today }).length, 1, type);
    assert.equal(planMatchAlerts({ claims: [claim()], changes: [change({ type, price: 300_000, previousPrice: 280_000 })], today }).length, 0, type);
    assert.equal(planMatchAlerts({ claims: [claim()], changes: [change({ type, price: 300_000, previousPrice: 300_000 })], today }).length, 0, type);
    assert.equal(planMatchAlerts({ claims: [claim()], changes: [change({ type, price: 300_000 })], today }).length, 0, type);
  }
});

test("other change types are ignored", () => {
  for (const type of ["sold_out", "availability_changed", "unit_status_changed"]) {
    assert.equal(planMatchAlerts({ claims: [claim()], changes: [change({ type: type as MatchChange["type"] })], today }).length, 0, type);
  }
  for (const type of ["new_units", "back_on_market"] as const) {
    assert.equal(planMatchAlerts({ claims: [claim()], changes: [change({ type })], today }).length, 1, type);
  }
});

test("location fallback: same district as an own project matches; other district does not", () => {
  const near = change({ developmentId: "d-near", name: "Near", location: { district: "Limassol", town: "Limassol", area: "Agios Tychonas" } });
  const far = change({ developmentId: "d-far", name: "Far", location: PAF });
  const out = planMatchAlerts({ claims: [claim()], changes: [near, far], today });
  assert.deepEqual(out.map((o) => o.developmentId), ["d-near"]);
});

test("no projects: the interest development's location is used; neither → none", () => {
  const near = change({ developmentId: "d-near", location: { district: "Paphos", town: "Paphos", area: "Peyia" } });
  assert.equal(planMatchAlerts({ claims: [claim({ projects: [], interest: { developmentId: "d-int", ...PAF } })], changes: [near], today }).length, 1);
  assert.equal(planMatchAlerts({ claims: [claim({ projects: [], interest: { developmentId: "d-near", ...LIM } })], changes: [change({ developmentId: "d-near", location: PAF })], today }).length, 1, "interest dev itself");
  assert.equal(planMatchAlerts({ claims: [claim({ projects: [], interest: null })], changes: [near], today }).length, 0);
});

test("interest is ignored when the claim has projects", () => {
  const near = change({ developmentId: "d-p", location: PAF });
  assert.equal(planMatchAlerts({ claims: [claim({ interest: { developmentId: "d-int", ...PAF } })], changes: [near], today }).length, 0);
});

test("cap 3 per claim: own projects first, then price ascending", () => {
  const c = claim({ projects: [{ developmentId: "d-own", ...LIM }] });
  const changes = [
    change({ developmentId: "n1", name: "N1", price: 350_000 }),
    change({ developmentId: "n2", name: "N2", price: 210_000 }),
    change({ developmentId: "n3", name: "N3", price: 250_000 }),
    change({ developmentId: "d-own", name: "Own", price: 390_000 }),
  ];
  const out = planMatchAlerts({ claims: [c], changes, today });
  assert.equal(MAX_ALERTS_PER_CLAIM, 3);
  assert.deepEqual(out.map((o) => o.developmentId), ["d-own", "n2", "n3"]);
});

test("one alert per development per claim (lowest price kept)", () => {
  const changes = [
    change({ type: "new_units", price: 330_000 }),
    change({ type: "price_from_changed", price: 310_000, previousPrice: 350_000 }),
  ];
  const out = planMatchAlerts({ claims: [claim()], changes, today });
  assert.equal(out.length, 1);
  assert.equal(out[0].payload.priceFrom, 310_000);
  assert.equal(out[0].payload.changeType, "price_from_changed");
});

test("claims are planned independently", () => {
  const out = planMatchAlerts({ claims: [claim(), claim({ claimId: "c2", partnerId: "p2", leadId: "l2" })], changes: [change()], today });
  assert.deepEqual(out.map((o) => o.refKey), ["match:c1:d-own:2026-10-18", "match:c2:d-own:2026-10-18"]);
});
