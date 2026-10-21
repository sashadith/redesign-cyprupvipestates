import { test } from "node:test";
import assert from "node:assert/strict";
import { leadRow } from "@/lib/mcp/leadRow";

test("leadRow maps a Prisma lead to the compact shape and never leaks extra fields", () => {
  const r = leadRow({
    id: "L1", firstName: "Max", lastName: "Muster", email: "m@x.de", phone: "+49", status: "NEW", lostReason: null, source: "CONTACT_FORM",
    countryOfResidence: "DE", languagePreference: "de", budgetMin: 300000, budgetMax: 500000, hotAt: null, nextFollowUpAt: null,
    createdAt: new Date("2026-09-01T00:00:00Z"), projectInterest: { title: "Limassol Marina" },
    interactions: [{ type: "EMAIL_OUT", occurredAt: new Date("2026-09-02T00:00:00Z") }],
  } as any);
  assert.equal(r.leadId, "L1");
  assert.equal(r.name, "Max Muster");
  assert.equal(r.bucket, "leads");
  assert.deepEqual(r.budget, { min: 300000, max: 500000 });
  assert.equal(r.projectInterest, "Limassol Marina");
  assert.equal(r.hot, false);
  assert.equal(r.lastContact?.type, "EMAIL_OUT");
  assert.deepEqual(Object.keys(r).sort(), ["bucket", "budget", "countryOfResidence", "createdAt", "email", "hot", "hotSince", "language", "lastContact", "leadId", "lostReason", "name", "nextFollowUpAt", "phone", "projectInterest", "source", "status"]);
});

test("leadRow returns a stored lost reason", () => {
  const r = leadRow({
    id: "L2", firstName: "Anna", lastName: "Nowak", email: null, phone: null, status: "LOST", lostReason: "BOUGHT_ELSEWHERE", source: "CONTACT_FORM",
    countryOfResidence: null, languagePreference: null, budgetMin: null, budgetMax: null, hotAt: null, nextFollowUpAt: null,
    createdAt: new Date("2026-09-01T00:00:00Z"), projectInterest: null, interactions: [],
  } as any);
  assert.equal(r.lostReason, "BOUGHT_ELSEWHERE");
});
