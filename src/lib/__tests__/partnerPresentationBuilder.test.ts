import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canEditPartnerPresentation, expiryFromInput, parsePartnerFilters, toPartnerMatch, validatePartnerItems, type DevUnits,
} from "@/lib/partner/presentationBuilder";
import type { DevelopmentMatch } from "@/lib/crm/matching";
import { normalizeRef } from "@/lib/unitRef";

test("filters: garbage gives safe defaults, unpublished never included", () => {
  assert.deepEqual(parsePartnerFilters("x"), {
    budgetMin: null, budgetMax: null, bedrooms: [], propertyTypes: [], districts: [], areas: [], includeReady: false, onlyAvailable: true,
  });
  const f = parsePartnerFilters({
    budgetMin: 200000, budgetMax: -5, bedrooms: [2, 7, 2, 1.5, "3"], propertyTypes: ["Villa", "Castle"], includeReady: true, onlyAvailable: false,
    districts: Array.from({ length: 31 }, (_, i) => `D${i}`), areas: ["Peyia", "", 5, "x".repeat(81)],
  });
  assert.equal(f.budgetMin, 200000);
  assert.equal(f.budgetMax, null);
  assert.deepEqual(f.bedrooms, [2]);
  assert.deepEqual(f.propertyTypes, ["Villa"]);
  assert.equal(f.includeReady, false);
  assert.equal(f.onlyAvailable, false);
  assert.equal(f.districts!.length, 30);
  assert.deepEqual(f.areas, ["Peyia"]);
});

const match = (id: string, publishStatus = "published"): DevelopmentMatch => ({
  development: {
    id, publicName: "Aura", town: "Paphos", district: "Paphos", area: "Peyia", priceFrom: 1, priceTo: null, currency: "EUR", mainImage: null,
    developer: "Secret Developer Ltd", completion: null, slug: "aura", publishStatus, lat: null, lng: null,
    commission: { ratePercent: 5, source: "PROJECT" }, unitsAvailable: 1, unitsAvailableAll: 1, unitsTotal: 1,
  },
  score: 100, matchedUnits: [], allAvailableUnits: [], scoreBreakdown: { budget: 40, bedrooms: 25, location: 20, propertyType: 15 },
});

test("match reduction: no developer, no commission, only allowed published projects", () => {
  const m = toPartnerMatch(match("a"), new Set(["a"]))!;
  assert.equal(m.development.developer, null);
  assert.deepEqual(m.development.commission, { ratePercent: null, source: "MISSING" });
  assert.ok(!JSON.stringify(m).includes("Secret Developer"));
  assert.equal(toPartnerMatch(match("b"), new Set(["a"])), null);
  assert.equal(toPartnerMatch(match("a", "ready"), new Set(["a"])), null);
});

const devs = new Map<string, DevUnits>([
  ["a", { name: "Aura", units: [
    { id: "u1", ref: "A101", status: "available" },
    { id: "u2", ref: "A102", status: "sold" },
    { id: "u3", ref: null, status: "available" },
  ] }],
  ["b", { name: "Bella", units: [{ id: "v1", ref: "B1", status: "available" }] }],
]);
const ctx = { allowed: new Set(["a", "b"]), devs };
const ref = (r: string, name: string) => normalizeRef(r, name);

test("items: refs and ids resolved against that project's available units", () => {
  const r = validatePartnerItems([
    { developmentId: "a", unitRefs: [ref("A101", "Aura"), ref("A102", "Aura"), ref("B1", "Bella")], unitIds: ["u3", "v1"], aliasName: " Sea View ", advisorComment: "Great" },
    { developmentId: "b" },
  ], ctx);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.items[0], { developmentId: "a", unitRefs: [ref("A101", "Aura")], unitIds: ["u3"], sortIndex: 0, aliasName: "Sea View", advisorComment: "Great" });
  assert.deepEqual(r.items[1], { developmentId: "b", unitRefs: null, unitIds: null, sortIndex: 1, aliasName: null, advisorComment: null });
});

test("items: picks that are all gone are refused, not saved empty", () => {
  const r = validatePartnerItems([{ developmentId: "a", unitRefs: [ref("A102", "Aura")] }], ctx);
  assert.deepEqual(r, { ok: false, code: "err.presentationUnits", developmentId: "a" });
});

test("items: unknown, duplicate, too many projects and over-long texts are refused", () => {
  assert.deepEqual(validatePartnerItems([{ developmentId: "zzz" }], ctx), { ok: false, code: "err.presentationProjects", developmentId: "zzz" });
  assert.equal(validatePartnerItems([{ developmentId: "a" }, { developmentId: "a" }], ctx).ok, false);
  assert.equal(validatePartnerItems([], ctx).ok, false);
  const many = new Map<string, DevUnits>(Array.from({ length: 13 }, (_, i): [string, DevUnits] => [`p${i}`, { name: `P${i}`, units: [] }]));
  assert.deepEqual(validatePartnerItems(Array.from({ length: 13 }, (_, i) => ({ developmentId: `p${i}` })), { allowed: new Set(many.keys()), devs: many }),
    { ok: false, code: "err.presentationProjects" });
  assert.deepEqual(validatePartnerItems([{ developmentId: "a", aliasName: "x".repeat(121) }], ctx), { ok: false, code: "err.presentationText", developmentId: "a" });
  assert.deepEqual(validatePartnerItems([{ developmentId: "a", advisorComment: "a\u0007b" }], ctx), { ok: false, code: "err.presentationText", developmentId: "a" });
});

test("edit rights: own, not revoked, client still active", () => {
  const me = { partnerId: "p1", activeLeadIds: new Set(["l1"]) };
  assert.equal(canEditPartnerPresentation({ partnerId: "p1", status: "active", leadId: "l1" }, me), true);
  assert.equal(canEditPartnerPresentation({ partnerId: "p1", status: "expired", leadId: "l1" }, me), true);
  assert.equal(canEditPartnerPresentation({ partnerId: "p2", status: "active", leadId: "l1" }, me), false);
  assert.equal(canEditPartnerPresentation({ partnerId: null, status: "active", leadId: "l1" }, me), false);
  assert.equal(canEditPartnerPresentation({ partnerId: "p1", status: "revoked", leadId: "l1" }, me), false);
  assert.equal(canEditPartnerPresentation({ partnerId: "p1", status: "active", leadId: "l9" }, me), false);
});

test("expiry: tomorrow up to 90 days ahead, Cyprus calendar", () => {
  const now = new Date("2026-11-11T23:30:00Z"); // already 12 Nov in Cyprus
  assert.equal(expiryFromInput("2026-11-12", now), null);
  assert.equal(expiryFromInput("2026-11-13", now)!.toISOString(), "2026-11-13T21:59:59.000Z");
  assert.ok(expiryFromInput("2027-02-10", now));
  assert.equal(expiryFromInput("2027-02-11", now), null);
  assert.equal(expiryFromInput("2026-02-30", now), null);
  assert.equal(expiryFromInput("13.11.2026", now), null);
});
