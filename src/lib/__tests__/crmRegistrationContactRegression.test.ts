import { test } from "node:test";
import assert from "node:assert/strict";
import { REAL_CONTACT_TYPES } from "@/lib/partner/claims";
import { SLA_OUTBOUND_TYPES } from "@/lib/crm/sla";
import { CONTACT_TYPES } from "@/lib/mcp/leadRow";
import { readFileSync } from "node:fs";

// Spec 2026-10-27 §4 / §12.1: a message to or from a DEVELOPER is not client
// contact. Registration rows are SYSTEM rows with direction null, so they stay
// out of every "last contact" list below (SLA, stale detection on the board and
// Today, the partner claims, the insights) and out of the old admin cockpit,
// whose lastContactRow takes the newest row with direction != null. If one of
// these lists ever grows SYSTEM, registrations start counting as contact.
test("SYSTEM rows never count as client contact anywhere", () => {
  for (const list of [REAL_CONTACT_TYPES, SLA_OUTBOUND_TYPES, CONTACT_TYPES]) {
    assert.ok(!(list as readonly string[]).includes("SYSTEM"), JSON.stringify(list));
  }
});

test("registration code writes SYSTEM rows with direction null and never applies the follow-up cadence", () => {
  for (const f of ["src/lib/crm/registration/register.ts", "src/lib/crm/registration/mark.ts"]) {
    const src = readFileSync(f, "utf8");
    assert.doesNotMatch(src, /applyFollowUpCadence|logLeadInteraction|"EMAIL_OUT"|"WHATSAPP_OUT"|"EMAIL_IN"|"WHATSAPP_IN"/, f);
    assert.match(src, /type: "SYSTEM", channel: "SYSTEM", direction: null/, f);
  }
});
