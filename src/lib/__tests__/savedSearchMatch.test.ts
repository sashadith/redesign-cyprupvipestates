import test from "node:test";
import assert from "node:assert/strict";
import { matchesSavedSearch, type DevFacts } from "@/lib/crm/savedSearchMatch";

/* The Project Cockpit's "matches a saved search" column answers a weaker
   question than the matching panel does — "is this project inside the search
   this lead was last shown" rather than "how well does it score". These tests
   pin the boundary of that claim, and in particular the cases where a looser
   reading would put a lead in front of an advisor who never searched for
   anything of the sort. */

const unit = (o: Partial<DevFacts["units"][number]> = {}) =>
  ({ status: "available", beds: "2", type: "Apartment", price: 300_000, ...o });

const dev = (o: Partial<DevFacts> = {}): DevFacts => ({
  district: "Paphos", town: "Paphos", area: "Konia",
  units: [unit()],
  ...o,
});

const lead = (o: Partial<{ budgetMin: number | null; budgetMax: number | null; propertyTypeInterest: string[] }> = {}) =>
  ({ budgetMin: null, budgetMax: null, propertyTypeInterest: [] as string[], ...o });

test("a search with no criteria at all is not a match", () => {
  // Otherwise every lead who ever opened the panel would appear on every
  // project — "no filter" read as "interested in everything".
  assert.equal(matchesSavedSearch(dev(), {}, lead()), false);
  assert.equal(matchesSavedSearch(dev(), null, lead()), false);
});

test("a sold-out project is nobody's live search result", () => {
  const soldOut = dev({ units: [unit({ status: "sold" }), unit({ status: "reserved" })] });
  assert.equal(matchesSavedSearch(soldOut, { districts: ["paphos"] }, lead()), false);
});

test("district matches through the same cascade the matcher uses", () => {
  assert.ok(matchesSavedSearch(dev(), { districts: ["paphos"] }, lead()));
  assert.equal(matchesSavedSearch(dev(), { districts: ["limassol"] }, lead()), false);
});

test("a criterion the advisor left empty is skipped, not failed", () => {
  // districts set, bedrooms empty → bedrooms must not veto.
  assert.ok(matchesSavedSearch(dev(), { districts: ["paphos"], bedrooms: [] }, lead()));
});

test("bedrooms are matched against AVAILABLE units only", () => {
  const d = dev({ units: [unit({ beds: "2", status: "sold" }), unit({ beds: "4" })] });
  assert.equal(matchesSavedSearch(d, { bedrooms: [2] }, lead()), false, "the 2-bed is gone");
  assert.ok(matchesSavedSearch(d, { bedrooms: [4] }, lead()));
});

test("property type falls back to the lead's standing interest, as the matcher resolves it", () => {
  const d = dev({ units: [unit({ type: "Villa" })] });
  assert.ok(matchesSavedSearch(d, {}, lead({ propertyTypeInterest: ["villa"] })));
  assert.equal(matchesSavedSearch(d, {}, lead({ propertyTypeInterest: ["apartment"] })), false);
  // An explicit panel choice wins over the lead's standing interest.
  assert.equal(matchesSavedSearch(d, { propertyTypes: ["apartment"] }, lead({ propertyTypeInterest: ["villa"] })), false);
});

test("type aliases come from normalizeType, so 'house' finds a villa", () => {
  const d = dev({ units: [unit({ type: "Villa" })] });
  assert.ok(matchesSavedSearch(d, { propertyTypes: ["house"] }, lead()));
});

test("budget uses the matcher's 10 per cent band, not a bare comparison", () => {
  const d = dev({ units: [unit({ price: 330_000 })] });
  // 330k against a 300k ceiling is 10 per cent over — inside the band the
  // matching panel itself applies, so the column must agree with it.
  assert.ok(matchesSavedSearch(d, { budgetMax: 300_000 }, lead()));
  assert.equal(matchesSavedSearch(d, { budgetMax: 250_000 }, lead()), false);
});

test("the panel's budget wins over the lead's own, and an unpriced project cannot match one", () => {
  const d = dev({ units: [unit({ price: 900_000 })] });
  assert.ok(matchesSavedSearch(d, { budgetMax: 1_000_000 }, lead({ budgetMax: 200_000 })));

  const unpriced = dev({ units: [unit({ price: null })] });
  assert.equal(matchesSavedSearch(unpriced, { budgetMax: 500_000 }, lead()), false);
});

test("every stated criterion must hold, not just one", () => {
  const d = dev({ units: [unit({ beds: "2", price: 300_000, type: "Apartment" })] });
  assert.ok(matchesSavedSearch(d, { districts: ["paphos"], bedrooms: [2], budgetMax: 320_000 }, lead()));
  assert.equal(
    matchesSavedSearch(d, { districts: ["paphos"], bedrooms: [5], budgetMax: 320_000 }, lead()),
    false,
    "right district and budget, wrong size — still not what they searched for",
  );
});
