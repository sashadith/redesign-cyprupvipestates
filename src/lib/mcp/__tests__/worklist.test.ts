import { test } from "node:test";
import assert from "node:assert/strict";
import { mapWorklistItems } from "@/lib/mcp/tools/worklistMap";

const base = { category: "CRM" as const, deepLink: "/admin/crm/x", since: new Date("2026-09-01T00:00:00Z") };

test("splits lead follow-ups from presentation items and keeps URGENT first", () => {
  const r = mapWorklistItems([
    { ...base, id: "lead-followup:L2", severity: "ACTION", title: "No follow-up on B for 9 days", description: "Contacted. Last contact 9 days ago." },
    { ...base, id: "presentation-engaged:P1", severity: "ACTION", title: "A opened the presentation 4 times", description: "…" },
    { ...base, id: "lead-followup:L1", severity: "URGENT", title: "A is waiting for a first response since 30h", description: "New, no contact logged yet." },
    { ...base, id: "presentation-expiring:P2", severity: "INFO", title: "…", description: "…" },
    { ...base, id: "sold-out:D1", severity: "INFO", title: "not crm", description: "" },
  ]);
  assert.deepEqual(r.leadFollowups.map((x) => x.leadId), ["L1", "L2"]);
  assert.equal(r.leadFollowups[0].severity, "URGENT");
  assert.deepEqual(r.presentationIds, ["P1", "P2"]);
});
